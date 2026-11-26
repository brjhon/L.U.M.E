/**
 * Cria um administrador da plataforma, ou promove uma conta existente.
 * Não há rota HTTP que conceda PLATFORM_ADMIN: só quem tem acesso ao servidor roda isto.
 *
 *   ADMIN_EMAIL=voce@exemplo.com.br ADMIN_NAME="Seu Nome" pnpm --filter @lume/api create-admin
 *
 * A senha é pedida no terminal (sem eco) ou lida da entrada padrão; nunca por variável de
 * ambiente ou argumento, que ficam no histórico do shell e na lista de processos.
 * Se a conta já existir, só o papel muda e a senha fica como está.
 */
import { createInterface } from 'node:readline';
import { Client } from 'pg';
import { hashPassword } from '../auth/password';

async function readPassword(prompt: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  if (process.stdin.isTTY) {
    // Esconde o que é digitado.
    const rlAny = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    rlAny._writeToOutput = (s: string) => {
      if (s.includes(prompt)) rlAny.output.write(prompt);
    };
  }
  const answer = await new Promise<string>((resolve) => rl.question(prompt, resolve));
  rl.close();
  if (process.stdin.isTTY) process.stdout.write('\n');
  return answer;
}

export async function createAdmin(
  databaseUrl: string,
  email: string,
  name: string,
  getPassword: () => Promise<string>,
  log = console.log,
): Promise<'created' | 'promoted'> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email],
    );
    if (existing.rows[0]) {
      const id = existing.rows[0].id;
      await client.query(`UPDATE users SET role = 'PLATFORM_ADMIN' WHERE id = $1`, [id]);
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
         VALUES (NULL, 'user.promoted_admin', 'user', $1, '{"via":"cli"}')`,
        [id],
      );
      log(`Conta existente promovida a PLATFORM_ADMIN.`);
      return 'promoted';
    }
    const password = await getPassword();
    if (password.length < 12) throw new Error('Senha de administrador: mínimo de 12 caracteres.');
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'PLATFORM_ADMIN') RETURNING id`,
      [email, name, await hashPassword(password)],
    );
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
       VALUES (NULL, 'user.created_admin', 'user', $1, '{"via":"cli"}')`,
      [rows[0].id],
    );
    log(`Administrador criado.`);
    return 'created';
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim();
  if (!url || !email || !name) {
    console.error('Defina DATABASE_URL, ADMIN_EMAIL e ADMIN_NAME.');
    process.exit(1);
  }
  createAdmin(url, email, name, () => readPassword('Senha do administrador (mín. 12): ')).catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
}
