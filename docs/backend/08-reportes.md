# Backend — Módulo: Reportería

**Fase**: 9 — Reportería · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

Cubre RF-08 completo: "Películas más vistas", "Horarios de mayor demanda" y "Efectividad de promociones". Con este módulo, **todo el alcance funcional del enunciado original está implementado** (quedan solo Pagos, que faltaba a propósito por depender de credenciales externas, y el frontend).

## Qué se construyó

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/api/v1/reports/most-viewed-movies` | GET | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Películas ordenadas por boletos vendidos en un rango de fechas |
| `/api/v1/reports/peak-demand` | GET | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Demanda por hora del día y por día de la semana |
| `/api/v1/reports/promotion-effectiveness` | GET | `SUPER_ADMIN`\|`CINEMA_MANAGER` | Usos, descuento otorgado e ingresos por promoción |

Todos aceptan `from`, `to` (rango de fechas, default: últimos 90 días) y `limit` (default 10, máx. 50).

## Decisiones de diseño

1. **"Más vistas" se mide en boletos vendidos reales (`OrderSeat` de órdenes `PAID`), no en visitas de página.** Es la métrica de negocio que el enunciado pide y la única que tiene sentido para "efectividad" — una película con muchas vistas de página pero pocas ventas no es realmente "la más vista" en el sentido que le importa a un cine.
2. **Reportería es exclusivamente para staff** (`SUPER_ADMIN`/`CINEMA_MANAGER`), nunca pública — es inteligencia de negocio, aplicado con `router.use()` a nivel de todo el router en vez de repetir el middleware en cada ruta.
3. **Se usa `prisma.$queryRaw` con template etiquetado, no SQL crudo concatenado.** Las agregaciones de este módulo (agrupar por `EXTRACT(HOUR FROM ...)`, contar con `LEFT JOIN` condicional) no se expresan bien con el query builder de Prisma — pero **la seguridad no se sacrifica**: el template etiquetado de `$queryRaw` parametriza automáticamente cada valor interpolado (`${from}`, `${to}`, `${query.limit}`), exactamente igual que un `PreparedStatement` — sigue siendo estructuralmente imposible inyectar SQL, ver [docs/06-seguridad.md](../06-seguridad.md).
4. **El filtro de fecha en "efectividad de promociones" vive en la condición del `LEFT JOIN`, no en un `WHERE` posterior.** Si estuviera en el `WHERE`, una promoción sin ningún uso en el rango consultado desaparecería del reporte en vez de aparecer con `timesUsed: 0` — y "esta promoción no se ha usado nada" es información tan valiosa como "esta promoción se usó 50 veces".
5. **`COUNT(...)::int` explícito en cada consulta** — Postgres devuelve `COUNT` como `bigint` por defecto, que el driver de Node representaría como `BigInt`, y `JSON.stringify` no serializa `BigInt` (lanzaría una excepción al responder la petición). El cast a `::int` evita ese problema de raíz.
6. **Horarios de mayor demanda se reporta en dos vistas** (por hora del día y por día de la semana) en vez de una sola tabla pivote hora×día — es más simple de consumir para un dashboard y responde directamente a "¿qué hora del día vende más?" y "¿qué día de la semana vende más?" por separado, que es como se suele tomar la decisión operativa real (ej. "¿abrimos más salas los viernes?" vs "¿programamos más funciones a las 8pm?").

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **75/75 tests pasan** (11 auth + 16 catálogo + 8 cines/salas + 7 funciones + 11 reservas + 7 promociones + 10 opiniones + 5 reportería).
- [x] **Datos de prueba controlados con resultado exacto verificado**: película A con 2 boletos vendidos aparece antes que película B con 1 boleto; la hora 14:00 UTC (2 boletos) supera a la hora 20:00 UTC (1 boleto); una promoción usada una vez muestra `timesUsed: 1`, `totalDiscountGranted: 25`, `totalRevenue: 175` exactos, y una promoción sin uso en el rango muestra `timesUsed: 0` (no desaparece del reporte).
- [x] RBAC verificado: `CUSTOMER` recibe `403`, sin sesión recibe `401`.
- [x] Prueba manual: servidor real arranca y todas las rutas quedan montadas sin error.

## Deuda técnica / pendiente

1. **Sin caché de reportes** — cada consulta recalcula sobre la tabla `orders`/`order_seats` en tiempo real. A este volumen es correcto; si el catálogo de órdenes crece a millones de filas, se debe considerar una tabla de agregados materializados (`REFRESH MATERIALIZED VIEW` periódico) en vez de recalcular en cada request.
2. **Sin exportación (CSV/Excel)** — los reportes se devuelven como JSON; la exportación es una decisión de UI del frontend/dashboard, no del backend.
3. **`peak-demand` no filtra por película o cine específico** — devuelve demanda agregada global. Si se necesita "horarios de mayor demanda de esta película en este cine", se puede extender con parámetros opcionales `movieId`/`cinemaId` en la cláusula `WHERE` sin cambiar la forma del reporte.

## Estado del alcance funcional original

Con este módulo, **los 8 requerimientos funcionales del enunciado (RF-01 a RF-08) están completos y verificados**:

| RF | Módulo | Estado |
|---|---|---|
| RF-01 Películas | Catálogo | ✅ |
| RF-02 Directores y actores | Catálogo | ✅ |
| RF-03 Cines y salas | Cines y salas | ✅ |
| RF-04 Funciones | Funciones | ✅ |
| RF-05 Promociones | Promociones | ✅ |
| RF-06 Opiniones | Opiniones | ✅ |
| RF-07 Venta en línea | Motor de reservas ✅ + **Pagos pendiente** (falta el cobro real) |
| RF-08 Reportería | Reportería | ✅ |

## Siguiente módulo

**Pagos** (Stripe + PayPal) — el único módulo transaccional que falta para que RF-07 esté 100% completo. Requiere credenciales sandbox del usuario (`STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`) para verificación end-to-end real contra los servidores de los proveedores — sin ellas, se puede construir y probar unitariamente la orquestación (patrón Strategy `PaymentGateway`, ver [docs/05-diagramas-uml.md](../05-diagramas-uml.md) sección 2) con un gateway simulado, pero no confirmar que la integración real funciona.
