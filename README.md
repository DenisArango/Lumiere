# Lumière

Portal de gestión de cartelera de cine y venta de boletos en línea.

> Punto de entrada de la documentación: [PROJECT.md](PROJECT.md). Ahí está el núcleo del proyecto, las decisiones de arquitectura y el índice completo de `docs/`.

## Quick start (desarrollo local)

Requisitos: Node 20+, Docker Desktop.

```bash
# 1. Levantar Postgres + Redis
docker compose up -d

# 2. Instalar dependencias (raíz, workspaces)
npm install

# 3. Configurar variables de entorno del backend
cp apps/backend/.env.example apps/backend/.env
# editar apps/backend/.env si es necesario

# 4. Aplicar migraciones y datos de referencia
npm run --workspace=apps/backend prisma:migrate
npm run --workspace=apps/backend prisma:seed

# 5. Arrancar el backend en modo desarrollo
npm run dev:backend
```

El backend queda disponible en `http://localhost:4000`, con verificación de salud en `GET /api/v1/health`.

## Estructura

```
apps/backend/   API REST (Node.js + Express + TypeScript + Prisma + PostgreSQL)
apps/frontend/  SPA (React + Vite + TypeScript) — se construye a partir del módulo Auth
docs/           Documentación completa del proyecto
```
