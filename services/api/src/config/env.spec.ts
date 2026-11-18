import { loadEnv } from './env';

describe('loadEnv', () => {
  it('lê as variáveis obrigatórias', () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://x', API_PORT: '4000' });
    expect(env).toMatchObject({ nodeEnv: 'development', port: 4000, databaseUrl: 'postgres://x' });
    expect(env.googleMapsApiKey).toBeNull();
    expect(env.corsOrigins).toEqual(['http://localhost:3001']);
  });

  it('lê chave do Google e lista de origens CORS', () => {
    const env = loadEnv({ DATABASE_URL: 'x', GOOGLE_MAPS_API_KEY: ' k ', CORS_ORIGINS: 'https://a.com, https://b.com' });
    expect(env.googleMapsApiKey).toBe('k');
    expect(env.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
  });

  it('falha sem DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('falha com porta inválida', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgres://x', API_PORT: 'abc' })).toThrow(/API_PORT/);
  });
});
