# Frontend — Módulo: Motor de reservas (selección de asientos + checkout)

**Fase**: 12 — Frontend reservas · **Estado**: Construido y verificado end-to-end real (backend real, sin mocks) · **Fecha**: 2026-08-29

## Qué se construyó

### Páginas
| Ruta | Página | Qué hace |
|---|---|---|
| `/funciones/:id/asientos` | Selección de asientos | Mapa de butacas en vivo, selección local, bloqueo al continuar |
| `/checkout` | Checkout | Resumen, código de promoción, selección de proveedor de pago, confirmación |
| `/confirmacion` | Confirmación | Boleto con código QR real (`qrcode.react`) |
| `/mis-ordenes` | Mis boletos | Historial de órdenes con estado y acceso al QR de las pagadas |

### Mapa de butacas (`components/seat-map.tsx`)
Plano de sala real, no una grilla genérica: pantalla curva arriba, filas con pasillo cada 5 butacas, forma de butaca (no cuadrados planos), ícono de silla de ruedas para butacas de accesibilidad, borde dorado para VIP. Colores: disponible (contorno), tu selección (dorado sólido), ocupada (atenuada, sin número visible — no revela si está bloqueada o vendida, ver decisión de backend en [docs/backend/05-reservas.md](../backend/05-reservas.md)).

### Tiempo real (`features/bookings/bookings.hooks.ts`, `lib/socket.ts`)
`useSeatMap` conecta un socket compartido, se une al room de la función (`showtime:join`) y **cualquier cliente viendo esa función recibe la actualización** cuando alguien más bloquea, libera o compra una butaca (`seat:locked`/`seat:released`/`seat:sold`, ya emitidos por el backend desde el módulo de reservas) — invalida la query de React Query y refresca el mapa. Respaldo con `refetchInterval: 15s` por si el socket se desconecta.

### Flujo completo
1. **Selección**: el usuario marca butacas localmente (sin llamar al backend todavía) → al continuar, `POST /showtimes/:id/seats/lock` en un solo lote.
2. **Checkout**: `POST /orders` (con código de promoción opcional) → `POST /orders/:id/pay`.
3. **Confirmación**: boleto con QR.
4. **Limpieza honesta**: si el usuario abandona la página de selección sin continuar, se liberan las butacas bloqueadas (`useEffectOnUnmount`) — nadie se queda con una butaca fantasma. Si ya se creó una orden `PENDING`, no se auto-cancela al salir del checkout (coincide con el diseño del backend: el cliente puede volver a intentar el pago sin perder su reserva).

## Bug real encontrado y corregido durante la verificación end-to-end

Construir esta pantalla exigió ejercitar el flujo completo contra el backend real (login → mapa de butacas → bloqueo → orden → pago) vía `curl`, simulando exactamente lo que hace el navegador. El intento de pago reveló un bug real en el backend: el SDK de Stripe **lanza una excepción** (no devuelve un `status` fallido) ante una clave de API inválida — como el `.env` de desarrollo trae `STRIPE_SECRET_KEY=sk_test_xxx` (placeholder de `.env.example`), la app intentó un cobro real, Stripe lo rechazó, y esa excepción se propagó como un **500 crudo** en vez de un error de pago manejado con gracia.

**Fix** (`apps/backend/src/modules/payments/payment.service.ts`): el llamado a `gateway.charge()`/`gateway.refund()` ahora está en un `try/catch` — cualquier excepción del SDK del proveedor (clave inválida, timeout de red, lo que sea) se trata igual que un cobro rechazado: se registra un `Payment` con `status: FAILED` y se responde `402`/`502` con un mensaje claro, nunca un `500`. Verificado con el mismo `curl` que expuso el bug: ahora responde `{"error":{"message":"No pudimos comunicarnos con el proveedor de pago. Tus butacas siguen reservadas, intenta de nuevo."}}` con `HTTP 402`, y el mapa de butacas confirma que la butaca sigue `LOCKED` (la reserva no se pierde). 86/86 tests de backend siguen pasando.

Esto es exactamente el tipo de bug que solo aparece al construir la pieza de frontend que realmente usa el endpoint — los tests de integración del backend usaban un gateway simulado (correctamente, para probar la orquestación sin depender de red), así que nunca ejercitaron el camino real del SDK lanzando una excepción.

## Nueva pieza de backend: `GET /showtimes/:id/seats`

Al empezar esta pantalla se encontró que el backend nunca exponía un endpoint para leer el mapa de butacas con su estado — existían `lock`/`release`/`createOrder` pero no una forma de saber qué butacas mostrar antes de intentar nada. Se agregó (documentado en detalle en [docs/backend/05-reservas.md](../backend/05-reservas.md) vía el commit correspondiente): público, corre el barrido de bloqueos vencidos antes de leer, no revela quién tiene bloqueada una butaca.

## Verificación realizada

- [x] `npx tsc -b --noEmit` — sin errores.
- [x] `npx oxlint` — limpio (mismos 2 warnings benignos de siempre).
- [x] `npx vite build` — 2471 módulos sin error.
- [x] **Flujo end-to-end real vía curl** (no solo build/lint): login → `GET /showtimes/:id/seats` (6 disponibles) → `POST .../lock` → `POST /orders` (orden `PENDING`, subtotal correcto) → `POST /orders/:id/pay` (falla honesta contra Stripe real con clave placeholder, `402`, no `500`) → mapa de butacas confirma la butaca sigue `LOCKED`, no se perdió la reserva ni se vendió sin pago. Datos de prueba limpiados al terminar.
- [ ] **Verificación visual en navegador — sigue pendiente** (sin herramienta de automatización de navegador). Lo verificado arriba prueba que la integración es correcta a nivel de red/datos; no prueba que el mapa de butacas se vea bien, que las animaciones funcionen, o que no haya errores de React en el DOM real.

## Decisiones de diseño

1. **Bloqueo diferido al continuar, no al hacer clic en cada butaca** — evita spamear el endpoint de bloqueo con cada clic/declic; el usuario arma su selección localmente y se bloquea todo en un lote al confirmar.
2. **Sin formulario de tarjeta falso** — el selector de proveedor (Stripe/PayPal) llama directamente al endpoint de pago real con un identificador de desarrollo, no simula un formulario de captura de tarjeta. Construir un formulario de tarjeta sin tokenización real de Stripe Elements sería, en el mejor caso, confuso y en el peor, un patrón inseguro que este proyecto evita explícitamente en toda su documentación de seguridad (ver [docs/06-seguridad.md](../06-seguridad.md)). El texto en checkout es honesto sobre esto.
3. **No auto-cancelar la orden al abandonar el checkout** — coincide con el diseño ya documentado del backend (el cliente puede reintentar el pago sin perder la reserva mientras el bloqueo no expire).

## Deuda técnica / pendiente

1. **Verificación visual en navegador** (ver arriba) — el pendiente más importante, otra vez.
2. **Sin selección de combos de dulcería** en el checkout — el backend ya soporta `items` en `createOrder`; se agrega cuando exista el catálogo de productos en el frontend.
3. **Stripe Elements / PayPal Buttons reales no integrados** — el checkout llama al endpoint de pago con un token de desarrollo; la integración real de tokenización en el navegador se hace cuando existan las claves publicables (`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_PAYPAL_CLIENT_ID`).
4. **Sin manejo de expiración del bloqueo con cuenta regresiva visible** — el usuario no ve cuánto tiempo le queda antes de que su butaca se libere automáticamente; sería una mejora de UX razonable.

## Siguiente módulo

**Panel de administración** — el backend tiene listos todos los módulos de gestión (catálogo, cines/salas, funciones, promociones, reportería) sin interfaz todavía.
