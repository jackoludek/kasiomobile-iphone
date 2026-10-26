#!/bin/bash
# Test Kasiomobile (dawniej Auta) na symulatorze iPhone'a 13 Pro Max (na Macu GitHub Actions), z prawdziwym ntfy.sh:
#   etap 1 (jasny motyw, świeża instalacja): ogłoszenia, szczegóły auta, katalag, kredyt, historia z galerią zdjęć, gest wstecz,
#   etap 2 (ciemny motyw, ponowne uruchomienie): czy wszystko jest od razu z pamięci telefonu.
# Kroki zgłasza strona (strona/test.js) i czeka, aż zrobimy zrzut (plik Documents/zrobione-<krok>).
# Zrzuty są zmniejszone do najwyżej 1500 px (sips).
# Werdykt: wynik/werdykt.txt, kod wyjścia 1 przy błędzie.
set -euo pipefail
cd "$(dirname "$0")/.."
WYNIK="$PWD/wynik"
APP="$PWD/budowa/iphonesimulator/Auta.app"
ID=pl.jacek.auta
UDID=$(python3 - <<'PY'
import json, subprocess
def lista(co):
    return json.loads(subprocess.check_output(["xcrun", "simctl", "list", co, "-j"]))
rt = [r for r in lista("runtimes")["runtimes"] if r.get("isAvailable") and r["identifier"].split(".")[-1].startswith("iOS")]
rt.sort(key=lambda r: [int(x) for x in r["version"].split(".")], reverse=True)
for r in rt:
    for t in r.get("supportedDeviceTypes", []):
        if t["name"] == "iPhone 13 Pro Max":
            print(subprocess.check_output(["xcrun", "simctl", "create", "Auta - iPhone 13 Pro Max", t["identifier"], r["identifier"]]).decode().strip())
            raise SystemExit
for rid, urz in sorted(lista("devices")["devices"].items(), reverse=True):
    for u in urz:
        if "iOS" in rid and "Pro Max" in u["name"] and u.get("isAvailable"):
            print(u["udid"])
            raise SystemExit
PY
)
if [ -z "$UDID" ]; then echo "Brak symulatora iPhone'a Pro Max:"; xcrun simctl list devices available; exit 1; fi
xcrun simctl list devices | grep "$UDID" | tee "$WYNIK/symulator.txt"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP"
DANE=$(xcrun simctl get_app_container "$UDID" "$ID" data)
zrzut() { xcrun simctl io "$UDID" screenshot "$WYNIK/$1.png" > /dev/null 2>&1 && sips -Z 1500 "$WYNIK/$1.png" > /dev/null; }
# Pierwszy zrzut po starcie symulatora trwa długo; robimy go na rozgrzewkę, zanim ruszy test.
xcrun simctl io "$UDID" screenshot "$PWD/budowa/rozgrzewka.png" > /dev/null 2>&1 || true
etap() {
  local N=$1 MOTYW=$2 BYLY=" "
  xcrun simctl ui "$UDID" appearance "$MOTYW"
  sleep 1
  xcrun simctl launch "$UDID" "$ID" "--test-etap$N"
  for i in $(seq 1 300); do
    for f in "$DANE/Documents/"krok-"$N"-*.json; do
      [ -f "$f" ] || continue
      local k; k=$(basename "$f" .json)
      case "$BYLY" in *" $k "*) continue ;; esac
      BYLY="$BYLY$k "
      sleep 1
      zrzut "${k#krok-}-$MOTYW"
      touch "$DANE/Documents/zrobione-$k"
    done
    [ -f "$DANE/Documents/test-etap$N.json" ] && break
    sleep 1
  done
  if [ ! -f "$DANE/Documents/test-etap$N.json" ]; then zrzut "blad-etap$N-$MOTYW"; echo "Etap $N bez wyniku po 5 minutach"; exit 1; fi
  xcrun simctl terminate "$UDID" "$ID" || true
  sleep 2
}
etap 1 light
etap 2 dark
# Wygląd z sieci (od 26.10.2026): aplikacja pobiera stronę z https://jackoludek.github.io/kasiomobile/aplikacja/, sprawdza SHA-256 każdego
# pliku i wczytuje stronę z pobranych plików (tu bez porównania z wersją z aplikacji, więc wszystko idzie z sieci).
xcrun simctl launch "$UDID" "$ID" --test-wyglad
for i in $(seq 1 120); do [ -f "$DANE/Documents/test-wyglad.json" ] && break; sleep 1; done
zrzut "wyglad-z-sieci"
xcrun simctl terminate "$UDID" "$ID" || true
cp "$DANE/Documents/test-wyglad.json" "$WYNIK/" 2>/dev/null || echo '{"blad": "brak wyniku w 120 s"}' > "$WYNIK/test-wyglad.json"
cp "$DANE/Documents/"test-etap*.json "$WYNIK/"
python3 - "$WYNIK" <<'PY'
import json, sys, os
w = sys.argv[1]
e1 = json.load(open(os.path.join(w, "test-etap1.json")))
e2 = json.load(open(os.path.join(w, "test-etap2.json")))
ew = json.load(open(os.path.join(w, "test-wyglad.json")))
o1, o2 = e1.get("odswiezenie") or {}, e2.get("odswiezenie") or {}
n1, n2 = e1.get("naStarcie") or {}, e2.get("naStarcie") or {}
slabe = ["%s %s: %s" % (m, s, k) for m, e in (("jasny", e1), ("ciemny", e2)) for s, k in (e.get("kontrast") or {}).items() if k < 4.5]
slabeIkony = ["%s %s: %s" % (m, s, k) for m, e in (("jasny", e1), ("ciemny", e2)) for s, k in (e.get("kontrastIkon") or {}).items() if k < 3]
spr = [
    ("etap 1 bez wyjątku", "blad" not in e1, e1.get("blad", "")),
    ("etap 2 bez wyjątku", "blad" not in e2, e2.get("blad", "")),
    ("strona z aplikacji (auta://app/)", str(e1.get("adres", "")).startswith("auta://app/"), e1.get("adres")),
    ("prośba o skan do komputera przy starcie", e1.get("prosba") == "wysłana",
     "skąd: %s, katalog miał %s min, komputer: %s" % (e1.get("prosbaSkad"), e1.get("katalogMinut"), e1.get("komputer"))),
    ("filtry w arkuszu na cały ekran, bez nagłówka i zakładek", e1.get("arkuszFiltrow") is True and e1.get("arkuszNaEkran") is True
     and e1.get("filtryBezNaglowka") is True and e1.get("arkuszZamkniety") is True, ""),
    ("ogłoszenia pobrane na świeżej instalacji", o1.get("katalog") == "nowy", o1.get("katalog")),
    ("kalkulator pobrany na świeżej instalacji", o1.get("kalkulator") == "nowy", o1.get("kalkulator")),
    ("historia pobrana na świeżej instalacji", o1.get("historia") == "nowy", o1.get("historia")),
    ("katalag pobrany na świeżej instalacji", o1.get("modele") == "nowy", o1.get("modele")),
    ("Katalag: karty modeli z oceną i ranking", e1.get("modele") is True and (e1.get("modeleKarty") or 0) >= 20 and (e1.get("modeleRanking") or 0) >= 20,
     "kart %s, w rankingu %s, ramka %s" % (e1.get("modeleKarty"), e1.get("modeleRanking"), e1.get("ramkaModeli"))),
    ("galeria zdjęć modelu z autorem, gest wstecz ją zamyka", e1.get("modeleGaleria") is True and e1.get("wsteczModele") is True, ""),
    ("Ogłoszenia: kafelki aut", e1.get("katalog") is True and (e1.get("katalogKafelki") or 0) > 0, "kafelków %s, ramka %s" % (e1.get("katalogKafelki"), e1.get("ramkaKatalogu"))),
    ("Ogłoszenia: „N nowe” stawia nowe auta na górze", e1.get("noweNaGorze") is True or (not e1.get("nowePigulka") and e1.get("katalog") is True),
     "pigułka: %s, słów „Nowe”: %s" % (e1.get("nowePigulka") or "brak, dziś nic nie doszło", e1.get("noweZnaczki"))),
    ("Ogłoszenia: jeden widok, karty ze zdjęciem jedna pod drugą, bez przełącznika i bez przewijania w bok",
     e1.get("przelacznikWidoku") == 0 and e1.get("kafelkiKolumn") == 1 and e1.get("kafelkiBezPoziomego") is True,
     "przycisków widoku %s, kolumn %s" % (e1.get("przelacznikWidoku"), e1.get("kafelkiKolumn"))),
    ("pasek eksportu ukryty", e1.get("pasekUkryty") is True, ""),
    ("szczegóły auta na cały ekran, bez nagłówka i zakładek", e1.get("szczegoly") is True and e1.get("szczegolyBezNaglowka") is True, ""),
    ("gest wstecz zamyka szczegóły, nagłówek i zakładki wracają", e1.get("wsteczSzczegoly") is True and e1.get("szczegolyWrocil") is True, ""),
    ("Kredyt: kalkulator w zakładce", e1.get("kalkulatorTytul") == "Kredyt na auto", "ramka %s" % e1.get("ramkaKredytu")),
    ("Historia: ogłoszenia ze zdjęciami", e1.get("historia") is True and (e1.get("historiaMiniatury") or 0) > 0,
     "miniatur %s, ramka %s" % (e1.get("historiaMiniatury"), e1.get("ramkaHistorii"))),
    ("galeria zdjęć na cały ekran, bez nagłówka i zakładek", e1.get("galeria") is True and e1.get("galeriaBezNaglowka") is True, ""),
    ("gest wstecz zamyka galerię, nagłówek i zakładki wracają", e1.get("wsteczGaleria") is True and e1.get("naglowekWrocil") is True, ""),
    ("ogłoszenia i banki idą do Safari", bool(e1.get("safari")) and all(s["otwarty"] for s in e1["safari"]) and e1.get("stronaZostala") is True,
     ", ".join("%s %s" % (s["adres"], "tak" if s["otwarty"] else "NIE") for s in e1.get("safari") or [])),
    ("zrzut przy każdym kroku", all(v < 60000 for e in (e1, e2) for v in (e.get("czekanieNaZrzut") or {"brak": 99999}).values()),
     json.dumps([e1.get("czekanieNaZrzut"), e2.get("czekanieNaZrzut")])),
    ("bez przewijania w bok", all(e.get(k) is True for e in (e1, e2) for k in ("stronaBezPoziomego", "katalogBezPoziomego", "kalkulatorBezPoziomego", "kalkulatorPelnyBezPoziomego", "historiaBezPoziomego", "modeleBezPoziomego")), ""),
    ("cele dotyku co najmniej 48 px", all("maleCele" in e and not e["maleCele"] for e in (e1, e2)),
     "; ".join((e1.get("maleCele") or []) + (e2.get("maleCele") or []))[:600]),
    ("po ponownym uruchomieniu katalog, modele, kalkulator i historia są w telefonie",
     all(n2.get(k) is True for k in ("katalog", "modele", "kalkulator", "historia")), json.dumps(n2)),
    ("drugi raz nic nie pobiera bez potrzeby", all(o2.get(k) in ("bez zmian", "nowy") for k in ("katalog", "modele", "kalkulator", "historia")), json.dumps(o2, ensure_ascii=False)),
    ("ciemny motyw to czerń", e2.get("ciemny") is True and e2.get("tlo") == "rgb(0, 0, 0)", e2.get("tlo")),
    ("ogłoszenia, katalag i historia idą za motywem", all(e1.get(k) is False and e2.get(k) is True for k in ("katalogCiemny", "modeleCiemny", "historiaCiemny")), ""),
    ("kontrast tekstu co najmniej 4,5:1", not slabe and bool(e1.get("kontrast")), "; ".join(slabe)),
    ("kontrast znaków w nagłówku co najmniej 3:1", not slabeIkony and bool(e1.get("kontrastIkon")), "; ".join(slabeIkony)),
    ("nagłówek w jednym rzędzie: logo, napis i asystent, bez godziny skanu, ściągi i Odśwież", all(e.get("naglowekJedenRzad") is True and e.get("napis") is True
     and e.get("bezOdswiez") is True and e.get("bezGodzinyISciagi") is True and (e.get("naglowekNetto") or 99) <= 64 for e in (e1, e2)),
     "wysokość bez wcięcia: %s px" % e1.get("naglowekNetto")),
    ("logo na środku między górą ekranu a pierwszą rzeczą w Ofertach", all(e.get("naglowekSrodek") is not None and abs(e["naglowekSrodek"]) <= 10 for e in (e1, e2)),
     "logo od środka: %s / %s px" % (e1.get("naglowekSrodek"), e2.get("naglowekSrodek"))),
    ("nagłówek nad krawędziami treści, Ogłoszenia bez tytułu", all(set((e.get("wyrownanie") or {}).keys()) == {"logo", "prawo", "zakladki"}
     and all(abs(v) <= 1 for v in e["wyrownanie"].values()) and e.get("tytulStrony") is False for e in (e1, e2)), str(e1.get("wyrownanie"))),
    ("nagłówek stoi przy przewijaniu", all(e.get("naglowekStoi") is True for e in (e1, e2)), ""),
    ("cztery zakładki na dole, każda z ikoną i nazwą", all(e.get("zakladkiNaDole") is True and e.get("zakladkiIkony") == 4
     and e.get("zakladki") == "katalog,modele,kredyt,poradnik" for e in (e1, e2)),
     "%s, ikon %s, wysokość paska bez wcięcia %s px" % (e1.get("zakladki"), e1.get("zakladkiIkony"), e1.get("dolNetto"))),
    ("zakładki od dolnej krawędzi tak daleko jak logo od górnej", all(isinstance(e.get("odKrawedzi"), dict) and abs(e["odKrawedzi"]["gora"] - e["odKrawedzi"]["dol"]) <= 1 for e in (e1, e2)),
     "logo od góry / zakładki od dołu: %s" % json.dumps(e1.get("odKrawedzi"))),
    ("zakładki: Alt+→, Cofnij i przeciągnięcie palcem",
     e1.get("kolejnoscPoAlt") == "modele,katalog,kredyt,poradnik" and e1.get("cofnijWidac") is True and e1.get("kolejnoscPoCofnij") == "katalog,modele,kredyt,poradnik"
     and e1.get("cofnijSchowane") is True and e1.get("kolejnoscPoPalcu") == "poradnik,katalog,modele,kredyt",
     "Alt: %s, Cofnij: %s, palec: %s" % (e1.get("kolejnoscPoAlt"), e1.get("kolejnoscPoCofnij"), e1.get("kolejnoscPoPalcu"))),
    ("kolejność zakładek zostaje po ponownym uruchomieniu", e2.get("kolejnoscNaStarcie") == "poradnik,katalog,modele,kredyt", e2.get("kolejnoscNaStarcie")),
    ("wybrana zakładka: osobny przycisk na pastelu, z pierścieniem", all(e.get("wybranaPastel") is True and e.get("zakladkiOsobno") is True for e in (e1, e2)), "tło: %s / %s" % (e1.get("wybranaKolor"), e2.get("wybranaKolor"))),
    ("napis: menu z wyszukiwaniami na Otomoto, Escape je zamyka", (e1.get("otomotoMenu") or 0) >= 1 and e1.get("otomotoMenuPodNapisem") is True and e1.get("otomotoMenuZamkniete") is True, "pozycji: %s" % e1.get("otomotoMenu")),
    # Od 25.10.2026 Poradnik to zakładka, a Atlas to pigułki „Modele” i „Wszystkie marki” w Podium; logo otwiera wyszukiwania na Otomoto.
    ("Poradnik w zakładce: cała strona, bez przewijania w bok, odnośniki w Safari", all(e.get("poradnik") is True and e.get("poradnikBezPoziomego") is True
     and e.get("poradnikNaZewnatrz") is True for e in (e1, e2)), "rozdziałów: %s" % e1.get("poradnikRozdzialy")),
    ("Atlas w Podium: z sieci w ramce, Marki bez przeładowania", all(e.get("atlas") == "gotowy" and e.get("atlasWKatalagu") is True for e in (e1, e2))
     and e1.get("atlasMarkiBezPrzeladowania") is True and not any("atlas-samochodow" in a for a in (e1.get("safariWszystkie") or [])), "Atlas: %s / %s" % (e1.get("atlas"), e2.get("atlas"))),
    ("pigułki Ofert: Alt+←, Cofnij nad nawigacją", e1.get("pigulkiPoAlt") == "historia,teraz" and e1.get("pigulkiCofnijNaWierzchu") is True and e1.get("pigulkiPoCofnij") is True,
     "Alt: %s" % e1.get("pigulkiPoAlt")),
    ("poradnik od skrótu: Czytaj całość, po ponownym uruchomieniu znowu skrót",
     e1.get("poradnikSkrot") == "strona bez skrótu" or (e1.get("poradnikSkrot") is True and e1.get("poradnikCalosc") is True and e2.get("poradnikPamieta") is False),
     "skrót: %s, całość: %s, po starcie całość: %s" % (e1.get("poradnikSkrot"), e1.get("poradnikCalosc"), e2.get("poradnikPamieta"))),
    ("wygląd z sieci: pobrany, sprawdzony SHA-256 i wczytany", ew.get("zrodlo") == "pobrana" and (ew.get("pobrane") or 0) >= 5 and ew.get("auta") == "object",
     json.dumps(ew, ensure_ascii=False)[:300]),
]
linie = ["%s %s %s" % ("ok  " if ok else "BŁĄD", nazwa, opis or "") for nazwa, ok, opis in spr]
bledy = sum(1 for _, ok, _ in spr if not ok)
linie += ["", "ekran %sx%s, wcięcia %s, pamięć %s" % (e1.get("szer"), e1.get("wys"), json.dumps(e1.get("wciecia")), e1.get("schowek")),
          "%d z %d sprawdzeń OK" % (len(spr) - bledy, len(spr))]
open(os.path.join(w, "werdykt.txt"), "w").write("\n".join(linie) + "\n")
print("\n".join(linie))
sys.exit(1 if bledy else 0)
PY