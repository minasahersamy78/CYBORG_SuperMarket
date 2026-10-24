# Source Analysis & Technical Specification

## 1. Executive Summary

This document provides a comprehensive technical analysis of the primary architectural specification (`cyborg_system_architecture.pdf`) and the real product dataset (`super_market(1).xlsx` / `super_market.csv`) provided for the **Cyborg Supermarket** omnichannel retail ecosystem.

The system is designed as an integrated Egyptian supermarket platform connecting brick-and-mortar stores and modern digital customer touchpoints via a unified backend, centralized business rules, resilient offline-first desktop POS terminals, an Android mobile shopping app, an operations web dashboard, and a customer web storefront.

---

## 2. Source Material Overview

| Source Artifact | Type | Description / Role |
| :--- | :--- | :--- |
| `cyborg_system_architecture.pdf` | Architectural Specification (16 pages) | Master blueprint defining system topology, Onion / Clean Architecture layers, design patterns, detailed monorepo directory layout, database ERD, role taxonomy, 8-stage delivery timeline, and data seed mappings. |
| `super_market(1).xlsx` | Real Product Dataset (1,000 records) | Production product catalog extracted from Egyptian retail operations, comprising bilingual product names, dual categorization, brands, sizes, formats, pricing (EGP), image asset URLs, and vector embedding vectors. |

---

## 3. Architectural Decomposition (Derived from PDF)

### 3.1 Architectural Style & Layers: Clean Architecture (Onion)
The PDF mandates a strict **Clean Architecture (Onion Architecture)** model where dependencies point inward toward business rules:

1. **Layer 1 — Domain (Entities):**
   - Core domain business models completely decoupled from external frameworks.
   - Core entities: `User`, `Product`, `Category`, `Order`, `OrderItem`, `Cart`, `FamilyCart`, `Inventory`, `Shift`, `SyncEvent`.
2. **Layer 2 — Application (Use Cases):**
   - Pure application business logic orchestration: `CreateOrder`, `SyncInventory`, `ProcessVoiceCommand`, `EnforceFamilyBudget`, `ReconcileShift`.
3. **Layer 3 — Interface Adapters:**
   - Controllers (REST & WebSocket gateways).
   - Data Transfer Objects (DTOs) with bidirectional mapping.
   - Repository interfaces defined in Domain, implemented in Infrastructure.
   - Presenters and API contract serializers.
4. **Layer 4 — Infrastructure / Frameworks:**
   - NestJS / Express HTTP runtime.
   - PostgreSQL 16 (Primary transactional relational database + pgvector vector store).
   - Redis 7 (Caching, rate-limiting, and Pub/Sub Event Bus).
   - SQLite (Local POS database for offline persistence).
   - External service interfaces (Speech-to-Text, LLM / NLP providers, payment gateways, thermal printers, barcode scanners).

### 3.2 Key Design Patterns Mandated by Blueprint
- **Repository Pattern:** Applied to all data access to isolate domain models from PostgreSQL TypeORM/Prisma and SQLite engines.
- **BLoC / Cubit:** Applied across Flutter Mobile and Flutter POS applications for predictable unidirectional reactive state management.
- **CQRS:** Separates read models (high-throughput catalog browsing, fast cache lookups) from write models (order creation, inventory reservation).
- **Event Sourcing / Event Log:** Tracks all stock adjustments and mutations as immutable `SYNC_EVENT` rows.
- **Observer / Pub-Sub:** Redis Event Bus coordinates real-time multi-terminal broadcast between POS and cloud.
- **Strategy Pattern:** Decouples AI speech recognition and embedding providers (Google Speech, Whisper, HuggingFace/OpenAI).
- **Factory Pattern:** `OrderFactory` instantiates order types based on origin (`POS`, `MOBILE`, `FAMILY_CART`).
- **Adapter Pattern:** Hardware abstraction layer for barcode scanners (keyboard wedge / serial / Bluetooth) and ESC/POS thermal receipt printers.
- **Optimistic Locking:** Inventory records maintain a `version` field to ensure safe concurrent cart reservation and POS checkout (`reserved_qty + sold <= quantity`).

---

## 4. Real Dataset Profiling & Analysis

### 4.1 Worksheet Statistics & Workbook Inventory
- **Sheet 1 (`products`):**
  - **Row Count:** 1,001 rows (1 header row + 1,000 product records).
  - **Column Count:** 15 columns.
  - **Status:** Primary source of truth for the product catalog. Valid and ready for database seeding.
- **Sheet 2 (`Sheet1`):**
  - **Row Count:** 1 row containing only `#REF!`.
  - **Status:** Evaluated and flagged as an unpopulated Excel artifact; discarded by the automated ingestion pipeline with an explanatory log entry.
- **Target Currency:** Egyptian Pounds (EGP).
- **Country of Origin:** Egypt (100% of rows).

### 4.2 Column Inventory & Mapping Rules

| Original Column Header | Clean Normalized Field | Target PostgreSQL Type | Required / Optional | Observed Characteristics |
| :--- | :--- | :--- | :--- | :--- |
| `barcode` | `barcode` | `VARCHAR(32)` (Unique) | Mandatory | Numeric strings up to 13 digits (EAN-13, internal store codes starting with `222...`). Stored as string to preserve leading zeros. |
| `ArabicPrtoductName` *(source typo preserved in loader)* | `name_ar` | `VARCHAR(255)` | Mandatory | Arabic product name with quantities/weights in Arabic characters. |
| `EnglishProductName` | `name_en` | `VARCHAR(255)` | Mandatory | English product name with sizes. |
| `ArabicCategory` | `category_ar` | `VARCHAR(100)` | Mandatory | High-level Arabic category (e.g., أطعمة طازجة). |
| `EnglishCategory` | `category_en` | `VARCHAR(100)` | Mandatory | High-level English category (e.g., Fresh Food, Beverages). |
| `ArabicSubCategory` | `subcategory_ar` | `VARCHAR(100)` | Optional | Subcategory in Arabic. Empty in ~15.2% of raw rows; pipeline assigns default fallback from parent category. |
| `EnglishSubCategory` | `subcategory_en` | `VARCHAR(100)` | Optional | Subcategory in English. Empty in raw rows when Arabic is empty; pipeline infers taxonomy. |
| `brand` | `brand` | `VARCHAR(100)` | Optional | 143 distinct brands identified (e.g., Dina Farms, Juhayna, Almarai, Domty, Lamar). Missing in unbranded produce. |
| `country` | `country` | `VARCHAR(50)` | Mandatory | Populated with "Egypt". |
| `size` | `size` | `VARCHAR(50)` | Optional | Pack size / net volume (e.g., 450g, 1 Liter, 250g). |
| `format` | `format` | `VARCHAR(50)` | Mandatory | Unit format: `pieces`, `Kilo`, `Pack of 6`. |
| `price` | `price` | `NUMERIC(10, 2)` | Mandatory | Price in EGP. Exact decimal representation used to eliminate floating-point rounding errors. |
| `image` | `image_url` | `TEXT` | Optional | URLs to Carrefour/Majid Al Futtaim CDN. Many rows contain multi-line URLs separated by `_x000D_\n`. Ingest pipeline extracts primary image and array of gallery images. |
| `id` | `source_id` | `INTEGER` | Mandatory | Source sequence ID (1 to 1000). |
| `embedding` | `embedding` | `TEXT` / `VECTOR(1536)` | Optional | 1536-dimensional vector embedding. In the raw file, only records 1 and 2 contain precomputed vectors; remaining records require vector generation or lexical fallback. |

### 4.3 Data Quality Anomalies Identified
1. **Multi-line Image URLs:** The `image` column uses `_x000D_\n` delimiters for multiple image angles. The ingestion script splits strings by `\r`, `\n`, and `_x000D_` to select the primary image while preserving secondary images.
2. **Missing Subcategories & Brands:** Produce and deli counter items (e.g., fruits, loose vegetables, bulk cheese) do not always list a subcategory or brand. The database schema permits `NULL` values and provides fallback indexing.
3. **Embeddings Sparsity:** Because only 2 of the 1,000 rows contain vectors in the source sheet, the system must not crash when embeddings are absent. The catalog service provides PostgreSQL trigram/full-text search as the primary resilient mechanism, with vector cosine search used when embeddings exist.

---

## 5. Architectural Ambiguities & Engineering Resolutions

| Ambiguity in Source PDF | Engineering Decision Taken | Rationale |
| :--- | :--- | :--- |
| **Monorepo Structure vs Single Apps:** The PDF displays both a flat `backend/`, `mobile/`, `pos/` and a nested monorepo. | Standardized on `apps/backend`, `apps/admin-web`, `apps/customer-web`, `apps/mobile-app`, `apps/desktop-pos`, `packages/shared-types`, `packages/api-contracts`. | Monorepo layout guarantees consistent TypeScript contract sharing and streamlined Docker builds. |
| **Monetary Representation:** PDF shows `DECIMAL(10,2)`. | Implemented PostgreSQL `NUMERIC(10, 2)` and integer cents / piastres in arithmetic logic. | Avoids floating-point precision loss during multi-item discounts and tax calculations. |
| **Offline Sync Conflicts:** PDF specifies last-write-wins with version vectors. | Designed `SyncEvent` table with UUID operation IDs, deterministic timestamp comparisons, and stock reservation guards. | Prevents duplicate charges or overselling during network reconnect. |
| **Voice Processing Limitations:** Real-time Whisper or Google Speech requires cloud credentials. | Implemented provider-independent audio ingestion service with fallback Egyptian Arabic text parser and intent resolver. | Ensures the application functions out-of-the-box in local development while maintaining full production readiness. |
