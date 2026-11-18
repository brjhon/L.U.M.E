/**
 * Regra central do L.U.M.E. (PDF, pág. 12): um fornecedor perto NÃO é automaticamente
 * "entrega aqui". A elegibilidade vem só da cobertura declarada:
 *
 *  - CONFIRMED:   uma área de cobertura VERIFICADA contém o endereço.
 *  - UNCONFIRMED: a área que contém o endereço foi declarada mas não verificada,
 *                 ou o fornecedor não declarou nenhuma área.
 *  - NOT_SERVED:  há áreas declaradas e nenhuma contém o endereço.
 *
 * Só se aplica a DELIVERY e AT_HOME (o fornecedor vai até o cliente).
 * IN_STORE e REMOTE recebem `null`: a interface mostra "ir até o local" / "remoto".
 *
 * Estes fragmentos esperam os aliases `l` (listings), `p` (providers) e `o` (origem, coluna `g`
 * do tipo geography, possivelmente nula) e o parâmetro de comunidade informado.
 */

/** Raio, em metros, em torno do endereço do condomínio para cobertura do tipo COMMUNITY. */
export const COMMUNITY_MATCH_RADIUS_M = 200;

export function coverageJoin(communityParam: string): string {
  return `
  LEFT JOIN LATERAL (
    SELECT count(*) > 0                                    AS has_any,
           coalesce(bool_or(x.hit AND x.verified), false)     AS verified_hit,
           coalesce(bool_or(x.hit AND NOT x.verified), false) AS unverified_hit
    FROM (
      SELECT ca.verified_at IS NOT NULL AS verified,
             coalesce(CASE ca.type
               WHEN 'RADIUS'  THEN ST_DWithin(ca.center, o.g, ca.radius_m)
               WHEN 'POLYGON' THEN ST_Covers(ca.polygon, o.g::geometry)
               WHEN 'COMMUNITY' THEN
                    ca.community_id = ${communityParam}::uuid
                 OR EXISTS (
                      SELECT 1 FROM communities cm JOIN addresses a ON a.id = cm.address_id
                      WHERE cm.id = ca.community_id AND cm.status = 'ACTIVE'
                        AND ST_DWithin(a.location, o.g, ${COMMUNITY_MATCH_RADIUS_M}))
             END, false) AS hit
      FROM coverage_areas ca
      WHERE ca.listing_id = l.id
    ) x
  ) cov ON true`;
}

export const distanceJoin = `
  LEFT JOIN LATERAL (
    SELECT min(ST_Distance(pl.location, o.g)) AS distance_m
    FROM provider_locations pl
    WHERE pl.provider_id = p.id
  ) d ON true`;

export const eligibilityExpr = `
  CASE WHEN o.g IS NULL OR l.mode NOT IN ('DELIVERY', 'AT_HOME') THEN NULL
       WHEN cov.verified_hit   THEN 'CONFIRMED'
       WHEN cov.unverified_hit THEN 'UNCONFIRMED'
       WHEN cov.has_any        THEN 'NOT_SERVED'
       ELSE 'UNCONFIRMED'
  END`;

/** Só ofertas e fornecedores aprovados e não excluídos aparecem ao público. */
export const publicVisibility = `
  l.status = 'APPROVED' AND l.deleted_at IS NULL
  AND p.status = 'APPROVED' AND p.deleted_at IS NULL`;
