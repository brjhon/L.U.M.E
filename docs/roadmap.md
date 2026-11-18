# Roadmap técnico do MVP

Baseado no documento "Projeto L.U.M.E." (novembro de 2026).

## Sprint 0: fundação ✅
Monorepo pnpm, Docker Compose com PostgreSQL/PostGIS, migrações SQL versionadas com o modelo
relacional completo, API NestJS com `/v1/health`, formato padrão de erro, validação global de DTOs,
OpenAPI em `/docs` e `docs/openapi.json`, painel Next.js, esqueleto Flutter, CI no GitHub Actions
e imagem Docker da API.

## Sprint 1: identidade e território
- `POST /v1/auth/register|login|refresh|logout` com JWT curto + refresh rotativo e revogável.
- `GET/PATCH /v1/me`, `GET/POST /v1/me/addresses`.
- Geocodificação só ao salvar endereço (Google Geocoding), com o ponto guardado no banco.
- Comunidades, pedidos de entrada e aprovação por COMMUNITY_ADMIN.
- RBAC: guard por papel global + escopo de comunidade.
- **Critério:** usuário escolhe endereço e tem vínculo aprovado sem ver dados de outra comunidade.

## Sprint 2: catálogo e cobertura
- CRUD de fornecedores, ofertas e áreas de cobertura (raio, polígono, comunidade) no painel do parceiro.
- Fila de moderação no painel admin; perfis começam como PENDING.
- **Critério:** parceiro cadastra oferta e define onde atende, com moderação.

## Sprint 3: busca e interface
- `GET /v1/search?lat&lng&q&category&mode&communityId&cursor`.
- Elegibilidade: CONFIRMED (cobertura verificada contém o ponto), UNCONFIRMED (declarada sem
  verificação), NOT_SERVED. Raio via `ST_DWithin`, polígono via `ST_Covers`.
- Telas Flutter: início, busca, resultados, detalhe, botões de contato.
- **Critério:** buscar por endereço retorna só ofertas elegíveis ou separa claramente as desconhecidas.

## Sprint 4: participação e piloto
- Favoritos, solicitações de serviço, avaliações ligadas a solicitação, recomendações da comunidade.
- Registro de cliques em contato (`contact_events`) e painel de indicadores.
- Testes de segurança e usabilidade.

## Decisões em aberto (para os sócios)
1. Quem aprova fornecedores no piloto: equipe LUME, síndico ou ambos?
2. Como o morador comprova vínculo com o condomínio (convite, código, comprovante)?
3. Região e condomínio do piloto.
4. Orçamento de infraestrutura (VPS vs. nuvem gerenciada) e conta do Google Maps Platform.
5. Busca de marca "LUME" no INPI (classes 35 e 42) antes de investir na identidade.

## Decisões de arquitetura tomadas no Sprint 0
- **Painel único** para admin e parceiro (o PDF previa dois): menos código para manter no MVP.
- **Migrações em SQL puro** em vez de ORM: PostGIS (geography, GIST, ST_*) fica explícito e testável.
- **`contact_events`** adicionada ao modelo: clique em WhatsApp/ligar é a principal conversão do MVP.
- **`provider_external_refs`** separa metadados do Google Places dos dados próprios do parceiro.
