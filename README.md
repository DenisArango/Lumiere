# Lumière

Portal de gestión de cartelera de cine y venta de boletos en línea.

> Punto de entrada de la documentación: [PROJECT.md](PROJECT.md). Ahí está el núcleo del proyecto, las decisiones de arquitectura y el índice completo de `docs/`.

## Quick start (desarrollo local)

Requisitos: **Node 22+**, **pnpm** (`corepack enable && corepack prepare pnpm@latest --activate`), Docker Desktop.

```bash
# 1. Levantar Postgres + Redis
docker compose up -d

# 2. Instalar dependencias (raíz, workspaces)
pnpm install

# 3. Configurar variables de entorno del backend
cp apps/backend/.env.example apps/backend/.env
# editar apps/backend/.env si es necesario

# 4. Aplicar migraciones y datos de referencia
pnpm --filter @lumiere/backend prisma:migrate
pnpm --filter @lumiere/backend prisma:seed

# 5. Arrancar el backend en modo desarrollo
pnpm dev:backend
```

El backend queda disponible en `http://localhost:4000`, con verificación de salud en `GET /api/v1/health`. Postgres se expone en el puerto **5433** (no 5432) para evitar chocar con instalaciones nativas de Postgres en el host — ver [docs/backend/00-foundation.md](docs/backend/00-foundation.md).

## Estructura

```
apps/backend/   API REST (Node.js + Express + TypeScript + Prisma + PostgreSQL)
apps/frontend/  SPA (React + Vite + TypeScript) — se construye a partir del módulo Auth
docs/           Documentación completa del proyecto
```
