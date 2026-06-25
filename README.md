# إبرة وخيط الإسكافي — Cobblerlast

نظام متكامل لإدارة ورشة إصلاح الأحذية والحقائب الجلدية الفاخرة في الرياض.

## 🚀 البدء السريع

### المتطلبات
- Node.js 18+
- npm أو yarn

### التثبيت

```bash
npm install
```

### إعداد المتغيرات البيئية

انسخ الملف المثال وأضف قيمك:

```bash
cp .env.example .env
```

ثم عدّل `.env` بمعلوماتك:

```env
# Base44
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_FUNCTIONS_VERSION=prod
VITE_BASE44_APP_BASE_URL=https://app.base44.com

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### تشغيل التطوير

```bash
npm run dev
```

### البناء للإنتاج

```bash
npm run build
```

## 🗂️ هيكل المشروع

```
src/
├── api/           # Base44 API client
├── components/    # مكونات UI
│   ├── booking/   # مكونات الحجز
│   ├── pos/       # نظام نقاط البيع
│   └── ui/        # مكونات shadcn/ui
├── hooks/         # React hooks مخصصة
├── lib/           # مكتبات مساعدة
│   ├── AuthContext.jsx
│   ├── security.js    # أمان وحماية
│   └── supabaseClient.js
├── pages/         # صفحات التطبيق
└── utils/
```

## 🔒 الأمان

- ✅ Content Security Policy headers
- ✅ XSS Protection
- ✅ Rate limiting على العمليات الحساسة
- ✅ Input sanitization
- ✅ CSRF token generation
- ✅ Secure session handling
- ✅ No secrets in source code

## 📦 النشر

### Vercel
```bash
npm run build
vercel deploy
```

### GitHub Pages
```bash
npm run build
# Deploy /dist folder
```

## 🌐 SEO

- ✅ Meta tags محسّنة للغة العربية
- ✅ Open Graph tags
- ✅ Twitter Card
- ✅ JSON-LD Structured Data
- ✅ Sitemap XML
- ✅ Robots.txt
- ✅ Canonical URLs

## 📞 التواصل

- واتساب: +966549678191
- إنستغرام: [@ebra.kh8](https://www.instagram.com/ebra.kh8/)
