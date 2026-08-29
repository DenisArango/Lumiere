# Backend — Módulo: Auth + RBAC

**Fase**: 2 — Auth + RBAC · **Estado**: Completo y verificado de punta a punta · **Fecha**: 2026-08-29

## Qué se construyó

Endpoints (`/api/v1/auth`):

| Endpoint | Método | Protección | Descripción |
|---|---|---|---|
| `/register` | POST | rate-limit auth | Crea usuario (`CUSTOMER` por defecto), inicia sesión automáticamente |
| `/login` | POST | rate-limit auth | Verifica credenciales, inicia sesión |
| `/refresh` | POST | CSRF | Rota el refresh token y emite un nuevo access token |
| `/logout` | POST | CSRF | Revoca el refresh token actual y limpia cookies |
| `/me` | GET | `authenticate` | Devuelve el usuario de la sesión activa |

Archivos nuevos clave:
- `src/lib/jwt.ts` — firma/verifica el access token (JWT corto, `JWT_ACCESS_EXPIRES_IN`).
- `src/lib/refresh-token.ts` — refresh token **opaco** (no JWT): 48 bytes aleatorios, solo se persiste su hash SHA-256 en `refresh_tokens`. Permite revocación individual real.
- `src/lib/cookies.ts` — set/clear de las 3 cookies de sesión (`access_token`, `refresh_token` httpOnly; `csrf_token` no-httpOnly).
- `src/lib/csrf.ts` + `src/middleware/csrf.ts` — CSRF por *double-submit cookie*.
- `src/middleware/authenticate.ts` — valida el access token y llena `req.user`.
- `src/middleware/authorize.ts` — RBAC por rol, para usar junto a `authenticate` en rutas de otros módulos (`authorize("SUPER_ADMIN")`, etc.).
- `src/modules/auth/*` — schema Zod, service (lógica pura), controller (HTTP), routes.
- `src/utils/catch-async.ts` — envuelve controllers async para reenviar errores a `errorHandler` (Express 4 no lo hace solo).
- `src/types/express.d.ts` — añade `req.user: { id, role }` al tipo de Express Request.

## Decisiones de seguridad (por qué está hecho así)

1. **Refresh token opaco, no JWT.** Un JWT es autocontenido y no se puede "apagar" antes de su expiración sin una lista negra. Un token opaco cuyo hash vive en la base de datos se revoca con un simple `UPDATE` — necesario para logout real y para cortar una sesión comprometida.
2. **Rotación en cada refresh + detección de reuso.** Cada vez que se usa el refresh token, se revoca y se emite uno nuevo (ver test *"el refresh token rotado (anterior) ya no sirve"*). Si alguien reutiliza un refresh token ya rotado (señal de que fue robado), la request falla — en un sistema productivo esto además debería disparar una revocación de *todas* las sesiones del usuario (queda como mejora futura, ver sección de deuda técnica).
3. **Cookies httpOnly, no localStorage.** Ver decisión ya documentada en [docs/03-arquitectura.md](../03-arquitectura.md) tabla de decisiones técnicas.
4. **CSRF double-submit**, aplicado a `/refresh` y `/logout` (operan sobre una sesión ya existente), exento en `/login` y `/register` (todavía no hay sesión que un atacante pueda secuestrar en nombre de otro usuario).
5. **Mismo mensaje de error para "usuario no existe" y "contraseña incorrecta"** en login — evita enumeración de cuentas registradas.
6. **Argon2id** para hash de contraseñas (no bcrypt) — más resistente a cracking por GPU, es el ganador de la Password Hashing Competition.
7. **Rol siempre desde el JWT firmado por el servidor**, nunca del body/headers del cliente — el campo `role` viaja dentro del access token, no se puede falsificar sin la clave secreta del servidor.
8. **Rate limiting específico** en `/login` y `/register` (10 intentos / 15 min, vs 300 general) — mitiga fuerza bruta y ataques de credential stuffing.

## Verificación realizada

- [x] `npx tsc --noEmit` — sin errores.
- [x] `npx eslint src --ext .ts` — sin errores.
- [x] `npx jest` — **13/13 tests pasan** (`src/modules/auth/auth.test.ts`), cubriendo: contraseña débil rechazada, registro exitoso con cookies correctas, email duplicado rechazado, login con contraseña incorrecta, login exitoso, `/me` sin sesión (401) y con sesión (200), `/refresh` sin CSRF (403), `/refresh` con rotación exitosa, reuso de refresh token ya rotado (401), logout revoca la sesión.
- [x] Prueba manual contra el servidor real (`tsx src/server.ts`): `curl` register → cookies reales → `curl` `/me` con esas cookies → devuelve el usuario correcto. Usuario de prueba eliminado después.

## Deuda técnica / mejoras futuras (explícitas)

1. **Sin verificación de email.** El campo `emailVerifiedAt` existe en el modelo pero no hay flujo de verificación todavía (envío de correo, endpoint de confirmación). Se deja para cuando exista el proveedor de email configurado (ver `docs/03-arquitectura.md` sección de ambientes).
2. **Sin revocación masiva ante reuso de refresh token detectado.** Actualmente solo se invalida el token reutilizado, no todas las sesiones del usuario. Mejora recomendada antes de producción: al detectar reuso, revocar todos los `refresh_tokens` activos de ese `userId`.
3. **Sin bloqueo progresivo de cuenta** (además del rate-limit por IP) tras N intentos fallidos consecutivos — el rate-limit actual es por IP, no por cuenta. Se evaluará junto con el módulo de reportería/auditoría.
4. **Base de datos de test compartida con desarrollo** (ver deuda ya registrada en `00-foundation.md`, incidente 4) — los tests de auth crean y limpian su propio usuario (`afterAll`), pero no hay aislamiento total (una corrida interrumpida podría dejar un usuario de prueba huérfano).

## Cómo usar `authorize` en módulos futuros

```ts
import { authenticate } from "@/middleware/authenticate";
import { authorize } from "@/middleware/authorize";

router.post(
  "/cinemas",
  authenticate,
  authorize("SUPER_ADMIN", "CINEMA_MANAGER"),
  catchAsync(cinemaController.create),
);
```

## Siguiente módulo

**Catálogo** (películas, géneros, directores/actores) — CRUD administrativo protegido con `authorize("SUPER_ADMIN")` + endpoints públicos de lectura sin autenticación.
