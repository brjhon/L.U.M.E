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

/** Canais de contato registrados como conversão (cliques em Ligar/WhatsApp/Como chegar). */
export const CONTACT_CHANNELS = ['PHONE', 'WHATSAPP', 'DIRECTIONS'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
}

export interface Category extends CategorySummary {
  icon: string | null;
  sensitive: boolean;
  children: Category[];
}

/**
 * Um resultado de busca.
 * `eligibility` só existe para modos em que o fornecedor vai até o cliente (DELIVERY, AT_HOME).
 * Para IN_STORE (o cliente vai até o local) e REMOTE, é `null` e a interface usa `mode`.
 */
export interface SearchResultItem {
  listingId: string;
  title: string;
  description: string | null;
  mode: ServiceMode;
  eligibility: Eligibility | null;
  /** Distância em metros até o endereço mais próximo do fornecedor, se ele tiver endereço. */
  distanceM: number | null;
  category: CategorySummary;
  provider: { id: string; kind: ProviderKind; displayName: string };
}

export interface SearchResponse {
  items: SearchResultItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListingDetail {
  id: string;
  title: string;
  description: string | null;
  mode: ServiceMode;
  category: CategorySummary;
  provider: {
    id: string;
    kind: ProviderKind;
    displayName: string;
    description: string | null;
    phone: string | null;
    whatsapp: string | null;
    locations: { address: string; location: GeoPoint }[];
  };
  /** Presente quando a consulta informa lat/lng. */
  eligibility: Eligibility | null;
  distanceM: number | null;
}

export interface GeocodeResult {
  formattedAddress: string;
  location: GeoPoint;
  postalCode: string | null;
}

/** Formato padrão de erro da API (PDF, pág. 14). */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/** Papel global gravado no usuário (tabela users). MEMBER e COMMUNITY_ADMIN vêm do vínculo com a comunidade. */
export const PLATFORM_ROLES = ['USER', 'PARTNER', 'PLATFORM_ADMIN'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** Usuário autenticado (GET /v1/me). */
export interface Me {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: PlatformRole;
  createdAt: string;
}

/**
 * Resposta de login, cadastro e renovação.
 * O token de acesso vai no cabeçalho `Authorization: Bearer`. O refresh token é guardado com
 * segurança pelo cliente e trocado em /v1/auth/refresh; cada troca invalida o anterior.
 */
export interface AuthResponse {
  accessToken: string;
  /** Segundos até o token de acesso expirar. */
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: Me;
}

// ---------- Área do parceiro e moderação (Sprint 2) ----------

export const COVERAGE_TYPES = ['RADIUS', 'POLYGON', 'COMMUNITY'] as const;
export type CoverageType = (typeof COVERAGE_TYPES)[number];

/** Geometria GeoJSON (coordenadas [lng, lat]) aceita como área de cobertura. */
export interface GeoJsonArea {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

export interface CoverageArea {
  id: string;
  type: CoverageType;
  radiusM: number | null;
  center: GeoPoint | null;
  polygon: GeoJsonArea | null;
  communityId: string | null;
  /** Verificada pela equipe: é o que dá "CONFIRMED" na busca. */
  verified: boolean;
}

export interface PartnerListing {
  id: string;
  providerId: string;
  title: string;
  description: string | null;
  mode: ServiceMode;
  status: ModerationStatus;
  /** Motivo da última decisão de moderação (rejeição/suspensão). */
  moderationNote: string | null;
  category: CategorySummary;
  coverage: CoverageArea[];
  updatedAt: string;
}

export interface PartnerProvider {
  id: string;
  kind: ProviderKind;
  displayName: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: ModerationStatus;
  moderationNote: string | null;
  locations: { id: string; address: string; location: GeoPoint }[];
  listings: PartnerListing[];
  createdAt: string;
  updatedAt: string;
}

export const MODERATION_DECISIONS = ['APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number];

/** Item da fila de moderação do admin. */
export interface ModerationQueueItem {
  kind: 'PROVIDER' | 'LISTING';
  id: string;
  title: string;
  status: ModerationStatus;
  provider: { id: string; displayName: string; status: ModerationStatus };
  owner: { id: string; name: string; email: string | null } | null;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}
