# Webhooks, 3D Secure, PayPal, canje de puntos y auditoría

Cierra los pendientes de pagos y gestión que `11-usuarios-puntos-y-stripe.md` dejaba abiertos. Verificado con pruebas de integración (147/147) y, donde se indica, contra los proveedores reales en modo prueba.

## 1. Una sola ruta hacia "pagada" y "reembolsada"

[`payment.service.ts`](../../apps/backend/src/modules/payments/payment.service.ts) concentra las únicas dos transiciones de dinero:

- `finalizePaidOrder`: `PENDING → PAID` (QR, butacas `SOLD`, puntos).
- `finalizeRefund`: `PAID → REFUNDED` (butacas libres, `order_seats` sueltas, puntos ajustados).

Las usan el pago directo, la confirmación de 3D Secure, los webhooks y la cancelación de funciones, así que **se comportan igual**. Ambas son **idempotentes y seguras ante carreras**: la orden se "reclama" con `UPDATE ... WHERE status = 'PENDING'/'PAID'`; si un webhook y el cliente llegan a la vez, solo uno gana y nadie duplica puntos ni QR.

## 2. Webhooks

`POST /api/v1/webhooks/stripe` y `POST /api/v1/webhooks/paypal`. Se montan **antes** de `express.json()` porque la firma se calcula sobre los bytes exactos del cuerpo. No usan cookies ni CSRF: la autenticidad la da la firma del proveedor.

**Para qué sirven:** el sistema solo sabe lo que él mismo pide. Los webhooks cubren lo que ocurre por fuera: un pago que termina tarde, un reembolso hecho desde el panel del proveedor, un pago rechazado de forma asíncrona.

| Evento | Qué hace |
|---|---|
| Stripe `payment_intent.succeeded` / PayPal `PAYMENT.CAPTURE.COMPLETED` | Marca la orden `PAID` **solo si monto y moneda coinciden**; si no, la rechaza y lo registra. |
| ...llega para una orden `CANCELLED`/`EXPIRED` | Cobro huérfano: se **reembolsa automáticamente** (no hay boleto que darle). |
| Stripe `charge.refunded` / PayPal `PAYMENT.CAPTURE.REFUNDED` | Orden `REFUNDED` y butaca libre. Solo reembolsos totales. |
| Stripe `payment_intent.payment_failed` / PayPal `...DENIED` | Pago `FAILED`. |

Los eventos ya procesados se guardan en `webhook_events` para ignorar duplicados; además cada manejador es idempotente por sí mismo. Los cambios hechos por webhook quedan en la bitácora con usuario "sistema".

### Cómo configurarlos

**Stripe, en local** (necesita [Stripe CLI](https://stripe.com/docs/stripe-cli)):
```bash
stripe login
stripe listen --forward-to localhost:4000/api/v1/webhooks/stripe
# imprime "whsec_..." -> ponlo en apps/backend/.env como STRIPE_WEBHOOK_SECRET y reinicia el backend
stripe trigger payment_intent.succeeded   # (opcional) para probar
```
**Stripe, en producción:** Dashboard → Developers → Webhooks → Add endpoint → `https://TU-DOMINIO/api/v1/webhooks/stripe` con los eventos `payment_intent.succeeded`, `payment_intent.payment_failed` y `charge.refunded`; copia el *Signing secret* a `STRIPE_WEBHOOK_SECRET`.

**PayPal:** developer.paypal.com → tu app → *Webhooks* → Add webhook con URL pública HTTPS (en local, un túnel: `ngrok http 4000` o `cloudflared tunnel --url http://localhost:4000`) → `https://URL/api/v1/webhooks/paypal`, eventos `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.DENIED`. Copia el **Webhook ID** a `PAYPAL_WEBHOOK_ID`. PayPal firma con su propia infraestructura, así que la verificación se delega a su API (`verify-webhook-signature`).

Sin `STRIPE_WEBHOOK_SECRET` / `PAYPAL_WEBHOOK_ID` las rutas responden **503** (nunca aceptan eventos sin verificar).

> **Estado de verificación:** probados con eventos firmados con el algoritmo real de Stripe y con el verificador de PayPal sustituido. **No** se probó la entrega real de un webhook del proveedor (requiere URL pública o Stripe CLI, no disponibles en el entorno de desarrollo).

## 3. 3D Secure (Stripe)

`POST /orders/:id/pay` responde **200** (pagada) o **202** con `action: { type: "stripe_3ds", clientSecret, paymentIntentId }`. El navegador completa el desafío con `stripe.handleNextAction` y llama `POST /orders/:id/pay/confirm`, donde **el servidor no confía en el aviso del cliente**: vuelve a consultar el PaymentIntent a Stripe y verifica que sea de esa orden (`metadata.orderId`), por el monto y la moneda exactos.

Verificado en el navegador con la tarjeta de prueba `4000 0027 6000 3184`: **COMPLETE** → orden pagada con QR y puntos; **FAIL** → el cliente vuelve al checkout con la orden intacta y puede reintentar (la orden se reutiliza, ya no se crea otra).

## 4. PayPal

- **La orden de PayPal la crea el servidor** (`POST /orders/:id/checkout-session`) con el total de *nuestra* orden y su id en `custom_id`. Antes se pensaba crear en el navegador, donde el cliente habría decidido el monto.
- Al pagar, el gateway **consulta la orden de PayPal y verifica `custom_id` y monto antes de capturar**. Una orden ajena o inventada se rechaza sin capturar nada.
- `providerPaymentId` ahora es el id de la **captura**, que es el que exige el reembolso (antes guardaba el de la orden y todo reembolso de PayPal habría fallado). El reembolso es total y sin monto: PayPal devuelve lo mismo que cobró.
- **Moneda (ver también la sección de monedas más abajo):** PayPal no soporta GTQ. `PAYPAL_CURRENCY=USD` + `PAYPAL_RATE=7.7` (unidades de la tienda por 1 USD) convierten solo el cobro en PayPal; el checkout muestra al cliente lo que se le cobrará. **7.7 es un valor de ejemplo**: confírmalo con quien lleve las finanzas.
- `GET /api/v1/payments/config` expone al checkout qué proveedores hay, la moneda y las reglas de puntos (nunca secretos).

> **Estado de verificación:** contra el sandbox real se completó una **compra aprobada de punta a punta** (95 GTQ → US$12.34, el comprador inicia sesión y pulsa "Completar compra", la orden queda pagada con QR y puntos) y su **reembolso real** de la captura. También el rechazo seguro de pagar sin aprobar y de un id inventado. Lo único sin verificar con PayPal real es la **entrega** de un webhook (requiere URL pública).

## 5. Canje de puntos

`POST /orders` acepta `redeemPoints`: múltiplos de 10, solo miembros, hasta **la mitad** de lo que queda por pagar. **10 puntos = 1 unidad de moneda de descuento** (devuelve un 10 % de lo gastado, ya que se gana 1 punto por unidad). Los puntos se **apartan al crear la orden** (descuento condicionado al saldo: dos compras simultáneas no gastan los mismos) y se **devuelven** si la orden se cancela, expira, o se reembolsa (el reembolso además quita los ganados). Los puntos ganados se calculan sobre lo realmente pagado.

## 6. Cancelar una función reembolsa

`PATCH /showtimes/:id { status: "CANCELLED" }` liquida cada orden: las `PAID` se reembolsan en el proveedor, las `PENDING` se cancelan (butacas y puntos devueltos). Un reembolso que falle **no detiene a los demás ni revierte la cancelación**: queda en `cancellation.failed` y en la bitácora para atención manual. El estado cambia primero, así nadie compra durante la liquidación. `createOrder` ya no vende funciones canceladas.

## 7. Funciones que ya comenzaron

Se encontró que una función pasada seguía listada como programada y se podían comprar boletos para ella. Ahora el listado público las oculta y `lockSeats`/`createOrder` responden 409.

## 8. Auditoría

`recordAudit` + el middleware `auditTrail("accion", "Entidad")` (en las rutas mutantes de gestión: usuarios, cines, salas, películas, funciones, productos, promociones, personas, géneros, moderación, reembolsos y cancelaciones) guardan quién, qué, cuándo, desde qué IP y con qué datos. **Nunca guardan contraseñas ni tokens** (se redactan por nombre de campo) y solo registran si la respuesta fue exitosa. Una falla al auditar jamás tumba la operación real. `GET /api/v1/audit-logs` (solo `SUPER_ADMIN`) con filtros por entidad y acción.

## Variables de entorno nuevas

```
PAYPAL_CURRENCY=USD
PAYPAL_RATE=7.7
PAYPAL_WEBHOOK_ID=
STRIPE_WEBHOOK_SECRET=
```

## Monedas: el programa en quetzales, cada pasarela en la suya

[`currency.ts`](../../apps/backend/src/modules/payments/currency.ts) es el único lugar donde se convierte. Las órdenes, totales, descuentos y puntos están **siempre en `PAYMENT_CURRENCY` (GTQ)**; solo el **cobro** se convierte a la moneda de cada cuenta con un tipo de cambio fijo ("unidades de la tienda por 1 unidad del proveedor"):

| Proveedor | Variables | Ejemplo |
|---|---|---|
| Stripe (cuenta en pesos) | `STRIPE_CURRENCY`, `STRIPE_RATE` | `MXN`, `0.42` |
| PayPal (cuenta en dólares) | `PAYPAL_CURRENCY`, `PAYPAL_RATE` | `USD`, `7.7` |

Si un proveedor cobra en otra moneda y falta su tipo de cambio, **falla con 503 y un mensaje claro en lugar de cobrar mal**. Los reembolsos de Stripe y PayPal son **totales y sin monto**: el proveedor devuelve exactamente lo que cobró, en la moneda en que cobró, sin reconvertir. La verificación de montos (3D Secure, webhooks) compara contra el monto *convertido*.

**Verificado contra Stripe real:** una orden de Q95.00 se cobró como **226.19 MXN** (`95 / 0.42`) y el reembolso devolvió **226.19 MXN**. **Los tipos de cambio de ejemplo (0.42 y 7.7) son placeholders**: confírmalos con quien lleve las finanzas. Con un tipo de cambio fijo, la diferencia con el mercado es un riesgo del negocio; si el quetzal se mueve, hay que actualizar la variable.

## Producción (Render)

Servicio único que sirve sitio y API (`FRONTEND_DIST`), CSP que permite solo lo necesario de Stripe y PayPal, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (con el valor por defecto el navegador corta la comunicación de la ventana emergente de PayPal), y arranque que aplica migraciones, carga catálogos base y crea el primer super admin desde variables de entorno (`src/bootstrap/run.ts`). La clave publicable de Stripe se entrega en `GET /payments/config`, no se hornea en el frontend. Guía: [docs/09-despliegue-render.md](../09-despliegue-render.md).

**Verificado** con la imagen Docker de producción contra una base vacía: migraciones, administrador inicial, y compras con tarjeta, 3D Secure y PayPal sandbox (compra aprobada y reembolso reales).

