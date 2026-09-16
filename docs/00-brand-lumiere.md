# Identidad de marca — Lumière

## 1. Historia y posicionamiento

En diciembre de 1895, los hermanos Auguste y Louis Lumière proyectaron por primera vez ante un público pagante una serie de películas cortas en el Salón Indio del Grand Café de París, usando el cinematógrafo que ellos mismos inventaron. Ese momento — un haz de luz atravesando la oscuridad para proyectar una historia en una pantalla — es el origen simbólico de la experiencia colectiva de ir al cine.

**Posicionamiento**: *"Donde nació la experiencia de ver historias en pantalla."*

Lumière no se presenta como "una cartelera más". Se presenta como una marca que entiende y honra el origen del cine, y que traduce ese respeto en una experiencia de compra de boletos que no falla, que es hermosa y que es rápida — lo opuesto a la experiencia genérica y anticuada de la mayoría de sitios de cines reales.

## 2. Territorio conceptual

- **Luz en la oscuridad**: el haz de proyector como elemento visual recurrente (gradientes, spotlights, iluminación direccional en hover states).
- **El origen, no la copia**: evitar clichés visuales de "app de cine genérica" (claquetas, palomitas como ícono principal, rojo-y-negro plano). La referencia visual es más cercana al cine clásico europeo — elegante, editorial — que al pop-corn-cinema americano genérico.
- **Ritual, no transacción**: comprar un boleto en Lumière se comunica como el inicio de una experiencia, no como un checkout de e-commerce.

## 3. Paleta de colores

Diseñada para dos modos completos (no un modo "invertido" del otro).

### Modo oscuro (por defecto — evoca la sala de proyección)

| Token | Uso | Valor |
|---|---|---|
| `--bg-base` | Fondo principal | `#0B0B0F` (negro casi puro, con matiz frío) |
| `--bg-surface` | Tarjetas, paneles | `#15151C` |
| `--bg-elevated` | Modales, dropdowns | `#1E1E27` |
| `--accent-gold` | Acento primario (luz de proyector) | `#D4A94E` |
| `--accent-gold-bright` | Hover / focus del acento | `#E8C670` |
| `--accent-crimson` | Secundario (terciopelo de butaca) | `#8C1F2F` |
| `--text-primary` | Texto principal | `#F5F1E8` (marfil cálido, no blanco puro) |
| `--text-secondary` | Texto secundario | `#A8A6B0` |
| `--border` | Bordes sutiles | `#2A2A35` |
| `--success` | Confirmaciones | `#4E9C6A` |
| `--warning` | Alertas | `#D4A94E` (reutiliza el acento) |
| `--danger` | Errores | `#C24B4B` |

### Modo claro (evoca la pantalla iluminada, no una oficina)

| Token | Uso | Valor |
|---|---|---|
| `--bg-base` | Fondo principal | `#FAF6EC` (marfil cálido, no `#FFFFFF`) |
| `--bg-surface` | Tarjetas, paneles | `#FFFFFF` |
| `--bg-elevated` | Modales, dropdowns | `#FFFFFF` con sombra elevada |
| `--accent-gold` | Acento primario | `#B8862F` (dorado más oscuro para contraste AA sobre claro) |
| `--accent-crimson` | Secundario | `#7A1B29` |
| `--text-primary` | Texto principal | `#1A1A1F` |
| `--text-secondary` | Texto secundario | `#5C5A66` |
| `--border` | Bordes sutiles | `#E4DFD0` |

Ambas paletas se validan contra WCAG AA para texto sobre fondo antes de usarse (ver [docs/06-seguridad.md](06-seguridad.md) sección de accesibilidad, y la guía de contraste del skill de dataviz interno para futuros componentes de datos).

## 4. Tipografía

- **Titulares / marquesina** — serif editorial con carácter (`Fraunces` vía Google Fonts, con fallback `Georgia, 'Times New Roman', serif`). Se usa en H1/H2, nombres de películas destacadas, secciones hero.
- **UI / cuerpo** — sans-serif limpio y muy legible (`Inter` vía Google Fonts, con fallback `-apple-system, 'Segoe UI', sans-serif`). Se usa en todo lo demás: botones, formularios, tablas, texto de párrafo.
- **Numérico / horarios** — `Inter` con `font-variant-numeric: tabular-nums` para horarios y precios, evita saltos de layout.

Regla: nunca mezclar más de dos familias tipográficas en una misma vista.

## 5. Motivos visuales y motion

- **Viñeta sutil** en fondos de secciones hero (radial-gradient oscureciendo bordes) — sensación de sala de cine.
- **Haz de luz** como elemento gráfico: gradiente cónico o lineal dorado con blur, usado en fondos de sección y en estados hover de tarjetas de película (no en todos lados — se reserva para momentos clave).
- **Transición de apertura tipo cortina** al entrar a la página de detalle de una función (dos paneles que se abren lateralmente) en vez de un fade genérico.
- **Micro-interacciones**: hover de póster con leve escala + spotlight que sigue el cursor; framer-motion `layoutId` para transiciones compartidas entre la grilla de cartelera y el detalle de película.
- **Loading state**: patrón de "film leader" (cuenta regresiva de proyector 5-4-3-2-1 estilizada) en vez de un spinner genérico, reservado para cargas de página completas (no para cada fetch pequeño).
- Todas las animaciones respetan `prefers-reduced-motion`.

## 6. Tono de voz / microcopy

- Vocabulario de sala de cine real: "Función", "Cartelera", "Estrenos", "Próximamente", "Butaca", no equivalentes genéricos de e-commerce ("producto", "ítem").
- Tono cálido y directo, nunca corporativo-frío ni sobre-entusiasta tipo marketing agresivo.
- Mensajes de error explican qué pasó y qué hacer, sin jerga técnica ("No pudimos reservar tu butaca a tiempo, elige otra" en vez de "Error 409: conflict").

## 7. Convención de uso del nombre

- **Código, paquetes, URLs, configuración, nombres de servicios**: `lumiere` (sin tilde, minúscula) — evita problemas de encoding en imports, env vars, dominios, etc.
- **UI visible al usuario, marca, documentación de presentación, correos, metadatos SEO (`<title>`, OG tags)**: **Lumière** (con tilde, mayúscula inicial).
