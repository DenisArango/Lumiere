# Backend — Módulo: Fundación

**Fase**: 1 — Fundación · **Estado**: Completo · **Fecha**: 2026-08-28

## Qué se construyó

- Monorepo con **npm workspaces** (`apps/backend`, `apps/frontend`).
- Esqueleto de backend Express + TypeScript (`apps/backend/src`):
  - `config/env.ts` — validación de variables de entorno con Zod al arranque (falla rápido si falta algo).
  - `lib/prisma.ts`, `lib/redis.ts`, `lib/logger.ts` — clientes compartidos (Prisma singleton, ioredis, Pino con redacción de campos sensibles).
  - `middleware/error-handler.ts`, `middleware/not-found.ts` — manejo centralizado de errores, nunca expone stack traces en producción.
  - `middleware/rate-limit.ts` — limitadores respaldados por Redis (global, auth, pagos) — ver [docs/06-seguridad.md](../06-seguridad.md).
  - `middleware/validate.ts` — middleware genérico de validación Zod reutilizable por todos los módulos futuros.
  - `utils/app-error.ts` — jerarquía de errores tipados (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ValidationError`).
  - `app.ts` — construcción de la app Express (Helmet con CSP, CORS con whitelist, compression, cookie-parser, hpp, pino-http) separada de `server.ts` para poder testear con supertest sin levantar el socket real.
  - `sockets/index.ts` — bootstrap de Socket.io (los eventos de dominio se registran cuando se construya el módulo de reservas).
  - `server.ts` — bootstrap real: conexión a Postgres, listen, apagado con gracia (`SIGTERM`/`SIGINT`).
  - Endpoint `GET /api/v1/health`.
- **Schema de Prisma completo** (`prisma/schema.prisma`) con las ~20 entidades del modelo de datos completo (ver [docs/04-modelo-datos.md](../04-modelo-datos.md)), no solo las del primer módulo funcional — decisión explícita para evitar retrabajo (ver PROJECT.md sección 6).
- **Migración inicial** generada (`prisma/migrations/20260829004947_init`) — generada con `prisma migrate diff --from-empty` porque el entorno de desarrollo no tenía Docker Desktop corriendo al momento de construir esta fase (ver "Deuda técnica / pendiente" abajo).
- **Seed de datos de referencia** (`prisma/seed.ts`): idiomas, clasificaciones por edad, géneros, tipos de butaca — catálogos base, no datos de ejemplo de negocio.
- `docker-compose.yml` en la raíz: Postgres 16 + Redis 7 con healthchecks.
- Configuración de calidad: ESLint (`@typescript-eslint`) + Prettier + Jest (`ts-jest` + `supertest`).
- Test de humo (`src/app.test.ts`) para `/api/v1/health` y manejo 404.
- `Dockerfile` multi-stage para producción.

## Verificación realizada

- [x] `npx prisma validate` — schema válido.
- [x] `npx prisma generate` — cliente generado sin errores.
- [x] `npx tsc --noEmit` — sin errores de tipos.
- [x] `npx eslint src --ext .ts` — sin errores ni warnings.
- [ ] `npm test` — **no ejecutado**: requiere Redis corriendo (rate-limit store se conecta al importar `app.ts`).
- [ ] `npm run dev` contra Postgres/Redis reales — **no ejecutado**: Docker Desktop no estaba corriendo en el entorno de desarrollo.
- [ ] `prisma migrate dev` aplicado contra una base de datos real — **pendiente**, ver deuda técnica.

## Deuda técnica / pendiente (explícita, no implícita)

1. **La migración inicial no se ha aplicado ni probado contra una base de datos Postgres real.** Se generó con `prisma migrate diff --from-empty --to-schema-datamodel` (modo sin conexión) porque Docker Desktop no estaba disponible en la sesión de desarrollo. **Antes de continuar con el siguiente módulo (Auth + RBAC)**, se debe:
   ```
   docker compose up -d
   cd apps/backend
   npx prisma migrate dev   # detecta la migracion existente y la aplica sobre la BD vacia
   npm run prisma:seed
   npm run dev
   npm test
   ```
   y confirmar que no hay diffs pendientes entre el schema y la migración aplicada.
2. El servidor completo (`npm run dev`) no se ha ejecutado de punta a punta contra servicios reales — solo se validó compilación, tipos y lint.
3. No hay CI configurado todavía (GitHub Actions u otro) — se evaluará en la fase de hardening final.

## Decisiones tomadas en este módulo

- Se descartó **pnpm** (definido originalmente en la arquitectura) por incompatibilidad con la versión de Node del entorno (pnpm reciente requiere Node ≥22; el entorno corre Node 20 LTS). Se usa **npm workspaces** en su lugar — ver [docs/03-arquitectura.md](../03-arquitectura.md) sección 4 para el detalle.
- Se descartó `@paypal/checkout-server-sdk` (deprecado por PayPal) en favor de `@paypal/paypal-server-sdk`, el sucesor oficial — se detectó el warning de deprecación en la instalación y se corrigió antes de que existiera código dependiente, evitando retrabajo futuro en el módulo de pagos.
- Alias de imports `@/*` → `src/*`: funciona nativo en desarrollo con `tsx` (resuelve `tsconfig.json` paths); para build de producción se usa `tsc-alias` porque `tsc` no reescribe los alias a rutas relativas por sí solo.

## Siguiente módulo

**Auth + RBAC** (login, registro, refresh token con rotación, roles `CUSTOMER`/`BOX_OFFICE`/`CINEMA_MANAGER`/`SUPER_ADMIN`) — ver secuencia de referencia en [docs/05-diagramas-uml.md](../05-diagramas-uml.md) sección 4.
