/**
 * Tipos compartilhados entre API e painéis web.
 * O app Flutter consome o contrato OpenAPI gerado pela API (docs/openapi.json).
 */

/** Papéis da plataforma (PDF, pág. 14). */
export const ROLES = [
  'VISITOR',
  'USER',
  'MEMBER',
  'PARTNER',
  'COMMUNITY_ADMIN',
  'PLATFORM_ADMIN',
] as const;
export type Role = (typeof ROLES)[number];

/** Modo de atendimento de uma oferta (PDF, pág. 12). */
export const SERVICE_MODES = ['DELIVERY', 'IN_STORE', 'AT_HOME', 'REMOTE'] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];

/** Elegibilidade da oferta para o endereço buscado (PDF, pág. 12). */
export const ELIGIBILITY = ['CONFIRMED', 'UNCONFIRMED', 'NOT_SERVED'] as const;
export type Eligibility = (typeof ELIGIBILITY)[number];

/** Ciclo de moderação de perfis e avaliações. */
export const MODERATION_STATUS = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type ModerationStatus = (typeof MODERATION_STATUS)[number];

export const PROVIDER_KINDS = ['BUSINESS', 'PROFESSIONAL'] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptimeSeconds: number;
  checks: { database: 'up' | 'down'; postgis: string | null };
}

/** Formato padrão de erro da API (PDF, pág. 14). */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}
