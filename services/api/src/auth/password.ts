import { hash, verify } from '@node-rs/argon2';

/**
 * Hash de senha com Argon2id nos parâmetros mínimos recomendados pela OWASP
 * (19 MiB de memória, 2 iterações, paralelismo 1). O resultado é autodescritivo
 * ($argon2id$v=19$m=...), então dá para endurecer os parâmetros no futuro sem migração.
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

// Hash de uma senha qualquer, usado quando o e-mail não existe: o login leva o mesmo tempo
// com ou sem conta, e não dá para descobrir e-mails cadastrados medindo a resposta.
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(storedHash: string | null, password: string): Promise<boolean> {
  if (!storedHash) {
    dummyHash ??= hashPassword('senha-inexistente-para-tempo-constante');
    await verify(await dummyHash, password).catch(() => false);
    return false;
  }
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
