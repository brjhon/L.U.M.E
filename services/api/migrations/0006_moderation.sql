-- Moderação (Sprint 2): motivo da decisão visível ao parceiro e fila ordenada por envio.
ALTER TABLE providers ADD COLUMN moderation_note text;
ALTER TABLE listings  ADD COLUMN moderation_note text;

-- Fila de moderação: pendentes mais antigos primeiro.
CREATE INDEX providers_pending_idx ON providers (updated_at) WHERE status = 'PENDING' AND deleted_at IS NULL;
CREATE INDEX listings_pending_idx  ON listings  (updated_at) WHERE status = 'PENDING' AND deleted_at IS NULL;
