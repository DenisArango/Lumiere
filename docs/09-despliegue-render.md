# Despliegue en Render

Guía paso a paso para publicar Lumière en [Render](https://render.com). El despliegue se **probó localmente** con la misma imagen Docker que usará Render: se arrancó contra una base completamente vacía (migraciones + datos base + primer administrador) y se hicieron compras reales con tarjeta, 3D Secure y PayPal (sandbox) dentro del contenedor de producción.

## Cómo queda armado

Un solo **servicio web** (Docker) que entrega el sitio y la API desde el mismo dominio, más una **base PostgreSQL** y un **Redis (Key Value)**. Un solo servicio significa un solo dominio: las cookies de sesión, la protección CSRF y los websockets de las butacas en vivo funcionan sin configuración extra.

```
Navegador ──https──▶ Render (servicio "lumiere": Express)
                       ├─ /            sitio React (archivos compilados)
                       ├─ /api/v1/...  API
                       └─ /socket.io   butacas en vivo
                       │            │
                  PostgreSQL     Redis (Key Value)
```

El archivo [`render.yaml`](../render.yaml) (Blueprint) describe los tres recursos; el [`Dockerfile`](../Dockerfile) construye todo. Al arrancar, cada despliegue ejecuta: migraciones → datos base + primer administrador (idempotente) → servidor.

## Antes de empezar

1. **El código debe estar en GitHub.** Tu remoto es `https://github.com/DenisArango/Lumiere.git`. Haz commit y push de los cambios pendientes a la rama `master` (Render despliega desde ahí).
2. Una cuenta en [render.com](https://dashboard.render.com) conectada a tu GitHub.
3. Tus claves de pruebas a la mano: Stripe (`pk_test_…` y `sk_test_…`) y PayPal **sandbox** (Client ID y Secret).

## Paso 1: crear el Blueprint

1. Dashboard de Render → **New +** → **Blueprint**.
2. Elige el repositorio `DenisArango/Lumiere` y la rama `master`.
3. Render lee `render.yaml` y muestra tres recursos: `lumiere-db` (PostgreSQL), `lumiere-redis` (Key Value) y `lumiere` (web).
4. Te pide los valores de las variables marcadas `sync: false` (los secretos). Complétalas:

| Variable | Qué poner |
|---|---|
| `STRIPE_PUBLISHABLE_KEY` | tu `pk_test_…` |
| `STRIPE_SECRET_KEY` | tu `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | déjala vacía por ahora (paso 4) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | las de **sandbox** |
| `PAYPAL_WEBHOOK_ID` | vacía por ahora (paso 4) |
| `CORS_ORIGIN` | vacía por ahora (paso 2) |
| `BOOTSTRAP_ADMIN_EMAIL` | el correo de tu primer super administrador |
| `BOOTSTRAP_ADMIN_PASSWORD` | una contraseña fuerte (mínimo 8, con mayúscula, minúscula y número) |

5. **Apply**. El primer despliegue tarda unos 5–10 minutos (instala dependencias y compila).

`JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` los **genera Render** solos (aleatorios y fuertes).

## Paso 2: fijar la URL pública

Cuando termine, Render te da una URL como `https://lumiere-xxxx.onrender.com`.

1. Servicio `lumiere` → **Environment** → `CORS_ORIGIN` = esa URL (sin `/` final) → **Save**. Se redespliega solo.
2. Abre la URL: debes ver la cartelera. Entra a `/iniciar-sesion` con el correo y la contraseña del paso 1 y verás el **Panel de gestión** en el menú de cuenta.
3. Por seguridad, **borra `BOOTSTRAP_ADMIN_PASSWORD`** de las variables (ya no se usa mientras exista un super administrador).

## Paso 3: cargar contenido

La base nace vacía (solo con idiomas, clasificaciones, géneros y tipos de butaca). Desde el panel: crea el **cine y sus salas** (con el mapa de butacas), las **películas** y las **funciones**, y los combos de dulcería.

> Para una **demostración**, `SEED_DEMO_DATA=true` (ya viene en `render.yaml`) carga cines, películas, funciones, compras y reseñas de ejemplo y 7 cuentas demo: ver [la guía de la demostración](10-guia-demo-cliente.md). Las cuentas demo tienen contraseña conocida; para uso real pon `SEED_DEMO_DATA=false`.

## Paso 4: webhooks (necesitan la URL pública)

**Stripe**
1. [Dashboard de Stripe](https://dashboard.stripe.com/test/webhooks) (modo prueba) → **Add endpoint**.
2. URL: `https://TU-URL.onrender.com/api/v1/webhooks/stripe`.
3. Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`.
4. Copia el **Signing secret** (`whsec_…`) a `STRIPE_WEBHOOK_SECRET` en Render.

**PayPal**
1. [developer.paypal.com](https://developer.paypal.com) → tu app (Sandbox) → **Webhooks** → **Add Webhook**.
2. URL: `https://TU-URL.onrender.com/api/v1/webhooks/paypal`.
3. Eventos: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.DENIED`.
4. Copia el **Webhook ID** a `PAYPAL_WEBHOOK_ID` en Render.

Sin estas dos variables las rutas de webhooks responden 503 (nunca aceptan eventos sin verificar).

## Paso 5: probar el flujo

1. Compra con la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura y CVC).
2. 3D Secure: `4000 0027 6000 3184` → pulsa COMPLETE.
3. PayPal con tu cuenta compradora de sandbox.
4. En el panel → **Órdenes**: reembolsa una; en **Auditoría** verás el registro.

## Moneda

El programa trabaja en **quetzales (GTQ)**. Cada pasarela cobra en la moneda de tu cuenta con un **tipo de cambio fijo** que tú defines:

| Variable | Significado | Valor de ejemplo |
|---|---|---|
| `PAYMENT_CURRENCY` | moneda de la tienda | `GTQ` |
| `STRIPE_CURRENCY` / `STRIPE_RATE` | Stripe cobra en pesos mexicanos | `MXN` / `0.42` (quetzales por 1 peso) |
| `PAYPAL_CURRENCY` / `PAYPAL_RATE` | PayPal cobra en dólares | `USD` / `7.7` (quetzales por 1 dólar) |

**Los tipos de cambio de ejemplo son placeholders**: confírmalos con quien lleve las finanzas y actualízalos cuando cambien (es una variable, no hace falta tocar código). El checkout le muestra al cliente lo que realmente se le cobrará en cada moneda.

## Limitaciones del plan gratuito (importante)

- **El servicio web gratuito se duerme** tras ~15 minutos sin tráfico y tarda ~1 minuto en despertar. Las butacas en vivo y los bloqueos funcionan, pero la primera visita después de un rato será lenta.
- **La base de datos gratuita de Render se elimina a los 30 días.** Sirve para una demostración o la presentación; para algo que deba durar, cambia `plan: free` por un plan de pago en `lumiere-db` (por ejemplo `basic-256mb`) y en `lumiere` (`starter`).
- El Redis gratuito es pequeño y volátil: perderlo solo libera bloqueos de butacas y reinicia los contadores de límite de peticiones; no pierde ventas.

## Pasar a producción real (cuando llegue el momento)

1. Claves **live** de Stripe (`pk_live_…`/`sk_live_…`) y un webhook nuevo en modo live.
2. PayPal: credenciales **live** y `PAYPAL_ENV=live`; webhook en la app live.
3. Revisar los tipos de cambio y, si tu cuenta de Stripe cobra en otra moneda, `STRIPE_CURRENCY`.
4. Dominio propio: servicio → **Settings → Custom Domains**; actualiza `CORS_ORIGIN`.
5. Planes de pago para la base de datos y el servicio.

## Si algo falla

- **Logs:** servicio `lumiere` → **Logs**. El arranque imprime las migraciones aplicadas, "Datos de referencia listos" y "Lumiere API escuchando".
- **"No hay super administrador… nadie podrá entrar":** falta `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` en el primer despliegue. Agrégalas y redespliega.
- **"BOOTSTRAP_ADMIN_PASSWORD no cumple la política":** usa 8+ caracteres con mayúscula, minúscula y número.
- **"Demasiadas solicitudes":** el límite por IP depende de `TRUST_PROXY` (por defecto 1, el valor de Render). Si todos los usuarios parecen compartir una IP, revisa ese valor.
- **El pago con tarjeta no aparece:** falta `STRIPE_PUBLISHABLE_KEY` o `STRIPE_SECRET_KEY`.
- **PayPal no aparece:** faltan `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`, o son de otro entorno (sandbox vs live).

## Nota de seguridad que conviene conocer

La política de seguridad de contenido (CSP) de producción permite solo lo que el checkout necesita de Stripe y PayPal. El SDK de PayPal intenta ejecutar un script en línea que la CSP bloquea y deja un aviso en la consola del navegador; **no impide el pago** (se verificó una compra completa). No se relajó la CSP con `unsafe-inline` para scripts a propósito.
