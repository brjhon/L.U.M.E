/**
 * Área do parceiro + moderação contra o PostGIS real.
 * Jornada: parceiro cadastra → moderação rejeita com motivo → parceiro corrige → aprova →
 * aparece na busca como UNCONFIRMED → equipe verifica a cobertura → CONFIRMED.
 * Usa um ponto em Curitiba, longe dos dados de demonstração (São Paulo).
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthResponse, ModerationQueueItem, Page, PartnerProvider, SearchResponse } from '@lume/types';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createAdmin } from '../src/database/create-admin';
import { migrate } from '../src/database/migrate';
import { configureApp } from '../src/setup';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://lume:lume@localhost:5432/lume';
process.env.DATABASE_URL = DATABASE_URL;
process.env.TRUST_PROXY = '1';

const SPOT = { lat: -25.4284, lng: -49.2733 }; // Curitiba, centro
const TOKEN = `zarabatana${randomUUID().slice(0, 6)}`; // palavra única para achar na busca

let ip = 0;
const nextIp = () => `10.9.${Math.floor(++ip / 250)}.${ip % 250}`;

describe('Parceiro e moderação (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  let categoryId: string;
  let partner: AuthResponse;
  let stranger: AuthResponse;
  let admin: AuthResponse;
  const PASSWORD = 'senha-bem-longa-123';

  const as = (session: AuthResponse | null) => {
    const agent = request(app.getHttpServer());
    const wrap = (r: request.Test) => {
      r.set('X-Forwarded-For', nextIp());
      return session ? r.set('Authorization', `Bearer ${session.accessToken}`) : r;
    };
    return {
      get: (u: string) => wrap(agent.get(u)),
      post: (u: string) => wrap(agent.post(u)),
      patch: (u: string) => wrap(agent.patch(u)),
      delete: (u: string) => wrap(agent.delete(u)),
    };
  };
  const signup = async (): Promise<AuthResponse> =>
    (
      await as(null)
        .post('/v1/auth/register')
        .send({ name: 'Parceiro Teste', email: `teste-${randomUUID()}@exemplo.com.br`, password: PASSWORD })
        .expect(201)
    ).body;
  const searchSpot = async (): Promise<SearchResponse> =>
    (await as(null).get(`/v1/search?lat=${SPOT.lat}&lng=${SPOT.lng}&q=${TOKEN}`).expect(200)).body;

  beforeAll(async () => {
    await migrate(DATABASE_URL, () => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    pool = new Pool({ connectionString: DATABASE_URL });
    categoryId = (await pool.query(`SELECT id FROM categories WHERE slug = 'eletricista'`)).rows[0].id;

    partner = await signup();
    stranger = await signup();
    const adminEmail = `teste-${randomUUID()}@exemplo.com.br`;
    await createAdmin(DATABASE_URL, adminEmail, 'Moderadora', async () => 'senha-de-admin-forte', () => undefined);
    admin = (await as(null).post('/v1/auth/login').send({ email: adminEmail, password: 'senha-de-admin-forte' }).expect(200)).body;
  });

  afterAll(async () => {
    await pool?.query(
      `DELETE FROM providers WHERE owner_user_id IN (SELECT id FROM users WHERE email LIKE 'teste-%@exemplo.com.br')`,
    );
    await pool?.query(`DELETE FROM audit_logs WHERE actor_id IN (SELECT id FROM users WHERE email LIKE 'teste-%@exemplo.com.br')`);
    await pool?.query(`DELETE FROM users WHERE email LIKE 'teste-%@exemplo.com.br'`);
    await pool?.end();
    await app?.close();
  });

  it('jornada completa: cadastro → rejeição → correção → aprovação → busca → verificação', async () => {
    // 1. Parceiro cadastra fornecedor: nasce PENDING e a conta vira PARTNER.
    const created: PartnerProvider = (
      await as(partner)
        .post('/v1/partner/providers')
        .send({ kind: 'PROFESSIONAL', displayName: 'Elétrica Curitiba', whatsapp: '5541999990000' })
        .expect(201)
    ).body;
    expect(created).toMatchObject({ status: 'PENDING', listings: [], locations: [] });
    expect((await as(partner).get('/v1/me').expect(200)).body.role).toBe('PARTNER');

    await as(partner)
      .post(`/v1/partner/providers/${created.id}/locations`)
      .send({ address: 'Rua XV de Novembro, 100 - Centro, Curitiba', ...SPOT })
      .expect(201);
    const listing = (
      await as(partner)
        .post(`/v1/partner/providers/${created.id}/listings`)
        .send({ categoryId, title: `Instalação ${TOKEN}`, mode: 'AT_HOME' })
        .expect(201)
    ).body;
    const withCoverage = (
      await as(partner)
        .post(`/v1/partner/listings/${listing.id}/coverage`)
        .send({ type: 'RADIUS', centerLat: SPOT.lat, centerLng: SPOT.lng, radiusM: 3000 })
        .expect(201)
    ).body;
    expect(withCoverage.coverage).toHaveLength(1);
    expect(withCoverage.coverage[0]).toMatchObject({ type: 'RADIUS', radiusM: 3000, verified: false });

    // 2. Pendente não aparece no app.
    expect((await searchSpot()).items).toHaveLength(0);
    await as(null).get(`/v1/listings/${listing.id}`).expect(404);

    // 3. Aparece na fila da moderação, com o dono identificado.
    const queue: Page<ModerationQueueItem> = (await as(admin).get('/v1/admin/moderation?pageSize=100').expect(200)).body;
    const queued = queue.items.filter((i) => i.provider.id === created.id);
    expect(queued.map((i) => i.kind).sort()).toEqual(['LISTING', 'PROVIDER']);
    expect(queued[0].owner?.id).toBe(partner.user.id);

    // 4. Rejeitar exige motivo; o parceiro vê o motivo.
    await as(admin).post(`/v1/admin/providers/${created.id}/decision`).send({ decision: 'REJECTED' }).expect(400);
    await as(admin)
      .post(`/v1/admin/providers/${created.id}/decision`)
      .send({ decision: 'REJECTED', note: 'Inclua o telefone fixo do negócio.' })
      .expect(204);
    let mine: PartnerProvider = (await as(partner).get(`/v1/partner/providers/${created.id}`).expect(200)).body;
    expect(mine).toMatchObject({ status: 'REJECTED', moderationNote: 'Inclua o telefone fixo do negócio.' });

    // 5. Parceiro corrige: volta para PENDING e o motivo some.
    mine = (await as(partner).patch(`/v1/partner/providers/${created.id}`).send({ phone: '5541333330000' }).expect(200)).body;
    expect(mine).toMatchObject({ status: 'PENDING', moderationNote: null, phone: '5541333330000' });

    // 6. Aprova fornecedor e oferta: aparece na busca como UNCONFIRMED (cobertura não verificada).
    await as(admin).post(`/v1/admin/providers/${created.id}/decision`).send({ decision: 'APPROVED' }).expect(204);
    await as(admin).post(`/v1/admin/listings/${listing.id}/decision`).send({ decision: 'APPROVED' }).expect(204);
    let found = (await searchSpot()).items.find((i) => i.listingId === listing.id);
    expect(found?.eligibility).toBe('UNCONFIRMED');

    // 7. Equipe verifica a área: vira CONFIRMED.
    await as(admin)
      .post(`/v1/admin/coverage/${withCoverage.coverage[0].id}/verify`)
      .send({ verified: true })
      .expect(204);
    found = (await searchSpot()).items.find((i) => i.listingId === listing.id);
    expect(found?.eligibility).toBe('CONFIRMED');

    // 8. Editar oferta aprovada volta para a fila e tira do ar até nova aprovação.
    await as(partner).patch(`/v1/partner/listings/${listing.id}`).send({ title: `Instalação e reparo ${TOKEN}` }).expect(200);
    expect((await searchSpot()).items.find((i) => i.listingId === listing.id)).toBeUndefined();

    // Toda decisão ficou na auditoria, sem o texto da nota.
    const audit = await pool.query(
      `SELECT action, metadata FROM audit_logs WHERE actor_id = $1 ORDER BY created_at`,
      [admin.user.id],
    );
    expect(audit.rows.map((r) => r.action)).toEqual(
      expect.arrayContaining(['provider.rejected', 'provider.approved', 'listing.approved', 'coverage.verified']),
    );
    expect(JSON.stringify(audit.rows)).not.toContain('telefone fixo');
  });

  it('ninguém mexe no que é de outro parceiro (404, sem revelar que existe)', async () => {
    const own: PartnerProvider = (
      await as(partner).post('/v1/partner/providers').send({ kind: 'BUSINESS', displayName: 'Loja do Dono' }).expect(201)
    ).body;
    const listing = (
      await as(partner)
        .post(`/v1/partner/providers/${own.id}/listings`)
        .send({ categoryId, title: 'Oferta do dono', mode: 'REMOTE' })
        .expect(201)
    ).body;

    await as(stranger).get(`/v1/partner/providers/${own.id}`).expect(404);
    await as(stranger).patch(`/v1/partner/providers/${own.id}`).send({ displayName: 'Roubado' }).expect(404);
    await as(stranger).delete(`/v1/partner/providers/${own.id}`).expect(404);
    await as(stranger).post(`/v1/partner/providers/${own.id}/listings`).send({ categoryId, title: 'Intrusa', mode: 'REMOTE' }).expect(404);
    await as(stranger).patch(`/v1/partner/listings/${listing.id}`).send({ title: 'Roubada' }).expect(404);
    await as(stranger)
      .post(`/v1/partner/listings/${listing.id}/coverage`)
      .send({ type: 'RADIUS', centerLat: SPOT.lat, centerLng: SPOT.lng, radiusM: 1000 })
      .expect(404);
    expect((await as(stranger).get('/v1/partner/providers').expect(200)).body).toEqual([]);

    // Parceiro não promove o próprio cadastro nem acessa a moderação.
    await as(partner).post(`/v1/admin/providers/${own.id}/decision`).send({ decision: 'APPROVED' }).expect(403);
    await as(partner).get('/v1/admin/moderation').expect(403);
    await as(null).get('/v1/partner/providers').expect(401);
    // Campos de moderação não são aceitos na edição.
    await as(partner).patch(`/v1/partner/providers/${own.id}`).send({ status: 'APPROVED' }).expect(400);
  });

  it('valida geometrias de cobertura', async () => {
    const p: PartnerProvider = (
      await as(partner).post('/v1/partner/providers').send({ kind: 'PROFESSIONAL', displayName: 'Geo Teste' }).expect(201)
    ).body;
    const l = (
      await as(partner).post(`/v1/partner/providers/${p.id}/listings`).send({ categoryId, title: 'Geo', mode: 'DELIVERY' }).expect(201)
    ).body;
    const cov = (body: object) => as(partner).post(`/v1/partner/listings/${l.id}/coverage`).send(body);

    await cov({ type: 'RADIUS', centerLat: SPOT.lat, centerLng: SPOT.lng, radiusM: 80_000 }).expect(400); // raio grande demais
    await cov({ type: 'RADIUS', centerLat: 200, centerLng: SPOT.lng, radiusM: 1000 }).expect(400); // latitude impossível
    await cov({ type: 'COMMUNITY', communityId: randomUUID() }).expect(400); // comunidade inexistente
    await cov({ type: 'POLYGON', polygon: { type: 'Point', coordinates: [1, 2] } }).expect(400);
    // "Gravata borboleta": bordas se cruzam.
    await cov({
      type: 'POLYGON',
      polygon: { type: 'Polygon', coordinates: [[[-49.28, -25.43], [-49.26, -25.41], [-49.26, -25.43], [-49.28, -25.41], [-49.28, -25.43]]] },
    }).expect(400);
    // Metade do Paraná: área grande demais.
    await cov({
      type: 'POLYGON',
      polygon: { type: 'Polygon', coordinates: [[[-52, -26], [-49, -26], [-49, -24], [-52, -24], [-52, -26]]] },
    }).expect(400);
    // Lixo no lugar das coordenadas.
    await cov({ type: 'POLYGON', polygon: { type: 'Polygon', coordinates: [['a', 'b']] } }).expect(400);

    const ok = (
      await cov({
        type: 'POLYGON',
        polygon: { type: 'Polygon', coordinates: [[[-49.28, -25.44], [-49.26, -25.44], [-49.26, -25.42], [-49.28, -25.42], [-49.28, -25.44]]] },
      }).expect(201)
    ).body;
    expect(ok.coverage[0]).toMatchObject({ type: 'POLYGON', verified: false });
    expect(ok.coverage[0].polygon.type).toBe('MultiPolygon');

    await as(stranger).delete(`/v1/partner/coverage/${ok.coverage[0].id}`).expect(404);
    await as(partner).delete(`/v1/partner/coverage/${ok.coverage[0].id}`).expect(204);
  });

  it('suspenso não edita, mas pode remover o cadastro', async () => {
    const p: PartnerProvider = (
      await as(partner).post('/v1/partner/providers').send({ kind: 'BUSINESS', displayName: 'Vai Ser Suspenso' }).expect(201)
    ).body;
    await as(admin)
      .post(`/v1/admin/providers/${p.id}/decision`)
      .send({ decision: 'SUSPENDED', note: 'Denúncias de golpe em análise.' })
      .expect(204);
    await as(partner).patch(`/v1/partner/providers/${p.id}`).send({ displayName: 'Novo Nome' }).expect(403);
    await as(partner).post(`/v1/partner/providers/${p.id}/listings`).send({ categoryId, title: 'Nova', mode: 'REMOTE' }).expect(403);
    await as(partner).delete(`/v1/partner/providers/${p.id}`).expect(204);
    await as(partner).get(`/v1/partner/providers/${p.id}`).expect(404);
  });

  it('limite de fornecedores por conta', async () => {
    const user = await signup();
    for (let i = 0; i < 5; i++) {
      await as(user).post('/v1/partner/providers').send({ kind: 'BUSINESS', displayName: `Loja ${i}` }).expect(201);
    }
    await as(user).post('/v1/partner/providers').send({ kind: 'BUSINESS', displayName: 'Loja 6' }).expect(400);
  });

  it('admin vê o fornecedor completo para analisar', async () => {
    const p: PartnerProvider = (
      await as(partner).post('/v1/partner/providers').send({ kind: 'BUSINESS', displayName: 'Para Análise' }).expect(201)
    ).body;
    const full = (await as(admin).get(`/v1/admin/providers/${p.id}`).expect(200)).body;
    expect(full).toMatchObject({ id: p.id, displayName: 'Para Análise', status: 'PENDING' });
    await as(admin).get(`/v1/admin/providers/${randomUUID()}`).expect(404);
  });
});
