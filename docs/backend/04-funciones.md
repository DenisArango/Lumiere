# Backend — Módulo: Funciones

**Fase**: 5 — Funciones · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

Cubre RF-04 del enunciado original ("Funciones: Horarios y salas asignadas"). Es el módulo bisagra hacia el futuro motor de reservas: aquí nace `ShowtimeSeat`, la entidad sobre la que se construirá el bloqueo de asientos.

## Qué se construyó

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/showtimes` | GET | público | Lista funciones programadas, filtros por película/cine/sala/fecha, incluye `availableSeats` por función |
| `/api/v1/showtimes/:id` | GET | público | Detalle completo (película, sala, cine, idiomas) + conteo de butacas disponibles |
| `/api/v1/showtimes` | POST | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Crea función: calcula `endTime`, valida cruce de horario, **materializa el mapa de butacas de la función** |
| `/api/v1/showtimes/:id` | PATCH | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Actualiza precio base o estado (ej. cancelar) |

## Decisiones de diseño

1. **`endTime` se calcula, nunca se recibe del cliente**: `startTime + duración de la película + 20 minutos de turnaround` (limpieza/tráilers entre funciones, constante `ROOM_TURNAROUND_MINUTES`). Si se aceptara `endTime` como input, un cliente podría programar funciones más cortas que la película real.
2. **Validación de cruce de horario por sala**: antes de crear una función se busca cualquier función `SCHEDULED` en la misma sala cuyo rango `[startTime, endTime)` se solape con el nuevo. Una sala física no puede proyectar dos funciones a la vez — esto es una regla de negocio real, no solo una validación de formulario. Verificado en test: una segunda función que empieza 30 minutos después de la primera (que dura 120 min con turnaround) es rechazada con `409`; una que empieza después del turnaround completo sí se permite.
3. **Cancelar una función (`status: CANCELLED`) libera el horario automáticamente**: como la validación de cruce solo considera funciones `SCHEDULED`, una función cancelada deja de bloquear la sala sin necesidad de lógica adicional — verificado en test.
4. **`ShowtimeSeat` se genera de una sola vez, en la creación de la función**, copiando cada butaca física (`Seat`) de la sala con estado `AVAILABLE`. Esta es la pieza central que el diagrama de secuencia de compra ([docs/05-diagramas-uml.md](../05-diagramas-uml.md)) asume que ya existe antes de que un cliente pueda seleccionar un asiento — el motor de reservas (próximo módulo) solo necesita cambiar el `status` de estas filas, nunca crearlas.
5. **`availableSeats` se calcula en cada consulta** (`count` sobre `ShowtimeSeat` con `status: AVAILABLE`), no se cachea — a este volumen (cientos de butacas por función) el costo es despreciable; se revisará si se vuelve un cuello de botella real con tráfico.

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **42/42 tests pasan** (11 auth + 16 catálogo + 8 cines/salas + 7 funciones): función en el pasado rechazada, creación materializa exactamente el número de butacas de la sala, cruce de horario rechazado, horario después del turnaround permitido, filtro por película, cancelación libera el horario.
- [x] Prueba manual contra el servidor real: `GET /showtimes` responde paginado correctamente.

## Deuda técnica / pendiente

1. **Sin reprogramación de horario/sala** (`PATCH` solo permite precio y estado) — mover una función a otro horario/sala una vez que puede tener asientos bloqueados o vendidos es una operación sensible que se deja fuera de alcance hasta que exista el motor de reservas y se pueda razonar sobre qué pasa con las reservas existentes.
2. **Filtro de fecha usa límites UTC**, no zona horaria del cine — aceptable para esta fase; se debe revisar cuando el frontend defina en qué zona horaria se muestran los horarios al usuario final.
3. **Sin límite de funciones futuras por sala** (alguien podría programar 500 funciones de una vez) — no es un riesgo real todavía porque la creación es uno-a-uno vía formulario administrativo, no bulk.

## Siguiente módulo

**Motor de reservas** — selección de asientos con bloqueo temporal (Redis + Socket.io), el corazón de "Venta en línea" (RF-07). Este es el módulo más sensible a condiciones de carrera del proyecto; el diseño ya está documentado en el diagrama de secuencia de [docs/05-diagramas-uml.md](../05-diagramas-uml.md).
