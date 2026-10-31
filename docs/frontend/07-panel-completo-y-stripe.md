# Panel de administración completo, perfil público de personas y checkout con Stripe

## Panel de administración

Navegación agrupada por la pregunta que responde cada sección (`AdminLayout`): Resumen · Programación · Ventas · Comunidad.

| Pantalla | Ruta | Qué permite |
|---|---|---|
| Órdenes | `/admin/ordenes` | Filtrar por estado, **reembolsar** (con confirmación). |
| Reseñas | `/admin/resenas` | **Moderar**: ocultar/mostrar. |
| Usuarios | `/admin/usuarios` | Crear cuentas de personal, cambiar rol, desactivar. Solo `SUPER_ADMIN`. |
| Personas y géneros | `/admin/catalogo` | Editar directores/actores, crear géneros. |
| Cines | `/admin/cines/:id/editar` | Editar, **desactivar/reactivar** cines; editar nombre y tipo de salas. |
| Funciones | `/admin/funciones` | Editar precio, **cancelar** (con confirmación y aviso de reembolsos). |
| Promociones | `/admin/promociones/:id/editar` | Editar, desactivar/reactivar; estado visible (vigente, vencida, programada). |
| Dulcería | `/admin/productos/:id/editar` | Editar, retirar/reactivar. |

Piezas reutilizables: `ConfirmDialog` (toda acción destructiva pide confirmación), `Badge`, `PageHeader`, `Pagination`, `lib/format.ts` (moneda y fechas con `Intl`).

## Área pública

- `/personas/:id`: perfil de director/actor con filmografía y cantidad de películas (RF-02). Los nombres en el detalle de película enlazan aquí.
- Página 404 real (reemplaza al placeholder "en construcción").
- "Mis boletos" incluye la tarjeta **Lumière Club** (unirse y ver puntos); el menú de cuenta muestra los puntos.
- La confirmación de compra ya no promete un correo que el sistema no envía.
- Portada: el hero sin imagen de fondo usa el póster enmarcado y el **haz de proyector** (`.projector-beam`).

## Checkout con Stripe

- `CheckoutPage` envuelve el contenido en `<Elements>`; el `CardElement` tokeniza la tarjeta en el navegador **antes** de crear la orden (un error de tarjeta no deja órdenes colgadas).
- Variables (`apps/frontend/.env.local`, ignorado por git; ver `.env.example`): `VITE_STRIPE_PUBLISHABLE_KEY` (clave **publicable** `pk_...`) y `VITE_CURRENCY` (por defecto `GTQ`, igual que `PAYMENT_CURRENCY` del backend).
- Sin la clave, el checkout lo avisa y desactiva el pago. En modo prueba (`pk_test_`) muestra la tarjeta `4242 4242 4242 4242`.

## Bugs encontrados y corregidos

- **Checkout imposible de completar en desarrollo**: `useEffectOnUnmount` ejecutaba la liberación de butacas en el desmontaje de prueba de React `StrictMode`, y la orden fallaba con 409. Ahora solo cuenta un desmontaje real.
- **Moneda inconsistente**: el checkout mostraba GTQ y el backend cobraba `"USD"` fijo. Ahora es una sola configuración en ambos lados.
- Butacas sin nombre accesible: ahora tienen `aria-label` y `aria-pressed`.

## Actualización: checkout con 3D Secure, PayPal y puntos; auditoría

- **Checkout rediseñado** en dos columnas con el resumen como talón de boleto (con perforación) fijo a la derecha, donde están siempre el total y el botón de pago.
- La lógica de compra vive en `useCheckoutPayment`: la orden se crea **una vez** y se reutiliza si el pago falla (antes cada clic creaba otra y la segunda fallaba). Mientras existe, la compra queda congelada porque el servidor ya fijó el total; "Editar compra" la cancela y vuelve a bloquear las butacas.
- **3D Secure:** `payOrder` puede devolver una acción; se completa con `stripe.handleNextAction` y se confirma con el servidor.
- **PayPal:** los botones (`@paypal/react-paypal-js`) piden al **servidor** crear la orden de PayPal y, al aprobar, el servidor captura. El Client ID y la moneda llegan de `GET /payments/config` (no hay variable VITE). Si PayPal cobra en otra moneda, se muestra el monto convertido.
- **Código de promoción** con botón "Aplicar" (valida y muestra el descuento estimado) y **canje de puntos** ("Usar el máximo").
- Pantalla **Auditoría** (`/admin/auditoria`, solo super admin) y resumen al cancelar una función (cuántas órdenes se reembolsaron y cuáles fallaron).
- **Diseño y accesibilidad** (revisión con taste-skill y Web Interface Guidelines): el encabezado se salía de la pantalla en móvil y no había navegación (los enlaces solo existían desde `md`); texto de 10–12 px subido a 13 px (`--text-xs`); el menú de cuenta no mostraba el foco de teclado; las animaciones de `motion` ignoraban `prefers-reduced-motion` (`MotionConfig reducedMotion="user"`); enlace "Saltar al contenido"; `touch-action: manipulation`; el hero de la portada y el detalle usan el haz de proyector. Decisión consciente: se **conservan** las etiquetas tipo crédito, las líneas finas, el haz dorado y el marfil cálido que el inspector señala como "genéricos", porque son la identidad definida en `docs/00-brand-lumiere.md`.

