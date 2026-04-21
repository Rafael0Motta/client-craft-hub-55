# syntax=docker/dockerfile:1.7

# =========================
# Stage 1 — Build
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências primeiro (melhor cache)
COPY package.json package-lock.json* bun.lockb* ./
RUN if [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

# Copia o restante do código
COPY . .

# Variáveis públicas do Vite (passadas como build args no EasyPanel)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

# Build de produção (gera dist/client com os assets estáticos)
RUN npm run build

# =========================
# Stage 2 — Runtime (Nginx)
# =========================
FROM nginx:1.27-alpine AS runner

# Remove config padrão e copia a nossa
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os assets estáticos do build
COPY --from=builder /app/dist/client /usr/share/nginx/html

# Healthcheck simples
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
