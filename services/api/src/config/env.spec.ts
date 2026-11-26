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

  it('trust proxy e pool têm padrões seguros e são configuráveis', () => {
    expect(loadEnv({ DATABASE_URL: 'x' })).toMatchObject({ trustProxy: 0, databasePoolMax: 10 });
    expect(loadEnv({ DATABASE_URL: 'x', TRUST_PROXY: '1', DATABASE_POOL_MAX: '5' })).toMatchObject({
      trustProxy: 1,
      databasePoolMax: 5,
    });
    expect(() => loadEnv({ DATABASE_URL: 'x', TRUST_PROXY: '-1' })).toThrow(/TRUST_PROXY/);
  });

  describe('em produção', () => {
    const prod = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://lume:Xk29fj3lQp@db:5432/lume',
      CORS_ORIGINS: 'https://painel.exemplo.com.br',
      GEOCODER_USER_AGENT: 'lume (ops@exemplo.com.br)',
      JWT_ACCESS_SECRET: 'a3f9c1d7e5b2a8f4c6d0e9b1a7f3c5d2e8b4a6f0c1d9e7b3',
    };

    it('aceita configuração completa', () => {
      expect(loadEnv(prod).isProduction).toBe(true);
    });

    it('recusa CORS ausente, curinga ou localhost', () => {
      expect(() => loadEnv({ ...prod, CORS_ORIGINS: '' })).toThrow(/CORS_ORIGINS/);
      expect(() => loadEnv({ ...prod, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
      expect(() => loadEnv({ ...prod, CORS_ORIGINS: 'http://localhost:3001' })).toThrow(/localhost/);
    });

    it('recusa senha padrão do banco', () => {
      expect(() => loadEnv({ ...prod, DATABASE_URL: 'postgres://lume:lume@db:5432/lume' })).toThrow(
        /senha padrão/,
      );
    });

    it('exige segredo JWT forte', () => {
      expect(() => loadEnv({ ...prod, JWT_ACCESS_SECRET: '' })).toThrow(/JWT_ACCESS_SECRET/);
      expect(() => loadEnv({ ...prod, JWT_ACCESS_SECRET: 'curto' })).toThrow(/JWT_ACCESS_SECRET/);
      expect(() => loadEnv({ ...prod, JWT_ACCESS_SECRET: 'troque-isto'.padEnd(40, 'x') })).toThrow(
        /JWT_ACCESS_SECRET/,
      );
    });

    it('exige contato real para o OpenStreetMap quando não há chave do Google', () => {
      expect(() => loadEnv({ ...prod, GEOCODER_USER_AGENT: '' })).toThrow(/GEOCODER_USER_AGENT/);
      expect(() =>
        loadEnv({ ...prod, GEOCODER_USER_AGENT: '', GOOGLE_MAPS_API_KEY: 'k' }),
      ).not.toThrow();
    });
  });
});
