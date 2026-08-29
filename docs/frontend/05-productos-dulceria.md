# Frontend — Módulo: Dulcería (combos)

**Fase**: 16 — Frontend dulcería · **Estado**: Construido y verificado end-to-end real · **Fecha**: 2026-08-29

Cierra otro vacío real: el schema tiene `Product`/`OrderItem` desde la fundación del proyecto y `createOrder` acepta `items` desde el módulo de reservas, pero nunca existió gestión del catálogo de productos ni una forma de agregarlos en el checkout — el soporte estaba "medio construido" en ambas puntas sin conectar.

## Qué se construyó

### Backend (nuevo)
`GET /products` (público, solo activos), `POST`/`PATCH /products` (`SUPER_ADMIN`/`CINEMA_MANAGER`) — mismo patrón que el resto de módulos. 94/94 tests de backend pasan (6 nuevos).

### Frontend
- **Admin** (`/admin/productos`): lista + formulario de creación, mismo patrón que el resto del panel.
- **Checkout**: selector de combos con contador +/- por producto, integrado entre el resumen de butacas y el código de promoción. El total mostrado ahora suma butacas + combos, y `createOrder` envía `items` solo si hay alguno con cantidad > 0.

## Verificación realizada

- [x] Backend: `npx tsc --noEmit`, `npx eslint`, `npx jest` (94/94) — limpio.
- [x] Frontend: `npx tsc -b --noEmit`, `npx oxlint`, `npx vite build` — limpio, sin warnings nuevos.
- [x] **Flujo completo verificado vía `curl` contra el servidor real**: admin crea un combo (`$60`) → cliente bloquea una butaca → cliente crea una orden con `items: [{productId, quantity: 2}]` (payload exacto del checkout) → `201`, **`subtotal: 220`** = `100` (butaca) + `120` (2 combos de $60) — el cálculo del backend, que ya existía y estaba probado en aislamiento, ahora se verificó conectado de punta a punta con datos reales de producto. Datos de prueba limpiados.

## Decisiones de diseño

1. **Sin variantes/tamaños de producto** (chico/mediano/grande) — el modelo `Product` es plano a propósito; si se necesitan variantes, es una extensión futura del schema, no algo que forzar ahora sin un requerimiento real.
2. **El checkout solo muestra productos activos** (mismo endpoint que usa el admin para listar, `GET /products`) — un producto desactivado desaparece de la compra sin necesidad de borrarlo, igual que el patrón ya usado en promociones/películas (desactivar/archivar, no borrar).

## Siguiente

Con esto, **el valor agregado "combos de dulcería vinculados a la orden"** (documentado desde el inicio en [docs/01-requerimientos.md](../01-requerimientos.md)) queda completamente funcional de punta a punta, no solo declarado en el modelo de datos.
