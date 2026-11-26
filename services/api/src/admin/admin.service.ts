import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ModerationDecision, ModerationStatus } from '@lume/types';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { withTransaction } from '../database/transaction';
import type { ModerationQueueDto, ModerationQueueQueryDto } from './admin.dto';

interface QueueRow {
  kind: 'PROVIDER' | 'LISTING';
  id: string;
  title: string;
  status: ModerationStatus;
  provider_id: string;
  provider_name: string;
  provider_status: ModerationStatus;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  updated_at: Date;
}

@Injectable()
export class AdminService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Fila de moderação: mais antigos primeiro, para ninguém ficar esquecido. */
  async queue(q: ModerationQueueQueryDto): Promise<ModerationQueueDto> {
    const offset = (q.page - 1) * q.pageSize;
    const { rows } = await this.pool.query<QueueRow>(
      `SELECT * FROM (
         SELECT 'PROVIDER' AS kind, p.id, p.display_name AS title, p.status,
                p.id AS provider_id, p.display_name AS provider_name, p.status AS provider_status,
                u.id AS owner_id, u.name AS owner_name, u.email::text AS owner_email, p.updated_at
           FROM providers p LEFT JOIN users u ON u.id = p.owner_user_id
          WHERE p.deleted_at IS NULL AND p.status = $1 AND ($2::text IS NULL OR $2 = 'PROVIDER')
         UNION ALL
         SELECT 'LISTING', l.id, l.title, l.status,
                p.id, p.display_name, p.status,
                u.id, u.name, u.email::text, l.updated_at
           FROM listings l JOIN providers p ON p.id = l.provider_id
           LEFT JOIN users u ON u.id = p.owner_user_id
          WHERE l.deleted_at IS NULL AND p.deleted_at IS NULL AND l.status = $1
            AND ($2::text IS NULL OR $2 = 'LISTING')
       ) q
       ORDER BY updated_at, id
       LIMIT $3 OFFSET $4`,
      [q.status, q.kind ?? null, q.pageSize + 1, offset],
    );
    return {
      items: rows.slice(0, q.pageSize).map((r) => ({
        kind: r.kind,
        id: r.id,
        title: r.title,
        status: r.status,
        provider: { id: r.provider_id, displayName: r.provider_name, status: r.provider_status },
        owner: r.owner_id ? { id: r.owner_id, name: r.owner_name ?? '', email: r.owner_email } : null,
        updatedAt: r.updated_at.toISOString(),
      })),
      page: q.page,
      pageSize: q.pageSize,
      hasMore: rows.length > q.pageSize,
    };
  }

  async decideProvider(adminId: string, id: string, decision: ModerationDecision, note?: string): Promise<void> {
    await this.decide(adminId, 'providers', 'provider', id, decision, note);
  }

  async decideListing(adminId: string, id: string, decision: ModerationDecision, note?: string): Promise<void> {
    await this.decide(adminId, 'listings', 'listing', id, decision, note);
  }

  /** Verificar uma área é o que transforma "UNCONFIRMED" em "CONFIRMED" na busca. */
  async verifyCoverage(adminId: string, coverageId: string, verified: boolean): Promise<void> {
    await withTransaction(this.pool, async (db) => {
      const { rowCount } = await db.query(
        `UPDATE coverage_areas ca
            SET verified_at = CASE WHEN $2 THEN now() END,
                verified_by = CASE WHEN $2 THEN $3::uuid END
           FROM listings l
          WHERE ca.id = $1 AND l.id = ca.listing_id AND l.deleted_at IS NULL`,
        [coverageId, verified, adminId],
      );
      if (!rowCount) throw new NotFoundException('Área não encontrada');
      await this.audit(db, adminId, verified ? 'coverage.verified' : 'coverage.unverified', 'coverage_area', coverageId, {});
    });
  }

  private async decide(
    adminId: string,
    table: 'providers' | 'listings',
    entity: 'provider' | 'listing',
    id: string,
    decision: ModerationDecision,
    note?: string,
  ): Promise<void> {
    await withTransaction(this.pool, async (db) => {
      const { rows } = await db.query<{ previous: ModerationStatus }>(
        `UPDATE ${table} t SET status = $2, moderation_note = $3
           FROM (SELECT status AS previous FROM ${table} WHERE id = $1 AND deleted_at IS NULL FOR UPDATE) old
          WHERE t.id = $1
          RETURNING old.previous`,
        [id, decision, note ?? null],
      );
      if (!rows[0]) throw new NotFoundException();
      await this.audit(db, adminId, `${entity}.${decision.toLowerCase()}`, entity, id, {
        from: rows[0].previous,
        to: decision,
      });
    });
  }

  private async audit(
    db: { query: Pool['query'] },
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    // Nunca dados pessoais em metadata (a nota de moderação pode citar a pessoa: não entra).
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [actorId, action, entity, entityId, JSON.stringify(metadata)],
    );
  }
}
