# Dataset Audit & Ingestion Report

**Report Generated:** 2026-10-24T22:29:39.702Z  
**Source Catalog:** `super_market(1).xlsx / products`  
**Records Audited:** **1000 valid products**  

---

## 1. Catalog High-Level Metrics
- **Total Validated Products:** 1000
- **Categories:** 5
- **Populated Subcategories:** 7
- **Identified Egyptian Brands:** 143
- **Price Range (EGP):** 3.95 EGP to 1074.95 EGP (Average: 83.24 EGP)
- **Image Assets Referenced:** 1000 / 1000 (100% have image URLs)
- **Precomputed Embeddings:** 2

---

## 2. Category Distribution
| Category (English) | Record Count | Percentage |
| :--- | :--- | :--- |
| Fresh Food | 199 | 19.9% |
| Frozen Food | 40 | 4.0% |
| Fruits & Vegetables | 160 | 16.0% |
| Beverages | 292 | 29.2% |
| Food Cupboard | 309 | 30.9% |

---

## 3. Top Brands Represented
1. **Almarai** (41 items)
2. **Juhayna** (38 items)
3. **Domty** (33 items)
4. **Schweppes** (27 items)
5. **Lamar** (25 items)
6. **El shamadan** (18 items)
7. **Healthy** (14 items)
8. **El Doha** (14 items)
9. **Rani** (13 items)
10. **Dina Farms** (12 items)
11. **Barbican** (11 items)
12. **Moussy** (10 items)
13. **Bashaer** (9 items)
14. **Americana** (9 items)
15. **Fanta** (9 items)

---

## 4. Ingestion Integrity Summary
- **Primary Source:** `super_market(1).xlsx` (Sheet `products`).
- **Secondary Sheet:** Sheet `Sheet1` inspected and discarded as empty `#REF!` error sheet.
- **Repeatable Import Capability:** Verified duplicate-safe via PostgreSQL / SQLite `UPSERT ON CONFLICT(id)`.
