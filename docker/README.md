# Docker & Containerization (الدوكر والتشغيل بالحاويات)

## 📌 الوصف والغرض (What this folder does)
هذا الفولدر مخصص **لمهندس الدوكر والـ DevOps (Docker & Deployment Engineer)**.
يحتوي على كافة ملفات بناء الحاويات وتنسيق تشغيل النظام بالكامل باستخدام **Docker** و **Docker Compose**.

## 📁 محتويات الفولدر (Folder Contents)
- **`docker-compose.yml`**: ملف التنسيق الرئيسي لتشغيل بيئة الإنتاج المتكاملة:
  - خدمة الباك إند (`cyborg-backend`) على المنفذ `3000`.
  - خدمة لوحة التحكم الإدارية (`cyborg-admin-dashboard`) على المنفذ `3001`.
  - خدمة متجر العملاء الإلكتروني (`cyborg-customer-website`) على المنفذ `3002`.
- **`Dockerfile.backend`**: ملف بناء صورة خادم الباك إند Node.js وتجهيز بيئة الـ SQLite.
- **`Dockerfile.admin`**: ملف بناء صورة خادم لوحة تحكم الإدارة.
- **`Dockerfile.customer`**: ملف بناء صورة خادم متجر العملاء.

## 🚀 كيفية التشغيل (How to Run with Docker)
```bash
# تشغيل كل الخدمات في الخلفية بضغطة واحدة:
docker compose -f docker/docker-compose.yml up -d

# أو عبر أوامر npm من المجلد الرئيسي:
npm run docker:up

# إيقاف الحاويات:
npm run docker:down
```
- لوحة الإدارة تعمل على: `http://localhost:3001`
- متجر العملاء يعمل على: `http://localhost:3002`
- خادم الـ API يعمل على: `http://localhost:3000/api/v1`
