# CYBORG SUPERMARKET — PRE-RELEASE ACCEPTANCE CHECKLIST

Before promoting any release to staging or production environments, all quality gates must be validated and recorded:

---

## 1. Automated Testing & Code Quality Gates
- [x] **Suite 1: Dataset Integrity:** 1,000 products validated with 0 errors (`node scripts/validate-dataset.js`)
- [x] **Suite 2: Backend Services:** 19 unit & integration tests passing (`apps/backend/src/scripts/run-backend-tests.js`)
- [x] **Suite 3: POS Desktop Calculations:** 4 VAT, change, and receipt tests passing (`node scripts/run-pos-tests.js`)
- [x] **Suite 4: E2E Retail Scenarios:** Scenarios A through F passing (`node scripts/run-e2e-scenarios.js`)
- [x] **Suite 5: Commercial Operations:** 13 retail operations & payment tests passing (`node scripts/run-commercial-tests.js`)
- [x] **Suite 6: Hardware & Sync Resilience:** 8 concurrency, outbox, and hardware tests passing (`node scripts/run-resilience-tests.js`)
- [x] **Suite 7: AI Quality & Grounding:** 7 dialect and grounding tests passing, 0% hallucinations (`node scripts/evaluate-ai-engine.js`)
- [x] **Suite 8: Backup & Isolated Restore:** Hot snapshot verified with `PRAGMA integrity_check = ok` (`node scripts/verify-backup-restore.js`)
- [x] **Suite 9: Phase 3 Mandatory Services:** 11 loyalty, support, pricing, and slot tests passing (`node scripts/run-phase3-tests.js`)
- [x] **Master Quality Gate:** All 9 suites passing with 71/71 verified tests (`node scripts/run-all-tests.js`)

---

## 2. Database & Data Integrity
- [x] Relational schema migrated up to version 3 (`schema.sql`, `migrate-commercial-schema.js`, `migrate-phase3-schema.js`)
- [x] 1,000 verified Egyptian grocery products seeded from `super_market(1).xlsx`
- [x] Foreign key constraints, unique barcode indexes, and inventory optimistic locking active
- [x] Offline outbox synchronization verified with UUID deduplication

---

## 3. Security & Financial Compliance
- [x] Default development passwords (`Admin@123`) flagged for rotation in production `.env`
- [x] Zero PAN / CVV card data storage verified
- [x] Timing-safe HMAC-SHA256 webhook signature verification tested
- [x] Server-side authoritative price recalculation active (client tampering rejected)
- [x] Sensitive data redaction verified in structured logs

---

## 4. Documentation & Artifacts
- [x] 8 Enterprise PDFs verified and present in `documentation-pdf/`
- [x] 10 Enterprise PDFs verified and present in `docs/pdf/`
- [x] Commercial Readiness Assessment updated (`docs/commercial-readiness-assessment.md`)
- [x] Hardware Test Plan documented (`docs/hardware-test-plan.md`)
- [x] 3 Standalone release packages generated in `dist/` (`cyborg-desktop-pos.zip`, `cyborg-android-mobile.zip`, `cyborg-web-ecosystem.zip`)

---

## 5. Commercial Go-Live Prerequisites (External Blockers)
- [ ] Registered Egyptian Tax Registration Number for corporate e-Invoicing
- [ ] Physical Egypt Trust / Misr Clearing USB HSM Token for POS e-Receipt signing
- [ ] Commercial merchant agreement and production webhook secret from Paymob / Fawry
- [ ] Production domain name, SSL wildcard certificates, and Cloudflare DNS routing
- [ ] Physical Honeywell barcode scanners and Epson TM-T88VI thermal printers for branch registers
