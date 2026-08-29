# Backend — Módulo: Pagos

**Fase**: 10 — Pagos · **Estado**: Construido y probado con gateway simulado — **verificación real contra Stripe/PayPal sandbox pendiente** · **Fecha**: 2026-08-29

Cierra RF-07 (venta en línea) al 100%. Construido explícitamente **sin** credenciales sandbox de Stripe/PayPal, por decisión del usuario — ver la conversación de la sesión: se prefirió tener la orquestación completa y probada ahora, y verificar contra las APIs reales en cuanto existan credenciales, en vez de bloquear todo el módulo a la espera de ellas.

## Qué se construyó

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/orders/:id/pay` | POST | dueño, rate-limit de pagos | Cobra una orden `PENDING` con Stripe o PayPal |
| `/api/v1/orders/:id/refund` | POST | dueño o staff, rate-limit de pagos | Reembolsa una orden `PAID` |

Piezas de arquitectura nuevas:
- `payment-gateway.ts` — interfaz `PaymentGateway` (patrón Strategy, ya documentado en el diagrama de clases de [docs/05-diagramas-uml.md](../05-diagramas-uml.md)).
- `gateways/stripe-gateway.ts`, `gateways/paypal-gateway.ts` — implementaciones reales contra los SDKs de Stripe y PayPal. Instanciación perezosa del cliente (no falla al arrancar la app si falta la clave; falla solo si de verdad se intenta cobrar sin configurar el proveedor).
- `payment-gateway.registry.ts` — mapa `{STRIPE, PAYPAL} -> PaymentGateway`, deliberadamente mutable para que los tests sustituyan la implementación real por un gateway simulado.
- `payment.service.ts` — la máquina de estados: `payOrder` y `refundOrder`.

## Cómo se verificó sin credenciales reales

Los tests de integración **reemplazan `paymentGateways.STRIPE`** por una clase `MockGateway` (implementa la misma interfaz `PaymentGateway`, sin tocar la red) antes de ejercitar la app real vía `supertest`. Esto prueba de punta a punta, contra Postgres/Redis reales, exactamente la parte del sistema que Lumière controla — la orquestación, no el proveedor externo:

- Un cobro exitoso marca la orden `PAID`, la butaca `SOLD`, genera un código de boleto (`qrCode`), libera el lock de Redis y persiste el registro de `Payment`.
- Un cobro rechazado por el gateway deja la orden `PENDING` y la butaca `LOCKED` — el cliente puede reintentar sin perder su reserva.
- Un reembolso exitoso libera la butaca de vuelta a `AVAILABLE` para que otra persona pueda comprarla.
- RBAC: nadie puede pagar o reembolsar la orden de otra persona (staff sí puede reembolsar en nombre de un cliente).
- No se puede pagar una orden que ya está `PAID`, ni reembolsar una que no lo está.

**Lo que esto NO prueba** (y no se puede probar sin credenciales): que `StripeGateway`/`PayPalGateway` realmente hablan correctamente con los servidores de Stripe/PayPal. La forma de los parámetros de ambos SDKs se verificó contra los `.d.ts` reales de los paquetes instalados (compila y tipa correctamente, ver comentarios en cada archivo de gateway), pero eso confirma que el código es *sintácticamente correcto para el SDK*, no que *el flujo de negocio funciona contra la red real* (autenticación OAuth de PayPal, formato exacto de un `PaymentIntent` confirmado de Stripe, etc.).

## Bug real encontrado y corregido durante la construcción de este módulo

El primer intento de `payOrder` hacía `prisma.payment.create()` tanto en el camino de fallo como en el de éxito. Como `Payment.orderId` tiene una restricción `@unique` (una orden tiene como máximo un pago), el test *"el cobro exitoso...*"* falló con `500` y el log reveló la causa real: **un reintento de pago después de un cobro rechazado violaba la constraint única**, porque ya existía una fila `Payment` de intento fallido para esa orden. Se corrigió usando `prisma.payment.upsert()` (por `orderId`) en ambos caminos — el registro de pago representa siempre el **último intento** de esa orden, no un historial completo. Ver limitación relacionada en deuda técnica.

Este es exactamente el tipo de bug que un test de integración real (contra base de datos real, no mocks de Prisma) atrapa y una suite de "el endpoint responde 200" no atraparía — el escenario de fallo-y-reintento no es el camino feliz obvio.

## Decisiones de diseño

1. **Flujo síncrono, no basado en webhooks** — coincide con el diagrama de secuencia ya documentado: el backend cobra y espera la respuesta en la misma request HTTP, no delega la confirmación a un webhook asíncrono. Es más simple de razonar y suficiente para tarjetas (el caso principal); métodos de pago que requieren confirmación asíncrona (ej. transferencias bancarias en algunos países) necesitarían el patrón de webhook — se deja fuera de alcance a propósito, ver deuda técnica.
2. **El reembolso libera la butaca a `AVAILABLE`** — decisión de negocio explícita: si se reembolsa antes de la función, no tiene sentido que la butaca quede "vendida" sin comprador real; otra persona debería poder comprarla.
3. **`source` es siempre un token ya tokenizado por el proveedor en el frontend** (Stripe PaymentMethod id / orden de PayPal ya aprobada), nunca un número de tarjeta — cumplimiento PCI por diseño, ya documentado en [docs/06-seguridad.md](../06-seguridad.md).
4. **Rate limiting específico en pagos** (`paymentRateLimiter`, ya existente desde la fundación del proyecto, ahora finalmente usado) — mitiga abuso de reintentos de cobro.
5. **El detalle de la orden fallida se persiste** (`Payment` con `status: FAILED`) en vez de descartarse — da trazabilidad de por qué una compra no se completó, útil tanto para soporte al cliente como para un futuro reporte de tasa de rechazo de pagos.

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores (incluye la verificación de forma de API de ambos SDKs contra sus tipos reales).
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **83/83 tests pasan** (todos los módulos anteriores + 8 de pagos).
- [x] Prueba manual: el servidor real arranca sin errores **sin** `STRIPE_SECRET_KEY`/`PAYPAL_CLIENT_ID` configurados (instanciación perezosa) — importante porque significa que el resto de la aplicación no se rompe por la ausencia de credenciales que no siempre van a estar disponibles en cada entorno de desarrollo.
- [ ] **Verificación end-to-end contra Stripe/PayPal sandbox reales — pendiente**, requiere las credenciales del usuario.

## Deuda técnica / pendiente

1. **Verificación end-to-end real contra Stripe/PayPal — el pendiente principal de este módulo.** Cuando existan credenciales sandbox: configurar `.env`, hacer una compra de prueba end-to-end desde un frontend real (o Postman con un `PaymentMethod`/orden de PayPal de prueba), y confirmar que `chargeResult.status` refleja correctamente la respuesta real del proveedor.
2. **Sin webhooks de confirmación asíncrona** (ver decisión 1) — si se necesita soportar métodos de pago no instantáneos, este es el punto de extensión.
3. **Historial de intentos de pago no se conserva** — el `upsert` sobrescribe el registro anterior (ver bug corregido arriba). Si se necesita auditoría completa de cada intento (ej. "el cliente intentó pagar 3 veces con tarjetas distintas"), requiere cambiar `Payment.orderId` de único a una relación uno-a-muchos — cambio de schema con migración, no trivial, se deja para cuando haya un requerimiento real de auditoría de pagos.
4. **`PayPalGateway` no se pudo probar ni siquiera con datos falsos locales** (a diferencia de un posible test de firma de webhook de Stripe, que sí se puede generar offline) — su verificación depende enteramente de credenciales sandbox reales.

## Estado del alcance funcional original

Con este módulo, **RF-07 (venta en línea) queda 100% completo**: selección de asientos, bloqueo temporal, creación de orden, y ahora cobro real con Stripe o PayPal. Los 8 requerimientos funcionales del enunciado (RF-01 a RF-08) están completos.

## Siguiente paso

**Frontend** (React + Vite + TypeScript) — con todo el backend construido, probado y documentado, el siguiente módulo natural del roadmap es empezar a consumir esta API desde una interfaz real. Alternativamente: cuando el usuario provea credenciales sandbox, cerrar la verificación end-to-end de este módulo antes de avanzar.
