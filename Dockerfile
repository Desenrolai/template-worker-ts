# ─── builder ───────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

RUN npm run build

# ─── runtime ───────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Usuario nao-root ja existente na imagem oficial (uid 1000).
USER node

# Sem EXPOSE e sem HEALTHCHECK: o forge.yaml declara port/healthPath null.
# Nao ha HTTP — o worker conecta no Redis via REDIS_URL e a saude e observada
# pela profundidade da fila (KEDA), nao por probe HTTP.
CMD ["node", "dist/index.js"]
