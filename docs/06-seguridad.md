# Seguridad — Lumière

Seguridad tratada como requisito transversal en las 3 capas, no como una fase final. Este documento es el checklist de referencia para cada módulo nuevo.

## 1. Capa frontend

| Control | Implementación |
|---|---|
| Sin tokens en `localStorage`/`sessionStorage` | Sesión vía cookies `httpOnly` + `Secure` + `SameSite=Lax` gestionadas por el backend |
| Protección CSRF | Token CSRF de doble envío (`SameSite` + header `X-CSRF-Token` validado en mutaciones) |
| Content Security Policy | Definida en el backend (ver capa backend) y respetada en el frontend: sin `eval`, sin scripts inline sin nonce |
| Validación de formularios | Zod compartido/espejado en frontend (React Hook Form + zodResolver) — nunca se confía solo en esto, es UX, no seguridad real |
| Sanitización de contenido dinámico | React escapa por defecto; cualquier `dangerouslySetInnerHTML` (ninguno previsto) requeriría sanitización explícita con DOMPurify |
| HTTPS forzado | Redirección forzada en producción; cookies `Secure` rechazan transmisión en HTTP |
| Dependencias | Auditoría periódica (`npm audit` / `pnpm audit`) antes de cada release |

## 2. Capa backend

| Control | Implementación |
|---|---|
| Headers de seguridad | `helmet` (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, etc.) |
| CORS | Whitelist explícita de orígenes permitidos, sin `*` en producción, `credentials: true` solo para el origen del frontend propio |
| Rate limiting | `express-rate-limit` con store en Redis; límites más estrictos en `/auth/login`, `/auth/register`, `/orders/*/payments` que en lecturas públicas |
| Autenticación | JWT de acceso (corta duración, ~15min) + refresh token (rotación en cada uso, revocable) — ver secuencia en [05-diagramas-uml.md](05-diagramas-uml.md) |
| Hash de contraseñas | Argon2id (parámetros de costo ajustados al hardware de despliegue) |
| Autorización | Middleware RBAC por rol (`CUSTOMER`, `BOX_OFFICE`, `CINEMA_MANAGER`, `SUPER_ADMIN`) evaluado en cada ruta que lo requiera; nunca se infiere el rol del cliente, siempre del token verificado en servidor |
| Validación de entrada | Zod en el límite de cada endpoint (`middleware/validate.ts`), rechazo temprano de payloads inválidos |
| Prevención de inyección SQL | Prisma con queries parametrizadas exclusivamente — ninguna concatenación de SQL crudo |
| Prevención de HTTP Parameter Pollution | `hpp` middleware |
| Manejo de errores | Middleware centralizado que nunca expone stack traces ni detalles internos en producción |
| Idempotencia en pagos | Webhooks de Stripe/PayPal verificados por firma; procesamiento idempotente por `providerPaymentId` para evitar doble acreditación ante reintentos |
| Bloqueo de fuerza bruta | Rate-limit + backoff progresivo en intentos de login fallidos por cuenta/IP |
| Auditoría | Tabla `AUDIT_LOG` (append-only) para acciones administrativas y de pago: quién, qué, cuándo, desde qué IP |
| Secretos | Variables de entorno validadas al arranque (`src/config/env.ts`), nunca hardcodeadas ni versionadas (`.env` en `.gitignore`, `.env.example` sin valores reales) |
| Logging | Logs estructurados (Pino), sin loguear contraseñas, tokens ni datos de tarjeta |

## 3. Capa de base de datos

| Control | Implementación |
|---|---|
| Principio de mínimo privilegio | Usuario de aplicación con permisos limitados a las operaciones necesarias (sin `SUPERUSER`, sin `DROP` en producción) |
| Conexión cifrada | SSL/TLS en la conexión Postgres en cualquier entorno que no sea localhost |
| Sin datos de tarjeta | Los números de tarjeta nunca tocan el backend ni la base de datos — se usa tokenización de Stripe/PayPal (Stripe Elements / PayPal SDK en frontend), la BD solo guarda `providerPaymentId` |
| Integridad referencial | Claves foráneas con restricciones explícitas (`onDelete` definido conscientemente por relación, nunca `CASCADE` implícito en datos transaccionales como `ORDER`) |
| IDs no enumerables | UUID en todas las tablas (ver [04-modelo-datos.md](04-modelo-datos.md) sección 3) |
| Backups | Estrategia de backup automatizado definida antes de ir a producción (fuera del alcance de fase 1, se documenta en fase de hardening) |
| Migraciones auditables | Prisma Migrate — historial de cambios de esquema versionado en git, nunca cambios manuales directos en producción |

## 4. Cumplimiento de pagos (PCI)

Lumière **nunca almacena ni procesa datos crudos de tarjeta**. El flujo de tokenización (Stripe Elements / PayPal Smart Buttons) ocurre enteramente en el frontend contra los servidores del proveedor; el backend solo recibe un token/ID de pago ya procesado. Esto mantiene a Lumière fuera del alcance de SAQ A/A-EP más estricto de PCI-DSS, delegando el manejo de datos sensibles de tarjeta a proveedores certificados.

## 5. Accesibilidad como control de seguridad/inclusión

WCAG 2.1 AA no es solo UX: es requisito de no discriminación. Aplica especialmente a:
- Flujo de selección de asientos (navegable por teclado, roles ARIA en el mapa de butacas, indicación no solo por color de disponibilidad)
- Checkout y formularios (labels asociados, mensajes de error anunciados por lector de pantalla)
- Contraste de color validado en ambas paletas (modo claro/oscuro) definidas en [00-brand-lumiere.md](00-brand-lumiere.md)

## 6. Checklist de seguridad por módulo nuevo

Antes de marcar cualquier módulo como completo (ver Definition of Done en [02-metodologia.md](02-metodologia.md)):
- [ ] ¿Todo input pasa por validación Zod?
- [ ] ¿Toda ruta mutante requiere autenticación explícita?
- [ ] ¿La autorización por rol está aplicada donde corresponde, evaluada en servidor?
- [ ] ¿Hay algún dato sensible en logs?
- [ ] ¿Hay algún secreto hardcodeado?
- [ ] ¿Las queries usan Prisma (no SQL crudo concatenado)?
- [ ] ¿Se agregó rate-limit si el endpoint es sensible (auth, pagos)?
- [ ] ¿Se registró en `AUDIT_LOG` si es una acción administrativa o de pago?
