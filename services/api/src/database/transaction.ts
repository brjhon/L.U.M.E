import type { Pool, PoolClient } from 'pg';

/** Roda `work` numa transação: COMMIT se der certo, ROLLBACK se lançar. */
export async function withTransaction<T>(pool: Pool, work: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
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

/** Erro de chave estrangeira ou de unicidade do PostgreSQL. */
export const pgErrorCode = (err: unknown): string | undefined => (err as { code?: string }).code;
