# Frontend — Módulo: Panel de administración (fase 1)

**Fase**: 13 — Frontend panel de administración · **Estado**: Construido y verificado end-to-end real · **Fecha**: 2026-08-29

## Qué se construyó

### Reportería (`/admin`)
Dashboard con los 3 indicadores de RF-08 usando Recharts: películas más vistas (barras horizontales, útil para títulos largos), demanda por hora y por día de la semana (barras verticales), y efectividad de promociones (tabla — 3 métricas heterogéneas por fila se leen mejor como tabla que forzadas en un gráfico, siguiendo la guía de "elegir la forma" del skill de visualización de datos).

**Paleta validada, no elegida a ojo**: antes de escribir el primer gráfico se corrió el validador de contraste del skill de dataviz contra los tokens de marca. Resultado: el dorado sobre fondo oscuro tiene contraste excelente (8.97:1), pero sobre fondo claro es marginal (2.99:1, justo bajo el mínimo de 3:1) — por eso **todas las barras llevan etiquetas de valor visibles**, no dependen solo del color para comunicar la magnitud (satisface la obligación de "canal de alivio" del skill ante un WARN de contraste). El carmesí se descartó como color de relleno de barra por bajo contraste sobre fondo oscuro (2.2:1) — se reserva para acentos pequeños (bordes, badges), nunca áreas grandes de datos.

### Gestión de películas (`/admin/peliculas`)
Lista + formulario de creación/edición completo: campos básicos, selección de clasificación/idioma (poblados desde los nuevos endpoints de referencia), selector múltiple de géneros, y un **editor de reparto** (`components/admin/credits-editor.tsx`) que busca personas existentes (`GET /people?search=`) o crea una nueva al vuelo (`POST /people`) sin salir del formulario, asignando rol (director/actor) y personaje por fila.

### Layout y control de acceso
`AdminLayout` con navegación lateral y guardia de rol integrada (`SUPER_ADMIN`/`CINEMA_MANAGER` únicamente, coincide exactamente con lo que el backend autoriza en cada endpoint de gestión) — redirige a home si un `CUSTOMER` intenta entrar, sin depender de un componente `ProtectedRoute` separado.

## Bugs reales encontrados y corregidos (backend)

Al construir el formulario de películas se detectaron **dos vacíos más** en la API, siguiendo el mismo patrón de todo este proyecto — construir el consumidor real expone huecos que ningún test aislado detecta:

1. **`GET /ratings` y `GET /languages` no existían.** El formulario necesita listar las clasificaciones e idiomas disponibles para los selects de `ratingId`/`originalLanguageId` (campos requeridos para crear una película), pero nunca se había expuesto un endpoint de lectura para esas tablas de referencia. Se agregaron siguiendo el mismo patrón que `seat-types` (público, sin CRUD — sin caso de uso real para gestionarlos desde la app todavía). 2 tests nuevos, 88/88 en total.

Ver commit correspondiente para el detalle completo.

## Code-splitting (esta vez sí se justificó)

Al agregar Recharts, el bundle principal saltó a 1.15 MB (353 KB gzip) — cruzó el umbral donde la optimización deja de ser prematura. Se separó el panel de administración completo (`AdminLayout` + sus páginas) con `React.lazy`/`Suspense`: el chunk principal que descarga cualquier cliente volvió a 629 KB (194 KB gzip), y Recharts + las pantallas de administración (362 KB / 105 KB gzip) solo se descargan si alguien realmente visita `/admin` — un cliente normal nunca paga ese peso.

## Verificación realizada

- [x] `npx tsc -b --noEmit` — sin errores.
- [x] `npx oxlint` — limpio (2 warnings benignos ya conocidos + 1 nuevo warning benigno de `set-state-in-effect` en la sincronización del formulario de edición con los datos cargados — patrón válido y común, no un bug).
- [x] `npx vite build` — sin errores, con code-splitting verificado (chunk principal reducido, `reports-dashboard` y páginas de admin en chunks separados).
- [x] **Flujo administrativo completo verificado vía `curl` contra el servidor real**: login como `SUPER_ADMIN` → crear persona nueva (quick-add) → buscar personas → crear película con el payload exacto que envía el formulario (géneros + créditos anidados) → `201 Created`. Datos de prueba limpiados al terminar.
- [ ] **Verificación visual en navegador — sigue pendiente** (sin herramienta de automatización de navegador).

## Decisiones de diseño

1. **Select nativo estilizado, no un combobox custom** (`components/ui/select.tsx`) — para clasificación/idioma/estado, un `<select>` nativo es más simple, accesible por defecto, y suficiente; no se justifica la complejidad de Radix Select para estos casos.
2. **Reportería restringida a `SUPER_ADMIN`/`CINEMA_MANAGER`** — coincide exactamente con la autorización ya implementada en el backend (ver [docs/backend/08-reportes.md](../backend/08-reportes.md)).
3. **`CreditsEditor` como componente autocontenido** — administra su propio estado de búsqueda y creación rápida de personas; el formulario padre solo recibe la lista final de créditos, sin conocer los detalles de cómo se armó.

## Deuda técnica / pendiente

1. **Verificación visual en navegador** (ver arriba) — otra vez el pendiente principal.
2. **Cines, salas, funciones y promociones sin interfaz de gestión todavía** (`WipPage` honesto para cines y promociones) — el backend de los cuatro módulos está completo y probado; falta la interfaz. Es la continuación natural de este mismo patrón (lista + formulario), replicable módulo por módulo.
3. **Sin edición de imagen (subida de archivos)** — `posterUrl`/`backdropUrl`/`trailerUrl` son campos de texto (URL), no hay subida de archivos todavía (requiere un proveedor de almacenamiento de medios, ver [docs/03-arquitectura.md](../03-arquitectura.md)).
4. **Sin borrado de películas en la interfaz** (coincide con la decisión ya documentada del backend: se archivan, no se borran — el estado "Archivada" ya está disponible en el selector de estado del formulario).

## Siguiente módulo

**Gestión de cines, salas, funciones y promociones** — replicar el mismo patrón (lista + formulario) para los módulos de backend restantes.
