# ⚡ CYBORG SUPERMARKET — Production-Oriented, AI-Powered Omnichannel Retail Ecosystem

[![Quality Gate](https://img.shields.io/badge/Quality%20Gate-8%20Suites%20%7C%2060%20Tests%20Passed-10B981.svg)](#automated-testing--verification)
[![Products Seeded](https://img.shields.io/badge/Catalog-1%2C000%20Verified%20SKUs-0F766E.svg)](#real-dataset-integration)
[![Architecture](https://img.shields.io/badge/Architecture-Onion%20%2F%20Clean-38BDF8.svg)](#system-architecture)
[![Commercial Readiness](https://img.shields.io/badge/Commercial%20Gate-Assessed%20%26%20Closed-6366F1.svg)](docs/commercial-readiness-assessment.md)
[![Documentation](https://img.shields.io/badge/Enterprise%20PDFs-10%20Validated-F59E0B.svg)](#enterprise-pdf-documentation-package)

> **Cyborg Supermarket** is an integrated, omnichannel Egyptian supermarket platform that unifies brick-and-mortar store branches with modern digital shopping experiences. The platform guarantees centralized business logic and a single source of truth across cashier desktop registers, customer mobile applications, digital storefronts, and store operations dashboards.

---

## 📦 Downloadable Release Packages (ZIP)

Direct standalone offline archives are packaged in [`dist/`](dist/):

| Package Archive | Target Platform | Description | Direct Link |
| :--- | :--- | :--- | :--- |
| **Desktop POS Application** | Windows Desktop (Flutter) | Cashier register with barcode scanner input, F2/F3 hotkeys, thermal ESC/POS receipt generation, cash drawer pulse, and offline SQLite sync queue. | [`dist/cyborg-desktop-pos.zip`](dist/cyborg-desktop-pos.zip) |
| **Customer Android App** | Android Mobile (Flutter) | Customer shopping app with Egyptian Arabic dialect voice assistant, 1,000 product catalog, shared family cart with spend limits, and smart pantry restock. | [`dist/cyborg-android-mobile.zip`](dist/cyborg-android-mobile.zip) |
| **Web Ecosystem & API** | Node.js / Web | Complete web platform including Operations Admin Dashboard (Port 3001), Customer Web Storefront (Port 3002), Core Backend REST API (Port 3000), and SQLite DB with 1,000 SKUs. | [`dist/cyborg-web-ecosystem.zip`](dist/cyborg-web-ecosystem.zip) |

---

## 📑 Table of Contents
1. [Downloadable Release Packages (ZIP)](#-downloadable-release-packages-zip)
2. [Commercial Readiness Assessment](#-commercial-readiness-assessment)
3. [System Architecture Overview](#system-architecture)
4. [Ecosystem Applications Inventory](#ecosystem-applications-inventory)
5. [Real Dataset Integration (1,000 SKUs)](#real-dataset-integration)
6. [Repository Monorepo Structure](#repository-monorepo-structure)
7. [Prerequisites & Development Environment](#prerequisites--development-environment)
8. [Quick-Start Commands (PowerShell & Bash)](#quick-start-commands)
9. [Automated Testing & Verification](#automated-testing--verification)
10. [Enterprise PDF Documentation Package (10 Books)](#enterprise-pdf-documentation-package)
11. [End-to-End Demonstration Script](#end-to-end-demonstration-script)
12. [Security & Threat Model](#security--threat-model)
13. [Known Operational Limitations & Roadmap](#known-operational-limitations--roadmap)

---

## 🎯 Commercial Readiness Assessment

The ecosystem includes a comprehensive commercial readiness audit and production gap closure analysis:
- **Commercial Assessment Report:** [`docs/commercial-readiness-assessment.md`](docs/commercial-readiness-assessment.md)
  - Full Gap Matrix across Sections A-I (Retail Operations, Financial Integrity, Delivery, Hardware, Sync Resilience, Analytics, AI Quality, Backup & Recovery).
  - Four-tier commercial release plan (Local Demo -> Pilot Store -> Multi-Store -> Scalable Production).
  - Egyptian Tax Authority (ETA) e-Receipt & e-Invoicing architecture specification.
- **Hardware Compatibility & Test Plan:** [`docs/hardware-test-plan.md`](docs/hardware-test-plan.md)
  - Detailed verification protocols for barcode scanners, receipt printers, cash drawers, touchscreens, and power outage resilience.

---

## 🏛️ System Architecture

Cyborg Supermarket is implemented following strict **Clean Architecture (Onion Architecture)** principles, ensuring that business rules remain completely decoupled from databases, HTTP frameworks, and hardware drivers:

- **Layer 1 — Domain Entities:** Independent business models (`Product`, `Order`, `Inventory`, `Shift`, `Cart`).
- **Layer 2 — Application Use Cases:** Business interactors (`CreateOrder`, `SyncInventory`, `ProcessVoiceCommand`, `EnforceBudget`).
- **Layer 3 — Interface Adapters:** REST controllers, WebSocket gateways, and Data Transfer Objects (DTOs).
- **Layer 4 — Infrastructure:** PostgreSQL 16 (relational & pgvector), Redis 7 (event pub/sub), and SQLite (POS local persistence).

### Core Design Patterns
- **Repository Pattern:** Isolates database drivers from core domain logic.
- **Optimistic Locking:** Inventory records maintain a concurrency `version` integer to prevent overselling (`reserved_qty + sold <= quantity`).
- **Outbox Pattern:** Windows POS persists transactions to local SQLite `sync_outbox` before network dispatch.
- **Factory Pattern:** `OrderFactory` instantiates order types based on origin (`POS`, `ONLINE`, `FAMILY_CART`).
- **Strategy Pattern:** Decouples Egyptian Arabic NLP tokenization from cloud STT providers.

Editable Mermaid diagrams are located in [`diagrams/mermaid/`](diagrams/mermaid/).

---

## 📱 Ecosystem Applications Inventory

| Application | Platform / Framework | Directory | Port / Binary | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API Gateway** | NestJS / TypeScript | `apps/backend/` | Port 3000 | Clean Architecture modular monolith, REST API, WebSocket gateway, sync coordinator. |
| **Operations Dashboard** | Next.js / Web | `apps/admin-web/` | Port 3001 | Management HQ: real-time database metrics, low-stock alerts, shift audits, catalog management. |
| **Customer Storefront** | Next.js / Web | `apps/customer-web/` | Port 3002 | Bilingual customer web store (Arabic RTL & English LTR) with Egyptian Arabic voice shopping. |
| **Windows Desktop POS** | Flutter Desktop / Dart | `apps/desktop-pos/` | Windows Native | Cashier checkout terminal with SQLite offline outbox, barcode scanning, and receipt printing. |
| **Customer Mobile App** | Flutter / Dart | `apps/mobile-app/` | Android / iOS | BLoC-based mobile shopping, shared family cart with spend limits, smart pantry replenishment. |

---

## 📊 Real Dataset Integration

The system is seeded directly from the provided retail catalog [`data/source/super_market(1).xlsx`](data/source/super_market(1).xlsx):

- **Total Audited Products:** Exactly **1,000 active retail SKUs**
- **Categories (5):** Food Cupboard (309), Beverages (292), Fresh Food (199), Fruits & Vegetables (160), Frozen Food (40)
- **Subcategories:** 7 populated retail subcategories
- **Identified Egyptian Brands:** 143 domestic brands (Dina Farms, Juhayna, Almarai, Domty, Lamar, etc.)
- **Monetary Unit:** Egyptian Pounds (EGP) with exact two-decimal precision (`NUMERIC(10,2)`)
- **Secondary Sheet:** Evaluated sheet `Sheet1` containing `#REF!` error and safely discarded.
- **Barcode Deduplication:** 42 promotional bundle duplicate barcodes detected and audited.

---

## 📁 Repository Monorepo Structure

```text
cyborg-supermarket/
├── apps/
│   ├── backend/             # NestJS modular monolith API
│   ├── admin-web/           # Enterprise operations web dashboard
│   ├── customer-web/        # Customer-facing responsive storefront
│   ├── desktop-pos/         # Flutter Windows Point of Sale application
│   └── mobile-app/          # Flutter Android & iOS shopping application
├── packages/
│   ├── shared-types/        # Shared TypeScript domain models & enums
│   └── api-contracts/       # REST request/response contracts & DTOs
├── infrastructure/
│   ├── docker/              # Dockerfiles for backend, admin, and customer apps
│   ├── monitoring/          # Prometheus configuration
│   └── database/            # Database initialization scripts
├── data/
│   ├── source/              # Verified super_market(1).xlsx & super_market.csv
│   ├── processed/           # Normalized product JSON records
│   └── import-reports/      # Automated ingestion & audit reports
├── docs/
│   ├── source-analysis.md   # Detailed technical analysis of PDF & Excel
│   ├── architecture-decisions.md # Architecture Decision Records (ADRs 001 - 010)
│   └── pdf/                 # Ten verified enterprise PDF documents
├── diagrams/
│   └── mermaid/             # Editable .mmd diagram source files
├── scripts/                 # Quality gates, import pipelines & test runners
├── .github/workflows/       # Automated CI/CD pipelines
├── docker-compose.yml       # Production & local Docker Compose stack
├── .env.example             # Documented configuration template
└── README.md                # Master ecosystem handbook
```

---

## 🛠️ Prerequisites & Development Environment

- **Node.js:** v16.20+ or v18.x
- **Python:** v3.10+ (for documentation generation & dataset verification)
- **Database:** Local SQLite engine (`data/cyborg_supermarket.db`) or PostgreSQL 16
- **Docker:** Optional for containerized deployment

---

## 🚀 Quick-Start Commands

Run all commands from the repository root:

### 1. Validate Dataset
```powershell
npm run data:validate
```

### 2. Import & Seed Database (1,000 SKUs)
```powershell
npm run data:import
```

### 3. Run All Automated Tests (100% Quality Gate)
```powershell
npm run test
```

### 4. Start Central Backend API (Port 3000)
```powershell
npm run start:backend
# API running at: http://localhost:3000/api/v1
# API Docs at:    http://localhost:3000/api/v1/docs
# Health Check:   http://localhost:3000/health
```

### 5. Start Operations Admin Dashboard (Port 3001)
```powershell
npm run start:admin
# Open in browser: http://localhost:3001
```

### 6. Start Customer Storefront (Port 3002)
```powershell
npm run start:web
# Open in browser: http://localhost:3002
```

### 7. Generate & Validate Enterprise PDF Documentation Package
```powershell
npm run docs:generate
```

---

## 🧪 Automated Testing & Verification

The test suite systematically verifies the entire ecosystem:

```powershell
npm run test
```

### Verified Test Suites:
1. **Dataset Integrity:** Validates headers, data types, Arabic/English text, price bounds, and duplicate barcodes across all 1,000 rows.
2. **Backend Core Services (19 Tests):**
   - Super Admin login & token signing
   - Authentication rejection for invalid credentials
   - RBAC role permission enforcement (Super Admin, Store Manager, Cashier, Customer)
   - Product catalog pagination, barcode lookup, bilingual search, price range filtering
   - Inventory balance checks and optimistic reservation locking
   - Shopping cart VAT (14%) recalculation and family cart budget enforcement
   - Server-side price recalculation, order creation, and stock deduction
   - Order state machine legal/illegal transition validation
   - Cashier shift opening, sales recording, and cash drawer discrepancy reconciliation
   - Egyptian Arabic colloquial NLP intent parsing and catalog grounding
   - Intelligent product substitutions for low-stock items
   - Cloud-local sync outbox ingestion with duplicate protection
   - Database-backed operational dashboard analytics
3. **POS Hardware & Desktop Calculations (4 Tests):**
   - Exact 14% Egyptian VAT calculation
   - Cash tendering & change calculation
   - Receipt layout formatting
   - Cash drawer discrepancy formula
4. **End-to-End Scenarios A through F (6 Scenarios):**
   - Scenario A: Product Import Verification
   - Scenario B: Online Shopping Lifecycle
   - Scenario C: POS Checkout & Receipt Generation
   - Scenario D: Offline POS & Idempotent Sync
   - Scenario E: Authorization & Privilege Enforcement
   - Scenario F: Data Integrity & Negative Stock Protection
5. **Commercial Readiness & Retail Operations (13 Tests):**
   - Multi-store & multi-terminal retrieval and management
   - Supplier purchase orders & Goods Receiving (GRN) with automatic inventory increment
   - Stock movement immutable audit trail (`RECEIVING`, `SALE`, `RETURN`, `ADJUSTMENT`)
   - Physical stock counts & discrepancy reconciliation
   - Returns, exchanges & partial refund management with sellable stock restoration
   - Configurable promotions & discount precedence engine
   - Metric unit of measure (UOM) conversions with dimensional validation
   - Batch & expiry date tracking with upcoming expiration alerts
   - Payment initiation & idempotent processing
   - Payment capture & PCI-DSS compliance (zero PAN/CVV storage)
   - Webhook HMAC-SHA256 signature verification & forgery rejection
   - Delivery zone fee & minimum order calculation
   - Fulfillment state transition validation & product substitutions
6. **Hardware & Synchronization Resilience (8 Tests):**
   - Barcode scanner input validation & EAN-13 emulation
   - ESC/POS thermal receipt formatting with full paper cut commands
   - Cash drawer DKD solenoid pulse trigger verification
   - Keyboard-only POS hotkey mapping (F2, F3, F4, F10, Esc)
   - Idempotent batch sync with deduplication protection
   - Concurrent inventory optimistic locking conflict prevention
   - Stale price client tampering detection & authoritative catalog price enforcement
   - Offline transaction queue persistence and crash recovery
7. **AI Quality & Cost Control Benchmark (7 Tests):**
   - Egyptian Arabic colloquial intent parsing ("عاوز", "عايز", "هاتلي", "بكام")
   - 100% catalog grounding with zero hallucinations on unavailable luxury items
   - Non-AI deterministic SQL keyword search fallback verification
   - Security invariant verification (AI layer cannot alter prices or bypass permissions)
   - Real-time latency (19.80 ms average) and simulated token cost accounting
8. **Database Backup & Isolated Restore Verification:**
   - Online hot backup creation via SQLite `.backup` API
   - Isolated restore environment integrity check (`PRAGMA integrity_check = ok`)
   - Exact catalog row verification (1,000 products preserved)
   - Structured JSON logging with PCI-DSS sensitive data redaction

---

## 📚 Enterprise PDF Documentation Package

Ten complete, publication-grade, verified PDF documents are generated in [`docs/pdf/`](docs/pdf/):

| # | Filename | Document Title | Verified Pages | Status |
| :---: | :--- | :--- | :---: | :---: |
| **01** | [`01_Cyborg_Complete_Project_Handbook.pdf`](docs/pdf/01_Cyborg_Complete_Project_Handbook.pdf) | Complete Project Handbook | 3 | **VERIFIED** |
| **02** | [`02_System_Architecture_and_Infrastructure.pdf`](docs/pdf/02_System_Architecture_and_Infrastructure.pdf) | System Architecture and Infrastructure | 3 | **VERIFIED** |
| **03** | [`03_Complete_Workflows_and_Sequence_Diagrams.pdf`](docs/pdf/03_Complete_Workflows_and_Sequence_Diagrams.pdf) | Complete Workflows and Sequence Diagrams | 3 | **VERIFIED** |
| **04** | [`04_Database_ERD_and_Data_Dictionary.pdf`](docs/pdf/04_Database_ERD_and_Data_Dictionary.pdf) | Database ERD and Data Dictionary | 3 | **VERIFIED** |
| **05** | [`05_API_Reference_and_Integration_Guide.pdf`](docs/pdf/05_API_Reference_and_Integration_Guide.pdf) | API Reference and Integration Guide | 2 | **VERIFIED** |
| **06** | [`06_Security_Architecture_and_Threat_Model.pdf`](docs/pdf/06_Security_Architecture_and_Threat_Model.pdf) | Security Architecture and Threat Model | 2 | **VERIFIED** |
| **07** | [`07_QA_Testing_and_Verification_Report.pdf`](docs/pdf/07_QA_Testing_and_Verification_Report.pdf) | QA Testing and Verification Report | 2 | **VERIFIED** |
| **08** | [`08_Deployment_Operations_and_Recovery_Manual.pdf`](docs/pdf/08_Deployment_Operations_and_Recovery_Manual.pdf) | Deployment, Operations, and Recovery Manual | 2 | **VERIFIED** |
| **09** | [`09_User_Admin_and_Cashier_Manual.pdf`](docs/pdf/09_User_Admin_and_Cashier_Manual.pdf) | User, Administrator, and Cashier Manual | 2 | **VERIFIED** |
| **10** | [`10_Cyborg_Product_Presentation_and_Demo_Guide.pdf`](docs/pdf/10_Cyborg_Product_Presentation_and_Demo_Guide.pdf) | Product Presentation and Demo Guide | 2 | **VERIFIED** |

View full manifest: [`docs/pdf/documentation-manifest.json`](docs/pdf/documentation-manifest.json).

---

## 🎬 End-to-End Demonstration Script

Follow this repeatable sequence to evaluate the complete integrated ecosystem:

1. **Seed Data:** Run `npm run data:import`. Confirms 1,000 products imported into `data/cyborg_supermarket.db`.
2. **Launch Backend API:** Run `npm run start:backend`. Probe `http://localhost:3000/api/v1/products?limit=5`.
3. **Launch Operations Dashboard:** Run `npm run start:admin`. Open `http://localhost:3001` in your browser. Inspect live product count, category distribution, revenue, and active cashier shifts.
4. **Launch Customer Storefront:** Run `npm run start:web`. Open `http://localhost:3002`.
   - Search for "Dina Farms" or "جهينة".
   - Toggle language to `عربي / RTL` to confirm Arabic typography.
   - Add items to cart; inspect the 14% Egyptian VAT calculation.
   - Submit a test order; confirm order ID is generated.
5. **Test AI Egyptian Voice Assistant:**
   - Tap the microphone button in the storefront.
   - Enter: `"عايز لبن جهينه كامل الدسم"` or `"بكام سمنة بلدي"`.
   - Confirm the AI parses the colloquial intent, queries the real database, and returns accurate pricing in EGP.
6. **Launch Desktop POS:** Open `apps/desktop-pos` in Flutter.
   - Scan barcode `6224011439398`.
   - Notice immediate retrieval of Dina Farms Cottage Cheese (69 EGP).
   - Press F2 to tender cash; inspect thermal receipt output.
7. **Verify Operations Dashboard Update:**
   - Refresh `http://localhost:3001`.
   - Observe that total revenue, completed orders count, and inventory balances update in real-time.

---

## 🛡️ Security & Development Accounts

Default development seed users (for local testing only):
- **Super Administrator:** `admin@cyborg.eg` / `Admin@123`
- **Store Manager:** `manager@cyborg.eg` / `Admin@123`
- **Cashier:** `cashier@cyborg.eg` / `Admin@123`
- **Inventory Operator:** `inventory@cyborg.eg` / `Admin@123`
- **Customer:** `customer@cyborg.eg` / `Admin@123`
- **Auditor:** `auditor@cyborg.eg` / `Admin@123`

*Warning: Never deploy default credentials in staging or production environments.*

---

## ⚠️ Known Operational Limitations & Roadmap

- **External Payment Gateways:** Real Fawry and Paymob payment integrations require commercial merchant contracts and production webhook secrets; simulated payment modes are active.
- **Physical Hardware:** Thermal printing and cash drawer firing utilize standard ESC/POS protocol abstractions. In developer environments without physical USB POS printers, print jobs route cleanly to the console / ASCII print log.
- **Vector Embeddings:** The source dataset provided precomputed embeddings for 2 items; lexical full-text search is active as the primary high-throughput search engine while pgvector semantic search is ready for background embedding pipelines.
