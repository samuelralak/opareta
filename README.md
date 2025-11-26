# Opareta

A microservices-based payment platform built with NestJS and NX monorepo architecture.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [System Context (C4 Level 1)](#system-context-c4-level-1)
  - [Container Diagram (C4 Level 2)](#container-diagram-c4-level-2)
  - [Component Diagram (C4 Level 3)](#component-diagram-c4-level-3)
  - [Code Diagram (C4 Level 4)](#code-diagram-c4-level-4)
- [Flows](#flows)
  - [User Registration Flow](#user-registration-flow)
  - [Authentication Flow](#authentication-flow)
  - [Payment Creation Flow](#payment-creation-flow)
  - [Webhook Processing Flow](#webhook-processing-flow)
- [Technical Decisions](#technical-decisions)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Docker Development](#docker-development)
- [Running Tests](#running-tests)
- [API Documentation](#api-documentation)

## Overview

Opareta is a payment processing platform consisting of two core microservices:

- **Argus** - Authentication service handling user registration, login, and JWT token management
- **Hermes** - Payment service managing payment initiation, status tracking, and provider webhooks

## Architecture

> **Note:** Diagram images are available in [`docs/diagrams/`](docs/diagrams/). GitHub renders Mermaid diagrams inline below.

### System Context (C4 Level 1)

![System Context Diagram](docs/diagrams/c4-level1-context.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
C4Context
    title System Context Diagram - Opareta Payment Platform

    Person(user, "User", "A customer making payments")

    System_Boundary(opareta, "Opareta Platform") {
        System(platform, "Opareta", "Payment processing platform with authentication")
    }

    System_Ext(provider, "Payment Provider", "External mobile money/payment provider")

    Rel(user, platform, "Registers, authenticates, initiates payments")
    Rel(platform, provider, "Processes payments via API")
    Rel(provider, platform, "Sends payment status webhooks")
```
</details>

### Container Diagram (C4 Level 2)

![Container Diagram](docs/diagrams/c4-level2-container.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
C4Container
    title Container Diagram - Opareta Platform

    Person(user, "User", "Customer")

    Container_Boundary(opareta, "Opareta Platform") {
        Container(argus, "Argus", "NestJS", "Authentication service - handles user registration, login, JWT tokens, JWKS endpoint")
        Container(hermes, "Hermes", "NestJS", "Payment service - handles payment initiation, status tracking, webhooks")

        ContainerDb(argus_db, "Argus DB", "PostgreSQL", "User credentials, accounts")
        ContainerDb(hermes_db, "Hermes DB", "PostgreSQL", "Payments, transactions, webhook events")
        ContainerDb(redis, "Redis", "Redis", "Token cache, session data")
    }

    System_Ext(provider, "Payment Provider", "Mobile Money API")

    Rel(user, argus, "Register, Login", "HTTPS")
    Rel(user, hermes, "Create/View Payments", "HTTPS + JWT")

    Rel(argus, argus_db, "Read/Write users")
    Rel(argus, redis, "Cache tokens")

    Rel(hermes, hermes_db, "Read/Write payments")
    Rel(hermes, redis, "Cache tokens")
    Rel(hermes, argus, "Fetch JWKS", "HTTP")
    Rel(hermes, provider, "Initiate payment", "HTTPS")

    Rel(provider, hermes, "Payment webhooks", "HTTPS")
```
</details>

### Component Diagram (C4 Level 3)

#### Argus (Authentication Service)

![Argus Component Diagram](docs/diagrams/c4-level3-argus.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
C4Component
    title Component Diagram - Argus (Authentication Service)

    Container_Boundary(argus, "Argus") {
        Component(auth_controller, "AuthController", "NestJS Controller", "Handles /auth/* endpoints")
        Component(users_controller, "UsersController", "NestJS Controller", "Handles /users/* endpoints")
        Component(jwks_controller, "JwksController", "NestJS Controller", "Serves /.well-known/jwks.json")

        Component(auth_service, "AuthService", "NestJS Service", "Login logic, JWT signing")
        Component(users_service, "UsersService", "NestJS Service", "User CRUD, password hashing")
        Component(jwt_service, "JwtKeyService", "NestJS Service", "RSA key management, JWKS generation")

        Component(user_entity, "User Entity", "TypeORM Entity", "User data model")
    }

    ContainerDb(db, "PostgreSQL", "Database")
    ContainerDb(redis, "Redis", "Cache")

    Rel(auth_controller, auth_service, "Uses")
    Rel(users_controller, users_service, "Uses")
    Rel(jwks_controller, jwt_service, "Uses")

    Rel(auth_service, users_service, "Validates users")
    Rel(auth_service, jwt_service, "Signs tokens")

    Rel(users_service, user_entity, "Manages")
    Rel(user_entity, db, "Persists to")
    Rel(auth_service, redis, "Caches tokens")
```
</details>

#### Hermes (Payment Service)

![Hermes Component Diagram](docs/diagrams/c4-level3-hermes.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
C4Component
    title Component Diagram - Hermes (Payment Service)

    Container_Boundary(hermes, "Hermes") {
        Component(payments_controller, "PaymentsController", "NestJS Controller", "Handles /payments/* endpoints")
        Component(webhooks_controller, "WebhooksController", "NestJS Controller", "Handles provider webhooks")

        Component(payments_service, "PaymentsService", "NestJS Service", "Payment creation, status transitions")
        Component(webhook_service, "PaymentWebhookService", "NestJS Service", "Webhook processing, idempotency")

        Component(payment_entity, "Payment Entity", "TypeORM Entity", "Payment data model")
        Component(status_log_entity, "PaymentStatusLog", "TypeORM Entity", "Audit trail for status changes")
        Component(webhook_entity, "WebhookEvent", "TypeORM Entity", "Webhook deduplication")

        Component(jwks_guard, "JwksAuthGuard", "NestJS Guard", "JWT validation via JWKS")
    }

    ContainerDb(db, "PostgreSQL", "Database")
    Container_Ext(argus, "Argus", "Auth Service")
    System_Ext(provider, "Payment Provider", "External API")

    Rel(payments_controller, payments_service, "Uses")
    Rel(payments_controller, jwks_guard, "Protected by")
    Rel(webhooks_controller, webhook_service, "Uses")

    Rel(payments_service, payment_entity, "Manages")
    Rel(payments_service, status_log_entity, "Creates audit logs")
    Rel(webhook_service, webhook_entity, "Tracks webhooks")
    Rel(webhook_service, payments_service, "Updates payment status")

    Rel(jwks_guard, argus, "Fetches JWKS")
    Rel(payments_service, provider, "Initiates payments")
    Rel(payment_entity, db, "Persists to")
```
</details>

### Code Diagram (C4 Level 4)

#### Argus - Auth Module Classes

![Argus Classes Diagram](docs/diagrams/c4-level4-argus-classes.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
classDiagram
    class AuthController {
        -authService: AuthService
        +register(dto: CreateUserDto): Promise~UserResponseDto~
        +login(dto: LoginDto): Promise~TokenResponseDto~
    }

    class AuthService {
        -usersService: UsersService
        -jwtKeyService: JwtKeyService
        -tokenCacheService: TokenCacheService
        +register(dto: CreateUserDto): Promise~UserResponseDto~
        +login(dto: LoginDto): Promise~TokenResponseDto~
        -validateUser(phone: string, password: string): Promise~User~
        -generateToken(user: User): Promise~string~
    }

    class UsersService {
        -usersRepository: Repository~User~
        +register(dto: CreateUserDto): Promise~UserResponseDto~
        +findByPhoneNumber(phone: string): Promise~User~
        +findById(id: string): Promise~User~
        +toResponse(user: User): UserResponseDto
    }

    class JwtKeyService {
        -privateKey: KeyObject
        -publicKey: KeyObject
        -keyId: string
        +onModuleInit(): Promise~void~
        +signToken(payload: JwtPayload): string
        +getJwks(): JwksResponse
        -loadOrGenerateKeys(): Promise~void~
    }

    class User {
        +id: string
        +phone_number: string
        +email: string
        +password: string
        +created_at: Date
        +updated_at: Date
    }

    class CreateUserDto {
        +phone_number: string
        +email: string
        +password: string
    }

    class LoginDto {
        +phone_number: string
        +password: string
    }

    class UserResponseDto {
        +id: string
        +phone_number: string
        +email: string
        +created_at: string
    }

    AuthController --> AuthService : uses
    AuthService --> UsersService : uses
    AuthService --> JwtKeyService : uses
    UsersService --> User : manages
    AuthController ..> CreateUserDto : accepts
    AuthController ..> LoginDto : accepts
    AuthController ..> UserResponseDto : returns
```
</details>

#### Hermes - Payments Module Classes

![Hermes Classes Diagram](docs/diagrams/c4-level4-hermes-classes.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
classDiagram
    class PaymentsController {
        -paymentsService: PaymentsService
        +createPayment(user: JwtPayload, dto: CreatePaymentDto): Promise~Payment~
        +getPayment(user: JwtPayload, reference: string): Promise~Payment~
    }

    class PaymentsService {
        -paymentRepository: Repository~Payment~
        -dataSource: DataSource
        -dummyProvider: DummyProvider
        +createPayment(userId: string, dto: CreatePaymentDto): Promise~Payment~
        +getPaymentByReference(reference: string, userId: string): Promise~Payment~
        +updatePaymentStatus(reference: string, userId: string, dto: UpdateStatusDto): Promise~Payment~
        +transitionStatus(payment: Payment, status: PaymentStatus, actor: string, reason: string): Promise~void~
        -generateReference(): string
        -isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean
    }

    class PaymentWebhookService {
        -webhookEventRepository: Repository~WebhookEvent~
        -paymentRepository: Repository~Payment~
        -paymentsService: PaymentsService
        +processWebhook(payload: WebhookPayload): Promise~void~
        -isDuplicateWebhook(webhookId: string): Promise~boolean~
    }

    class Payment {
        +id: string
        +reference: string
        +user_id: string
        +amount: number
        +currency: PaymentCurrency
        +payment_method: PaymentMethod
        +customer_phone: string
        +customer_email: string
        +status: PaymentStatus
        +provider_reference: string
        +provider_transaction_id: string
        +failure_reason: string
        +created_at: Date
        +updated_at: Date
        +status_logs: PaymentStatusLog[]
    }

    class PaymentStatusLog {
        +id: string
        +payment_id: string
        +from_status: PaymentStatus
        +to_status: PaymentStatus
        +actor: string
        +reason: string
        +created_at: Date
    }

    class WebhookEvent {
        +id: string
        +webhook_id: string
        +payment_reference: string
        +payload: object
        +processed: boolean
        +received_at: Date
    }

    class PaymentStatus {
        <<enumeration>>
        INITIATED
        PENDING
        SUCCESS
        FAILED
    }

    PaymentsController --> PaymentsService : uses
    PaymentsService --> Payment : manages
    PaymentsService --> PaymentStatusLog : creates
    PaymentWebhookService --> WebhookEvent : manages
    PaymentWebhookService --> PaymentsService : uses
    Payment --> PaymentStatusLog : has many
    Payment --> PaymentStatus : has status
```
</details>

#### Common Library - Shared Classes

![Common Classes Diagram](docs/diagrams/c4-level4-common-classes.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
classDiagram
    class JwksAuthGuard {
        -reflector: Reflector
        -httpService: HttpService
        -tokenCacheService: TokenCacheService
        -jwksUri: string
        +canActivate(context: ExecutionContext): Promise~boolean~
        -extractToken(request: Request): string
        -verifyToken(token: string): Promise~JwtPayload~
        -fetchJwks(): Promise~JwksResponse~
    }

    class TokenCacheService {
        -redis: Redis
        +get(key: string): Promise~string~
        +set(key: string, value: string, ttl: number): Promise~void~
        +delete(key: string): Promise~void~
    }

    class HttpExceptionFilter {
        -logger: Logger
        +catch(exception: HttpException, host: ArgumentsHost): void
    }

    class CurrentUser {
        <<decorator>>
        +data: string
        +factory(data: string, ctx: ExecutionContext): JwtPayload
    }

    class JwtPayload {
        <<interface>>
        +sub: string
        +phone_number: string
        +iat: number
        +exp: number
    }

    JwksAuthGuard --> TokenCacheService : uses
    JwksAuthGuard ..> JwtPayload : validates
    CurrentUser ..> JwtPayload : extracts
```
</details>

#### Payment State Machine

![Payment State Machine](docs/diagrams/payment-state-machine.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
stateDiagram-v2
    [*] --> INITIATED: Payment Created

    INITIATED --> PENDING: Provider Accepts
    INITIATED --> FAILED: Provider Rejects

    PENDING --> SUCCESS: Webhook SUCCESS
    PENDING --> FAILED: Webhook FAILED

    SUCCESS --> [*]
    FAILED --> [*]

    note right of INITIATED
        Initial state when payment
        is created in the system
    end note

    note right of PENDING
        Payment sent to provider
        awaiting webhook callback
    end note

    note right of SUCCESS
        Payment completed
        Terminal state
    end note

    note right of FAILED
        Payment failed
        Terminal state
    end note
```
</details>

## Flows

### User Registration Flow

![Registration Flow](docs/diagrams/flow-registration.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant AC as AuthController
    participant AS as AuthService
    participant US as UsersService
    participant DB as PostgreSQL

    User->>+AC: POST /auth/register
    Note over User,AC: {phone_number, email, password}

    AC->>+AS: register(createUserDto)
    AS->>+US: register(createUserDto)

    US->>US: Hash password (bcrypt)
    US->>+DB: INSERT user
    DB-->>-US: User record

    US->>US: toResponse(user)
    US-->>-AS: UserResponseDto
    AS-->>-AC: UserResponseDto

    AC-->>-User: 201 Created
    Note over User,AC: {id, phone_number, email, created_at}
```
</details>

### Authentication Flow

![Authentication Flow](docs/diagrams/flow-authentication.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant AC as AuthController
    participant AS as AuthService
    participant US as UsersService
    participant JKS as JwtKeyService
    participant TC as TokenCacheService
    participant Redis

    User->>+AC: POST /auth/login
    Note over User,AC: {phone_number, password}

    AC->>+AS: login(loginDto)
    AS->>+US: findByPhoneNumber(phone)
    US-->>-AS: User | null

    alt User not found
        AS-->>AC: 401 Unauthorized
        AC-->>User: Invalid credentials
    end

    AS->>AS: bcrypt.compare(password, hash)

    alt Password mismatch
        AS-->>AC: 401 Unauthorized
        AC-->>User: Invalid credentials
    end

    AS->>+JKS: signToken(payload)
    Note over JKS: Sign with RSA private key
    JKS-->>-AS: JWT token

    AS->>+TC: set(userId, token, ttl)
    TC->>+Redis: SET with expiry
    Redis-->>-TC: OK
    TC-->>-AS: void

    AS-->>-AC: TokenResponseDto
    AC-->>-User: 200 OK
    Note over User,AC: {access_token, token_type, expires_in}
```
</details>

### Payment Creation Flow

![Payment Creation Flow](docs/diagrams/flow-payment-creation.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Guard as JwksAuthGuard
    participant PC as PaymentsController
    participant PS as PaymentsService
    participant DP as DummyProvider
    participant DB as PostgreSQL
    participant Argus

    User->>+Guard: POST /payments (+ Bearer token)

    Guard->>+Argus: GET /.well-known/jwks.json
    Argus-->>-Guard: JWKS (public keys)

    Guard->>Guard: Verify JWT signature
    Guard->>Guard: Check expiration

    alt Token invalid
        Guard-->>User: 401 Unauthorized
    end

    Guard->>+PC: Request (with user context)

    PC->>+PS: createPayment(userId, dto)

    PS->>PS: generateReference()
    Note over PS: PAY-XXXXXXXX

    PS->>+DB: BEGIN TRANSACTION
    PS->>DB: INSERT payment (INITIATED)
    PS->>DB: INSERT status_log
    PS->>DB: UPDATE payment (PENDING)
    PS->>DB: INSERT status_log
    DB-->>-PS: Payment record

    PS->>+DP: initiatePayment(request)
    Note over DP: Async webhook scheduled
    DP-->>-PS: {success, provider_reference}

    PS->>+DB: UPDATE provider_reference
    DB-->>-PS: OK

    PS-->>-PC: Payment

    PC-->>-Guard: Payment
    Guard-->>-User: 201 Created
    Note over User,Guard: Payment with status: PENDING
```
</details>

### Webhook Processing Flow

![Webhook Processing Flow](docs/diagrams/flow-webhook-processing.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    participant Provider as Payment Provider
    participant WC as WebhooksController
    participant WS as PaymentWebhookService
    participant PS as PaymentsService
    participant DB as PostgreSQL

    Provider->>+WC: POST /webhooks/payment
    Note over Provider,WC: {webhook_id, payment_reference, status, ...}

    WC->>+WS: processWebhook(payload)

    WS->>+DB: SELECT webhook_event WHERE webhook_id = ?
    DB-->>-WS: null | WebhookEvent

    alt Duplicate webhook
        WS-->>WC: 200 OK (idempotent)
        WC-->>Provider: 200 OK
    end

    WS->>+DB: INSERT webhook_event (processed: false)
    DB-->>-WS: WebhookEvent

    WS->>+DB: SELECT payment WHERE reference = ?
    DB-->>-WS: Payment | null

    alt Payment not found
        WS->>DB: UPDATE webhook_event (processed: false)
        WS-->>WC: 404 Not Found
        WC-->>Provider: 404 Not Found
    end

    WS->>+PS: transitionStatus(payment, status, "WEBHOOK", reason)

    PS->>PS: isValidTransition(from, to)

    alt Invalid transition
        PS-->>WS: BadRequestException
        WS->>DB: UPDATE webhook_event (processed: false)
        WS-->>WC: 400 Bad Request
        WC-->>Provider: 400 Bad Request
    end

    PS->>+DB: BEGIN TRANSACTION
    PS->>DB: UPDATE payment status
    PS->>DB: INSERT status_log
    PS->>DB: COMMIT
    DB-->>-PS: OK

    PS-->>-WS: void

    WS->>+DB: UPDATE webhook_event (processed: true)
    DB-->>-WS: OK

    WS-->>-WC: void
    WC-->>-Provider: 200 OK
```
</details>

### JWT Validation Flow (JWKS)

![JWT Validation Flow](docs/diagrams/flow-jwt-validation.svg)

<details>
<summary>View Mermaid source</summary>

```mermaid
sequenceDiagram
    autonumber
    participant Client
    participant Guard as JwksAuthGuard
    participant Cache as TokenCacheService
    participant Redis
    participant Argus as Argus JWKS Endpoint

    Client->>+Guard: Request with Bearer token

    Guard->>Guard: Extract token from header

    Guard->>+Cache: get("jwks")
    Cache->>+Redis: GET jwks
    Redis-->>-Cache: null | cached_jwks

    alt JWKS not cached
        Cache-->>Guard: null
        Guard->>+Argus: GET /.well-known/jwks.json
        Argus-->>-Guard: {keys: [{kty, n, e, kid, ...}]}

        Guard->>+Cache: set("jwks", jwks, 3600)
        Cache->>+Redis: SET jwks EX 3600
        Redis-->>-Cache: OK
        Cache-->>-Guard: void
    else JWKS cached
        Cache-->>Guard: cached_jwks
    end

    Guard->>Guard: Find key by kid
    Guard->>Guard: Build RSA public key
    Guard->>Guard: jwt.verify(token, publicKey)

    alt Verification fails
        Guard-->>Client: 401 Unauthorized
    end

    Guard->>Guard: Check token expiration

    alt Token expired
        Guard-->>Client: 401 Unauthorized
    end

    Guard->>Guard: Attach user to request
    Guard-->>-Client: Continue to controller
```
</details>

## Technical Decisions

### NX Monorepo

We chose NX for several reasons:

- **Shared Code** - Common libraries (`@opareta/common`, `@opareta/dummy-provider`) are easily shared between services
- **Consistent Tooling** - Unified build, test, and lint configurations across all projects
- **Dependency Graph** - NX understands project dependencies and builds in the correct order
- **Affected Commands** - Only rebuild/retest what changed, dramatically speeding up CI
- **Caching** - Local and remote caching of build artifacts

### JWKS (JSON Web Key Set) for Authentication

Instead of sharing JWT secrets between services, we use JWKS:

- **Decoupled Services** - Hermes doesn't need Argus's private key; it only needs the public JWKS endpoint
- **Key Rotation** - Keys can be rotated without redeploying all services
- **Industry Standard** - OpenID Connect compatible, works with standard libraries
- **Zero Trust** - Services verify tokens independently without trusting shared secrets

**Flow:**
1. Argus generates RSA key pair on startup (or loads from disk)
2. Argus exposes `/.well-known/jwks.json` with the public key
3. Argus signs JWTs with the private key
4. Hermes fetches JWKS from Argus and validates tokens using the public key

### Database Per Service

Each service has its own PostgreSQL database:

- **Data Isolation** - Services can't accidentally access each other's data
- **Independent Scaling** - Databases can be scaled independently
- **Schema Freedom** - Each service controls its own schema evolution
- **Failure Isolation** - One database going down doesn't affect other services

### Shared Libraries

| Library | Purpose |
|---------|---------|
| `@opareta/common` | Guards, decorators, filters, logging, Redis caching |
| `@opareta/dummy-provider` | Mock payment provider for development/testing |

## Project Structure

```
opareta/
├── apps/
│   ├── argus/                 # Authentication service
│   │   └── src/
│   │       └── app/
│   │           ├── auth/      # Login, JWT signing
│   │           ├── users/     # User registration, management
│   │           └── database/  # TypeORM configuration
│   │
│   └── hermes/                # Payment service
│       └── src/
│           └── app/
│               ├── payments/  # Payment CRUD, status management
│               ├── webhooks/  # Provider webhook handling
│               └── database/  # TypeORM configuration
│
├── libs/
│   ├── common/                # Shared utilities
│   │   └── src/lib/
│   │       ├── guards/        # JwksAuthGuard
│   │       ├── cache/         # TokenCacheService, RedisCacheModule
│   │       ├── decorators/    # @CurrentUser()
│   │       ├── filters/       # HttpExceptionFilter
│   │       ├── logger/        # Winston logging
│   │       └── middleware/    # HTTP request logging
│   │
│   └── dummy-provider/        # Mock payment provider
│
├── docker-compose.yml         # Full stack with databases
├── Dockerfile                 # Multi-stage production build
└── Dockerfile.test            # Test runner image
```

## Getting Started

### Prerequisites

- Node.js 22+
- Docker and Docker Compose
- npm 10+

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start infrastructure (databases, Redis):**
   ```bash
   docker compose up -d postgres-argus postgres-hermes redis
   ```

3. **Run services in development mode:**
   ```bash
   # Terminal 1 - Auth service
   npx nx serve argus

   # Terminal 2 - Payment service
   npx nx serve hermes
   ```

4. **Access services:**
   - Argus (Auth): http://localhost:3000/api
   - Hermes (Payments): http://localhost:3001/api
   - Swagger Docs: http://localhost:3000/api/docs, http://localhost:3001/api/docs

### Docker Development

Run the complete stack with Docker Compose:

```bash
# Build and start all services
docker compose up --build

# Or run in detached mode
docker compose up -d --build

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

**Services:**

| Service | Port | Description |
|---------|------|-------------|
| argus | 3000 | Authentication API |
| hermes | 3001 | Payments API |
| postgres-argus | 5432 | Argus database |
| postgres-hermes | 5433 | Hermes database |
| redis | 6379 | Token cache |

### Environment Variables

Create `.env` files or set these variables:

**Argus:**
```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=argus
DB_PASSWORD=argus_secret
DB_NAME=argus_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_EXPIRATION_SECONDS=7200
```

**Hermes:**
```env
PORT=3001
DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=hermes
DB_PASSWORD=hermes_secret
DB_NAME=hermes_db
REDIS_HOST=localhost
REDIS_PORT=6379
JWKS_URI=http://localhost:3000/api/.well-known/jwks.json
```

## Running Tests

### Local Testing

```bash
# Run all tests
npx nx run-many -t test

# Run tests for a specific project
npx nx test @opareta/argus
npx nx test @opareta/hermes
npx nx test common

# Run tests with coverage
npx nx test @opareta/argus --coverage

# Run in watch mode
npx nx test @opareta/argus --watch
```

### Docker Testing

```bash
# Run all tests in Docker
docker compose --profile test run --rm --build test

# Run tests for a specific project
docker compose --profile test run --rm test-project argus
docker compose --profile test run --rm test-project hermes
```

### Test Coverage

| Project | Tests |
|---------|-------|
| common | 11 |
| argus | 18 |
| hermes | 42 |
| **Total** | **71** |

## API Documentation

Both services expose Swagger documentation:

- **Argus:** http://localhost:3000/api/docs
- **Hermes:** http://localhost:3001/api/docs

### Key Endpoints

**Argus (Authentication):**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT
- `GET /api/.well-known/jwks.json` - Public JWKS endpoint
- `GET /api/users/me` - Get current user (authenticated)

**Hermes (Payments):**
- `POST /api/payments` - Create payment (authenticated)
- `GET /api/payments/:reference` - Get payment status (authenticated)
- `POST /api/webhooks/payment` - Payment provider webhook

## License

Private - All rights reserved.
