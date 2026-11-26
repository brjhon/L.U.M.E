# Build a partir da raiz do monorepo: docker build -f services/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json packages/types/
COPY services/api/package.json services/api/
RUN pnpm install --frozen-lockfile --filter @lume/api...
COPY packages/types packages/types
COPY services/api services/api
RUN pnpm --filter @lume/types build && pnpm --filter @lume/api build \
 && pnpm --filter @lume/api deploy --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out ./
COPY services/api/migrations ./migrations
USER node
EXPOSE 3000
# Saudável = API respondendo e banco acessível (/v1/health devolve 503 se o banco cair).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrações: `node dist/database/migrate.js` (o compose de produção roda antes da API subir).
CMD ["node", "dist/main.js"]
