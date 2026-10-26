# CYBORG SUPERMARKET — SECURITY ARCHITECTURE & THREAT MODEL

**Document ID:** SEC-CYB-2026-V1  
**Compliance Target:** PCI-DSS Level 1 Principles, Egyptian Data Privacy Law No. 151 of 2020, OWASP Top 10 API Security  

---

## 1. Authentication & Session Management

- **Password Hashing:** Passwords are salted and hashed using **SHA-512** with unique salt strings. Seed passwords in development (`Admin@123`) must be rotated prior to staging/production deployment.
- **JWT Token Authentication:** Stateless tokens signed via HMAC-SHA256 with secure 256-bit secret keys.
- **Session Revocation:** Logout invalidates the token client-side and records a revocation event in `audit_logs`.

---

## 2. Role-Based Access Control (RBAC)

The system enforces 7 distinct roles with strict vertical and horizontal boundary checks:

| Role | Permitted Actions | Prohibited Actions |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Full access across all stores, settings, users, and audit logs | None |
| `STORE_ADMIN` | Store-level user management, catalog viewing, local shifts | Cross-store data modification |
| `STORE_MANAGER`| Price overrides, stock counts, purchase orders, goods receiving, returns approval | System-wide config changes |
| `INVENTORY_OPERATOR` | GRN entry, stock movement view, low-stock threshold monitoring | User management, financial reports |
| `CASHIER` | POS terminal operation, order ringing, cash tendering, customer returns submission | Shift discrepancy overriding, price editing |
| `CUSTOMER` | Storefront browsing, personal cart, order placement, own support tickets & loyalty balance | Access to admin routes, internal support notes |
| `AUDITOR` | Read-only access to financial reports, shift reconciliations, audit logs | Any write / modify operations |

Authorization checks are enforced strictly on the backend via `authService.checkPermission()`.

---

## 3. Financial Integrity & PCI-DSS Compliance

- **Zero PAN / CVV Storage:** The database **never** accepts, stores, or logs Primary Account Numbers (PAN) or Card Verification Values (CVV).
- **Tokenization:** Payment gateways return tokenized references (`tok_...`) and only the last 4 digits (`card_last4`) are persisted in `payment_transactions` for customer identification on receipts.
- **Webhook HMAC-SHA256 Signatures:** Webhooks from payment gateways (e.g. Fawry / Paymob) are verified using timing-safe comparisons (`crypto.timingSafeEqual`) against a shared secret to prevent forged payment capture events.
- **Idempotency Keys:** Every payment initiation requires an `Idempotency-Key` header, preventing accidental double-charging under network retries.

---

## 4. Sensitive Data Minimization & Redaction

Structured application logging automatically sanitizes sensitive fields before writing logs:
- Fields redacted: `password`, `token`, `secret`, `cvv`, `pan`, `card_number`
- Verified in automated test suite `scripts/verify-backup-restore.js`.

---

## 5. Threat Model Analysis (STRIDE)

| Threat Category | Potential Vector | Mitigation in Cyborg Supermarket |
| :--- | :--- | :--- |
| **Spoofing** | Forged user identities or cashier impersonation | Cryptographically signed JWT tokens, unique terminal IDs, RBAC middleware. |
| **Tampering** | Client modifying price in cart payload before checkout | Server **always** ignores client-provided prices and recalculates subtotal authoritatively from the database catalog. |
| **Repudiation** | Cashier denies cash drawer discrepancy | Every shift open, cash sale, and close event is immutably recorded in `shifts` with cashier ID and timestamp. |
| **Information Disclosure** | Customer viewing internal staff complaint notes | `supportService.getTicketById` filters out messages where `is_internal_note = 1` for customer roles. |
| **Denial of Service** | Flooding voice AI engine or checkout routes | Deterministic SQL keyword fallback protects against cloud AI downtime; payload size limits enforced (10MB max). |
| **Elevation of Privilege** | Cashier calling admin endpoints | Middleware verifies role permissions on every sensitive route; unauthorized calls return `403 Forbidden`. |

---

## 6. Known Security Gaps & Remediation Plan

- **Password Hashing Upgrade:** Upgrade from SHA-512 to Argon2id / bcrypt when native C++ compiler toolchains are available in production build pipelines.
- **Rate Limiting:** Implement sliding-window rate limiting in Nginx reverse proxy (e.g. 100 req/min per IP).
- **ETA Hardware Security Module:** Real Egyptian Tax Authority compliance requires physical USB PKI token (Egypt Trust / Misr Clearing) for hardware-level digital signing of e-Receipts.
