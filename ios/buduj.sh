#!/bin/bash
# Buduje Auta na iPhone'a bez projektu Xcode (na Macu GitHub Actions, workflow .github/workflows/auta-ios.yml):
#   swiftc (kod) + actool (ikona i kolor tła) + Info.plist + strona w www + podpis ad hoc.
# Wynik: wynik/Auta.ipa (bez podpisu Apple; podpisuje go Sideloadly darmowym Apple ID)
# i budowa/iphonesimulator/Auta.app do testu na symulatorze (ios/test-symulator.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
WYNIK="$PWD/wynik"
BUD="$PWD/budowa"
rm -rf "$WYNIK" "$BUD"
mkdir -p "$WYNIK" "$BUD"
NUMER="$(date -u +%y%m%d%H%M)"
ZBUDOWANO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
test -s strona/kanal.js || { echo "Brak strona/kanal.js (robi go zbuduj-na-githubie.ps1)"; exit 1; }
xcodebuild -version | tee "$WYNIK/xcode.txt"
for PLATFORMA in iphoneos iphonesimulator; do
  APP="$BUD/$PLATFORMA/Auta.app"
  mkdir -p "$APP"
  if [ "$PLATFORMA" = iphoneos ]; then CEL="arm64-apple-ios16.0"; NAZWA="iPhoneOS"; else CEL="arm64-apple-ios16.0-simulator"; NAZWA="iPhoneSimulator"; fi
  echo "== $PLATFORMA"
  xcrun -sdk "$PLATFORMA" swiftc -target "$CEL" -O -parse-as-library -module-name Auta ios/Zrodla/*.swift -o "$APP/Auta"
  cp -R strona "$APP/www"
  # wersja.json (od 26.10.2026): SHA-256 każdego pliku strony (bez kanal.js) i chwila budowy. Aplikacja porównuje go z wersja.json wyglądu
  # z sieci (wyslij-do-sieci.ps1, folder aplikacja/), a skrót liczy się tak samo: SHA-256 linii „nazwa:sha\n” po nazwach w kolejności bajtów.
  python3 - "$APP/www" "$ZBUDOWANO" <<'PY'
import hashlib, json, os, sys
k, z = sys.argv[1], sys.argv[2]
pliki = {}
for n in sorted(os.listdir(k)):
    p = os.path.join(k, n)
    if os.path.isfile(p) and n not in ("kanal.js", "wersja.json") and not n.startswith("."):
        pliki[n] = hashlib.sha256(open(p, "rb").read()).hexdigest()
skrot = hashlib.sha256("".join("%s:%s\n" % (n, pliki[n]) for n in sorted(pliki)).encode("utf-8")).hexdigest()
json.dump({"zbudowano": z, "skrot": skrot, "minPowloka": 2, "pliki": pliki}, open(os.path.join(k, "wersja.json"), "w"), ensure_ascii=False, indent=1)
PY
  xcrun actool ios/Assets.xcassets --compile "$APP" --platform "$PLATFORMA" --minimum-deployment-target 16.0 \
    --app-icon AppIcon --output-partial-info-plist "$BUD/$PLATFORMA/ikona.plist" \
    --target-device iphone --output-format human-readable-text
  cp ios/Info.plist "$APP/Info.plist"
  /usr/libexec/PlistBuddy -c "Merge $BUD/$PLATFORMA/ikona.plist" "$APP/Info.plist"
  plutil -replace CFBundleVersion -string "$NUMER" "$APP/Info.plist"
  plutil -replace CFBundleSupportedPlatforms -json "[\"$NAZWA\"]" "$APP/Info.plist"
  plutil -replace DTPlatformName -string "$PLATFORMA" "$APP/Info.plist"
  plutil -lint "$APP/Info.plist"
  codesign --force --sign - --timestamp=none "$APP"
  ls -la "$APP" | tee "$WYNIK/zawartosc-$PLATFORMA.txt"
done
cd "$BUD/iphoneos"
mkdir -p Payload
mv Auta.app Payload/
zip -qr "$WYNIK/Auta.ipa" Payload
cd - > /dev/null
echo "Wersja $NUMER" > "$WYNIK/wersja.txt"
ls -la "$WYNIK/Auta.ipa"