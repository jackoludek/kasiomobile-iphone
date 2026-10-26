// Kasiomobile na iPhone'a i w przeglądarce (do 18.10.2026 „Auta”): ten sam ekran co aplikacja na Androidzie.
// Od 19.10.2026 cztery zakładki na dole, każda z kolorową ikoną (Jacek: „brakuje nam … kolorków na tych menu … oczywiste
// i eleganckie, typu Apple Store”), a nagłówek to jeden rząd: logo, napis i asystent. Od 25.10.2026 zakładka może mieć
// jeden rząd pigułek, w nawigacji pod zakładkami:
//   „Ogłoszenia” – pigułka Teraz: katalog misji ze Skanera Produktów; auto dodane na Otomoto dziś albo wczoraj ma słowo „Nowe”
//                  (do 19.10.2026 osobne zakładki „Nowe” i „Katalag”), plik z cichego kanału „<kanał>-katalog”. Pigułka Historia:
//                  historia ogłoszeń ze zdjęciami, kanał „<kanał>-historia” (do 24.10.2026 osobna zakładka).
//   „Katalag”    – pigułka Podium Otomoto: katalog modeli aut z oceną bezpieczeństwa i niezawodności, kanał „<kanał>-modele”. Pigułki
//                  Modele Otomoto i Wszystkie marki: Atlas wszystkich aut ze strony w sieci (jackoludek.github.io/atlas-samochodow),
//                  do 24.10.2026 pod logo.
//   „Finanse”    – pigułki Leasing i Kredyt nad jednym kalkulatorem z cichego kanału „<kanał>-kalkulator”, każda ze swoim skrótem
//                  i swoją całością (do 25.10.2026 zakładka „Kredyt”; Jacek: „Finanse powinny być pierw leasing … a drugi kredyt”).
//   Nawigacja    – na telefonie zakładki i pigułki wybranej zakładki to jeden blok ze szkła nad treścią (Jacek, 25.10.2026 wieczorem:
//                  „Podoba mi się layout 3”, „żebyśmy nie dzielili nawigacji na dwa góra i dół”), pigułki pod zakładkami (Jacek wybrał
//                  to z dwóch wersji 25.10.2026 wieczorem). Blok przytrzymany 2 s przesuwa się palcem wyżej i zostaje tam, gdzie go puścić.
//                  Na szerokim ekranie zakładki i pigułki stoją u góry i się nie przenoszą.
//   „Poradnik”   – cały poradnik o używanych autach, kanał „<kanał>-poradnik” (od 22 do 24.10.2026 pod logo).
//   Dane w tle   – przycisku Odśwież ani godziny skanu nie ma (od 24.10.2026, Jacek: „no refresh button anywhere … I trust you
//                  and the process”, a wieczorem: „nie potrzebujemy wiedzieć, kiedy został update'owany”): przy każdym otwarciu
//                  prośba o skan idzie sama, gdy katalog ma ponad 10 minut (kanał „<kanał>-skanuj”, słucha go skan-na-zadanie.ps1),
//                  otwarta aplikacja co minutę bierze nowy katalog, a po powrocie internetu pobiera wszystko. Ściągi „i” też nie ma
//                  (Jacek: „napisać tę aplikację tak prosto, że nie będzie potrzeba ściągi”).
//   Siatka       – nagłówek i strony w zakładkach mają te same marginesy i kolumny co Ogłoszenia (styl.css, „Siatka aplikacji”).
//   Logo i napis – jedno menu z wyszukiwaniem Otomoto „Pomorskie, każda marka” (napis od 22.10.2026, logo od 25.10.2026).
//   Przestawianie – zakładki i pigułki palcem, myszą i Alt+← →, z „Cofnij”, Ctrl+Z i Ctrl+Y.
// ntfy.sh trzyma wiadomości 12 godzin, a pliki 3 godziny, więc wszystko zostaje w telefonie (localStorage i IndexedDB) i działa
// też bez internetu. Nazwę kanału podaje kanal.js (window.KANAL), a w wersji z internetu adres strony (?k=…), zapamiętany potem.
'use strict';
(() => {
  const SERWER = 'https://ntfy.sh';
  const $ = (s) => document.querySelector(s);

  function el(tag, atr, ...dzieci) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(atr || {})) {
      if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
    }
    e.append(...dzieci);
    return e;
  }

  // ---------------------------------------------------------------- pamięć w telefonie
  const pamiec = {
    czytaj(k, domyslnie) {
      try { const v = localStorage.getItem('auta-' + k); return v === null ? domyslnie : JSON.parse(v); } catch { return domyslnie; }
    },
    zapisz(k, v) {
      try { localStorage.setItem('auta-' + k, JSON.stringify(v)); } catch { /* pełna pamięć: zostaje poprzednia wartość */ }
    },
    usun(k) {
      try { localStorage.removeItem('auta-' + k); } catch { /* bez pamięci */ }
    },
  };
  // Skąd pyta ta strona: komputer pisze to w dzienniku skanu i asystenta. Android ładuje ją spod adresu z plików aplikacji.
  const SKAD = location.protocol === 'auta:' ? 'iPhone' : location.hostname === 'appassets.androidplatform.net' ? 'Android' : 'przeglądarka';
  const DOBRY_KANAL = /^[a-z0-9-]{16,64}$/;
  const KANAL = (() => {
    if (DOBRY_KANAL.test(String(window.KANAL || ''))) return String(window.KANAL);
    const zAdresu = new URLSearchParams(location.search).get('k') || '';
    if (DOBRY_KANAL.test(zAdresu)) { pamiec.zapisz('kanal', zAdresu); return zAdresu; }
    const z = String(pamiec.czytaj('kanal', '') || '');
    return DOBRY_KANAL.test(z) ? z : '';
  })();

  // Duże pliki (katalog, kalkulator, historia, modele) leżą w IndexedDB; gdy jej nie ma, w localStorage.
  const schowek = (() => {
    let baza = null;
    const otworz = () => baza || (baza = new Promise((ok, zle) => {
      const r = indexedDB.open('auta', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('pliki');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => zle(r.error);
    }));
    const zadanie = async (tryb, f) => {
      const db = await otworz();
      return new Promise((ok, zle) => {
        const t = db.transaction('pliki', tryb);
        const r = f(t.objectStore('pliki'));
        t.oncomplete = () => ok(r.result);
        t.onerror = () => zle(t.error);
        t.onabort = () => zle(t.error);
      });
    };
    const s = {
      rodzaj: 'IndexedDB',
      async czytaj(n) {
        if (s.rodzaj === 'IndexedDB') {
          try { return (await zadanie('readonly', (o) => o.get(n))) ?? null; } catch { s.rodzaj = 'localStorage'; }
        }
        return pamiec.czytaj('plik-' + n, null);
      },
      async zapisz(n, tekst) {
        if (s.rodzaj === 'IndexedDB') {
          try { await zadanie('readwrite', (o) => o.put(tekst, n)); return; } catch { s.rodzaj = 'localStorage'; }
        }
        pamiec.zapisz('plik-' + n, tekst);
      },
    };
    return s;
  })();


  // ---------------------------------------------------------------- kanały ntfy.sh
  async function wiadomosci(kanal, od) {
    const przerwij = new AbortController();
    const zegar = setTimeout(() => przerwij.abort(), 20000);
    try {
      const r = await fetch(`${SERWER}/${kanal}/json?poll=1&since=${encodeURIComponent(od)}`, { cache: 'no-store', signal: przerwij.signal });
      if (!r.ok) throw new Error('ntfy.sh odpowiedział ' + r.status);
      return (await r.text()).split('\n').filter((l) => l.trim())
        .map((l) => JSON.parse(l)).filter((o) => o.event === 'message');
    } finally {
      clearTimeout(zegar);
    }
  }

  // Plik z cichego kanału danych: bierzemy najnowszy i trzymamy go w telefonie.
  function plik(nazwa) {
    const zapomnij = () => { pamiec.usun(nazwa + '-czas'); pamiec.usun(nazwa + '-od'); };
    const p = {
      czas: () => pamiec.czytaj(nazwa + '-czas', 0),
      async tresc() {
        const t = await schowek.czytaj(nazwa);
        if (!t && p.czas()) zapomnij(); // system wyczyścił pamięć strony: pobierzemy plik od nowa
        return t;
      },
      async sprawdz() {
        if (p.czas()) await p.tresc();
        const w = await wiadomosci(`${KANAL}-${nazwa}`, pamiec.czytaj(nazwa + '-od', 'all'));
        if (!w.length) return false;
        const ostatni = w[w.length - 1].id;
        const z = w.filter((o) => o.attachment && o.attachment.url).pop();
        if (!z || z.time <= p.czas()) { pamiec.zapisz(nazwa + '-od', ostatni); return false; }
        const r = await fetch(z.attachment.url, { cache: 'no-store' });
        // Plik wygasł na serwerze (3 godziny). Komputer przyśle następny.
        if (r.status === 404) { pamiec.zapisz(nazwa + '-od', ostatni); return false; }
        if (!r.ok) throw new Error('ntfy.sh odpowiedział ' + r.status);
        const tekst = await r.text();
        if (!tekst.trim()) throw new Error('pusty plik ' + nazwa);
        await schowek.zapisz(nazwa, tekst);
        pamiec.zapisz(nazwa + '-czas', z.time);
        pamiec.zapisz(nazwa + '-od', ostatni);
        return true;
      },
    };
    return p;
  }
  const KATALOG = plik('katalog');
  const KALKULATOR = plik('kalkulator');
  const HISTORIA = plik('historia');
  const MODELE = plik('modele');
  // Cały poradnik pod logo (od 22.10.2026): robi go poradnik.js w misji z pliku taba „Poradnik Używanych Aut”.
  const PORADNIK = plik('poradnik');

  // ---------------------------------------------------------------- strona z komputera w ramce
  // Adres blob: ma to samo pochodzenie co aplikacja, więc katalog pamięta filtry, a odnośniki
  // do ogłoszeń i banków otwiera Safari (Aplikacja.swift). Gdy blob: nie zadziała, idzie srcdoc.
  function zaladowana(r, ms) {
    return new Promise((ok) => {
      const koniec = setTimeout(() => ok(false), ms);
      r.addEventListener('load', () => {
        clearTimeout(koniec);
        let d = null;
        try { d = r.contentDocument; } catch { /* obce pochodzenie */ }
        ok(Boolean(d && d.body && d.body.childElementCount));
      }, { once: true });
    });
  }
  function ramka(r, pusty, poprawka) {
    let wczytany = -1, adres = null, kolejka = Promise.resolve(true);
    const o = { sposob: '' };
    o.pokaz = (p, tekstPusty) => (kolejka = kolejka.then(async () => {
      const czas = p.czas();
      if (czas && czas === wczytany) return true;
      const html = czas ? await p.tresc() : null;
      if (!html) {
        const tekst = tekstPusty();
        r.hidden = true;
        pusty.hidden = false;
        pusty.querySelector('.pusto-tekst').textContent = tekst;
        wczytany = -1;
        return false;
      }
      // Nowy plik przyszedł (po nowym skanie), a w starym jest otwarte okno: szczegóły auta, filtry albo galeria.
      // Nie zamykamy go pod palcem, tylko próbujemy co 3 sekundy, aż się zamknie. Przewinięcie zostaje.
      let y = 0;
      if (wczytany !== -1 && !r.hidden) {
        try {
          const d = r.contentDocument;
          if (d && d.querySelector('dialog[open]')) {
            clearTimeout(o.ponow);
            o.ponow = setTimeout(() => o.pokaz(p, tekstPusty), 3000);
            return true;
          }
          y = (r.contentWindow && r.contentWindow.scrollY) || 0;
        } catch { /* obce pochodzenie: wczytujemy od razu */ }
      }
      const przewin = () => { if (y) setTimeout(() => { try { r.contentWindow.scrollTo(0, y); } catch { /* nic */ } }, 300); };
      wczytany = czas;
      pusty.hidden = true;
      r.hidden = false;
      const tresc = poprawka ? poprawka(html) : html;
      const stary = adres;
      adres = URL.createObjectURL(new Blob([tresc], { type: 'text/html;charset=utf-8' }));
      r.removeAttribute('srcdoc');
      const czeka = zaladowana(r, 8000);
      r.src = adres;
      if (stary) setTimeout(() => URL.revokeObjectURL(stary), 10000);
      if (await czeka) { o.sposob = 'blob'; przewin(); return true; }
      const czeka2 = zaladowana(r, 8000);
      r.srcdoc = tresc;
      o.sposob = (await czeka2) ? 'srcdoc' : 'nie wczytał się';
      przewin();
      return true;
    }));
    return o;
  }

  // Siatka (od 24.10.2026): strona w zakładce dostaje marginesy i szerokość nagłówka (styl.css, „Siatka aplikacji”), bez tytułu
  // (nazwę mówi zakładka; Jacek: „respect real estate … no samochód rodzinny”) bez własnego „i”, które stoi teraz w nagłówku, i bez paska „iScanner · Eksport z …”.
  // Ogłoszenia: siatka katalogu Skanera (312 px filtrów) zostaje, a przerwę zwężamy z 26 do 24 px, bo odstępy idą ze skali 4 i 8 px
  // (wytyczne Jacka: 24 px między grupami). Filtry przyklejają się na wysokości marginesu.
  // Katalag i Historia: od 1100 px data, Skrót i Pełny oraz zdanie wstępu stoją w kolumnie pod logo, a reszta w kolumnie pod
  // zakładkami, jak filtry i auta w Ogłoszeniach. Wcięcia ekranu (iPhone w poziomie) wpisuje do ramek ustawSiatke niżej.
  // <siatka> Ten kawałek, aż do </siatka>, wkleja też Komputer\zbuduj-auta.js do okna na komputerze: siatkę zmieniasz tylko tutaj.
  const BOK = 'clamp(16px,3vw,28px)', L = `var(--km-lewo,${BOK})`, P = `var(--km-prawo,${BOK})`;
  const KONTENER = `box-sizing:border-box!important;width:100%!important;max-width:calc(1624px + ${L} + ${P})!important;margin-left:auto!important;margin-right:auto!important;padding-left:${L}!important;padding-right:${P}!important`;
  const GAZETA = `main{${KONTENER};position:relative}main>header.hero h1{display:none!important}main p,main section>ul>li,main .card li{max-width:72ch}`
    + `@media (width>1100px){main{padding-left:calc(${L} + 336px)!important}main>header.hero{position:absolute;left:${L};top:0;width:312px;margin:0}`
    + 'main>header.hero{padding-top:0!important}main>header.hero>:first-child{margin-top:0!important}main>header.hero .pigulki-widoku{flex-wrap:wrap}}';
  // Przycisk całości na końcu skrótu (od 25.10.2026 wieczorem, Jacek o „Cały kalkulator”: „Buton, który nie wygląda jak buton w ogóle …
  // wygląda jak jakiś napis na niebieskim tle … It's wrong”): w Podium, Historii i Finansach ten sam wypełniony przycisk co „Czytaj całość”
  // w Poradniku: 48 px, akcent, głębia i strzałka w dół. Napis biały w jasnym (4,7:1), czarny w ciemnym (7,0:1). W Finansach widać go
  // na każdej szerokości, bo rzędu „Skrót | Pełny widok” w aplikacji nie ma (kalkulator chował go od 721 px).
  const STRZALKA_W_DOL = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 5.75 8 10.25l4.5-4.5' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
  // Przyciski jak przyciski (od 26.10.2026; Jacek: „wybraliśmy … czwarte … takie mają być wszędzie. Koniec. Kropka”, „Słońce świecące
  // … z lewego górnego narożnika … pod 45 stopni … I takie drop shadow … szkło z iOS 26, reaktywność … Butony to są butony”): wariant 4
  // „Szkło z iOS 26” ze strony „Przyciski jak przyciski - propozycje” (projekt 15) w każdej stronie w zakładkach, oświetlony z lewego
  // górnego rogu pod 45°: blask i jasny brzeg z lewej u góry, ciemniejszy brzeg z prawej u dołu i cień rzucony w prawo w dół, w trzech
  // warstwach. Wciśnięty rośnie o 3% i rozświetla się od miejsca dotyku (--mx i --my wpisuje swiatloPrzyciskow), puszczony wraca
  // sprężyście. W ciemnym cienia na czerni nie widać, więc zostają jasny brzeg i włosek. Te same liczby ma powłoka (--g3d i --c3d
  // w styl.css, --cz-lico i --cz-c3d w czat.css, krawedz i lico w Komputer\zbuduj-auta.js). Napis #1d1d1f (w ciemnym biały) ma na szkle
  // od 12:1, a barwa wypełnionego przycisku zostaje ze strony. Wcześniej (od 26.10.2026 rano) szkło miały tylko „Porównaj te trzy”,
  // przyciski całości i „Czytaj całość”, a na bieli wyglądały jak napis (Jacek: „tu są miejsca, w których nie wiadomo, że to są ikonki”).
  const SW = {
    lico: 'linear-gradient(135deg,rgba(255,255,255,.8),rgba(255,255,255,0) 46%,rgba(0,0,0,.045))',
    licoB: 'linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,0) 34%,rgba(0,0,0,.1))',
    licoC: 'linear-gradient(135deg,rgba(255,255,255,.17),rgba(255,255,255,0) 50%)',
    brzeg: 'inset 1px 1px 0 rgba(255,255,255,.95),inset -1px -1px 0 rgba(0,0,0,.07),0 0 0 .5px rgba(0,0,0,.16)',
    brzegB: 'inset 1px 1px 0 rgba(255,255,255,.38),inset -1px -1px 0 rgba(0,0,0,.2)',
    brzegC: 'inset 1px 1px 0 rgba(255,255,255,.24),inset -1px -1px 0 rgba(0,0,0,.45),0 0 0 .5px rgba(255,255,255,.2)',
    cien: '1px 1px 2px rgba(0,0,0,.12),3px 3px 8px rgba(0,0,0,.1),6px 6px 18px rgba(0,0,0,.06)',
    cienC: '2px 2px 8px rgba(0,0,0,.6)',
    plama: 'radial-gradient(circle 80px at var(--mx,50%) var(--my,50%),rgba(255,255,255,.5),rgba(255,255,255,0) 75%)',
    plamaC: 'radial-gradient(circle 80px at var(--mx,50%) var(--my,50%),rgba(255,255,255,.22),rgba(255,255,255,0) 75%)',
    ruch: 'transition:transform .32s cubic-bezier(.3,1.7,.5,1),background-color .2s ease,box-shadow .2s ease!important',
    wcisk: 'transform:scale(1.03)!important;transition:transform .08s ease!important',
  };
  // Szklany przycisk (jeden selektor): tlo i tloC to szkło w jasnym i w ciemnym, domyślnie bezbarwne. obraz: false zostawia stronie
  // jej obraz tła (strzałka listy wyboru), a światło niesie wtedy sam brzeg z cieniem.
  const GUZIK = (s, { tlo = 'rgba(255,255,255,.62)', tloC = 'rgba(44,44,46,.6)', obraz = true } = {}) => {
    const lico = obraz ? `background-image:${SW.lico}!important;background-size:100% 100%!important;background-repeat:no-repeat!important;` : '';
    return `${s}{background-color:${tlo}!important;${lico}-webkit-backdrop-filter:blur(14px) saturate(1.8);backdrop-filter:blur(14px) saturate(1.8);`
      + `border-color:transparent!important;box-shadow:${SW.brzeg},${SW.cien}!important;${SW.ruch}}`
      + `${s}:active{${SW.wcisk}${obraz ? `;background-image:${SW.plama},${SW.lico}!important` : ''}}`
      + `@media (prefers-color-scheme:dark){${s}{background-color:${tloC}!important;${obraz ? `background-image:${SW.licoC}!important;` : ''}box-shadow:${SW.brzegC},${SW.cienC}!important}`
      + (obraz ? `${s}:active{background-image:${SW.plamaC},${SW.licoC}!important}` : '') + '}';
  };
  // Wypełniony przycisk (wybrany albo główny, jeden selektor): barwa zostaje ze strony, dochodzą blask, brzeg i cień w tej barwie.
  const GUZIK_PELNY = (s, barwa) => `${s}{background-image:${SW.licoB}!important;background-size:100% 100%!important;background-repeat:no-repeat!important;animation:none!important;`
    + `box-shadow:${SW.brzegB},1px 1px 2px rgba(0,0,0,.16),3px 3px 10px color-mix(in srgb,${barwa} 42%,transparent)!important;${SW.ruch}}`
    + `${s}:active{${SW.wcisk}}@media (prefers-color-scheme:dark){${s}{box-shadow:${SW.brzegB},0 0 0 .5px rgba(255,255,255,.2)!important}}`;
  // „Porównaj te trzy”, przyciski całości i „Czytaj całość”: szkło z napisem w kolorze tekstu.
  const SZKLANY = (s) => GUZIK(s) + `${s}{color:#1d1d1f!important;border:0!important}@media (prefers-color-scheme:dark){${s}{color:#ffffff!important}}`;
  // Miejsce dotyku dla rozświetlenia wciśniętego przycisku w stronie w ramce (GUZIK): --mx i --my na przycisku, raz na dokument.
  const swiatloPrzyciskow = (d) => {
    if (!d || d.kmSwiatlo) return;
    d.kmSwiatlo = true;
    d.addEventListener('pointerdown', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('button, .przycisk, select, summary') : null;
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
      b.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
    }, { capture: true, passive: true });
  };
  const CALOSC = (s) => `${s}{display:inline-flex!important;align-items:center;gap:8px;height:48px!important;min-height:48px;margin-top:24px!important;padding:0 21px 0 24px!important;`
    + 'border-radius:24px!important;font:inherit;font-size:17px!important;font-weight:600!important;line-height:1!important;cursor:pointer;-webkit-tap-highlight-color:transparent}'
    + `${s}::after{content:"";flex:none;width:16px;height:16px;background:currentColor;-webkit-mask:${STRZALKA_W_DOL} center/16px no-repeat;mask:${STRZALKA_W_DOL} center/16px no-repeat}`
    + SZKLANY(s)
    // Na telefonie przycisk ma całą szerokość treści, czyli 12 kolumn siatki (reguła siatka-wszedzie), napis na środku.
    + `@media (max-width:759px){${s}{box-sizing:border-box!important;width:100%!important;justify-content:center}}`;
  // Pierścień wybranej pigułki w stronach (pigulki-widoku.css w misji) rysowany do środka, jak w nawigacji: brzeg pigułki stoi na linii
  // siatki, a nie 4 px przed nią (Jacek, 25.10.2026: „nie jest to wszystko według kratek, a powinno być poukładane według kratek”).
  // Od 26.10.2026 pigułki w stronach mają też szkło z 45° światłem (GUZIK), a wybrana pastel swojej zakładki z tym samym blaskiem
  // i cieniem; smuga przy wyborze w stronach zniknęła (Jacek: „ograniczyć albo wyeliminować połyskiwania do minimum”).
  const WYBRANA_PIG = '.pigulki-widoku button:is([aria-pressed="true"],[aria-checked="true"]):not(.ciagniety)';
  const PIERSCIEN = `${WYBRANA_PIG}{background-image:${SW.lico}!important;background-size:100% 100%!important;background-repeat:no-repeat!important;animation:none!important;`
    + `box-shadow:inset 0 0 0 2px var(--accent),inset 0 0 0 4px var(--bg),${SW.cien}!important;${SW.ruch}}`
    + `${WYBRANA_PIG}:active{${SW.wcisk}}`
    + `@media (prefers-color-scheme:dark){${WYBRANA_PIG}{background-image:${SW.licoC}!important;box-shadow:inset 0 0 0 2px var(--accent),inset 0 0 0 4px var(--bg),0 0 0 .5px rgba(255,255,255,.2)!important}}`
    + GUZIK('.pigulki-widoku button:not([aria-pressed="true"]):not([aria-checked="true"]):not(.ciagniety)');
  // Podium: cena i „Tylko Toyota” w tej samej siatce co cztery kategorie pod nimi, „Tylko Toyota” tej samej szerokości co kategoria,
  // liczba na środku pola, a „Cena do … tys. zł” ciaśniej (Jacek: „Te 75 powinno być pośrodkowane … w tej rameczce”, „Tylko Toyota
  // … przytulone do prawej krawędzi … musi być w tej samej szerokości co bezpieczeństwo i bagażnik pod nią”). Odstęp siatki: na telefonie
  // 8 px w rzędzie i między rzędami, jak w nawigacji pod spodem, więc kolumny Podium stoją nad kolumnami zakładek; od 680 px bloku 16 px.
  const PODIUM = '.podium .podium-ustawienia{gap:8px}.podium .podium-chipy{gap:8px}'
    + '.podium .podium-rzad{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:center;gap:8px}'
    + '.podium .podium-rzad .budzet{min-width:0;justify-content:center;gap:6px;font-size:15px;white-space:nowrap}'
    + '.podium .podium-rzad .budzet input{width:3.2em;padding:0 4px;text-align:center}.podium #podium-toyota{width:100%;justify-content:center}'
    + '@container (min-width:680px){.podium .podium-rzad{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:8px}.podium .podium-chipy{gap:16px}'
    + '.podium .podium-rzad .budzet{grid-column:span 2;justify-content:flex-start}.podium #podium-toyota{grid-column:4}}'
    // „Porównaj te trzy” na telefonie na całą szerokość, jak przycisk całości pod nim (12 kolumn siatki).
    + '@media (max-width:759px){.podium-akcje #podium-porownaj{box-sizing:border-box;width:100%;justify-content:center}}' + SZKLANY('#podium-porownaj')
    // „Porównaj” w karcie modelu (szkło w lekkim błękicie, a dodany do porównania wypełniony akcentem) i pasek z oknem porównania.
    + GUZIK('button.porownaj:not([aria-pressed="true"])', { tlo: 'color-mix(in srgb,#0071e3 12%,rgba(255,255,255,.72))', tloC: 'color-mix(in srgb,#409cff 22%,rgba(44,44,46,.6))' })
    + GUZIK_PELNY('button.porownaj[aria-pressed="true"]', '#0071e3') + GUZIK('.pp-wyczysc') + GUZIK_PELNY('.pp-porownaj:not(:disabled)', '#0071e3') + GUZIK('.p-zamknij');
  const SIATKA = {
    katalog: `#pasek,.strona>.naglowek{display:none!important}.strona{${KONTENER}}.katalog{column-gap:24px!important}`
      + '.panel-filtrow{top:clamp(16px,2.5vw,32px)!important;max-height:calc(100vh - 2 * clamp(16px,2.5vw,32px))!important}'
      // Karty ogłoszeń (od 25.10.2026, Jacek: „więcej odstępu … pomiędzy listingami, żeby oddychało”): szare tło strony, białe karty,
      // a w ciemnym grafitowe na czerni, jak w App Store; 32 px między rzędami kart i 24 px między kolumnami.
      + 'html,body{background:light-dark(#ffffff,#000000)!important}.produkty{gap:32px 24px!important}.karta-produktu{background:light-dark(#ffffff,#1c1c1e)!important}'
      // Na telefonie pasek pod polem szukania w siatce nawigacji: Filtry na 4 kolumny, „Kolejność” na 8, rynna 8 px, także pod polem.
      // Skaner układa ten pasek polami siatki (szukaj, filtry, sort), więc 12 kolumn dostają też pola.
      + '@media (max-width:759px){.narzedzia{gap:8px!important}.pasek-narzedzi:has(>.mobilne-filtry){grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:8px!important;'
      + `grid-template-areas:"${'szukaj '.repeat(12).trim()}" "${'filtry '.repeat(4)}${'sort '.repeat(8).trim()}"!important}`
      + '.pasek-narzedzi>.mobilne-filtry{justify-content:center}}'
      // Numery miejsc z sortowania „Najlepsze dopasowanie” znikają (od 26.10.2026, Jacek: „Jeżeli nie mają sensu, to nie dawaj ich
      // w ofertach”): powtarzały tylko kolejność listy.
      + '.karta-produktu .miejsce{display:none!important}'
      // Okno auta: serce, oko i krzyżyk co 16 px, znaki 24 px (od 26.10.2026; wcześniej co 8 px ze znakami 18 px).
      + 'dialog[open] .wybor-serce~.przycisk.cichy{margin-left:8px!important}dialog[open] :is(.wybor-serce,.wybor-serce~.przycisk.cichy) svg{width:24px!important;height:24px!important}'
      // Przyciski Ofert ze szkła z 45° światłem: Filtry, Kolejność, przyciski w panelu filtrów i w oknie auta (serce, oko, krzyżyk).
      + GUZIK('.przycisk:not(.glowny):not(.przycisk-nowe)') + GUZIK('.mobilne-filtry') + GUZIK_PELNY('.przycisk.glowny', 'var(--akcent)')
      + GUZIK('.pasek-narzedzi select', { obraz: false }) + GUZIK('.aktywne button') + GUZIK('dialog[open] .wybor-serce'),
    // Podium i Historia bez rzędu „Skrót | Pełny widok” (od 25.10.2026): w zakładce najwyżej jeden rząd pigułek, a całość otwiera
    // przycisk na końcu skrótu (app.js, „Skrót i całość”).
    modele: GAZETA + '.widok-modeli{display:none!important}' + CALOSC('.przycisk-p[data-widok-modeli="pelny"]') + PIERSCIEN + PODIUM,
    kalkulator: `.strona{${KONTENER}}button#info{display:none!important}`
      + '@media (width>1100px){.uklad{grid-template-columns:312px minmax(0,1fr)!important;column-gap:24px!important}}'
      // Finanse (od 25.10.2026): aplikacja wpisuje stronie data-czesc, leasing albo kredyt, i pokazuje tylko tę część. Nagłówek z tytułem
      // i przełącznikiem Skrót | Pełny widok znika, bo część mówi pigułka, a całość otwiera przycisk na końcu skrótu. Bez atrybutu
      // (okno na komputerze) strona zostaje cała.
      + 'html[data-czesc] .strona>header.glowa,html[data-czesc] .karta-skrot>h2{display:none!important}'
      + ['section[aria-labelledby="sk-kredyt"]', '#skrot-dol', '#podsum', '#tabela', '#wyniki>.legenda', '.pole:has(#cel)', '.check:has(#warunki)',
        '.pole:has(#nadplata)', '.kwota', '.reszta', '#h-leasing-tab'].map((s) => `html[data-czesc="leasing"] ${s}`).join(',') + '{display:none!important}'
      + 'html[data-czesc="leasing"] .blok-leasing{margin-top:0!important}'
      + 'html[data-czesc="kredyt"] section[aria-labelledby="sk-leasing"],html[data-czesc="kredyt"] .blok-leasing{display:none!important}'
      // Okresy, szybkie wybory i przyciski kalkulatora ze szkła; wybrany szybki wybór zostaje wypełniony akcentem strony.
      + GUZIK('.okresy button') + GUZIK('.chipy button:not([aria-pressed=true])') + GUZIK_PELNY('.chipy button[aria-pressed=true]', 'var(--fill)')
      + GUZIK('.przycisk') + GUZIK('.cofanie button')
      + CALOSC('html[data-czesc] #skrot>.przycisk') + PIERSCIEN,
    historia: GAZETA + '.widok-strony{display:none!important}' + CALOSC('.przycisk-p[data-widok-strony="pelny"]') + PIERSCIEN,
    // Poradnik w zakładce (od 25.10.2026; wcześniej w oknie pod logo): data nad tytułem bliżej nagłówka, a na telefonie tekst
    // w siatce aplikacji, czyli od tej samej krawędzi co logo (strona z programu 13 ma tam kolumnę 87,5%).
    poradnik: 'main>header.hero{padding-top:16px!important}'
      + `@media (max-width:734px){main{box-sizing:border-box!important;width:100%!important;padding-left:${L}!important;padding-right:${P}!important}`
      + '#czytaj-calosc,.wiecej>summary{box-sizing:border-box!important;width:100%!important;justify-content:center!important}}' + SZKLANY('#czytaj-calosc')
      // „Pokaż …” w poradniku (od 26.10.2026, zwijane bloki <details class="wiecej"> z programu 13): to samo szkło co „Czytaj całość”.
      + SZKLANY('.wiecej>summary'),
  };
  // Tło strony takie samo jak nagłówek i nawigacja: we wszystkich czterech zakładkach biel, w ciemnym czerń (od 26.10.2026; Jacek po próbie
  // z odcieniami barw zakładek: „wracamy do bieli wszystkich czterech takiej samej”). Kolor i znacznik data-km-odcien wpisuje ustawSiatke,
  // więc okno na komputerze, które ich nie wpisuje, zostaje przy tłach z SIATKA.
  const cssSiatki = (nazwa) => `html{scrollbar-width:thin;scrollbar-gutter:stable}html[data-km-odcien],html[data-km-odcien] body{background:var(--km-odcien)!important}${SIATKA[nazwa]}`;
  // </siatka>
  // Pod stroną miejsce na nawigację ze szkła, która na telefonie leży nad nią (wysokość --km-dol wpisuje ustawSiatke; na szerokim ekranie 0).
  const SZKLO = 'body::after{content:"";display:block;height:var(--km-dol,0px)}';
  const wSiatce = (nazwa) => (html) => html.replace(/<\/head>/i, () => `<style id="kasiomobile-siatka">${cssSiatki(nazwa)}${SZKLO}</style></head>`);

  // ---------------------------------------------------------------- prośba o skan
  // Komputer skanuje i wysyła nowy katalog. Czas prośby bierzemy z odpowiedzi ntfy.sh, żeby porównać go
  // z czasem katalogu bez kłopotu z zegarem telefonu.
  const SWIEZE = 10 * 60 * 1000, CZEKAM_MS = 6 * 60 * 1000; // skan trwa zwykle minutę, ale bywa i prawie 5 (18.10.2026: 286 s)
  const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
  async function poprosOSkan() {
    const przerwij = new AbortController();
    const zegar = setTimeout(() => przerwij.abort(), 20000);
    try {
      const r = await fetch(`${SERWER}/${KANAL}-skanuj`, { method: 'POST', body: `skanuj (${SKAD})`, cache: 'no-store', signal: przerwij.signal });
      if (!r.ok) throw new Error('ntfy.sh odpowiedział ' + r.status);
      const o = await r.json().catch(() => ({}));
      return o.time || Math.floor(Date.now() / 1000);
    } finally {
      clearTimeout(zegar);
    }
  }

  // Stan sieci dla pustych ekranów: w trakcie pobierania nie piszemy, że plik „nie dotarł”.
  let pobieram = false, bezSieci = false;
  // Zdanie mówi, co się dzieje i co dalej (wytyczne Jacka: błąd to jedno zdanie przy rzeczy, które mówi, co zrobić). Przycisku nie ma:
  // dane przychodzą same, także po powrocie internetu (zdarzenie online niżej).
  const pusty = (biernik, nieDotarl) => () => (!KANAL ? 'Otwórz Kasiomobile z linku od Jacka. Bez niego aplikacja nie wie, skąd brać dane.'
    : pobieram ? `Pobieram ${biernik} z komputera…`
      : bezSieci ? `Brak internetu. Pobiorę ${biernik}, gdy internet wróci.`
        : nieDotarl);

  // ---------------------------------------------------------------- zakładki i pigułki
  // Cztery zakładki (od 25.10.2026): Ogłoszenia z pigułkami Teraz i Historia, Katalag z pigułkami Podium Otomoto, Modele Otomoto
  // i Wszystkie marki (Modele i Marki to Atlas wszystkich aut z sieci; Jacek: „marki powinny być w ostatnim tabie”), Finanse
  // z pigułkami Leasing i Kredyt (Jacek: „wpierw leasing a dopiero po nim kredyt”) i Poradnik. Do 24.10.2026 Historia była czwartą
  // zakładką, a Poradnik i Atlas stały w oknie pod logo. Zakładka ma w kodzie stały identyfikator (ID_ZAKLADEK, ten sam co jej sekcja
  // w index.html), a w pamięci telefonu stoi pod nazwą z WIDOKI, więc dawny zapis działa dalej, a zapisana „Historia” to dziś Ogłoszenia
  // z pigułką Historia. Pigułki stoją w nawigacji pod zakładkami (index.html, .podkarty; Jacek: „logiczniejsze by było, że te główne
  // linie się przesuwa i pod spodem wyskakuje”), i widać tylko rząd wybranej zakładki.
  const ID_ZAKLADEK = ['katalog', 'modele', 'kredyt', 'poradnik'];
  // Nazwy w pamięci (od 18.10.2026) i na ekranie. Od 25.10.2026 wieczorem Oferty i Podium (Jacek: „Katalog można by zmienić na
  // 'podium'”, „Ogłoszenia się ledwo mieszczą … Albo zakupy … jak uważasz”), do tego dnia Ogłoszenia i Katalag.
  const WIDOKI = ['Katalog', 'Modele', 'Kredyt', 'Poradnik'];
  const NAZWY = ['Oferty', 'Podium', 'Finanse', 'Poradnik'];
  const PANELE = ID_ZAKLADEK.map((id) => $('#' + id));
  const segmenty = ID_ZAKLADEK.map((id) => $('#seg-' + id));
  const nrZakladki = (id) => ID_ZAKLADEK.indexOf(id);
  const strona = (r, puste, p, poprawka, zdania) => ({ el: $(r), plik: p, pusty: pusty(...zdania), ramka: ramka($(r), $(puste), poprawka) });
  const STRONY = {
    katalog: strona('#ramka-katalogu', '#pusty-katalog', KATALOG, wSiatce('katalog'),
      ['oferty', 'Oferty jeszcze nie dotarły. Komputer wysyła je co godzinę, gdy jest włączony.']),
    historia: strona('#ramka-historii', '#pusty-historia', HISTORIA, wSiatce('historia'),
      ['historię', 'Historia jeszcze nie dotarła. Komputer wysyła ją co godzinę, gdy jest włączony.']),
    modele: strona('#ramka-modeli', '#pusty-modele', MODELE, wSiatce('modele'),
      ['podium', 'Podium jeszcze nie dotarło. Komputer wysyła je co godzinę, gdy jest włączony.']),
    kredyt: strona('#ramka-kredytu', '#pusty-kredyt', KALKULATOR, (html) => czescNaStart(wSiatce('kalkulator')(html)),
      ['kalkulator', 'Kalkulator leasingu i kredytu jeszcze nie dotarł. Komputer wysyła go co godzinę, gdy jest włączony.']),
    poradnik: strona('#ramka-poradnika', '#pusty-poradnik', PORADNIK, wSiatce('poradnik'),
      ['poradnik', 'Poradnik jeszcze nie dotarł. Komputer wysyła go co godzinę, gdy jest włączony.']),
  };
  const LISTA_STRON = Object.entries(STRONY);
  // Pigułki zakładki: zakładka → pigułka → [miejsce w zakładce, strona]. Modele i Marki to ta sama ramka Atlasu, a Leasing i Kredyt
  // ta sama ramka kalkulatora, w której aplikacja pokazuje jedną część (ustawCzesc niżej). Kolejność kluczy to kolejność domyślna.
  const PIGULKI = {
    katalog: { teraz: ['teraz', 'katalog'], historia: ['historia', 'historia'] },
    modele: { podium: ['podium', 'modele'], modele: ['atlas', 'atlas'], marki: ['atlas', 'atlas'] },
    kredyt: { leasing: ['finanse', 'kredyt'], kredyt: ['finanse', 'kredyt'] },
    // Poradnik (od 25.10.2026 wieczorem, Jacek: „skrót i całość … Każdy jeden ma coś do wyboru pod spodem … nie ma przeskakiwania
    // z menu”): Skrót i Całość to dwie części tej samej strony (ustawPoradnik niżej). Każda zakładka ma więc rząd pigułek, a nawigacja
    // stoi w miejscu przy każdej zmianie zakładki.
    poradnik: { skrot: ['poradnik', 'poradnik'], calosc: ['poradnik', 'poradnik'] },
  };
  // Zakładka z Atlasem.
  const Z_ATLASEM = 'modele';
  const jestPigulka = (id, p) => Boolean(PIGULKI[id]) && typeof p === 'string' && Object.keys(PIGULKI[id]).includes(p);
  // Wybrana pigułka każdej zakładki. Do 25.10.2026 w pamięci pod numerem zakładki (pigulka-0, pigulka-1), od teraz pod identyfikatorem.
  const DAWNY_NUMER = { katalog: 0, modele: 1 };
  const wybrane = {};
  for (const id of Object.keys(PIGULKI)) {
    let z = pamiec.czytaj('pigulka-' + id, null);
    if (z === null && id in DAWNY_NUMER) z = pamiec.czytaj('pigulka-' + DAWNY_NUMER[id], null);
    wybrane[id] = jestPigulka(id, z) ? z : Object.keys(PIGULKI[id])[0];
  }
  const klucz = (nr) => { const id = ID_ZAKLADEK[nr]; return PIGULKI[id][wybrane[id]][1]; };
  let widok = 0;
  // Siatka w ramkach: cienki pasek przewijania (jak w katalogu Skanera) mierzymy tu raz, a marginesy w pikselach, razem z wcięciami
  // ekranu, których ramka nie zna, wpisujemy do każdej ramki przy wczytaniu i przy zmianie okna (styl.css, „Siatka aplikacji”).
  const miarka = el('div', { class: 'siatka-pasek', 'aria-hidden': 'true' });
  document.body.append(miarka);
  document.documentElement.style.setProperty('--km-pasek', (miarka.offsetWidth - miarka.clientWidth) + 'px');
  miarka.remove();
  const sonda = el('div', { class: 'siatka-sonda', 'aria-hidden': 'true' });
  document.body.append(sonda);
  function ustawSiatke() {
    const cs = getComputedStyle(sonda), odcien = getComputedStyle(document.body).getPropertyValue('--tlo-pasa').trim() || '#ffffff';
    for (const [, s] of LISTA_STRON) {
      try {
        const d = s.el.contentDocument;
        if (!d || !d.documentElement) continue;
        d.documentElement.style.setProperty('--km-odcien', odcien);
        d.documentElement.dataset.kmOdcien = '';
        swiatloPrzyciskow(d);
        d.documentElement.style.setProperty('--km-lewo', cs.paddingLeft);
        d.documentElement.style.setProperty('--km-prawo', cs.paddingRight);
        // Nawigacja ze szkła leży nad stroną: strona dostaje jej wysokość, żeby jej koniec dało się przewinąć nad nawigację.
        d.documentElement.style.setProperty('--km-dol', document.documentElement.style.getPropertyValue('--km-dol') || '0px');
        // Katalag i Historia od 1100 px: góra strony w lewej kolumnie stoi na wysokości pierwszej rzeczy w prawej.
        const h = d.querySelector('main > header.hero'), n = h && h.nextElementSibling;
        if (h) h.style.top = '';
        if (h && n && d.defaultView.getComputedStyle(h).position === 'absolute') h.style.top = Math.round(n.getBoundingClientRect().top - h.parentElement.getBoundingClientRect().top) + 'px';
      } catch { /* obce pochodzenie */ }
    }
  }
  addEventListener('resize', ustawSiatke);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => requestAnimationFrame(ustawSiatke));
  // Kolorowe tło (niespodzianka pod logo, niżej) trwa do zamknięcia aplikacji, a każdy start jest śnieżnobiały (od 26.10.2026, Jacek:
  // „chodziło o ten biały, żeby to było śnieżnobiałe”; do tego dnia odcień zostawał w pamięci telefonu). Dawny zapis znika.
  pamiec.usun('kolorowo');
  LISTA_STRON.forEach(([, s]) => s.el.addEventListener('load', ustawSiatke));

  // Otwarte okno w stronie (filtry, szczegóły auta, galeria) dostaje cały ekran: nagłówek, pigułki i zakładki chowają się,
  // a po zamknięciu wracają. Strony w ramkach mają to samo pochodzenie (blob:), więc ich okna widać stąd.
  const okna = {};
  const pokazOkno = () => document.body.classList.toggle('okno', Boolean(okna[klucz(widok)]));
  LISTA_STRON.forEach(([k, s]) => {
    s.el.addEventListener('load', () => {
      let w = null;
      try { w = s.el.contentWindow; if (!w || !w.document || !w.document.documentElement) return; } catch { return; }
      const sprawdz = () => {
        const o = Boolean(w.document.querySelector('dialog[open]'));
        if (o !== Boolean(okna[k])) { okna[k] = o; pokazOkno(); }
      };
      // Odnośnik bez target otwiera się jak każdy inny, w nowym oknie, czyli w przeglądarce telefonu, a nie w ramce zamiast
      // strony z komputera (19.10.2026: na Androidzie ramka Kredytu przechodziła na obcą stronę).
      w.document.addEventListener('click', (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (a && /^https?:/i.test(a.href) && !a.target) a.target = '_blank';
      }, true);
      new w.MutationObserver(sprawdz).observe(w.document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
      sprawdz();
    });
  });

  function pokazStrone(nr) {
    const k = klucz(nr);
    if (k === 'atlas') return pokazAtlas(wybrane[Z_ATLASEM]);
    const s = STRONY[k];
    return s.ramka.pokaz(s.plik, s.pusty);
  }
  function pokazWidok(nr, zapisz) {
    widok = nr >= 0 && nr < WIDOKI.length ? nr : 0;
    segmenty.forEach((s, i) => {
      s.setAttribute('aria-selected', String(i === widok));
      s.tabIndex = i === widok ? 0 : -1;
    });
    PANELE.forEach((p, i) => { p.hidden = i !== widok; });
    // W nawigacji widać rząd pigułek wybranej zakładki.
    const id = ID_ZAKLADEK[widok];
    for (const [z, g] of Object.entries(grupyPigulek)) g.hidden = z !== id;
    document.body.dataset.zakladka = id;
    ustawSiatke();
    pokazOkno();
    // Zakładka zapisana nazwą (od 18.10.2026), bo numery przesuwają się, gdy zakładka dochodzi albo znika.
    if (zapisz) pamiec.zapisz('zakladka', WIDOKI[widok]);
    return pokazStrone(widok);
  }
  // Skrót i całość w Podium, Historii i Finansach (od 25.10.2026): rząd „Skrót | Pełny widok” w stronie jest schowany (siatka wyżej),
  // bo w zakładce stoi najwyżej jeden rząd pigułek. Strona zaczyna każde otwarcie aplikacji od skrótu (start, niżej), przycisk na końcu
  // skrótu („Ranking i wszystkie modele”, „Cała historia”, „Cały kalkulator”) otwiera całość, a do skrótu wraca stuknięcie w wybraną
  // pigułkę albo zakładkę i Wstecz.
  const SKROT = {
    modele: { b: '[data-widok-modeli="skrot"]', pelny: (d) => d.documentElement.dataset.widok === 'pelny' },
    historia: { b: '[data-widok-strony="skrot"]', pelny: (d) => d.documentElement.dataset.widok === 'pelny' },
    kredyt: { b: '.przelacznik [data-widok="skrot"]', pelny: (d) => { const p = d.getElementById('pelny'); return Boolean(p && !p.hidden); } },
  };
  function doSkrotu(k) {
    try {
      const s = SKROT[k], d = STRONY[k].el.contentDocument, b = s && d.querySelector(s.b);
      if (!b || !s.pelny(d)) return false;
      b.click();
      STRONY[k].el.contentWindow.scrollTo(0, 0);
      return true;
    } catch { return false; }
  }
  // Finanse: kalkulator ma kredyt i leasing na jednej stronie, a aplikacja pokazuje z niej jedną część, tę z wybranej pigułki (atrybut
  // data-czesc, który czyta siatka kalkulatora wyżej). Nowy plik dostaje część już w HTML, więc nic nie mignie.
  const czescNaStart = (html) => html.replace(/<html\b/i, () => `<html data-czesc="${wybrane.kredyt}"`)
    .replace('data-widok="pelny">Zmień kwotę, okres i leasing</button>', () => 'data-widok="pelny">Cały kalkulator</button>');
  function ustawCzesc() {
    try {
      const d = STRONY.kredyt.el.contentDocument;
      if (d && d.documentElement) d.documentElement.dataset.czesc = wybrane.kredyt;
    } catch { /* obce pochodzenie */ }
  }
  STRONY.kredyt.el.addEventListener('load', ustawCzesc);
  // Poradnik: Skrót i Całość to dwie części strony z misji (poradnik.js: skrót przed jedyną linią pliku, całość w #calosc, którą odsłania
  // window.pokazCalosc albo przycisk „Czytaj całość” na końcu skrótu). Aplikacja pokazuje część z wybranej pigułki: Całość odsłania resztę
  // i staje na jej początku, a Skrót chowa ją z powrotem razem z przyciskiem i wraca na górę. Przycisk w stronie przełącza pigułkę na Całość.
  let przyciskPoradnika = null;
  function ustawPoradnik(ruch) {
    try {
      const w = STRONY.poradnik.el.contentWindow, d = w.document, c = d.getElementById('calosc');
      if (!c) return;
      const b = d.getElementById('czytaj-calosc');
      if (b && b.closest('p')) przyciskPoradnika = b.closest('p');
      if (wybrane.poradnik === 'calosc') {
        if (!c.hidden) return;
        if (w.pokazCalosc) w.pokazCalosc(false); else c.hidden = false;
        if (ruch) c.scrollIntoView({ block: 'start' });
        return;
      }
      if (!c.hidden) {
        c.hidden = true;
        try { w.sessionStorage.removeItem('poradnik-calosc'); } catch { /* bez pamięci */ }
        if (przyciskPoradnika && przyciskPoradnika.ownerDocument === d && !przyciskPoradnika.isConnected) c.before(przyciskPoradnika);
      }
      if (ruch) w.scrollTo(0, 0);
    } catch { /* strona się wczytuje */ }
  }
  STRONY.poradnik.el.addEventListener('load', () => {
    try {
      const b = STRONY.poradnik.el.contentDocument.getElementById('czytaj-calosc');
      if (b) b.addEventListener('click', () => { if (wybrane.poradnik !== 'calosc') ustawPigulke('poradnik', 'calosc', true, true); });
    } catch { /* obce pochodzenie */ }
    ustawPoradnik(false);
  });
  // Stuknięcie w wybraną zakładkę albo pigułkę przewija stronę na początek, jak w iPhonie, a w całości wraca do skrótu. W Atlasie ten sam
  // widok jeszcze raz: Atlas zamyka wtedy podstrony i staje na górze.
  function naPoczatek() {
    const k = klucz(widok);
    if (k === 'atlas') { try { ramkaAtlasu.contentWindow.postMessage({ atlas: 'widok', widok: wybrane[Z_ATLASEM] }, '*'); } catch { /* ramka się wczytuje */ } return; }
    if (doSkrotu(k)) return;
    try { STRONY[k].el.contentWindow.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* strona się wczytuje */ }
  }
  const pasekZakladek = $('.karty');
  // Połysk wybranej zakładki i pigułki to biała smuga raz, przy wyborze (styl.css, „Barwy zakładek”).
  // Szkło pod kursorem: błysk światła idzie za myszą (styl ::after zakładki i pigułki czyta --mx i --my). Palcem liczy się tylko
  // miejsce wciśnięcia, od którego zakładka się rozświetla (wariant 4), bo ruch palca przestawia zakładki.
  function szklo(e) {
    if (e.pointerType !== 'mouse' && e.type !== 'pointerdown') return;
    const b = e.target.closest && e.target.closest('[role="tab"], [role="radio"]');
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
    b.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
  }
  pasekZakladek.addEventListener('pointermove', szklo, { passive: true });
  pasekZakladek.addEventListener('pointerdown', szklo, { passive: true });

  // ---------------------------------------------------------------- pigułki w nawigacji (od 25.10.2026)
  // Pigułka zmienia stronę pod sobą bez przeładowania, a wybór wraca po ponownym otwarciu aplikacji. Nowa strona wjeżdża z tej
  // strony, po której stoi pigułka (300 ms), a smuga światła przechodzi przez pigułkę raz, przy wyborze. Przy ograniczonym ruchu
  // strona zmienia się od razu, bo wjazd to ozdoba, a smuga zostaje, bo mówi, co jest wybrane.
  const grupyPigulek = Object.fromEntries(Object.keys(PIGULKI).map((id) => [id, $(`.podkarty .podwidoki[data-z="${id}"]`)]));
  const malyRuch = matchMedia('(prefers-reduced-motion: reduce)');
  function oznaczPigulke(id, p) {
    for (const b of grupyPigulek[id].querySelectorAll('[role="radio"]')) {
      const tak = b.dataset.p === p;
      b.setAttribute('aria-checked', String(tak));
      b.tabIndex = tak ? 0 : -1;
    }
    const panel = $('#' + id), miejsce = PIGULKI[id][p][0];
    panel.dataset.p = p;
    let pod = null;
    for (const d of panel.querySelectorAll('.podwidok')) { d.hidden = d.dataset.p !== miejsce; if (!d.hidden) pod = d; }
    return pod;
  }
  function ustawPigulke(id, p, zapisz, ruch) {
    if (!jestPigulka(id, p)) return Promise.resolve(false);
    const g = grupyPigulek[id], stara = wybrane[id], kolejnosc = [...g.querySelectorAll('[role="radio"]')].map((b) => b.dataset.p);
    wybrane[id] = p;
    if (zapisz) pamiec.zapisz('pigulka-' + id, p);
    const pod = oznaczPigulke(id, p);
    if (ruch && stara !== p) {
      const b = g.querySelector(`[data-p="${p}"]`);
      b.classList.remove('blysk'); void b.offsetWidth; b.classList.add('blysk');
      b.addEventListener('animationend', () => b.classList.remove('blysk'), { once: true });
      if (pod && pod.animate && !malyRuch.matches) {
        pod.animate([{ transform: `translateX(${kolejnosc.indexOf(p) > kolejnosc.indexOf(stara) ? 40 : -40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' });
      }
    }
    // Leasing i Kredyt to dwie części jednej strony: druga część zaczyna od swojego skrótu, od góry.
    if (id === 'kredyt' && stara !== p) {
      ustawCzesc();
      if (!doSkrotu('kredyt')) { try { STRONY.kredyt.el.contentWindow.scrollTo(0, 0); } catch { /* strona się wczytuje */ } }
    }
    if (id === 'poradnik' && stara !== p) ustawPoradnik(true);
    pokazOkno();
    return id === ID_ZAKLADEK[widok] ? pokazStrone(widok) : Promise.resolve(true);
  }
  for (const [id, g] of Object.entries(grupyPigulek)) {
    g.addEventListener('pointermove', szklo, { passive: true });
    g.addEventListener('pointerdown', szklo, { passive: true });
    for (const b of g.querySelectorAll('[role="radio"]')) {
      b.addEventListener('click', () => { if (id === ID_ZAKLADEK[widok] && b.dataset.p === wybrane[id]) naPoczatek(); else ustawPigulke(id, b.dataset.p, true, true); });
      // Strzałki bez Alt przełączają pigułkę, w kolejności z ekranu (Alt+← → przestawia, niżej).
      b.addEventListener('keydown', (e) => {
        if (e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const k = [...g.querySelectorAll('[role="radio"]')].map((x) => x.dataset.p), m = k.indexOf(b.dataset.p);
        const n = k[(m + (e.key === 'ArrowRight' ? 1 : -1) + k.length) % k.length];
        ustawPigulke(id, n, true, true);
        g.querySelector(`[data-p="${n}"]`).focus();
      });
    }
  }
  // ---------------------------------------------------------------- przestawianie: zakładki i pigułki
  // Jacek, 22.10.2026 (punkt 3 w „05 --- Jacek Design Guidelines”): „co może być, powinna być dragable … Czemu nie? Nikt cię nie
  // zmusza do przyciskania i przytrzymywania myszy”, „kocham mieć możliwość zmieniania tej kolejności ze względu na to, jak moje
  // potrzeby z czasem się zmieniają”. Jeden kod dla zakładek na dole i dla pigułek u góry zakładek (do 24.10.2026 także dla kółek w nagłówku
  // i pigułek pod logo). Logo z napisem stoi w miejscu: to znak aplikacji, a pod nim jest schowane Otomoto.
  // Element jedzie pod palcem albo kursorem w granicach swojego rzędu, a sąsiad, którego zakrył do połowy, dojeżdża na jego dawne
  // miejsce (240 ms). Wystarczy pociągnąć w bok: palcem o 10 px (bardziej w bok niż w pionie), myszą o 6 px. Zakładkę można też
  // przytrzymać palcem 450 ms, kółka nie, bo przytrzymane kółko pokazuje dymek. Stuknięcie i ruch w pionie niczego nie przestawiają.
  // W drzewie strony przechodzi sąsiad, a nie ciągnięty element: przeniesiony traciłby przechwycenie wskaźnika. Gdy ciągnięcie
  // przerwie system (pointercancel), kolejność wraca. Z klawiatury Alt+← →. Kolejność zostaje w telefonie, przez 6 sekund stoi
  // „Cofnij”, a Ctrl+Z i Ctrl+Y (także Ctrl+Shift+Z) cofają i ponawiają przestawienia poza polem tekstowym (reguła cofnij-i-ponow).
  const ogloszenie = document.createElement('p');
  ogloszenie.className = 'ukryte';
  ogloszenie.setAttribute('aria-live', 'polite');
  document.body.append(ogloszenie);
  function powiedz(t) { ogloszenie.textContent = ''; requestAnimationFrame(() => { ogloszenie.textContent = t; }); }
  const cofnijPole = $('.cofnij-zakladki'), przyciskCofnij = $('#cofnij-zakladki');
  const PRZESTAWIENIA = { wstecz: [], naprzod: [] };
  let zegarCofnij = 0;
  // „Cofnij” paruje jak szkło (od 26.10.2026, styl.css, „cofnij-paruje”, 6 s) i chowa się na koniec animacji. Zegar zostaje tylko
  // na wypadek, gdyby animacji nie było wcale.
  function pokazCofnij(rzad) {
    clearTimeout(zegarCofnij);
    cofnijPole.classList.remove('paruje');
    cofnijPole.hidden = !rzad;
    if (!rzad) return;
    przyciskCofnij.setAttribute('aria-label', rzad.cofnij);
    void cofnijPole.offsetWidth;
    cofnijPole.classList.add('paruje');
    if (getComputedStyle(przyciskCofnij).animationName === 'none' && !przyciskCofnij.matches(':hover, :focus-visible')) zegarCofnij = setTimeout(() => pokazCofnij(null), 6000);
  }
  przyciskCofnij.addEventListener('animationend', (e) => { if (e.animationName.startsWith('cofnij-paruje')) pokazCofnij(null); });
  // Cofa albo ponawia ostatnie przestawienie, w którymkolwiek rzędzie. Oddaje false, gdy nie było czego.
  function cofnijPrzestawienie(ponow) {
    const krok = (ponow ? PRZESTAWIENIA.naprzod : PRZESTAWIENIA.wstecz).pop();
    if (!krok) return false;
    krok.rzad.ustaw(ponow ? krok.po : krok.przed, true);
    (ponow ? PRZESTAWIENIA.wstecz : PRZESTAWIENIA.naprzod).push(krok);
    pokazCofnij(null);
    powiedz(ponow ? 'Przestawienie ponowione' : 'Przestawienie cofnięte');
    return true;
  }
  przyciskCofnij.addEventListener('click', () => cofnijPrzestawienie(false));
  const poleTekstowe = (e) => Boolean(e && (e.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName || '')));
  document.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase();
    if (!(e.ctrlKey || e.metaKey) || e.altKey || (k !== 'z' && k !== 'y') || poleTekstowe(e.target)) return;
    if (cofnijPrzestawienie(k === 'y' || e.shiftKey)) e.preventDefault();
  });
  const RUCH = 'transform 240ms cubic-bezier(.2, 0, 0, 1), box-shadow 240ms ease, background-color 240ms ease';
  const UNIES = 'box-shadow 120ms ease, background-color 120ms ease';
  // o: rodzic (w nim stoją elementy, obok siebie), elementy, klucz w pamięci, id(element) do zapisu, nazwa(element) dla czytnika
  // ekranu, cofnij (opis przycisku „Cofnij”), przytrzymanie (palec może zacząć przytrzymaniem 450 ms), podniesiony (woła, gdy element
  // ruszył). Oddaje { kolejnosc(), ustaw(), przerwij() }.
  function rzadPrzestawiany(o) {
    const { rodzic, elementy } = o, ids = elementy.map(o.id);
    const ulozone = () => [...elementy].sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));
    const widoczne = () => ulozone().filter((b) => !b.hidden);
    const rzad = {
      cofnij: o.cofnij,
      kolejnosc: () => ulozone().map(o.id),
      // Elementy stoją obok siebie, więc wystarczy wstawić je po kolei przed tym, co stoi za ostatnim. Nieznane id pomija.
      ustaw(k, zapisz) {
        const teraz = ulozone(), za = teraz[teraz.length - 1].nextSibling;
        for (const id of k) { const i = ids.indexOf(id); if (i >= 0) rodzic.insertBefore(elementy[i], za); }
        if (zapisz) pamiec.zapisz(o.klucz, rzad.kolejnosc());
      },
      // Nawigacja, którą ktoś zaczął przenosić (przytrzymanie 2 s), przerywa czekające przestawienie: palec należy już do niej.
      przerwij() { clearTimeout(ciag.zegar); if (!ciag.aktywne) ciag.b = null; },
    };
    // Zapisana kolejność. Element, którego nie ma w zapisie (doszedł w nowej wersji), staje za swoim poprzednikiem.
    const zapis = pamiec.czytaj(o.klucz, null);
    if (Array.isArray(zapis)) {
      const k = zapis.map(String).filter((id, j, a) => ids.includes(id) && a.indexOf(id) === j);
      ids.forEach((id, i) => { if (!k.includes(id)) k.splice(i ? k.indexOf(ids[i - 1]) + 1 : 0, 0, id); });
      rzad.ustaw(k, false);
    }
    function zmiana(przed, po, b) {
      pamiec.zapisz(o.klucz, po);
      PRZESTAWIENIA.wstecz.push({ rzad, przed, po });
      if (PRZESTAWIENIA.wstecz.length > 50) PRZESTAWIENIA.wstecz.shift();
      PRZESTAWIENIA.naprzod.length = 0;
      pokazCofnij(rzad);
      powiedz(`${o.nazwa(b)}: miejsce ${po.indexOf(o.id(b)) + 1} z ${po.length}`);
    }
    const ciag = { b: null, x: 0, y: 0, id: 0, mysz: false, start: null, aktywne: false, bylRuch: false, zegar: 0, l0: 0, min: 0, max: 0 };
    function podnies() {
      const b = ciag.b;
      clearTimeout(ciag.zegar);
      ciag.aktywne = true;
      b.classList.add('ciagniety');
      // Dymek kółka nie jedzie za nim, a nad ciągniętym nowy się nie pokaże (czat.js).
      for (const d of document.querySelectorAll('.czat-dymek')) d.remove();
      b.style.transition = 'transform 120ms ease, ' + UNIES;
      b.style.transform = 'scale(1.06)';
      if (o.podniesiony) o.podniesiony();
    }
    // Ciągnięty stoi tam, gdzie palec, ale nie wychodzi poza swój rząd. Oddaje jego lewy brzeg w układzie offsetLeft.
    function nies(e) {
      const b = ciag.b, x = Math.min(Math.max(ciag.l0 + e.clientX - ciag.x, ciag.min), ciag.max);
      b.style.transition = UNIES;
      b.style.transform = `translateX(${x - b.offsetLeft}px) scale(1.06)`;
      return x;
    }
    function przestawSasiada(s, przed) {
      const bylo = s.getBoundingClientRect().left;
      rodzic.insertBefore(s, przed);
      s.style.transition = 'none';
      s.style.transform = '';
      s.style.transform = `translateX(${bylo - s.getBoundingClientRect().left}px)`;
      void s.offsetWidth;
      s.style.transition = RUCH;
      s.style.transform = '';
    }
    rodzic.addEventListener('pointerdown', (e) => {
      const b = e.target.closest && e.target.closest('button'), w = widoczne();
      if (!b || !elementy.includes(b) || w.length < 2 || ciag.aktywne || (e.pointerType === 'mouse' && e.button !== 0)) return;
      clearTimeout(ciag.zegar);
      const ost = w[w.length - 1];
      Object.assign(ciag, { b, x: e.clientX, y: e.clientY, id: e.pointerId, mysz: e.pointerType === 'mouse', start: rzad.kolejnosc(), aktywne: false,
        bylRuch: false, l0: b.offsetLeft, min: w[0].offsetLeft, max: ost.offsetLeft + ost.offsetWidth - b.offsetWidth });
      // Przechwycenie od razu: ruch i puszczenie wracają tu także spoza rzędu, więc nic nie zostaje uniesione.
      try { b.setPointerCapture(e.pointerId); } catch { /* wskaźnik z testu */ }
      if (!ciag.mysz && (typeof o.przytrzymanie === 'function' ? o.przytrzymanie() : o.przytrzymanie)) ciag.zegar = setTimeout(podnies, 450);
    });
    rodzic.addEventListener('pointermove', (e) => {
      if (!ciag.b || e.pointerId !== ciag.id) return;
      if (!ciag.aktywne) {
        const dx = Math.abs(e.clientX - ciag.x), dy = Math.abs(e.clientY - ciag.y);
        if (ciag.mysz ? dx >= 6 : dx >= 10 && dx >= dy) podnies();
        else { if (!ciag.mysz && dy > 10) { clearTimeout(ciag.zegar); ciag.b = null; } return; }
      }
      e.preventDefault();
      // Sąsiad ustępuje, gdy ciągnięty zakryje go do połowy, czyli gdy jego brzeg minie środek sąsiada (jak w iOS). Próg w obie
      // strony jest ten sam, więc nic nie skacze tam i z powrotem. Szybki ruch mija czasem kilka naraz: przestawiamy po jednym.
      const b = ciag.b;
      for (let i = 0; i < elementy.length; i++) {
        const x = nies(e), w = widoczne(), m = w.indexOf(b), lewy = w[m - 1], prawy = w[m + 1];
        if (lewy && x < lewy.offsetLeft + lewy.offsetWidth / 2) przestawSasiada(lewy, b.nextSibling);
        else if (prawy && x + b.offsetWidth > prawy.offsetLeft + prawy.offsetWidth / 2) przestawSasiada(prawy, b);
        else break;
      }
    });
    function koniecCiagniecia(e) {
      if (!ciag.b || e.pointerId !== ciag.id) return;
      clearTimeout(ciag.zegar);
      const b = ciag.b, przerwane = e.type === 'pointercancel';
      ciag.b = null;
      if (!ciag.aktywne) return;
      ciag.aktywne = false;
      ciag.bylRuch = true;
      setTimeout(() => { ciag.bylRuch = false; }, 400);
      if (przerwane) rzad.ustaw(ciag.start, false);
      b.classList.remove('ciagniety');
      b.style.transition = RUCH;
      b.style.transform = '';
      const k = rzad.kolejnosc();
      if (!przerwane && k.join() !== ciag.start.join()) zmiana(ciag.start, k, b);
    }
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) rodzic.addEventListener(t, koniecCiagniecia);
    // Puszczenie po ciągnięciu nie jest stuknięciem: klik nie dochodzi do elementu (zakładka się nie zmienia, czat się nie otwiera).
    rodzic.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (!ciag.bylRuch || !b || !elementy.includes(b)) return;
      ciag.bylRuch = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    rodzic.addEventListener('contextmenu', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && elementy.includes(b)) e.preventDefault(); });
    // Alt+← → przestawia element z fokusem, to samo co przeciąganie.
    for (const b of elementy) {
      b.addEventListener('keydown', (e) => {
        if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
        e.preventDefault();
        const k = rzad.kolejnosc(), m = k.indexOf(o.id(b)), na = m + (e.key === 'ArrowRight' ? 1 : -1);
        if (widoczne().length < 2 || na < 0 || na >= k.length) return;
        const n = [...k];
        n.splice(m, 1);
        n.splice(na, 0, o.id(b));
        rzad.ustaw(n, false);
        b.focus();
        zmiana(k, n, b);
      });
    }
    return rzad;
  }
  // Na telefonie przytrzymanie należy do całej nawigacji (2 s przenoszą ją wyżej, „przenoszenie” niżej), więc zakładki i pigułki przestawia
  // tam ruch w bok, a przytrzymanie 450 ms tylko na szerokim ekranie, gdzie nawigacja stoi w miejscu.
  const ZAKLADKI = rzadPrzestawiany({ rodzic: pasekZakladek, elementy: segmenty, klucz: 'kolejnosc', id: (b) => WIDOKI[segmenty.indexOf(b)],
    nazwa: (b) => b.textContent.trim(), cofnij: 'Cofnij przestawienie zakładek', przytrzymanie: () => !waski.matches, podniesiony: () => przerwijPasek() });
  // Kolejność pigułek w pamięci pod identyfikatorem zakładki (do 25.10.2026 pod jej numerem, raz przepisana). Katalag ma od wieczora
  // 25.10.2026 nowy klucz, bo zmieniła się kolejność domyślna: Wszystkie marki na końcu.
  const KLUCZ_PIGULEK = { katalog: 'pigulki-kolejnosc-katalog', modele: 'pigulki-kolejnosc-katalag', kredyt: 'pigulki-kolejnosc-kredyt', poradnik: 'pigulki-kolejnosc-poradnik' };
  const RZEDY_PIGULEK = Object.fromEntries(Object.entries(grupyPigulek).map(([id, g]) => {
    const k = KLUCZ_PIGULEK[id];
    if (id === 'katalog' && pamiec.czytaj(k, null) === null) { const z = pamiec.czytaj('pigulki-kolejnosc-0', null); if (z !== null) pamiec.zapisz(k, z); }
    return [id, rzadPrzestawiany({ rodzic: g, elementy: [...g.querySelectorAll('[role="radio"]')], klucz: k, id: (b) => b.dataset.p,
      nazwa: (b) => b.textContent.trim().replace(/\s+/g, ' '), cofnij: 'Cofnij przestawienie pigułek', przytrzymanie: () => !waski.matches,
      podniesiony: () => przerwijPasek() })];
  }));
  segmenty.forEach((s, i) => {
    s.addEventListener('click', () => { if (i === widok) naPoczatek(); else pokazWidok(i, true); });
    // Strzałki bez Alt przełączają zakładkę, w kolejności z ekranu.
    s.addEventListener('keydown', (e) => {
      if (e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      const k = ZAKLADKI.kolejnosc().map((n) => WIDOKI.indexOf(n)), m = k.indexOf(i);
      const n = k[(m + (e.key === 'ArrowRight' ? 1 : -1) + k.length) % k.length];
      pokazWidok(n, true);
      segmenty[n].focus();
    });
  });

  // ---------------------------------------------------------------- logo i napis: Otomoto (napis od 22.10.2026, logo od 25.10.2026)
  // Jacek: „darujmy sobie Otomoto … hide this functionality under kasiomobile logo /easter egg/”. Od 25.10.2026 logo i napis otwierają
  // to samo małe menu z jedną pozycją, „Pomorskie, każda marka” (Jacek: „Wystarczyłoby … pomorska każda marka. A nie Toyota i Lexus,
  // cała Polska, bez sensu”), a Poradnik i Atlas mają swoje miejsca w zakładkach. Pozycję daje katalog w Ogłoszeniach (Skaner
  // Produktów od 0.4.27, wiadomość { skaner: 'wyszukiwania' }): te same wyszukiwania co skan, z zakresami z filtrów. Gdy katalogu
  // jeszcze nie było na ekranie, wczytuje się w tle, w swojej ramce. Adres otwiera ta strona, w stuknięciu w pozycję menu, więc idzie
  // do przeglądarki jak każdy odnośnik z ogłoszeń. Logo i napis dalej wyglądają jak logo i napis. Escape, stuknięcie obok, Tab i gest
  // wstecz zamykają menu.
  const napis = $('#napis'), logo = $('#logo');
  let menuOtomoto = null, zrodloMenu = napis;
  // Niespodzianka (od 26.10.2026, Jacek: kolorowe tło jako „Easter … przełącznik … pod samym” logo): przytrzymanie logo przez 0,6 s
  // włącza i wyłącza odcień barwy wybranej zakładki na całym ekranie, z krótkim drgnięciem. Stuknięcie dalej otwiera menu Otomoto,
  // a klik po przytrzymaniu niczego nie otwiera (słuchacz w fazie przechwytywania stoi przed tym od menu).
  // Do tego cichy dźwięk: dwie krótkie nuty (C6 i E6, sinus, głośność 5%), w górę przy włączeniu i w dół przy wyłączeniu. Kontekst dźwięku
  // rusza już przy dotknięciu, bo przeglądarki grają dopiero po geście; na iPhonie z wyciszonym dzwonkiem dźwięku nie ma.
  {
    let zegar = 0, przytrzymane = false, dzwiek = null;
    const stop = () => clearTimeout(zegar);
    const graj = (wl) => {
      try {
        const t = dzwiek.currentTime + 0.02;
        (wl ? [1046.5, 1318.5] : [1318.5, 1046.5]).forEach((f, i) => {
          const o = dzwiek.createOscillator(), g = dzwiek.createGain(), od = t + i * 0.09;
          o.type = 'sine';
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, od);
          g.gain.exponentialRampToValueAtTime(0.05, od + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, od + 0.16);
          o.connect(g).connect(dzwiek.destination);
          o.start(od);
          o.stop(od + 0.18);
        });
      } catch { /* bez dźwięku */ }
    };
    logo.addEventListener('pointerdown', () => {
      przytrzymane = false;
      clearTimeout(zegar);
      try { dzwiek = dzwiek || new (window.AudioContext || window.webkitAudioContext)(); if (dzwiek.state === 'suspended') dzwiek.resume(); } catch { dzwiek = null; }
      zegar = setTimeout(() => {
        przytrzymane = true;
        const wl = !document.body.classList.contains('kolorowo');
        document.body.classList.toggle('kolorowo', wl);
        ustawSiatke();
        logo.classList.remove('niespodzianka');
        void logo.offsetWidth;
        logo.classList.add('niespodzianka');
        if (dzwiek) graj(wl);
        if (navigator.vibrate) navigator.vibrate(12);
      }, 600);
    });
    logo.addEventListener('animationend', () => logo.classList.remove('niespodzianka'));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) logo.addEventListener(t, stop);
    logo.addEventListener('click', (e) => { if (przytrzymane) { przytrzymane = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    logo.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  const ZNAK_ZEWN = '<svg class="menu-otomoto-znak" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>';
  function zamknijMenuOtomoto(fokus) {
    if (!menuOtomoto) return;
    menuOtomoto.remove();
    menuOtomoto = null;
    for (const b of [napis, logo]) b.setAttribute('aria-expanded', 'false');
    if (fokus) zrodloMenu.focus();
  }
  // Katalog odpowiada, gdy już się zbudował (gotowe). Do tego czasu pytamy co 250 ms, najwyżej 3 sekundy.
  function pytajOWyszukiwania(okno) {
    return new Promise((ok) => {
      const id = Math.random().toString(36).slice(2);
      let proby = 0, zegar = 0;
      const koniec = (lista) => { clearInterval(zegar); removeEventListener('message', sluchaj); ok(lista); };
      const sluchaj = (e) => {
        const d = e.data;
        if (e.source !== okno || !d || d.skaner !== 'wyszukiwania' || d.id !== id || !d.gotowe) return;
        koniec((Array.isArray(d.lista) ? d.lista : []).filter((w) => w && typeof w.nazwa === 'string' && String(w.adres).startsWith('https://')));
      };
      addEventListener('message', sluchaj);
      const pytaj = () => {
        if (++proby > 12) { koniec([]); return; }
        try { okno.postMessage({ skaner: 'wyszukiwania', id }, '*'); } catch { /* ramka się przeładowuje */ }
      };
      pytaj();
      zegar = setInterval(pytaj, 250);
    });
  }
  // Marki z filtrów Ogłoszeń też idą do adresu (od 26.10.2026, Jacek w Fiszkach na pytanie, czy link ma iść za filtrami: „Tak, za
  // filtrami”). Zakresy (cena, rocznik, przebieg) dokłada sam Skaner, a marki bierzemy z jego zapamiętanych filtrów: sessionStorage
  // „we-filtry2:<misja>”, pole „marki” (ramka ma to samo pochodzenie i tę samą kartę co aplikacja). Dotyczy tylko wyszukiwań bez
  // własnych marek („Pomorskie, każda marka”), a bez wybranej marki adres zostaje taki, jaki dał Skaner. Marka idzie do adresu tak,
  // jak pisze ją Otomoto: małe litery bez ogonków, myślnik zamiast spacji (Škoda → skoda, Land Rover → land-rover, DS → ds-automobiles).
  function zMarkami(okno, w) {
    let marki = [];
    try {
      const s = okno.sessionStorage;
      for (let i = 0; i < s.length; i++) {
        if (!String(s.key(i)).startsWith('we-filtry2:')) continue;
        const m = JSON.parse(s.getItem(s.key(i)) || '{}').marki;
        if (Array.isArray(m)) marki = m.filter((x) => typeof x === 'string' && x.trim());
        break;
      }
    } catch { /* ramka bez dostępu: adres ze Skanera */ }
    let u;
    try { u = new URL(w.adres); } catch { return w; }
    if (!marki.length || [...u.searchParams.keys()].some((k) => k.startsWith('search[filter_enum_make]'))) return w;
    marki.forEach((m, i) => {
      const s = m.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      u.searchParams.set(`search[filter_enum_make][${i}]`, s === 'ds' ? 'ds-automobiles' : s);
    });
    const ktore = marki.length > 3 ? `${marki.slice(0, 3).join(', ')} i inne` : marki.length > 1 ? `${marki.slice(0, -1).join(', ')} i ${marki[marki.length - 1]}` : marki[0];
    return { nazwa: `${w.nazwa.replace(/,?\s*każda marka\s*$/i, '')}, ${ktore}`, adres: u.toString() };
  }
  async function otworzMenuOtomoto(zrodlo) {
    if (menuOtomoto) { zamknijMenuOtomoto(true); return; }
    zrodloMenu = zrodlo;
    const s = STRONY.katalog;
    if (!['blob', 'srcdoc'].includes(s.ramka.sposob) && !(await s.ramka.pokaz(s.plik, s.pusty))) return;
    const okno = s.el.contentWindow;
    const wszystkie = okno ? await pytajOWyszukiwania(okno) : [];
    const pomorskie = wszystkie.filter((w) => /^pomorskie/i.test(w.nazwa.trim()));
    const lista = (pomorskie.length ? pomorskie : wszystkie).map((w) => zMarkami(okno, w));
    if (!lista.length || menuOtomoto) return;
    menuOtomoto = el('div', { class: 'menu-otomoto', role: 'menu', 'aria-label': 'Otomoto' }, el('p', { class: 'menu-otomoto-tytul', 'aria-hidden': 'true', text: 'Otomoto' }));
    for (const w of lista) {
      const b = el('button', { type: 'button', role: 'menuitem' }, el('span', { class: 'menu-otomoto-nazwa', text: w.nazwa }));
      b.insertAdjacentHTML('beforeend', ZNAK_ZEWN);
      b.addEventListener('click', () => { zamknijMenuOtomoto(false); window.open(w.adres, '_blank', 'noopener'); });
      menuOtomoto.append(b);
    }
    document.body.append(menuOtomoto);
    const r = zrodlo.getBoundingClientRect(), m = menuOtomoto.getBoundingClientRect();
    menuOtomoto.style.left = Math.round(Math.max(8, Math.min(r.left, innerWidth - m.width - 8))) + 'px';
    menuOtomoto.style.top = Math.round(r.bottom + 6) + 'px';
    zrodlo.setAttribute('aria-expanded', 'true');
    menuOtomoto.querySelector('button').focus({ preventScroll: true });
  }
  napis.addEventListener('click', () => { otworzMenuOtomoto(napis); });
  logo.addEventListener('click', () => { otworzMenuOtomoto(logo); });
  document.addEventListener('keydown', (e) => {
    if (!menuOtomoto) return;
    const l = [...menuOtomoto.querySelectorAll('button')], i = l.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); zamknijMenuOtomoto(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); l[(i + 1) % l.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
    else if (e.key === 'Tab') zamknijMenuOtomoto(false);
  }, true);
  document.addEventListener('pointerdown', (e) => {
    if (menuOtomoto && !menuOtomoto.contains(e.target) && !napis.contains(e.target) && !logo.contains(e.target)) zamknijMenuOtomoto(false);
  }, true);
  addEventListener('blur', () => zamknijMenuOtomoto(false));

  // ---------------------------------------------------------------- Atlas wszystkich aut w Katalagu (od 25.10.2026)
  // Pigułki Marki i Modele pokazują Atlas Samochodów ze strony w sieci, w ramce (od 23 do 24.10.2026 w oknie pod logo). Z k=katalag
  // Atlas chowa swój rząd widoków, bo widok wybierają pigułki (umowa z rozmową Atlas Samochodów), a przełączenie Marki i Modele idzie
  // wiadomością { atlas: 'widok' }, bez przeładowania. Atlas mówi „atlas-gotowy”, gdy wstał. Bez internetu albo bez tej wiadomości
  // w 15 s stoi zdanie, a Atlas wczytuje się znowu po powrocie internetu albo przy następnym wyborze pigułki.
  const ATLAS = 'https://jackoludek.github.io/atlas-samochodow/?w=kasiomobile&k=katalag';
  const ramkaAtlasu = $('#ramka-atlasu'), pustyAtlas = $('#pusty-atlas');
  let atlasGotowy = false, zegarAtlasu = 0, atlasWidok = '', atlasWstecz = 0;
  function bezAtlasu(tekst) {
    clearTimeout(zegarAtlasu);
    ramkaAtlasu.removeAttribute('src');
    ramkaAtlasu.hidden = true;
    atlasGotowy = false;
    pustyAtlas.hidden = false;
    pustyAtlas.querySelector('.pusto-tekst').textContent = tekst;
  }
  function pokazAtlas(w) {
    if (ramkaAtlasu.getAttribute('src')) {
      if (w !== atlasWidok) {
        atlasWidok = w;
        try { ramkaAtlasu.contentWindow.postMessage({ atlas: 'widok', widok: w }, '*'); } catch { /* ramka się wczytuje */ }
      }
      return Promise.resolve(true);
    }
    if (!navigator.onLine) { bezAtlasu('Brak internetu. Atlas wczyta się sam, gdy internet wróci.'); return Promise.resolve(false); }
    atlasWidok = w;
    pustyAtlas.hidden = true;
    ramkaAtlasu.hidden = false;
    ramkaAtlasu.src = ATLAS + '&widok=' + encodeURIComponent(w);
    clearTimeout(zegarAtlasu);
    zegarAtlasu = setTimeout(() => { if (!atlasGotowy) bezAtlasu('Atlas się nie wczytał. Spróbuję jeszcze raz przy następnym wyborze.'); }, 15000);
    return Promise.resolve(true);
  }
  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || e.source !== ramkaAtlasu.contentWindow) return;
    if (d.kasiomobile === 'atlas-gotowy') { atlasGotowy = true; clearTimeout(zegarAtlasu); }
    // Atlas sam zmienił widok („Otwórz Modele” w Moim rankingu, „Pokaż modele ›” w Typach aut, Ctrl+Z): zaznaczamy pigułkę, bez echa.
    if (d.kasiomobile === 'atlas-widok' && (d.widok === 'marki' || d.widok === 'modele')) {
      atlasWidok = d.widok;
      if (wybrane[Z_ATLASEM] !== d.widok) { wybrane[Z_ATLASEM] = d.widok; pamiec.zapisz('pigulka-' + Z_ATLASEM, d.widok); oznaczPigulke(Z_ATLASEM, d.widok); }
    }
    // Wstecz w Atlasie, w którym nie ma nic do zamknięcia: Atlas odpisuje „zamknij-poradnik”, a Kasiomobile wraca na pierwszą pigułkę
    // (zwykle Podium). Sam Escape w Atlasie wysyła to samo, ale liczy się tylko zaraz po naszym Wstecz.
    if (d.kasiomobile === 'zamknij-poradnik' && Date.now() - atlasWstecz < 2000) { atlasWstecz = 0; zAtlasuWstecz(); }
  });
  // Wstecz z Atlasu: na pierwszą pigułkę zakładki, a gdy Atlas sam stoi na pierwszej (rząd przestawiony), na pierwszą zakładkę.
  function zAtlasuWstecz() {
    const pierwsza = RZEDY_PIGULEK[Z_ATLASEM].kolejnosc()[0];
    if (wybrane[Z_ATLASEM] !== pierwsza) { ustawPigulke(Z_ATLASEM, pierwsza, true, true); return; }
    pokazWidok(Math.max(0, WIDOKI.indexOf(ZAKLADKI.kolejnosc()[0])), true);
  }
  // ---------------------------------------------------------------- asystent (od 19.10.2026)
  // Czat z komputerem w domu (czat.js). „Ręce”: odpowiedź pokazuje zakładkę, a w Katalagu model albo Podium. Asystent zna zakładki
  // po dawnych nazwach: katalog (Ogłoszenia, Teraz), historia, modele (Katalag, Podium), kredyt (Finanse) i poradnik.
  // Mikrofon: Android i strona w sieci nagrywają same (Safari i Chrome pod https). Spod auta:// strona mikrofonu nie dostaje, więc
  // w aplikacji na iPhone'a nagrywa Aplikacja.swift (od 26.10.2026, klasa Glos), a strona daje jej klucz i ustawienia Soniox.
  // Pole w stronie w ramce ustawione tak, jakby wpisał je człowiek: wartość i zdarzenie input, na które strona już słucha (szukanie
  // w Ofertach, cena i okres w Finansach). Gdy ramka jeszcze się wczytuje, próbujemy raz po jej wczytaniu.
  function wpisz(ramka, sel, wartosc) {
    const zrob = () => {
      try {
        const e = ramka.contentDocument && ramka.contentDocument.querySelector(sel);
        if (!e) return false;
        e.value = String(wartosc);
        e.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      } catch { return false; }
    };
    if (!zrob()) ramka.addEventListener('load', () => setTimeout(zrob, 300), { once: true });
  }
  const mostGlosu = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.glos;
  const czat = window.Czat && KANAL ? Czat.uruchom({
    kanal: KANAL, tryb: 'arkusz', mikrofon: SKAD !== 'iPhone', skad: SKAD,
    // Rozmowa na telefonie kończy się nad nawigacją, więc zakładki zostają widać i działają (od 26.10.2026, Jacek: „brak jakiejkolwiek
    // nawigacji po tych czatach”). Na szerokim ekranie nawigacja stoi u góry, a rozmowa jest panelem z prawej.
    dol: () => { const d = $('.dol'); return innerWidth >= 760 || !d || !d.offsetHeight ? 0 : innerHeight - d.getBoundingClientRect().top; },
    naZmiane: (otwarty) => document.body.classList.toggle('czat-otwarty', otwarty),
    // Od powłoki 2 (Aplikacja.swift, window.KASIOMOBILE_POWLOKA, od 26.10.2026) mikrofon słucha od stuknięcia („nagrywaj”), zanim przyjdzie klucz.
    glosNatywny: mostGlosu ? { start: (klucz, konfiguracja) => mostGlosu.postMessage({ co: 'start', klucz, konfiguracja }),
      stop: (zaraz) => mostGlosu.postMessage({ co: 'stop', zaraz: Boolean(zaraz) }),
      wczesnie: (Number(window.KASIOMOBILE_POWLOKA) || 1) >= 2, nagrywaj: () => mostGlosu.postMessage({ co: 'nagrywaj' }) } : null,
    zakladka: () => { const k = klucz(widok); return k === 'atlas' ? 'modele' : k; },
    // Ręce asystenta (od 26.10.2026 także porównanie, rata w Finansach, szukanie w Ofertach i rozdział poradnika; Jacek: „On musi też być
    // w stanie obsługiwać tę aplikację. Mieć ręce i nogi”).
    async pokaz(p) {
      const z = p.zakladka === 'nowe' ? 'katalog' : p.zakladka;
      if (z === 'katalog' || z === 'historia') {
        await ustawPigulke('katalog', z === 'historia' ? 'historia' : 'teraz', true, false);
        await pokazWidok(nrZakladki('katalog'), true);
        if (p.szukaj && z === 'katalog') wpisz(STRONY.katalog.el, 'input[type="search"]', p.szukaj);
      } else if (z === 'modele') {
        if (PIGULKI.modele) await ustawPigulke('modele', 'podium', true, false);
        await pokazWidok(nrZakladki('modele'), true);
        if (p.model || p.podium || p.porownaj) STRONY.modele.el.contentWindow.postMessage({ auta: 'pokaz', model: p.model || null, podium: p.podium || null, porownaj: p.porownaj || null }, '*');
      } else if (z === 'kredyt') {
        if (p.finanse && jestPigulka('kredyt', p.finanse.czesc)) await ustawPigulke('kredyt', p.finanse.czesc, true, false);
        await pokazWidok(nrZakladki('kredyt'), true);
        if (p.finanse) { wpisz(STRONY.kredyt.el, '#cena', p.finanse.cena); wpisz(STRONY.kredyt.el, '#okres', p.finanse.okres); }
      } else if (z === 'poradnik') {
        if (p.rozdzial) await ustawPigulke('poradnik', 'calosc', true, false);
        await pokazWidok(nrZakladki('poradnik'), true);
        if (p.rozdzial) {
          ustawPoradnik(false);
          setTimeout(() => { try { const c = STRONY.poradnik.el.contentDocument.getElementById(p.rozdzial); if (c) c.scrollIntoView({ block: 'start' }); } catch { /* strona się wczytuje */ } }, 150);
        }
      }
    },
  }) : null;
  const przyciskCzatu = $('#czat-otworz');
  if (czat) { Czat.dymek(przyciskCzatu); przyciskCzatu.addEventListener('click', () => czat.otworz()); } else przyciskCzatu.hidden = true;
  // Zakładka albo pigułka stuknięta przy otwartej rozmowie zamyka rozmowę, a potem jej własne kliknięcie pokazuje stronę
  // (faza przechwytywania, więc najpierw to).
  if (czat) $('.dol').addEventListener('click', (e) => { if (czat.otwarty() && e.target.closest('[role="tab"], [role="radio"]')) czat.zamknij(); }, true);
  // Wstecz (gest od lewej krawędzi w Aplikacja.swift, przycisk Wstecz na Androidzie): najpierw menu i czat, potem okno w stronie
  // (szczegóły auta, filtry, galeria), w Atlasie najpierw to, co otwarte w Atlasie, w całości powrót do skrótu, a na drugiej pigułce
  // powrót do pierwszej (Historia do Teraz, Marki do Podium, Kredyt do Leasingu). Dopiero potem Wstecz wychodzi z aplikacji. Atlas
  // odpowiada dopiero po chwili, więc gdy stoi na pierwszej pigułce rzędu, Wstecz idzie na pierwszą zakładkę.
  function wstecz() {
    if (menuOtomoto) { zamknijMenuOtomoto(true); return true; }
    if (czat && czat.otwarty()) return czat.wstecz();
    const k = klucz(widok);
    if (k === 'atlas') {
      if (atlasGotowy) { atlasWstecz = Date.now(); ramkaAtlasu.contentWindow.postMessage({ atlas: 'wstecz' }, '*'); }
      else zAtlasuWstecz();
      return true;
    }
    try {
      const d = STRONY[k].el.contentDocument.querySelector('dialog[open]');
      if (d) { d.close(); return true; }
    } catch { /* strona się jeszcze wczytuje */ }
    // Po „Pokaż …” z rozmowy Wstecz wraca do rozmowy (od 26.10.2026, Jacek: „Do tyłu nie działa”), najwyżej 10 minut po przejściu.
    if (czat && czat.wrocDoRozmowy()) return true;
    if (doSkrotu(k)) return true;
    const id = ID_ZAKLADEK[widok];
    if (PIGULKI[id]) {
      const pierwsza = RZEDY_PIGULEK[id].kolejnosc()[0];
      if (wybrane[id] !== pierwsza) { ustawPigulke(id, pierwsza, true, true); return true; }
    }
    return false;
  }
  // ---------------------------------------------------------------- odświeżanie
  // Przy każdym otwarciu aplikacji: najpierw to, co komputer już przysłał, potem (katalog starszy niż 10 minut
  // albo powrót internetu) prośba o skan i czekanie na nowy katalog, najwyżej 6 minut, co 10 sekund.
  let trwa = null, czekanie = null, prosba = false;
  const opis = (r) => {
    if (r.status === 'rejected') return 'błąd: ' + ((r.reason && r.reason.message) || r.reason);
    return r.value ? 'nowy' : 'bez zmian';
  };
  async function czekajNaKomputer() {
    let od = 0;
    try { od = await poprosOSkan(); } catch { return 'bez sieci'; }
    let doszedl = false;
    const koniec = Date.now() + CZEKAM_MS;
    while (Date.now() < koniec) {
      await pauza(10000);
      try { await KATALOG.sprawdz(); } catch { /* następna próba za 10 sekund */ }
      // Katalog nowszy niż prośba: komputer skończył.
      if (KATALOG.czas() >= od) { doszedl = true; break; }
    }
    await Promise.allSettled([KALKULATOR.sprawdz(), HISTORIA.sprawdz(), MODELE.sprawdz(), PORADNIK.sprawdz()]);
    await pokazStrone(widok);
    return doszedl ? 'nowy katalog' : 'komputer nie odpowiedział';
  }
  function odswiez(recznie = false) {
    if (!KANAL) return Promise.resolve({ blad: 'brak kanału' }); // strona z sieci otwarta bez linku od Jacka
    if (czekanie) return trwa || czekanie; // komputer już sprawdza na naszą prośbę
    if (recznie) prosba = true;
    if (trwa) return trwa;
    pobieram = true;
    pokazStrone(widok);
    trwa = (async () => {
      const [k, c, h, md, pr] = await Promise.allSettled([KATALOG.sprawdz(), KALKULATOR.sprawdz(), HISTORIA.sprawdz(), MODELE.sprawdz(), PORADNIK.sprawdz()]);
      pobieram = false;
      bezSieci = k.status === 'rejected';
      await pokazStrone(widok);
      const wynik = { katalog: opis(k), kalkulator: opis(c), historia: opis(h), modele: opis(md), poradnik: opis(pr) };
      if (!bezSieci && (prosba || Date.now() - KATALOG.czas() * 1000 > SWIEZE)) {
        prosba = false;
        wynik.prosba = 'wysłana';
        czekanie = czekajNaKomputer().finally(() => { czekanie = null; });
      } else {
        prosba = false;
      }
      return wynik;
    })().finally(() => { trwa = null; pobieram = false; });
    return trwa;
  }
  // Bez przycisku (od 24.10.2026): dane przychodzą same przy otwarciu, co minutę i zaraz po powrocie internetu.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) odswiez(); });
  addEventListener('online', () => { odswiez(); if (klucz(widok) === 'atlas') pokazStrone(widok); });
  // Póki aplikacja jest na ekranie, co minutę sprawdza, czy komputer przysłał nowe ogłoszenia (od 20.10.2026: e-mail z Otomoto
  // robi skan od razu, a nowe auto ma być w aplikacji od razu). Bez prośby o skan, więc komputer nie pracuje przez to więcej.
  const TEST = /[?&]test=\d/.test(location.search);
  setInterval(async () => {
    if (document.hidden || !KANAL || TEST || trwa || czekanie) return;
    try { if (await KATALOG.sprawdz()) await pokazStrone(widok); } catch { /* następna próba za minutę */ }
  }, 60000);

  // ---------------------------------------------------------------- nawigacja na telefonie: pas na dole i przenoszenie
  // Od 25.10.2026 wieczorem nawigacja na telefonie to zwykły pas na dole, w układzie, bez szkła (styl.css, „Nawigacja na telefonie”), więc
  // treść kończy się nad nim i strony w ramkach nie potrzebują już miejsca pod sobą (--km-dol zostaje 0). Przenoszenie (Jacek: „przykleja
  // do standardowej pozycji. Powinniśmy być w stanie przesunąć to o 1 piksel w jedną lub w drugą stronę. Koniecznie”): przytrzymanie
  // zakładki albo pigułki przez 2 s podnosi pas, który jedzie za palcem w górę albo w dół co do piksela i zostaje tam, gdzie go puścić,
  // bez przyciągania do zwykłego miejsca. Najniżej 4 px nad krawędzią ekranu (na iPhonie nad wskaźnikiem ekranu głównego), najwyżej
  // górnym brzegiem w połowie ekranu, bo wyżej treść zrobiłaby się za niska. Od 0,25 s przytrzymania nad pasem wypełnia się od lewej do
  // prawej pasek postępu ze strzałkami w górę i w dół (Jacek: strzałki „muszą być widoczne … w dół i w górę”, a zapalanie po kolei „nie
  // jest oczywiste”). Ruch o ponad 10 px przed czasem przerywa przytrzymanie, a ruch w bok przestawia zakładki i pigułki jak zawsze.
  // Miejsce zostaje w telefonie (pasek-wysokosc: piksele nad zwykłym miejscem, ujemne pod nim), przez 6 s stoi „Cofnij” (paruje jak szkło), a Ctrl+Z
  // i Ctrl+Y cofają i ponawiają. Z klawiatury Alt+↑ i Alt+↓ na zakładce albo pigułce przesuwają o 1 px.
  const dol = $('.dol'), waski = matchMedia('(max-width: 759px)');
  const PRZENIES_MS = 2000, POSTEP_MS = 250, PROG_PASKA = 10, KROK = 1, RUCH_PASKA = { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' };
  const pasek = { id: null, x: 0, y: 0, zegar: 0, postep: 0, niesie: false, start: 0, min: 0, max: 0, teraz: null, bylRuch: false };
  let wysokosc = 0;
  // Pasek postępu: strzałka w górę, tor, który wypełnia się od 0,25 do 2 s przytrzymania, i strzałka w dół.
  const postep = el('div', { class: 'postep-paska', 'aria-hidden': 'true' });
  postep.append(el('i', { class: 'w-gore' }), el('span'), el('i', { class: 'w-dol' }));
  postep.style.setProperty('--czas', (PRZENIES_MS - POSTEP_MS) + 'ms');
  dol.append(postep);
  // Granice w pikselach względem zwykłego miejsca. Dół z miarki (styl.css: zwykły i najmniejszy odstęp pod pasem), góra z połowy ekranu,
  // liczona bez przesunięcia z ręki (transform).
  const miarkaDolu = el('div', { class: 'miarka-dolu', 'aria-hidden': 'true' });
  document.body.append(miarkaDolu);
  const najnizej = () => { const s = getComputedStyle(miarkaDolu); return Math.min(0, Math.round(parseFloat(s.paddingBottom) - parseFloat(s.paddingTop))) || 0; };
  const najwyzej = () => Math.max(0, Math.floor(dol.getBoundingClientRect().top + wysokosc - innerHeight / 2));
  // Nowe miejsce względem zwykłego. p0 to górny brzeg pasa na ekranie przed zmianą: pas dojeżdża stamtąd (240 ms).
  function ustawWysokosc(w, zapisz, ruch, p0 = dol.getBoundingClientRect().top) {
    const nowa = Math.max(najnizej(), Math.min(Math.round(Number(w) || 0), najwyzej()));
    if (zapisz) pamiec.zapisz('pasek-wysokosc', nowa);
    const byla = wysokosc;
    wysokosc = nowa;
    document.documentElement.style.setProperty('--km-nav-y', nowa + 'px');
    const p1 = dol.getBoundingClientRect().top;
    if (ruch && !malyRuch.matches && dol.animate && Math.abs(p0 - p1) > 1) dol.animate([{ transform: `translateY(${p0 - p1}px)` }, { transform: 'none' }], RUCH_PASKA);
    return nowa !== byla;
  }
  const RZAD_PASKA = { cofnij: 'Cofnij przeniesienie nawigacji', ustaw: (k) => ustawWysokosc(k[0], true, true) };
  function zmianaPaska(przed, po) {
    PRZESTAWIENIA.wstecz.push({ rzad: RZAD_PASKA, przed: [przed], po: [po] });
    if (PRZESTAWIENIA.wstecz.length > 50) PRZESTAWIENIA.wstecz.shift();
    PRZESTAWIENIA.naprzod.length = 0;
    pokazCofnij(RZAD_PASKA);
    powiedz(po > 0 ? 'Nawigacja wyżej' : po < 0 ? 'Nawigacja niżej' : 'Nawigacja na swoim miejscu');
  }
  // Przytrzymanie przerwane (ruch, puszczenie, przestawianie zakładki albo pigułki): pasek postępu gaśnie, nawigacja zostaje na miejscu.
  function przerwijPasek() {
    clearTimeout(pasek.zegar);
    clearTimeout(pasek.postep);
    dol.classList.remove('trzyma');
    if (!pasek.niesie) pasek.id = null;
  }
  function podniesPasek() {
    clearTimeout(pasek.postep);
    dol.classList.remove('trzyma');
    ZAKLADKI.przerwij();
    for (const r of Object.values(RZEDY_PIGULEK)) r.przerwij();
    for (const d of document.querySelectorAll('.czat-dymek')) d.remove();
    Object.assign(pasek, { niesie: true, start: wysokosc, min: najnizej(), max: najwyzej(), teraz: wysokosc });
    // Pas bierze wskaźnik od zakładki albo pigułki: dalszy ruch i puszczenie należą do niego, a przycisk nie dostaje stuknięcia.
    try { dol.setPointerCapture(pasek.id); } catch { /* wskaźnik z testu */ }
    dol.classList.add('przenoszony');
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch { /* bez wibracji */ } }
    powiedz('Nawigacja podniesiona. Przesuń ją wyżej albo niżej.');
  }
  function niesPasek(y) {
    pasek.teraz = Math.max(pasek.min, Math.min(pasek.start + pasek.y - y, pasek.max));
    dol.style.transform = `translateY(${Math.round(pasek.start - pasek.teraz)}px)`;
  }
  function puscPasek(e) {
    if (e.pointerId !== pasek.id || (e.type === 'lostpointercapture' && e.target !== dol)) return;
    clearTimeout(pasek.zegar);
    clearTimeout(pasek.postep);
    dol.classList.remove('trzyma');
    pasek.id = null;
    if (!pasek.niesie) return;
    pasek.niesie = false;
    pasek.bylRuch = true;
    setTimeout(() => { pasek.bylRuch = false; }, 400);
    const przerwane = e.type === 'pointercancel';
    // Pas dojeżdża spod palca na swoje nowe miejsce, co do piksela.
    const p0 = dol.getBoundingClientRect().top;
    dol.style.transform = '';
    dol.classList.remove('przenoszony');
    ustawWysokosc(przerwane ? pasek.start : pasek.teraz, true, true, p0);
    if (!przerwane && wysokosc !== pasek.start) zmianaPaska(pasek.start, wysokosc);
  }
  dol.addEventListener('pointerdown', (e) => {
    if (!waski.matches || pasek.id !== null || (e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('.cofnij-zakladki')) return;
    Object.assign(pasek, { id: e.pointerId, x: e.clientX, y: e.clientY, niesie: false });
    // Zakładkę i pigułkę trzyma jej rząd (przestawianie), resztę pasa bierze sam pas.
    if (!e.target.closest('[role="tab"], [role="radio"]')) { try { dol.setPointerCapture(e.pointerId); } catch { /* wskaźnik z testu */ } }
    pasek.postep = setTimeout(() => dol.classList.add('trzyma'), POSTEP_MS);
    pasek.zegar = setTimeout(podniesPasek, PRZENIES_MS);
  });
  dol.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pasek.id) return;
    if (pasek.niesie) { e.preventDefault(); niesPasek(e.clientY); return; }
    if (Math.abs(e.clientX - pasek.x) > PROG_PASKA || Math.abs(e.clientY - pasek.y) > PROG_PASKA) przerwijPasek();
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) dol.addEventListener(t, puscPasek);
  // Puszczenie po przeniesieniu nie jest stuknięciem, a przytrzymanie nie otwiera menu.
  dol.addEventListener('click', (e) => { if (!pasek.bylRuch) return; pasek.bylRuch = false; e.preventDefault(); e.stopImmediatePropagation(); }, true);
  dol.addEventListener('contextmenu', (e) => { if (waski.matches) e.preventDefault(); });
  for (const b of [...segmenty, ...Object.values(grupyPigulek).flatMap((g) => [...g.querySelectorAll('[role="radio"]')])]) {
    b.addEventListener('keydown', (e) => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !waski.matches) return;
      e.preventDefault();
      const przed = wysokosc;
      if (!ustawWysokosc(wysokosc + (e.key === 'ArrowUp' ? KROK : -KROK), true, true)) return;
      b.focus();
      zmianaPaska(przed, wysokosc);
    });
  }
  waski.addEventListener('change', () => ustawWysokosc(pamiec.czytaj('pasek-wysokosc', 0), false, false));

  // ---------------------------------------------------------------- start
  const naStarcie = Promise.all([schowek.czytaj('katalog'), schowek.czytaj('kalkulator'), schowek.czytaj('historia'), schowek.czytaj('modele')])
    .then(([k, c, h, md]) => ({ katalog: Boolean(k), kalkulator: Boolean(c), historia: Boolean(h), modele: Boolean(md) }));
  // Ostatnia zakładka i pigułki nazwą. Dawne „Nowe” (do 19.10.2026) i brak zapisu dają Ogłoszenia, a dawna zakładka „Historia”
  // (do 24.10.2026) Ogłoszenia z pigułką Historia.
  const zapisana = pamiec.czytaj('zakladka', null);
  if (zapisana === 'Historia' && pamiec.czytaj('pigulka-katalog', null) === null && pamiec.czytaj('pigulka-0', null) === null) { wybrane.katalog = 'historia'; pamiec.zapisz('pigulka-katalog', 'historia'); }
  // Podium, Historia, Finanse i Poradnik zaczynają każde otwarcie aplikacji od skrótu (reguła skrot-i-wersja-pelna).
  try {
    localStorage.setItem('modele:widok', '"skrot"');
    localStorage.setItem('historia:widok', '"skrot"');
    localStorage.setItem('kredyt-na-auto-widok', 'skrot');
    sessionStorage.removeItem('poradnik-calosc');
  } catch { /* bez pamięci */ }
  wybrane.poradnik = 'skrot';
  Object.keys(PIGULKI).forEach((id) => oznaczPigulke(id, wybrane[id]));
  ustawWysokosc(pamiec.czytaj('pasek-wysokosc', 0), false, false);
  pokazWidok(Math.max(0, WIDOKI.indexOf(zapisana)), false);
  const pierwsze = KANAL ? naStarcie.then(() => odswiez()) : Promise.resolve({ blad: 'brak kanału' });

  window.Auta = {
    naStarcie, pierwsze, odswiez, pokazWidok, wstecz, czat,
    pokazPigulke: (z, p) => ustawPigulke(typeof z === 'number' ? ID_ZAKLADEK[z] : z, p, true, false),
    pasek: (w) => (w === undefined ? wysokosc : ustawWysokosc(w, true, true)),
    czekanie: () => czekanie,
    stan: () => ({
      katalogCzas: KATALOG.czas(), kalkulatorCzas: KALKULATOR.czas(), historiaCzas: HISTORIA.czas(), modeleCzas: MODELE.czas(), poradnikCzas: PORADNIK.czas(),
      schowek: schowek.rodzaj, ramkaKatalogu: STRONY.katalog.ramka.sposob, ramkaModeli: STRONY.modele.ramka.sposob,
      ramkaKredytu: STRONY.kredyt.ramka.sposob, ramkaHistorii: STRONY.historia.ramka.sposob, ramkaPoradnika: STRONY.poradnik.ramka.sposob,
      widok, nazwa: NAZWY[widok], zakladki: ID_ZAKLADEK.join(','), pasek: wysokosc,
      pigulki: Object.entries(wybrane).map(([z, p]) => z + ':' + p).join(','),
      atlas: atlasGotowy ? 'gotowy' : ramkaAtlasu.getAttribute('src') ? 'wczytuje się' : 'nie ma',
    }),
  };
  if (/[?&]test=\d/.test(location.search)) document.head.append(el('script', { src: 'test.js' }));
})();