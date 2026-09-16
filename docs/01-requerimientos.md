# Requerimientos — Lumière

## 1. Requerimientos funcionales del enunciado original

### RF-01 Películas
Registro completo: título, título original, idioma original, género(s), disponibilidad de subtítulos/doblaje, duración, país de origen, año, clasificación por edad, sinopsis, reparto y directores.

### RF-02 Directores y actores
Datos personales (nombre, biografía, foto, nacionalidad, fecha de nacimiento) y cantidad de películas en las que participan (derivado, no almacenado — se calcula desde la relación con películas).

### RF-03 Cines y salas
Gestión de cines (nombre, dirección, ciudad) y salas por cine, con capacidad de butacas y layout físico.

### RF-04 Funciones
Horarios de proyección por película, sala y formato (2D/3D, idioma de audio, subtítulos).

### RF-05 Promociones
Registro de promociones con reglas de aplicación (por función, película, cine o día de la semana) y cálculo de descuento en el checkout.

### RF-06 Opiniones
Registro de reseñas y calificaciones (1-5) por usuario autenticado.

### RF-07 Venta en línea
Selección de asientos sobre un mapa interactivo de la sala, checkout, pago con Stripe o PayPal, confirmación de orden.

### RF-08 Reportería
- Películas más vistas (por boletos vendidos, ventana de tiempo configurable)
- Horarios de mayor demanda (agregación por franja horaria / día de la semana)
- Efectividad de promociones (uso, descuento total otorgado, incremento en conversión asociado)

## 2. Valor agregado

Cada ítem responde a una pregunta: ¿qué problema real de un sitio de cine resuelve que el enunciado no exige explícitamente?

| Valor agregado | Problema real que resuelve |
|---|---|
| Salas especiales (IMAX, VIP, 4DX, Dolby Atmos) y tipos de butaca (estándar, VIP, reclinable, silla de ruedas) | El enunciado pide "capacidad de butacas" pero un cine real no es homogéneo; el precio y la experiencia varían por tipo de sala/butaca |
| Bloqueo temporal de asiento (con expiración) en tiempo real vía Redis + Socket.io | Evita el fallo más común de sitios reales: cobrar por un asiento que otro usuario ya tomó durante el checkout |
| Combos de dulcería vinculados a la orden | Fuente real de ingreso en cines; conecta natural con "venta en línea" |
| Próximos estrenos con notificación de disponibilidad | Retiene usuarios entre visitas, reduce dependencia de que el usuario vuelva a revisar manualmente |
| Reseñas verificadas (solo compradores con orden confirmada) | Da credibilidad real a las opiniones — la mayoría de sitios no valida esto |
| Programa de puntos / membresía simple | Fideliza sin requerir infraestructura de CRM externa |
| Roles múltiples: cliente, taquilla, gerente de cine, super-admin | El enunciado habla de "gestión" pero no de quién gestiona qué — un cine real tiene jerarquía operativa |
| Código QR de entrada | Reemplaza validación manual de boletos en sala |
| Selección de sede/ciudad | Un cine real es una cadena con múltiples ubicaciones, no una sala única |
| Accesibilidad WCAG AA como requisito, no como opcional | Requisito legal/ético en la mayoría de mercados reales, casi nunca implementado en sitios de cine locales |

## 3. Inteligencia artificial — alcance y justificación

Criterio de inclusión: una funcionalidad de IA entra al alcance solo si mejora una métrica de negocio o de experiencia medible. Se descarta IA decorativa.

### V1 (justificado, alcance inicial)
- **Recomendaciones personalizadas** — basadas en historial de compra y géneros favoritos del usuario. Mejora conversión y retención.
- **Búsqueda semántica** — permite consultas como "algo como Interstellar pero más corta", usando embeddings sobre sinopsis/metadata. Diferenciador de UX medible por tasa de uso del buscador.
- **Insights de reseñas para el dashboard admin** — resumen automático de temas recurrentes en reseñas por película/promoción, para enriquecer el reporte de "efectividad de promociones" más allá de números crudos.

### V2 (backlog, evaluar con datos reales de uso)
- Chatbot de soporte para dudas de compra/reembolso.
- Detección de fraude en pagos (anomalías de transacción).
- Forecasting de demanda para sugerir horarios óptimos de nuevas funciones (extiende directamente RF-08).

### Explícitamente fuera de alcance
- Generación de sinopsis o metadata de películas por IA (los datos deben ser reales/curados, nunca alucinados).
- Cualquier feature de IA que no tenga una métrica de éxito definida antes de construirse.

## 4. Requerimientos no funcionales

| Categoría | Requerimiento |
|---|---|
| Seguridad | Seguridad en las 3 capas (frontend, backend, BD) — ver [docs/06-seguridad.md](06-seguridad.md) |
| Disponibilidad | Diseño stateless en el backend (sesión vía JWT, no memoria de proceso) para permitir escalado horizontal futuro |
| Rendimiento | Tiempo de respuesta de API < 300ms p95 en operaciones de lectura; mapa de asientos actualizado en < 500ms vía WebSocket |
| Accesibilidad | WCAG 2.1 nivel AA en flujos críticos (búsqueda, selección de asiento, checkout) |
| Responsive | Soporte completo mobile-first, breakpoints estándar (sm/md/lg/xl) |
| Internacionalización de datos | Modelo de datos soporta múltiples idiomas de audio/subtítulo por función (no necesariamente UI multi-idioma en V1) |
| Observabilidad | Logging estructurado + auditoría de acciones administrativas y de pago |
| Mantenibilidad | Tipado end-to-end (TypeScript + Prisma + Zod), migraciones versionadas, documentación viva por módulo |
| Portabilidad | Entorno reproducible vía Docker Compose |

## 5. Fuera de alcance (explícito)

- Aplicación móvil nativa (el frontend responsive cubre el caso de uso móvil).
- Facturación electrónica fiscal específica de un país (se deja como extensión futura, dependiente del mercado real de lanzamiento).
- Venta de publicidad a terceros dentro de la plataforma.
