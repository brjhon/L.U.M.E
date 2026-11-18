/**
 * Leitura e validação das variáveis de ambiente.
 * Falha cedo, na subida, se algo obrigatório estiver faltando.
 */
export interface Env {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
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
  return { nodeEnv: source.NODE_ENV ?? 'development', port, databaseUrl };
}
