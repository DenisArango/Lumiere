# syntax=docker/dockerfile:1
#
# Imagen unica de Lumiere para produccion (Render): compila el frontend y el backend y el MISMO servidor Express
# entrega el sitio y la API (mismo origen: cookies, CSRF y websockets de butacas funcionan sin configuracion extra).
# Monorepo pnpm: se construye desde la RAIZ del repositorio.

FROM node:22-slim AS base
# openssl lo necesita Prisma; ca-certificates, las llamadas HTTPS a Stripe y PayPal.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /app

# ---- dependencias + compilacion
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN pnpm install --frozen-lockfile
COPY apps ./apps
RUN pnpm --filter @lumiere/backend prisma:generate \
 && pnpm --filter @lumiere/backend build \
 && pnpm --filter @lumiere/frontend build

# ---- runtime
FROM base AS runtime
# PORT: Render lo define solo (10000 por defecto); aqui se fija el mismo valor para que la imagen funcione tambien sola.
ENV NODE_ENV=production \
    PORT=10000 \
    FRONTEND_DIST=/app/apps/frontend/dist
COPY --from=build --chown=node:node /app /app
USER node
WORKDIR /app/apps/backend
EXPOSE 10000

# 1) migraciones  2) catalogos base + primer super admin (idempotente)  3) servidor.
# Render define PORT (por defecto 10000); la app lo lee de la variable.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node -r dotenv/config dist/bootstrap/run.js && node -r dotenv/config dist/server.js"]
