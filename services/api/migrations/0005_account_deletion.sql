-- Exclusão de conta (LGPD art. 18, VI; exigência da App Store para apps com cadastro).
-- A linha do usuário fica (outras tabelas apontam para ela), mas sem nenhum dado pessoal:
-- por isso uma conta excluída pode ficar sem e-mail e sem telefone.
ALTER TABLE users DROP CONSTRAINT users_contact_chk;
ALTER TABLE users ADD CONSTRAINT users_contact_chk
  CHECK (deleted_at IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL);
