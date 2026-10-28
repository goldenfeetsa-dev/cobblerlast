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
APP_LABEL="إبرة وخيط"
# معرّف التطبيق في المتاجر — ثابت للأبد بعد أول نشر، لا تغيّره
APP_ID="com.needlecobbler.pos"

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
    /usr/bin/env python3 tool/patch_android.py "$G" "$APP_ID"
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
d['NSCameraUsageDescription'] = 'لتصوير قطع العميل وإرفاقها بالطلب'
d['NSPhotoLibraryUsageDescription'] = 'لإرفاق صور القطع من المعرض بالطلب'
d['ITSAppUsesNonExemptEncryption'] = False  # HTTPS فقط
with open(p, 'wb') as f: plistlib.dump(d, f)
PY
fi

PBX=ios/Runner.xcodeproj/project.pbxproj
if [ -f "$PBX" ]; then
  # نفس معرّف Google Play لـ App Store
  sed -i.bak -E "s/com\.needlecobbler\.cobblerAccounting/$APP_ID/g" "$PBX" && rm -f "$PBX.bak"
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
# أيقونة التطبيق وشاشة البداية بشعار المحل — أي فشل هنا يوقف البناء (ما نطلع بشعار فلاتر)
{
  echo "flutter_launcher_icons:"
  echo '  image_path: "assets/images/app-icon-1024.png"'
  [[ "$PLATFORMS" == *android* ]] && printf '  android: true\n  min_sdk_android: 23\n  adaptive_icon_background: "#F4F1EA"\n  adaptive_icon_foreground: "assets/images/app-icon-foreground.png"\n' || echo "  android: false"
  [[ "$PLATFORMS" == *ios* ]] && printf '  ios: true\n  remove_alpha_ios: true\n' || echo "  ios: false"
  [[ "$PLATFORMS" == *windows* ]] && printf '  windows:\n    generate: true\n    image_path: "assets/images/app-icon-1024.png"\n    icon_size: 256\n'
  [[ "$PLATFORMS" == *macos* ]] && printf '  macos:\n    generate: true\n    image_path: "assets/images/app-icon-1024.png"\n'
  true
} > flutter_launcher_icons.yaml
dart run flutter_launcher_icons -f flutter_launcher_icons.yaml > icons.txt 2>&1 || { tail -30 icons.txt | sed 's/^/::error::/'; exit 1; }
if [[ "$PLATFORMS" == *android* || "$PLATFORMS" == *ios* ]]; then
  {
    echo "flutter_native_splash:"
    echo '  color: "#F4F1EA"'
    echo '  image: assets/images/splash-logo.png'
    echo '  android_12:'
    echo '    color: "#F4F1EA"'
    echo '    image: assets/images/app-icon-foreground.png'
    [[ "$PLATFORMS" == *android* ]] && echo '  android: true' || echo '  android: false'
    [[ "$PLATFORMS" == *ios* ]] && echo '  ios: true' || echo '  ios: false'
    echo '  web: false'
  } > flutter_native_splash.yaml
  dart run flutter_native_splash:create --path=flutter_native_splash.yaml > splash.txt 2>&1 || { tail -30 splash.txt | sed 's/^/::error::/'; exit 1; }
fi
echo "✓ المنصات جاهزة: $PLATFORMS"
