# Guía de la demostración al cliente

## Datos de demostración

En Render, la variable `SEED_DEMO_DATA=true` (ya viene en `render.yaml`) carga en cada arranque, **sin duplicar**:

| Qué | Cantidad |
|---|---|
| Cines / salas | 2 (Reforma, Plaza Norte) / 5 (estándar, IMAX, VIP reclinable, Dolby Atmos) |
| Películas | 26 con póster, director y reparto, de varios géneros (22 en cartelera, 4 próximamente): Harry Potter, Origen, Coco, Matrix, Avatar, Parásitos, Shrek… |
| Funciones | 105: los **próximos 7 días**, 3 por sala al día, repartidas entre todas las películas en cartelera (se renuevan solas en cada arranque) |
| Compras pagadas | ~90 repartidas en el último mes (Stripe y PayPal), con combos |
| Reseñas | 34, con "compra verificada" |
| Dulcería / promociones | 4 productos / `BIENVENIDA` (15 %), `MARTES20` (20 %, solo martes), `FAMILIA10` (Q10) |

Define `DEMO_PASSWORD` en Render (si no, la contraseña de las cuentas demo es `Lumiere2026!`). Para que se carguen: guarda las variables y espera el redespliegue.

### Cuentas

| Rol | Correo | Para qué |
|---|---|---|
| Super admin | `admin@lumiere.test` | Todo el panel: reportes, usuarios, auditoría |
| Gerente de cine | `gerente@lumiere.test` | Panel sin usuarios ni auditoría |
| Taquilla | `taquilla@lumiere.test` | Validar boletos en `/taquilla` |
| Cliente (350 puntos) | `cliente@lumiere.test` | Comprar y canjear puntos |
| Cliente (120 puntos) | `ana@lumiere.test` | Segunda cuenta |
| Cliente | `luis@lumiere.test`, `sofia@lumiere.test` | Sin club de puntos |

Tu cuenta de `BOOTSTRAP_ADMIN_EMAIL` también es super admin. Boleto fijo para probar la taquilla: **`LMR-DEMO0001`**.

> Las cuentas demo tienen contraseña conocida: úsalas para presentar y luego pon `SEED_DEMO_DATA=false` y cambia o desactiva las cuentas (Panel → Usuarios).

## Antes de presentar (10 min antes)

1. **Despierta el servicio**: abre la URL de Render (el plan gratuito se duerme y tarda ~1 min).
2. Dos ventanas: una normal (cliente) y una de incógnito (admin). Para el efecto de butacas en vivo, una tercera lado a lado.
3. Ten a mano: tarjeta `4242 4242 4242 4242` (cualquier fecha futura y CVC), `4000 0027 6000 3184` para 3D Secure, y la cuenta compradora de PayPal sandbox.
4. Comprueba que hay funciones (cartelera → una película → "Ver funciones").

## Recorrido (≈ 12 min)

**1. El cliente compra (5 min)**
1. Cartelera (sin sesión): marquesina, pestañas *En cartelera / Próximamente*. Abre una película: reparto y director (enlazan a su perfil), reseñas verificadas.
2. **Ver funciones** → elige cine y horario.
3. **Mapa de butacas**: inicia sesión como `cliente@lumiere.test`. Elige 2 butacas. *Mensaje clave:* con otra ventana en la misma función verás cómo se bloquean **en vivo**, y nadie puede comprar la misma butaca (se libera sola a los 8 min).
4. **Checkout**: agrega un combo, aplica `BIENVENIDA`, canjea puntos ("Usar el máximo"). Muestra el resumen tipo boleto y el cobro convertido (el programa en quetzales; Stripe cobra en pesos y PayPal en dólares).
5. Paga con tarjeta → **confirmación con QR** → *Mis boletos* (puntos sumados).
6. (Opcional, impresiona) repite con `4000 0027 6000 3184` y pulsa **COMPLETE** (3D Secure), o paga con **PayPal**.

**2. La taquilla (1 min)**
Cierra sesión → entra como `taquilla@lumiere.test` → `/taquilla`. Valida `LMR-DEMO0001` (válido) y **otra vez** (rechazado: un solo uso). Luego valida el código del boleto que compraste.

**3. El administrador (5 min)** — entra como `admin@lumiere.test`
1. **Reportería**: películas más vistas, horarios de mayor demanda, efectividad de promociones (hay un mes de datos).
2. **Órdenes**: reembolsa una (confirmación) → la butaca vuelve a estar disponible.
3. **Funciones / Cines / Promociones / Dulcería**: edita un precio, crea una promoción con regla "solo martes".
4. **Reseñas**: oculta una (moderación).
5. **Usuarios**: crea una cuenta de taquilla.
6. **Auditoría**: aparece todo lo que acabas de hacer, con quién y cuándo.

## Mensajes para el cierre

- **No hay doble venta** aunque dos personas compren a la vez (bloqueo atómico + tiempo real).
- **Seguridad en las 3 capas**: contraseñas con Argon2, sesiones en cookies protegidas, CSRF, límites de intentos, nunca se guardan datos de tarjeta, montos verificados en el servidor.
- **Pagos reales de punta a punta**: tarjeta, 3D Secure, PayPal, reembolsos, webhooks, conversión de moneda.
- **Probado**: más de 150 pruebas automáticas y una colección de pruebas de la API.
- Se puede lanzar tal cual: un solo servicio en la nube.

## Si algo falla en vivo

| Síntoma | Qué hacer |
|---|---|
| Página lenta al inicio | El servicio gratuito se estaba despertando; espera 1 minuto |
| No hay funciones | Reinicia el servicio (Manual Deploy → Deploy latest commit): las funciones se renuevan al arrancar |
| El pago con PayPal no abre | Revisa que el navegador no bloquee ventanas emergentes |
| "Demasiadas solicitudes" | Espera 15 min o revisa `TRUST_PROXY` (ver guía de despliegue) |
