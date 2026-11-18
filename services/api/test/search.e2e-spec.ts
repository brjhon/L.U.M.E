/**
 * Busca por cobertura (PDF, pág. 12) contra o PostGIS real, usando os dados de demonstração.
 * Critério do Sprint 3: buscar por endereço retorna só ofertas elegíveis
 * ou separa claramente a elegibilidade desconhecida.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SearchResponse } from '@lume/types';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { migrate } from '../src/database/migrate';
import { DEMO_COMMUNITY_ID, DEMO_ORIGIN, seedDemo } from '../src/database/seed-demo';
import { GEOCODER, type Geocoder } from '../src/geocoding/geocoding.service';
import { configureApp } from '../src/setup';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://lume:lume@localhost:5432/lume';
process.env.DATABASE_URL = DATABASE_URL;

const fakeGeocoder: Geocoder = {
  name: 'fake',
  geocode: async (q) =>
    q.includes('inexistente')
      ? []
      : [{ formattedAddress: `${q}, São Paulo`, location: { lat: DEMO_ORIGIN.lat, lng: DEMO_ORIGIN.lng }, postalCode: null }],
};

describe('Busca por cobertura (e2e)', () => {
  let app: INestApplication;
  const at = `lat=${DEMO_ORIGIN.lat}&lng=${DEMO_ORIGIN.lng}`;
  const search = async (qs = ''): Promise<SearchResponse> =>
    (await request(app.getHttpServer()).get(`/v1/search?${at}${qs}`).expect(200)).body;
  const byTitle = (r: SearchResponse) => Object.fromEntries(r.items.map((i) => [i.title, i]));

  beforeAll(async () => {
    await migrate(DATABASE_URL, () => undefined);
    await seedDemo(DATABASE_URL, () => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GEOCODER)
      .useValue(fakeGeocoder)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('classifica cada oferta pela cobertura declarada', async () => {
    const items = byTitle(await search());
    expect(items['Entrega de compras do mês'].eligibility).toBe('CONFIRMED'); // raio verificado
    expect(items['Reparos e instalações elétricas'].eligibility).toBe('CONFIRMED'); // polígono
    expect(items['Faxina residencial'].eligibility).toBe('CONFIRMED'); // cobertura do condomínio
    expect(items['Delivery de pizza'].eligibility).toBe('UNCONFIRMED'); // declarado, não verificado
    expect(items['Acompanhamento de idosos'].eligibility).toBe('UNCONFIRMED'); // sem área declarada
    expect(items['Loja e padaria'].eligibility).toBeNull(); // presencial: o cliente vai até lá
    expect(items['Suporte remoto'].eligibility).toBeNull();
  });

  it('oculta por padrão quem declara não atender e mostra separado quando pedido', async () => {
    expect(byTitle(await search())['Marmitas por encomenda']).toBeUndefined();
    const all = byTitle(await search('&includeNotServed=true'));
    expect(all['Marmitas por encomenda'].eligibility).toBe('NOT_SERVED');
  });

  it('nunca mostra fornecedor pendente de moderação', async () => {
    const all = await search('&includeNotServed=true&pageSize=50');
    expect(all.items.find((i) => i.provider.displayName.includes('Aguardando'))).toBeUndefined();
  });

  it('ordena confirmadas antes de presenciais, não confirmadas e remotas', async () => {
    const { items } = await search('&pageSize=50');
    const rank = (i: (typeof items)[number]) =>
      i.eligibility === 'CONFIRMED' ? 0 : i.mode === 'IN_STORE' ? 1 : i.eligibility === 'UNCONFIRMED' ? 2 : 3;
    const ranks = items.map(rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(items[0].eligibility).toBe('CONFIRMED');
  });

  it('busca texto sem diferenciar acentos e exige todas as palavras', async () => {
    const r = await search('&q=ELETRICA');
    expect(r.items.map((i) => i.provider.displayName)).toEqual(['João Eletricista']);
    const r2 = await search('&q=entrega%20farmacia');
    expect(r2.items.map((i) => i.title)).toEqual(['Entrega de medicamentos']);
    expect((await search('&q=%25')).items).toEqual([]); // curinga do LIKE não vaza
  });

  it('filtra por categoria incluindo subcategorias, e por modo', async () => {
    const r = await search('&category=cuidados');
    expect(r.items.map((i) => i.title).sort()).toEqual(['Acompanhamento de idosos', 'Faxina residencial']);
    const delivery = await search('&mode=DELIVERY');
    expect(delivery.items.every((i) => i.mode === 'DELIVERY')).toBe(true);
  });

  it('longe de tudo, só sobram as ofertas remotas', async () => {
    const res = await request(app.getHttpServer()).get('/v1/search?lat=-22.9068&lng=-43.1729').expect(200); // Rio
    expect(res.body.items.map((i: { mode: string }) => i.mode)).toEqual(['REMOTE']);
  });

  it('cobertura de comunidade vale pelo communityId mesmo fora do raio do condomínio', async () => {
    const far = 'lat=-23.5600&lng=-46.6600';
    const without = await request(app.getHttpServer()).get(`/v1/search?${far}&q=faxina`).expect(200);
    expect(without.body.items).toEqual([]); // declarou atender só o condomínio: NOT_SERVED, oculto
    const withCommunity = await request(app.getHttpServer())
      .get(`/v1/search?${far}&q=faxina&communityId=${DEMO_COMMUNITY_ID}`)
      .expect(200);
    expect(withCommunity.body.items[0].eligibility).toBe('CONFIRMED');
  });

  it('pagina os resultados', async () => {
    const p1 = await search('&pageSize=3');
    const p2 = await search('&pageSize=3&page=2');
    expect(p1.items).toHaveLength(3);
    expect(p1.hasMore).toBe(true);
    expect(p2.items[0].listingId).not.toBe(p1.items[0].listingId);
  });

  it('valida os parâmetros', async () => {
    await request(app.getHttpServer()).get('/v1/search?lat=abc&lng=0').expect(400);
    await request(app.getHttpServer()).get(`/v1/search?${at}&mode=VOANDO`).expect(400);
    await request(app.getHttpServer()).get(`/v1/search?${at}&pageSize=500`).expect(400);
    await request(app.getHttpServer()).get(`/v1/search?${at}&hack=1`).expect(400);
  });

  it('detalhe traz contatos e elegibilidade para o endereço', async () => {
    const { items } = await search('&q=pizza');
    const res = await request(app.getHttpServer()).get(`/v1/listings/${items[0].listingId}?${at}`).expect(200);
    expect(res.body.provider.whatsapp).toMatch(/^\d+$/);
    expect(res.body.eligibility).toBe('UNCONFIRMED');
    const noOrigin = await request(app.getHttpServer()).get(`/v1/listings/${items[0].listingId}`).expect(200);
    expect(noOrigin.body.eligibility).toBeNull();
    await request(app.getHttpServer()).get('/v1/listings/00000000-0000-4000-8000-000000000113').expect(404); // pendente
    await request(app.getHttpServer()).get('/v1/listings/nao-e-uuid').expect(400);
  });

  it('registra clique em contato', async () => {
    const { items } = await search();
    const url = `/v1/listings/${items[0].listingId}/contact-events`;
    await request(app.getHttpServer()).post(url).send({ channel: 'WHATSAPP' }).expect(204);
    await request(app.getHttpServer()).post(url).send({ channel: 'EMAIL' }).expect(400);
  });

  it('categorias vêm em árvore', async () => {
    const res = await request(app.getHttpServer()).get('/v1/categories').expect(200);
    const cuidados = res.body.find((c: { slug: string }) => c.slug === 'cuidados');
    expect(cuidados.sensitive).toBe(true);
    expect(cuidados.children.map((c: { slug: string }) => c.slug)).toContain('diarista');
  });

  it('geocodifica endereço digitado', async () => {
    const res = await request(app.getHttpServer()).get('/v1/geocode?q=Rua%20Exemplo%201').expect(200);
    expect(res.body[0].location).toEqual({ lat: DEMO_ORIGIN.lat, lng: DEMO_ORIGIN.lng });
    await request(app.getHttpServer()).get('/v1/geocode?q=ab').expect(400);
  });
});
