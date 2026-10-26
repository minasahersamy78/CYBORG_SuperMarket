# Customer Website Storefront (المتجر الإلكتروني للعملاء)

## 📌 الوصف والغرض (What this folder does)
هذا الفولدر مخصص **للموقع الإلكتروني للمتجر (Customer E-Commerce Web Storefront)**.
يتيح لعملاء السوبرماركت التسوق عبر الإنترنت، البحث في الكتالوج (1000 منتج)، التحدث مع المساعد الصوتي الذكي ثلاثي الأبعاد، وتخطيط المشتريات والميزانية لمدة 1 إلى 365 يوماً.

## ⚙️ التقنيات المستخدمة (Technologies)
- **Node.js** (Server & API Routing)
- **HTML5 / CSS3 / JavaScript** (Vanilla, High-Performance, Zero Heavy Dependencies)
- **Three.js** (3D Holographic WebGL Voice Orb)
- **Web Speech API** (التعرف على الصوت باللهجة المصرية)
- **Bilingual & Dual Theme** (عربي / English - Dark Mode / Light Mode)

## 🏛️ البنية المعمارية (MVC Architecture)
- **`src/models/`**: نماذج السلة والمنتجات والطلبات (`cart.model.js`).
- **`src/controllers/`**: معالجة الطلبات، الكتالوج، وإرسال الملاحظات (`storefront.controller.js`).
- **`src/views/`**: القوالب وواجهات المستخدم ومحددات الثيمات الفاتحة والداكنة (`theme.view.js`).
- **`server.js`**: نقطة انطلاق السيرفر الرئيسي للموقع على المنفذ `3002`.

## 🚀 كيفية التشغيل (How to Run)
```bash
# تشغيل موقع العملاء على المنفذ 3002:
node customer-website/server.js
# أو عبر npm:
npm run start:web
```
الموقع يفتح على: `http://localhost:3002`
- إيميل الملاحظات والفواتير: **`cyborgcoding1@gmail.com`**.
