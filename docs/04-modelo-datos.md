# Modelo de datos — Lumière

Este documento es la fuente de verdad conceptual del esquema. El `schema.prisma` (`apps/backend/prisma/schema.prisma`) es su implementación literal — si difieren, este documento debe actualizarse en el mismo cambio.

## 1. Diagrama entidad-relación

```mermaid
erDiagram
    USER ||--o{ REFRESH_TOKEN : "posee"
    USER ||--o{ ORDER : "realiza"
    USER ||--o{ REVIEW : "escribe"
    USER ||--o{ SHOWTIME_SEAT : "bloquea temporalmente"
    USER ||--o{ AUDIT_LOG : "genera"

    MOVIE ||--o{ MOVIE_GENRE : ""
    GENRE ||--o{ MOVIE_GENRE : ""
    MOVIE ||--o{ MOVIE_CREDIT : ""
    PERSON ||--o{ MOVIE_CREDIT : ""
    MOVIE }o--|| MOVIE_RATING : "clasificada como"
    MOVIE }o--|| LANGUAGE : "idioma original"
    MOVIE ||--o{ SHOWTIME : "se proyecta en"
    MOVIE ||--o{ REVIEW : "recibe"

    CINEMA ||--o{ ROOM : "tiene"
    ROOM ||--o{ SEAT : "contiene"
    ROOM }o--o{ ROOM_FEATURE : ""
    SEAT }o--|| SEAT_TYPE : "es de tipo"
    ROOM ||--o{ SHOWTIME : "aloja"

    SHOWTIME }o--|| LANGUAGE : "audio"
    SHOWTIME }o--o| LANGUAGE : "subtitulos"
    SHOWTIME ||--o{ SHOWTIME_SEAT : "expone"
    SEAT ||--o{ SHOWTIME_SEAT : "instancia por funcion"

    ORDER ||--o{ ORDER_SEAT : "incluye"
    ORDER ||--o{ ORDER_ITEM : "incluye"
    ORDER ||--o| PAYMENT : "se paga con"
    ORDER }o--|| SHOWTIME : "corresponde a"
    ORDER }o--o| PROMOTION : "aplica"
    SHOWTIME_SEAT ||--o| ORDER_SEAT : "se vende como"
    PRODUCT ||--o{ ORDER_ITEM : "vendido como"

    PROMOTION ||--o{ PROMOTION_RULE : "define reglas con"

    REVIEW }o--o| ORDER : "verificada por"

    USER {
        uuid id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        string phone
        enum role
        boolean isActive
        boolean loyaltyMember
        int loyaltyPoints
        datetime emailVerifiedAt
        datetime createdAt
        datetime updatedAt
    }

    MOVIE {
        uuid id PK
        string title
        string originalTitle
        string synopsis
        int durationMinutes
        int releaseYear
        string countryOfOrigin
        string posterUrl
        string backdropUrl
        string trailerUrl
        enum status
        uuid ratingId FK
        uuid originalLanguageId FK
        datetime createdAt
        datetime updatedAt
    }

    PERSON {
        uuid id PK
        string firstName
        string lastName
        text bio
        string photoUrl
        date birthDate
        string nationality
    }

    MOVIE_CREDIT {
        uuid id PK
        uuid movieId FK
        uuid personId FK
        enum creditRole
        string characterName
        int billingOrder
    }

    GENRE {
        uuid id PK
        string name UK
    }

    LANGUAGE {
        uuid id PK
        string name
        string code UK
    }

    MOVIE_RATING {
        uuid id PK
        string code UK
        string description
        int minAge
    }

    CINEMA {
        uuid id PK
        string name
        string address
        string city
        string state
        string country
        decimal latitude
        decimal longitude
        string phone
        boolean isActive
    }

    ROOM {
        uuid id PK
        uuid cinemaId FK
        string name
        enum roomType
        int totalCapacity
    }

    SEAT_TYPE {
        uuid id PK
        string name UK
        decimal priceMultiplier
    }

    SEAT {
        uuid id PK
        uuid roomId FK
        string rowLabel
        int seatNumber
        uuid seatTypeId FK
        boolean isActive
    }

    SHOWTIME {
        uuid id PK
        uuid movieId FK
        uuid roomId FK
        uuid audioLanguageId FK
        uuid subtitleLanguageId FK
        datetime startTime
        datetime endTime
        decimal basePrice
        enum format
        enum status
    }

    SHOWTIME_SEAT {
        uuid id PK
        uuid showtimeId FK
        uuid seatId FK
        enum status
        uuid lockedByUserId FK
        datetime lockExpiresAt
    }

    ORDER {
        uuid id PK
        uuid userId FK
        uuid showtimeId FK
        uuid promotionId FK
        enum status
        decimal subtotal
        decimal discountAmount
        decimal totalAmount
        string qrCode
        datetime checkedInAt
        datetime createdAt
    }

    ORDER_SEAT {
        uuid id PK
        uuid orderId FK
        uuid showtimeSeatId FK
        decimal priceAtPurchase
    }

    PRODUCT {
        uuid id PK
        string name
        text description
        decimal price
        boolean isActive
    }

    ORDER_ITEM {
        uuid id PK
        uuid orderId FK
        uuid productId FK
        int quantity
        decimal priceAtPurchase
    }

    PAYMENT {
        uuid id PK
        uuid orderId FK
        enum provider
        string providerPaymentId
        decimal amount
        string currency
        enum status
        datetime createdAt
    }

    PROMOTION {
        uuid id PK
        string name
        text description
        string code UK
        enum discountType
        decimal discountValue
        datetime startDate
        datetime endDate
        boolean isActive
    }

    PROMOTION_RULE {
        uuid id PK
        uuid promotionId FK
        uuid movieId FK
        uuid cinemaId FK
        int dayOfWeek
    }

    REVIEW {
        uuid id PK
        uuid userId FK
        uuid movieId FK
        uuid orderId FK
        int rating
        text comment
        boolean isVerifiedPurchase
        boolean isApproved
        datetime createdAt
    }

    AUDIT_LOG {
        uuid id PK
        uuid userId FK
        string action
        string entityType
        uuid entityId
        jsonb metadata
        string ipAddress
        datetime createdAt
    }
```

> Nota: `MOVIE_GENRE` y `ROOM_FEATURE` son tablas de unión simples (join tables) y se omiten sus atributos en el diagrama por claridad — solo contienen las claves foráneas de la relación.

## 2. Diccionario de datos — enums

| Enum | Valores | Uso |
|---|---|---|
| `Role` | `CUSTOMER`, `BOX_OFFICE`, `CINEMA_MANAGER`, `SUPER_ADMIN` | Rol de usuario para RBAC |
| `MovieStatus` | `COMING_SOON`, `IN_THEATERS`, `ARCHIVED` | Estado de una película en cartelera |
| `CreditRole` | `DIRECTOR`, `ACTOR` | Rol de una persona en una película (permite calcular "cantidad de películas" por persona y rol) |
| `RoomType` | `STANDARD`, `IMAX`, `VIP`, `FOUR_DX`, `DOLBY_ATMOS` | Tipo de sala — afecta precio base |
| `ShowtimeFormat` | `TWO_D`, `THREE_D` | Formato de proyección |
| `ShowtimeStatus` | `SCHEDULED`, `CANCELLED`, `COMPLETED` | Estado operativo de la función |
| `ShowtimeSeatStatus` | `AVAILABLE`, `LOCKED`, `SOLD` | Estado de una butaca para una función específica — el corazón del sistema anti-doble-venta |
| `OrderStatus` | `PENDING`, `PAID`, `CANCELLED`, `REFUNDED`, `EXPIRED` | Ciclo de vida de una orden |
| `PaymentProvider` | `STRIPE`, `PAYPAL` | Proveedor de pago usado |
| `PaymentStatus` | `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED` | Estado de la transacción de pago |
| `DiscountType` | `PERCENTAGE`, `FIXED` | Tipo de cálculo de una promoción |

## 3. Decisiones de modelado clave

- **`SHOWTIME_SEAT` como entidad independiente de `SEAT`**: una butaca física (`SEAT`) pertenece a una sala; su disponibilidad es relativa a *una función específica*, no a la sala en general. Por eso cada función genera una fila `SHOWTIME_SEAT` por butaca (materializada al crear la función), que es donde vive el estado `AVAILABLE / LOCKED / SOLD` y el bloqueo temporal (`lockedByUserId`, `lockExpiresAt`). El lock efectivo en caliente vive en Redis (TTL corto); la fila en Postgres es la fuente de verdad durable una vez confirmado.
- **`MOVIE_CREDIT` unifica directores y actores** vía el enum `creditRole` sobre una única entidad `PERSON`, en vez de dos tablas separadas — una persona real puede ser directora en una película y actriz en otra; el enunciado incluso lo sugiere ("directores y actores" comparten los mismos atributos personales). La "cantidad de películas en las que participa" (RF-02) se deriva con `COUNT` sobre `MOVIE_CREDIT`, nunca se almacena como columna (evita inconsistencia).
- **`PROMOTION_RULE` separada de `PROMOTION`**: permite que una promoción aplique a múltiples combinaciones (ej. "20% los martes en cualquier cine" o "2x1 en el estreno X"), sin forzar un modelo rígido de un solo criterio por promoción.
- **`ORDER_ITEM` + `PRODUCT`**: modela combos de dulcería como líneas de orden independientes de los asientos, reutilizando el mismo `ORDER` — una compra puede incluir boletos y combos en una sola transacción.
- **`REVIEW.isVerifiedPurchase`** se deriva de si `orderId` no es nulo y esa orden está `PAID`, calculado al crear la reseña — no se confía en el cliente para marcarlo.
- **`AUDIT_LOG`** es de solo-inserción (append-only) y registra acciones sensibles (cambios de precio, cancelaciones, acciones administrativas) — requisito de la capa de seguridad de backend.
- **Todas las tablas usan `id UUID`** (no autoincremental) para no filtrar volumen de negocio en URLs públicas (ej. `/orders/{id}`) y evitar enumeración.
- **`ORDER.checkedInAt`** (agregado en la fase de validación de boletos, ver [docs/backend/10-validacion-boletos.md](backend/10-validacion-boletos.md)): marca el momento en que el código QR fue escaneado en la entrada. `null` = boleto no usado todavía. Existe específicamente para que un mismo QR no pueda canjearse dos veces (alguien reenvía una captura de pantalla) — la validación revisa este campo antes de aceptar el boleto.
