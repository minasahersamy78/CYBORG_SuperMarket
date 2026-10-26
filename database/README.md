# Database & SQL (قواعد البيانات والـ SQL)

## 📌 الوصف والغرض (What this folder does)
هذا الفولدر مخصص **لمسؤول ومطور قواعد البيانات (Database & SQL Specialist)**.
يحتوي على كافة ملفات قاعدة البيانات العلاقية **SQLite**، ملفات الهجرة (Migrations)، البيانات الأولية (Seeds)، وملف الإكسيل الأصلي لكتالوج المنتجات.

## 📁 محتويات الفولدر (Folder Contents)
- **`cyborg_supermarket.db`**: ملف قاعدة البيانات الفعلي الحقيقي الذي يحتوي على 1,000 منتج وجداول المخزون والطلبات والورديات وسجلات التدقيق.
- **`migrations/`**:
  - `001_initial_schema.sql`: هيكل الجداول الأساسية (products, categories, inventory, orders, order_items, users, shifts, audit_logs).
  - `002_commercial_schema.js`: جداول عمليات التجزئة التجارية (stores, terminals, suppliers, purchase_orders, physical_counts).
  - `003_phase3_schema.js`: جداول المرحلة الثالثة (loyalty_accounts, loyalty_transactions, support_tickets, store_prices, coupons, delivery_slots).
- **`product-dataset/`**:
  - `super_market(1).xlsx`: ملف الإكسيل الأصلي المعتمد الذي تم استيراد الـ 1,000 منتج منه بدون أي نقص.
  - `products_normalized.json`: الكتالوج الموحد بعد التطهير والمعايرة.

## 🛠️ أوامر إدارة قاعدة البيانات (Management Commands)
```bash
# استيراد وتحديث المنتجات من الإكسيل:
npm run data:import

# التحقق من سلامة البيانات والباركودات (1000 منتج):
npm run data:validate

# فحص وإنشاء النسخ الاحتياطية الساخنة (Hot Backup):
npm run test:backup
```
