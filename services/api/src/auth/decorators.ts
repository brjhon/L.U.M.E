import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { PlatformRole } from '@lume/types';
import type { Request } from 'express';

/** Rota aberta, sem login. Todas as outras exigem token de acesso válido. */
export const IS_PUBLIC = 'lume:isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restringe a rota a papéis globais. PLATFORM_ADMIN não passa automaticamente: liste-o. */
export const ROLES_KEY = 'lume:roles';
export const Roles = (...roles: PlatformRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthUser {
  id: string;
  role: PlatformRole;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Usuário autenticado na rota (só em rotas não públicas). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const user = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new Error('CurrentUser usado em rota pública');
  return user;
});
