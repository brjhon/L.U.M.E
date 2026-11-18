-- Suporte à busca (Sprint 3): texto sem acento e ranking por semelhança.

CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- word_similarity() para ordenar por relevância

-- unaccent() não é IMMUTABLE; este wrapper fixa o dicionário e permite uso em índices no futuro.
CREATE FUNCTION lume_normalize(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

-- A busca sempre filtra ofertas aprovadas e não excluídas.
CREATE INDEX listings_status_mode_idx ON listings (status, mode) WHERE deleted_at IS NULL;
