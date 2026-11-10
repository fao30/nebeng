#!/usr/bin/env bash
# Builds the Numpang React Native (CLI) project on a Mac.
#
#   bash mobile/setup.sh [target-folder] [google-maps-android-key]
#
# 1. Generates a fresh React Native CLI project (native android/ and ios/
#    folders) if the target folder doesn't exist yet.
# 2. Copies the app source (App.js, src/) from this repo into it.
# 3. Installs the libraries, sets permissions and the app name, installs pods.
# Run it again after pulling new code: steps 2–3 are safe to repeat.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
APP="${1:-$HOME/Desktop/NebengMobile}"
MAPS_KEY="${2:-${GOOGLE_MAPS_ANDROID_KEY:-}}"
RN_VERSION=0.76.9
NAME=NebengMobile

say() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }

if [ ! -d "$APP/ios" ]; then
  say "Membuat proyek React Native $RN_VERSION di $APP"
  TMP="$(mktemp -d)"
  (cd "$TMP" && npx --yes @react-native-community/cli@latest init "$NAME" --version "$RN_VERSION" --skip-git-init --install-pods false --pm npm)
  mkdir -p "$(dirname "$APP")"
  mv "$TMP/$NAME" "$APP"
fi

say "Menyalin kode aplikasi"
rm -rf "$APP/src"
cp -R "$SRC/src" "$APP/src"
cp "$SRC/App.js" "$APP/App.js"
rm -f "$APP/App.tsx"
cd "$APP"

say "Memasang library"
npm install --save --no-audit --no-fund \
  @react-navigation/native@7.0.14 \
  @react-navigation/native-stack@7.2.0 \
  @react-navigation/bottom-tabs@7.2.0 \
  react-native-screens@4.4.0 \
  react-native-safe-area-context@4.14.1 \
  @react-native-async-storage/async-storage@2.1.0 \
  react-native-svg@15.10.1 \
  react-native-maps@1.20.1 \
  react-native-image-picker@7.2.3 \
  @react-native-community/geolocation@3.4.0 \
  @react-native-community/datetimepicker@8.2.0 \
  react-native-sse@1.2.1

say "Nama aplikasi: Numpang"
node -e "const f='app.json',j=require('./'+f);j.displayName='Numpang';require('fs').writeFileSync(f,JSON.stringify(j,null,2))"

# ---------- Android ----------
say "Android: izin lokasi, nama, arsitektur lama"
MANIFEST=android/app/src/main/AndroidManifest.xml
for P in ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION; do
  grep -q "android.permission.$P" "$MANIFEST" || perl -0pi -e "s#(<uses-permission android:name=\"android.permission.INTERNET\" />)#\$1\n    <uses-permission android:name=\"android.permission.$P\" />#" "$MANIFEST"
done
if [ -n "$MAPS_KEY" ]; then
  grep -q "com.google.android.geo.API_KEY" "$MANIFEST" || perl -0pi -e "s#(\s*)<activity#\$1<meta-data android:name=\"com.google.android.geo.API_KEY\" android:value=\"$MAPS_KEY\" />\$1<activity#" "$MANIFEST"
  sed -i '' "s/export const ANDROID_MAPS = false;/export const ANDROID_MAPS = true;/" src/config.js
fi
sed -i '' "s#<string name=\"app_name\">.*</string>#<string name=\"app_name\">Numpang</string>#" android/app/src/main/res/values/strings.xml
sed -i '' "s/^newArchEnabled=.*/newArchEnabled=false/" android/gradle.properties

# ---------- iOS ----------
say "iOS: izin kamera, foto, lokasi, nama"
PLIST="ios/$NAME/Info.plist"
setp() { /usr/libexec/PlistBuddy -c "Set :$1 $2" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :$1 string $2" "$PLIST"; }
setp CFBundleDisplayName "Numpang"
setp NSCameraUsageDescription "Numpang memakai kamera untuk verifikasi wajah, foto KTP/SIM, foto mobil, dan STNK."
setp NSPhotoLibraryUsageDescription "Numpang membuka galeri untuk memilih foto KTP/SIM, mobil, atau STNK."
setp NSLocationWhenInUseUsageDescription "Numpang memakai lokasi untuk titik jemput dan berbagi posisi saat trip berlangsung."

say "iOS: CocoaPods (arsitektur lama)"
cd ios
if command -v bundle >/dev/null && bundle install >/dev/null 2>&1; then
  RCT_NEW_ARCH_ENABLED=0 bundle exec pod install
else
  RCT_NEW_ARCH_ENABLED=0 pod install
fi
cd ..

say "Selesai. Jalankan:"
echo "  cd \"$APP\""
echo "  npx react-native run-ios        # iPhone Simulator"
echo "  npx react-native run-android    # emulator/HP Android yang tersambung"
