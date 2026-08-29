# Backend — Módulo: Motor de Reservas

**Fase**: 6 — Motor de reservas · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

Cubre el núcleo de RF-07 ("Venta en línea: Selección de asientos") sin el procesamiento de pago en sí (eso es el siguiente módulo). Es el módulo más sensible del proyecto a condiciones de carrera — el valor agregado central frente a una cartelera genérica (ver [docs/01-requerimientos.md](../01-requerimientos.md) sección "Valor agregado").

## Qué se construyó

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/showtimes/:showtimeId/seats/lock` | POST | autenticado | Bloquea hasta 10 butacas para el usuario actual (TTL configurable, `SEAT_LOCK_TTL_SECONDS`) |
| `/api/v1/showtimes/:showtimeId/seats/release` | POST | autenticado | Libera butacas bloqueadas por el usuario actual |
| `/api/v1/orders` | POST | autenticado | Crea una orden `PENDING` a partir de butacas ya bloqueadas (+ combos opcionales) |
| `/api/v1/orders/me` | GET | autenticado | Lista las órdenes propias, paginado |
| `/api/v1/orders/:id` | GET | autenticado | Detalle de orden (dueño o staff) |
| `/api/v1/orders/:id/cancel` | POST | autenticado | Cancela una orden `PENDING` y libera sus butacas |

Piezas nuevas de infraestructura:
- `src/lib/seat-lock.ts` — el lock atómico distribuido (`Redis SET NX EX`).
- `src/lib/socket-server.ts` — puente entre el servidor HTTP y Socket.io para que los servicios puedan emitir eventos de dominio (`seat:locked`, `seat:released`) sin acoplarse a la instancia concreta.
- `sockets/index.ts` ahora soporta `showtime:join`/`showtime:leave` — el cliente se suscribe al "room" de la función que está viendo para recibir solo los eventos relevantes.

## Cómo funciona el bloqueo (y por qué es seguro ante concurrencia real)

1. **Redis es la puerta de atomicidad.** `acquireSeatLock` usa `SET clave valor EX ttl NX` — esta es una operación atómica de Redis: si dos requests piden el mismo `NX` al mismo tiempo, Redis garantiza que solo uno recibe `OK`. Esto es lo que hace posible que, ante dos usuarios reales compitiendo por la misma butaca en el mismo instante, exactamente uno gane.
2. **Postgres (`ShowtimeSeat.status`) es la fuente de verdad consultable**, actualizada inmediatamente después de ganar el lock en Redis — así el mapa de butacas que ve todo el mundo (`GET /rooms/:id`, `GET /showtimes/:id`) refleja el estado real sin tener que consultar Redis desde cada lectura.
3. **Si falla adquirir el lock de alguna butaca del lote**, se liberan (en Redis) las que sí se habían adquirido en esa misma solicitud antes de devolver el error — una solicitud de "bloquea 3 butacas" nunca deja 2 bloqueadas y falla solo en la tercera silenciosamente.
4. **El barrido de bloqueos vencidos (`sweepExpiredLocks`)** corre antes de cualquier intento de bloqueo, de creación de orden, **y también en las lecturas de disponibilidad del módulo de Funciones** (se agregó esa llamada retroactivamente en `showtime.service.ts` — sin ella, una butaca con bloqueo vencido seguía apareciendo como no-disponible para cualquiera que solo consultara la cartelera sin intentar reservar).
5. **Crear una orden exige que las butacas ya estén bloqueadas por ese mismo usuario** (`status: LOCKED && lockedByUserId === userId`) — no se puede saltar el paso de bloqueo. Esto es intencional: el bloqueo es lo que impide que dos personas paguen por el mismo asiento mientras llenan el formulario de pago.
6. **Crear una orden NO marca las butacas como `SOLD`** — quedan `LOCKED` hasta que el pago se confirme (próximo módulo, ver secuencia completa en [docs/05-diagramas-uml.md](../05-diagramas-uml.md)). Cancelar la orden libera las butacas de vuelta a `AVAILABLE`.

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores ni warnings.
- [x] `npx jest` — **53/53 tests pasan** (11 auth + 16 catálogo + 8 cines/salas + 7 funciones + 11 reservas).
- [x] **Prueba real de concurrencia**: dos usuarios (`A` y `B`) disparan `Promise.all` con requests simultáneas de bloqueo sobre la **misma butaca** — el test verifica que las dos respuestas son exactamente `[200, 409]` (nunca `[200, 200]`, que sería la doble venta que todo este módulo existe para evitar).
- [x] Flujo completo de orden: bloquear → crear orden con combo → verificar `totalAmount` calculado correctamente (butacas × multiplicador de tipo de butaca + combos) → verificar que otro usuario no puede ver la orden (403) → cancelar → verificar que las butacas vuelven a estar disponibles para otro usuario.

## Deuda técnica / pendiente

1. **Sin worker de BullMQ para expiración proactiva.** El barrido actual es *lazy* (ocurre cuando alguien lee/escribe sobre esa función), no proactivo. Es correcto y suficiente para la consistencia de datos (nadie ve una butaca bloqueada-pero-vencida como ocupada permanentemente), pero un usuario que dejó butacas bloqueadas y nadie más consulta esa función no recibirá una notificación de "tu bloqueo expiró" en tiempo real hasta que algo dispare el barrido. Se planea un job BullMQ programado (`delay: ttlSeconds`) que llame a `sweepExpiredLocks` y emita el evento exactamente al vencer, en vez de esperar la próxima lectura.
2. **Los eventos de Socket.io no tienen test automatizado** — se verificó manualmente que `emitSeatEvent` no lanza si no hay servidor de sockets activo (necesario para que los tests con `createApp()` sin `server.ts` no fallen), pero no hay un test de integración con un cliente Socket.io real conectándose y recibiendo el evento. Se agregará cuando el frontend consuma estos eventos.
3. **Sin promociones todavía** (`discountAmount` siempre `0`) — `createOrderSchema` no acepta código de promoción a propósito; se integrará cuando se construya el módulo de Promociones, para no dejar una implementación a medias de las reglas de aplicación de descuentos.
4. **Máximo 10 butacas por operación** — límite arbitrario razonable para evitar abuso (alguien bloqueando cientos de butacas de una vez); ajustable si aparece un caso de uso real que lo requiera (ej. grupos grandes).

## Siguiente módulo

**Pagos** (Stripe + PayPal) — el paso que falta para que una orden `PENDING` pase a `PAID`, marque las butacas como `SOLD`, genere el código QR del boleto, y libere el lock de Redis definitivamente.
