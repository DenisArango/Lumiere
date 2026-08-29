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

**35/35 tests de integración pasan contra Postgres/Redis reales** (11 auth + 16 catálogo + 8 cines/salas). Probado manualmente contra el servidor real.

**Siguiente módulo**: Funciones (RF-04)
