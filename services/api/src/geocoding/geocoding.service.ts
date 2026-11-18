import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { GeocodeResult } from '@lume/types';

/** Um provedor de geocodificação (Google, OpenStreetMap ou um falso nos testes). */
export interface Geocoder {
  readonly name: string;
  geocode(query: string): Promise<GeocodeResult[]>;
}
export const GEOCODER = Symbol('GEOCODER');
export const GEOCODER_FETCH = Symbol('GEOCODER_FETCH');

type FetchFn = typeof fetch;
const TIMEOUT_MS = 5000;

/** Google Geocoding API. Respeitar os termos de armazenamento e atribuição (PDF, pág. 12). */
export class GoogleGeocoder implements Geocoder {
  readonly name = 'google';
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async geocode(query: string): Promise<GeocodeResult[]> {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.search = new URLSearchParams({ address: query, region: 'br', language: 'pt-BR', key: this.apiKey }).toString();
    const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Google respondeu ${res.status}`);
    const body = (await res.json()) as {
      status: string;
      results: {
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        address_components: { long_name: string; types: string[] }[];
      }[];
    };
    if (body.status === 'ZERO_RESULTS') return [];
    if (body.status !== 'OK') throw new Error(`Google status ${body.status}`);
    return body.results.slice(0, 5).map((r) => ({
      formattedAddress: r.formatted_address,
      location: { lat: r.geometry.location.lat, lng: r.geometry.location.lng },
      postalCode: r.address_components.find((c) => c.types.includes('postal_code'))?.long_name ?? null,
    }));
  }
}

/**
 * Nominatim (OpenStreetMap): gratuito, para desenvolvimento e testes do piloto.
 * Política de uso: no máximo 1 requisição/s e User-Agent identificado. Em produção, use o Google.
 */
export class NominatimGeocoder implements Geocoder {
  readonly name = 'nominatim';
  constructor(
    private readonly userAgent: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async geocode(query: string): Promise<GeocodeResult[]> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      countrycodes: 'br',
      addressdetails: '1',
      limit: '5',
      'accept-language': 'pt-BR',
    }).toString();
    const res = await this.fetchFn(url, {
      headers: { 'User-Agent': this.userAgent },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);
    const body = (await res.json()) as {
      display_name: string;
      lat: string;
      lon: string;
      address?: { postcode?: string };
    }[];
    return body.map((r) => ({
      formattedAddress: r.display_name,
      location: { lat: Number(r.lat), lng: Number(r.lon) },
      postalCode: r.address?.postcode ?? null,
    }));
  }
}

const CEP_RE = /^\s*(\d{5})-?(\d{3})\s*$/;

/**
 * Geocodificação com cache em memória e suporte a CEP.
 * CEP é resolvido pelo ViaCEP (logradouro, bairro, cidade) e depois geocodificado,
 * porque os provedores de mapa costumam errar CEPs brasileiros isolados.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly cache = new Map<string, { at: number; value: GeocodeResult[] }>();
  private static readonly TTL_MS = 24 * 60 * 60 * 1000;
  private static readonly MAX_ENTRIES = 1000;

  constructor(
    @Inject(GEOCODER) private readonly geocoder: Geocoder,
    @Inject(GEOCODER_FETCH) private readonly fetchFn: FetchFn = fetch,
  ) {}

  async geocode(rawQuery: string): Promise<GeocodeResult[]> {
    const query = rawQuery.trim().replace(/\s+/g, ' ');
    const key = query.toLowerCase();
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < GeocodingService.TTL_MS) return hit.value;

    let value: GeocodeResult[];
    try {
      value = await this.resolve(query);
    } catch (err) {
      // Não loga o endereço digitado (dado pessoal).
      this.logger.warn(`Falha na geocodificação (${this.geocoder.name}): ${(err as Error).message}`);
      throw new ServiceUnavailableException('Serviço de endereços indisponível. Tente novamente.');
    }

    if (this.cache.size >= GeocodingService.MAX_ENTRIES) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  private async resolve(query: string): Promise<GeocodeResult[]> {
    const cep = CEP_RE.exec(query);
    if (!cep) return this.geocoder.geocode(query);

    const digits = `${cep[1]}${cep[2]}`;
    const formattedCep = `${cep[1]}-${cep[2]}`;
    const res = await this.fetchFn(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`ViaCEP respondeu ${res.status}`);
    const v = (await res.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (v.erro) return [];
    const address = [v.logradouro, v.bairro, v.localidade && v.uf ? `${v.localidade} - ${v.uf}` : v.localidade]
      .filter(Boolean)
      .join(', ');
    const results = await this.geocoder.geocode(address || formattedCep);
    return results.map((r) => ({ ...r, postalCode: r.postalCode ?? formattedCep }));
  }
}
