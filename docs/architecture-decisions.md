# Architecture Decision Records (ADRs)

## Index of Decisions
- [ADR 001: Monorepo Architecture and Boundary Management](#adr-001-monorepo-architecture-and-boundary-management)
- [ADR 002: Clean Architecture (Onion) in NestJS Backend](#adr-002-clean-architecture-onion-in-nestjs-backend)
- [ADR 003: Relational Schema & Monetary Representation](#adr-003-relational-schema--monetary-representation)
- [ADR 004: Offline-First SQLite Synchronization Engine for Windows POS](#adr-004-offline-first-sqlite-synchronization-engine-for-windows-pos)
- [ADR 005: Event-Driven Real-Time Sync via Redis Pub/Sub and WebSockets](#adr-005-event-driven-real-time-sync-via-redis-pubsub-and-websockets)
- [ADR 006: Provider-Agnostic Egyptian Arabic NLP and Voice Architecture](#adr-006-provider-agnostic-egyptian-arabic-nlp-and-voice-architecture)
- [ADR 007: Inventory Concurrency & Optimistic Locking Strategy](#adr-007-inventory-concurrency--optimistic-locking-strategy)
- [ADR 008: Hierarchical Role-Based Access Control (RBAC) & Token Lifecycle](#adr-008-hierarchical-role-based-access-control-rbac--token-lifecycle)
- [ADR 009: Shared API Contracts & Type Safety](#adr-009-shared-api-contracts--type-safety)
- [ADR 010: Repeatable Enterprise PDF Documentation Generation](#adr-010-repeatable-enterprise-pdf-documentation-generation)

---

### ADR 001: Monorepo Architecture and Boundary Management
- **Status:** Accepted
- **Context:** The Cyborg Supermarket ecosystem comprises a centralized NestJS backend, customer web storefront, admin dashboard, Flutter mobile app, and Flutter Windows desktop POS. Maintaining distinct isolated repositories would lead to contract drift, disjointed types, and complex multi-repo deployment overhead.
- **Decision:** Establish a unified monorepo containing `apps/` (backend, admin-web, customer-web, mobile-app, desktop-pos), `packages/` (api-contracts, shared-types), `infrastructure/` (docker, database, monitoring), and `docs/`.
- **Trade-offs:** Requires strict module boundary discipline; mitigated by workspace package boundaries and centralized TypeScript configuration.

---

### ADR 002: Clean Architecture (Onion) in NestJS Backend
- **Status:** Accepted
- **Context:** Retail systems require high extensibility as store operations, external ERPs, payment gateways, and delivery services evolve. Framework lock-in damages long-term enterprise maintainability.
- **Decision:** Implement strict Onion Architecture:
  1. *Domain*: Pure business entities and repository interfaces (`User`, `Product`, `Order`, `Inventory`).
  2. *Application*: Use-case services (`CreateOrderUseCase`, `ReserveInventoryUseCase`).
  3. *Interface Adapters*: REST controllers, WebSocket gateways, and DTOs.
  4. *Infrastructure*: PostgreSQL TypeORM repositories, Redis pub/sub adapters, external integrations.
- **Trade-offs:** Additional layer indirection; justified by complete decoupling and testability.

---

### ADR 003: Relational Schema & Monetary Representation
- **Status:** Accepted
- **Context:** The raw product catalog contains prices with decimal precision in Egyptian Pounds (EGP). Financial transactions must strictly avoid binary floating-point roundoff errors (e.g., IEEE 754 precision issues).
- **Decision:** Use PostgreSQL `NUMERIC(10, 2)` for database storage and minor currency units (piastres as integers) for internal pricing calculations. Store prices with explicit currency indicators (`EGP`).
- **Trade-offs:** Slightly more verbose serialization; guarantees mathematical accuracy down to 1 piastre.

---

### ADR 004: Offline-First SQLite Synchronization Engine for Windows POS
- **Status:** Accepted
- **Context:** Physical checkout registers must never halt sales when internet or LAN connectivity drops.
- **Decision:** Build a local SQLite database in the Windows POS client that mirrors the product catalog and cashier shift state. Every offline transaction is written to a durable local outbox table with a client-generated UUID idempotency key. Upon reconnection, an asynchronous `SyncEngine` streams pending transactions to the backend `/sync/pos-transactions` endpoint using exponential backoff retry.
- **Trade-offs:** Requires conflict resolution mechanisms; handled by version vectors and last-write-wins with reservation reconciliation.

---

### ADR 005: Event-Driven Real-Time Sync via Redis Pub/Sub and WebSockets
- **Status:** Accepted
- **Context:** When a customer reserves stock in the mobile app, cashiers must see available inventory update, and vice-versa.
- **Decision:** Use Redis Pub/Sub as the backend event bus. When inventory or order state mutates, an event (`inventory.updated`, `order.status_changed`) is published to Redis channels. NestJS WebSocket gateways broadcast these events to subscribed active clients (POS terminals and mobile apps).
- **Trade-offs:** Requires Redis service availability; standard REST polling fallback is provided if WebSocket connection degrades.

---

### ADR 006: Provider-Agnostic Egyptian Arabic NLP and Voice Architecture
- **Status:** Accepted
- **Context:** Egyptian consumers frequently use colloquial Egyptian Arabic terms (e.g., "عايز لبن كامل الدسم", "هاتلي أرخص جبنة", "فين التمر المجدول"). External AI speech-to-text models can vary by environment and deployment budget.
- **Decision:** Implement a `Strategy` pattern for speech recognition and NLP parsing. Provide an internal regex/keyword dialect tokenizer for Egyptian Arabic and a clean interface for external Whisper or Google Cloud Speech APIs.
- **Trade-offs:** Local regex parser covers core grocery intents; external LLM handles arbitrary conversational prompts when credentials are configured.

---

### ADR 007: Inventory Concurrency & Optimistic Locking Strategy
- **Status:** Accepted
- **Context:** Flash sales or peak hours can lead to race conditions where mobile shoppers and physical shoppers compete for the same last units in stock.
- **Decision:** Utilize optimistic concurrency locking using an integer `version` field on the `Inventory` entity. Stock reservations decrement `available_quantity` and increment `reserved_quantity` atomically (`UPDATE inventory SET reserved_quantity = reserved_quantity + :qty, version = version + 1 WHERE id = :id AND version = :version AND (quantity - reserved_quantity) >= :qty`). Reservations expire after a configurable 15-minute window if checkout is not completed.
- **Trade-offs:** May cause occasional retry on concurrent checkout; guarantees zero overselling.

---

### ADR 008: Hierarchical Role-Based Access Control (RBAC) & Token Lifecycle
- **Status:** Accepted
- **Context:** Omnichannel supermarket operations have distinct operational security privileges: Super Admin, Store Manager, Cashier, Inventory Operator, and Customer.
- **Decision:** Implement JWT-based authentication with short-lived access tokens (15 minutes) and long-lived refresh tokens (7 days) stored in a secure server session table with token rotation. Server-side `@Roles()` decorator and `RolesGuard` enforce permissions strictly on the API layer.
- **Trade-offs:** Requires stateful refresh-token invalidation table; guarantees immediate revocation of compromised accounts.

---

### ADR 009: Shared API Contracts & Type Safety
- **Status:** Accepted
- **Context:** Web, mobile, desktop, and backend clients must stay synchronized on request and response schemas.
- **Decision:** Define contracts in `packages/shared-types` and generate OpenAPI 3.0 specs from NestJS Swagger annotations.
- **Trade-offs:** Changes to core models require updating shared types; eliminates runtime typing bugs.

---

### ADR 010: Repeatable Enterprise PDF Documentation Generation
- **Status:** Accepted
- **Context:** The master specification requires ten comprehensive, standalone, publication-quality PDF documents covering all facets of the ecosystem.
- **Decision:** Build an automated documentation generator in Node.js / Python (`scripts/generate_all_pdfs.py` / `npm run docs:generate`) that generates compliant, standards-valid, professional PDF documents complete with title pages, tables of contents, metrics tables, workflow diagrams, headers, footers, and page numbers.
- **Trade-offs:** Custom rendering engine ensures deterministic generation without heavy external headless browser dependencies.
