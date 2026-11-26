/**
 * Leitura e validação das variáveis de ambiente.
 * Falha cedo, na subida, se algo obrigatório estiver faltando ou inseguro.
 */
export interface Env {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  /** Tamanho máximo do pool de conexões com o banco. */
  databasePoolMax: number;
  /** Com chave, a geocodificação usa o Google; sem ela, o OpenStreetMap (só desenvolvimento). */
  googleMapsApiKey: string | null;
  /** Identificação exigida pela política de uso do Nominatim/OpenStreetMap. */
  geocoderUserAgent: string;
  /** Origens liberadas no CORS (painel web). Separadas por vírgula. */
  corsOrigins: string[];
  /**
   * Quantos proxies reversos confiáveis ficam na frente da API (ex.: 1 para o Caddy).
   * Sem isso, atrás de proxy, todo cliente teria o IP do proxy e o rate limit seria compartilhado.
   */
  trustProxy: number;
  /** Segredo HS256 dos tokens de acesso (JWT de vida curta). */
  jwtAccessSecret: string;
  /** Validade do token de acesso, em segundos. */
  accessTokenTtlSeconds: number;
  /** Validade do refresh token, em dias. */
  refreshTokenTtlDays: number;
}

const DEV_USER_AGENT = 'lume-dev (contato@lume.app)';
/** Só para desenvolvimento e testes; produção exige um segredo próprio. */
const DEV_JWT_SECRET = 'lume-dev-jwt-secret-nao-use-em-producao';
const MIN_SECRET_LENGTH = 32;

function intVar(source: NodeJS.ProcessEnv, name: string, fallback: number, min: number): number {
  const raw = source[name];
  const value = raw === undefined || raw.trim() === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} inválida: ${raw}`);
  }
  return value;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = source.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
  }
  const port = intVar(source, 'API_PORT', 3000, 1);
  const nodeEnv = source.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const googleMapsApiKey = source.GOOGLE_MAPS_API_KEY?.trim() || null;
  const geocoderUserAgent = source.GEOCODER_USER_AGENT?.trim() || DEV_USER_AGENT;
  const jwtAccessSecret = source.JWT_ACCESS_SECRET?.trim() || DEV_JWT_SECRET;
  const corsRaw = source.CORS_ORIGINS?.trim();
  const corsOrigins = (corsRaw || 'http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (isProduction) {
    const problems: string[] = [];
    if (!corsRaw) problems.push('CORS_ORIGINS precisa listar as origens reais do painel');
    if (corsOrigins.some((o) => o === '*' || /localhost|127\.0\.0\.1/.test(o))) {
      problems.push('CORS_ORIGINS não pode ter "*" nem localhost em produção');
    }
    if (!googleMapsApiKey && geocoderUserAgent === DEV_USER_AGENT) {
      problems.push(
        'sem GOOGLE_MAPS_API_KEY, defina GEOCODER_USER_AGENT com um contato real (política do OpenStreetMap)',
      );
    }
    if (/:\/\/[^:]+:(lume|postgres|password|senha)@/.test(databaseUrl)) {
      problems.push('DATABASE_URL usa senha padrão; gere uma senha forte');
    }
    if (jwtAccessSecret === DEV_JWT_SECRET || jwtAccessSecret.length < MIN_SECRET_LENGTH || /troque/i.test(jwtAccessSecret)) {
      problems.push(`JWT_ACCESS_SECRET precisa ser aleatório com ${MIN_SECRET_LENGTH}+ caracteres (openssl rand -hex 32)`);
    }
    if (problems.length > 0) {
      throw new Error(`Configuração insegura para produção:\n- ${problems.join('\n- ')}`);
    }
  }

  return {
    nodeEnv,
    isProduction,
    port,
    databaseUrl,
    databasePoolMax: intVar(source, 'DATABASE_POOL_MAX', 10, 1),
    googleMapsApiKey,
    geocoderUserAgent,
    corsOrigins,
    trustProxy: intVar(source, 'TRUST_PROXY', 0, 0),
    jwtAccessSecret,
    accessTokenTtlSeconds: intVar(source, 'ACCESS_TOKEN_TTL_SECONDS', 900, 60),
    refreshTokenTtlDays: intVar(source, 'REFRESH_TOKEN_TTL_DAYS', 30, 1),
  };
}
