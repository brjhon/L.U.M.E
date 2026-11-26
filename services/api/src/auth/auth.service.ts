import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { PlatformRole } from '@lume/types';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import { loadEnv } from '../config/env';
import { PG_POOL } from '../database/database.module';
import type { AuthResponseDto, MeDto, RegisterDto, UpdateMeDto } from './auth.dto';
import { hashPassword, verifyPassword } from './password';

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: PlatformRole;
  status: string;
  password_hash: string | null;
  created_at: Date;
}

type Db = Pool | PoolClient;

const USER_COLUMNS = 'id, name, email, phone, role, status, password_hash, created_at';
const SESSION_ENDED = 'Sessão encerrada. Entre novamente.';

const sha256 = (value: string) => createHash('sha256').update(value).digest();
const isUniqueViolation = (err: unknown) => (err as { code?: string }).code === '23505';

function toMe(u: UserRow): MeDto {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    createdAt: u.created_at.toISOString(),
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly env = loadEnv();

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await hashPassword(dto.password);
    try {
      const { rows } = await this.pool.query<UserRow>(
        `INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, $3, $4)
         RETURNING ${USER_COLUMNS}`,
        [dto.name, dto.email, dto.phone ?? null, passwordHash],
      );
      return await this.issue(this.pool, rows[0]);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('Já existe uma conta com este e-mail ou telefone');
      }
      throw err;
    }
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    const user = rows[0];
    // Sempre verifica um hash (mesmo sem conta) para o tempo de resposta não revelar e-mails.
    const ok = await verifyPassword(user?.password_hash ?? null, password);
    if (!user || !ok) throw new UnauthorizedException('E-mail ou senha incorretos');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Conta bloqueada. Fale com o suporte.');
    return this.issue(this.pool, user);
  }

  /**
   * Troca um refresh token por um par novo; o antigo fica revogado e aponta para o novo.
   * Se alguém apresentar um token já trocado, a família inteira é revogada: o cliente ou
   * um atacante tem uma cópia, e os dois precisam entrar de novo.
   * Clientes devem serializar a renovação (uma por vez), senão a segunda conta como reuso.
   */
  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    return this.transaction(async (db) => {
      const { rows } = await db.query<{
        id: string;
        user_id: string;
        family_id: string;
        expired: boolean;
        revoked: boolean;
      }>(
        `SELECT id, user_id, family_id, expires_at < now() AS expired, revoked_at IS NOT NULL AS revoked
           FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
        [sha256(refreshToken)],
      );
      const token = rows[0];
      if (!token) throw new UnauthorizedException('Sessão inválida. Entre novamente.');
      if (token.revoked) {
        await this.revokeFamily(db, token.family_id);
        this.logger.warn(`Reuso de refresh token revogado; família ${token.family_id} encerrada`);
        return new UnauthorizedException(SESSION_ENDED); // devolvida para lançar depois do COMMIT
      }
      if (token.expired) throw new UnauthorizedException('Sessão expirada. Entre novamente.');

      const user = await this.findUser(db, token.user_id);
      if (!user || user.status !== 'ACTIVE') {
        await this.revokeFamily(db, token.family_id);
        return new UnauthorizedException(SESSION_ENDED);
      }
      const issued = await this.issue(db, user, token.family_id);
      await db.query(
        `UPDATE refresh_tokens SET revoked_at = now(),
                replaced_by = (SELECT id FROM refresh_tokens WHERE token_hash = $2)
          WHERE id = $1`,
        [token.id, sha256(issued.refreshToken)],
      );
      return issued;
    }).then((result) => {
      if (result instanceof UnauthorizedException) throw result;
      return result;
    });
  }

  /** Encerra a sessão do dispositivo (a família do token). Idempotente. */
  async logout(refreshToken: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = coalesce(revoked_at, now())
        WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
      [sha256(refreshToken)],
    );
  }

  async me(userId: string): Promise<MeDto> {
    const user = await this.findUser(this.pool, userId);
    if (!user) throw new NotFoundException();
    return toMe(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeDto> {
    try {
      const { rows } = await this.pool.query<UserRow>(
        `UPDATE users SET
           name  = coalesce($2, name),
           phone = CASE WHEN $3::boolean THEN $4 ELSE phone END
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING ${USER_COLUMNS}`,
        [userId, dto.name ?? null, dto.phone !== undefined, dto.phone ?? null],
      );
      if (!rows[0]) throw new NotFoundException();
      return toMe(rows[0]);
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('Este telefone já está em outra conta');
      throw err;
    }
  }

  /** Troca a senha, encerra todas as sessões e devolve uma sessão nova para este dispositivo. */
  async changePassword(userId: string, current: string, next: string): Promise<AuthResponseDto> {
    const user = await this.findUser(this.pool, userId);
    if (!user || !(await verifyPassword(user.password_hash, current))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    const passwordHash = await hashPassword(next);
    return this.transaction(async (db) => {
      // Truncado no segundo porque o `iat` do JWT tem resolução de segundos.
      await db.query(
        `UPDATE users SET password_hash = $2, password_changed_at = date_trunc('second', now())
          WHERE id = $1`,
        [userId, passwordHash],
      );
      await db.query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
      await db.query(
        `INSERT INTO audit_logs (actor_id, action, entity, entity_id)
         VALUES ($1, 'user.password_changed', 'user', $1)`,
        [userId],
      );
      return this.issue(db, user);
    });
  }

  private async issue(db: Db, user: UserRow, familyId: string = randomUUID()): Promise<AuthResponseDto> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      { expiresIn: this.env.accessTokenTtlSeconds },
    );
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.env.refreshTokenTtlDays * 86_400_000);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [user.id, familyId, sha256(refreshToken), expiresAt],
    );
    // Limpeza oportunista: tokens vencidos há mais de 7 dias não servem nem para detectar reuso.
    await db.query(
      `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < now() - interval '7 days'`,
      [user.id],
    );
    return {
      accessToken,
      expiresIn: this.env.accessTokenTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
      user: toMe(user),
    };
  }

  private async revokeFamily(db: Db, familyId: string): Promise<void> {
    await db.query(
      `UPDATE refresh_tokens SET revoked_at = coalesce(revoked_at, now()) WHERE family_id = $1`,
      [familyId],
    );
  }

  private async findUser(db: Db, id: string): Promise<UserRow | undefined> {
    const { rows } = await db.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return rows[0];
  }

  private async transaction<T>(work: (db: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
