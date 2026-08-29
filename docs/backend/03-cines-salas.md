# Backend — Módulo: Cines y Salas

**Fase**: 4 — Cines y salas · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

Cubre RF-03 del enunciado original ("Cines y salas: Gestión de datos y capacidad de butacas").

## Qué se construyó

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/cinemas` | GET | público | Lista cines activos, filtro por ciudad/búsqueda, paginación |
| `/api/v1/cinemas/:id` | GET | público | Detalle + resumen de sus salas |
| `/api/v1/cinemas` | POST | `SUPER_ADMIN` | Crea cine |
| `/api/v1/cinemas/:id` | PATCH | `SUPER_ADMIN` | Actualiza cine (incluye activar/desactivar) |
| `/api/v1/cinemas/:cinemaId/rooms` | GET | público | Lista salas de un cine |
| `/api/v1/cinemas/:cinemaId/rooms` | POST | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Crea sala **y genera su mapa de butacas** en la misma operación |
| `/api/v1/rooms/:id` | GET | público | Detalle de sala + mapa de butacas completo (fila, número, tipo) |
| `/api/v1/rooms/:id` | PATCH | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Actualiza nombre/tipo de sala (no el layout, ver deuda técnica) |
| `/api/v1/seat-types` | GET | público | Lista tipos de butaca (dato de referencia, sembrado en el seed) |

## Decisiones de diseño

1. **`totalCapacity` nunca se recibe del cliente.** Se calcula como la suma real de butacas generadas (`rows[].seatCount`). Si se aceptara como input independiente, un cliente podría enviar `totalCapacity: 200` con un layout que en realidad genera 150 butacas — una desincronización silenciosa entre "lo que dice la sala" y "lo que existe realmente". Verificado en test: una sala con filas de 8 y 10 butacas responde `totalCapacity: 18`, exacto.
2. **Crear la sala genera sus butacas (`Seat`) en la misma transacción** (`prisma.$transaction`). Si la generación de butacas fallara a mitad de camino, la sala no queda creada a medias.
3. **Layout de butacas flexible por fila** (`rows: [{ rowLabel, seatCount, seatTypeId }]`) en vez de una grilla uniforme — permite lo que un cine real tiene (ej. últimas filas como VIP, un tramo reservado para sillas de ruedas) sin forzar un modelo rígido de "todas las butacas son iguales".
4. **`PATCH /rooms/:id` solo permite cambiar nombre y tipo de sala, nunca el layout de butacas.** Regenerar butacas después de que existan funciones, reservas u órdenes asociadas a esas butacas (`ShowtimeSeat`, `OrderSeat`) es una operación destructiva de alto riesgo que requiere su propio flujo cuidadoso (o simplemente crear una sala nueva) — se deja fuera de alcance a propósito, ver deuda técnica.
5. **Nombre de sala único por cine** (`findFirst({cinemaId, name})` antes de crear) — evita confusión operativa de dos salas "Sala 1" en el mismo cine.

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **35/35 tests pasan** (11 auth + 16 catálogo + 8 cines/salas: RBAC, filas duplicadas rechazadas, generación exacta de butacas por fila, nombre de sala duplicado rechazado, detalle de cine refleja capacidad real).
- [x] Prueba manual contra el servidor real: `GET /seat-types` devuelve los 4 tipos sembrados, `GET /cinemas` responde paginado correctamente.

## Deuda técnica / pendiente

1. **Sin regeneración de layout de butacas** (ver decisión 4) — si se necesita cambiar la disposición física de una sala existente, por ahora hay que crear una sala nueva. Se evaluará un flujo dedicado si aparece la necesidad real, probablemente bloqueando la operación si existen funciones futuras programadas en esa sala.
2. **Sin borrado de cines/salas** — mismo criterio que películas (módulo de catálogo): en un cine real no se borran, se desactivan (`Cinema.isActive`). Las salas no tienen un campo `isActive` todavía; se agregará si aparece el caso de uso (por ahora una sala se "retira" dejando de programarle funciones).
3. **Geolocalización (`latitude`/`longitude`) sin uso todavía** — quedan en el modelo para cuando se construya "selección de cine más cercano" en el frontend.

## Siguiente módulo

**Funciones** (RF-04) — horarios de proyección, ligando película + sala + idioma/subtítulos, y materialización de `ShowtimeSeat` (una fila por butaca física de la sala, en estado `AVAILABLE`) al crear la función — la pieza que conecta este módulo con el futuro motor de reservas.
