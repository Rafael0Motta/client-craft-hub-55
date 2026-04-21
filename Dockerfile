# syntax=docker/dockerfile:1.7

# =========================================================
# Stage 1 — Builder
# =========================================================
FROM node:22.12-alpine AS builder

WORKDIR /app

# Toolchain para módulos nativos eventuais
RUN apk add --no-cache python3 make g++

# Instala deps com cache eficiente
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copia o restante do código
COPY . .

# Variáveis públicas do Vite (precisam estar disponíveis no build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN npm run build

# =========================================================
# Stage 2 — Runner (Nginx, leve e rápido)
# =========================================================
FROM nginx:1.27-alpine AS runner

# Config do Nginx com fallback SPA
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Saída do build do TanStack Start (Cloudflare): assets estáticos do client
COPY --from=builder /app/dist/client /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
