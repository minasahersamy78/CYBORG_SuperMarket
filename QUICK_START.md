# CYBORG SUPERMARKET — QUICK START GUIDE

**Target Environment:** Windows 11 / Windows 10 (or macOS / Linux with Node.js 16+)  
**Ecosystem Components:** Core Backend REST API, Operations Admin Web Dashboard, Customer Web Storefront, Windows Desktop POS (Flutter), Customer Mobile App (Flutter), and SQLite Database with 1,000 SKUs.

---

## ⚡ 3-Minute Quick Start (Fresh Checkout to Running Demo)

Open **PowerShell** in the repository root directory (`d:\CYBORG SUPERMARKET`):

### 1. Run Automated Setup
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
.\scripts\setup\setup-windows.ps1
```
*What this does:*
- Checks for Node.js and Python.
- Copies `.env.example` to `.env`.
- Recreates the SQLite database (`data/cyborg_supermarket.db`).
- Seeds all **1,000 authentic Egyptian supermarket SKUs** from `super_market(1).xlsx`.
- Applies multi-store, payments, delivery, loyalty, support, pricing, and capacity tables.
- Runs all 9 automated test suites (71 tests).

---

### 2. Launch Web Applications
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
.\scripts\development\start-local.ps1
```

Access services immediately in your browser:

| Application | URL | Description | Default Test Credentials |
| :--- | :--- | :--- | :--- |
| **API Gateway & Swagger** | `http://localhost:3000/api/v1/docs` | Central REST API with 35+ endpoints | Token authenticated |
| **API Health Check** | `http://localhost:3000/health` | System readiness & database health | Public |
| **Operations Admin HQ** | `http://localhost:3001` | Management dashboard, real-time sales & inventory | `admin@cyborg.eg` / `Admin@123` |
| **Customer Storefront** | `http://localhost:3002` | Bilingual E-Commerce store (AR/EN) with Voice AI | `customer@cyborg.eg` / `Admin@123` |

---

### 3. Launch Desktop & Mobile Applications

#### Windows Desktop POS (Flutter)
```powershell
cd apps\desktop-pos
flutter pub get
flutter run -d windows
```
*Features:* Barcode scanner input, thermal receipt layout, cash drawer trigger, keyboard hotkeys (`F2` Cash, `F3` Card, `F4` Exact, `F10` Search, `Esc` Void), offline transaction queue.

#### Customer Android App (Flutter)
```powershell
cd apps\mobile-app
flutter pub get
flutter run -d android
```
*Features:* Colloquial Egyptian Arabic voice assistant, 1,000 product catalog, family shopping cart with budget limit bars, smart pantry replenishment alerts.

---

### 4. Run Automated Test Suites
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
node scripts/run-all-tests.js
```
Runs all **9 automated quality gates** verifying dataset integrity, backend APIs, desktop calculations, E2E scenarios, commercial operations, hardware resilience, AI grounding, backup restore, and loyalty/support/pricing services.
