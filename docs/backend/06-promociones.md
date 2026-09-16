# Backend — Módulo: Promociones

**Fase**: 7 — Promociones · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

Cubre RF-05 ("Promociones: Registro y aplicación de descuentos por función"). Este módulo además **cierra un pendiente documentado explícitamente** en el módulo de reservas: `createOrder` ya acepta `promotionCode` y aplica el descuento real.

## Qué se construyó

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/promotions` | GET | público | Lista promociones activas y vigentes (dentro de su rango de fechas) |
| `/api/v1/promotions/:id` | GET | público | Detalle + reglas de aplicación |
| `/api/v1/promotions` | POST | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Crea promoción con reglas (película/cine/día de la semana) |
| `/api/v1/promotions/:id` | PATCH | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Actualiza promoción (reemplaza reglas si se envían, mismo patrón que películas/salas) |
| `/api/v1/promotions/validate` | POST | autenticado | Valida si un código aplica a una función específica, **sin calcular un monto** (ver decisión 2) |
| `/api/v1/orders` (existente) | POST | autenticado | Ahora acepta `promotionCode` opcional y aplica el descuento real al crear la orden |

## Decisiones de diseño

1. **Código de promoción siempre requerido** (no hay promociones "automáticas" sin código). Se consideró permitir promociones que se apliquen solas sin que el cliente escriba nada, pero eso obliga a resolver qué pasa si dos promociones automáticas aplican a la vez (¿cuál gana? ¿se suman?) — una decisión de negocio no trivial que se deja fuera de alcance. Exigir código mantiene el modelo simple y predecible: una orden usa como máximo un código, el que el cliente ingresó.
2. **`/promotions/validate` no calcula un monto de descuento**, solo confirma validez y devuelve `discountType`/`discountValue` para que el frontend estime una vista previa. El subtotal real depende de butacas y combos que el cliente aún no ha terminado de elegir en ese punto del flujo — devolver un número calculado contra un subtotal ficticio (ej. `0`) sería literalmente incorrecto, no una simplificación razonable.
3. **Reglas de aplicación (`PromotionRule`) por película, cine o día de la semana**, evaluadas con lógica **OR** (basta que una regla coincida). Una promoción **sin reglas se considera global** (aplica a cualquier función) — decisión explícita para permitir descuentos de sitio completo (ej. "10% de lanzamiento") sin forzar al administrador a enumerar todas las películas/cines.
4. **`calculateDiscount` es una función pura exportada** (`promotion.service.ts`), reutilizada tanto por el flujo de creación de orden como por cualquier reporte futuro de "efectividad de promociones" (RF-08) que necesite recalcular montos.
5. **Día de la semana se compara en UTC** (`startTime.getUTCDay()`), igual que el filtro de fecha del módulo de Funciones — misma simplificación documentada, mismo lugar donde se revisará cuando se defina la zona horaria de exhibición al usuario final.
6. **Validación de rango de descuento en el schema** (`discountValue <= 100` si es `PERCENTAGE`) — evita el error obvio de configurar sin querer un "150% de descuento".

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **60/60 tests pasan** (11 auth + 16 catálogo + 8 cines/salas + 7 funciones + 11 reservas + 7 promociones).
- [x] **Flujo end-to-end real verificado**: crear promoción de 20% para una película → bloquear butaca → crear orden con el código → la orden resultante tiene `subtotal: 200`, `discountAmount: 40`, `totalAmount: 160` — el cálculo correcto, no solo que el campo exista.
- [x] Código duplicado rechazado (`409`), descuento porcentual >100% rechazado (`422`), código inexistente en `/validate` rechazado (`404`).
- [x] Prueba manual contra el servidor real: `GET /promotions` responde `{"promotions": []}` correctamente (sin datos de ejemplo cargados).

## Deuda técnica / pendiente

1. **Sin límite de usos por promoción ni por usuario** (ej. "máximo 100 canjes" o "una vez por cliente") — el modelo de datos no tiene un contador de usos todavía. Se agregará si aparece el caso de uso real; requiere decidir si el conteo se hace sobre `Order` en estado `PAID` únicamente (evitar contar órdenes canceladas).
2. **Sin combinación de múltiples promociones** — una orden solo puede tener un `promotionId`. Es una limitación de diseño consciente, no un olvido: combinar descuentos introduce ambigüedad de negocio (¿se suman? ¿se aplican en cadena?) que no vale la pena resolver sin un requerimiento real.
3. **El reporte de "efectividad de promociones" (RF-08) todavía no existe** — este módulo deja la base de datos lista para ese reporte (cada `Order` pagada con `promotionId` es trazable), pero el endpoint de reportería es su propio módulo en el roadmap.

## Siguiente módulo

**Pagos** (Stripe + PayPal) — con promociones ya integradas, el siguiente paso natural es que una orden `PENDING` (con su `totalAmount` ya neto de descuento) pueda pagarse de verdad.

> **Nota para quien retome el proyecto**: este módulo requiere credenciales de prueba (sandbox) de Stripe y PayPal que no están disponibles en este entorno de desarrollo — se puede construir y probar unitariamente la lógica de cálculo/orquestación con un `PaymentGateway` mockeado (ver el patrón Strategy ya documentado en [docs/05-diagramas-uml.md](../05-diagramas-uml.md) sección 2), pero la verificación end-to-end contra las APIs reales de Stripe/PayPal requiere que se configuren `STRIPE_SECRET_KEY` y `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` en `.env` con cuentas sandbox reales.
