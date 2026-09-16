# Frontend — Módulo: Fundación + primera vertical (Cartelera, Auth, Cines)

**Fase**: 11 — Frontend fundación · **Estado**: Construido y verificado por build/lint (sin verificación visual en esta sesión — ver nota) · **Fecha**: 2026-08-29

## Qué se construyó

### Stack (todo instalado y funcionando, no solo declarado)
- **React 19 + Vite 8 + TypeScript** (versiones "latest" resueltas por pnpm en este entorno — más nuevas de lo esperado, incluyendo **TypeScript 6.0**, que ya deprecó `baseUrl` en `tsconfig` a favor de `paths` relativos al propio archivo de config bajo `moduleResolution: "bundler"` — el proyecto ya usa la sintaxis nueva).
- **Tailwind CSS v4** vía `@tailwindcss/vite` — config CSS-first (`@theme` en `src/styles/theme.css`), no `tailwind.config.js`.
- **shadcn/ui** (patrón, no dependencia instalada): componentes propios en `components/ui/` sobre primitivas de **Radix UI**, con `class-variance-authority` + `tailwind-merge` — se puede personalizar libremente sin pelear contra un theme cerrado (ver justificación ya documentada en [docs/03-arquitectura.md](../03-arquitectura.md)).
- **motion** (paquete sucesor de Framer Motion) para animaciones.
- **React Router v7**, **Zustand** (estado de auth/tema), **TanStack Query** (datos del servidor: películas, cines, funciones), **React Hook Form + Zod** (formularios), **axios** (cliente HTTP), **Lucide** (iconos), **Sonner** (toasts), **socket.io-client** (instalado, integración de eventos en vivo pendiente para el módulo de reservas).

### Identidad de marca implementada de verdad, no solo documentada
- **Paleta completa** (`src/styles/theme.css`): los valores exactos de [docs/00-brand-lumiere.md](../00-brand-lumiere.md) para modo oscuro (por defecto, identidad de marca) y modo claro, como variables CSS que Tailwind consume vía `@theme` — la misma clase utilitaria (`bg-base`, `text-ink`, etc.) se ve distinta según el tema sin duplicar componentes.
- **Modo claro/oscuro/sistema** (`lib/theme.tsx`): tres estados persistidos en `localStorage`, default de marca = oscuro (no "sistema") si el visitante no ha elegido antes — decisión explícita, no accidental.
- **Tipografía**: Fraunces (display, itálica en títulos clave) + Inter (UI), cargadas vía Google Fonts con `preconnect`.
- **Motivos visuales**: logo con punto dorado + resplandor (evoca el lente del cinematógrafo, no una claqueta), hero con viñeta radial dorada, tarjeta de película con spotlight que sigue el cursor, transición de poster compartida (`layoutId` de `motion`) entre la grilla de cartelera y el detalle de película.
- Todas las animaciones respetan `prefers-reduced-motion` (regla global en `theme.css`).

### Páginas construidas (vertical slice funcional real)
| Ruta | Página | Qué hace |
|---|---|---|
| `/` | Cartelera | Grid de películas con tabs En cartelera/Próximamente, consumiendo `GET /movies` real |
| `/peliculas/:id` | Detalle de película | Sinopsis, reparto, dirección, calificación promedio — `GET /movies/:id` |
| `/peliculas/:id/funciones` | Funciones | Horarios agrupados por cine, con disponibilidad — `GET /showtimes?movieId=` |
| `/cines` | Cines | Listado de cines — `GET /cinemas` |
| `/iniciar-sesion`, `/registro` | Auth | Login/registro con validación Zod, conectados a `/auth/login`, `/auth/register` |
| `/mis-ordenes`, `/admin/*`, `/funciones/:id/asientos` | Placeholders honestos | Página "en construcción" explícita — no simulan una función que no existe |

### Infraestructura de cliente
- `lib/api-client.ts` — axios con `withCredentials: true` (la sesión vive en cookies httpOnly), interceptor que adjunta `X-CSRF-Token` en mutaciones (lee la cookie `csrf_token` no-httpOnly), e interceptor de **refresco automático de sesión**: un 401 dispara `POST /auth/refresh` una vez y reintenta la request original — implementa en el cliente exactamente la secuencia ya documentada en [docs/05-diagramas-uml.md](../05-diagramas-uml.md) sección 4.
- `features/auth/auth.store.ts` — Zustand: usuario actual, `initialize()` (llamado una vez al montar `<App>`, resuelve la sesión vía `GET /auth/me` antes de decidir qué mostrar), `login`/`register`/`logout`.
- Proxy de desarrollo (`vite.config.ts`): `/api` y `/socket.io` apuntan a `localhost:4000` — mismo origen desde el navegador, sin configurar CORS en desarrollo.

## Cómo se verificó (y su límite honesto)

- [x] `npx tsc -b --noEmit` — sin errores.
- [x] `npx oxlint` — sin errores, 2 warnings benignos (patrón estándar de shadcn/ui: un archivo exporta un componente y una constante/hook relacionados — el mismo patrón que usa shadcn oficialmente, no vale la pena romperlo).
- [x] `npx vite build` — **2432 módulos transformados sin error**, valida que todo el grafo de imports/JSX/TypeScript de la aplicación completa es correcto (no solo el punto de entrada).
- [x] Servidor de desarrollo (`vite`) probado real contra el backend real corriendo (`tsx src/server.ts` + Postgres/Redis en Docker): el proxy `/api` respondió `GET /movies` y `GET /health` correctamente a través del dev server.
- [ ] **Verificación visual en navegador — NO realizada en esta sesión.** No hay herramienta de automatización de navegador (Playwright/Puppeteer) disponible. Lo verificado arriba (compila, tipa, lintea, construye sin errores, responde a través del proxy) es la verificación más fuerte posible sin un navegador real, pero **no confirma** que el diseño se vea como se pretende, que las animaciones se sientan bien, o que no haya errores de consola en tiempo de ejecución del navegador (React, a diferencia de un build de Vite, puede lanzar errores solo al renderizar en el DOM real). **Este es el punto donde se necesita que el usuario abra `pnpm dev:frontend` y navegue la app.**

## Decisiones de diseño

1. **TypeScript 6.0 sin `baseUrl`** — el entorno resolvió una versión de TS más nueva de lo esperado que ya deprecó esa opción; se adoptó la sintaxis nueva (`paths` sin `baseUrl`) en vez de forzar una versión anterior, ya que es hacia donde se dirige el ecosistema.
2. **`motion` en vez de `framer-motion`** — es el mismo proyecto/API renombrado; se usa el nombre de paquete actual. La documentación de marca sigue refiriéndose a "Framer Motion" como el nombre de la tecnología/marca, que es como se sigue conociendo.
3. **Placeholders honestos para rutas no construidas** (`WipPage`) en vez de esconder los enlaces o simular una función — el usuario puede navegar toda la IA de información planeada aunque el flujo de compra completo (selección de asientos, checkout) todavía no exista. Evita el peor de los dos escenarios: un enlace roto (404 de React Router) o una pantalla que finge funcionar.
4. **Sin datos de películas/cines de ejemplo sembrados automáticamente** — la base de datos de desarrollo solo tiene los datos de referencia del seed original (géneros, idiomas, clasificaciones, tipos de butaca). La cartelera aparecerá vacía hasta que se cree contenido real vía la API administrativa (o un futuro panel de administración) — se decidió no ensuciar la base de datos del usuario con películas falsas sin que lo pidiera explícitamente.
5. **Bundle sin code-splitting todavía** (699 KB / 220 KB gzip, advertencia de Vite en el build) — aceptable para esta fase; la optimización natural (rutas con `React.lazy`) se hace cuando haya más páginas y el bundle crezca más, no prematuramente.

## Addendum: pase de rediseño (composición editorial, no plantilla genérica)

Tras la primera versión, feedback directo del usuario: la paleta de colores estaba bien, pero la **composición** se sentía como "cualquier trabajo con IA" — genérica, sin identidad propia. El problema no eran los tokens de marca, era la estructura: hero centrado con blob de gradiente, header con `backdrop-blur` y pills espaciadas uniformemente, grid de tarjetas `rounded-lg` idénticas con overlay de degradado sobre la imagen — patrones reconocibles de plantilla SaaS genérica, independientemente del color usado encima.

Cambios estructurales (no solo cosméticos):
- **Radios de borde recortados globalmente** (`--radius-lg`, etc. redefinidos en `@theme`) — toda la app pasa de sentirse "burbujeante" a más impresa/editorial sin tocar cada componente.
- **Grano de película** (`body::before` con `feTurbulence` vía SVG data-URI, opacity 0.05, `mix-blend-mode: overlay`) — textura sutil que ninguna plantilla genérica de IA incluye por defecto.
- **Header**: de barra flotante translúcida con pills a masthead sólido con hairline dorado en degradado y nav en mayúsculas tracked-out con subrayado que crece en hover (convención de créditos de cine, no de SaaS).
- **Home**: de hero centrado con blob de gradiente a una **marquesina** (`Marquee`) — la película destacada a sangre completa con el título apoyado abajo-izquierda sobre la imagen, como una entrada de cine real. Si no hay películas en cartelera, un `BrandIntro` distinto (no un estado vacío disfrazado de hero).
- **Tarjeta de película**: de overlay con degradado negro sobre la imagen (patrón muy común de "tarjeta genérica") a un **stub de boleto** — póster a sangre completa, línea de perforación punteada, texto debajo con número de índice tipo contador de rollo de película (`01`, `02`...) y etiqueta *eyebrow* tracked-uppercase.
- **Sistema tipográfico repetido en todas las páginas**: clase `.eyebrow` (créditos de cine: "DIRIGIDA POR", "REPARTO", "UBICACIONES") + títulos en Fraunces itálica — reemplaza los `<h2>` genéricos sin personalidad.

Ver memoria de sesión `feedback_ui_generic_ai_look` para el criterio general (aplica a este proyecto y a trabajo de frontend futuro): después de implementar la versión "obviamente correcta" (colores, componentes, datos correctos), hacer una segunda pasada explícita preguntando si la *composición* tiene estructura distintiva o si solo se le puso tema a una plantilla genérica.

Verificado de nuevo tras el rediseño: `tsc -b` sin errores, `oxlint` limpio (mismos 2 warnings benignos previos), `vite build` — 2432 módulos sin error.

## Deuda técnica / pendiente

1. **Verificación visual real — el pendiente más importante de este módulo** (ver arriba). Instrucciones para el usuario: `pnpm dev:backend` en una terminal, `pnpm dev:frontend` en otra, abrir `http://localhost:5173`.
2. **Sin selección de asientos ni checkout** — el flujo de compra (RF-07 en el frontend) es la siguiente pieza más grande e importante del roadmap de frontend; requiere el mapa de butacas interactivo, la integración de Socket.io para actualización en vivo, y los formularios de pago de Stripe/PayPal Elements.
3. **Sin panel de administración** — todos los módulos de gestión del backend (películas, cines, salas, funciones, promociones, reportería) están listos del lado del servidor pero no tienen todavía interfaz.
4. **Sin tests de frontend** (Vitest + Testing Library no configurados aún) — se agregarán junto con los primeros componentes con lógica no trivial (el mapa de butacas es buen candidato).
5. **Code-splitting por ruta** — cuando el bundle crezca, envolver las páginas en `React.lazy`.

## Siguiente módulo

**Motor de reservas en el frontend**: mapa de butacas interactivo con actualización en tiempo real (Socket.io), flujo de checkout con Stripe Elements / PayPal, y confirmación de compra con código QR — la contraparte visual de los módulos de backend ya completos y probados.
