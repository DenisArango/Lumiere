# Frontend — Módulo: Panel de administración (fase 2 — completo)

**Fase**: 14 — Frontend panel de administración completo · **Estado**: Construido y verificado end-to-end real · **Fecha**: 2026-08-29

Completa el panel de administración con los tres módulos que quedaban pendientes de [docs/frontend/02-panel-admin.md](02-panel-admin.md): **cines/salas, funciones y promociones**. Con esto, **todos los módulos de gestión del backend tienen interfaz**.

## Qué se construyó

### Cines y salas (`/admin/cines`)
Lista de cines → detalle de cine con sus salas → formulario inline para agregar una sala nueva, reutilizando el mismo constructor de layout de butacas por fila (`components/admin/room-rows-editor.tsx`, mismo patrón que `credits-editor.tsx`: agregar fila, elegir tipo de butaca, cantidad, ver el total calculado en vivo). `totalCapacity` nunca se envía — el backend lo calcula de las filas reales, tal como está diseñado (ver [docs/backend/03-cines-salas.md](../backend/03-cines-salas.md)).

### Funciones (`/admin/funciones`)
Lista de funciones programadas + formulario de creación con selección en cascada: película → cine → sala (las salas se cargan según el cine elegido), idioma de audio (requerido) y subtítulos (opcional), fecha/hora (`datetime-local`, convertido a ISO antes de enviar), formato y precio base.

### Promociones (`/admin/promociones`)
Lista de promociones activas + formulario de creación con un **constructor de reglas** (`components/admin/promotion-rules-editor.tsx`): cada regla es "por película", "por cine" o "por día de la semana" — sin reglas, la promoción es global (mismo comportamiento ya documentado en el backend, ver [docs/backend/06-promociones.md](../backend/06-promociones.md)).

## Verificación realizada

- [x] `npx tsc -b --noEmit` — sin errores.
- [x] `npx oxlint` — limpio (mismos 3 warnings benignos ya conocidos, ninguno nuevo).
- [x] `npx vite build` — sin errores; cada página nueva del panel quedó en su propio chunk pequeño (1-11 KB), el bundle principal que descarga un cliente normal **no creció** (632 KB / 194 KB gzip, igual que en la fase anterior).
- [x] **Los cuatro flujos completos verificados vía `curl` contra el servidor real**, con el payload exacto que envía cada formulario: crear cine (`201`) → crear sala con layout de butacas por fila (`201`, `totalCapacity` calculado correctamente) → crear función con selección en cascada cine→sala (`201`) → crear promoción con regla de día de la semana (`201`). Datos de prueba limpiados al terminar.
- [ ] **Verificación visual en navegador — sigue pendiente** (sin herramienta de automatización de navegador en esta sesión).

## Decisiones de diseño

1. **Selección de sala en cascada, no un solo select plano** — el formulario de funciones pide primero el cine y recién entonces carga las salas de ese cine (`useRoomsByCinema`), en vez de mostrar todas las salas de todos los cines mezcladas — evita que el administrador tenga que adivinar a qué cine pertenece cada sala por su nombre.
2. **Lista de promociones reutiliza el endpoint público** (`GET /promotions`, que solo devuelve promociones activas y vigentes) — no existe todavía un endpoint administrativo que liste promociones inactivas/expiradas/futuras. Limitación conocida y aceptada por ahora: coincide con lo que el backend expone hoy (documentado explícitamente en la lista, no oculto).
3. **`PromotionRulesEditor` y `RoomRowsEditor` siguen el mismo patrón que `CreditsEditor`** (fase anterior) — una lista local de filas editables con un botón "agregar", consistente en todo el panel en vez de inventar un patrón de edición distinto por módulo.

## Deuda técnica / pendiente

1. **Verificación visual en navegador** (ver arriba) — otra vez.
2. **Sin edición** de cines, salas, funciones ni promociones desde la interfaz (solo creación) — el backend soporta `PATCH` en cines/salas/funciones/promociones; se agrega cuando haga falta, siguiendo el mismo patrón ya usado en la edición de películas.
3. **Sin endpoint administrativo de "todas las promociones"** (ver decisión 2) — si se necesita gestionar promociones inactivas/futuras desde el panel, hay que agregar esa variante en el backend primero.
4. **Sin cancelación de funciones desde la interfaz** — el backend soporta `PATCH /showtimes/:id { status: "CANCELLED" }`; no hay botón para eso todavía.

## Estado del panel de administración

Con este módulo, **los 5 módulos de gestión del backend tienen interfaz completa de creación**: películas, cines/salas, funciones, promociones, y el dashboard de reportería. La brecha restante (edición y borrado/archivado desde la UI, listado administrativo completo de promociones) queda documentada explícitamente arriba, no oculta.

## Siguiente paso

Con backend y frontend cubriendo el alcance funcional completo del enunciado original (RF-01 a RF-08) más el panel de administración, los pasos naturales que quedan son: verificación visual real en navegador (pendiente de esta sesión), edición/borrado en el panel, y verificación de Pagos contra credenciales sandbox reales cuando el usuario las tenga.
