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
pnpm db:seed:demo               # (opcional) condomínio e fornecedores fictícios para demonstração
pnpm dev:api                    # http://localhost:3000/v1/health  ·  docs em /docs
pnpm dev:web                    # http://localhost:3001
```

Subir API + banco juntos em contêiner: `docker compose --profile full up --build`.

Teste rápido da busca com os dados de demo:

```bash
curl "localhost:3000/v1/search?lat=-23.5893&lng=-46.6346"            # quem atende o condomínio demo
curl "localhost:3000/v1/search?lat=-23.5893&lng=-46.6346&q=eletrica"   # texto sem acento
```

Sem `GOOGLE_MAPS_API_KEY`, o `/v1/geocode` usa o OpenStreetMap (Nominatim), só para
desenvolvimento. Defina `DEMO_PHONE=55119...` antes do seed para os botões de contato
abrirem o seu número.

## Produção

Stack em Docker para VPS (Caddy com HTTPS automático, migrações antes da subida, banco sem
porta exposta, backup diário): veja **[docs/deploy.md](docs/deploy.md)**. A API recusa subir em
produção com configuração insegura (senha padrão, CORS aberto, geocodificação sem contato).

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm typecheck` | Checagem de tipos em todos os pacotes |
| `pnpm test` | Testes unitários |
| `pnpm test:e2e` | Testes da API contra o PostGIS real (precisa de `pnpm db:up`) |
| `pnpm db:seed:demo` | Recria os dados de demonstração (recusa com `NODE_ENV=production`) |
| `pnpm openapi` | Regenera `docs/openapi.json` (a CI falha se estiver desatualizado) |
| `pnpm build` | Build de produção da API e do painel |

## Migrações

Arquivos `NNNN_descricao.sql` em `services/api/migrations`. Cada um roda uma vez, em transação,
e fica registrado em `schema_migrations`. Nunca edite uma migração já aplicada: crie outra.

## API do MVP

| Rota | O que faz |
|---|---|
| `GET /v1/search?lat&lng&q&category&mode&communityId&includeNotServed&page&pageSize` | Busca com elegibilidade por cobertura |
| `GET /v1/listings/:id?lat&lng` | Detalhe e contatos do fornecedor |
| `POST /v1/listings/:id/contact-events` | Registra clique em WhatsApp/Ligar/Como chegar |
| `GET /v1/categories` | Árvore de categorias |
| `GET /v1/geocode?q=` | Endereço ou CEP → coordenadas |

**Elegibilidade** (só para `DELIVERY` e `AT_HOME`): `CONFIRMED` quando uma área de cobertura
verificada contém o endereço, `UNCONFIRMED` quando foi declarada sem verificação (ou não há área),
`NOT_SERVED` quando nenhuma área declarada contém o endereço (oculto por padrão).
`IN_STORE` e `REMOTE` vêm com `null`. A lógica fica em `services/api/src/search/coverage.sql.ts`.

> A API roda com `@swc-node/register` em desenvolvimento. Não troque por `tsx`/esbuild: eles não
> emitem metadados de decorators, o que desliga a validação de DTOs e quebra o OpenAPI.

## Convenções

- Branches `feat/…`, `fix/…`, `chore/…`; PR para `main` com CI verde.
- Commits no formato `tipo: descrição` (ex.: `feat: busca por cobertura`).
- Segredos só em variáveis de ambiente. Nada de dados pessoais em logs ou em `audit_logs.metadata`.

## Roadmap técnico

Veja [docs/roadmap.md](docs/roadmap.md).
