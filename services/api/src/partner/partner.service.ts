import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CoverageType, GeoJsonArea, ModerationStatus, ProviderKind, ServiceMode } from '@lume/types';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import { pgErrorCode, withTransaction } from '../database/transaction';
import {
  LIMITS,
  type CoverageAreaDto,
  type CreateCoverageDto,
  type CreateListingDto,
  type CreateLocationDto,
  type CreateProviderDto,
  type PartnerListingDto,
  type PartnerProviderDto,
  type UpdateListingDto,
  type UpdateProviderDto,
} from './partner.dto';

type Db = Pool | PoolClient;

interface ProviderRow {
  id: string;
  kind: ProviderKind;
  display_name: string;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: ModerationStatus;
  moderation_note: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ListingRow {
  id: string;
  provider_id: string;
  title: string;
  description: string | null;
  mode: ServiceMode;
  status: ModerationStatus;
  moderation_note: string | null;
  updated_at: Date;
  category_id: string;
  category_slug: string;
  category_name: string;
}

interface CoverageRow {
  id: string;
  listing_id: string;
  type: CoverageType;
  radius_m: number | null;
  lat: number | null;
  lng: number | null;
  polygon: GeoJsonArea | null;
  community_id: string | null;
  verified: boolean;
}

/**
 * Edição de conteúdo já moderado volta para a fila: o que o público vê sempre passou pela
 * equipe. Suspensos não podem editar (precisam falar com o suporte).
 */
const RESUBMIT_STATUS = `CASE WHEN status IN ('APPROVED', 'REJECTED') THEN 'PENDING'::moderation_status ELSE status END`;
const RESUBMIT_NOTE = `CASE WHEN status IN ('APPROVED', 'REJECTED') THEN NULL ELSE moderation_note END`;

const SUSPENDED_MESSAGE = 'Cadastro suspenso pela moderação. Fale com o suporte.';

@Injectable()
export class PartnerService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ---------- Fornecedores ----------

  async listProviders(userId: string): Promise<PartnerProviderDto[]> {
    return this.load(this.pool, userId);
  }

  async getProvider(userId: string, providerId: string): Promise<PartnerProviderDto> {
    const [provider] = await this.load(this.pool, userId, providerId);
    if (!provider) throw new NotFoundException('Fornecedor não encontrado');
    return provider;
  }

  async createProvider(userId: string, dto: CreateProviderDto): Promise<PartnerProviderDto> {
    return withTransaction(this.pool, async (db) => {
      // Serializa criações do mesmo usuário para o limite valer mesmo com requisições simultâneas.
      await db.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const { rows: count } = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM providers WHERE owner_user_id = $1 AND deleted_at IS NULL',
        [userId],
      );
      if (count[0].n >= LIMITS.providersPerUser) {
        throw new BadRequestException(`Limite de ${LIMITS.providersPerUser} fornecedores por conta`);
      }
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO providers (owner_user_id, kind, display_name, description, phone, whatsapp, source)
         VALUES ($1, $2, $3, $4, $5, $6, 'PARTNER') RETURNING id`,
        [userId, dto.kind, dto.displayName, dto.description ?? null, dto.phone ?? null, dto.whatsapp ?? null],
      );
      // Quem cadastra o primeiro fornecedor vira parceiro (admin continua admin).
      await db.query(`UPDATE users SET role = 'PARTNER' WHERE id = $1 AND role = 'USER'`, [userId]);
      const [provider] = await this.load(db, userId, rows[0].id);
      return provider;
    });
  }

  async updateProvider(userId: string, providerId: string, dto: UpdateProviderDto): Promise<PartnerProviderDto> {
    return withTransaction(this.pool, async (db) => {
      await this.lockOwnedProvider(db, userId, providerId);
      const set = (v: unknown) => v !== undefined;
      await db.query(
        `UPDATE providers SET
           kind         = coalesce($2, kind),
           display_name = coalesce($3, display_name),
           description  = CASE WHEN $4::boolean THEN $5 ELSE description END,
           phone        = CASE WHEN $6::boolean THEN $7 ELSE phone END,
           whatsapp     = CASE WHEN $8::boolean THEN $9 ELSE whatsapp END,
           status          = ${RESUBMIT_STATUS},
           moderation_note = ${RESUBMIT_NOTE}
         WHERE id = $1`,
        [
          providerId,
          dto.kind ?? null,
          dto.displayName ?? null,
          set(dto.description), dto.description ?? null,
          set(dto.phone), dto.phone ?? null,
          set(dto.whatsapp), dto.whatsapp ?? null,
        ],
      );
      const [provider] = await this.load(db, userId, providerId);
      return provider;
    });
  }

  /** Exclusão lógica do fornecedor e das ofertas; some da busca na hora. */
  async deleteProvider(userId: string, providerId: string): Promise<void> {
    await withTransaction(this.pool, async (db) => {
      await this.lockOwnedProvider(db, userId, providerId, { allowSuspended: true });
      await db.query('UPDATE listings SET deleted_at = now() WHERE provider_id = $1 AND deleted_at IS NULL', [providerId]);
      await db.query('UPDATE providers SET deleted_at = now() WHERE id = $1', [providerId]);
    });
  }

  // ---------- Endereços do fornecedor ----------

  async addLocation(userId: string, providerId: string, dto: CreateLocationDto): Promise<PartnerProviderDto> {
    return withTransaction(this.pool, async (db) => {
      await this.lockOwnedProvider(db, userId, providerId);
      const { rows } = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM provider_locations WHERE provider_id = $1',
        [providerId],
      );
      if (rows[0].n >= LIMITS.locationsPerProvider) {
        throw new BadRequestException(`Limite de ${LIMITS.locationsPerProvider} endereços por fornecedor`);
      }
      await db.query(
        `INSERT INTO provider_locations (provider_id, address, location)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`,
        [providerId, dto.address, dto.lng, dto.lat],
      );
      const [provider] = await this.load(db, userId, providerId);
      return provider;
    });
  }

  async deleteLocation(userId: string, locationId: string): Promise<void> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM provider_locations pl USING providers p
        WHERE pl.id = $1 AND p.id = pl.provider_id AND p.owner_user_id = $2 AND p.deleted_at IS NULL`,
      [locationId, userId],
    );
    if (!rowCount) throw new NotFoundException('Endereço não encontrado');
  }

  // ---------- Ofertas ----------

  async createListing(userId: string, providerId: string, dto: CreateListingDto): Promise<PartnerListingDto> {
    return withTransaction(this.pool, async (db) => {
      await this.lockOwnedProvider(db, userId, providerId);
      const { rows: count } = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM listings WHERE provider_id = $1 AND deleted_at IS NULL',
        [providerId],
      );
      if (count[0].n >= LIMITS.listingsPerProvider) {
        throw new BadRequestException(`Limite de ${LIMITS.listingsPerProvider} ofertas por fornecedor`);
      }
      await this.assertCategory(db, dto.categoryId);
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO listings (provider_id, category_id, title, description, mode)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [providerId, dto.categoryId, dto.title, dto.description ?? null, dto.mode],
      );
      return this.loadListing(db, userId, rows[0].id);
    });
  }

  async getListing(userId: string, listingId: string): Promise<PartnerListingDto> {
    return this.loadListing(this.pool, userId, listingId);
  }

  async updateListing(userId: string, listingId: string, dto: UpdateListingDto): Promise<PartnerListingDto> {
    return withTransaction(this.pool, async (db) => {
      await this.lockOwnedListing(db, userId, listingId);
      if (dto.categoryId) await this.assertCategory(db, dto.categoryId);
      await db.query(
        `UPDATE listings SET
           category_id = coalesce($2, category_id),
           title       = coalesce($3, title),
           description = CASE WHEN $4::boolean THEN $5 ELSE description END,
           mode        = coalesce($6, mode),
           status          = ${RESUBMIT_STATUS},
           moderation_note = ${RESUBMIT_NOTE}
         WHERE id = $1`,
        [
          listingId,
          dto.categoryId ?? null,
          dto.title ?? null,
          dto.description !== undefined, dto.description ?? null,
          dto.mode ?? null,
        ],
      );
      return this.loadListing(db, userId, listingId);
    });
  }

  async deleteListing(userId: string, listingId: string): Promise<void> {
    await withTransaction(this.pool, async (db) => {
      await this.lockOwnedListing(db, userId, listingId, { allowSuspended: true });
      await db.query('UPDATE listings SET deleted_at = now() WHERE id = $1', [listingId]);
    });
  }

  // ---------- Cobertura ----------

  /** Toda área declarada pelo parceiro nasce não verificada ("UNCONFIRMED" na busca). */
  async addCoverage(userId: string, listingId: string, dto: CreateCoverageDto): Promise<PartnerListingDto> {
    return withTransaction(this.pool, async (db) => {
      await this.lockOwnedListing(db, userId, listingId);
      const { rows: count } = await db.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM coverage_areas WHERE listing_id = $1',
        [listingId],
      );
      if (count[0].n >= LIMITS.coveragePerListing) {
        throw new BadRequestException(`Limite de ${LIMITS.coveragePerListing} áreas por oferta`);
      }

      if (dto.type === 'RADIUS') {
        await db.query(
          `INSERT INTO coverage_areas (listing_id, type, radius_m, center)
           VALUES ($1, 'RADIUS', $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)`,
          [listingId, dto.radiusM, dto.centerLng, dto.centerLat],
        );
      } else if (dto.type === 'POLYGON') {
        const geojson = this.checkGeoJson(dto.polygon);
        await this.assertPolygon(db, geojson);
        await db.query(
          `INSERT INTO coverage_areas (listing_id, type, polygon)
           VALUES ($1, 'POLYGON', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)))`,
          [listingId, geojson],
        );
      } else {
        const { rows } = await db.query(
          `SELECT 1 FROM communities WHERE id = $1 AND status = 'ACTIVE'`,
          [dto.communityId],
        );
        if (!rows[0]) throw new BadRequestException('Comunidade não encontrada');
        await db.query(
          `INSERT INTO coverage_areas (listing_id, type, community_id) VALUES ($1, 'COMMUNITY', $2)`,
          [listingId, dto.communityId],
        );
      }
      return this.loadListing(db, userId, listingId);
    });
  }

  async deleteCoverage(userId: string, coverageId: string): Promise<void> {
    const { rowCount } = await this.pool.query(
      `DELETE FROM coverage_areas ca USING listings l, providers p
        WHERE ca.id = $1 AND l.id = ca.listing_id AND p.id = l.provider_id
          AND p.owner_user_id = $2 AND l.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [coverageId, userId],
    );
    if (!rowCount) throw new NotFoundException('Área não encontrada');
  }

  // ---------- Auxiliares ----------

  /**
   * Garante que o fornecedor existe e é do usuário, e trava a linha até o fim da transação.
   * De outra pessoa ou inexistente dá o mesmo 404: não revela o que existe.
   */
  private async lockOwnedProvider(
    db: PoolClient,
    userId: string,
    providerId: string,
    opts: { allowSuspended?: boolean } = {},
  ): Promise<void> {
    const { rows } = await db.query<{ status: ModerationStatus }>(
      `SELECT status FROM providers WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [providerId, userId],
    );
    if (!rows[0]) throw new NotFoundException('Fornecedor não encontrado');
    if (rows[0].status === 'SUSPENDED' && !opts.allowSuspended) throw new ForbiddenException(SUSPENDED_MESSAGE);
  }

  private async lockOwnedListing(
    db: PoolClient,
    userId: string,
    listingId: string,
    opts: { allowSuspended?: boolean } = {},
  ): Promise<void> {
    const { rows } = await db.query<{ status: ModerationStatus; provider_status: ModerationStatus }>(
      `SELECT l.status, p.status AS provider_status
         FROM listings l JOIN providers p ON p.id = l.provider_id
        WHERE l.id = $1 AND p.owner_user_id = $2 AND l.deleted_at IS NULL AND p.deleted_at IS NULL
        FOR UPDATE OF l`,
      [listingId, userId],
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Oferta não encontrada');
    if ((row.status === 'SUSPENDED' || row.provider_status === 'SUSPENDED') && !opts.allowSuspended) {
      throw new ForbiddenException(SUSPENDED_MESSAGE);
    }
  }

  private async assertCategory(db: Db, categoryId: string): Promise<void> {
    const { rows } = await db.query('SELECT 1 FROM categories WHERE id = $1', [categoryId]);
    if (!rows[0]) throw new BadRequestException('Categoria não encontrada');
  }

  private checkGeoJson(polygon: GeoJsonArea | undefined): string {
    if (
      !polygon ||
      (polygon.type !== 'Polygon' && polygon.type !== 'MultiPolygon') ||
      !Array.isArray(polygon.coordinates)
    ) {
      throw new BadRequestException('polygon precisa ser GeoJSON do tipo Polygon ou MultiPolygon');
    }
    return JSON.stringify({ type: polygon.type, coordinates: polygon.coordinates });
  }

  private async assertPolygon(db: PoolClient, geojson: string): Promise<void> {
    let check: { valid: boolean; points: number; km2: number } | undefined;
    try {
      await db.query('SAVEPOINT polygon_check');
      const { rows } = await db.query<{ valid: boolean; points: number; km2: number }>(
        `WITH g AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS geom)
         SELECT ST_IsValid(geom) AS valid, ST_NPoints(geom) AS points,
                ST_Area(geom::geography) / 1e6 AS km2
           FROM g`,
        [geojson],
      );
      check = rows[0];
      await db.query('RELEASE SAVEPOINT polygon_check');
    } catch (err) {
      await db.query('ROLLBACK TO SAVEPOINT polygon_check');
      if (pgErrorCode(err)?.startsWith('XX') || pgErrorCode(err)?.startsWith('22')) {
        throw new BadRequestException('Polígono inválido: confira as coordenadas [lng, lat]');
      }
      throw err;
    }
    if (!check?.valid) throw new BadRequestException('Polígono inválido (bordas se cruzam ou não fecha)');
    if (check.points > LIMITS.maxPolygonPoints) {
      throw new BadRequestException(`Polígono com mais de ${LIMITS.maxPolygonPoints} pontos`);
    }
    if (check.km2 > LIMITS.maxPolygonKm2) {
      throw new BadRequestException(`Área maior que ${LIMITS.maxPolygonKm2} km²`);
    }
    if (check.km2 <= 0) throw new BadRequestException('Polígono sem área');
  }

  private async loadListing(db: Db, userId: string, listingId: string): Promise<PartnerListingDto> {
    const { rows } = await db.query<{ provider_id: string }>(
      `SELECT l.provider_id FROM listings l JOIN providers p ON p.id = l.provider_id
        WHERE l.id = $1 AND p.owner_user_id = $2 AND l.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [listingId, userId],
    );
    if (!rows[0]) throw new NotFoundException('Oferta não encontrada');
    const [provider] = await this.load(db, userId, rows[0].provider_id);
    const listing = provider?.listings.find((l) => l.id === listingId);
    if (!listing) throw new NotFoundException('Oferta não encontrada');
    return listing;
  }

  /** Visão completa de um fornecedor para a moderação (sem filtro de dono). */
  async getProviderForAdmin(providerId: string): Promise<PartnerProviderDto> {
    const [provider] = await this.load(this.pool, null, providerId);
    if (!provider) throw new NotFoundException('Fornecedor não encontrado');
    return provider;
  }

  /**
   * Monta fornecedores com endereços, ofertas e cobertura (4 consultas, sem N+1).
   * `userId` nulo só é usado pela moderação, sempre com `providerId`.
   */
  private async load(db: Db, userId: string | null, providerId?: string): Promise<PartnerProviderDto[]> {
    if (userId === null && !providerId) throw new Error('load sem dono exige providerId');
    const { rows: providers } = await db.query<ProviderRow>(
      `SELECT id, kind, display_name, description, phone, whatsapp, status, moderation_note, created_at, updated_at
         FROM providers
        WHERE ($1::uuid IS NULL OR owner_user_id = $1) AND deleted_at IS NULL AND ($2::uuid IS NULL OR id = $2)
        ORDER BY created_at`,
      [userId, providerId ?? null],
    );
    if (providers.length === 0) return [];
    const ids = providers.map((p) => p.id);

    const [locations, listings] = await Promise.all([
      db.query<{ id: string; provider_id: string; address: string; lat: number; lng: number }>(
        `SELECT id, provider_id, address, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
           FROM provider_locations WHERE provider_id = ANY($1) ORDER BY created_at`,
        [ids],
      ),
      db.query<ListingRow>(
        `SELECT l.id, l.provider_id, l.title, l.description, l.mode, l.status, l.moderation_note, l.updated_at,
                c.id AS category_id, c.slug AS category_slug, c.name AS category_name
           FROM listings l JOIN categories c ON c.id = l.category_id
          WHERE l.provider_id = ANY($1) AND l.deleted_at IS NULL
          ORDER BY l.created_at`,
        [ids],
      ),
    ]);
    const listingIds = listings.rows.map((l) => l.id);
    const coverage = listingIds.length
      ? await db.query<CoverageRow>(
          `SELECT id, listing_id, type, radius_m,
                  ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng,
                  ST_AsGeoJSON(polygon, 6)::json AS polygon,
                  community_id, verified_at IS NOT NULL AS verified
             FROM coverage_areas WHERE listing_id = ANY($1) ORDER BY created_at`,
          [listingIds],
        )
      : { rows: [] as CoverageRow[] };

    const coverageOf = (listingId: string): CoverageAreaDto[] =>
      coverage.rows
        .filter((c) => c.listing_id === listingId)
        .map((c) => ({
          id: c.id,
          type: c.type,
          radiusM: c.radius_m,
          center: c.lat !== null && c.lng !== null ? { lat: c.lat, lng: c.lng } : null,
          polygon: c.polygon,
          communityId: c.community_id,
          verified: c.verified,
        }));

    return providers.map((p) => ({
      id: p.id,
      kind: p.kind,
      displayName: p.display_name,
      description: p.description,
      phone: p.phone,
      whatsapp: p.whatsapp,
      status: p.status,
      moderationNote: p.moderation_note,
      locations: locations.rows
        .filter((l) => l.provider_id === p.id)
        .map((l) => ({ id: l.id, address: l.address, location: { lat: l.lat, lng: l.lng } })),
      listings: listings.rows
        .filter((l) => l.provider_id === p.id)
        .map((l) => ({
          id: l.id,
          providerId: l.provider_id,
          title: l.title,
          description: l.description,
          mode: l.mode,
          status: l.status,
          moderationNote: l.moderation_note,
          category: { id: l.category_id, slug: l.category_slug, name: l.category_name },
          coverage: coverageOf(l.id),
          updatedAt: l.updated_at.toISOString(),
        })),
      createdAt: p.created_at.toISOString(),
      updatedAt: p.updated_at.toISOString(),
    }));
  }
}
