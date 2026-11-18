/**
 * Testes de ponta a ponta contra um PostgreSQL/PostGIS real.
 * Rode `pnpm db:up` na raiz antes. Na CI o banco sobe como serviço.
 */
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { migrate } from '../src/database/migrate';
import { configureApp } from '../src/setup';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://lume:lume@localhost:5432/lume';
process.env.DATABASE_URL = DATABASE_URL;

describe('API L.U.M.E. (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    await migrate(DATABASE_URL, () => undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    pool = new Pool({ connectionString: DATABASE_URL });
  });

  afterAll(async () => {
    await pool?.end();
    await app?.close();
  });

  it('GET /v1/health responde ok com PostGIS', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database).toBe('up');
    expect(res.body.checks.postgis).toMatch(/^\d+\.\d+/);
  });

  it('rota inexistente devolve erro no formato padrão', async () => {
    const res = await request(app.getHttpServer()).get('/v1/nao-existe').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, path: '/v1/nao-existe' });
    expect(res.body.timestamp).toBeDefined();
  });

  it('migrações são idempotentes', async () => {
    expect(await migrate(DATABASE_URL, () => undefined)).toEqual([]);
  });

  it('categorias iniciais foram semeadas', async () => {
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM categories WHERE parent_id IS NULL');
    expect(rows[0].n).toBe(8);
  });

  it('cobertura por raio distingue quem atende o endereço', async () => {
    // Prova de conceito da regra central (PDF, pág. 12), dentro de uma transação descartada.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cat = await client.query(`SELECT id FROM categories WHERE slug = 'eletricista'`);
      const prov = await client.query(
        `INSERT INTO providers (kind, display_name, status) VALUES ('PROFESSIONAL', 'Teste Elétrica', 'APPROVED') RETURNING id`,
      );
      const listing = await client.query(
        `INSERT INTO listings (provider_id, category_id, title, mode, status)
         VALUES ($1, $2, 'Reparos elétricos', 'AT_HOME', 'APPROVED') RETURNING id`,
        [prov.rows[0].id, cat.rows[0].id],
      );
      // Atende num raio de 2 km a partir de um ponto em São Paulo.
      await client.query(
        `INSERT INTO coverage_areas (listing_id, type, radius_m, center, verified_at)
         VALUES ($1, 'RADIUS', 2000, ST_MakePoint(-46.6333, -23.5505)::geography, now())`,
        [listing.rows[0].id],
      );

      const servedAt = async (lng: number, lat: number) =>
        (
          await client.query(
            `SELECT EXISTS (
               SELECT 1 FROM coverage_areas ca
               WHERE ca.listing_id = $1 AND ca.type = 'RADIUS'
                 AND ST_DWithin(ca.center, ST_MakePoint($2, $3)::geography, ca.radius_m)
             ) AS served`,
            [listing.rows[0].id, lng, lat],
          )
        ).rows[0].served;

      expect(await servedAt(-46.6400, -23.5550)).toBe(true); // ~800 m
      expect(await servedAt(-46.7000, -23.6000)).toBe(false); // ~8 km
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});
