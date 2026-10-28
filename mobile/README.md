# المركز المحاسبي — تطبيق Flutter

نسخة الجوال/الكمبيوتر من **المركز المحاسبي** في موقع إبرة وخيط الإسكافي.
نفس الدخول (الرمز السري)، نفس الصلاحيات، نفس الأرقام، ونفس الشكل.

## كيف يرتبط بالنظام

```
تطبيق Flutter ──► https://www.needlecobbler.com
                   ├─ /api/auth/login   دخول بالـ PIN → كوكي جلسة موقّعة (12 ساعة)
                   ├─ /api/auth/me      التحقق من الجلسة عند فتح التطبيق
                   ├─ /sb/rest/v1/rpc/accounting_report   ← نفس دالة الموقع
                   └─ /api/secure/expenses                 ← نفس جدول المصاريف
                              │
                              ▼
                   Supabase (مفتاح service_role على الخادم فقط)
```

- **لا يوجد أي مفتاح Supabase داخل التطبيق.** كل طلب يمر بنفس بوابة الموقع
  التي تتحقق من الجلسة والدور (مالك/مدير/محاسب) لكل عملية.
- **الأرقام من مصدر واحد:** دالة `accounting_report` في قاعدة البيانات
  (`supabase/migrations/053_accounting_engine.sql`)، يقرؤها الموقع والتطبيق معاً.
- **الجلسة محفوظة بأمان:** `flutter_secure_storage`
  (Android Keystore / iOS Keychain / Windows DPAPI). لا يُحفظ الـ PIN إطلاقاً.
- **انتهاء الجلسة تلقائي:** أي رد 401 يمسح الجلسة ويرجع لشاشة الدخول.

## الشاشات

| التطبيق | المقابل في الموقع |
|---|---|
| نظرة عامة | أعلى صفحة `/accounting` (المؤشرات، الأرصدة، الاتجاه) |
| القوائم | قائمة الدخل + ضريبة القيمة المضافة في `/accounting` |
| الدفتر | دفتر الحركات في `/accounting` |
| المصاريف | قسم المصاريف في `/financial-reports` |

الألوان والخطوط منقولة حرفياً من `src/pages/AccountingCenter.jsx`
(`#0B0B0C` خلفية، `#ECE8DF` نص، `#C9A84C` ذهبي، خط IBM Plex Sans Arabic، رمز الريال الرسمي).

## التشغيل محلياً

```bash
cd mobile
bash tool/bootstrap.sh          # مرة واحدة: يجهّز مجلدات Android/iOS/macOS/Windows
flutter run                     # على جهاز أو محاكي
flutter test                    # الاختبارات
```

لتجربته على نسخة معاينة من Vercel بدل الموقع الحقيقي:

```bash
flutter run --dart-define=API_BASE=https://<preview>.vercel.app
```

## البناء التلقائي

كل دفع لمجلد `mobile/` يشغّل GitHub Actions (`.github/workflows/mobile.yml`):
فحص الكود ← الاختبارات ← بناء **APK للأندرويد** و**نسخة Windows**، وتُرفع كملفات
قابلة للتنزيل من صفحة التشغيل (Artifacts). بناء iOS/macOS يدوي من زر *Run workflow*.

### قبل النشر في المتاجر
- **Google Play:** يحتاج مفتاح توقيع (keystore) خاص بالمنشأة — الـ APK الحالي
  موقّع بمفتاح التطوير ويصلح للتثبيت المباشر على أجهزة الموظفين.
- **App Store:** يحتاج حساب Apple Developer (99$ سنوياً) وجهاز Mac للتوقيع.
