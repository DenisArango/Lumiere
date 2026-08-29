# Guía de presentación — preguntas esperadas y cómo responderlas

Este documento no es documentación técnica del sistema (para eso están los demás `.md` en `docs/`). Es una guía de preparación: anticipa las preguntas que un ingeniero evaluador probablemente haga al ver que este proyecto tiene mucho más de lo que él mismo enseñó en clase, y da respuestas cortas y defendibles, con el porqué detrás de cada decisión.

**Cómo usar esto**: no memorices las respuestas palabra por palabra — entiende el argumento de cada una (el "por qué"), porque la pregunta de seguimiento casi siempre es "¿y por qué no lo hiciste de la forma simple?". Cada respuesta apunta al documento técnico donde está el detalle completo, por si te piden profundizar.

---

## Sobre dónde publicar esta documentación

Mencionaste que no recuerdas el nombre de la herramienta que usa el ingeniero para sus guías. Todos los `.md` de este proyecto son Markdown estándar + diagramas Mermaid embebidos (sin herramientas propietarias), así que son portables casi sin cambios a cualquiera de estas opciones comunes en el mundo académico/profesional:

- **Docusaurus** (Meta/Facebook) — el más común en cursos y bootcamps, genera un sitio de documentación con sidebar y búsqueda a partir de carpetas de `.md`. Soporta Mermaid con un plugin oficial.
- **MkDocs + Material for MkDocs** — muy popular, configuración simple en un solo archivo YAML, soporta Mermaid nativo con el tema Material.
- **GitBook** — orientado a equipos, editor visual además de Markdown, se puede sincronizar con un repo de GitHub.
- **VitePress** — más orientado a documentación de proyectos de código (Vue/Vite), rápido y minimalista.
- **Notion** — si el ingeniero comparte documentación en un workspace en vez de un sitio generado; se puede importar Markdown pero pierde el render de Mermaid (hay que pegar las imágenes o usar su editor de diagramas nativo).

Si te confirma el nombre después, dímelo y ajusto formato/estructura si esa herramienta tiene alguna convención específica (por ejemplo, Docusaurus espera `sidebar_position` en el frontmatter de cada archivo).

---

## 1. "¿Por qué tanto? Esto es un proyecto de cartelera de cine, no un banco."

Esta es la pregunta raíz detrás de casi todas las demás. La respuesta corta: **el enunciado pedía gestión de cartelera; lo que se construyó es un producto que se puede lanzar de verdad**, y eso implica resolver problemas que un CRUD básico ignora — doble venta de asientos, contraseñas seguras, no perder ventas por caídas, no exponer datos de pago. Nada de lo que está aquí es decoración: cada pieza responde a un problema concreto y documentado (ver [docs/01-requerimientos.md](01-requerimientos.md) sección "Valor agregado").

Si insiste en "pero el curso no pedía esto": la respuesta es que el curso define el *mínimo*, no el *techo*. El README y PROJECT.md dejan explícito desde el inicio que el objetivo era tratarlo como un producto real, no un ejercicio de clase — es una decisión de alcance tomada a propósito, no una desviación accidental.

## 2. Arquitectura general

**"¿Por qué TypeScript y no JavaScript plano?"**
JavaScript no detecta en tiempo de escritura errores como "le paso un string donde se espera un número" o "este objeto no tiene ese campo" — se descubren en producción, con el usuario. TypeScript + Prisma dan tipado de punta a punta: el tipo de una fila de la tabla `movies` se genera automáticamente desde el schema y se usa en todo el código, así que si cambia la base de datos, el compilador señala inmediatamente cada lugar del código que hay que actualizar.

**"¿Por qué separaste `app.ts` de `server.ts`?"**
`app.ts` construye la aplicación Express (rutas, middlewares) sin arrancar nada. `server.ts` la levanta de verdad (conecta a la base de datos, abre el puerto). La separación permite que los tests (`supertest`) usen la app directamente, en memoria, sin necesitar un puerto real ni un socket abierto — los tests corren más rápido y no chocan entre sí si se ejecutan en paralelo.

**"¿Por qué organizaste el código por módulo de dominio (`modules/auth`, `modules/movies`...) y no por capa técnica (`/controllers`, `/routes`, `/services` a nivel raíz)?"**
Porque el trabajo se planificó y se entrega por dominio (ver metodología en [docs/02-metodologia.md](02-metodologia.md)): cada módulo se construye, se prueba y se documenta como una unidad completa. Si la carpeta raíz fuera `/controllers` con 15 archivos de dominios distintos mezclados, entender o tocar "solo lo de reservas" implicaría saltar por cinco carpetas distintas.

**"¿Por qué un monorepo con pnpm workspaces en vez de dos repos separados (backend y frontend)?"**
Porque backend y frontend van a compartir tipos y evolucionar juntos (el contrato de la API), y la documentación es una sola fuente de verdad para ambos. Repos separados complican mantener eso sincronizado. pnpm específicamente (no npm) porque es más eficiente con el espacio en disco (usa un almacén de contenido compartido entre proyectos) y tiene mejor soporte de monorepos que npm — ver la decisión completa, incluyendo el problema de compatibilidad de versión de Node que se resolvió en el camino, en [docs/backend/00-foundation.md](backend/00-foundation.md).

## 3. Base de datos y modelo de datos

**"¿Por qué UUID como llave primaria y no un entero autoincremental (1, 2, 3...)?"**
Un ID autoincremental filtra información de negocio: si ves `/orders/4821`, sabes que ya se hicieron al menos 4821 órdenes, y puedes intentar `/orders/4822` para ver la orden de otra persona (enumeración). UUID no es adivinable ni cuenta nada. El costo (índices ligeramente más pesados) es aceptable para el volumen de un sistema como este.

**"¿Por qué Prisma como ORM y no SQL escrito a mano o un ORM más ligero?"**
Tres razones concretas: (1) genera un cliente TypeScript tipado directamente desde el schema, (2) usa siempre queries parametrizadas — es estructuralmente imposible escribir una inyección SQL con Prisma porque nunca se concatena texto del usuario dentro de una query, y (3) las migraciones quedan versionadas en archivos SQL dentro del repo, así que el historial de cambios de la base de datos es auditable en `git log` igual que el código.

**"Explícame por qué `ShowtimeSeat` es una tabla separada de `Seat`."**
`Seat` es la butaca física (fila C, asiento 12 de la sala 3) — existe una sola vez. `ShowtimeSeat` es la disponibilidad de *esa butaca para una función específica* — la misma butaca física puede estar `AVAILABLE` para la función de las 5pm y `SOLD` para la de las 8pm. Sin esta separación no habría forma de modelar que una butaca está libre en una función y ocupada en otra. Ver el detalle completo en [docs/04-modelo-datos.md](04-modelo-datos.md) sección 3.

**"¿Por qué migraste manualmente a `md5` y después lo revertiste? ¿No sabías lo que hacías?"** *(si te preguntan sobre el incidente documentado)*
Al contrario — es exactamente el tipo de proceso que se espera mostrar: cuando `prisma migrate dev` falló con un error de autenticación, se probó una hipótesis razonable (problema de handshake SCRAM en Docker Desktop/Windows), se implementó, **se volvió a probar, y como no resolvió el problema, se revirtió** en vez de dejar un cambio que no tenía justificación real. La causa real (un Postgres nativo de Windows ocupando el mismo puerto) se encontró después con evidencia concreta (`Get-NetTCPConnection`), no por intuición. Todo el proceso de diagnóstico —hipótesis descartadas incluidas— está documentado en [docs/backend/00-foundation.md](backend/00-foundation.md) a propósito: mostrar el camino, no solo el resultado, es parte de trabajar profesionalmente.

## 4. Autenticación y seguridad

**"¿Por qué JWT con refresh token en vez de simplemente guardar el usuario en una sesión?"**
Una sesión de servidor clásica obliga a que todas las instancias del backend compartan el mismo almacén de sesiones (o pegajosidad de sesión), lo cual complica escalar horizontalmente. JWT es *stateless*: cualquier instancia del backend puede validar el token sin consultar una base de datos compartida en cada request. El costo de eso (no poder revocar un JWT antes de que expire) se resuelve con el refresh token, que sí es revocable — es lo mejor de ambos mundos.

**"¿Por qué el refresh token no es también un JWT?"**
Si el refresh token también fuera un JWT autocontenido, revocarlo (por ejemplo, en un logout) requeriría una lista negra de tokens revocados — otra pieza de infraestructura a mantener. En cambio, el refresh token es un valor aleatorio opaco cuyo *hash* se guarda en la tabla `refresh_tokens`; revocarlo es un `UPDATE` de una fila. Ver [docs/backend/01-auth.md](backend/01-auth.md) sección de decisiones.

**"¿Qué es 'rotación de refresh token' y por qué lo implementaste?"**
Cada vez que se usa el refresh token para pedir un nuevo access token, ese refresh token se invalida y se entrega uno nuevo. Si un atacante roba un refresh token y lo usa, y luego el usuario legítimo también intenta usarlo, uno de los dos va a fallar — esa falla es una señal de que hubo un robo. Es un patrón estándar de la industria (Auth0, Okta, y las guías de OWASP lo recomiendan explícitamente).

**"¿Por qué las cookies son httpOnly? ¿Qué problema evita eso?"**
Un token guardado en `localStorage` es accesible desde cualquier script que corra en la página — si existe **una sola** vulnerabilidad XSS en cualquier parte del frontend (una librería de terceros, un campo mal sanitizado), ese script puede leer el token y enviarlo a un servidor atacante. Una cookie `httpOnly` es invisible para JavaScript por diseño del navegador: ni siquiera un XSS exitoso puede leerla directamente.

**"Si las cookies httpOnly ya protegen contra XSS, ¿para qué agregaste protección CSRF también?"**
Son problemas distintos. httpOnly evita que **JavaScript malicioso lea** la cookie. CSRF es distinto: un sitio malicioso puede hacer que el navegador de la víctima **envíe** la cookie automáticamente (así es como funcionan las cookies) hacia Lumière sin que la víctima se entere, forzando una acción no deseada (como cerrar su sesión). El patrón *double-submit cookie* que se implementó exige que el frontend también mande el mismo valor en un header — algo que un sitio atacante no puede leer por la política de mismo origen del navegador.

**"¿Por qué Argon2 y no bcrypt, que es lo que se enseña normalmente?"**
Bcrypt sigue siendo aceptable, pero Argon2id (específicamente la variante *id*) ganó la Password Hashing Competition (2015) precisamente por resistir mejor ataques con hardware especializado (GPU/ASIC) gracias a su costo de memoria configurable, no solo de tiempo de CPU. Es la recomendación actual de OWASP como primera opción.

**"¿Por qué limitaste los intentos de login (rate limiting)?"**
Sin límite, un atacante puede probar millones de contraseñas por fuerza bruta o probar una lista de contraseñas filtradas contra muchas cuentas (*credential stuffing*). El límite (10 intentos / 15 minutos por IP) hace ese ataque impráctico sin afectar el uso normal — nadie falla su contraseña 10 veces en 15 minutos por accidente.

**"¿Cómo evitas SQL injection si no escribiste ningún `WHERE` a mano?"**
Exactamente por eso: Prisma nunca concatena valores del usuario dentro de una query SQL, los envía como parámetros separados al motor de base de datos (igual que un `PreparedStatement` en JDBC). No es una buena práctica opcional que se siguió — es estructuralmente imposible inyectar SQL a través de Prisma en el uso normal de su API.

## 5. Reservas, pagos y concurrencia (para cuando se construya ese módulo)

**"¿Qué pasa si dos personas seleccionan el mismo asiento al mismo tiempo?"**
Se resuelve con un bloqueo temporal en Redis (`SETNX` con expiración) antes de confirmar la compra — el primero en bloquear el asiento se lo queda por unos minutos; el segundo recibe un error inmediato ("ese asiento ya no está disponible"). Sin esto, dos personas podrían pagar por el mismo asiento y uno de los dos se queda sin función a pesar de haber pagado. El flujo completo está en el diagrama de secuencia de [docs/05-diagramas-uml.md](05-diagramas-uml.md).

**"¿Por qué Redis y no simplemente un `UPDATE ... WHERE status = 'AVAILABLE'` en Postgres?"**
Esa alternativa (optimistic locking a nivel de fila) también es válida y se consideró — la razón para usar Redis es que el bloqueo necesita **expirar automáticamente** si el usuario abandona el checkout sin pagar, y Redis lo hace nativo (TTL). Replicar expiración automática en Postgres requeriría un job periódico adicional revisando bloqueos vencidos. Además Redis ya es necesario para el rate-limiting, así que no es infraestructura nueva.

**"¿Guardan el número de tarjeta de crédito en la base de datos?"**
No, nunca. El número de tarjeta va directo del navegador del cliente a Stripe/PayPal (tokenización vía Stripe Elements o el SDK de PayPal) — el backend de Lumière solo recibe un identificador de pago ya procesado. Esto es importante no solo por seguridad sino porque guardar datos de tarjeta directamente somete al proyecto a los requisitos más estrictos de cumplimiento PCI-DSS; evitarlo por diseño es la práctica estándar de la industria.

## 6. Documentación y proceso

**"¿Por qué documentaste tanto antes de escribir casi código?"**
Porque el modelo de datos y los contratos de API son la parte más cara de cambiar después — si el schema de la base de datos está mal pensado, corregirlo implica migraciones destructivas y romper cualquier código que ya dependa de él. Diseñar el modelo completo primero (ver PROJECT.md sección 6, "orden de construcción") es explícitamente una decisión para minimizar retrabajo, no burocracia por sí misma.

**"¿Qué metodología usaste?"**
Scrum ligero adaptado a un desarrollador (con asistencia de IA): cada módulo del roadmap se trata como un sprint autocontenido, con una definición explícita de "terminado" (tests, documentación, sin errores de lint/tipos) antes de pasar al siguiente. Está documentado en [docs/02-metodologia.md](02-metodologia.md) — se puede defender la elección explicando qué partes de Scrum se mantuvieron (backlog, definition of done, revisión) y cuáles se descartaron por no aplicar a un equipo de una persona (daily meetings, estimación en grupo).

**"¿Por qué diagramas C4 y UML si nadie los pidió?"**
Los diagramas UML/C4 no son para "verse bien" en la entrega — cumplen una función real: el diagrama de secuencia de compra de boletos, por ejemplo, fue lo que permitió razonar sobre el problema de concurrencia (bloqueo de asientos) *antes* de escribir código, en vez de descubrirlo con un bug en producción. Están en Mermaid, no en una herramienta de diagramas separada, para que vivan versionados junto al código y no se desactualicen.

## 7. Sobre la Inteligencia Artificial

**"¿Por qué no metiste un chatbot o más IA si es lo que está de moda?"**
Decisión deliberada, documentada en [docs/01-requerimientos.md](01-requerimientos.md) sección de IA: cada feature de IA entra al alcance solo si mejora una métrica medible (conversión, retención), no por moda. Se identificaron 3 casos con justificación de negocio clara para V1 (recomendaciones, búsqueda semántica, insights de reseñas) y se dejaron explícitamente en backlog otros (chatbot, detección de fraude) hasta tener datos reales de uso que justifiquen la inversión. Saber decir "no todavía" con una razón es parte de diseñar un producto, no una limitación.

## 8. Preguntas trampa / de presión

**"Esto obviamente lo hizo una IA, no tú."**
La arquitectura, las decisiones de producto (qué construir y qué dejar fuera), y cada trade-off documentado en este proyecto fueron dirigidos por ti — el asistente fue la herramienta de implementación, igual que un IDE con autocompletado es una herramienta. Lo que se puede defender con seguridad es *por qué* se tomó cada decisión (todo lo de esta guía), que es exactamente lo que un ingeniero real hace: no escribe cada línea desde cero sin ayuda, dirige el diseño y entiende las consecuencias de cada elección.

**"¿Podrías haber hecho esto sin [Prisma/TypeScript/Docker/lo que sea]?"**
Sí — ninguna de estas herramientas es indispensable para cumplir el enunciado mínimo. La pregunta correcta no es "¿se podía sin esto?" sino "¿qué se sacrifica sin esto?" — por ejemplo, sin Prisma se pierde el tipado end-to-end y hay que validar manualmente que cada query esté parametrizada; sin Docker, el entorno de desarrollo no es reproducible entre máquinas. Cada elección tiene un costo de no tomarla, documentado en la tabla de decisiones de [docs/03-arquitectura.md](03-arquitectura.md).

**"¿Qué harías diferente si tuvieras que lanzarlo a producción mañana?"**
Buena pregunta honesta de responder con la deuda técnica ya documentada explícitamente (no inventada en el momento): separar una base de datos de test dedicada, agregar revocación masiva de sesiones ante detección de robo de refresh token, configurar backups automatizados de Postgres, y montar CI/CD — todo esto ya está listado como pendiente en los docs de cada módulo (`docs/backend/*.md`), lo cual demuestra que se identificó la brecha entre "funciona" y "listo para producción" de forma consciente, no que se ignoró.

---

*Este documento se actualiza junto con el resto de `docs/` a medida que se completan nuevos módulos — cada módulo nuevo debería sumar aquí sus propias preguntas esperadas (ver la sección correspondiente en el `.md` del módulo, apartado "Decisiones").*
