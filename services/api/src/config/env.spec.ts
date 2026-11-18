import { loadEnv } from './env';

describe('loadEnv', () => {
  it('lê as variáveis obrigatórias', () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://x', API_PORT: '4000' });
    expect(env).toEqual({ nodeEnv: 'development', port: 4000, databaseUrl: 'postgres://x' });
  });

  it('falha sem DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('falha com porta inválida', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgres://x', API_PORT: 'abc' })).toThrow(/API_PORT/);
  });
});
