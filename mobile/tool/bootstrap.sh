#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# يجهّز مجلدات المنصات (Android / iOS / macOS / Windows) ويطبّق إعداداتنا.
# يُشغَّل مرة على جهاز المطوّر، ويشغّله GitHub Actions تلقائياً قبل كل بناء.
#   cd mobile && bash tool/bootstrap.sh
# آمن للتكرار: لا يلمس lib/ ولا assets/ ولا أي ملف موجود من قبل.
# ══════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORMS="${PLATFORMS:-android,ios,macos,windows}"
APP_LABEL="المركز المحاسبي"

flutter create --project-name cobbler_accounting --org com.needlecobbler \
  --platforms="$PLATFORMS" --no-pub . >/dev/null

# القالب الافتراضي يضيف اختباراً لتطبيق «العداد» لا يخص مشروعنا
if [ -f test/widget_test.dart ] && grep -q "MyApp" test/widget_test.dart; then rm test/widget_test.dart; fi

# ── Android ──────────────────────────────────────────────────────
MANIFEST=android/app/src/main/AndroidManifest.xml
if [ -f "$MANIFEST" ]; then
  # إذن الإنترنت غير موجود افتراضياً في نسخة الإصدار (release)
  grep -q 'android.permission.INTERNET' "$MANIFEST" || \
    sed -i.bak 's#<application#<uses-permission android:name="android.permission.INTERNET"/>\n    <application#' "$MANIFEST"
  # اسم التطبيق + منع النسخ الاحتياطي السحابي للتخزين المشفّر (يتلف عند الاستعادة لجهاز آخر)
  sed -i.bak "s#android:label=\"[^\"]*\"#android:label=\"$APP_LABEL\"#" "$MANIFEST"
  grep -q 'android:allowBackup' "$MANIFEST" || \
    sed -i.bak 's#<application#<application\n        android:allowBackup="false"\n        android:fullBackupContent="false"#' "$MANIFEST"
  rm -f "$MANIFEST.bak"
fi
for G in android/app/build.gradle.kts android/app/build.gradle; do
  if [ -f "$G" ]; then
    # EncryptedSharedPreferences تتطلب Android 6.0 (API 23) فأعلى
    sed -i.bak -E 's/minSdk( =|) *flutter\.minSdkVersion/minSdk\1 23/; s/minSdkVersion +flutter\.minSdkVersion/minSdkVersion 23/' "$G"
    rm -f "$G.bak"
  fi
done

# ── iOS ──────────────────────────────────────────────────────────
PLIST=ios/Runner/Info.plist
if [ -f "$PLIST" ]; then
  /usr/bin/env python3 - "$PLIST" "$APP_LABEL" <<'PY'
import plistlib, sys
p, label = sys.argv[1], sys.argv[2]
with open(p, 'rb') as f: d = plistlib.load(f)
d['CFBundleDisplayName'] = label
d['CFBundleDevelopmentRegion'] = 'ar'
with open(p, 'wb') as f: plistlib.dump(d, f)
PY
fi

# ── macOS: اتصال بالشبكة + سلسلة المفاتيح ────────────────────────
for E in macos/Runner/DebugProfile.entitlements macos/Runner/Release.entitlements; do
  if [ -f "$E" ]; then
    /usr/bin/env python3 - "$E" <<'PY'
import plistlib, sys
p = sys.argv[1]
with open(p, 'rb') as f: d = plistlib.load(f)
d['com.apple.security.network.client'] = True
d['keychain-access-groups'] = []
with open(p, 'wb') as f: plistlib.dump(d, f)
PY
  fi
done

flutter pub get
dart run flutter_launcher_icons >/dev/null || echo "⚠️ تعذّر توليد الأيقونات — يكمل البناء بالأيقونة الافتراضية"
echo "✓ المنصات جاهزة: $PLATFORMS"
