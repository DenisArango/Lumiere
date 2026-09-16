# Guía de pruebas de la API (EchoAPI / Postman)

Esta guía explica cómo el ingeniero evaluador puede validar **todos los endpoints reales del backend** y **los controles de seguridad implementados**, sin tener que leer el código fuente para saber qué probar.

Todo lo descrito aquí se generó y se verificó ejecutándolo de verdad contra el backend corriendo en local (con [Newman](https://github.com/postmanlabs/newman), el runner oficial de línea de comandos de Postman) — no es una colección escrita a mano y nunca probada.

**Camino más rápido y confiable** — desde la raíz del repo, con el backend corriendo:

```bash
pnpm test:api
```

Regenera la colección desde cero y la corre completa contra el backend real. Debe terminar en `73/73 assertions`, `0 failed`. Si quieres repetirlo, limpia primero los datos de la corrida anterior con `pnpm --filter @lumiere/backend prisma:cleanup-postman` (ver sección 3).

## 1. Qué es esto

[`docs/api-testing/Lumiere.postman_collection.json`](api-testing/Lumiere.postman_collection.json) es una colección **Postman v2.1**, el mismo formato que importa EchoAPI. Contiene:

- **70 requests** agrupadas en **11 folders**, uno por módulo del backend (catálogo, cines, funciones, reservas, pagos, promociones, productos, taquilla, reportería) más autenticación.
- Un folder final, **"10. Seguridad — pruebas negativas"**, con 11 requests que prueban explícitamente que cada control de seguridad rechaza lo que debe rechazar (no solo que lo "feliz" funciona).
- Scripts de test (`pm.test(...)`) en cada request que verifican el código de estado esperado y, cuando aplica, encadenan el resultado a la siguiente request (por ejemplo, el `id` de una película recién creada se guarda en una variable de colección y se reutiliza en las siguientes 6 requests).

No se generó a mano: se generó con [`docs/api-testing/generate-collection.js`](api-testing/generate-collection.js), un script de Node que declara cada endpoint una sola vez y produce el JSON. Si el backend gana un endpoint nuevo, se agrega ahí y se regenera con:

```bash
node docs/api-testing/generate-collection.js
```

## 2. Importar en EchoAPI (o Postman)

1. Abre EchoAPI → **Importar** → selecciona el archivo `docs/api-testing/Lumiere.postman_collection.json`.
2. EchoAPI reconoce el formato Postman v2.1 nativamente — se importan las 11 carpetas, las 70 requests y las 16 variables de colección de una vez.
3. Verifica que la variable de colección `baseUrl` apunte a `http://localhost:4000/api/v1` (o cambia el valor si el backend corre en otro puerto).
4. El backend debe estar corriendo (`pnpm dev:backend`) y los datos de demostración sembrados:
   ```bash
   pnpm --filter @lumiere/backend prisma:seed
   pnpm --filter @lumiere/backend prisma:seed-demo
   ```

> **Nota sobre el Runner en bloque de EchoAPI**: en pruebas reales se encontró que el modo "Run collection"/Runner de EchoAPI (botón ▶ con Iterations/Environment) no siempre propaga la cookie de sesión recién puesta por una request a la siguiente request dentro de la misma corrida — el síntoma es `"Usuario no encontrado"` justo después de un `register`/`login` exitoso. Esto **no** es un problema del backend ni de la colección (con Newman, el runner oficial de Postman, la misma colección corre 73/73 sin fallos). Si te pasa esto en EchoAPI: (a) usa `pnpm test:api` para la verificación automatizada confiable, o (b) corre las requests **una por una, en orden, con clics manuales** dentro de cada folder — así sí se actualiza la cookie correctamente entre pasos, y de paso es la forma natural de hacer una demo en vivo.

## 3. Orden recomendado de ejecución

Los folders están numerados (`0.` a `10.`) en el **orden en que deben correr**, de un tirón, con el botón "Run collection" / "Ejecutar colección". El orden no es arbitrario — cada folder deja variables listas (`{{movieId}}`, `{{cinemaId}}`, `{{showtimeId}}`, `{{productId}}`, `{{orderId}}`...) que el siguiente folder necesita. Por ejemplo, "Crear orden" en el folder 6 necesita `{{productId}}`, por eso el folder 4 (Productos) corre *antes* que el folder 6 (Reservas), no después.

También se minimizaron los logins repetidos: cada folder reutiliza la sesión (cookies) del folder anterior mientras el rol no cambie, y solo vuelve a autenticar cuando el siguiente paso de verdad necesita otro rol (de ADMIN a CUSTOMER, de CUSTOMER a BOX_OFFICE, etc.). Esto es intencional: el rate limiter real de login (`authRateLimiter`, 10 intentos/15 min por IP) se aplica también a este flujo de pruebas, y una corrida completa hace solo 8 llamadas a `/auth/login` o `/auth/register`, cómodamente por debajo del límite.

**Si necesitas correr la colección completa más de una vez** (por ejemplo, para repetir la demo), los `POST` de creación usan nombres/códigos fijos ("Película de prueba Postman", código de promoción `POSTMAN20`, etc.) para que las descripciones sean legibles — eso significa que una segunda corrida choca con `409 Conflict` contra los registros que dejó la primera. Antes de repetir la corrida completa:

```bash
pnpm --filter @lumiere/backend prisma:cleanup-postman
```

Este script borra únicamente los registros que crea la colección (identificados por esos nombres fijos) y no toca los datos de `prisma/seed.ts` ni de `prisma/seed-demo.ts` (las cuentas de prueba, la demo de "Estación Lumière", el boleto `LMR-DEMO0001`, etc.).

## 4. Qué corrobora cada folder

| Folder | Qué prueba | Nota |
|---|---|---|
| 0. Autenticación | Registro, perfil, refresh (rotación de token), logout | El login de cada rol se demuestra en vivo en el primer folder que lo necesita, no aquí |
| 1. Catálogo | Géneros, personas, películas (con la regla de negocio "necesita al menos un DIRECTOR"), reseñas y su moderación | |
| 2. Cines y salas | CRUD de cines y salas, incluyendo el mapa de butacas físico | El `totalCapacity` de la sala lo calcula el backend, nunca se envía desde el cliente |
| 3. Funciones | Crear/listar/actualizar funciones, con `endTime` calculado por el backend | Falla con `409` si se cruza con otra función en la misma sala |
| 4. Productos | CRUD de la dulcería/combos | Corre antes que Reservas porque el combo se compra ahí |
| 5. Promociones | CRUD de promociones | |
| 6. Motor de reservas | Mapa de butacas por función, bloqueo/liberación de butacas, validación de código de promoción, creación de orden (butacas + combo + promoción) | El bloqueo es el mecanismo real contra doble-venta — probar con dos sesiones distintas para ver el `409` de concurrencia |
| 7. Pagos | Cobro (Stripe), reembolso, cancelación de orden | Sin credenciales reales de Stripe, el cobro responde `402` con un mensaje claro (no un `500` crudo) y la butaca sigue reservada — comportamiento esperado y documentado |
| 8. Taquilla | Validación/canje de boleto por código QR | Usa el boleto ya pagado `LMR-DEMO0001` sembrado por `seed-demo.ts`; canjearlo dos veces debe dar `409` (un solo uso) |
| 9. Reportería | Películas más vistas, horarios de mayor demanda, efectividad de promociones | Solo accesible para ADMIN |

## 5. Folder 10 — Seguridad: mapeo a los controles reales

Cada request de este folder está numerada y documenta explícitamente, en su propia descripción, qué control de [`docs/06-seguridad.md`](06-seguridad.md) está ejercitando:

| # | Qué hace | Control probado |
|---|---|---|
| ① | Cierra sesión (revoca el refresh token) | Logout real, no solo borrar la cookie del lado del cliente |
| ② | `GET /orders/me` sin cookie de sesión | `401` — autenticación obligatoria en rutas protegidas |
| ③ | `POST /movies` sin sesión | `401` — una mutación nunca llega a validar el body si no hay sesión |
| ④ | Login como CUSTOMER | Prepara los dos siguientes casos de RBAC |
| ⑤ | CUSTOMER intenta `POST /cinemas` | `403` — RBAC real por rol, nunca se confía en lo que dice el cliente |
| ⑥ | CUSTOMER intenta ver reportería | `403` — la reportería es inteligencia de negocio, nunca pública |
| ⑦ | Mutación con sesión válida pero **sin** header `x-csrf-token` | `403` — patrón *double-submit cookie*; compárala con la misma llamada en el folder de Reservas, que sí manda el header |
| ⑧ | Re-autentica como ADMIN y envía `POST /movies` con `title: ""` | `422` — validación de entrada con Zod, aislada de RBAC (con sesión ADMIN, que sí tiene permiso, el único motivo de rechazo es el body inválido) |
| ⑨ | `GET /movies?search='; DROP TABLE movies; --` | `200` con resultados vacíos/filtrados, nunca un error de base de datos — Prisma parametriza las queries, el string se trata como texto literal |
| ⑩ | `GET /movies/00000000-0000-0000-0000-000000000000` | `404` — los IDs son UUID no enumerables secuencialmente, no hay forma de "recorrer" recursos por ID |
| ⑪ | Login con contraseña incorrecta | Documenta el rate limiter (`authRateLimiter`, 10/15min); para verlo disparar de verdad hay que correr **esta request en particular** con el Collection Runner y 12 iteraciones — los primeros ~10 intentos dan `401`, del 11 en adelante `429` |

## 6. Verificación real de esta colección

Esta colección se corrió con Newman contra el backend real como parte de su desarrollo, no solo se revisó el código. En el proceso se encontraron y corrigieron 5 problemas reales (documentados aquí para que quede el rastro, no para presumir):

1. El formato `url: { raw }` (objeto) rompe la resolución de variables `{{...}}` en Newman 6.2.2 — se corrigió a `url` como string plano.
2. Los valores de query que son variables de colección (`{{movieId}}`) se estaban codificando con `encodeURIComponent` antes de que Postman pudiera sustituirlas, dejando el literal `%7B%7BmovieId%7D%7D` en la URL final — se agregó una guarda para no codificar referencias a variables.
3. El folder de Productos corría *después* del de Reservas, pero "Crear orden" ya necesitaba `{{productId}}` — se reordenó.
4. El paso "Actualizar producto" desactivaba (`isActive: false`) el mismo producto que el folder de Reservas necesitaba comprar después, causando un `404` real y correcto del backend (no vende productos inactivos) — se cambió el test para actualizar el precio en vez de desactivar.
5. El folder de Reservas cancelaba la orden justo antes de que el folder de Pagos intentara cobrarla, causando un `409` — se movió la prueba de cancelación al final del folder de Pagos.

La corrida final, limpia, pasa **73/73 aserciones en las 70 requests**.
