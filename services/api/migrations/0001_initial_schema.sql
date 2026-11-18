-- L.U.M.E. — modelo relacional inicial (PDF, pág. 13)
-- IDs UUID, timestamps UTC (timestamptz), enums controlados, soft delete onde faz sentido.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- e-mail sem diferenciar maiúsculas
CREATE EXTENSION IF NOT EXISTS unaccent;   -- busca textual sem acento (Sprint 3)

-- ---------- Enums ----------
CREATE TYPE user_status        AS ENUM ('ACTIVE', 'BLOCKED', 'DELETED');
CREATE TYPE platform_role      AS ENUM ('USER', 'PARTNER', 'PLATFORM_ADMIN');
CREATE TYPE community_status   AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE membership_role    AS ENUM ('MEMBER', 'COMMUNITY_ADMIN');
CREATE TYPE membership_status  AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');
CREATE TYPE provider_kind      AS ENUM ('BUSINESS', 'PROFESSIONAL');
CREATE TYPE moderation_status  AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE provider_source    AS ENUM ('PARTNER', 'ADMIN', 'GOOGLE_PLACES');
CREATE TYPE service_mode       AS ENUM ('DELIVERY', 'IN_STORE', 'AT_HOME', 'REMOTE');
CREATE TYPE coverage_type      AS ENUM ('RADIUS', 'POLYGON', 'COMMUNITY');
CREATE TYPE link_status        AS ENUM ('PENDING', 'ACTIVE', 'REMOVED');
CREATE TYPE request_status     AS ENUM ('OPEN', 'VIEWED', 'ANSWERED', 'CLOSED', 'CANCELLED');

-- Atualiza updated_at automaticamente.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ---------- Identidade e região ----------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE,
  phone         text UNIQUE,
  name          text NOT NULL,
  password_hash text,
  role          platform_role NOT NULL DEFAULT 'USER',
  status        user_status   NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  CONSTRAINT users_contact_chk CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE TABLE addresses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,  -- nulo = endereço de comunidade
  label             text,
  formatted_address text NOT NULL,
  postal_code       text,
  location          geography(Point, 4326) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_idx     ON addresses (user_id);
CREATE INDEX addresses_location_gix ON addresses USING GIST (location);

CREATE TABLE communities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  address_id uuid NOT NULL REFERENCES addresses(id),
  status     community_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         membership_role   NOT NULL DEFAULT 'MEMBER',
  status       membership_status NOT NULL DEFAULT 'PENDING',
  verified_at  timestamptz,
  verified_by  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_unique UNIQUE (community_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships (user_id);

-- ---------- Catálogo e fornecedores ----------
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid REFERENCES categories(id),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  icon       text,
  sensitive  boolean NOT NULL DEFAULT false,  -- ex.: cuidadores: exige controles reforçados
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX categories_parent_idx ON categories (parent_id);

CREATE TABLE providers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES users(id),
  kind          provider_kind     NOT NULL,
  display_name  text NOT NULL,
  description   text,
  phone         text,
  whatsapp      text,
  status        moderation_status NOT NULL DEFAULT 'PENDING',
  source        provider_source   NOT NULL DEFAULT 'PARTNER',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX providers_owner_idx  ON providers (owner_user_id);
CREATE INDEX providers_status_idx ON providers (status) WHERE deleted_at IS NULL;

-- Metadados externos (Google Places) ficam separados dos dados próprios (PDF, pág. 12).
CREATE TABLE provider_external_refs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  source       provider_source NOT NULL,
  external_id  text NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_external_refs_unique UNIQUE (source, external_id)
);

CREATE TABLE provider_locations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  address     text NOT NULL,
  location    geography(Point, 4326) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_locations_provider_idx ON provider_locations (provider_id);
CREATE INDEX provider_locations_location_gix ON provider_locations USING GIST (location);

CREATE TABLE listings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id),
  title       text NOT NULL,
  description text,
  mode        service_mode      NOT NULL,
  status      moderation_status NOT NULL DEFAULT 'PENDING',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX listings_provider_idx ON listings (provider_id);
CREATE INDEX listings_category_idx ON listings (category_id) WHERE deleted_at IS NULL;

-- ---------- Cobertura e confiança ----------
CREATE TABLE coverage_areas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  type         coverage_type NOT NULL,
  radius_m     integer CHECK (radius_m IS NULL OR radius_m > 0),
  center       geography(Point, 4326),
  polygon      geometry(MultiPolygon, 4326),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  verified_at  timestamptz,
  verified_by  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coverage_shape_chk CHECK (
       (type = 'RADIUS'    AND radius_m IS NOT NULL AND center IS NOT NULL)
    OR (type = 'POLYGON'   AND polygon  IS NOT NULL)
    OR (type = 'COMMUNITY' AND community_id IS NOT NULL)
  )
);
CREATE INDEX coverage_areas_listing_idx ON coverage_areas (listing_id);
CREATE INDEX coverage_areas_center_gix  ON coverage_areas USING GIST (center);
CREATE INDEX coverage_areas_polygon_gix ON coverage_areas USING GIST (polygon);

CREATE TABLE community_provider_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  provider_id  uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  status       link_status NOT NULL DEFAULT 'PENDING',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_provider_links_unique UNIQUE (community_id, provider_id)
);

-- ---------- Solicitações ----------
CREATE TABLE service_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES users(id),
  listing_id        uuid NOT NULL REFERENCES listings(id),
  community_id      uuid REFERENCES communities(id),
  address_id        uuid REFERENCES addresses(id),
  description       text NOT NULL,
  status            request_status NOT NULL DEFAULT 'OPEN',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_requests_requester_idx ON service_requests (requester_user_id);
CREATE INDEX service_requests_listing_idx   ON service_requests (listing_id);

CREATE TABLE reviews (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id),
  listing_id        uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  request_id        uuid REFERENCES service_requests(id),  -- vínculo com interação verificável
  rating            smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text              text,
  moderation_status moderation_status NOT NULL DEFAULT 'PENDING',
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_one_per_request UNIQUE (user_id, request_id)
);
CREATE INDEX reviews_listing_idx ON reviews (listing_id);

CREATE TABLE favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_unique UNIQUE (user_id, listing_id)
);

-- Cliques em "Ligar" / "WhatsApp" / "Como chegar": principal métrica de conversão do MVP.
CREATE TABLE contact_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  community_id uuid REFERENCES communities(id),
  channel      text NOT NULL CHECK (channel IN ('PHONE', 'WHATSAPP', 'DIRECTIONS')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_events_listing_idx ON contact_events (listing_id, created_at);

-- ---------- Mídia e auditoria ----------
CREATE TABLE media_assets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  owner_id   uuid NOT NULL,
  object_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_assets_owner_idx ON media_assets (owner_type, owner_id);

CREATE TABLE audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  uuid,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,  -- nunca gravar dados pessoais aqui
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity, entity_id);
CREATE INDEX audit_logs_actor_idx  ON audit_logs (actor_id, created_at);

-- Triggers de updated_at
CREATE TRIGGER users_updated_at            BEFORE UPDATE ON users            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER addresses_updated_at        BEFORE UPDATE ON addresses        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER communities_updated_at      BEFORE UPDATE ON communities      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER memberships_updated_at      BEFORE UPDATE ON memberships      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER providers_updated_at        BEFORE UPDATE ON providers        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER listings_updated_at         BEFORE UPDATE ON listings         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER service_requests_updated_at BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
