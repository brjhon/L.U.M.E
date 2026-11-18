/**
 * Leitura e validação das variáveis de ambiente.
 * Falha cedo, na subida, se algo obrigatório estiver faltando.
 */
export interface Env {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  /** Com chave, a geocodificação usa o Google; sem ela, o OpenStreetMap (só desenvolvimento). */
  googleMapsApiKey: string | null;
  /** Identificação exigida pela política de uso do Nominatim/OpenStreetMap. */
  geocoderUserAgent: string;
  /** Origens liberadas no CORS (painel web). Separadas por vírgula. */
  corsOrigins: string[];
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const databaseUrl = source.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não definida. Copie .env.example para .env.');
  }
  const port = Number(source.API_PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`API_PORT inválida: ${source.API_PORT}`);
  }
  const nodeEnv = source.NODE_ENV ?? 'development';
  const googleMapsApiKey = source.GOOGLE_MAPS_API_KEY?.trim() || null;
  return {
    nodeEnv,
    port,
    databaseUrl,
    googleMapsApiKey,
    geocoderUserAgent: source.GEOCODER_USER_AGENT?.trim() || 'lume-dev (contato@lume.app)',
    corsOrigins: (source.CORS_ORIGINS ?? 'http://localhost:3001')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
