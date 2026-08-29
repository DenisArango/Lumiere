# Lumière — Documento núcleo del proyecto

> Este archivo es el punto de entrada para cualquier sesión de trabajo (humana o IA) sobre este proyecto. Contiene las instrucciones originales como núcleo inmutable y enlaza toda la documentación derivada. Si en algún momento hay una contradicción entre este documento y una decisión posterior, este documento gana salvo que el usuario indique explícitamente lo contrario.

## 1. Qué es Lumière

**Lumière** es un portal web profesional de gestión de cartelera de cine: catálogo de películas, funciones, salas, promociones, reseñas y venta de boletos en línea con selección de asientos y pago (Stripe / PayPal).

El nombre honora a los hermanos Lumière, inventores del cinematógrafo (1895). La marca se posiciona como *"donde nació la experiencia de ver historias en pantalla"* — luz atravesando la oscuridad, el origen mismo del cine. Ver [docs/00-brand-lumiere.md](docs/00-brand-lumiere.md) para la identidad completa.

**Convención de nombres**: en código, configuración, paquetes y URLs se usa siempre `lumiere` (sin diacríticos, minúsculas). En cualquier material de marca, UI visible al usuario, documentación de presentación o comunicación, se usa **Lumière** (con tilde y mayúscula inicial).

## 2. Instrucciones originales del usuario (núcleo — no modificar)

- Este **no es un proyecto universitario para salir del paso**: es un proyecto que debe poder lanzarse de verdad, con calidad de producto real.
- Los tres módulos (backend, frontend, base de datos) deben tener **buenas prácticas, buena estructura de código, y seguridad en las 3 capas**.
- API **RESTful**, con todos los protocolos de seguridad necesarios.
- Stack obligatorio: **Node.js + Express** (backend), **PostgreSQL** (base de datos), **React** (frontend). Se permite y se espera agregar tecnologías adicionales (librerías, herramientas, servicios) cuando sea necesario para lograr el nivel de profesionalismo pedido — no hay que limitarse al mínimo.
- El sitio debe tener **personalidad visual real**, no un diseño genérico repetido: paleta de colores con sentido de marca, buenas animaciones, presentación de nivel producto real.
- Debe existir **modo claro/oscuro** y el sitio debe ser **responsive**.
- Al terminar cada pieza nueva de trabajo, se debe **mantener actualizada la documentación** (`.md`) correspondiente, para que retomar el proyecto en otra sesión sea fácil. Este archivo (`PROJECT.md`) se mantiene como el índice y núcleo permanente.
- Se debe analizar qué funcionalidades adicionales (inspiradas en carteleras de cine reales/famosas) elevan el proyecto más allá del enunciado mínimo, y agregarlas donde tengan sentido.

## 3. Alcance funcional

### 3.1 Requerimientos del enunciado original
Ver detalle completo en [docs/01-requerimientos.md](docs/01-requerimientos.md). Resumen:
- Películas (info completa, reparto, directores)
- Directores y actores (datos + cantidad de películas)
- Cines y salas (capacidad de butacas)
- Funciones (horarios y salas)
- Promociones (descuentos por función)
- Opiniones (reseñas y calificaciones)
- Venta en línea (selección de asientos, pago Stripe/PayPal)
- Reportería: películas más vistas, horarios de mayor demanda, efectividad de promociones

### 3.2 Valor agregado definido para Lumière
Ver justificación completa en [docs/01-requerimientos.md](docs/01-requerimientos.md#valor-agregado). Resumen:
- Salas especiales (IMAX, VIP, 4DX, Dolby Atmos) y tipos de butaca (estándar, VIP, reclinable, silla de ruedas)
- Bloqueo temporal de asientos en tiempo real (evita doble venta — problema real de concurrencia)
- Combos de dulcería vinculados a la orden
- Próximos estrenos con notificación de disponibilidad
- Reseñas verificadas (solo compradores confirmados)
- Programa de puntos/membresía simple
- Roles múltiples: cliente, taquilla, gerente de cine, super-admin
- Código QR de entrada
- IA con propósito: recomendaciones personalizadas, búsqueda semántica, insights de reseñas para el dashboard (ver sección de IA en requerimientos)
- Accesibilidad como requisito de primera clase (WCAG AA)

## 4. Decisiones de arquitectura y stack

Detalle completo en [docs/03-arquitectura.md](docs/03-arquitectura.md). Resumen de decisiones ya tomadas:

| Capa | Tecnología | Razón breve |
|---|---|---|
| Backend | Node.js + Express + TypeScript | Requisito + tipado end-to-end |
| ORM / BD | Prisma + PostgreSQL | Migraciones versionadas, tipado generado, previene SQLi por diseño |
| Cache / locks / colas | Redis + BullMQ | Bloqueo temporal de asientos, rate-limit, jobs en background |
| Tiempo real | Socket.io | Mapa de butacas en vivo |
| Auth | JWT (access + refresh) en cookies httpOnly + Argon2 | Seguridad, sin tokens en localStorage |
| Pagos | Stripe SDK + PayPal SDK | Ambos pedidos explícitamente por el usuario |
| Frontend | React + Vite + TypeScript | Requisito + DX moderna |
| Estilos / UI | Tailwind CSS + shadcn/ui (Radix) | Accesibilidad real + personalidad de marca sin reinventar componentes base |
| Animación | Framer Motion | Transiciones cinematográficas de marca |
| Estado | Zustand + TanStack Query | Separación estado cliente / estado servidor |
| Monorepo | pnpm workspaces (Node 22 LTS) | `apps/backend`, `apps/frontend`, `docs/` |
| Contenedores | Docker + docker-compose | Entorno reproducible (Postgres + Redis + backend) |

## 5. Metodología

Scrum ligero adaptado a un equipo de una persona + asistente IA, con documentación formal (backlog, definition of done, sprints cortos). Diagramas en UML + C4 usando Mermaid (versionable en git). Detalle en [docs/02-metodologia.md](docs/02-metodologia.md).

## 6. Orden de construcción (evita retrabajo)

La fundación (schema completo de BD, contratos de API, sistema de diseño) se construye **completa desde el inicio** porque un cambio ahí obliga a retrabajar todo lo que dependa de ella. Los módulos de funcionalidad se construyen como **slices verticales** (backend + frontend + doc de ese módulo, de punta a punta) en este orden:

1. **Fundación** — schema BD completo, monorepo, sistema de diseño, docs base ← *fase actual*
2. Auth + RBAC (cliente / taquilla / gerente / super-admin)
3. Catálogo (películas, géneros, directores/actores)
4. Cines y salas
5. Funciones
6. Motor de reservas (mapa de asientos + bloqueo temporal)
7. Pagos (Stripe/PayPal + órdenes)
8. Promociones
9. Opiniones/reseñas
10. Reportería y dashboard
11. IA (recomendaciones, búsqueda semántica, insights)
12. Hardening final (accesibilidad, performance, seguridad, despliegue)

## 7. Índice de documentación

- [docs/00-brand-lumiere.md](docs/00-brand-lumiere.md) — Identidad de marca, paleta, tipografía, tono
- [docs/01-requerimientos.md](docs/01-requerimientos.md) — Requerimientos funcionales y no funcionales, valor agregado, IA
- [docs/02-metodologia.md](docs/02-metodologia.md) — Metodología de trabajo y artefactos
- [docs/03-arquitectura.md](docs/03-arquitectura.md) — Arquitectura, diagramas C4, decisiones técnicas
- [docs/04-modelo-datos.md](docs/04-modelo-datos.md) — Diagrama ER y diccionario de datos
- [docs/05-diagramas-uml.md](docs/05-diagramas-uml.md) — Casos de uso, clases, secuencia
- [docs/06-seguridad.md](docs/06-seguridad.md) — Seguridad en las 3 capas
- [docs/07-guia-presentacion.md](docs/07-guia-presentacion.md) — Preguntas esperadas en la presentación y cómo responderlas (incluye recomendaciones de dónde publicar esta documentación)
- `docs/backend/<modulo>.md` — Documentación por módulo del backend (se crea al completar cada módulo)
- `docs/frontend/<modulo>.md` — Documentación por módulo del frontend (se crea al completar cada módulo)

## 8. Estado actual del proyecto

**Fase activa**: 1 — Fundación (backend base + BD + documentación inicial)

**Última actualización**: 2026-08-29

**Fase 1 — Fundación**: completa y verificada ([docs/backend/00-foundation.md](docs/backend/00-foundation.md))
- [x] Estructura de repo (monorepo pnpm workspaces, Node 22 LTS)
- [x] Documentación fundacional (marca, requerimientos, metodología, arquitectura, modelo de datos, UML, seguridad)
- [x] Schema Prisma completo + migración inicial **aplicada contra Postgres real**
- [x] Esqueleto backend (Express + TS + middlewares de seguridad + config)
- [x] Docker Compose (Postgres 16 en puerto 5433 + Redis 7) — corriendo y verificado
- [x] Seed de datos de referencia ejecutado

**Fase 2 — Auth + RBAC**: completa y verificada ([docs/backend/01-auth.md](docs/backend/01-auth.md))
- [x] Registro, login, refresh con rotación, logout, `/me`
- [x] Middlewares `authenticate` y `authorize` (RBAC) reutilizables por módulos futuros
- [x] CSRF double-submit cookie en rutas de sesión

**Fase 3 — Catálogo** (películas, géneros, directores/actores): completa y verificada ([docs/backend/02-catalogo.md](docs/backend/02-catalogo.md))
- [x] CRUD de películas con géneros y créditos transaccionales, validación de director requerido
- [x] Personas (directores/actores) con contador de películas por rol calculado, no almacenado
- [x] Filtros de lista (estado, género, búsqueda) + paginación reutilizable (`utils/pagination.ts`)
- [x] Sin endpoint de borrado de películas a propósito — se archivan (`MovieStatus.ARCHIVED`)

**Fase 4 — Cines y salas** (RF-03): completa y verificada ([docs/backend/03-cines-salas.md](docs/backend/03-cines-salas.md))
- [x] CRUD de cines, salas anidadas bajo cine, generación transaccional del mapa de butacas por fila
- [x] `totalCapacity` calculado siempre de las butacas reales generadas, nunca recibido del cliente
- [x] Sin regeneración de layout ni borrado — se desactiva/archiva, igual que películas (deuda técnica documentada)

**Fase 5 — Funciones** (RF-04): completa y verificada ([docs/backend/04-funciones.md](docs/backend/04-funciones.md))
- [x] Creación de función calcula `endTime` automáticamente y valida cruce de horario por sala
- [x] Materializa `ShowtimeSeat` (mapa de disponibilidad) para toda la sala al crear la función — la pieza que el futuro motor de reservas necesita
- [x] Cancelar una función libera el horario automáticamente para nuevas funciones

**Fase 6 — Motor de reservas** (núcleo de RF-07): completa y verificada ([docs/backend/05-reservas.md](docs/backend/05-reservas.md))
- [x] Bloqueo de asientos atómico vía Redis (`SET NX EX`) + estado durable en Postgres
- [x] **Verificado con concurrencia real**: dos usuarios compitiendo por la misma butaca en simultáneo — exactamente uno gana, nunca doble venta
- [x] Órdenes `PENDING` con combos, cancelación libera butacas, eventos Socket.io (`seat:locked`/`seat:released`) por función
- [x] Barrido de bloqueos vencidos integrado también en las lecturas de disponibilidad de Funciones (fix retroactivo)

**Fase 7 — Promociones** (RF-05): completa y verificada ([docs/backend/06-promociones.md](docs/backend/06-promociones.md))
- [x] CRUD de promociones con reglas por película/cine/día de la semana (lógica OR, sin reglas = global)
- [x] `/promotions/validate` para verificar un código antes de pagar
- [x] **Integrado de vuelta al motor de reservas**: `createOrder` acepta `promotionCode` y aplica el descuento real — verificado end-to-end (20% sobre 200 = descuento de 40, total 160)

**Fase 8 — Opiniones** (RF-06): completa y verificada ([docs/backend/07-opiniones.md](docs/backend/07-opiniones.md))
- [x] Reseñas verificadas (`isVerifiedPurchase` calculado server-side contra órdenes `PAID` reales)
- [x] `averageRating`/`reviewCount` en el detalle de película, moderación (`isApproved`) restringida a staff
- [x] Probado el cálculo de "compra verificada" simulando una orden `PAID` directo vía Prisma (documentado como simulación honesta hasta que exista el módulo de Pagos)

**Fase 9 — Reportería** (RF-08): completa y verificada ([docs/backend/08-reportes.md](docs/backend/08-reportes.md))
- [x] Películas más vistas, horarios de mayor demanda (por hora y por día), efectividad de promociones
- [x] `$queryRaw` con template etiquetado (parametrizado, no SQL concatenado) para agregaciones que el query builder de Prisma no expresa bien
- [x] Verificado con datos de prueba controlados y resultados numéricos exactos, no solo "el endpoint responde 200"

**Fase 10 — Pagos** (cierra RF-07): construida y probada con gateway simulado ([docs/backend/09-pagos.md](docs/backend/09-pagos.md))
- [x] Patrón Strategy (`PaymentGateway`) con implementaciones reales de Stripe y PayPal — verificadas contra los tipos reales de ambos SDKs (compilan y tipan correctamente)
- [x] `payOrder`/`refundOrder`: máquina de estados completa probada con un gateway simulado inyectado en el registro real (`paymentGateways.STRIPE = mockGateway`), ejercitando la app real de punta a punta
- [x] **Bug real encontrado y corregido**: reintento de pago tras un cobro rechazado violaba una constraint única (`Payment.orderId`) — corregido con `upsert`, capturado por un test de integración real, no por revisión de código
- [ ] **Pendiente**: verificación end-to-end contra Stripe/PayPal sandbox reales — requiere credenciales del usuario (decisión tomada explícitamente: construir sin ellas ahora, verificar cuando existan)

**83/83 tests de integración pasan contra Postgres/Redis reales** (11 auth + 16 catálogo + 8 cines/salas + 7 funciones + 11 reservas + 7 promociones + 10 opiniones + 5 reportería + 8 pagos). Probado manualmente contra el servidor real (arranca sin errores incluso sin credenciales de Stripe/PayPal configuradas).

### Los 8 requerimientos funcionales del enunciado (RF-01 a RF-08) están completos

RF-07 (venta en línea) queda 100% cerrado en cuanto a lógica de negocio — solo falta la verificación contra proveedores reales cuando el usuario tenga las credenciales.

**Fase 11 — Frontend, fundación + primera vertical**: construida ([docs/frontend/00-foundation.md](docs/frontend/00-foundation.md))
- [x] Stack completo instalado y funcionando: React 19 + Vite 8 + TypeScript 6 + Tailwind v4 + shadcn/ui (patrón) + motion (Framer Motion) + React Router + Zustand + TanStack Query + React Hook Form/Zod
- [x] Páginas funcionales conectadas a la API real: Cartelera, Detalle de película, Funciones, Cines, Login/Registro
- [x] Cliente HTTP con refresco automático de sesión (401 → refresh → reintento) y CSRF
- [x] **Rediseño de composición** tras feedback del usuario (la primera versión "se sentía como cualquier trabajo con IA" pese a tener los colores correctos) — de patrones de plantilla SaaS genérica (hero centrado, backdrop-blur, cards rounded-lg con overlay) a composición editorial de cine (marquesina, stub de boleto, grano de película, tipografía tipo créditos) — ver memoria de sesión `feedback_ui_generic_ai_look`

**Fase 12 — Frontend, motor de reservas**: construido y verificado end-to-end real contra el backend real ([docs/frontend/01-reservas.md](docs/frontend/01-reservas.md))
- [x] Mapa de butacas en vivo (Socket.io: todos los clientes viendo la misma función ven los cambios de otros en tiempo real)
- [x] Flujo completo: selección → bloqueo → orden → checkout → pago → confirmación con QR real, + historial de boletos
- [x] **Segundo bug real encontrado y corregido**: una excepción del SDK de Stripe (no cubierta por el gateway simulado de los tests) se propagaba como `500` crudo — corregido a un `402` claro que preserva la reserva, verificado con `curl` real
- [x] Backend: se agregó `GET /showtimes/:id/seats` (mapa de butacas con estado real) — vacío detectado al construir esta pantalla

**86/86 tests de backend pasan.** `tsc -b`, `oxlint` y `vite build` del frontend limpios (2471 módulos).

**Verificación visual en navegador — sigue pendiente** (sin herramienta de automatización de navegador en esta sesión). Requiere que el usuario abra `pnpm dev:backend` + `pnpm dev:frontend` y navegue la app.

**Siguiente módulo de frontend**: Panel de administración (catálogo, cines/salas, funciones, promociones, reportería) — todo listo del lado del backend, sin interfaz todavía.
