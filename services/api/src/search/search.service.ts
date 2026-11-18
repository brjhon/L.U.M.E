import { Inject, Injectable } from '@nestjs/common';
import type { Eligibility, ProviderKind, SearchResponse, ServiceMode } from '@lume/types';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { coverageJoin, distanceJoin, eligibilityExpr, publicVisibility } from './coverage.sql';
import type { SearchQueryDto } from './search.dto';

interface Row {
  listing_id: string;
  title: string;
  description: string | null;
  mode: ServiceMode;
  eligibility: Eligibility | null;
  distance_m: number | null;
  category_id: string;
  category_slug: string;
  category_name: string;
  provider_id: string;
  provider_kind: ProviderKind;
  provider_name: string;
}

/** Quebra o texto em palavras e escapa os curingas do LIKE. */
export function searchTerms(q: string | undefined): string[] {
  if (!q) return [];
  return q
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 8)
    .map((w) => w.replace(/[\\%_]/g, (c) => `\\${c}`));
}

@Injectable()
export class SearchService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Algoritmo do MVP (PDF, pág. 12):
   * 1. ponto geográfico já geocodificado (lat/lng);
   * 2. ofertas aprovadas por categoria/texto;
   * 3. cobertura declarada por raio, polígono ou comunidade;
   * 4. elegibilidade CONFIRMED / UNCONFIRMED / NOT_SERVED;
   * 5. ranking: confirmadas → presenciais → não confirmadas → remotas → não atende;
   *    depois relevância do texto e distância.
   */
  async search(dto: SearchQueryDto): Promise<SearchResponse> {
    const terms = searchTerms(dto.q);
    const offset = (dto.page - 1) * dto.pageSize;

    const params = [
      dto.lng, // $1
      dto.lat, // $2
      dto.communityId ?? null, // $3
      dto.category ?? null, // $4
      dto.mode ?? null, // $5
      terms, // $6
      dto.q?.trim() || null, // $7
      dto.maxDistanceM, // $8
      dto.includeNotServed, // $9
      dto.pageSize + 1, // $10 (um a mais para saber se há próxima página)
      offset, // $11
    ];

    const sql = `
      WITH o AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g),
      cat AS (
        SELECT c.id FROM categories c
        WHERE c.slug = $4 OR c.parent_id = (SELECT id FROM categories WHERE slug = $4)
      ),
      base AS (
        SELECT l.id AS listing_id, l.title, l.description, l.mode,
               c.id AS category_id, c.slug AS category_slug, c.name AS category_name,
               p.id AS provider_id, p.kind AS provider_kind, p.display_name AS provider_name,
               lume_normalize(concat_ws(' ', l.title, l.description, p.display_name, c.name, pc.name)) AS haystack,
               ${eligibilityExpr} AS eligibility,
               cov.has_any, cov.verified_hit, cov.unverified_hit,
               d.distance_m
        FROM listings l
        JOIN providers p   ON p.id = l.provider_id
        JOIN categories c  ON c.id = l.category_id
        LEFT JOIN categories pc ON pc.id = c.parent_id
        CROSS JOIN o
        ${coverageJoin('$3')}
        ${distanceJoin}
        WHERE ${publicVisibility}
          AND ($4::text IS NULL OR l.category_id IN (SELECT id FROM cat))
          AND ($5::service_mode IS NULL OR l.mode = $5::service_mode)
      )
      SELECT listing_id, title, description, mode, eligibility, distance_m,
             category_id, category_slug, category_name, provider_id, provider_kind, provider_name
      FROM base
      WHERE NOT EXISTS (
              SELECT 1 FROM unnest($6::text[]) w
              WHERE base.haystack NOT LIKE '%' || lume_normalize(w) || '%')
        AND (
              mode = 'REMOTE'
           OR (mode = 'IN_STORE' AND distance_m <= $8)
           OR verified_hit OR unverified_hit
           OR (NOT has_any AND distance_m <= $8)
           OR ($9 AND has_any AND distance_m <= $8)
        )
      ORDER BY
        CASE WHEN eligibility = 'CONFIRMED'   THEN 0
             WHEN mode = 'IN_STORE'           THEN 1
             WHEN eligibility = 'UNCONFIRMED' THEN 2
             WHEN mode = 'REMOTE'             THEN 3
             ELSE 4 END,
        CASE WHEN $7::text IS NULL THEN 0 ELSE word_similarity(lume_normalize($7), haystack) END DESC,
        distance_m ASC NULLS LAST,
        listing_id
      LIMIT $10 OFFSET $11`;

    const { rows } = await this.pool.query<Row>(sql, params);
    const hasMore = rows.length > dto.pageSize;
    return {
      items: rows.slice(0, dto.pageSize).map((r) => ({
        listingId: r.listing_id,
        title: r.title,
        description: r.description,
        mode: r.mode,
        eligibility: r.eligibility,
        distanceM: r.distance_m === null ? null : Math.round(Number(r.distance_m)),
        category: { id: r.category_id, slug: r.category_slug, name: r.category_name },
        provider: { id: r.provider_id, kind: r.provider_kind, displayName: r.provider_name },
      })),
      page: dto.page,
      pageSize: dto.pageSize,
      hasMore,
    };
  }
}
