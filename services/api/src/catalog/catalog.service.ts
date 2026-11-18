import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Category, Eligibility, ListingDetail, ProviderKind, ServiceMode } from '@lume/types';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { coverageJoin, distanceJoin, eligibilityExpr, publicVisibility } from '../search/coverage.sql';
import type { ContactEventDto, ListingDetailQueryDto } from './catalog.dto';

@Injectable()
export class CatalogService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Árvore de categorias (raiz → subcategorias), na ordem de exibição. */
  async categories(): Promise<Category[]> {
    const { rows } = await this.pool.query<{
      id: string;
      parent_id: string | null;
      slug: string;
      name: string;
      icon: string | null;
      sensitive: boolean;
    }>(`SELECT id, parent_id, slug, name, icon, sensitive FROM categories ORDER BY sort_order, name`);

    const byId = new Map<string, Category>();
    for (const r of rows) {
      byId.set(r.id, { id: r.id, slug: r.slug, name: r.name, icon: r.icon, sensitive: r.sensitive, children: [] });
    }
    const roots: Category[] = [];
    for (const r of rows) {
      const node = byId.get(r.id)!;
      const parent = r.parent_id ? byId.get(r.parent_id) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  async listing(id: string, q: ListingDetailQueryDto): Promise<ListingDetail> {
    const hasOrigin = q.lat !== undefined && q.lng !== undefined;
    const { rows } = await this.pool.query<{
      id: string;
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
      provider_description: string | null;
      phone: string | null;
      whatsapp: string | null;
      locations: { address: string; lat: number; lng: number }[];
    }>(
      `WITH o AS (
         SELECT CASE WHEN $2::float8 IS NULL OR $3::float8 IS NULL THEN NULL
                     ELSE ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography END AS g)
       SELECT l.id, l.title, l.description, l.mode,
              ${eligibilityExpr} AS eligibility, d.distance_m,
              c.id AS category_id, c.slug AS category_slug, c.name AS category_name,
              p.id AS provider_id, p.kind AS provider_kind, p.display_name AS provider_name,
              p.description AS provider_description, p.phone, p.whatsapp,
              coalesce((
                SELECT json_agg(json_build_object(
                         'address', pl.address,
                         'lat', ST_Y(pl.location::geometry),
                         'lng', ST_X(pl.location::geometry)) ORDER BY pl.created_at)
                FROM provider_locations pl WHERE pl.provider_id = p.id), '[]') AS locations
       FROM listings l
       JOIN providers p  ON p.id = l.provider_id
       JOIN categories c ON c.id = l.category_id
       CROSS JOIN o
       ${coverageJoin('$4')}
       ${distanceJoin}
       WHERE l.id = $1 AND ${publicVisibility}`,
      [id, q.lat ?? null, q.lng ?? null, q.communityId ?? null],
    );
    const r = rows[0];
    if (!r) throw new NotFoundException('Oferta não encontrada');
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      mode: r.mode,
      eligibility: hasOrigin ? r.eligibility : null,
      distanceM: hasOrigin && r.distance_m !== null ? Math.round(Number(r.distance_m)) : null,
      category: { id: r.category_id, slug: r.category_slug, name: r.category_name },
      provider: {
        id: r.provider_id,
        kind: r.provider_kind,
        displayName: r.provider_name,
        description: r.provider_description,
        phone: r.phone,
        whatsapp: r.whatsapp,
        locations: r.locations.map((x) => ({ address: x.address, location: { lat: x.lat, lng: x.lng } })),
      },
    };
  }

  /** Registra um clique em contato. Não grava IP nem dados pessoais (LGPD). */
  async recordContact(listingId: string, dto: ContactEventDto, userId: string | null = null): Promise<void> {
    const { rowCount } = await this.pool.query(
      `INSERT INTO contact_events (listing_id, user_id, community_id, channel)
       SELECT l.id, $2, (SELECT id FROM communities WHERE id = $3::uuid), $4
       FROM listings l JOIN providers p ON p.id = l.provider_id
       WHERE l.id = $1 AND ${publicVisibility}`,
      [listingId, userId, dto.communityId ?? null, dto.channel],
    );
    if (!rowCount) throw new NotFoundException('Oferta não encontrada');
  }
}
