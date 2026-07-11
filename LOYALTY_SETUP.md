# برنامج الولاء بالنقاط — دليل الإعداد والبنية

نظام ولاء جديد ومستقل تماماً عن نظام "بطاقات الختم" القديم (`loyalty_cards` /
`/loyalty`)، يعتمد على **رقم عضوية + نقاط + مستوى عضوية (Bronze/Silver/Gold/Platinum)**
مع بطاقات Apple Wallet و Google Wallet حقيقية.

لا يُغيّر هذا النظام أي شيء في البنية الحالية: **Vercel (Serverless Functions) +
Supabase (قاعدة بيانات + RLS) + React/Vite**. لا Firebase ولا أي قاعدة بيانات أخرى.

---

## 1) الملفات المُضافة

```
supabase/migrations/011_loyalty_membership_program.sql   ← الجداول الجديدة
api/_lib/loyalty/                                          ← منطق مشترك (Node، يعمل على Vercel)
  supabaseAdmin.js      عميل Supabase بصلاحية service_role
  memberUtils.js         توليد رقم العضوية + حساب المستوى + محتوى QR
  qrImage.js              توليد صورة QR عبر مكتبة qrcode
  applePass.js             بناء ملف .pkpass عبر passkit-generator
  googleWallet.js           تكامل Google Wallet REST API (JWT موقّع يدوياً)
  loyaltyEngine.js           المنطق المركزي: إنشاء عضو / تعديل نقاط / مزامنة المحافظ
  notify.js                   إشعارات داخل الموقع
  pass-assets/*.png             أيقونات/شعار افتراضية لبطاقة Apple (يُستحسن استبدالها بشعارك)
api/loyalty/
  create-member.js   POST   إنشاء عضوية جديدة
  lookup.js           GET    البحث برقم العضوية أو الجوال (+ السجل + الإشعارات)
  adjust-points.js     POST   إضافة/خصم نقاط (لوحة الإدارة فقط)
  apple-pass.js         GET    تنزيل بطاقة Apple Wallet (.pkpass) — تُبنى حيّة دائماً
  google-pass.js         GET    رابط "Add to Google Wallet" — يُنشئ/يحدّث البطاقة عند الطلب
  qr.js                    GET    صورة QR الخاصة بعضو كـ PNG
  notifications.js          GET/POST  قائمة الإشعارات + تعليمها كمقروءة
src/lib/loyalty/useLoyaltyMembers.js   Hook للواجهة الأمامية (يتصل بـ /api/loyalty/*)
src/pages/LoyaltyMembersAdmin.jsx      صفحة الإدارة: البحث + إضافة/خصم نقاط + السجل
src/pages/MyLoyalty.jsx                 صفحة العميل: بطاقته + QR + أزرار المحفظة + الإشعارات
```

الروابط الجديدة:
- **الإدارة (محمية):** `/loyalty-members`
- **العميل (عامة):** `/my-loyalty`

---

## 2) قاعدة البيانات

نفّذ ملف الهجرة الجديد على مشروع Supabase (عبر Supabase CLI أو لوحة SQL Editor):

```
supabase/migrations/011_loyalty_membership_program.sql
```

يُنشئ 4 جداول: `loyalty_members`, `loyalty_points_transactions`,
`loyalty_member_notifications`, `loyalty_membership_settings` — مع RLS
(القراءة عامة، والكتابة حصراً عبر `service_role` الذي تستخدمه دوال Vercel).

---

## 3) متغيرات البيئة على Vercel

أضِف هذه المتغيرات في **Vercel → Project Settings → Environment Variables**
(وليس في الواجهة الأمامية — كلها تُستخدم فقط داخل `api/`):

| المتغير | مطلوب؟ | الوصف |
|---|---|---|
| `SUPABASE_URL` | نعم | نفس رابط مشروع Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | نعم | من Supabase → Settings → API (سري تماماً) |
| `APPLE_WWDR_CERTIFICATE_BASE64` | لبطاقة Apple فقط | شهادة Apple WWDR (PEM) مُرمّزة Base64 |
| `APPLE_PASS_SIGNER_CERT_BASE64` | لبطاقة Apple فقط | شهادة Pass Type ID الخاصة بك (PEM) Base64 |
| `APPLE_PASS_SIGNER_KEY_BASE64` | لبطاقة Apple فقط | المفتاح الخاص المرافق للشهادة (PEM) Base64 |
| `APPLE_PASS_SIGNER_KEY_PASSPHRASE` | اختياري | عبارة مرور المفتاح إن وُجدت |
| `APPLE_PASS_TYPE_IDENTIFIER` | لبطاقة Apple فقط | مثال: `pass.com.needlethread.loyalty` |
| `APPLE_TEAM_IDENTIFIER` | لبطاقة Apple فقط | من حساب Apple Developer |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | لبطاقة Google فقط | محتوى ملف حساب الخدمة كاملاً كنص JSON |
| `GOOGLE_WALLET_ISSUER_ID` | لبطاقة Google فقط | من Google Pay & Wallet Console |
| `GOOGLE_WALLET_CLASS_ID` | اختياري | إن لم يُضبط يُنشأ تلقائياً بصيغة `{issuerId}.loyalty_class` |

### تحويل ملف الشهادة إلى Base64 (لأزرار Apple):
```bash
base64 -i WWDR.pem            | tr -d '\n'
base64 -i signerCert.pem      | tr -d '\n'
base64 -i signerKey.pem       | tr -d '\n'
```

> **مهم:** بدون ضبط متغيرات Apple أو Google، يبقى نظام النقاط (الإنشاء، البحث،
> الإضافة/الخصم، الإشعارات، QR) يعمل بالكامل — فقط زر "Add to Apple/Google
> Wallet" سيُظهر رسالة توضح أن الإعداد لم يكتمل بعد، دون أي كسر في الموقع.

---

## 4) كيف تعمل مزامنة النقاط مع المحافظ

- **Google Wallet:** يُحدَّث تلقائياً (PATCH) في كل عملية إضافة/خصم نقاط عبر
  `googleWallet.js` — لا حاجة لأي إجراء من العميل بعد أول إضافة للبطاقة.
- **Apple Wallet:** بطاقة `.pkpass` تُبنى *حيّة* من قاعدة البيانات في كل مرة
  يُطلب فيها تنزيلها (`GET /api/loyalty/apple-pass`)، لذلك القيمة المعروضة
  عند إعادة الفتح/التنزيل دائماً محدَّثة. الدفع التلقائي الفوري للتحديث (Push
  عبر APNs وبروتوكول Web Service الكامل لتسجيل الأجهزة) غير مُفعّل في هذه
  النسخة لأنه يتطلب خادماً إضافياً لإدارة تسجيل الأجهزة، ويمكن إضافته لاحقاً
  كخطوة منفصلة إن احتجتها.

---

## 5) الاستخدام

- **الإدارة:** الشريط الجانبي → "برنامج الولاء (النقاط)" → إنشاء عضوية جديدة
  أو البحث برقم عضوية موجود → إضافة/خصم نقاط مع سبب إلزامي يُحفظ في السجل.
- **العميل:** صفحة `/my-loyalty` → يبحث برقم عضويته أو جواله → يشاهد نقاطه
  ومستواه ورمز QR → يضيف البطاقة إلى Apple/Google Wallet → يشاهد آخر العمليات
  والإشعارات.
