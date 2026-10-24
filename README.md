# 🛒 CYBORG SuperMarket — Omni-Channel Platform

> An Egyptian omni-channel supermarket ecosystem integrating physical store POS checkout, cross-platform mobile shopping, AI voice-driven orders in Egyptian Arabic, and real-time inventory synchronization.

---

## 🏛️ System Architecture

CYBORG SuperMarket is built using **Clean Architecture (Onion)** with asynchronous Python (FastAPI + SQLAlchemy + asyncpg / aiosqlite):

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Applications                          │
│   📱 Flutter Mobile App   ·   🖥️ Windows Desktop POS            │
│   🌐 Admin Dashboard     ·   (Optional Web Storefront)         │
└────────────────────────────────┬────────────────────────────────┘
                                 │ REST / WebSocket / JWT
┌────────────────────────────────▼────────────────────────────────┐
│                       FastAPI Gateway                           │
│     Rate Limiting · JWT Auth · RBAC · Exception Handling        │
├────────────────────────────────┬────────────────────────────────┤
│                     Modular Services                            │
│  • Auth Service (JWT + RBAC)   • Products & Categories          │
│  • Inventory (Optimistic Lock) • Orders & OrderFactory          │
│  • Carts & Family Cart Budget  • Redis Event Bus & Delta Sync   │
├────────────────────────────────┴────────────────────────────────┤
│                        Data Layer                               │
│  • PostgreSQL 16 (Primary)     • Redis 7 (Cache & Pub/Sub)      │
│  • SQLite (POS Local DB)       • pgvector (Product Embeddings)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
CYBORG_SuperMarket/
├── data/
│   └── super_market.xlsx          # 1,000 real Egyptian supermarket products
├── src/
│   ├── config/
│   │   ├── database.py            # Async engine & session factory
│   │   └── settings.py            # Pydantic environment configuration
│   ├── database/
│   │   ├── models.py              # Full ORM entities (User, Product, Order...)
│   │   └── seeder.py              # Excel data importer (1,000 items)
│   └── modules/
│       ├── auth/                  # JWT auth, passwords, RBAC guards
│       ├── cart/                  # Shopping cart & family cart budgets
│       ├── inventory/             # Stock tracking & optimistic locking
│       ├── orders/                # POS, Mobile, and Family cart orders
│       ├── products/              # Bilingual search & category hierarchy
│       └── schemas.py             # Pydantic request/response DTOs
├── cyborg_system_architecture.md  # Detailed architecture & workflow guide
├── docker-compose.yml             # Local PostgreSQL + Redis + Adminer
├── pyproject.toml                 # uv package definition & dependencies
├── main.py                        # FastAPI application entrypoint
├── .env.example                   # Environment configuration template
└── README.md
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.13+
- [`uv`](https://docs.astral.sh/uv/) package manager
- (Optional) Docker & Docker Compose for PostgreSQL/Redis

### 2. Setup with `uv`

```bash
# Clone the repository
git clone <repo-url>
cd CYBORG_SuperMarket

# Install dependencies into virtual environment
uv sync
```

### 3. Run Development Server

```bash
# Start FastAPI backend (defaults to local SQLite database)
uv run python main.py
```

API will be available at:
- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc UI**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### 4. Seed 1,000 Supermarket Products

You can populate the database with real Egyptian supermarket data (bilingual names, categories, barcodes, prices in EGP, images) via the API:

```bash
curl -X POST http://localhost:8000/api/products/seed
```

Or run directly using python:
```bash
uv run python -c "import asyncio; from src.config.database import AsyncSessionLocal, init_db; from src.database.seeder import seed_products; asyncio.run(init_db()); asyncio.run(seed_products(AsyncSessionLocal()))"
```

---

## 🔑 Key Features & Design Patterns

1. **Clean Architecture**: Domain entities are isolated from framework code and database engines.
2. **Optimistic Locking**: `inventory.version` prevents overselling when physical POS and online carts contend for the last in-stock item.
3. **Delta Sync & Offline POS**: Stores local sales in SQLite and uploads change events upon network restoration.
4. **Bilingual Search**: Seamless Arabic & English product search across categories and brands.
5. **Family Cart**: Shared shopping cart with allocated per-member spending limits and budget bars.

---

## 📜 License

Proprietary © Cyborg Supermarket Project. All rights reserved.
