# syntax=docker/dockerfile:1.7

# =========================
# Stage 1 — Build
# =========================
FROM node:22-alpine AS builder

WORKDIR /app

# Instala dependências
COPY package.json package-lock.json* bun.lockb* ./
RUN npm install --no-audit --no-fund

# Copia o restante do código
COPY . .

# Variáveis públicas do Vite (passadas como build args no EasyPanel)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

# Build de produção (gera dist/client + dist/server com SSR Node)
RUN npm run build

# Remove devDependencies para reduzir o tamanho da imagem final
RUN npm prune --omit=dev

# =========================
# Stage 2 — Runtime (Node SSR)
# =========================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

# Copia apenas o necessário pra rodar
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.mjs ./server.mjs

# Healthcheck simples
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ >/dev/null 2>&1 || exit 1

EXPOSE 80
CMD ["node", "server.mjs"]
