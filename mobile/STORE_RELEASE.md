# نشر تطبيق «إبرة وخيط» على المتاجر

معرّف التطبيق في كل المتاجر: **`com.needlecobbler.pos`** (ثابت للأبد بعد أول نشر).

كل النسخ تُبنى تلقائياً من GitHub Actions:
**Actions ← تطبيق المركز المحاسبي (Flutter) ← Run workflow ← فعّل `release`**.
النتائج تطلع في أسفل صفحة التشغيل (Artifacts)، ونسخة آيفون ترتفع مباشرة لـ TestFlight.

> كل الأسرار تُضاف من: GitHub ← المستودع ← Settings ← Secrets and variables ← Actions ← New repository secret.
> لا ترسل أي مفتاح أو كلمة سر في المحادثة.

---

## 1) Google Play (أندرويد)

1. افتح حساب مطوّر: <https://play.google.com/console> (رسوم مرة واحدة 25$).
2. أنشئ مفتاح الرفع على جهازك مرة وحدة (احفظه بمكان آمن — ضياعه يعني ما تقدر تحدّث التطبيق إلا بطلب لقوقل):
   ```
   keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
3. حوّله لنص وانسخه: `base64 -i upload-keystore.jks` (ويندوز: `certutil -encode upload-keystore.jks out.txt`).
4. أضف الأسرار:
   | الاسم | القيمة |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | ناتج الخطوة 3 |
   | `ANDROID_KEYSTORE_PASSWORD` | كلمة سر المفتاح |
   | `ANDROID_KEY_ALIAS` | `upload` |
   | `ANDROID_KEY_PASSWORD` | كلمة سر المفتاح (نفسها غالباً) |
5. شغّل النشر، نزّل `google-play-aab` وارفع `app-release.aab` في Play Console.
   أول مرة: ابدأ بمسار **Internal testing** ثم Production.

## 2) App Store (آيفون)

1. اشترك في Apple Developer Program: <https://developer.apple.com/programs/> (99$ سنوياً، باسم المؤسسة يحتاج رقم D-U-N-S).
2. في App Store Connect أنشئ تطبيق جديد بالمعرّف `com.needlecobbler.pos`.
3. أنشئ مفتاح API: App Store Connect ← Users and Access ← Integrations ← App Store Connect API ← **صلاحية Admin** ← نزّل ملف `.p8` (ينزل مرة وحدة فقط).
4. أضف الأسرار:
   | الاسم | القيمة |
   |---|---|
   | `APPLE_TEAM_ID` | من developer.apple.com ← Membership |
   | `APP_STORE_CONNECT_KEY_ID` | Key ID |
   | `APP_STORE_CONNECT_ISSUER_ID` | Issuer ID |
   | `APP_STORE_CONNECT_KEY_BASE64` | `base64 -i AuthKey_XXXX.p8` |
5. شغّل النشر — النسخة تظهر في TestFlight خلال دقائق، ومنها ترسلها للمراجعة.

## 3) Microsoft Store (ويندوز)

1. حساب مطوّر: <https://partner.microsoft.com/dashboard> (للأفراد مجاني، للشركات رسوم مرة واحدة).
2. احجز اسم التطبيق، ثم من **Product identity** انسخ:
   | الاسم | القيمة |
   |---|---|
   | `MS_STORE_IDENTITY_NAME` | Package/Identity/Name |
   | `MS_STORE_PUBLISHER` | Package/Identity/Publisher (يبدأ بـ `CN=`) |
3. شغّل النشر، نزّل `microsoft-store-msix` وارفعه في Partner Center (المتجر يوقّعه بنفسه).

---

## قبل الإرسال للمراجعة

- **حساب تجربة للمراجِع:** أبل وقوقل يطلبون طريقة دخول. أنشئ موظف تجريبي (دور «كاشير» أو «عامل») برمز PIN خاص واكتبه في خانة ملاحظات المراجعة، واحذفه بعد القبول. انتبه أنه بيشوف بيانات حقيقية.
- **سياسة الخصوصية:** `https://www.needlecobbler.com/privacy`
- **الفئة:** Business / الأعمال.
- **التطبيق داخلي للموظفين:** أبل أحياناً ترفض التطبيقات الداخلية في المتجر العام. البدائل: **Unlisted App** (رابط خاص لا يظهر بالبحث) أو **Custom App** عبر Apple Business Manager. في Google Play تقدر تنشره كـ **Private app** أو تبقيه على Closed testing.
- **لقطات الشاشة:** تُولّد تلقائياً (فعّل `screenshots`) وتطلع في فرع `ci/screenshots`.
