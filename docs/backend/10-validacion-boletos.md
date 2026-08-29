# Backend — Módulo: Validación de boletos (taquilla)

**Fase**: 17 — Validación de boletos · **Estado**: Completo y verificado · **Fecha**: 2026-08-29

Cierra un vacío real y significativo: el código QR del boleto se generaba y se mostraba al cliente desde el módulo de Pagos, pero **no existía ninguna forma de validarlo en la entrada de la sala** — el valor agregado explícito "código QR de entrada, reemplaza validación manual de boletos" (ver [docs/01-requerimientos.md](../01-requerimientos.md)) nunca se construyó del lado de quien recibe al cliente. El QR era puramente decorativo hasta este módulo.

## Qué se construyó

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/tickets/validate` | POST | `BOX_OFFICE`\|`CINEMA_MANAGER`\|`SUPER_ADMIN` | Valida un código QR, lo marca como usado, devuelve los datos de la función para mostrar en taquilla |

## Cambio de schema

Se agregó `Order.checkedInAt` (`DateTime?`, `null` = no usado) — migración `20260829052240_add_order_checked_in_at`. Existe específicamente para que un mismo código QR no pueda canjearse dos veces (alguien reenvía una captura de pantalla del boleto a otra persona): la validación revisa este campo y lo asigna en la misma operación.

## Decisiones de diseño

1. **Módulo propio (`modules/tickets`), no una función más en `booking.service.ts`** — aunque opera sobre `Order`, la validación de boletos es un caso de uso distinto (personal de taquilla escaneando en la puerta, no el flujo de compra del cliente) con su propia regla de autorización (`BOX_OFFICE` incluido, a diferencia del resto de endpoints administrativos que excluyen ese rol).
2. **`BOX_OFFICE` tiene un propósito real por primera vez.** El rol existe en el modelo de datos desde la fundación del proyecto (ver [docs/03-arquitectura.md](../03-arquitectura.md)) pero hasta este módulo no había ningún endpoint que lo autorizara — era un rol "de papel". Este es el primer caso de uso que realmente lo necesita.
3. **Canje de un solo uso.** Validar un boleto ya validado responde `409` con la fecha/hora del primer canje, nunca se re-valida silenciosamente. Esto es lo que hace que el QR funcione como control de acceso real y no solo como una confirmación bonita.
4. **No se valida por `orderId`, se valida por `qrCode`** — el código que efectivamente está impreso/mostrado en el boleto del cliente, no un identificador interno.

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **100/100 tests pasan** (6 nuevos): rechazo sin autenticación, rechazo a `CUSTOMER` (RBAC), código inexistente (`404`), orden no pagada (`409`), validación exitosa marca `checkedInAt` y devuelve los datos de la función, **reutilizar el mismo boleto ya validado se rechaza** (`409`).
- [x] Migración aplicada contra Postgres real; el servidor se reinició con el cliente de Prisma regenerado y se confirmó que la ruta nueva responde (`401` sin sesión, no `404`).

## Siguiente

**Interfaz de taquilla en el frontend** — una pantalla simple para que el personal de `BOX_OFFICE` ingrese el código y vea la confirmación (película, función, butacas) o el error correspondiente.
