# Frontend — Módulo: Taquilla (validación de boletos)

**Fase**: 18 — Frontend taquilla · **Estado**: Construido y verificado end-to-end real · **Fecha**: 2026-08-29

Completa el módulo de backend de [docs/backend/10-validacion-boletos.md](../backend/10-validacion-boletos.md): el código QR generado en la confirmación de compra ahora se puede **validar de verdad** en la entrada de la sala.

## Qué se construyó

`pages/box-office.tsx` (`/taquilla`), accesible a `BOX_OFFICE`, `CINEMA_MANAGER` y `SUPER_ADMIN` (guardia de rol propia, **fuera** de `AdminLayout` — la taquilla no debe ver el panel administrativo completo, es la primera pantalla del proyecto pensada para el rol `BOX_OFFICE`, que hasta este módulo no tenía ningún caso de uso real).

Diseño pensado para **escaneo continuo**, no solo captura manual única: el campo de texto se autoenfoca al cargar y después de cada intento (éxito o error), para que un lector de código de barras/QR (que simula tecleo + Enter) pueda validar boleto tras boleto sin tocar el mouse. Resultado mostrado como tarjeta de confirmación (película, cine/sala, horario, butacas, nombre del comprador) o de error, según corresponda.

## Verificación realizada

- [x] `npx tsc -b --noEmit`, `npx oxlint`, `npx vite build` — limpio, sin warnings nuevos.
- [x] **Flujo completo verificado vía `curl` contra el servidor real**, con el payload y la forma de respuesta exactos que consume la página: usuario `BOX_OFFICE` valida un boleto pagado real (`200`, `checkedInAt` asignado, estructura anidada `showtime.movie`/`showtime.room.cinema`/`seats[].showtimeSeat.seat` — exactamente lo que `ValidatedTicket` espera) → reintenta el mismo código → rechazado (`409`) con la fecha/hora del primer canje. Datos de prueba limpiados.

## Decisiones de diseño

1. **Guardia de rol propia, no reutiliza `AdminLayout`** — `BOX_OFFICE` no debe navegar por reportería, catálogo ni configuración; su única pantalla es esta. Reutilizar el layout administrativo habría expuesto una superficie de navegación que ese rol no necesita ni debería ver.
2. **El header muestra "Taquilla" o "Panel de gestión" según el rol**, nunca ambos — `BOX_OFFICE` ve el primero, `SUPER_ADMIN`/`CINEMA_MANAGER` el segundo (ambos roles con acceso al panel completo también podrían validar boletos manualmente si hace falta, entrando directo a `/taquilla`).
3. **Autoenfoque después de cada intento** (no solo al cargar la página) — el caso de uso real es una fila de personas entrando a la sala, no una validación aislada; forzar un clic manual entre cada boleto sería friccionar exactamente el flujo que este módulo existe para agilizar.

## Estado del valor agregado "código QR de entrada"

Con este módulo, el código QR **deja de ser decorativo**: se genera al pagar (`docs/backend/09-pagos.md`), se muestra al cliente (`docs/frontend/01-reservas.md`), y ahora se valida de verdad en la puerta, de un solo uso. El ciclo completo del valor agregado descrito en [docs/01-requerimientos.md](../01-requerimientos.md) está cerrado.
