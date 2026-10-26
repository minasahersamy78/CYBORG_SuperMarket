# CYBORG SUPERMARKET — RUN & TEST MANUAL

This document provides exact, copy-paste-ready commands for starting, verifying, and testing every component of the Cyborg Supermarket platform.

---

## 1. System Requirements & Tested Environment

- **Operating System:** Windows 11 / Windows 10 (or macOS / Linux)
- **Node.js:** v16.20.2 or v18+ (tested at `C:\Program Files\nodejs\node.exe`)
- **Python:** 3.12+ (tested at `C:\Users\01286\AppData\Local\Programs\Python\Python312\python.exe`)
- **SQLite:** 3.44+ (tested at `C:\Program Files\platform-tools\sqlite3.exe`)
- **Flutter SDK:** 3.x+ (for Desktop POS and Mobile App)
- **Zero npm dependencies:** Core backend operates purely on Node.js standard library modules (`http`, `crypto`, `fs`, `path`, `child_process`) for high reliability and zero supply-chain vulnerability.

---

## 2. Individual Application Startup Commands

### Core Backend REST API (Port 3000)
```powershell
# Windows PowerShell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
node apps/backend/src/standalone-server.js

# macOS / Linux
node apps/backend/src/standalone-server.js
```
- **Port:** 3000
- **Base URL:** `http://localhost:3000/api/v1`
- **Health Check:** `http://localhost:3000/health`
- **API Documentation:** `http://localhost:3000/api/v1/docs`

---

### Operations Admin Dashboard (Port 3001)
```powershell
# Windows PowerShell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
node apps/admin-web/server.js

# macOS / Linux
node apps/admin-web/server.js
```
- **Port:** 3001
- **URL:** `http://localhost:3001`
- **Features:** Live gross revenue, order distribution, category breakdowns, shift audits, low-stock warnings, and audit logs.

---

### Customer Web Storefront (Port 3002)
```powershell
# Windows PowerShell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
node apps/customer-web/server.js

# macOS / Linux
node apps/customer-web/server.js
```
- **Port:** 3002
- **URL:** `http://localhost:3002`
- **Features:** Bilingual Arabic RTL / English LTR, category filtering, cart drawer, 14% Egyptian VAT calculation, voice assistant modal with Egyptian dialect recognition.

---

### Windows Desktop POS Application (Flutter)
```powershell
# Windows PowerShell
cd apps\desktop-pos
flutter pub get
flutter run -d windows
```
- **Hotkeys:**
  - `F2`: Tender Cash payment
  - `F3`: Tender Card terminal payment
  - `F4`: Tender Exact Cash amount
  - `F10`: Open Product Search catalog
  - `Esc`: Abort modal or void line

---

### Customer Android Mobile App (Flutter)
```powershell
# Windows PowerShell
cd apps\mobile-app
flutter pub get
flutter run -d android
```

---

## 3. Database & Dataset Import Commands

### Full Re-Import & Schema Initialization (1,000 SKUs)
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
node scripts/import-products.js
node scripts/migrate-commercial-schema.js
node scripts/migrate-phase3-schema.js
```

### Validate Dataset Without Importing
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
node scripts/validate-dataset.js
```

---

## 4. Automated Testing Commands

### Master Test Suite (Runs All 9 Quality Gates)
```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
node scripts/run-all-tests.js
```

### Individual Test Suites

1. **Dataset Integrity Validation:**
   ```powershell
   node scripts/validate-dataset.js
   ```
2. **Backend Unit & Integration Tests (19 tests):**
   ```powershell
   node apps/backend/src/scripts/run-backend-tests.js
   ```
3. **POS Hardware & Calculations (4 tests):**
   ```powershell
   node scripts/run-pos-tests.js
   ```
4. **End-to-End Scenarios A through F (6 tests):**
   ```powershell
   node scripts/run-e2e-scenarios.js
   ```
5. **Commercial Readiness & Retail Operations (13 tests):**
   ```powershell
   node scripts/run-commercial-tests.js
   ```
6. **Hardware & Synchronization Resilience (8 tests):**
   ```powershell
   node scripts/run-resilience-tests.js
   ```
7. **AI Quality & Grounding Benchmark (7 tests):**
   ```powershell
   node scripts/evaluate-ai-engine.js
   ```
8. **Database Hot Backup & Isolated Restore Verification:**
   ```powershell
   node scripts/verify-backup-restore.js
   ```
9. **Phase 3 Mandatory Features (Loyalty, Support, Pricing, Slots) (11 tests):**
   ```powershell
   node scripts/run-phase3-tests.js
   ```

---

## 5. Enterprise PDF Documentation Generation
```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" scripts/generate_all_pdfs.py
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" scripts/validate_pdfs.py
```
Output directory: `docs/pdf/` and `documentation-pdf/`.
