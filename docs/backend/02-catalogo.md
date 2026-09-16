# Backend — Módulo: Catálogo (Películas, Géneros, Personas)

**Fase**: 3 — Catálogo · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

Cubre RF-01 (Películas) y RF-02 (Directores y actores) del enunciado original.

## Qué se construyó

Tres módulos de dominio, mismo patrón que Auth (`schema.ts` Zod → `service.ts` lógica pura → `controller.ts` HTTP → `routes.ts`):

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/genres` | GET | público | Lista géneros |
| `/api/v1/genres` | POST | `SUPER_ADMIN` | Crea género (rechaza nombre duplicado) |
| `/api/v1/people` | GET | público | Lista personas, con búsqueda por nombre y paginación |
| `/api/v1/people/:id` | GET | público | Detalle + filmografía y contador de películas **por rol** (RF-02) |
| `/api/v1/people` | POST | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Crea persona (director/actor) |
| `/api/v1/people/:id` | PATCH | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Actualiza persona |
| `/api/v1/movies` | GET | público | Lista con filtros (`status`, `genreId`, `search`) y paginación |
| `/api/v1/movies/:id` | GET | público | Detalle completo: géneros, clasificación, idioma, directores, reparto |
| `/api/v1/movies` | POST | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Crea película con géneros y créditos en una sola llamada transaccional |
| `/api/v1/movies/:id` | PATCH | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Actualiza película (reemplaza géneros/créditos si se envían) |

**No existe `DELETE /movies/:id` a propósito**: los cines reales no borran películas, las archivan. `MovieStatus.ARCHIVED` ya existe en el schema — retirar una película de cartelera es un `PATCH { status: "ARCHIVED" }`, preservando el historial de funciones/reseñas que dependan de ella (que además la integridad referencial de la base de datos no permitiría borrar sin cascada).

## Decisiones de diseño

1. **`Person` unifica directores y actores** (ver [docs/04-modelo-datos.md](../04-modelo-datos.md) sección 3) — el endpoint `GET /people/:id` calcula `movieCounts: { asDirector, asActor }` agrupando `MovieCredit` por rol, nunca almacenado como columna. Verificado en test: una persona sin créditos empieza en `{0, 0}` y sube a `{1, 0}` tras crear una película donde participa como `DIRECTOR`.
2. **Crear una película valida en el schema (Zod `superRefine`) que exista al menos un `DIRECTOR` entre los créditos** — no es una regla de base de datos, es una regla de negocio del RF-01 ("directores y actores"), y por eso vive en la capa de validación, no en una constraint SQL.
3. **Género y créditos se escriben en la misma transacción que la película** (`prisma.$transaction` en `updateMovie`; nested write en `createMovie`) — evita que una película quede a medio crear si falla la asociación de créditos.
4. **`MovieGenre` y `MovieCredit` en `update` se reemplazan completo (delete + create), no se hace diff** — más simple y suficientemente rápido para el volumen esperado (una película tiene decenas de créditos, no miles); si en el futuro esto es un cuello de botella, se puede optimizar a un diff real.
5. **Filtros de lista (`status`, `genreId`, `search`) son opcionales y combinables** — `search` usa `contains` case-insensitive sobre `title` (Postgres `ILIKE` vía Prisma).

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **27/27 tests pasan** (11 de auth + 16 de catálogo: RBAC en genres/people/movies, validación de director requerido, contador de películas por persona, filtro por género, actualización de estado, 404 en película inexistente).
- [x] Prueba manual contra el servidor real: `GET /genres` devuelve los 12 géneros del seed, `GET /movies` devuelve lista vacía paginada correctamente (`{items: [], page: 1, pageSize: 5, total: 0, totalPages: 1}`).

## Incidente durante este módulo: rate limiter agotado en tests

Al correr la suite completa (auth + catálogo juntos), 9 de 11 tests de auth empezaron a fallar con `429` en vez de sus códigos esperados. **No era una regresión de código**: las decenas de corridas de test y pruebas manuales del día habían agotado el límite real de `authRateLimiter` (10 intentos/15min) en Redis para la IP de test, y ese límite es intencionalmente estricto (ver [docs/06-seguridad.md](../06-seguridad.md)).

**Fix**: se agregó `skip: () => env.NODE_ENV === "test"` a la fábrica de rate limiters (`middleware/rate-limit.ts`) — el rate limiting real solo se desactiva cuando `NODE_ENV=test` (que Jest fija automáticamente), nunca en desarrollo o producción. De paso apareció un problema separado: el proceso de Jest terminaba con código de salida 1 pese a que todos los tests pasaban, por una condición de carrera conocida de `ioredis` al cerrar la conexión justo cuando Jest termina (`Connection is closed.` lanzado de forma síncrona fuera de cualquier try/catch). Se filtra puntualmente ese mensaje exacto en `jest.setup.js` sin ocultar ningún otro error. Ambos incidentes están comentados directamente en el código para que no se repita el diagnóstico.

## Deuda técnica / pendiente

1. Sin soft-delete ni endpoint de eliminación para `Genre`/`Person` — no hay caso de uso todavía que lo requiera; se agrega cuando aparezca.
2. Sin subida de imágenes (poster/backdrop) — por ahora `posterUrl`/`backdropUrl` son URLs de texto; el módulo de almacenamiento de medios (Cloudinary/S3 u otro) queda para cuando se construya el frontend de administración.
3. Actualización de géneros/créditos por reemplazo completo, no diff incremental (ver decisión 4 arriba) — aceptable al volumen actual.

## Siguiente módulo

**Cines y salas** (RF-03) — gestión de cines, salas con tipo (`STANDARD`/`IMAX`/`VIP`/`FOUR_DX`/`DOLBY_ATMOS`) y mapa de butacas (`Seat` + `SeatType`).
