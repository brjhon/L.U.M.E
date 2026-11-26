# Roadmap técnico do MVP

Baseado no documento "Projeto L.U.M.E." (novembro de 2026).

## Sprint 0: fundação ✅
Monorepo pnpm, Docker Compose com PostgreSQL/PostGIS, migrações SQL versionadas com o modelo
relacional completo, API NestJS com `/v1/health`, formato padrão de erro, validação global de DTOs,
OpenAPI em `/docs` e `docs/openapi.json`, painel Next.js, esqueleto Flutter, CI no GitHub Actions
e imagem Docker da API.

## Sprint 1: identidade e território (autenticação ✅)
- ✅ `POST /v1/auth/register|login|refresh|logout`: JWT HS256 de 15 min + refresh token opaco
  (só o hash SHA-256 no banco), rotativo, com detecção de reuso que encerra a família inteira.
- ✅ `GET/PATCH /v1/me`, `POST /v1/me/password` (encerra as outras sessões).
- ✅ Senhas com Argon2id (parâmetros OWASP); login com tempo constante para não revelar e-mails.
- ✅ Guard global: toda rota exige login, exceto as marcadas `@Public()`; papel e status lidos do
  banco a cada requisição (bloqueio e troca de papel valem na hora). `@Roles(...)` por rota.
- ✅ Primeiro admin só pela linha de comando (`create-admin`), nunca por HTTP.
- `GET/POST /v1/me/addresses`.
- Geocodificação só ao salvar endereço (Google Geocoding), com o ponto guardado no banco.
- Comunidades, pedidos de entrada e aprovação por COMMUNITY_ADMIN.
- RBAC: guard por papel global + escopo de comunidade.
- **Critério:** usuário escolhe endereço e tem vínculo aprovado sem ver dados de outra comunidade.

## Sprint 2: catálogo e cobertura
- CRUD de fornecedores, ofertas e áreas de cobertura (raio, polígono, comunidade) no painel do parceiro.
- Fila de moderação no painel admin; perfis começam como PENDING.
- **Critério:** parceiro cadastra oferta e define onde atende, com moderação.

## Sprint 3: busca e interface ✅ (adiantado, antes dos Sprints 1 e 2)
Feito como fatia vertical para demonstrar o produto aos sócios com dados fictícios
(`pnpm db:seed:demo`). Paginação por `page`/`pageSize`.
- `GET /v1/search?lat&lng&q&category&mode&communityId&page`.
- Elegibilidade: CONFIRMED (cobertura verificada contém o ponto), UNCONFIRMED (declarada sem
  verificação), NOT_SERVED. Raio via `ST_DWithin`, polígono via `ST_Covers`.
- Telas Flutter: início, endereço (texto/CEP, sem GPS), resultados, detalhe, botões de contato.
- `GET /v1/geocode` (Google com chave; OpenStreetMap no desenvolvimento; CEP via ViaCEP).
- Registro de cliques em contato (`contact_events`), adiantado do Sprint 4.
- Pendente: filtro de comunidade só para membros aprovados (depende do RBAC do Sprint 1);
  mapa na tela de resultados.
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

## Próximo passo recomendado
Sprint 2 antes do 1: sem o painel do parceiro, os fornecedores só entram via seed/SQL.
Com o CRUD de fornecedor/oferta/cobertura e a fila de moderação, a equipe já consegue
cadastrar o piloto. Login e comunidades (Sprint 1) entram logo em seguida.

## Decisões de arquitetura tomadas no Sprint 3
- Fornecedor **sem área declarada** aparece como `UNCONFIRMED` só se tiver endereço a até
  `maxDistanceM` (padrão 15 km); caso contrário, não aparece.
- Cobertura `COMMUNITY` vale para quem informa o `communityId` ou busca a até 200 m do
  endereço do condomínio.
- Ranking: confirmadas → presenciais → não confirmadas → remotas → não atende; depois
  relevância do texto (`pg_trgm`) e distância.

## Decisões de arquitetura tomadas no Sprint 0
- **Painel único** para admin e parceiro (o PDF previa dois): menos código para manter no MVP.
- **Migrações em SQL puro** em vez de ORM: PostGIS (geography, GIST, ST_*) fica explícito e testável.
- **`contact_events`** adicionada ao modelo: clique em WhatsApp/ligar é a principal conversão do MVP.
- **`provider_external_refs`** separa metadados do Google Places dos dados próprios do parceiro.
