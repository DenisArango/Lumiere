# Lumière

Portal de gestión de cartelera de cine y venta de boletos en línea.

> Punto de entrada de la documentación: [PROJECT.md](PROJECT.md). Ahí está el núcleo del proyecto, las decisiones de arquitectura y el índice completo de `docs/`.

## Quick start (desarrollo local)

Requisitos: **Node 22+**, **pnpm** (`corepack enable && corepack prepare pnpm@latest --activate`), Docker Desktop.

```bash
# 1. Levantar Postgres + Redis
docker compose up -d

# 2. Instalar dependencias (raíz, workspaces)
pnpm install

# 3. Configurar variables de entorno del backend
cp apps/backend/.env.example apps/backend/.env
# editar apps/backend/.env si es necesario

# 4. Aplicar migraciones, datos de referencia y datos de demostración
pnpm --filter @lumiere/backend prisma:migrate
pnpm --filter @lumiere/backend prisma:seed
pnpm --filter @lumiere/backend prisma:seed-demo

# 5. Arrancar backend y frontend (dos terminales)
pnpm dev:backend
pnpm dev:frontend
```

Backend en `http://localhost:4000` (salud: `GET /api/v1/health`). Frontend en `http://localhost:5173`. Postgres en el puerto **5433** por defecto (no 5432, para no chocar con una instalación nativa en el host). Si otro programa ya usa el 5433, crea un `.env` en la raíz con `POSTGRES_PORT=5434` (está ignorado por git) y ajusta el puerto en `DATABASE_URL` de `apps/backend/.env` — ver [docs/backend/00-foundation.md](docs/backend/00-foundation.md).

## Cuentas y datos de demostración

`pnpm --filter @lumiere/backend prisma:seed-demo` (ver [apps/backend/prisma/seed-demo.ts](apps/backend/prisma/seed-demo.ts)) crea cuentas de prueba y un recorrido completo — se puede correr varias veces sin duplicar datos.

| Email | Contraseña | Rol | Para probar |
|---|---|---|---|
| `admin@lumiere.test` | `Lumiere2026!` | `SUPER_ADMIN` | Panel de administración completo (`/admin`) |
| `taquilla@lumiere.test` | `Lumiere2026!` | `BOX_OFFICE` | Validación de boletos (`/taquilla`) |
| `cliente@lumiere.test` | `Lumiere2026!` | `CUSTOMER` | Cartelera, reservas, checkout, reseñas |

Datos creados: película **"Estación Lumière"** (en cartelera) + **"Horizonte de Cristal"** (próximamente), cine **Lumière Reforma** con **Sala 1** (16 butacas, fila A estándar / fila B VIP), una función mañana a las 8pm, combo **"Combo Lumière"** ($89), código de promoción **`BIENVENIDA`** (15%), y un boleto ya pagado con código **`LMR-DEMO0001`** listo para validar en `/taquilla` sin necesitar credenciales reales de Stripe/PayPal.

## Guía corta de validación

1. **Cartelera** (`/`, sin sesión) — debe verse la marquesina con "Estación Lumière", y el tab "Próximamente" debe mostrar "Horizonte de Cristal". Prueba el toggle de modo claro/oscuro en el header.
2. **Detalle + reserva** — entra a "Estación Lumière" → "Ver funciones" → selecciona la función de mañana → elige un par de butacas en el mapa (nota los estilos por tipo: fila B es VIP) → "Continuar al pago".
3. **Checkout** — inicia sesión como `cliente@lumiere.test` si no lo has hecho → agrega un "Combo Lumière" → ingresa el código `BIENVENIDA` → paga con la tarjeta de prueba `4242 4242 4242 4242` (cualquier fecha futura y CVC). Requiere tus claves de **prueba** de Stripe: `STRIPE_SECRET_KEY` y `STRIPE_PUBLISHABLE_KEY` en `apps/backend/.env` (ignorado por git; la clave publicable la entrega el backend al navegador en tiempo de ejecución). Sin ellas el cobro falla con un error real, nunca simula un pago. Para PayPal usa credenciales **sandbox** (`PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET` en `apps/backend/.env`; nunca las de producción) y una cuenta compradora de prueba. Para 3D Secure usa la tarjeta `4000 0027 6000 3184`. Los webhooks necesitan configuración adicional: [docs/backend/12-webhooks-3ds-paypal-y-auditoria.md](docs/backend/12-webhooks-3ds-paypal-y-auditoria.md).
4. **Reseñas** — entra de nuevo al detalle de "Estación Lumière" y dejar una reseña con estrellas y comentario.
5. **Mis boletos** (`/mis-ordenes`) — debe verse la orden de la reserva anterior en `PENDING` (por el pago fallido del paso 3).
6. **Taquilla** — cierra sesión, entra como `taquilla@lumiere.test`, ve a `/taquilla`, ingresa el código `LMR-DEMO0001` → debe confirmar el boleto con los datos de la función. Vuelve a ingresar el mismo código → debe rechazarlo por ya usado.
7. **Panel de administración** — entra como `admin@lumiere.test` a `/admin`: revisa el dashboard de reportería (probablemente vacío o con poco dato, ya que casi ninguna orden llegó a `PAID` sin Stripe real — es esperado), y prueba crear una película, un cine, una función o una promoción nueva desde cada sección.

## Estructura

```
apps/backend/   API REST (Node.js + Express + TypeScript + Prisma + PostgreSQL)
apps/frontend/  SPA (React + Vite + TypeScript)
docs/           Documentación completa del proyecto
```

## Despliegue

Guía completa para publicar en Render (Blueprint `render.yaml` + `Dockerfile`): [docs/09-despliegue-render.md](docs/09-despliegue-render.md).
