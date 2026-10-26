# Supermarket Admin Dashboard (لوحة تحكم الإدارة والعمليات)

## 📌 الوصف والغرض (What this folder does)
هذا الفولدر مخصص **للوحة تحكم الإدارة والمشرفين (Supermarket Operations & Admin Dashboard)**.
يستخدمه مدير الفرع والمحاسبون لمتابعة العمليات اليومية لحظة بلحظة:
1. إحصائيات المبيعات والأرباح الحية وإجمالي المعاملات عبر نقاط البيع والموقع.
2. إدارة الطلبات مع إمكانية **إلغاء الطلب (Order Cancellation)** واسترجاع الكميات تلقائياً للمخزون.
3. مراقبة مستويات المخزون وتنبيهات النواقص (Low Stock Alerts).
4. مطابقة ورديات الكاشير (Shifts Reconciliation) وكشف العجز النقدي.
5. سجل الأمان والتدقيق وسجلات طلبات الذكاء الاصطناعي (AI Voice Orders Audit).

## ⚙️ التقنيات المستخدمة (Technologies)
- **Node.js** (Server & Services Integration)
- **HTML5 / CSS3 / JavaScript** (Cyber-Clean Emerald Responsive UI)
- **Bilingual & Dual Theme** (عربي / English - Dark Mode / Light Mode)

## 🏛️ البنية المعمارية (MVC Architecture)
- **`src/models/`**: نماذج التقارير، الورديات، والطلبات (`admin-report.model.js`).
- **`src/controllers/`**: معالجة إلغاء الطلبات وإدارة العمليات (`admin-orders.controller.js`).
- **`src/views/`**: مكونات عرض الجداول والرسوم البيانية والثيمات.
- **`server.js`**: خادم لوحة التحكم الإدارية على المنفذ `3001`.

## 🚀 كيفية التشغيل (How to Run)
```bash
# تشغيل لوحة التحكم على المنفذ 3001:
node admin-dashboard/server.js
# أو عبر npm:
npm run start:admin
```
لوحة التحكم تفتح على: `http://localhost:3001`
- إيميل الإدارة المعتمد: **`cyborgcoding1@gmail.com`**.
