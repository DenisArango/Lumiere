# Frontend — Módulo: Opiniones

**Fase**: 15 — Frontend opiniones · **Estado**: Construido y verificado end-to-end real · **Fecha**: 2026-08-29

Cierra un vacío real: el backend de RF-06 (Opiniones) estaba completo y probado desde hace varias fases, pero **no tenía ninguna representación en el frontend** — nadie podía ver ni dejar una reseña desde la app.

## Qué se construyó

`components/reviews-section.tsx`, integrado al final de la página de detalle de película:
- Lista de reseñas con calificación en estrellas, nombre del autor (apellido abreviado por privacidad), insignia de **compra verificada** cuando aplica, y fecha relativa ("hoy", "hace 3 días").
- Si el usuario no ha iniciado sesión: invitación a iniciar sesión, sin formulario.
- Si el usuario ya dejó una reseña: se muestra con opciones de editar/eliminar en vez de un formulario de creación duplicado (el backend rechaza una segunda reseña del mismo usuario para la misma película con `409` — el frontend evita ofrecer una acción que sabe que va a fallar).
- `components/star-rating.tsx`: input de calificación (hover preview) y versión de solo lectura, reutilizados en toda la sección.

## Verificación realizada

- [x] `npx tsc -b --noEmit`, `npx oxlint`, `npx vite build` — todo limpio, sin warnings nuevos.
- [x] **Flujo completo verificado vía `curl` contra el servidor real**: crear reseña (`201`) → listar reseñas de la película (formato exacto que consume `ReviewsSection`, incluye el `user` anidado) → editar la propia reseña (`200`) → eliminar la propia reseña (`204`). Datos de prueba limpiados.

## Decisiones de diseño

1. **Apellido abreviado a la inicial** en la lista pública (`Reviewer S.` en vez de `Reviewer Smoke`) — un detalle de privacidad razonable que el backend no impone (devuelve el nombre completo), aplicado en la capa de presentación.
2. **Sin paginación de reseñas todavía** (`pageSize: 20` fijo) — suficiente para el volumen esperado en esta fase; se agregará "cargar más" si una película acumula muchas reseñas.

## Siguiente

Con esto, **los 8 requerimientos funcionales del enunciado tienen representación completa tanto en backend como en frontend**. Sigue: módulo de combos de dulcería (el backend nunca expuso un endpoint de gestión de `Product`, a pesar de que `createOrder` ya acepta `items` — vacío real encontrado al revisar qué falta).
