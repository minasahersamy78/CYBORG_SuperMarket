# Backend Core API & Services (خادم النظام والـ REST API)

## 📌 الوصف والغرض (What this folder does)
هذا الفولدر مخصص **لمطور الباك إند (Backend Node.js Developer)**.
يمثل النواة المركزية والمصدر الموثوق (Single Source of Truth) لكافة العمليات في سوبرماركت سايبورغ.

## 🌟 الميزات المطبقة (Implemented Features)
1. **REST API متكامل**: يغطي كافة عمليات المتجر (المصادقة، المنتجات، السلة، الطلبات، المخزون، الورديات، التقارير).
2. **محرك إدارة وإلغاء الطلبات (Order Cancellation & State Machine)**:
   - مسار `POST /api/v1/orders/:id/cancel` لإلغاء الطلب واسترجاع المخزون تلقائياً وتسجيل ذلك في سجل التدقيق.
3. **خدمة البريد الإلكتروني الآلية (Unified Email Service)**:
   - إرسال فواتير الشراء تلقائياً إلى **`cyborgcoding1@gmail.com`**.
   - إرسال إشادات وملاحظات العملاء من الشات بوت إلى **`cyborgcoding1@gmail.com`** عبر مسار `POST /api/v1/chatbot/feedback`.
4. **محرك الذكاء الاصطناعي للهجة المصرية (Egyptian Arabic AI Shopping Engine)**:
   - معالجة طلبات التسوق الصوتية والنصية بالعامية المصرية وتوجيهها للمنتجات الحقيقية بدون أي هلوسة (Zero Hallucination).
5. **مخطط الميزانية والمدة (1–365 Days Duration & Budget Optimization)**:
   - مسار `POST /api/v1/recommendations/smart-basket` لبناء السلال الغذائية الذكية.
6. **محرك التجزئة والامتثال التجاري**:
   - ضريبة القيمة المضافة المصرية 14% (14% VAT)، العروض الترويجية، الكوبونات، ونقاط الولاء.

## 🏛️ البنية المعمارية (MVC Architecture)
- **`src/models/`**:
  - `product.model.js`: نموذج المنتجات والباركود والمخزون.
  - `order.model.js`: نموذج الطلبات وحالات دورة الحياة (Pending, Confirmed, Cancelled).
  - `inventory.model.js`: نموذج أرصدة المخزون والحد الأدنى للنواقص.
- **`src/controllers/`**:
  - `products.controller.js`: إدارة والبحث في الكتالوج.
  - `orders.controller.js`: إنشاء، تتبع، وإلغاء الطلبات.
  - `inventory.controller.js`: حجز وتعديل المخزون.
  - `chatbot.controller.js`: استقبال المحادثة وتوليد السلات وإرسال الإيميلات.
- **`src/views/`**:
  - `order-email.view.js`: قالب الفاتورة البريدية المنسق بـ HTML لإرساله للمدير والعميل.
- **`src/modules/`**: طبقة الخدمات وقواعد العمل (Business Services Layer).
- **`src/standalone-server.js`**: خادم الـ HTTP الرئيسي المستقل على المنفذ `3000`.

## 🚀 كيفية التشغيل (How to Run)
```bash
# تشغيل خادم الباك إند على المنفذ 3000:
node backend/src/standalone-server.js
# أو عبر npm:
npm run start:backend
```
الـ API يعمل على: `http://localhost:3000/api/v1`
وثائق الـ API متاحة على: `http://localhost:3000/api/v1/docs`
فحص الحالة: `http://localhost:3000/health`
