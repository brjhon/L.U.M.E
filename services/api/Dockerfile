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
CMD ["node", "dist/main.js"]
