"""يضبط android/app/build.gradle(.kts): معرّف Google Play + توقيع الإصدار.

التوقيع يُقرأ من android/key.properties — هذا الملف لا يُرفع للمستودع أبداً؛
ينشئه GitHub Actions من الأسرار وقت البناء فقط. بدونه يبقى توقيع debug (للتجربة).
آمن للتكرار.
"""
import re
import sys

path, app_id = sys.argv[1], sys.argv[2]
kts = path.endswith('.kts')
s = open(path, encoding='utf-8').read()

s = re.sub(r'applicationId\s*=?\s*"[^"]+"', f'applicationId = "{app_id}"' if kts else f'applicationId "{app_id}"', s)

if 'key.properties' not in s:
    if kts:
        s = 'import java.util.Properties\nimport java.io.FileInputStream\n\n' + s
        s = s.replace('android {', '''val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) keystoreProperties.load(FileInputStream(keystorePropertiesFile))

android {
    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }''', 1)
        s = s.replace('signingConfig = signingConfigs.getByName("debug")',
                      'signingConfig = if (keystorePropertiesFile.exists()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")')
    else:
        s = s.replace('android {', '''def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) keystoreProperties.load(new FileInputStream(keystorePropertiesFile))

android {
    signingConfigs {
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
    }''', 1)
        s = s.replace('signingConfig signingConfigs.debug',
                      'signingConfig keystorePropertiesFile.exists() ? signingConfigs.release : signingConfigs.debug')

open(path, 'w', encoding='utf-8').write(s)
print(f'✓ {path}: {app_id}')
