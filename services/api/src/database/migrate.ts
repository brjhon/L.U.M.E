/**
 * Executor de migrações SQL versionadas.
 * Cada arquivo em services/api/migrations (NNNN_nome.sql) roda uma única vez,
 * dentro de uma transação, e fica registrado em schema_migrations.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

export async function migrate(databaseUrl: string, log = console.log): Promise<string[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);
    // Impede duas execuções simultâneas (ex.: dois deploys).
    await client.query('SELECT pg_advisory_lock(727274)');

    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
        (r) => r.name,
      ),
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{4}_.+\.sql$/.test(f))
      .sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        log(`✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Falha na migração ${file}: ${(err as Error).message}`);
      }
    }
    if (applied.length === 0) log('Nenhuma migração pendente.');
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => undefined);
    await client.end();
  }
  return applied;
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL não definida.');
    process.exit(1);
  }
  migrate(url).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
