import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { PlatformRole } from '@lume/types';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { IS_PUBLIC, ROLES_KEY, type AuthenticatedRequest } from './decorators';

interface AccessPayload {
  sub: string;
  iat: number;
}

/**
 * Guard global: toda rota exige login, exceto as marcadas com @Public().
 * O token só carrega o id; papel e status são lidos do banco a cada requisição, então
 * bloquear um usuário ou mudar seu papel vale na hora, sem esperar o token expirar.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Login necessário');

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const { rows } = await this.pool.query<{ role: PlatformRole; status: string; pwd_at: number | null }>(
      `SELECT role, status, extract(epoch FROM password_changed_at)::bigint AS pwd_at
         FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [payload.sub],
    );
    const user = rows[0];
    // Token emitido antes da última troca de senha não vale mais.
    if (!user || user.status !== 'ACTIVE' || (user.pwd_at !== null && payload.iat < Number(user.pwd_at))) {
      throw new UnauthorizedException('Sessão encerrada. Entre novamente.');
    }
    req.user = { id: payload.sub, role: user.role };

    const roles = this.reflector.getAllAndOverride<PlatformRole[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException('Sem permissão para esta ação');
    }
    return true;
  }
}
