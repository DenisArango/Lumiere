# Usuarios, programa de puntos, listados de staff y Stripe real

Cierra varios vacíos del backend detectados al construir el panel completo. Todo verificado con pruebas de integración (116/116) y, en el caso de Stripe, con cobros reales en modo prueba.

## 1. Gestión de usuarios (`/api/v1/users`, solo `SUPER_ADMIN`)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/users` | Lista paginada, filtros `search`, `role`, `isActive`. Nunca devuelve `passwordHash`. |
| `POST` | `/users` | Crea una cuenta con rol (taquilla, gerente…). Misma política de contraseña que el registro. |
| `PATCH` | `/users/:id` | Cambia nombre, rol o `isActive`. |
| `POST` | `/users/me/loyalty` | Cualquier usuario autenticado se une al programa de puntos. |

Decisiones:
- Un administrador **no puede cambiar su propio rol ni desactivarse** (evita dejar el sistema sin `SUPER_ADMIN`).
- Desactivar una cuenta **revoca todos sus refresh tokens**. El access token ya emitido sigue válido hasta su expiración corta (JWT sin estado); es una limitación conocida del diseño.

## 2. Programa de puntos

- Regla única en [`loyalty.ts`](../../apps/backend/src/modules/users/loyalty.ts): **1 punto por cada unidad entera pagada**.
- Solo suman los miembros (`loyaltyMember`). Se otorgan en la misma transacción que marca la orden `PAID`.
- Los puntos otorgados se guardan en `Order.pointsEarned` (migración `add_order_points_earned`), así un **reembolso revierte exactamente lo otorgado** aunque la regla cambie después.
- Pendiente (decisión de producto): canje de puntos por descuentos. Hoy solo se acumulan.

## 3. Listados de staff

- `GET /orders` (staff): todas las órdenes con comprador, película, pago y butacas; filtro `status`.
- `GET /reviews` (staff): todas las reseñas, aprobadas o no, con película y autor; filtro `isApproved`.
- `?includeInactive=true` en `GET /cinemas`, `/products`, `/promotions`: **solo staff** ([`include-inactive.ts`](../../apps/backend/src/middleware/include-inactive.ts)). Sin el parámetro, los listados siguen siendo públicos. Sin esto, algo desactivado desde el panel no podía volver a activarse.

## 4. Bug corregido: butacas que no se podían volver a comprar

`OrderSeat.showtimeSeatId` es único. Al **cancelar**, **reembolsar** o **expirar** una orden, la butaca volvía a `AVAILABLE` pero su fila en `order_seats` se quedaba, y la siguiente compra de esa butaca fallaba con un 500.

Corrección:
- Cancelar y reembolsar borran las filas `order_seats` de la orden en la misma transacción.
- `sweepExpiredLocks` ahora también suelta la fila y marca la orden pendiente huérfana como `EXPIRED`.
- `createOrder` limpia filas viejas de órdenes `CANCELLED/REFUNDED/EXPIRED` (datos previos al arreglo).
- Consecuencia: una orden cancelada o reembolsada **ya no conserva el detalle de sus butacas** (sí su total, pagos y fechas).
- Pruebas de regresión en `user.test.ts` (cancelar → recomprar, pagar → reembolsar → recomprar, expirar → recomprar).

**Limitación conocida:** cancelar una función (`PATCH /showtimes/:id`, `status: CANCELLED`) solo cambia su estado; **no reembolsa** las órdenes ya pagadas. Hay que hacerlo desde Órdenes.

## 5. Stripe real

Variables de entorno (backend, archivo `.env` ignorado por git):

```
PAYMENT_CURRENCY=GTQ          # debe coincidir con VITE_CURRENCY del frontend
STRIPE_SECRET_KEY=sk_test_... # clave SECRETA, nunca en el frontend ni en git
```

Flujo: el navegador tokeniza la tarjeta con Stripe Elements → obtiene un `PaymentMethod` (`pm_...`) → el backend crea un `PaymentIntent` con `confirm: true` (`StripeGateway.charge`). **El backend nunca ve el número de tarjeta.**

Verificado contra Stripe (modo prueba): cobro (`PAID`, QR, puntos) → reembolso (`REFUNDED`, puntos revertidos) → recompra de la misma butaca. Stripe acepta `GTQ`.

Límites actuales:
- Tarjetas que exigen **3D Secure** devuelven `requires_action` y el backend las trata como rechazadas. Soportarlas requiere el flujo con `client_secret` en el frontend.
- **No hay webhooks** (`STRIPE_WEBHOOK_SECRET` existe pero no se usa): pagos asíncronos y reembolsos hechos desde el panel de Stripe no se reflejan solos.
- PayPal sigue sin credenciales; en el checkout aparece deshabilitado ("próximamente").
