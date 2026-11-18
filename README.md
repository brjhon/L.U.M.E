# L.U.M.E.

**Localizador Unificado de Mercados e Especialistas**: marketplace hiperlocal de comércios e
serviços, com alcance por bairros e condomínios.
*O que você precisa. Onde você está.*

## Estrutura

```
apps/mobile      App Flutter do usuário (consome docs/openapi.json)
apps/web         Painel Next.js único: administração + área do parceiro, por papel
services/api     API NestJS (REST versionada em /v1) + migrações SQL
packages/types   Tipos TypeScript compartilhados (papéis, enums, formatos de resposta)
docs/            Contrato OpenAPI e decisões de arquitetura
```

## Começando

Requisitos: Node 22, pnpm 10 (`corepack enable`), Docker. Flutter 3.47+ para o app.

```bash
cp .env.example .env
pnpm install
pnpm db:up                      # PostgreSQL 16 + PostGIS 3.4 em localhost:5432
export DATABASE_URL=postgres://lume:lume@localhost:5432/lume
pnpm db:migrate                 # aplica services/api/migrations/*.sql
pnpm dev:api                    # http://localhost:3000/v1/health  ·  docs em /docs
pnpm dev:web                    # http://localhost:3001
```

Subir API + banco juntos em contêiner: `docker compose --profile full up --build`.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm typecheck` | Checagem de tipos em todos os pacotes |
| `pnpm test` | Testes unitários |
| `pnpm test:e2e` | Testes da API contra o PostGIS real (precisa de `pnpm db:up`) |
| `pnpm openapi` | Regenera `docs/openapi.json` (a CI falha se estiver desatualizado) |
| `pnpm build` | Build de produção da API e do painel |

## Migrações

Arquivos `NNNN_descricao.sql` em `services/api/migrations`. Cada um roda uma vez, em transação,
e fica registrado em `schema_migrations`. Nunca edite uma migração já aplicada: crie outra.

## Convenções

- Branches `feat/…`, `fix/…`, `chore/…`; PR para `main` com CI verde.
- Commits no formato `tipo: descrição` (ex.: `feat: busca por cobertura`).
- Segredos só em variáveis de ambiente. Nada de dados pessoais em logs ou em `audit_logs.metadata`.

## Roadmap técnico

Veja [docs/roadmap.md](docs/roadmap.md).
