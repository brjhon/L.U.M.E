/**
 * Autenticação e autorização contra o PostgreSQL real.
 * Cada requisição usa um IP próprio (X-Forwarded-For com TRUST_PROXY=1) para o rate limit
 * não interferir entre testes; o teste de força bruta reaproveita um IP de propósito.
 */
import 'reflect-metadata';
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthResponse } from '@lume/types';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Roles } from '../src/auth/decorators';
import { createAdmin } from '../src/database/create-admin';
import { migrate } from '../src/database/migrate';
import { configureApp } from '../src/setup';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://lume:lume@localhost:5432/lume';
process.env.DATABASE_URL = DATABASE_URL;
process.env.TRUST_PROXY = '1';

/** Rota fictícia só para testar o controle por papel. */
@Controller({ path: 'test-admin-only', version: '1' })
class AdminOnlyController {
  @Get()
  @Roles('PLATFORM_ADMIN')
  ok() {
    return { ok: true };
  }
}

let ipCounter = 0;
const freshIp = () => `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

describe('Autenticação (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  const PASSWORD = 'senha-bem-longa-123';

  const http = (ip = freshIp()) => {
    const agent = request(app.getHttpServer());
    return {
      get: (url: string) => agent.get(url).set('X-Forwarded-For', ip),
      post: (url: string) => agent.post(url).set('X-Forwarded-For', ip),
      patch: (url: string) => agent.patch(url).set('X-Forwarded-For', ip),
    };
  };
  const newEmail = () => `teste-${randomUUID()}@exemplo.com.br`;
  const register = async (email = newEmail()): Promise<AuthResponse> =>
    (await http().post('/v1/auth/register').send({ name: 'Teste', email, password: PASSWORD }).expect(201)).body;

  beforeAll(async () => {
    await migrate(DATABASE_URL, () => undefined);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [AdminOnlyController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    pool = new Pool({ connectionString: DATABASE_URL });
  });

  afterAll(async () => {
    await pool?.query(`DELETE FROM users WHERE email LIKE 'teste-%@exemplo.com.br'`);
    await pool?.end();
    await app?.close();
  });

  it('cadastro devolve sessão e não expõe o hash da senha', async () => {
    const email = newEmail();
    const res = await register(email.toUpperCase());
    expect(res.user).toMatchObject({ email, role: 'USER', name: 'Teste' });
    expect(res.accessToken.split('.')).toHaveLength(3);
    expect(res.refreshToken.length).toBeGreaterThanOrEqual(40);
    expect(JSON.stringify(res)).not.toMatch(/argon2|password/i);

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [email]);
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);
    const tok = await pool.query('SELECT token_hash FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE u.email = $1', [email]);
    expect(Buffer.from(tok.rows[0].token_hash).toString('base64url')).not.toBe(res.refreshToken);
  });

  it('cadastro valida dados e recusa e-mail repetido', async () => {
    await http().post('/v1/auth/register').send({ name: 'X', email: 'invalido', password: 'curta' }).expect(400);
    const email = newEmail();
    await register(email);
    await http().post('/v1/auth/register').send({ name: 'Outro', email, password: PASSWORD }).expect(409);
  });

  it('cadastro não aceita escolher o próprio papel', async () => {
    await http()
      .post('/v1/auth/register')
      .send({ name: 'Esperto', email: newEmail(), password: PASSWORD, role: 'PLATFORM_ADMIN' })
      .expect(400);
  });

  it('login: mesma resposta para e-mail inexistente e senha errada', async () => {
    const email = newEmail();
    await register(email);
    const wrong = await http().post('/v1/auth/login').send({ email, password: 'senha-errada-000' }).expect(401);
    const missing = await http().post('/v1/auth/login').send({ email: newEmail(), password: PASSWORD }).expect(401);
    expect(wrong.body.message).toBe(missing.body.message);
    await http().post('/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
  });

  it('rotas privadas exigem token válido', async () => {
    await http().get('/v1/me').expect(401);
    await http().get('/v1/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    const { accessToken, user } = await register();
    const me = await http().get('/v1/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(me.body.id).toBe(user.id);
  });

  it('token assinado com outro segredo ou alterado é recusado', async () => {
    const { accessToken } = await register();
    const [h, p, s] = accessToken.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: randomUUID(), iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    await http().get('/v1/me').set('Authorization', `Bearer ${h}.${forged}.${s}`).expect(401);
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    await http().get('/v1/me').set('Authorization', `Bearer ${none}.${p}.`).expect(401);
  });

  it('PATCH /me altera nome e telefone, e só os campos permitidos', async () => {
    const { accessToken } = await register();
    const auth = `Bearer ${accessToken}`;
    const res = await http().patch('/v1/me').set('Authorization', auth).send({ name: 'Novo Nome', phone: '5511988887777' }).expect(200);
    expect(res.body).toMatchObject({ name: 'Novo Nome', phone: '5511988887777' });
    await http().patch('/v1/me').set('Authorization', auth).send({ role: 'PLATFORM_ADMIN' }).expect(400);
    const cleared = await http().patch('/v1/me').set('Authorization', auth).send({ phone: null }).expect(200);
    expect(cleared.body.phone).toBeNull();
  });

  it('refresh rotaciona o token, e reusar o antigo encerra a sessão inteira', async () => {
    const first = await register();
    const second: AuthResponse = (await http().post('/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200)).body;
    expect(second.refreshToken).not.toBe(first.refreshToken);

    // Alguém reapresenta o token antigo (ex.: roubado): a família toda é revogada...
    await http().post('/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
    // ...inclusive o token legítimo mais novo.
    await http().post('/v1/auth/refresh').send({ refreshToken: second.refreshToken }).expect(401);
  });

  it('logout invalida o refresh token', async () => {
    const { refreshToken } = await register();
    await http().post('/v1/auth/logout').send({ refreshToken }).expect(204);
    await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('troca de senha encerra as outras sessões e tokens antigos', async () => {
    const email = newEmail();
    const deviceA = await register(email);
    const deviceB: AuthResponse = (await http().post('/v1/auth/login').send({ email, password: PASSWORD }).expect(200)).body;
    // Garante que o novo `iat` caia num segundo posterior ao dos tokens antigos.
    await new Promise((r) => setTimeout(r, 1100));

    const NEW = 'outra-senha-bem-longa-456';
    await http()
      .post('/v1/me/password')
      .set('Authorization', `Bearer ${deviceA.accessToken}`)
      .send({ currentPassword: 'errada-errada', newPassword: NEW })
      .expect(401);
    const fresh: AuthResponse = (
      await http()
        .post('/v1/me/password')
        .set('Authorization', `Bearer ${deviceA.accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: NEW })
        .expect(200)
    ).body;

    await http().get('/v1/me').set('Authorization', `Bearer ${deviceB.accessToken}`).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken: deviceB.refreshToken }).expect(401);
    await http().get('/v1/me').set('Authorization', `Bearer ${fresh.accessToken}`).expect(200);
    await http().post('/v1/auth/login').send({ email, password: PASSWORD }).expect(401);
    await http().post('/v1/auth/login').send({ email, password: NEW }).expect(200);
  });

  it('usuário bloqueado perde acesso na hora, mesmo com token válido', async () => {
    const { accessToken, refreshToken, user } = await register();
    await pool.query(`UPDATE users SET status = 'BLOCKED' WHERE id = $1`, [user.id]);
    await http().get('/v1/me').set('Authorization', `Bearer ${accessToken}`).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('controle por papel: usuário comum recebe 403, admin passa', async () => {
    const { accessToken } = await register();
    await http().get('/v1/test-admin-only').set('Authorization', `Bearer ${accessToken}`).expect(403);

    const email = newEmail();
    expect(await createAdmin(DATABASE_URL, email, 'Admin', async () => 'senha-de-admin-forte', () => undefined)).toBe('created');
    const admin: AuthResponse = (
      await http().post('/v1/auth/login').send({ email, password: 'senha-de-admin-forte' }).expect(200)
    ).body;
    expect(admin.user.role).toBe('PLATFORM_ADMIN');
    await http().get('/v1/test-admin-only').set('Authorization', `Bearer ${admin.accessToken}`).expect(200);
  });

  it('rotas públicas continuam abertas', async () => {
    await http().get('/v1/health').expect(200);
    await http().get('/v1/categories').expect(200);
  });

  it('força bruta no login é barrada por IP', async () => {
    const ip = freshIp();
    const attempt = () => http(ip).post('/v1/auth/login').send({ email: newEmail(), password: 'qualquer-coisa' });
    for (let i = 0; i < 10; i++) await attempt().expect(401);
    await attempt().expect(429);
  });
});
