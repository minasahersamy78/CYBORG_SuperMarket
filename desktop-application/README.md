# Desktop Application — Flutter POS (تطبيق الكاشير ونقاط البيع)

## 📌 الوصف والغرض (What this folder does)
هذا الفولدر مخصص **لمطور نقاط البيع والكاشير (Flutter Desktop POS Developer)**.
يحتوي على تطبيق نقاط البيع المكتوب بفريمورك **Flutter Desktop** والمجهز للعمل على أنظمة **Linux (Ubuntu/Debian)** و **Windows**.

## 🌟 الميزات المطبقة (Implemented Features)
1. **قراءة الباركود السريع (Barcode Scanner)**: معالجة وقراءة باركودات المنتجات (Code-128 / EAN-13) بسرعة استجابة فائقة.
2. **محرك الطابعات الحرارية (ESC/POS Thermal Receipts)**: طباعة فواتير الشراء تلقائياً وتفعيل أمر قص الورق (`GS V 0`).
3. **فتح درج النقدية التلقائي (Cash Drawer Pulse)**: إرسال نبضة لفتح الدرج عند عمليات الدفع النقدي.
4. **المزامنة دون اتصال (Offline-First Outbox Sync)**: العمل في حالة انقطاع الإنترنت وتخزين المعاملات في قاعدة بيانات محلية SQLite، ثم مزامنتها تلقائياً مع السيرفر الرئيسي مع منع التكرار (Idempotency).
5. **إدارة ورديات الكاشير (Shifts Management)**: فتح الوردية، تسجيل المقبوضات النقدية والإلكترونية، ومطابقة النقدية مع كشف أي عجز (Discrepancy).
6. **بطاقات المنتجات والأسعار (features/data-1 format)**: عرض صورة المنتج، الباركود، والأسعار الخضراء الزمردية (`#22C55E`).

## 🏛️ البنية المعمارية (MVC Architecture)
- **`lib/features/checkout/domain/`**: النماذج (Models) - سلة الكاشير وعناصر الفاتورة.
- **`lib/features/checkout/presentation/`**: الواجهات (Views) - شاشة المسح الضوئي والدفع وإصدار الفواتير.
- **`lib/features/checkout/data/`**: المتحكمات (Controllers) - معالجة عمليات البيع والمزامنة.
- **`lib/core/hardware/`**: محاكيات ومتحكمات الأجهزة (الماسح الضوئي، الطابعة الحرارية، درج النقدية).
- **`lib/core/sync/`**: محرك حل التعارضات ومزامنة الأوفلاين.

## 🚀 كيفية التشغيل (How to Run)
```bash
# الدخول إلى فولدر تطبيق الكاشير:
cd desktop-application

# تثبيت الحزم:
flutter pub get

# تشغيل التطبيق على Linux:
flutter run -d linux

# تشغيل التطبيق على Windows:
flutter run -d windows
```
