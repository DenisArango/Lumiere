# Backend — Módulo: Fundación

**Fase**: 1 — Fundación · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

## Qué se construyó

- Monorepo con **pnpm workspaces** (`apps/backend`, `apps/frontend`), sobre **Node 22 LTS**.
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
- **Migración inicial aplicada** (`prisma/migrations/20260829004947_init`) contra Postgres real.
- **Seed de datos de referencia** (`prisma/seed.ts`) ejecutado: idiomas, clasificaciones por edad, géneros, tipos de butaca.
- `docker-compose.yml` en la raíz: Postgres 16 + Redis 7 con healthchecks.
- Configuración de calidad: ESLint (`@typescript-eslint`) + Prettier + Jest (`ts-jest` + `supertest`).
- Test de humo (`src/app.test.ts`) para `/api/v1/health` y manejo 404.
- `Dockerfile` multi-stage para producción.

## Verificación realizada (todo en verde)

- [x] `npx prisma validate` — schema válido.
- [x] `npx prisma generate` — cliente generado sin errores.
- [x] `npx tsc --noEmit` — sin errores de tipos.
- [x] `npx eslint src --ext .ts` — sin errores ni warnings.
- [x] `npx prisma migrate dev` — migración inicial aplicada contra Postgres real.
- [x] `npm run prisma:seed` — datos de referencia cargados.
- [x] `npx jest` — 2/2 tests pasan, sin handles colgados.
- [x] `npx tsx src/server.ts` — servidor real arrancado, conecta a Postgres y Redis, `GET /api/v1/health` responde 200 correctamente.

## Incidentes durante el arranque (documentados para no repetirlos)

### 1. Node 20 → Node 22
El entorno de desarrollo tenía Node 20.11.1, lo que impedía usar pnpm (requiere Node ≥22) — se usó npm workspaces como solución temporal. El usuario actualizó a **Node 22.14.0** vía nvm-windows, lo que permitió migrar a **pnpm workspaces** como estaba previsto originalmente en la arquitectura. Node 20 además ya había alcanzado su fin de mantenimiento (abril 2026), así que la actualización también era necesaria por soporte.

**Al reinstalar con pnpm** apareció un bloqueo esperado de seguridad: pnpm no ejecuta scripts de instalación nativos (`postinstall`) de paquetes de terceros por defecto. Se aprobaron explícitamente en `pnpm-workspace.yaml` (`allowBuilds`) los paquetes que legítimamente los necesitan: `@prisma/client`, `@prisma/engines`, `prisma` (generan el motor de Prisma), `argon2` (hash de contraseñas, requiere compilación nativa) y `msgpackr-extract`/`esbuild` (dependencias transitivas de ioredis/tsx).

### 2. Conflicto de puerto 5432 con una instalación nativa de Postgres en Windows
Síntoma: `prisma migrate dev` fallaba con `P1000: Authentication failed ... credentials for (not available)`, incluso con credenciales correctas y con el contenedor sano (`healthy`). El diagnóstico inicial (bug de Prisma, problema de red Docker/WSL2, `scram-sha-256` vs `md5`) fue descartado paso a paso:
1. `docker exec ... psql` (socket Unix) funcionaba → auth `trust` local, no probaba la contraseña real.
2. `docker exec ... psql -h 127.0.0.1` (TCP dentro del contenedor) funcionaba con la contraseña real → el servidor y las credenciales estaban bien.
3. Conexión desde el host con el driver `pg` (sin pasar por el motor de Prisma) daba el error **real** de Postgres: `password authentication failed for user "lumiere"` → no era un bug de Prisma, era un problema de qué servidor respondía.
4. `Get-NetTCPConnection -LocalPort 5432` reveló un **proceso `postgres.exe` nativo de Windows ya escuchando en el puerto 5432** — las conexiones del host a `localhost:5432` caían en esa instancia nativa (con sus propias credenciales), no en el contenedor Docker.

**Fix**: se remapeó el contenedor de Postgres al puerto **5433** en `docker-compose.yml` (`"${POSTGRES_PORT:-5433}:5432"`), y se actualizó `DATABASE_URL` en `.env`/`.env.example` a ese puerto. Documentado directamente como comentario en `docker-compose.yml` para que no se repita el diagnóstico en el futuro.

### 3. Jest no cerraba el proceso (`did not exit`)
El cliente de Redis compartido (usado por el rate-limiter) quedaba abierto tras los tests. Se agregó `afterAll(() => redis.disconnect())` en `app.test.ts` — soluciona el caso de humo actual; cuando se agreguen más suites de test se debe considerar un `globalTeardown` de Jest en vez de repetir el hook por archivo.
### 4. `.env` de test
Jest no cargaba variables de entorno (solo `server.ts` importaba `dotenv/config`, no `app.ts`). Se agregó `jest.setup.js` (cargado vía `setupFiles` en `jest.config.js`) que carga `apps/backend/.env`. Pendiente de mejora futura: separar un `.env.test` con una base de datos de test dedicada en vez de reusar la de desarrollo.

## Decisiones tomadas en este módulo

- **pnpm workspaces** (no npm) — Node 22 LTS lo permite y es la herramienta originalmente prevista en la arquitectura.
- Se descartó `@paypal/checkout-server-sdk` (deprecado por PayPal) en favor de `@paypal/paypal-server-sdk`, el sucesor oficial — se detectó el warning de deprecación en la instalación y se corrigió antes de que existiera código dependiente.
- Alias de imports `@/*` → `src/*`: funciona nativo en desarrollo con `tsx`; para build de producción se usa `tsc-alias` porque `tsc` no reescribe los alias a rutas relativas por sí solo.
- Puerto de Postgres en desarrollo: **5433**, no el 5432 estándar — evita colisión silenciosa con instalaciones nativas de Postgres en la máquina del desarrollador (ver incidente 2).

## Cómo levantar el entorno (ya verificado, reproducible)

```bash
docker compose up -d
cd apps/backend
cp .env.example .env   # ya existe en este repo para desarrollo local
pnpm install
pnpm prisma:generate
pnpm dev
```

## Siguiente módulo

**Auth + RBAC** (login, registro, refresh token con rotación, roles `CUSTOMER`/`BOX_OFFICE`/`CINEMA_MANAGER`/`SUPER_ADMIN`) — ver secuencia de referencia en [docs/05-diagramas-uml.md](../05-diagramas-uml.md) sección 4.
