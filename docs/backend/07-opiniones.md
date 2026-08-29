# Backend — Módulo: Opiniones

**Fase**: 8 — Opiniones · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

Cubre RF-06 ("Opiniones: Registro de reseñas y calificaciones de usuarios") y el valor agregado de "reseñas verificadas" definido en [docs/01-requerimientos.md](../01-requerimientos.md).

## Qué se construyó

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/movies/:movieId/reviews` | GET | público | Lista reseñas aprobadas de una película, paginado |
| `/api/v1/movies/:movieId/reviews` | POST | autenticado | Crea reseña (rating 1-5 + comentario opcional); calcula `isVerifiedPurchase` |
| `/api/v1/reviews/:id` | PATCH | dueño | Edita la propia reseña |
| `/api/v1/reviews/:id/moderate` | PATCH | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Aprueba/oculta una reseña |
| `/api/v1/reviews/:id` | DELETE | dueño o staff | Elimina una reseña |
| `/api/v1/movies/:id` (existente) | GET | público | Ahora incluye `averageRating` y `reviewCount` calculados |

## Decisiones de diseño

1. **`isVerifiedPurchase` se calcula en el servidor, nunca se recibe del cliente**: se verifica si el usuario tiene al menos una `Order` en estado `PAID` de una función de esa película (`prisma.order.findFirst`). Ver el valor agregado explícito en los requerimientos: "reseñas verificadas... da credibilidad real, la mayoría de sitios no valida esto".
2. **Una reseña por usuario por película** (constraint `@@unique([userId, movieId])` ya existía en el schema desde la fase de fundación) — crear una segunda se rechaza con `409` sugiriendo editar la existente en vez de crear otra.
3. **Moderación como campo (`isApproved`), no como cola separada**: una reseña nace `isApproved: true` (no bloqueante para el usuario) y el staff puede ocultarla si es necesario (spam, contenido inapropiado). Se evitó construir una cola de moderación previa a publicación porque no hay evidencia de que el volumen del proyecto la necesite todavía — se puede añadir después sin romper el modelo actual.
4. **`averageRating`/`reviewCount` se calculan con `prisma.review.aggregate`** en cada consulta del detalle de película, no se cachean — mismo criterio de costo/beneficio que `availableSeats` en Funciones (ver [docs/backend/04-funciones.md](04-funciones.md)).
5. **El listado de un `GET /movies/:movieId/reviews` solo muestra `isApproved: true`** — una reseña oculta por moderación desaparece de la vista pública sin necesidad de borrarla (se conserva para auditoría/apelación).

## Cómo se probó "compra verificada" sin que exista el módulo de Pagos todavía

El módulo de Pagos (que marca una orden como `PAID`) todavía no se ha construido — depende de credenciales sandbox de Stripe/PayPal que el usuario debe proporcionar (ver nota en [docs/backend/06-promociones.md](06-promociones.md)). Para probar la lógica de verificación de compra de forma honesta, el test crea una `Order` con `status: "PAID"` **directamente vía Prisma** (simulando el resultado que el módulo de Pagos producirá), no a través de un endpoint HTTP inexistente. Esto prueba correctamente la lógica de `hasVerifiedPurchase`, y **deja de ser una simulación en cuanto exista el módulo de Pagos real** — no hay nada que reescribir en este módulo cuando eso pase.

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **70/70 tests pasan** (11 auth + 16 catálogo + 8 cines/salas + 7 funciones + 11 reservas + 7 promociones + 10 opiniones).
- [x] Verificado end-to-end: una usuaria con orden `PAID` real de la película recibe `isVerifiedPurchase: true`; otra sin compra recibe `false` — en la misma corrida, contra los mismos datos.
- [x] `averageRating`/`reviewCount` verificados con valores reales: dos reseñas (5 y 3) dan `averageRating: 4`, `reviewCount: 2`.
- [x] RBAC de moderación verificado: `CUSTOMER` recibe `403` al intentar moderar, `SUPER_ADMIN` sí puede, y la reseña oculta desaparece del listado público inmediatamente.

## Deuda técnica / pendiente

1. **Sin límite de longitud de comentario más allá de 2000 caracteres ni filtro de contenido ofensivo automático** — moderación es manual (`isApproved`) por ahora; un filtro automático (o de IA, ver `docs/01-requerimientos.md` sección de IA) es candidato de V2, no V1.
2. **Sin notificación al usuario cuando su reseña es ocultada** — se agregará junto con el sistema de notificaciones/email cuando exista un proveedor configurado.
3. **El promedio no distingue por función/sala/cine**, es un promedio global de la película — correcto para el alcance de RF-06 tal como está redactado.

## Siguiente módulo

**Pagos** (Stripe + PayPal) — con Auth, Catálogo, Cines/Salas, Funciones, Reservas, Promociones y Opiniones completos, este es el único módulo transaccional central que falta, y **requiere credenciales sandbox del usuario** para verificación end-to-end real (ver nota detallada en [docs/backend/06-promociones.md](06-promociones.md)).

Después de Pagos, solo queda **Reportería** (RF-08: películas más vistas, horarios de mayor demanda, efectividad de promociones) para completar el alcance funcional del backend definido en el enunciado original.
