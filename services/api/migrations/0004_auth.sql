-- Autenticação (Sprint 1): refresh tokens opacos, rotativos e revogáveis.
-- Só o hash SHA-256 do token fica no banco; o valor em si existe apenas com o cliente.
-- Cada login abre uma "família"; reapresentar um token já trocado revoga a família inteira
-- (sinal de token roubado).

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id   uuid NOT NULL,
  token_hash  bytea NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_user_idx   ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);

-- Registro de quando a senha mudou: tokens de acesso emitidos antes disso deixam de valer.
ALTER TABLE users ADD COLUMN password_changed_at timestamptz;
