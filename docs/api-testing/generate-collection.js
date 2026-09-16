#!/usr/bin/env node
/**
 * Genera Lumiere.postman_collection.json (Postman v2.1, importable directo
 * en EchoAPI) a partir de una definicion declarativa de cada endpoint real
 * del backend. Se regenera este archivo, no se edita el JSON a mano, cada
 * vez que se agregue/cambie un endpoint - ver docs/08-guia-pruebas-api.md.
 *
 * Uso: node docs/api-testing/generate-collection.js
 */
const fs = require("node:fs");
const path = require("node:path");

let itemIdCounter = 0;
function uid() {
  itemIdCounter += 1;
  return `lumiere-${itemIdCounter}`;
}

function jsonBody(obj) {
  return {
    mode: "raw",
    raw: JSON.stringify(obj, null, 2),
    options: { raw: { language: "json" } },
  };
}

/**
 * @param {string} name
 * @param {"GET"|"POST"|"PATCH"|"DELETE"} method
 * @param {string} urlPath - relativo a {{baseUrl}}, ej "/movies/{{movieId}}"
 * @param {object} [opts]
 */
function req(name, method, urlPath, opts = {}) {
  const { body, csrf, description, tests, query } = opts;

  const headers = [];
  if (body) headers.push({ key: "Content-Type", value: "application/json" });
  if (csrf) headers.push({ key: "x-csrf-token", value: "{{csrfToken}}" });

  // No codificar valores que sean referencias a variables de coleccion
  // ({{movieId}}) - encodeURIComponent convertiria las llaves a %7B%7D
  // ANTES de que Postman/Newman pueda resolverlas, dejando el literal
  // "{{movieId}}" sin sustituir en la URL final.
  const encodeQueryValue = (v) => (/^\{\{.*\}\}$/.test(String(v)) ? v : encodeURIComponent(v));

  let rawUrl = `{{baseUrl}}${urlPath}`;
  if (query) {
    const qs = Object.entries(query)
      .map(([k, v]) => `${k}=${encodeQueryValue(v)}`)
      .join("&");
    rawUrl += `?${qs}`;
  }

  const event = [];
  if (tests) {
    event.push({
      listen: "test",
      script: { type: "text/javascript", exec: tests.split("\n") },
    });
  }

  return {
    id: uid(),
    name,
    event: event.length ? event : undefined,
    request: {
      method,
      header: headers,
      body: body ? jsonBody(body) : undefined,
      // string plano, NO { raw: ... } - el objeto rompe la resolucion de
      // variables {{...}} en Newman 6.2.2 (verificado: ver
      // docs/08-guia-pruebas-api.md incidente de generacion).
      url: rawUrl,
      description,
    },
    response: [],
  };
}

function folder(name, items, description) {
  return { id: uid(), name, description, item: items };
}

// ---------------------------------------------------------------------------
// Scripts de test reutilizables
// ---------------------------------------------------------------------------

const CAPTURE_CSRF = `
pm.test("Respuesta exitosa", () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));
const csrf = pm.cookies.get("csrf_token");
if (csrf) pm.collectionVariables.set("csrfToken", csrf);
`.trim();

function expectStatus(code, label) {
  return `pm.test("${label ?? `Responde ${code}`}", () => pm.response.to.have.status(${code}));`;
}

function captureId(varName, jsonPath, label) {
  return `
pm.test("${label ?? "Creado correctamente"}", () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));
const body = pm.response.json();
const value = ${jsonPath};
if (value) pm.collectionVariables.set("${varName}", value);
`.trim();
}

// ---------------------------------------------------------------------------
// 0. Autenticacion
// ---------------------------------------------------------------------------

const auth = folder(
  "0. Autenticación",
  [
    req("Registrar cliente nuevo", "POST", "/auth/register", {
      body: {
        email: "cliente.postman@lumiere.test",
        password: "Prueba2026!",
        firstName: "Cliente",
        lastName: "Postman",
      },
      tests: CAPTURE_CSRF,
      description: "Crea un CUSTOMER nuevo y arranca sesion. Password debe tener 8+ caracteres, mayuscula, minuscula y numero.",
    }),
    req("Ver mi perfil", "GET", "/auth/me", {
      tests: expectStatus(200),
    }),
    req("Refrescar sesión", "POST", "/auth/refresh", {
      csrf: true,
      tests: CAPTURE_CSRF + "\n" + 'pm.test("Rota el refresh token", () => pm.response.to.have.status(200));',
      description: "Rota el refresh token (el anterior queda invalido). Requiere haber iniciado sesion antes.",
    }),
    req("Cerrar sesión", "POST", "/auth/logout", {
      csrf: true,
      tests: expectStatus(204) + "\npm.collectionVariables.set(\"csrfToken\", \"\");",
      description: "Revoca el refresh token actual.",
    }),
  ],
  "El login como admin/cliente/taquilla se demuestra en vivo dentro del primer folder que realmente necesita cada rol (Catálogo, Reservas, Taquilla) - evita logins redundantes que agotarían el rate limiter de /auth/login (10 intentos/15min) en una corrida completa de la colección. Ver docs/08-guia-pruebas-api.md.",
);

// ---------------------------------------------------------------------------
// 1. Catalogo: generos, personas, peliculas, opiniones
// ---------------------------------------------------------------------------

const catalogo = folder("1. Catálogo (películas, personas, géneros, opiniones)", [
  req("Listar géneros (público)", "GET", "/genres", { tests: expectStatus(200) }),
  req("[Admin] Re-autenticar", "POST", "/auth/login", {
    body: { email: "admin@lumiere.test", password: "Lumiere2026!" },
    tests: CAPTURE_CSRF,
  }),
  req("Crear género", "POST", "/genres", {
    csrf: true,
    body: { name: "Género de prueba Postman" },
    tests: captureId("genreId", "body.genre?.id", "Género creado"),
  }),
  req("Crear persona (director/actor)", "POST", "/people", {
    csrf: true,
    body: { firstName: "Persona", lastName: "De Prueba" },
    tests: captureId("personId", "body.person?.id", "Persona creada"),
  }),
  req("Listar personas (búsqueda)", "GET", "/people", {
    query: { search: "Prueba", pageSize: 10 },
    tests: expectStatus(200),
  }),
  req("Detalle de persona (contador de películas)", "GET", "/people/{{personId}}", {
    tests: expectStatus(200),
  }),
  req("Listar clasificaciones (público)", "GET", "/ratings", {
    tests: captureId("ratingId", "body.ratings?.[0]?.id", "Lista clasificaciones"),
  }),
  req("Listar idiomas (público)", "GET", "/languages", {
    tests: captureId("languageId", "body.languages?.[0]?.id", "Lista idiomas"),
  }),
  req("Crear película", "POST", "/movies", {
    csrf: true,
    body: {
      title: "Película de prueba Postman",
      synopsis: "Sinopsis de prueba generada por la colección de EchoAPI/Postman.",
      durationMinutes: 100,
      releaseYear: 2026,
      countryOfOrigin: "México",
      status: "IN_THEATERS",
      ratingId: "{{ratingId}}",
      originalLanguageId: "{{languageId}}",
      genreIds: ["{{genreId}}"],
      credits: [{ personId: "{{personId}}", creditRole: "DIRECTOR", billingOrder: 0 }],
    },
    tests: captureId("movieId", "body.movie?.id", "Película creada"),
    description: "Falla con 422 si no hay al menos un DIRECTOR en credits (regla de negocio validada con Zod).",
  }),
  req("Listar películas (público, filtros)", "GET", "/movies", {
    query: { status: "IN_THEATERS", pageSize: 20 },
    tests: expectStatus(200),
  }),
  req("Detalle de película (público)", "GET", "/movies/{{movieId}}", { tests: expectStatus(200) }),
  req("Actualizar película (archivar, por ejemplo)", "PATCH", "/movies/{{movieId}}", {
    csrf: true,
    body: { status: "IN_THEATERS" },
    tests: expectStatus(200),
  }),
  req("Dejar una reseña", "POST", "/movies/{{movieId}}/reviews", {
    csrf: true,
    body: { rating: 5, comment: "Excelente, generado por la colección de pruebas." },
    tests: captureId("reviewId", "body.review?.id", "Reseña creada"),
  }),
  req("Listar reseñas de una película (público)", "GET", "/movies/{{movieId}}/reviews", {
    tests: expectStatus(200),
  }),
  req("Editar mi reseña", "PATCH", "/reviews/{{reviewId}}", {
    csrf: true,
    body: { rating: 4 },
    tests: expectStatus(200),
  }),
  req("Moderar reseña (ocultar)", "PATCH", "/reviews/{{reviewId}}/moderate", {
    csrf: true,
    body: { isApproved: false },
    tests: expectStatus(200),
  }),
]);

// ---------------------------------------------------------------------------
// 2. Cines y salas
// ---------------------------------------------------------------------------

const cines = folder(
  "2. Cines y salas",
  [
  req("Listar tipos de butaca (público)", "GET", "/seat-types", {
    tests: captureId("seatTypeId", "body.seatTypes?.[0]?.id", "Lista tipos de butaca"),
  }),
  req("Crear cine", "POST", "/cinemas", {
    csrf: true,
    body: {
      name: "Cine de prueba Postman",
      address: "Av. Prueba 123",
      city: "Ciudad de México",
      state: "CDMX",
      country: "México",
      phone: "5555550199",
    },
    tests: captureId("cinemaId", "body.cinema?.id", "Cine creado"),
  }),
  req("Listar cines (público)", "GET", "/cinemas", { query: { pageSize: 20 }, tests: expectStatus(200) }),
  req("Detalle de cine (público)", "GET", "/cinemas/{{cinemaId}}", { tests: expectStatus(200) }),
  req("Actualizar cine", "PATCH", "/cinemas/{{cinemaId}}", {
    csrf: true,
    body: { phone: "5555550200" },
    tests: expectStatus(200),
  }),
  req("Crear sala (con mapa de butacas)", "POST", "/cinemas/{{cinemaId}}/rooms", {
    csrf: true,
    body: {
      name: "Sala Postman",
      roomType: "STANDARD",
      rows: [{ rowLabel: "A", seatCount: 6, seatTypeId: "{{seatTypeId}}" }],
    },
    tests: captureId("roomId", "body.room?.id", "Sala creada (totalCapacity calculado por el backend, no se envía)"),
  }),
  req("Listar salas de un cine (público)", "GET", "/cinemas/{{cinemaId}}/rooms", { tests: expectStatus(200) }),
  req("Detalle de sala + mapa de butacas físico (público)", "GET", "/rooms/{{roomId}}", {
    tests: expectStatus(200),
  }),
  req("Actualizar sala (nombre/tipo, no el layout)", "PATCH", "/rooms/{{roomId}}", {
    csrf: true,
    body: { name: "Sala Postman renombrada" },
    tests: expectStatus(200),
  }),
]);

// ---------------------------------------------------------------------------
// 3. Funciones
// ---------------------------------------------------------------------------

const funciones = folder("3. Funciones", [
  req("Crear función", "POST", "/showtimes", {
    csrf: true,
    body: {
      movieId: "{{movieId}}",
      roomId: "{{roomId}}",
      audioLanguageId: "{{languageId}}",
      startTime: "2027-01-15T20:00:00.000Z",
      basePrice: 95,
      format: "TWO_D",
    },
    tests: captureId("showtimeId", "body.showtime?.id", "Función creada (endTime calculado por el backend)"),
    description: "Cambia startTime a una fecha futura real antes de correr. Falla con 409 si se cruza con otra función en la misma sala.",
  }),
  req("Listar funciones (público, filtros)", "GET", "/showtimes", {
    query: { movieId: "{{movieId}}", pageSize: 20 },
    tests: expectStatus(200),
  }),
  req("Detalle de función (público, incluye disponibilidad)", "GET", "/showtimes/{{showtimeId}}", {
    tests: expectStatus(200),
  }),
  req("Actualizar función (precio/estado)", "PATCH", "/showtimes/{{showtimeId}}", {
    csrf: true,
    body: { basePrice: 99 },
    tests: expectStatus(200),
  }),
]);

// ---------------------------------------------------------------------------
// 4. Productos (dulceria) - va ANTES de Reservas porque "Crear orden" usa
// {{productId}} (combo) en el body; si Productos corriera despues, la orden
// se crearia con productId: "" y Zod la rechazaria con 422.
// ---------------------------------------------------------------------------

const productos = folder("4. Productos (dulcería)", [
  req("Crear producto", "POST", "/products", {
    csrf: true,
    body: { name: "Combo de prueba Postman", description: "Palomitas + refresco", price: 79, isActive: true },
    tests: captureId("productId", "body.product?.id", "Producto creado"),
  }),
  req("Listar productos activos (público)", "GET", "/products", { tests: expectStatus(200) }),
  req("Actualizar producto (precio)", "PATCH", "/products/{{productId}}", {
    csrf: true,
    body: { price: 85 },
    tests: expectStatus(200),
    description: "No se desactiva aquí a propósito: el folder de Reservas todavía necesita comprar {{productId}} como combo.",
  }),
]);

// ---------------------------------------------------------------------------
// 5. Promociones (gestion)
// ---------------------------------------------------------------------------

const promociones = folder("5. Promociones (gestión)", [
  req("Listar promociones activas (público)", "GET", "/promotions", { tests: expectStatus(200) }),
  req("Crear promoción", "POST", "/promotions", {
    csrf: true,
    body: {
      name: "Promo de prueba Postman",
      code: "POSTMAN20",
      discountType: "PERCENTAGE",
      discountValue: 20,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2027-01-01T00:00:00.000Z",
      isActive: true,
      rules: [],
    },
    tests: captureId("promotionId", "body.promotion?.id", "Promoción creada (rules: [] = global)"),
  }),
  req("Detalle de promoción (público)", "GET", "/promotions/{{promotionId}}", { tests: expectStatus(200) }),
  req("Actualizar promoción", "PATCH", "/promotions/{{promotionId}}", {
    csrf: true,
    body: { isActive: false },
    tests: expectStatus(200),
  }),
]);

// ---------------------------------------------------------------------------
// 6. Reservas: mapa de butacas, bloqueo, ordenes
// ---------------------------------------------------------------------------

const reservas = folder("6. Motor de reservas (butacas y órdenes)", [
  req("[Cliente] Re-autenticar", "POST", "/auth/login", {
    body: { email: "cliente@lumiere.test", password: "Lumiere2026!" },
    tests: CAPTURE_CSRF,
  }),
  req("Mapa de butacas de la función (público)", "GET", "/showtimes/{{showtimeId}}/seats", {
    tests: captureId(
      "showtimeSeatId",
      'body.seats?.find(s => s.status === "AVAILABLE")?.id',
      "Captura la primera butaca AVAILABLE",
    ),
  }),
  req("Bloquear butaca(s)", "POST", "/showtimes/{{showtimeId}}/seats/lock", {
    csrf: true,
    body: { seatIds: ["{{showtimeSeatId}}"] },
    tests:
      expectStatus(200) +
      '\npm.test("Devuelve lockExpiresAt", () => pm.expect(pm.response.json().lockExpiresAt).to.exist);',
    description: "Responde 409 si otro usuario ya la tiene bloqueada/vendida - correr dos veces con sesiones distintas para probar la concurrencia real (ver docs/backend/05-reservas.md).",
  }),
  req("Liberar butaca(s)", "POST", "/showtimes/{{showtimeId}}/seats/release", {
    csrf: true,
    body: { seatIds: ["{{showtimeSeatId}}"] },
    tests: expectStatus(200),
    description: "Correr esta request DESPUÉS de crear la orden si se quiere probar liberar; si no, saltarla y seguir directo a 'Crear orden' con la butaca todavía bloqueada.",
  }),
  req("Re-bloquear para crear la orden", "POST", "/showtimes/{{showtimeId}}/seats/lock", {
    csrf: true,
    body: { seatIds: ["{{showtimeSeatId}}"] },
    tests: expectStatus(200),
  }),
  req("Validar código de promoción", "POST", "/promotions/validate", {
    body: { code: "BIENVENIDA", showtimeId: "{{showtimeId}}" },
    tests: expectStatus(200),
    description: "Usa el código sembrado por prisma/seed-demo.ts. 404 si el código no existe o no aplica a esta función.",
  }),
  req("Crear orden (butacas + combo + promoción)", "POST", "/orders", {
    csrf: true,
    body: {
      showtimeId: "{{showtimeId}}",
      seatIds: ["{{showtimeSeatId}}"],
      promotionCode: "BIENVENIDA",
      items: [{ productId: "{{productId}}", quantity: 1 }],
    },
    tests: captureId("orderId", "body.order?.id", "Orden creada en PENDING"),
    description: "Responde 409 si las butacas no están bloqueadas por este mismo usuario (o el bloqueo ya expiró).",
  }),
  req("Ver detalle de mi orden", "GET", "/orders/{{orderId}}", { tests: expectStatus(200) }),
  req("Listar mis órdenes", "GET", "/orders/me", { query: { pageSize: 20 }, tests: expectStatus(200) }),
]);

// ---------------------------------------------------------------------------
// 7. Pagos - misma sesion CUSTOMER que Reservas, sin re-login. La orden
// llega PENDING e intacta (no se cancela en Reservas) para poder pagarla.
// ---------------------------------------------------------------------------

const pagos = folder("7. Pagos", [
  req("Pagar orden (Stripe)", "POST", "/orders/{{orderId}}/pay", {
    csrf: true,
    body: { provider: "STRIPE", source: "pm_test_visa" },
    tests: `pm.test("Responde (200 si hay credenciales reales, 402 si no)", () => pm.expect(pm.response.code).to.be.oneOf([200, 402]));`,
    description:
      "Sin STRIPE_SECRET_KEY real configurada, esto responde 402 con un mensaje claro (no un 500 crudo) y la butaca sigue reservada - ver docs/backend/09-pagos.md. Con credenciales sandbox reales, responde 200 y marca la orden PAID.",
  }),
  req("Reembolsar orden pagada", "POST", "/orders/{{orderId}}/refund", {
    csrf: true,
    tests: `pm.test("Solo aplica sobre ordenes PAID", () => pm.expect(pm.response.code).to.be.oneOf([200, 409, 502]));`,
    description: "409 si la orden no está PAID (esperado si el paso anterior devolvió 402, ya que no hay credenciales Stripe reales configuradas).",
  }),
  req("Cancelar orden (libera butacas)", "POST", "/orders/{{orderId}}/cancel", {
    csrf: true,
    tests: `pm.test("200 si sigue PENDING, 409 si ya quedó PAID/CANCELLED por los pasos anteriores", () => pm.expect(pm.response.code).to.be.oneOf([200, 409]));`,
    description: "Se corre al final del flujo de Pagos (no antes) para no vaciar una orden que la propia colección todavía necesita pagar/reembolsar.",
  }),
]);

// ---------------------------------------------------------------------------
// 8. Taquilla - requiere cambiar de rol (BOX_OFFICE), si hace falta re-login
// ---------------------------------------------------------------------------

const taquilla = folder("8. Taquilla (validación de boletos)", [
  req("[Taquilla] Re-autenticar", "POST", "/auth/login", {
    body: { email: "taquilla@lumiere.test", password: "Lumiere2026!" },
    tests: CAPTURE_CSRF,
  }),
  req("Validar boleto pagado de la demo", "POST", "/tickets/validate", {
    csrf: true,
    body: { qrCode: "LMR-DEMO0001" },
    tests: `pm.test("200 la primera vez, 409 si ya se corrio antes", () => pm.expect(pm.response.code).to.be.oneOf([200, 409]));`,
    description: "Boleto sembrado por prisma/seed-demo.ts. Correrlo una segunda vez debe dar 409 (canje de un solo uso).",
  }),
]);

// ---------------------------------------------------------------------------
// 9. Reporteria - requiere volver a ADMIN, si hace falta re-login
// ---------------------------------------------------------------------------

const reportes = folder("9. Reportería", [
  req("[Admin] Re-autenticar", "POST", "/auth/login", {
    body: { email: "admin@lumiere.test", password: "Lumiere2026!" },
    tests: CAPTURE_CSRF,
  }),
  req("Películas más vistas", "GET", "/reports/most-viewed-movies", { query: { limit: 10 }, tests: expectStatus(200) }),
  req("Horarios de mayor demanda", "GET", "/reports/peak-demand", { tests: expectStatus(200) }),
  req("Efectividad de promociones", "GET", "/reports/promotion-effectiveness", {
    query: { limit: 10 },
    tests: expectStatus(200),
  }),
]);

// ---------------------------------------------------------------------------
// 10. Seguridad - pruebas negativas explicitas
// ---------------------------------------------------------------------------

const seguridad = folder(
  "10. Seguridad — pruebas negativas",
  [
    req("① Cerrar sesión (quedar sin cookies)", "POST", "/auth/logout", {
      csrf: true,
      tests: `pm.test("204 o 401 si ya no habia sesion", () => pm.expect(pm.response.code).to.be.oneOf([204, 401]));`,
    }),
    req("② 401 — endpoint protegido sin sesión", "GET", "/orders/me", {
      tests: expectStatus(401, "Sin cookie de sesión -> 401"),
    }),
    req("③ 401 — crear película sin sesión", "POST", "/movies", {
      body: { title: "no debería crearse" },
      tests: expectStatus(401, "Mutación sin sesión -> 401 (ni siquiera llega a validar el body)"),
    }),
    req("④ Re-autenticar como CUSTOMER", "POST", "/auth/login", {
      body: { email: "cliente@lumiere.test", password: "Lumiere2026!" },
      tests: CAPTURE_CSRF,
    }),
    req("⑤ 403 — CUSTOMER intenta crear cine (RBAC)", "POST", "/cinemas", {
      csrf: true,
      body: { name: "x", address: "x", city: "x", state: "x", country: "x" },
      tests: expectStatus(403, "Rol CUSTOMER contra endpoint SUPER_ADMIN -> 403 (nunca se confía en el rol del cliente)"),
    }),
    req("⑥ 403 — CUSTOMER intenta ver reportería", "GET", "/reports/most-viewed-movies", {
      tests: expectStatus(403, "Reportería es inteligencia de negocio, nunca pública"),
    }),
    req("⑦ 403 — CSRF ausente en mutación con sesión válida", "POST", "/orders/{{orderId}}/cancel", {
      tests: expectStatus(403, "Cookie de sesión presente pero SIN header X-CSRF-Token -> 403 (double-submit cookie)"),
      description: "A propósito no se envía el header x-csrf-token en esta request - compárala con la misma llamada en el folder de Reservas, que sí lo incluye.",
    }),
    req("⑧a Re-autenticar como ADMIN (para aislar Zod de RBAC)", "POST", "/auth/login", {
      body: { email: "admin@lumiere.test", password: "Lumiere2026!" },
      tests: CAPTURE_CSRF,
      description: "Con sesión CUSTOMER, /movies ya responde 403 por RBAC antes de llegar a Zod - para probar la validación de Zod en sí (no RBAC, ya cubierto en ⑤/⑥) hace falta un rol que SÍ tenga permiso para crear películas.",
    }),
    req("⑧b 422 — validación de entrada (Zod)", "POST", "/movies", {
      csrf: true,
      body: { title: "" },
      tests: expectStatus(422, "Body incompleto/invalido -> 422 con detalle de campos, nunca se ejecuta contra la base de datos"),
    }),
    req("⑨ Intento de inyección SQL en un filtro de texto", "GET", "/movies", {
      query: { search: "'; DROP TABLE movies; --" },
      tests:
        expectStatus(200, "Prisma parametriza la query - el string se trata como texto literal, nunca como SQL") +
        '\npm.test("La tabla sigue existiendo (no hay 500)", () => pm.expect(pm.response.json().items).to.be.an("array"));',
      description: "Prueba manual de que Prisma previene inyección SQL por diseño (ver docs/06-seguridad.md) - debe responder 200 con una lista vacía o filtrada, nunca un error de base de datos.",
    }),
    req("⑩ 404 — UUID válido pero inexistente (no enumerable)", "GET", "/movies/00000000-0000-0000-0000-000000000000", {
      tests: expectStatus(404, "IDs son UUID, no enumerables secuencialmente (ver docs/04-modelo-datos.md)"),
    }),
    req("⑪ Rate limit de login (correr 11+ veces seguidas)", "POST", "/auth/login", {
      body: { email: "cliente@lumiere.test", password: "ContraseñaIncorrecta1" },
      tests: `pm.test("429 despues del intento 10 en 15 min", () => pm.expect(pm.response.code).to.be.oneOf([401, 429]));`,
      description:
        "Usa el Collection Runner con 12 iteraciones sobre ESTA request. Los primeros ~10 intentos deben dar 401 (credenciales incorrectas); a partir del intento 11 debe dar 429 (Too Many Requests) - ver authRateLimiter en docs/06-seguridad.md.",
    }),
  ],
  "Cada request de este folder documenta explícitamente qué control de docs/06-seguridad.md está probando. Correr en orden.",
);

// ---------------------------------------------------------------------------

const collection = {
  info: {
    _postman_id: "b6a10c00-0000-4000-a000-lumiere000001",
    name: "Lumière — API completa",
    description:
      "Colección importable en Postman o EchoAPI (compatibles) con los endpoints reales del backend de Lumière, agrupados por módulo, más un folder dedicado de pruebas de seguridad negativas. Ver docs/08-guia-pruebas-api.md para la guía de uso completa.\n\nRequiere el backend corriendo (`pnpm dev:backend`) y los datos de demostración sembrados (`pnpm --filter @lumiere/backend prisma:seed-demo`).",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [auth, catalogo, cines, funciones, productos, promociones, reservas, pagos, taquilla, reportes, seguridad],
  variable: [
    { key: "baseUrl", value: "http://localhost:4000/api/v1" },
    { key: "csrfToken", value: "" },
    { key: "genreId", value: "" },
    { key: "personId", value: "" },
    { key: "ratingId", value: "" },
    { key: "languageId", value: "" },
    { key: "movieId", value: "" },
    { key: "reviewId", value: "" },
    { key: "seatTypeId", value: "" },
    { key: "cinemaId", value: "" },
    { key: "roomId", value: "" },
    { key: "showtimeId", value: "" },
    { key: "showtimeSeatId", value: "" },
    { key: "orderId", value: "" },
    { key: "promotionId", value: "" },
    { key: "productId", value: "" },
  ],
};

const outPath = path.join(__dirname, "Lumiere.postman_collection.json");
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2) + "\n");

const totalRequests = collection.item.reduce((sum, f) => sum + f.item.length, 0);
console.log(`Generado: ${outPath}`);
console.log(`Folders: ${collection.item.length} · Requests totales: ${totalRequests}`);
