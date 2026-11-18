import { ServiceUnavailableException } from '@nestjs/common';
import { GeocodingService, GoogleGeocoder, NominatimGeocoder, type Geocoder } from './geocoding.service';

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('GoogleGeocoder', () => {
  it('converte a resposta do Google e extrai o CEP', async () => {
    const fetchFn = jest.fn(() =>
      json({
        status: 'OK',
        results: [
          {
            formatted_address: 'R. Exemplo, 1 - Vila Mariana, São Paulo - SP',
            geometry: { location: { lat: -23.58, lng: -46.63 } },
            address_components: [{ long_name: '04010-100', types: ['postal_code'] }],
          },
        ],
      }),
    );
    const g = new GoogleGeocoder('chave', fetchFn as unknown as typeof fetch);
    const [r] = await g.geocode('Rua Exemplo 1');
    expect(r).toEqual({
      formattedAddress: 'R. Exemplo, 1 - Vila Mariana, São Paulo - SP',
      location: { lat: -23.58, lng: -46.63 },
      postalCode: '04010-100',
    });
    expect(String((fetchFn.mock.calls[0] as unknown[])[0])).toContain('region=br');
  });

  it('ZERO_RESULTS vira lista vazia; outros status são erro', async () => {
    const zero = new GoogleGeocoder('k', (() => json({ status: 'ZERO_RESULTS', results: [] })) as unknown as typeof fetch);
    expect(await zero.geocode('x')).toEqual([]);
    const denied = new GoogleGeocoder('k', (() => json({ status: 'REQUEST_DENIED', results: [] })) as unknown as typeof fetch);
    await expect(denied.geocode('x')).rejects.toThrow('REQUEST_DENIED');
  });
});

describe('NominatimGeocoder', () => {
  it('envia User-Agent e converte lat/lon', async () => {
    const fetchFn = jest.fn((_url: URL, _init: RequestInit) =>
      json([{ display_name: 'Vila Mariana', lat: '-23.58', lon: '-46.63', address: { postcode: '04010-100' } }]),
    );
    const g = new NominatimGeocoder('lume-test', fetchFn as unknown as typeof fetch);
    expect(await g.geocode('Vila Mariana')).toEqual([
      { formattedAddress: 'Vila Mariana', location: { lat: -23.58, lng: -46.63 }, postalCode: '04010-100' },
    ]);
    expect(fetchFn.mock.calls[0][1].headers).toEqual({ 'User-Agent': 'lume-test' });
  });
});

describe('GeocodingService', () => {
  const result = { formattedAddress: 'X', location: { lat: 1, lng: 2 }, postalCode: null };

  it('usa cache para a mesma consulta', async () => {
    const geocoder: Geocoder = { name: 't', geocode: jest.fn(async () => [result]) };
    const svc = new GeocodingService(geocoder, jest.fn() as unknown as typeof fetch);
    await svc.geocode('Rua A, 1');
    await svc.geocode('  rua a,   1 ');
    expect(geocoder.geocode).toHaveBeenCalledTimes(1);
  });

  it('resolve CEP pelo ViaCEP antes de geocodificar', async () => {
    const geocoder: Geocoder = { name: 't', geocode: jest.fn(async () => [result]) };
    const fetchFn = jest.fn(() =>
      json({ logradouro: 'Rua Domingos de Morais', bairro: 'Vila Mariana', localidade: 'São Paulo', uf: 'SP' }),
    );
    const svc = new GeocodingService(geocoder, fetchFn as unknown as typeof fetch);
    const [r] = await svc.geocode('04010100');
    expect(geocoder.geocode).toHaveBeenCalledWith('Rua Domingos de Morais, Vila Mariana, São Paulo - SP');
    expect(r.postalCode).toBe('04010-100');
  });

  it('CEP inexistente retorna lista vazia', async () => {
    const geocoder: Geocoder = { name: 't', geocode: jest.fn() };
    const svc = new GeocodingService(geocoder, (() => json({ erro: 'true' })) as unknown as typeof fetch);
    expect(await svc.geocode('00000-000')).toEqual([]);
    expect(geocoder.geocode).not.toHaveBeenCalled();
  });

  it('falha do provedor vira 503 sem vazar detalhes', async () => {
    const geocoder: Geocoder = { name: 't', geocode: async () => Promise.reject(new Error('timeout')) };
    const svc = new GeocodingService(geocoder, jest.fn() as unknown as typeof fetch);
    await expect(svc.geocode('Rua B')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
