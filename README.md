# تيم النزلاوي 👑 — Team El-Nazlawy
منصة حجز وتجديد باقات الاتصالات (Angular 18 + Node/Express + MongoDB + WhatsApp Click-to-Chat يدوي).

## التشغيل السريع
```bash
# 1) Backend
cd backend && cp .env.example .env      # املأ JWT_SECRET و ADMIN_EMAIL و ADMIN_PASSWORD (10+ حروف)
npm install && npm run seed && npm run dev      # http://localhost:4000

# 2) Frontend (تطوير مع proxy للـ API)
cd frontend && npm install && npm start        # http://localhost:4200
# لوحة الإدارة: /admin/login

# 3) إنتاج بعملية واحدة
cd frontend && npx ng build
# في backend/.env: FRONTEND_DIST=../frontend/dist/frontend/browser  ثم: NODE_ENV=production npm start
```
يتطلب MongoDB 6+ و Node 18+ (المُختبر على Node 22).

## الاختبارات
`cd backend && npm test` — اختبارات API على MongoDB حقيقي، تشمل إدارة الحجوزات والتحويلات وسجل WhatsApp اليدوي.

## البنية
```
backend/src  config · models · controllers · routes · services · middleware · validators · utils
frontend/src/app  core · shared · layout · pages · admin
docs/  WHATSAPP_SETUP.md · OPEN_QUESTIONS.md
```

## دورة الحجز
`pending / payment_review → payment_confirmed → processing → activated` (أو `rejected` / `cancelled`).
- الانتقالات مقيّدة وذرّية (لا تفعيل مرتين، ولا تفعيل قبل تأكيد الدفع).
- التفعيل وتأكيد الدفع والرفض إجراءات يدوية من الأدمن فقط.
- واتساب Click-to-Chat يدوي فقط؛ لا WhatsApp API ولا رسائل آلية. فتح المحادثة لا يُسجل كإرسال إلا بعد تأكيد الأدمن يدويًا.
- سعر واسم الباقة يُحفظان داخل الحجز وقت الطلب.

## الأمان (ملخص)
bcrypt · JWT (8h) مع التحقق من الدور من قاعدة البيانات · RBAC (admin / staff) · zod validation · Helmet · CORS محدد · Rate limiting (دخول/حجز/تتبع) ·
الإيصالات تُفحص بـ magic bytes وتُحفظ بأسماء عشوائية خارج المسار العام ولا تُعرض إلا للأدمن · التتبع يتطلب رقم الطلب + الموبايل.
