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
//                  otwarta aplikacja co minutę bierze nowy katalog, a po powrocie internetu pobiera wszystko. Ściąga „i” z ukrytymi gestami
//                  przychodzi dopiero trzeciego dnia używania (Jacek, 24.10.2026: „tak prosto, że nie będzie potrzeba ściągi”, 29.10.2026:
//                  „trzeciego dnia to się pojawi”; część „ściąga” niżej).
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

  // Plik spakowany gzipem (od 29.10.2026 pełny katalog: z benzyną ma ponad 2 MB, a tyle najwyżej przyjmuje ntfy.sh) poznajemy po bajtach 1F 8B
  // i rozpakowujemy w telefonie. Zwykły plik HTML idzie jak dotąd.
  async function tekstPliku(r) {
    const b = new Uint8Array(await r.arrayBuffer());
    if (b[0] === 0x1f && b[1] === 0x8b) {
      if (typeof DecompressionStream !== 'function') throw new Error('ta przeglądarka nie rozpakuje pliku');
      return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }
    return new TextDecoder().decode(b);
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
        const tekst = await tekstPliku(r);
        if (!tekst.trim()) throw new Error('pusty plik ' + nazwa);
        await schowek.zapisz(nazwa, tekst);
        pamiec.zapisz(nazwa + '-czas', z.time);
        pamiec.zapisz(nazwa + '-od', ostatni);
        return true;
      },
    };
    return p;
  }
  // Katalog w dwóch postaciach (od 29.10.2026, katalog-dla-kasiomobile.js w misji): „-katalog” to same hybrydy z automatem, zwykły HTML, dla starszych wersji
  // (strona w sieci), a „-katalog-pelny” cały katalog z benzyną i manualem, w gzip. Ta wersja bierze pełny, gdy go ma i nie jest starszy od hybryd (pełny
  // idzie przy każdym skanie, hybrydy rzadziej), a bez niego albo bez rozpakowywania w przeglądarce hybrydy. Czas to nowszy z obu, więc „katalog nowszy niż
  // prośba” działa jak dotąd. Testy wpisują do schowka sam „katalog”.
  const KATALOG = (() => {
    const h = plik('katalog'), p = typeof DecompressionStream === 'function' ? plik('katalog-pelny') : null;
    const pelny = () => Boolean(p && p.czas() && p.czas() >= h.czas() - 300);
    return {
      czas: () => (pelny() ? p.czas() : h.czas()),
      async tresc() { if (pelny()) { const t = await p.tresc(); if (t) return t; } return h.tresc(); },
      async sprawdz() {
        const [a, b] = await Promise.allSettled([h.sprawdz(), p ? p.sprawdz() : Promise.resolve(false)]);
        if (a.status === 'rejected' && (!p || b.status === 'rejected')) throw a.reason;
        return (a.status === 'fulfilled' && a.value) || (b.status === 'fulfilled' && b.value);
      },
    };
  })();
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
  // jej obraz tła (strzałka listy wyboru), a światło niesie wtedy sam brzeg z cieniem. Bez rozmycia tła (28.10.2026, płynne przewijanie): przyciski stoją
  // na nieprzezroczystych stronach, więc rozmycia i tak nie było widać, a liczyło się w każdej klatce przewijania.
  const GUZIK = (s, { tlo = 'rgba(255,255,255,.62)', tloC = 'rgba(44,44,46,.6)', obraz = true } = {}) => {
    const lico = obraz ? `background-image:${SW.lico}!important;background-size:100% 100%!important;background-repeat:no-repeat!important;` : '';
    return `${s}{background-color:${tlo}!important;${lico}`
      + `border-color:transparent!important;box-shadow:${SW.brzeg},${SW.cien}!important;${SW.ruch}}`
      + `${s}:active{${SW.wcisk}${obraz ? `;background-image:${SW.plama},${SW.lico}!important` : ''}}`
      + `@media (prefers-color-scheme:dark){${s}{background-color:${tloC}!important;${obraz ? `background-image:${SW.licoC}!important;` : ''}box-shadow:${SW.brzegC},${SW.cienC}!important}`
      + (obraz ? `${s}:active{background-image:${SW.plamaC},${SW.licoC}!important}` : '') + '}';
  };
  // Wypełniony przycisk (wybrany albo główny, jeden selektor): barwa zostaje ze strony, dochodzą blask, brzeg i cień w tej barwie.
  const GUZIK_PELNY = (s, barwa) => `${s}{background-image:${SW.licoB}!important;background-size:100% 100%!important;background-repeat:no-repeat!important;animation:none!important;`
    + `box-shadow:${SW.brzegB},1px 1px 2px rgba(0,0,0,.16),3px 3px 10px color-mix(in srgb,${barwa} 42%,transparent)!important;${SW.ruch}}`
    + `${s}:active{${SW.wcisk}}@media (prefers-color-scheme:dark){${s}{box-shadow:${SW.brzegB},0 0 0 .5px rgba(255,255,255,.2)!important}}`;
  // Okresy kredytu 48–96 miesięcy to koła (28.10.2026, Jacek: „jajka, a w nich są kółka … Muszą być albo kółka, albo jajka”). Kalkulator robił przerwę między nimi
  // przezroczystym brzegiem (background-clip), a cień szkła stał wokół brzegu, więc pod jaśniejszym kołem leżała większa pigułka. Teraz każdy okres to jedno koło
  // 48 px (mniejsze, gdy rząd jest węższy), na środku swojej piątej części rzędu. Cyfry stoją na środku koła: zmierzone 0,17 px od środka w 3× (telefon) i 0,38 px w 1×.
  const OKRESY_KOLA = '#chipy-okres{gap:0!important;margin-inline:0!important;justify-content:space-around!important}'
    + '#chipy-okres button{flex:0 0 auto!important;width:min(48px,calc((100% - 32px) / 5))!important;height:auto!important;min-height:0!important;aspect-ratio:1;padding:0!important;'
    + 'border:0!important;border-radius:50%!important;background-clip:border-box!important;filter:none!important;display:grid!important;place-items:center;line-height:1!important}';
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
  // Kółko asystenta przygasa, gdy ktoś przewija stronę, i wraca 0,7 s po końcu przewijania (28.10.2026, ocena według zasad Ramsa, punkt 5 „Dyskretne”:
  // kółko leżało na treści, na przykład na rogu zdjęcia oferty). Raz na dokument ramki.
  const ciszaKolka = (d) => {
    if (!d || d.kmKolko) return;
    d.kmKolko = true;
    let z = 0;
    d.addEventListener('scroll', () => {
      const k = document.querySelector('.czat-plywak');
      if (!k) return;
      k.classList.add('przewija');
      clearTimeout(z);
      z = setTimeout(() => k.classList.remove('przewija'), 700);
    }, { capture: true, passive: true });
  };
  // Przesunięcie w bok w oknie auta (28.10.2026; Jacek: „Swipe w lewo powinien przejść do kolejnego samochodu na liście. Swipe w prawo do poprzedniego … jak już
  // jesteśmy na pierwszym … wrócimy do głównego menu”): okno idzie za palcem, a puszczone po 72 px (albo po szybkim ruchu) otwiera sąsiednie auto w kolejności
  // z ekranu. Z pierwszego auta w prawo zamyka okno jak krzyżyk, z ostatniego w lewo odbija. Pion przewija okno jak dotąd, a pasek miniatur zdjęć przewija się
  // po swojemu. Na komputerze to samo dają strzałki ← i →. Okno przesuwa właściwość translate, więc własne położenie okna ze Skanera zostaje. Raz na dokument.
  const przesuwanieAut = (d) => {
    if (!d || d.kmAuta) return;
    d.kmAuta = true;
    const cicho = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    let biezaca = null, t = null;
    d.addEventListener('click', (e) => { const k = e.target.closest && e.target.closest('.karta-produktu'); if (k) biezaca = k; }, true);
    const karty = () => [...d.querySelectorAll('.karta-produktu')].filter((k) => k.offsetParent !== null);
    const okno = () => d.querySelector('dialog#okno[open]');
    // Płynnie (28.10.2026, Jacek: „Powinno być płynne … Naturalne”): okno jedzie pod palcem jeden do jednego, a puszczone odjeżdża w tę samą stronę z prędkością palca.
    // Następne auto wjeżdża z drugiej strony dopiero wtedy, gdy jego treść jest gotowa, a okno przez cały czas zostaje otwarte (do 28.10.2026 zamykało się
    // i otwierało od nowa, więc na chwilę mignęła lista). Za ostatnim autem palec czuje opór i okno wraca sprężyście.
    const W = (el0) => el0.getBoundingClientRect().width || innerWidth;
    const czas = (droga, v) => Math.round(Math.min(240, Math.max(120, Math.abs(droga) / Math.max(1.6, Math.abs(v)))));
    const WYJAZD = 'cubic-bezier(.3, 0, .8, .45)', WJAZD = 'cubic-bezier(.16, .84, .3, 1)', SPREZYNA = 'cubic-bezier(.3, 1.35, .5, 1)';
    const ktore = (dl, l) => {
      let i = l.indexOf(biezaca);
      if (i < 0) { const tyt = ((dl.querySelector('#okno-tytul') || {}).textContent || '').trim(); i = l.findIndex((k) => ((k.querySelector('.tytul') || {}).textContent || '').trim() === tyt); }
      return i;
    };
    const zamknijOkno = (dl) => { const z = dl.querySelector('.okno-przyciski button[aria-label="Zamknij okno"]'); if (z) z.click(); else dl.close(); };
    const klik = (k) => (k.querySelector('.kafel-glowny') || k).click();
    const odbij = (dl, od = 0, op = 1) => {
      if (!dl.animate || cicho()) return;
      if (Math.abs(od) < 2) dl.animate([{ translate: '0 0' }, { translate: '-16px 0' }, { translate: '0 0' }], { duration: 260, easing: 'ease-out' });
      else dl.animate([{ translate: `${od}px 0`, opacity: op }, { translate: '0 0', opacity: 1 }], { duration: 360, easing: SPREZYNA });
    };
    function idz(kier, dl, od = 0, v = 0, op = 1) {
      const l = karty(), i = ktore(dl, l), w = W(dl), ruch = Boolean(dl.animate) && !cicho();
      if (kier < 0 && i <= 0) {
        if (!ruch) { zamknijOkno(dl); return; }
        const a = dl.animate([{ translate: `${od}px 0`, opacity: op }, { translate: `${w}px 0`, opacity: 0 }], { duration: czas(w - od, v), easing: WYJAZD, fill: 'forwards' });
        a.onfinish = () => { zamknijOkno(dl); a.cancel(); };
        return;
      }
      const cel = l[i + kier];
      if (!cel) { odbij(dl, od, op); return; }
      const wyj = ruch ? dl.animate([{ translate: `${od}px 0`, opacity: op }, { translate: `${-kier * w * 0.55}px 0`, opacity: 0 }],
        { duration: czas(w * 0.55 - Math.abs(od), v), easing: WYJAZD, fill: 'forwards' }) : null;
      const dalej = () => {
        let gotowe = false;
        const wjedz = () => {
          if (gotowe) return;
          gotowe = true;
          obs.disconnect();
          clearTimeout(zegar);
          const n = okno() || dl;
          if (ruch) n.animate([{ translate: `${kier * w * 0.4}px 0`, opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 320, easing: WJAZD });
          if (wyj) wyj.cancel();
        };
        const obs = new MutationObserver(wjedz);
        obs.observe(dl, { childList: true });
        // Zapas: gdyby treść nie przyszła (okno nie przyjęło stuknięcia), okno otwiera się po staremu, od nowa.
        const zegar = setTimeout(() => { if (gotowe) return; gotowe = true; obs.disconnect(); if (wyj) wyj.cancel(); zamknijOkno(dl); klik(cel); }, 900);
        klik(cel);
      };
      if (wyj) wyj.onfinish = dalej; else dalej();
    }
    // Zdjęcia w oknie auta: palec na dużym zdjęciu przesuwa zdjęcia jak w Zdjęciach na iPhonie (zdjęcie jedzie pod palcem, puszczone przechodzi do następnego),
    // a palec poza zdjęciem przesuwa auta. Na pierwszym i ostatnim zdjęciu opór i powrót.
    function zdjecie(s, przerwane) {
      const img = s.fot.querySelector('img'), n = s.min.length, i = s.min.findIndex((b) => b.getAttribute('aria-current') === 'true');
      const kier = s.dx < 0 ? 1 : -1, j = i + kier, w = W(s.fot);
      const idzie = !przerwane && j >= 0 && j < n && (Math.abs(s.dx) >= 48 || (Math.abs(s.v) > 0.45 && Math.sign(s.v) === Math.sign(s.dx) && Math.abs(s.dx) > 16));
      if (!img) return;
      img.style.translate = '';
      if (!idzie) { if (img.animate && !cicho()) img.animate([{ translate: `${s.dx}px 0` }, { translate: '0 0' }], { duration: 360, easing: SPREZYNA }); return; }
      const pokaz = () => {
        s.min[j].click();
        const nowy = s.fot.querySelector('img'), pas = s.min[j].parentElement;
        if (nowy && nowy.animate && !cicho()) nowy.animate([{ translate: `${kier * w * 0.5}px 0`, opacity: 0.2 }, { translate: '0 0', opacity: 1 }], { duration: 300, easing: WJAZD });
        if (pas) pas.scrollTo({ left: s.min[j].offsetLeft - (pas.clientWidth - s.min[j].offsetWidth) / 2, behavior: cicho() ? 'auto' : 'smooth' });
      };
      if (!img.animate || cicho()) { pokaz(); return; }
      const a = img.animate([{ translate: `${s.dx}px 0`, opacity: 1 }, { translate: `${-kier * w}px 0`, opacity: 0.2 }], { duration: czas(w - Math.abs(s.dx), s.v), easing: WYJAZD, fill: 'forwards' });
      a.onfinish = pokaz;
    }
    d.addEventListener('touchstart', (e) => {
      const dl = okno();
      t = null;
      if (!dl || e.touches.length !== 1 || !dl.contains(e.target) || (e.target.closest && e.target.closest('.miniatury, input, textarea, select'))) return;
      const p = e.touches[0], fot = e.target.closest && e.target.closest('.galeria .glowne'), min = fot ? [...dl.querySelectorAll('.galeria .miniatury button')] : [];
      const l = fot && min.length > 1 ? null : karty(), i = l ? ktore(dl, l) : -1;
      t = { x: p.clientX, y: p.clientY, dl, poziom: null, dx: 0, v: 0, op: 1, px: p.clientX, pt: performance.now(), fot: l ? null : fot, min,
        zdj: l ? -1 : min.findIndex((b) => b.getAttribute('aria-current') === 'true'), ostatnie: l ? i === l.length - 1 : false, w: W(fot && !l ? fot : dl) };
    }, { passive: true });
    d.addEventListener('touchmove', (e) => {
      if (!t || !e.touches.length) return;
      const p = e.touches[0], dx = p.clientX - t.x, dy = p.clientY - t.y;
      if (t.poziom === null && Math.hypot(dx, dy) > 10) t.poziom = Math.abs(dx) > Math.abs(dy) * 1.2;
      if (!t.poziom) return;
      const teraz = performance.now(), dt = teraz - t.pt;
      if (dt > 0) t.v = 0.7 * ((p.clientX - t.px) / dt) + 0.3 * t.v;
      t.px = p.clientX;
      t.pt = teraz;
      if (t.fot) {
        const opor = (t.zdj <= 0 && dx > 0) || (t.zdj >= t.min.length - 1 && dx < 0);
        t.dx = opor ? dx * 0.3 : dx;
        const img = t.fot.querySelector('img');
        if (img) img.style.translate = `${t.dx.toFixed(1)}px 0`;
        return;
      }
      t.dx = t.ostatnie && dx < 0 ? dx * 0.3 : dx;
      t.op = 1 - Math.min(0.3, (Math.abs(t.dx) / t.w) * 0.45);
      t.dl.style.transition = 'none';
      t.dl.style.translate = `${t.dx.toFixed(1)}px 0`;
      t.dl.style.opacity = t.op.toFixed(3);
    }, { passive: true });
    const koniec = (przerwane) => {
      if (!t) return;
      const s = t;
      t = null;
      if (!s.poziom) return;
      // Bez ruchu po ostatnim przesunięciu (ponad 80 ms) palec nie rzuca.
      if (performance.now() - s.pt > 80) s.v = 0;
      if (s.fot) { zdjecie(s, przerwane); return; }
      s.dl.style.transition = '';
      s.dl.style.translate = '';
      s.dl.style.opacity = '';
      const kier = s.dx < 0 ? 1 : -1;
      const idzie = !przerwane && !(kier > 0 && s.ostatnie) && (Math.abs(s.dx) >= 72 || (Math.abs(s.v) > 0.45 && Math.sign(s.v) === Math.sign(s.dx) && Math.abs(s.dx) > 24));
      if (idzie) idz(kier, s.dl, s.dx, s.v, s.op); else odbij(s.dl, s.dx, s.op);
    };
    d.addEventListener('touchend', () => koniec(false));
    d.addEventListener('touchcancel', () => koniec(true));
    d.addEventListener('keydown', (e) => {
      const dl = okno();
      if (!dl || e.altKey || e.ctrlKey || e.metaKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || (e.target.closest && e.target.closest('input, textarea, select, .miniatury'))) return;
      e.preventDefault();
      idz(e.key === 'ArrowRight' ? 1 : -1, dl);
    });
    // Które auto z listy (28.10.2026, Jacek: subtelny wskaźnik, które to auto z 18): pod tytułem okna auta drobne „5 z 18”, drugim planem. Okno buduje się od nowa
    // przy każdym otwarciu, więc podpis dochodzi przy każdym otwarciu i przy każdej nowej treści okna.
    const dlg = d.querySelector('dialog#okno');
    const podpisz = () => {
      const dl = okno(), t = dl && dl.querySelector('#okno-tytul');
      if (!t || !t.parentElement || t.parentElement.querySelector('.km-ktore')) return;
      const l = karty();
      let i = l.indexOf(biezaca);
      if (i < 0) { const tyt = t.textContent.trim(); i = l.findIndex((k) => ((k.querySelector('.tytul') || {}).textContent || '').trim() === tyt); }
      if (i < 0 || l.length < 2) return;
      t.parentElement.append(el('p', { class: 'km-ktore', 'aria-label': `Auto ${i + 1} z ${l.length}`, text: `${i + 1} z ${l.length}`,
        style: 'margin:2px 0 0;font-size:13px;font-weight:500;line-height:1.3;font-variant-numeric:tabular-nums;color:color-mix(in srgb,currentColor 62%,transparent)' }));
    };
    if (dlg && window.MutationObserver) new MutationObserver(() => setTimeout(podpisz, 0)).observe(dlg, { attributes: true, attributeFilter: ['open'], childList: true });
  };
  // Benzyna i manual (od 29.10.2026, Jacek w Fiszkach o przełączniku „Manual i benzyna”: „Oba”, czyli liczby rynku i oferty na liście). Katalog ma od tego dnia
  // także SUV-y z benzyną z Pomorza, na start schowane filtrami Skanera „Paliwo: Hybryda” i „Skrzynia biegów: Automatyczna” ([raport] domyslne w mission.toml).
  // Nad listą Ofert stoi pigułka: włączona zaznacza w tych filtrach Benzynę i Manualną tak, jak człowiek (zdarzenie change), więc Skaner sam przelicza wyniki
  // i chipy, a pod rzędem staje karta z liczbami rynku: SUV-y z Pomorza od 2016 roku, do 250 tys. km i za 30–75 tys. zł, policzone z danych katalogu. Stan trzyma
  // sam Skaner (sessionStorage), więc pigułka czyta go z pól. Bez filtra Paliwo (katalog bez benzyny, starszy plik) pigułki nie ma. Raz na dokument ramki.
  const przelacznikRynku = (d) => {
    if (!d || d === document || d.kmRynek || !d.body) return;
    d.kmRynek = true;
    const mk = (tag, a, tekst) => { const e = d.createElement(tag); for (const [k, v] of Object.entries(a || {})) e.setAttribute(k, v); if (tekst) e.textContent = tekst; return e; };
    const zestaw = (k) => d.querySelector(`fieldset[data-klucz="${k}"]`);
    const pole = (k, v) => { const z = zestaw(k); return z ? [...z.querySelectorAll('input[type="checkbox"]')].find((x) => x.value === v) || null : null; };
    let liczby = null;
    const rynek = () => {
      if (liczby) return liczby;
      try {
        const s = d.getElementById('we-offline'), r = (JSON.parse(s.textContent).katalog || {}).rekordy || [];
        const suv = r.filter((x) => /^otomoto-pomorskie/.test(x.zrodlo || '') && x.cechy && /suv/i.test(x.cechy.nadwozie || '') && x.cechy.rok >= 2016 && x.cechy.przebieg_km <= 250000 && !((x.cechy.cena ?? x.cena) > 75000));
        const ile = (pal, skr) => suv.filter((x) => new RegExp(pal, 'i').test(x.cechy.paliwo || 'hybr') && new RegExp(skr, 'i').test(x.cechy.skrzynia || 'autom')).length;
        liczby = [['hybryda z automatem', ile('hybr', 'autom')], ['benzyna z automatem', ile('benz', 'autom')], ['benzyna z manualem', ile('benz', 'manual')]];
      } catch { liczby = []; }
      return liczby;
    };
    const styl = mk('style', { id: 'kasiomobile-rynek' });
    // Włączona ma podwójną klasę, żeby wygrać ze szkłem siatki (.przycisk:not(.glowny):not(.przycisk-nowe)), które w oknie na komputerze stoi w arkuszu później.
    styl.textContent = '.przycisk.km-rynek{position:relative;flex:none;min-height:40px;padding:0 16px;border-radius:20px;font-weight:600}'
      + '.przycisk.km-rynek::before{content:"";position:absolute;inset:-4px 0}'
      + '.przycisk.km-rynek.km-rynek[aria-pressed="true"]{background-color:var(--akcent)!important;color:var(--na-akcencie)!important;background-image:linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,0) 34%,rgba(0,0,0,.1))!important;box-shadow:inset 1px 1px 0 rgba(255,255,255,.38),inset -1px -1px 0 rgba(0,0,0,.2),2px 3px 10px color-mix(in srgb,var(--akcent) 42%,transparent)!important}'
      + '.km-rynek-karta{margin:8px 0 0;padding:10px 14px;border:1px solid var(--ramka);border-radius:12px;background:var(--tlo-2);color:var(--tekst);font-size:14px;line-height:1.45}'
      + '.km-rynek-karta b{font-weight:600;font-variant-numeric:tabular-nums}';
    const przycisk = mk('button', { type: 'button', class: 'przycisk maly km-rynek', 'aria-pressed': 'false' }, 'Benzyna i manual');
    const karta = mk('p', { class: 'km-rynek-karta', hidden: '' });
    const wlaczone = () => Boolean((pole('paliwo', 'Benzyna') || {}).checked || (pole('skrzynia', 'Manualna') || {}).checked);
    let opis = '';
    const odswiez = () => {
      const na = wlaczone();
      if (przycisk.getAttribute('aria-pressed') !== String(na)) przycisk.setAttribute('aria-pressed', String(na));
      karta.hidden = !na;
      // Chipy Skanera „Paliwo: Hybryda, Benzyna” i „Skrzynia biegów: Automatyczna, Manualna” mówią to samo co pigułka, więc przy niej znikają.
      for (const c of d.querySelectorAll('.aktywne button')) {
        const t = (c.textContent || '').trim();
        const dubel = na && ((/^Paliwo:/.test(t) && /Hybryda/.test(t) && /Benzyna/.test(t)) || (/^Skrzynia bieg/.test(t) && /Automatyczna/.test(t) && /Manualna/.test(t)));
        if (c.hidden !== dubel) c.hidden = dubel;
      }
      const l = na ? rynek() : [];
      const nowy = l.map(([n, i]) => n + i).join();
      if (!na || nowy === opis) return;
      opis = nowy;
      karta.replaceChildren(d.createTextNode('SUV-y z Pomorza od 2016 roku, do 250 tys. km i 75 tys. zł: '),
        ...l.flatMap(([n, i], j) => [d.createTextNode((j ? ' · ' : '') + n + ' '), mk('b', null, String(i))]), d.createTextNode('.'));
    };
    przycisk.addEventListener('click', () => {
      const na = !wlaczone();
      for (const [k, v] of [['paliwo', 'Benzyna'], ['skrzynia', 'Manualna']]) {
        let c = pole(k, v);
        // Opcja bez wyników przy innych filtrach (Manualna przy samej hybrydzie) stoi pod „Pokaż wszystkie”.
        if (!c) { const w = zestaw(k) && zestaw(k).querySelector('.wiecej-opcji'); if (w) { w.click(); c = pole(k, v); } }
        if (c && c.checked !== na) { c.checked = na; c.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      odswiez();
    });
    let zegar = 0;
    const wstaw = () => {
      if (!zestaw('paliwo')) { przycisk.remove(); karta.remove(); return; }
      const w = d.querySelector('.narzedzia > .wiersz');
      if (!w) return;
      if (!styl.isConnected) d.head.append(styl);
      if (przycisk.parentNode !== w) w.insertBefore(przycisk, w.querySelector('.aktywne'));
      if (karta.previousElementSibling !== w) w.after(karta);
      odswiez();
    };
    wstaw();
    new d.defaultView.MutationObserver(() => { clearTimeout(zegar); zegar = setTimeout(wstaw, 60); }).observe(d.body, { childList: true, subtree: true });
    d.addEventListener('change', () => setTimeout(odswiez, 0), true);
  };
  // Wskaźnik miejsca na liście ofert (28.10.2026, Jacek: „wskaźnik miejsca na stronie jest potrzebny przy przewijaniu”): przy przewijaniu listy przy prawej krawędzi
  // stoi pigułka „5 z 18”, która jedzie razem z przewijaniem i gaśnie 0,9 s po jego końcu (styl.css, .miejsce-listy). Liczy się auto, które przecina linię
  // na 40% wysokości ramki, a na samym dole ostatnie. Lista krótsza niż 4 auta wskaźnika nie ma. Raz na dokument ramki.
  const wskaznikMiejsca = (d) => {
    if (!d || d === document || d.kmMiejsce) return;
    d.kmMiejsce = true;
    const karty = () => [...d.querySelectorAll('.karta-produktu')].filter((k) => k.offsetParent !== null);
    let pig = null, zegar = 0, ramka = null;
    const ramkaDokumentu = () => (ramka && ramka.isConnected ? ramka
      : (ramka = [...document.querySelectorAll('iframe')].find((f) => { try { return f.contentDocument === d; } catch { return false; } }) || null));
    // Raz na klatkę, a przy liście jak strona (ramka na całym ekranie) w paśmie między nagłówkiem a nawigacją.
    let klatka = 0;
    d.addEventListener('scroll', (e) => {
      if (e.target !== d || klatka) return;
      klatka = requestAnimationFrame(() => { klatka = 0; pokaz(); });
    }, { passive: true });
    function pokaz() {
      if (d.querySelector('dialog#okno[open]')) return;
      const l = karty(), f = ramkaDokumentu(), se = d.scrollingElement;
      if (l.length < 4 || !f || !se) return;
      const pr = f.getBoundingClientRect(), kz = document.documentElement.classList.contains('korzen');
      const g = kz ? miejsceKorzenia.glowa : 0, dd = kz ? miejsceKorzenia.dol : 0, h = d.defaultView.innerHeight;
      const r = { top: pr.top + g, height: pr.height - g - dd };
      if (r.height <= 0) return;
      let i = l.findIndex((k) => k.getBoundingClientRect().bottom > g + (h - g - dd) * 0.4);
      if (i < 0 || se.scrollTop + se.clientHeight >= se.scrollHeight - 4) i = l.length - 1;
      if (!pig) { pig = el('div', { class: 'miejsce-listy', 'aria-hidden': 'true' }); document.body.append(pig); }
      pig.textContent = `${i + 1} z ${l.length}`;
      const u = Math.min(1, Math.max(0, se.scrollTop / Math.max(1, se.scrollHeight - se.clientHeight)));
      pig.style.transform = `translate3d(0, ${Math.round(r.top + 12 + u * Math.max(0, r.height - 24 - pig.offsetHeight))}px, 0)`;
      pig.classList.add('widac');
      clearTimeout(zegar);
      zegar = setTimeout(() => pig.classList.remove('widac'), 900);
    }
  };
  // Kółko narysowane palcem gdziekolwiek otwiera HAL-a (28.10.2026; Jacek: „Jak namaluję … kółko na ekranie. Gdziekolwiek … wszystko się zamykało, sam HAL się
  // pojawia i mówi: … good evening, Jack”). Jeden palec, droga zamknięta (koniec blisko początku), obrót wokół środka co najmniej 300°, promień 36–220 px
  // i w miarę równy. Przewijanie i stuknięcia tego nie spełniają. Liczy się w powłoce i w każdej ramce (raz na dokument). Otwiera dopiero po puszczeniu,
  // bo przeglądarka mówi tylko po geście.
  let halZKolka = null;
  const kolkoHal = (d) => {
    if (!d || d.kmKolkoHal) return;
    d.kmKolkoHal = true;
    let pk = null;
    d.addEventListener('touchstart', (e) => { pk = e.touches.length === 1 ? [[e.touches[0].clientX, e.touches[0].clientY]] : null; }, { passive: true, capture: true });
    d.addEventListener('touchmove', (e) => { if (pk && e.touches.length === 1) { if (pk.length < 400) pk.push([e.touches[0].clientX, e.touches[0].clientY]); } else pk = null; }, { passive: true, capture: true });
    d.addEventListener('touchend', () => {
      const p = pk;
      pk = null;
      if (!p || p.length < 12 || !halZKolka) return;
      const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cy = p.reduce((a, q) => a + q[1], 0) / p.length;
      const r = p.map((q) => Math.hypot(q[0] - cx, q[1] - cy)), rs = r.reduce((a, b) => a + b, 0) / r.length;
      if (rs < 36 || rs > 220) return;
      const odch = Math.sqrt(r.reduce((a, b) => a + (b - rs) ** 2, 0) / r.length) / rs;
      let kat = 0;
      for (let i = 1; i < p.length; i++) {
        let da = Math.atan2(p[i][1] - cy, p[i][0] - cx) - Math.atan2(p[i - 1][1] - cy, p[i - 1][0] - cx);
        if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
        kat += da;
      }
      const domkniete = Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < rs * 0.9;
      if (Math.abs(kat) >= (300 * Math.PI) / 180 && odch < 0.35 && domkniete) halZKolka();
    }, { capture: true });
    d.addEventListener('touchcancel', () => { pk = null; }, { capture: true });
  };
  kolkoHal(document);
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
  // Cyfra w kółku miejsca stoi na wysokości wersalików, na środku kółka (28.10.2026, reguła zv-znaki-na-srodku: w Skanerze stała na środku linii, 0,5 px za wysoko).
  const PODIUM = '.podium .nr{display:block!important;box-sizing:border-box!important;height:28px!important;padding:calc((28px - 1cap) / 2) 0 0!important;line-height:1!important;text-align:center;text-box:trim-both cap alphabetic}'
    + '.podium .podium-ustawienia{gap:8px}.podium .podium-chipy{gap:8px}'
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
      + GUZIK('.przycisk') + GUZIK('.cofanie button') + OKRESY_KOLA
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
  // Dotknięcie w ramce nie zapala prostokąta Androida (28.10.2026, Jacek: kolor „jakby ten buton był wycięty z prostokąta … zanim zrobi się ładnie
  // zaokrąglony”): domyślne podświetlenie dotyku ma kształt pola elementu, nie jego rogów, więc w ramkach jest wyłączone.
  // Lista jak strona (app.js, niżej): ramka na całym ekranie dostaje u góry miejsce na nagłówek, a okna w stronie (na telefonie na cały ekran) zaczynają się pod pasem aparatu.
  const SZKLO = '*{-webkit-tap-highlight-color:transparent!important}body::after{content:"";display:block;height:var(--km-dol,0px)}'
    + 'html[data-km-korzen]{padding-top:var(--km-glowa,0px)!important;scroll-padding-top:var(--km-glowa,0px)}'
    + 'html[data-km-korzen] dialog[open]{margin-top:var(--km-g,0px)!important;height:calc(100dvh - var(--km-g,0px))!important;max-height:calc(100dvh - var(--km-g,0px))!important}';
  // Próba 5 „Szkło jak w Kiro” (menu pod logo; Jacek, 28.10.2026: „te butony … również nie powinny być w takiej formie atrakcyjnej … bezbłędnie”):
  // przyciski w stronach mają widoczną obwódkę i mocniejszy cień, wciśnięty rośnie o 9% jak tab w Kiro, a wybrany jest cały niebieski z białym napisem.
  const KIRO5 = 'html[data-km-wyglad="5"] :is(.podium-chipy button,#podium-toyota,.pigulki-widoku button,.mobilne-filtry):not([aria-checked="true"]):not([aria-pressed="true"]){background-color:rgba(255,255,255,.82)!important;box-shadow:inset 1px 1px 0 rgba(255,255,255,.95),inset -1px -1px 0 rgba(0,0,0,.1),0 0 0 1px rgba(0,0,0,.16),2px 3px 8px rgba(0,0,0,.16),6px 8px 18px rgba(0,0,0,.1)!important}'
    + 'html[data-km-wyglad="5"] :is(.podium-chipy button,#podium-toyota,.pigulki-widoku button,.mobilne-filtry):active{transform:scale(1.09)!important}'
    + 'html[data-km-wyglad="5"] :is(.podium-chipy button[aria-checked="true"],#podium-toyota[aria-pressed="true"],.pigulki-widoku button:is([aria-pressed="true"],[aria-checked="true"])){background-color:#0071e3!important;background-image:linear-gradient(135deg,rgba(255,255,255,.3),rgba(255,255,255,0) 40%,rgba(0,0,0,.12))!important;color:#fff!important;font-weight:700!important;box-shadow:inset 1px 1px 0 rgba(255,255,255,.4),inset -1px -1px 0 rgba(0,0,0,.22),2px 3px 10px rgba(0,113,227,.42)!important}'
    + 'html[data-km-wyglad="5"] :is(.podium-chipy button[aria-checked="true"],#podium-toyota[aria-pressed="true"],.pigulki-widoku button:is([aria-pressed="true"],[aria-checked="true"])) *{color:#fff!important}'
    + '@media (prefers-color-scheme:dark){html[data-km-wyglad="5"] :is(.podium-chipy button,#podium-toyota,.pigulki-widoku button,.mobilne-filtry):not([aria-checked="true"]):not([aria-pressed="true"]){background-color:rgba(58,58,60,.78)!important;box-shadow:inset 1px 1px 0 rgba(255,255,255,.22),inset -1px -1px 0 rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.2),2px 3px 8px rgba(0,0,0,.6)!important}}';
  const wSiatce = (nazwa) => (html) => html.replace(/<\/head>/i, () => `<style id="kasiomobile-siatka">${cssSiatki(nazwa)}${SZKLO}${KIRO5}</style></head>`);

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
  // ---------------------------------------------------------------- lista jak strona (od 29.10.2026)
  // Jacek, 29.10.2026: „coś jest nie tak z przewijaniem pionowym głównych listingów … ten smoother widać, że jest artificial … To nie jest natywne. Przewijanie takie,
  // jak mamy na stronach internetowych BBC … Mógłbyś to naprawić, jeżeli to oznacza przemianę jakiegoś engine'u”. Przyczyna: strona z ofertami stała w ramce między
  // nagłówkiem a nawigacją, więc Chromium przewijał ją jak pole w stronie, bez rozciągania na końcu listy i bez reszty zachowań przewijania strony. Ramkę, która
  // leży na całym ekranie od (0, 0), bez przycinających przodków i bez przezroczystości, Chromium na Androidzie sam przewija jak stronę (implicit root scroller,
  // RootScrollerController w Blink). Dlatego na Androidzie na telefonie (do 759 px) ramki leżą na całym ekranie, a nagłówek i nawigacja stoją nad nimi z tym samym
  // tłem co dotąd (styl.css, „Lista jak strona”). Strona w ramce dostaje u góry miejsce na nagłówek (--km-glowa), u dołu na nawigację (--km-dol), a okna w stronie
  // zaczynają się pod pasem aparatu (--km-g). Atlas (strona z sieci, bez naszego stylu) stoi dalej między nagłówkiem a nawigacją. iPhone i komputer bez zmian.
  // Do 1.11.2026 próba w menu pod logo („Przewijanie”); teraz Android zawsze jak strona, a ?korzen=1 i ?korzen=0 w adresie zostają dla testów.
  const korzenZAdresu = new URLSearchParams(location.search).get('korzen');
  let korzen = korzenZAdresu !== null ? korzenZAdresu === '1' : SKAD === 'Android';
  pamiec.usun('przewijanie');
  const waskiKorzen = matchMedia('(max-width: 759px)');
  const sondaGory = el('div', { 'aria-hidden': 'true', style: 'position:absolute;visibility:hidden;height:0;padding-top:var(--km-gora,0px);pointer-events:none' });
  document.body.append(sondaGory);
  const miejsceKorzenia = { glowa: 0, dol: 0 };
  // Miejsce na nagłówek i nawigację, wpisane sobie (Atlas, puste ekrany) i ramkom. Przy otwartym oknie w stronie (nagłówek i nawigacja schowane) zostają
  // poprzednie liczby, żeby treść pod oknem nie skakała.
  function ustawKorzen() {
    const na = korzen && waskiKorzen.matches, html = document.documentElement;
    html.classList.toggle('korzen', na);
    if (na && !document.body.classList.contains('okno')) {
      const gl = $('.glowa'), dl = $('.dol');
      if (gl) miejsceKorzenia.glowa = Math.round(gl.getBoundingClientRect().height);
      if (dl && dl.offsetHeight) miejsceKorzenia.dol = Math.max(0, Math.round(innerHeight - dl.offsetTop));
    }
    const g = na ? miejsceKorzenia.glowa : 0, d = na ? miejsceKorzenia.dol : 0, pas = na ? Math.round(parseFloat(getComputedStyle(sondaGory).paddingTop) || 0) : 0;
    html.style.setProperty('--km-glowa-h', g + 'px');
    html.style.setProperty('--km-dol-h', d + 'px');
    html.style.setProperty('--km-dol', d + 'px');
    for (const [, s] of LISTA_STRON) {
      try {
        const r = s.el.contentDocument && s.el.contentDocument.documentElement;
        if (!r) continue;
        r.toggleAttribute('data-km-korzen', na);
        r.style.setProperty('--km-glowa', g + 'px');
        r.style.setProperty('--km-g', pas + 'px');
        r.style.setProperty('--km-dol', d + 'px');
      } catch { /* obce pochodzenie */ }
    }
  }
  let klatkaKorzenia = 0;
  const planujKorzen = () => { if (!klatkaKorzenia) klatkaKorzenia = requestAnimationFrame(() => { klatkaKorzenia = 0; ustawKorzen(); }); };
  function ustawSiatke() {
    ustawKorzen();
    const cs = getComputedStyle(sonda), odcien = getComputedStyle(document.body).getPropertyValue('--tlo-pasa').trim() || '#ffffff';
    for (const [, s] of LISTA_STRON) {
      try {
        const d = s.el.contentDocument;
        if (!d || !d.documentElement) continue;
        d.documentElement.style.setProperty('--km-odcien', odcien);
        d.documentElement.dataset.kmOdcien = '';
        if (document.body.dataset.szklo) d.documentElement.dataset.kmWyglad = '5'; else delete d.documentElement.dataset.kmWyglad;
        swiatloPrzyciskow(d);
        ciszaKolka(d);
        przesuwanieAut(d); wskaznikMiejsca(d); przelacznikRynku(d);
        kolkoHal(d);
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
  // Każdy start jest śnieżnobiały (Jacek, 26.10.2026: „chodziło o ten biały, żeby to było śnieżnobiałe”). Kolorowe tło, które do wieczora
  // 26.10.2026 włączało przytrzymanie logo, już nie istnieje; jego dawny zapis w pamięci telefonu znika.
  pamiec.usun('kolorowo');
  LISTA_STRON.forEach(([, s]) => s.el.addEventListener('load', ustawSiatke));
  // Nagłówek i nawigacja zmieniają wysokość (przeniesienie nawigacji, pas aparatu, okno w stronie, czat), więc miejsce w ramkach idzie za nimi, raz na klatkę.
  if (window.ResizeObserver) { const ro = new ResizeObserver(planujKorzen); for (const s of ['.glowa', '.dol']) { const e = $(s); if (e) ro.observe(e); } }
  waskiKorzen.addEventListener('change', planujKorzen);
  new MutationObserver(planujKorzen).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  ustawKorzen();

  // ---------------------------------------------------------------- dziennik użycia (od 27.10.2026)
  // Jacek: „zapisywał jej interakcje z tą aplikacją … gdzie jej palec śmigał, co ona oglądała, i jak oglądała … user study … odtworzyć w jej
  // tempie … całe dni z przerwami … wszystko, co wpisuje”. Po Fiszkach (27.10.2026): Kasi powie o tym Jacek, dane idą same na komputer w domu,
  // zapis jest domyślnie wyłączony: telefon niczego nie zapisuje ani nie wysyła, dopóki komputer nie potwierdzi zgody (node asystent.js --uzycie wlacz; do tego czasu
  // idzie tylko pusty ping z losowym numerem instalacji, najwyżej raz na 10 minut), a zbieranie trwa, aż Jacek je wyłączy (node asystent.js --uzycie wylacz). Zapisuje tylko to, co dzieje się w tej aplikacji i w jej
  // ramkach, nigdy nic spoza niej. Tylko na ekranach dotykowych poza Androidem Jacka, więc jego próby w przeglądarce na komputerze i na Redmi
  // niczego nie zaśmiecają. Zdarzenia to tablice [czas, kod, …]; kody: S sesja, v widoczność, r rozmiar okna, p dotyk (0 palec w dół, 1 ruch,
  // 2 w górę, 3 przerwany), c stuknięcie z nazwą elementu, s przewinięcie, n zakładka albo pigułka, d okno ze szczegółami, i wpisany tekst,
  // q czat i HAL, u zarys ekranu (prostokąty i podpisy widocznych elementów). Co 45 s albo po ok. 8 tys. znaków zdarzenia idą w paczkach
  // (gzip, base64, do 3,5 tys. znaków) na „<kanał>-uzycie”; komputer potwierdza każdą na „<kanał>-odpowiedz”: { id: 'u-<instalacja>', ack: n,
  // uzycie }. Paczka bez potwierdzenia czeka w telefonie (do 120, w IndexedDB) i idzie jeszcze raz po 10 minutach; komputer wyłącza zapis
  // polem uzycie: false. Dzienny limit 150 wysłanych wiadomości chroni limit ntfy.sh (250 na dobę), który dzielą z pytaniami do asystenta.
  // Ramki z innej strony (Atlas) są dla nas zamknięte, więc dotyku w Atlasie nie widać; zostaje zakładka i pigułka.
  const UZYCIE = (() => {
    const MAX_SUROWYCH = 8000, MAX_BASE64 = 3500, MAX_PACZEK = 120, DZIENNIE = 150, PONOW_MS = 10 * 60000, CO_MS = 45000, SESJA_MS = 30 * 60000, MAX_ELEMENTOW = 45;
    const S = { wlacz: false, ok: false, stop: false, id: '', n: 1, kolejka: [], rozmiar: 0, paczki: [], gotowe: Promise.resolve(), zegar: 0, lot: false, dzis: 0, dzienKlucz: '',
      sprawdzano: 0, ukryta: 0, zarys: '', zarysT: 0, zarysZegar: 0 };
    const czekaj = (ms) => new Promise((r) => setTimeout(r, ms));
    const przytnij = (t, n) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n);
    const bez = (f) => (...a) => { try { return f(...a); } catch { /* dziennik nie psuje aplikacji */ } };
    const zapisPaczek = () => schowek.zapisz('uzycie-paczki', JSON.stringify(S.paczki.map(({ n, t0, z, d }) => ({ n, t0, z, d }))));

    function zapisz(kod, ...dane) {
      if (!S.wlacz || S.stop || !S.ok) return;
      S.kolejka.push([Date.now(), kod, ...dane]);
      S.rozmiar += 14 + dane.reduce((a, d) => a + String(d).length + 3, 0);
      if (S.rozmiar >= MAX_SUROWYCH) zamknij();
      else if (!S.zegar) S.zegar = setTimeout(zamknij, CO_MS);
    }
    // Paczka: czasy jako różnice od poprzedniego zdarzenia (pierwsze od t0), gzip i base64; za duża dzieli się na pół.
    async function pakuj(z) {
      const t0 = z[0][0];
      let pop = t0;
      const tab = z.map((x) => { const dt = x[0] - pop; pop = x[0]; return [dt, ...x.slice(1)]; });
      const json = JSON.stringify(tab);
      let d = json, f = 'j';
      if (typeof CompressionStream === 'function' && typeof Blob === 'function') {
        try {
          const b = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
          let s = '';
          for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
          d = btoa(s);
          f = 'g';
        } catch { /* bez kompresji */ }
      }
      if (d.length > MAX_BASE64 && z.length > 1) { const p = z.length >> 1; return (await pakuj(z.slice(0, p))).concat(await pakuj(z.slice(p))); }
      return [{ t0, z: f, d }];
    }
    async function zamknij() {
      clearTimeout(S.zegar);
      S.zegar = 0;
      const z = S.kolejka;
      S.kolejka = [];
      S.rozmiar = 0;
      if (z.length && !S.stop) {
        await S.gotowe;
        for (const p of await pakuj(z)) { p.n = S.n++; S.paczki.push(p); }
        pamiec.zapisz('uzycie-n', S.n);
        while (S.paczki.length > MAX_PACZEK) S.paczki.shift();
        await zapisPaczek();
        pamiec.usun('uzycie-kolejka');
      }
      wyslij(false);
    }
    async function wyslij(koniec) {
      if (S.lot || S.stop || !S.ok || !S.paczki.length || !S.wlacz) return;
      S.lot = true;
      try {
        const dzis = new Date().toISOString().slice(0, 10);
        if (S.dzienKlucz !== dzis) { const z = pamiec.czytaj('uzycie-dzis', null); S.dzis = z && z.d === dzis ? Number(z.n) || 0 : 0; S.dzienKlucz = dzis; }
        for (const p of S.paczki.slice()) {
          if (p.wys && Date.now() - p.wys < PONOW_MS) continue;
          if (S.dzis >= DZIENNIE) break;
          const r = await fetch(`${SERWER}/${KANAL}-uzycie`, { method: 'POST', cache: 'no-store', keepalive: Boolean(koniec), body: JSON.stringify({ u: S.id, n: p.n, t0: p.t0, z: p.z, d: p.d }) });
          if (!r.ok) break;
          p.wys = Date.now();
          S.dzis++;
          pamiec.zapisz('uzycie-dzis', { d: dzis, n: S.dzis });
          await czekaj(1200);
        }
      } catch { /* bez sieci paczki czekają w telefonie */ }
      S.lot = false;
      setTimeout(kontrola, 6000);
    }
    // Komputer potwierdza paczki i może wyłączyć zapis: czytamy jego wiadomości o tej instalacji z ostatnich 12 godzin.
    async function kontrola() {
      if (!S.wlacz || Date.now() - S.sprawdzano < 15000) return;
      S.sprawdzano = Date.now();
      try {
        const potw = new Set();
        let wlacz = null;
        for (const m of await wiadomosci(`${KANAL}-odpowiedz`, '12h')) {
          let d;
          try { d = JSON.parse(m.message); } catch { continue; }
          if (!d || d.id !== 'u-' + S.id) continue;
          for (const a of Array.isArray(d.ack) ? d.ack : [d.ack]) if (Number.isInteger(a)) potw.add(a);
          if (typeof d.uzycie === 'boolean') wlacz = d.uzycie;
        }
        if (potw.size) {
          const przed = S.paczki.length;
          S.paczki = S.paczki.filter((p) => !potw.has(p.n));
          if (S.paczki.length !== przed) await zapisPaczek();
        }
        if (wlacz === false) {
          if (S.ok || !S.stop) { S.ok = false; S.stop = true; pamiec.usun('uzycie-ok'); pamiec.zapisz('uzycie-stop', true); S.kolejka = []; S.paczki = []; pamiec.usun('uzycie-kolejka'); await zapisPaczek(); }
        } else if (wlacz === true && (!S.ok || S.stop)) {
          S.ok = true; S.stop = false; pamiec.zapisz('uzycie-ok', true); pamiec.usun('uzycie-stop'); sesja();
        }
      } catch { /* bez sieci */ }
      if (!document.hidden && (S.paczki.length || S.stop || !S.ok)) setTimeout(kontrola, 90000);
    }
    // Opis stuniętego elementu: znacznik#id | napis | nagłówek karty, w której leży (na przykład tytuł auta).
    function opis(cel) {
      if (!cel || !cel.closest) return '';
      const k = cel.closest('button, a, summary, label, input, select, textarea, [role="tab"], [role="radio"], [role="button"], [role="checkbox"]') || cel;
      const tekst = przytnij(k.getAttribute('aria-label') || k.getAttribute('title') || k.value || k.textContent, 48);
      const kt = k.closest('article, li, tr, [data-id], dialog, section'), h = kt && kt !== k ? kt.querySelector('h1, h2, h3, h4, strong') : null;
      return [k.tagName.toLowerCase() + (k.id ? '#' + przytnij(k.id, 20) : ''), tekst, h ? przytnij(h.textContent, 44) : ''].filter(Boolean).join(' | ');
    }
    // Zarys ekranu: do 45 widocznych elementów jako [x, y, szerokość, wysokość, „znacznik:napis”] we współrzędnych okna, żeby przy odtwarzaniu
    // było widać, co leżało pod palcem. Tylko gdy zarys się zmienił i nie częściej niż co 2,5 s.
    function elementy(doc, dx, dy, wynik) {
      const okno = doc.defaultView, w = okno.innerWidth, h = okno.innerHeight;
      for (const e of doc.querySelectorAll('img, button, a[href], input, select, summary, h1, h2, h3, h4, strong, [role="tab"], [role="radio"], [role="button"]')) {
        if (wynik.length >= MAX_ELEMENTOW) break;
        const r = e.getBoundingClientRect();
        if (r.width < 8 || r.height < 8 || r.bottom <= 0 || r.top >= h || r.right <= 0 || r.left >= w) continue;
        const cs = okno.getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
        wynik.push([Math.round(r.left + dx), Math.round(r.top + dy), Math.round(r.width), Math.round(r.height),
          e.tagName.toLowerCase().slice(0, 3) + ':' + przytnij(e.getAttribute('aria-label') || e.alt || e.value || e.textContent, 26)]);
      }
    }
    const zarysTeraz = bez(() => {
      const wynik = [];
      elementy(document, 0, 0, wynik);
      const s = STRONY[klucz(widok)];
      if (s && s.el && s.el.contentDocument && s.el.contentDocument.documentElement && !document.body.classList.contains('czat-otwarty') && !document.querySelector('.czat-hal')) {
        const r = s.el.getBoundingClientRect();
        elementy(s.el.contentDocument, r.left, r.top, wynik);
      }
      return wynik;
    });
    function planujZarys(ms) {
      if (!S.wlacz || S.stop || !S.ok) return;
      clearTimeout(S.zarysZegar);
      S.zarysZegar = setTimeout(bez(() => {
        const teraz = Date.now();
        if (teraz - S.zarysT < 2500) { planujZarys(2500 - (teraz - S.zarysT)); return; }
        const z = zarysTeraz();
        if (!z || !z.length) return;
        const j = JSON.stringify(z);
        if (j === S.zarys) return;
        S.zarys = j;
        S.zarysT = teraz;
        zapisz('u', przytnij(document.body.dataset.zakladka || '', 12), z);
      }), ms || 500);
    }
    const widziane = new WeakSet();
    function podepnij(doc, ramka, nazwa) {
      if (!S.wlacz || !doc || !doc.documentElement || widziane.has(doc)) return;
      widziane.add(doc);
      const przes = () => { if (!ramka) return [0, 0]; const r = ramka.getBoundingClientRect(); return [r.left, r.top]; };
      let ostT = 0, ostX = -99, ostY = -99;
      for (const [typ, kod] of [['touchstart', 0], ['touchmove', 1], ['touchend', 2], ['touchcancel', 3]]) {
        doc.addEventListener(typ, bez((e) => {
          const t = kod >= 2 ? e.changedTouches && e.changedTouches[0] : e.touches && e.touches[0];
          if (!t) return;
          const [dx, dy] = przes(), x = Math.round(t.clientX + dx), y = Math.round(t.clientY + dy), teraz = Date.now();
          if (kod === 1 && (teraz - ostT < 66 || Math.abs(x - ostX) + Math.abs(y - ostY) < 4)) return;
          ostT = teraz; ostX = x; ostY = y;
          zapisz('p', kod, x, y);
        }), { capture: true, passive: true });
      }
      doc.addEventListener('click', bez((e) => {
        const [dx, dy] = przes();
        zapisz('c', Math.round(e.clientX + dx), Math.round(e.clientY + dy), opis(e.target), nazwa);
      }), { capture: true, passive: true });
      // Przewijanie: najwyżej co 150 ms, z ostatnim położeniem po zatrzymaniu; zarys ekranu po ustaniu ruchu.
      let sT = 0, sZegar = 0, sCel = null;
      doc.addEventListener('scroll', bez((e) => {
        sCel = e.target;
        const rob = bez(() => {
          sZegar = 0;
          sT = Date.now();
          const el = sCel && sCel.nodeType === 9 ? (sCel.scrollingElement || sCel.documentElement) : sCel;
          if (!el) return;
          zapisz('s', nazwa + (el.nodeType === 1 && el.className && typeof el.className === 'string' && sCel.nodeType !== 9 ? '.' + przytnij(el.className.split(' ')[0], 16) : ''),
            Math.round(el.scrollTop), Math.max(0, Math.round(el.scrollHeight - el.clientHeight)));
          planujZarys(450);
        });
        const minelo = Date.now() - sT;
        if (minelo >= 150) rob(); else if (!sZegar) sZegar = setTimeout(rob, 150 - minelo);
      }), { capture: true, passive: true });
      // Wpisany tekst i ustawienia (suwaki kalkulatora, szukanie, filtry): wartość po 0,7 s ciszy.
      const wpis = {};
      doc.addEventListener('input', bez((e) => {
        const c = e.target;
        if (!c || !/^(INPUT|TEXTAREA|SELECT)$/.test(c.tagName) || c.type === 'password') return;
        const k = przytnij(c.id || c.name || c.placeholder || c.type || 'pole', 30);
        clearTimeout(wpis[k]);
        wpis[k] = setTimeout(bez(() => zapisz('i', nazwa, k, przytnij(c.type === 'checkbox' || c.type === 'radio' ? c.checked : c.value, 80))), 700);
      }), { capture: true, passive: true });
      // Okno ze szczegółami (auto, filtry, galeria): otwarcie z tytułem i zamknięcie.
      let otwarte = 0;
      const MO = (doc.defaultView && doc.defaultView.MutationObserver) || MutationObserver;
      new MO(bez(() => {
        const d = doc.querySelector('dialog[open]'), jest = d ? 1 : 0;
        if (jest === otwarte) return;
        otwarte = jest;
        const h = d ? d.querySelector('h1, h2, h3, [aria-label]') : null;
        zapisz('d', nazwa, jest, d ? przytnij((h && (h.textContent || h.getAttribute('aria-label'))) || d.getAttribute('aria-label') || '', 60) : '');
        planujZarys(700);
      })).observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    }
    // Zakładka i pigułka zmieniają się też bez stuknięcia (asystent, powrót do aplikacji), więc patrzymy na atrybuty, a nie na kliknięcia.
    function nawigacja() {
      let zak = '';
      const pig = {};
      const sprawdz = bez(() => {
        const z = document.body.dataset.zakladka || '';
        if (z && z !== zak) { zak = z; zapisz('n', 'z', z); planujZarys(800); }
        for (const r of document.querySelectorAll('.podwidoki [role="radio"][aria-checked="true"]')) {
          const g = r.closest('.podwidoki'), id = g ? g.dataset.z : '', p = r.dataset.p || '';
          if (id && p && pig[id] !== p) { pig[id] = p; zapisz('n', 'p', id + ':' + p); planujZarys(800); }
        }
      });
      new MutationObserver(sprawdz).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-zakladka', 'aria-checked'] });
      sprawdz();
    }
    function sesja() {
      zapisz('S', innerWidth, innerHeight, Math.round(devicePixelRatio * 100) / 100, SKAD, matchMedia('(prefers-color-scheme: dark)').matches ? 'c' : 'j', przytnij(navigator.userAgent, 100));
      planujZarys(1500);
    }
    // Zgoda komputera: dopóki jej nie ma, telefon niczego nie zapisuje ani nie wysyła, tylko pyta pustą paczką (n: 0, ping) z losowym numerem instalacji.
    // Przy starcie najwyżej raz na minutę, później najwyżej raz na 10 minut, więc zapis włączony na komputerze telefon zauważa przy najbliższym otwarciu.
    function pytaj(start) {
      if (!S.wlacz || S.ok) return;
      const teraz = Date.now(), ost = Number(pamiec.czytaj('uzycie-ping', 0)) || 0;
      if (teraz - ost < (start ? 60000 : 600000)) return;
      pamiec.zapisz('uzycie-ping', teraz);
      fetch(`${SERWER}/${KANAL}-uzycie`, { method: 'POST', cache: 'no-store', body: JSON.stringify({ u: S.id, n: 0, ping: 1 }) }).catch(() => {});
      setTimeout(() => { S.sprawdzano = 0; kontrola(); }, 4000);
    }
    function start() {
      // Strona testowa (?test=…, testy/przegladarka.mjs) nigdy nie zapisuje użycia, żeby próby nie trafiły na prawdziwy kanał Kasi.
      S.wlacz = SKAD !== 'Android' && Boolean(KANAL) && matchMedia('(pointer: coarse)').matches && !/[?&]test=/.test(location.search);
      if (!S.wlacz) return;
      S.id = String(pamiec.czytaj('uzycie-id', '') || '');
      if (!/^[0-9a-f]{8}$/.test(S.id)) { S.id = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join(''); pamiec.zapisz('uzycie-id', S.id); }
      S.n = Number(pamiec.czytaj('uzycie-n', 1)) || 1;
      S.stop = pamiec.czytaj('uzycie-stop', false) === true;
      S.ok = !S.stop && pamiec.czytaj('uzycie-ok', false) === true;
      S.gotowe = schowek.czytaj('uzycie-paczki').then((t) => {
        try {
          const p = JSON.parse(t || '[]');
          if (Array.isArray(p)) S.paczki = p.filter((x) => x && Number.isInteger(x.n) && typeof x.d === 'string').concat(S.paczki);
          S.n = Math.max(S.n, ...S.paczki.map((x) => x.n + 1));
        } catch { /* zepsuty zapis: zaczynamy od nowa */ }
      }, () => {});
      const ost = pamiec.czytaj('uzycie-kolejka', []);
      if (Array.isArray(ost) && ost.length && S.ok && !S.stop) S.kolejka = ost.filter(Array.isArray); else pamiec.usun('uzycie-kolejka');
      podepnij(document, null, 'app');
      nawigacja();
      if (S.ok && !S.stop) sesja();
      document.addEventListener('visibilitychange', bez(() => {
        zapisz('v', document.hidden ? 0 : 1);
        if (document.hidden) { S.ukryta = Date.now(); if (S.kolejka.length) pamiec.zapisz('uzycie-kolejka', S.kolejka); zamknij(); }
        else { if (S.ukryta && Date.now() - S.ukryta > SESJA_MS && S.ok && !S.stop) sesja(); S.ukryta = 0; pytaj(false); kontrola(); planujZarys(900); }
      }));
      addEventListener('pagehide', bez(() => { if (S.kolejka.length) pamiec.zapisz('uzycie-kolejka', S.kolejka); zamknij(); }));
      let rz = 0;
      addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(bez(() => { zapisz('r', innerWidth, innerHeight); planujZarys(600); }), 400); });
      S.gotowe.then(() => {
        pytaj(true);
        wyslij(false);
        setTimeout(kontrola, 8000);
      });
    }
    const api = {
      podepnij: bez(podepnij),
      czat: bez((typ, dane) => { zapisz('q', typ, przytnij(dane, 300)); if (typ === 'hal' || /^czat-/.test(typ)) planujZarys(700); }),
      stan: () => ({ wlaczone: S.wlacz && S.ok && !S.stop, ok: S.ok, stop: S.stop, id: S.id, nastepny: S.n, oczekuje: S.paczki.length, wRam: S.kolejka.length, dzis: S.dzis }),
      splukaj: () => zamknij(),
      kontrola: () => { S.sprawdzano = 0; return kontrola(); },
    };
    start();
    window.Uzycie = api;
    return api;
  })();

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
      UZYCIE.podepnij(w.document, s.el, k);
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
  // „Cofnij” na ekranie tylko przy rzeczach trudnych do odwrócenia (28.10.2026, Jacek: usunięte dane albo dużo tekstu, a nie przestawienie zakładek, przeniesienie
  // nawigacji czy kółka asystenta). Przestawienie odwraca ten sam ruch, więc przycisk już nie wyskakuje, a historia zostaje: Ctrl+Z i Ctrl+Y cofają i ponawiają.
  function pokazCofnij() {
    clearTimeout(zegarCofnij);
    cofnijPole.classList.remove('paruje');
    cofnijPole.hidden = true;
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
      // Przytrzymane i puszczone w miejscu to stuknięcie (28.10.2026, Jacek: „mimo że mam go podświetlony ramką … nie przeskoczyło”): zakładka albo pigułka się wybiera.
      // Po długim dotknięciu przeglądarka sama nie klika, więc klik idzie stąd, a drugi, gdyby przyszedł, zatrzymuje bylRuch.
      else if (!przerwane && e.type === 'pointerup' && Math.abs(e.clientX - ciag.x) < 10 && Math.abs(e.clientY - ciag.y) < 10) { ciag.bylRuch = false; b.click(); ciag.bylRuch = true; }
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
    nazwa: (b) => b.textContent.trim(), cofnij: 'Cofnij przestawienie zakładek', przytrzymanie: true, podniesiony: () => przerwijPasek() });
  // Kolejność pigułek w pamięci pod identyfikatorem zakładki (do 25.10.2026 pod jej numerem, raz przepisana). Katalag ma od wieczora
  // 25.10.2026 nowy klucz, bo zmieniła się kolejność domyślna: Wszystkie marki na końcu.
  const KLUCZ_PIGULEK = { katalog: 'pigulki-kolejnosc-katalog', modele: 'pigulki-kolejnosc-katalag', kredyt: 'pigulki-kolejnosc-kredyt', poradnik: 'pigulki-kolejnosc-poradnik' };
  const RZEDY_PIGULEK = Object.fromEntries(Object.entries(grupyPigulek).map(([id, g]) => {
    const k = KLUCZ_PIGULEK[id];
    if (id === 'katalog' && pamiec.czytaj(k, null) === null) { const z = pamiec.czytaj('pigulki-kolejnosc-0', null); if (z !== null) pamiec.zapisz(k, z); }
    return [id, rzadPrzestawiany({ rodzic: g, elementy: [...g.querySelectorAll('[role="radio"]')], klucz: k, id: (b) => b.dataset.p,
      nazwa: (b) => b.textContent.trim().replace(/\s+/g, ' '), cofnij: 'Cofnij przestawienie pigułek', przytrzymanie: true,
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
  // Niespodzianka (od 26.10.2026 wieczorem, Jacek: „przytrzymać przez pół sekundy … samą ikonę … tylko oko tego Hala … Easter egg”):
  // przytrzymanie logo przez 0,5 s i puszczenie otwiera tryb HAL (czat.js, „HAL”): pusty ekran z okiem i rozmowa tylko głosem. Stuknięcie
  // dalej otwiera menu Otomoto, a klik po przytrzymaniu niczego nie otwiera (słuchacz w fazie przechwytywania stoi przed tym od menu).
  // Po 0,5 s logo podskakuje raz i telefon drga, a HAL otwiera się dopiero po puszczeniu, bo przeglądarki mówią tylko po geście.
  // Do wieczora 26.10.2026 to samo przytrzymanie włączało kolorowe tło strony.
  {
    let zegar = 0, przytrzymane = false;
    const stop = () => clearTimeout(zegar);
    logo.addEventListener('pointerdown', () => {
      przytrzymane = false;
      clearTimeout(zegar);
      zegar = setTimeout(() => {
        przytrzymane = true;
        logo.classList.remove('niespodzianka');
        void logo.offsetWidth;
        logo.classList.add('niespodzianka');
        if (navigator.vibrate) navigator.vibrate(12);
      }, 500);
    });
    logo.addEventListener('pointerup', () => { stop(); if (przytrzymane && czat) czat.hal(); });
  halZKolka = () => { if (czat && !czat.halOtwarty()) czat.hal(); };
    logo.addEventListener('animationend', () => logo.classList.remove('niespodzianka'));
    for (const t of ['pointercancel', 'pointerleave']) logo.addEventListener(t, () => { stop(); if (t === 'pointercancel') przytrzymane = false; });
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
    if (pokazWybor) {
      menuOtomoto.append(el('p', { class: 'menu-otomoto-tytul', 'aria-hidden': 'true', text: 'Wygląd nawigacji (próba)' }));
      for (const [k, nazwa] of WYGLADY) {
        const b = el('button', { type: 'button', role: 'menuitemradio', 'aria-checked': String(k === wyglad), 'data-w': k }, el('span', { class: 'menu-otomoto-nazwa', text: nazwa }));
        b.addEventListener('click', () => {
          ustawWyglad(k, true);
          for (const x of menuOtomoto.querySelectorAll('[data-w]')) x.setAttribute('aria-checked', String(x.dataset.w === k));
        });
        menuOtomoto.append(b);
      }
    }
    // Próba przewijania „Przewijanie (próba)” stała tu od 29.10 do 1.11.2026. Jacek, 1.11.2026: „ostatnie dwie pozycje są na temat przewijania
    // ekranu … oczywiście ja nie chcę”. Android przewija listę jak stronę (korzen), bez wyboru.
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

  // ---------------------------------------------------------------- próby wyglądu nawigacji (od 27.10.2026)
  // Jacek: „te kolorki … nie jest over the top”, „zróbmy kilka wersji tej aplikacji, żebym mógł wybrać”. Na Androidzie Jacka menu pod logo ma wybór wyglądu
  // dolnej nawigacji: Obecny i cztery próby (styl.css, „Próby wyglądu nawigacji”). Wybór leży w pamięci telefonu, a adres z ?wyglad=N ustawia go w przeglądarce
  // (zrzuty i testy). Od 1.11.2026 wybór stoi wszędzie, także na iPhonie i iPadzie (Jacek: „pod przyciskiem Kasia mobile wcale nie ma wyboru kolorów
  // menu … tych futur które są na Androida tylko”). Po decyzji Jacka przegrane próby i ten wybór znikną.
  const WYGLADY = [['', 'Obecny'], ['1', '1: Kolor na wybranej'], ['2', '2: Jeden niebieski'], ['3', '3: Bez koloru'], ['4', '4: Kolorowe ikony'], ['5', '5: Szkło jak w Kiro']];
  const wygladZAdresu = new URLSearchParams(location.search).get('wyglad');
  let wyglad = String(wygladZAdresu !== null ? wygladZAdresu : pamiec.czytaj('wyglad', ''));
  if (!WYGLADY.some(([k]) => k === wyglad)) wyglad = '';
  const pokazWybor = true;
  // Wskaźnik: trójkąt między rzędem zakładek a rzędem pigułek, pod środkiem wybranej zakładki. Liczony z układu (offsetLeft), nie z prostokątów, żeby
  // przesuwanie i powiększenie zakładki go nie rozedrgało.
  function ustawWskaznik() {
    const pk = $('.podkarty'), sel = $('.karty [aria-selected="true"]');
    if (!pk || !sel) return;
    const p = pk.getBoundingClientRect(), s = sel.getBoundingClientRect();
    if (s.width) pk.style.setProperty('--wsk-x', Math.round((s.left + s.width / 2 - p.left) * 100) / 100 + 'px');
  }
  function ustawWyglad(w, zapisz) {
    wyglad = w;
    if (w && w !== '5') document.body.dataset.wyglad = w; else delete document.body.dataset.wyglad;
    if (w === '5') document.body.dataset.szklo = '5'; else delete document.body.dataset.szklo;
    if (zapisz) pamiec.zapisz('wyglad', w);
    for (const [, s] of LISTA_STRON) { try { const d = s.el.contentDocument; if (d && d.documentElement) { if (w === '5') d.documentElement.dataset.kmWyglad = '5'; else delete d.documentElement.dataset.kmWyglad; } } catch { /* ramka bez dostępu */ } }
    ustawWskaznik();
  }
  const planujWskaznik = () => requestAnimationFrame(ustawWskaznik);
  new MutationObserver(planujWskaznik).observe($('.karty'), { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected'] });
  new ResizeObserver(planujWskaznik).observe($('.karty'));
  addEventListener('resize', planujWskaznik);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ustawWskaznik);
  ustawWyglad(wyglad, false);

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
  // Filtry Ofert z ręki asystenta (od 28.10.2026; Jacek: „Filtru, trochę. Tylko bez klikania”). Skaner trzyma kontrolki filtrów w ramce także wtedy, gdy panel jest schowany (pola z aria-label,
  // pola wyboru w zestawie „Sprzedawca”, radio „status”, lista kolejności), a po każdym zdarzeniu input albo change sam przelicza wyniki, licznik i znaczniki. Wpisujemy więc tak, jak człowiek,
  // bez klikania w panel. „Wyczyść” w Skanerze wraca do filtrów z początku (od firm, od 2016, do 200 tys. km, tylko warte uwagi), a nie do pustych. Liczba 0 zdejmuje ograniczenie.
  // Gdy ramka jeszcze się wczytuje, próbujemy co 250 ms przez 10 s. Zwraca obietnicę: prawda, gdy filtry weszły.
  const KOLEJNOSC_OFERT = { dopasowanie: 'wynik', najtansze: 'cena_rosnaco', najdrozsze: 'cena_malejaco', przebieg: 'kol:przebieg_km:r', swieze: 'kol:dni_na_otomoto:r' };
  const SPRZEDAWCA_OFERT = { firma: ['firma'], prywatny: ['osoba prywatna'], wszyscy: ['firma', 'osoba prywatna'] };
  function ustawFiltry(f) {
    const ramka = STRONY.katalog.el, pauza = (ms) => new Promise((r) => setTimeout(r, ms));
    const zd = (e, nazwa) => e.dispatchEvent(new Event(nazwa, { bubbles: true }));
    const zastosuj = async () => {
      const d = ramka.contentDocument;
      if (!d || !d.querySelector('input[aria-label="Cena do (zł)"]')) return false;
      if (f.wyczysc) {
        const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === 'Wyczyść');
        if (b) { b.click(); await pauza(250); }
      }
      const liczba = (aria, v) => {
        if (v === undefined || v === null) return;
        const e = d.querySelector(`input[aria-label="${aria}"]`);
        if (e) { e.value = v === 0 ? '' : String(v); zd(e, 'input'); }
      };
      liczba('Cena od (zł)', f.cenaOd); liczba('Cena do (zł)', f.cenaDo);
      liczba('Rocznik od', f.rokOd); liczba('Rocznik do', f.rokDo);
      liczba('Przebieg do (km)', f.kmDo);
      const chce = SPRZEDAWCA_OFERT[f.sprzedawca];
      if (chce) {
        const pola = () => { const z = [...d.querySelectorAll('fieldset')].find((x) => /^Sprzedawca/i.test(((x.querySelector('legend') || {}).textContent || '').trim())); return z ? [...z.querySelectorAll('input[type="checkbox"]')] : []; };
        for (const wart of ['firma', 'osoba prywatna']) {
          const c = pola().find((x) => x.value === wart);
          if (c && c.checked !== chce.includes(wart)) { c.checked = !c.checked; zd(c, 'change'); await pauza(80); }
        }
      }
      if (f.werdykt) {
        const rd = d.querySelector(`input[type="radio"][name="status"][value="${f.werdykt}"]`);
        if (rd && !rd.checked) { rd.checked = true; zd(rd, 'change'); await pauza(80); }
      }
      const sel = d.querySelector('select'), wart = KOLEJNOSC_OFERT[f.kolejnosc];
      if (sel && wart && [...sel.options].some((x) => x.value === wart)) { sel.value = wart; zd(sel, 'change'); }
      await pauza(150);
      try { ramka.contentWindow.scrollTo(0, 0); } catch { /* ramka z innego pochodzenia */ }
      return true;
    };
    return new Promise((ok) => {
      let proby = 0;
      const krok = async () => {
        let gotowe = false;
        try { gotowe = await zastosuj(); } catch { gotowe = false; }
        if (gotowe) { ok(true); return; }
        if (++proby >= 40) { ok(false); return; }
        setTimeout(krok, 250);
      };
      krok();
    });
  }
  const mostGlosu = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.glos;
  const czat = window.Czat && KANAL ? Czat.uruchom({
    kanal: KANAL, tryb: 'arkusz', mikrofon: SKAD !== 'iPhone', skad: SKAD,
    // Rozmowa na telefonie kończy się nad nawigacją, więc zakładki zostają widać i działają (od 26.10.2026, Jacek: „brak jakiejkolwiek
    // nawigacji po tych czatach”). Na szerokim ekranie nawigacja stoi u góry, a rozmowa jest panelem z prawej.
    // Od 27.10.2026 wieczorem rozmowa na telefonie jest na cały ekran (Jacek: „AI … powinno być na cały ekran”): nawigacja zsuwa się do belki na dole czatu
    // (styl.css, „Czat na cały ekran”), więc pod arkuszem nic nie zostaje. Małe okno (przytrzymanie przycisku asystenta) zostawia nawigację na miejscu.
    dol: () => 0,
    naZmiane: (otwarty, mini) => {
      ruchNawigacji();
      document.body.classList.toggle('czat-otwarty', otwarty && !mini);
      document.body.classList.toggle('czat-mini', otwarty && Boolean(mini));
      UZYCIE.czat(otwarty ? (mini ? 'czat-mini' : 'czat-otwarty') : 'czat-zamkniety', '');
      if (otwarty && !mini) DALEJ.length = 0;
    },
    widok: () => opisWidoku(),
    kotwica: () => { const b = $('#czat-otworz'); return b && b.classList.contains('czat-plywak') ? b.getBoundingClientRect() : null; },
    nawigacja: (p) => wysunNawigacje(p),
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
        if (p.filtry && z === 'katalog') ustawFiltry(p.filtry);
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
  // ---------------------------------------------------------------- prank dla Kasi (od 31.10.2026)
  // Jacek w Fiszkach (29.10.2026): „Kółko się łaskocze”, trzeciego dnia używania, „Najpierw pokaż mi”; 31.10.2026 po podglądzie: „Popraw”
  // i „to ma być prank … am not frekin 12 but 52 and its freakin halloween too”. Prank zdarza się raz, jednego dnia, na iPhonie Kasi
  // (aplikacja albo strona): w Halloween (31 października) od pierwszego dnia, a poza nim trzeciego dnia używania (auta-dni, ten sam
  // licznik co ściąga „i”). Trzy pierwsze stuknięcia w kółko asystenta tego dnia:
  //   Halloween („dynia”): kółko robi się dynią z wyciętą twarzą, która świeci jak świeczka, drży i rechocze jak wiedźma, po 1,4 s czat,
  //   inny dzień („laskotki”): kółko chichocze, wierci się i rumieni, po 0,95 s czat.
  // Nic nie wysyła; pamięta tylko dzień i liczbę stuknięć (auta-prank). Przy ograniczonym ruchu nic się nie rusza, zostają barwy.
  // Podgląd: ?prank=1 (wariant dnia), ?prank=dynia albo ?prank=laskotki, albo auta-prank-podglad = liczba stuknięć.
  // Dźwięki to krótkie MP3 z syntezy (pięć „hi” i siedem „ha” z echem), bez nagrań z sieci.
  const prank = (() => {
    const ILE = 3, NA_IPHONIE = SKAD === 'iPhone' || /iPhone|iPad/.test(navigator.userAgent);
    const DZWIEK = { laskotki: 'data:audio/mpeg;base64,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', dynia: 'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYzLjguMTAwAAAAAAAAAAAAAAD/84TEAAAAAAAAAAAASW5mbwAAAA8AAAA7AAAh8AAJDg4SEhYaGh8fIycnKyswNDQ4ODw8QUVFSUlNUlJWVlpeXmNjZ2trb29zc3h8fICAhImJjY2RlZWamp6eoqamq6uvs7O3t7zAwMTEyM3N0dHV1dne3uLi5urq7+/z9/f7+/8AAAAATGF2YzYzLjE3AAAAAAAAAAAAAAAAAvPwAAAAAAAAIfD8JxGeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/82TEAA1oAsL9QBAAuHlm+6VaYCm0Hz5ccIAQghWfLv4Y5d/i4f6xOH3esP//B/7t//WH///+D5//wf5SXP8EAQAa/4yJYogBpnT6Eo2EB87euWvYw/aTmb+7Fj9lf1vqRxxxyHW0kd/2SK01Pc29nsvo3H8eg1dfvOepN7R+3yyFk1SGRzVfrbEb924bGcz/82TETSzcOtABhWAAE0WUo3lo6wxvJ31G8sOLsW7Xe9s+bx3Y6XorXud55emUWUidhfgpr8poXGCxFAuXWjp7O9NbpKt0fcxhjXWHGKba/wzltk8jaMcjRNLHaOS4vjj2p0+4syN2aWzkKB2k0fk9PFMMNb6TJgWpg/fdctZKXvEcB8TnL034YmoDklGxGfn/82TEHBvRZtr1yzAAdECCKAVvqu7xCNonVvft32LI7+93rRF5VM3a2g8q0WCqDEFCwUgYUaJSzxdx4i1J7Hpr8qDWvET2YNWYKrrOsqTLYihupQdh0iWBmdlhLV+RAwdVFQYP8wgXWuNOgmiy/DjdzHMA0BlTYNAbST/MIg3Ev2iIhsWjoSmFzCyFczE0t57/82TELyBpfqHiDhhUvlH4l0C5cfK2zhDOh6NwRAyMR1BU9JB4bHqZdiI9Qy64y0vKsK5NU91x4JDw6HQ6xxW8CgUUJHRZJJrEFQkPd/9/JbJ1X57Okf6lhI9py2ij7FoKP///+TUkIAa3K3M8n/TRuiICUhTBl0zmTzlyY2UgCSwHJOAWGBawRxqk9RFiCjT/82TEMCfiNnwjWqAAzN060SZFak4XLewxwx5fKy8yFJAGggcCEBBkTBRuitEY0YIt5NuaJLMRlRcJsRCpGkkXieMUFr0kjZa0lM2Yl1NBFN/RQTZqKkjE86lmZORJAqAoo9DX5lbhL4apzBlKg6KUbzuql3edvao61T9pKvyQ6BC9BiNo9jV1nGRG3UZ3Lg//82TEEx/0OrQBgWgAQ0Pq/44ByGxqS+rfXrNDRY9zdT1++lz5mowLjDL///LhJlEkyXWXC4SX//3/JUeZccchJHjdx6HhgP//s23/kgXQt49kUR/ErSPG5qJePMlDX///////PkMcBKEQgHz6DF0ea5mUx7mRQMz5cv/qLb/qihLBDM7/edmPmtfzn8wfe/H/82TEFiJ8KtAByjABtr5TXZj61NedoNH43rKtJzwcrHxkdaq7xOszU8TK7jtOJI4lGxCUXc6VbFZGJFLRJb4RZs3u3VX3Nn9pbanztSbFWdlzXfPKmyu1t7Nqdxq6ktzeiSoKdqd5r8tN4fDi53f0pzWJYyzr+VmZC8q9xS61HdOskRRhxwhO99SCZJMTCQb/82TEDxtZwuL8KwasvO/bBIFBXcvPTiyE/eJhmIJ8/ecrmat5F7wjVVVDRA8UMat/l9wFSEleJSO2qkyVubSiYtMSx0K1yB5oSAw4slVbhYlofOlrB68NlbrlXC+W7PmkE+bYaSxLBrxQfSrtQ0UhOMJ3a6T4JmhurTKObbI9h0B4dlfrXebKRXEUmrawypT/82TEJBrpYtb+CwZUmZvOLKq1ev/syqfiGMoKMtG6TiFUEBKcIjxVwoPCSmHQ68UHiw86HQVFRsWPZKegy7R/9sVtnRU6siTJFQVGv6p6r+3yIu5dAS4Ivb5bb//7TxseAjHwn/SpcTYLkaflBFHlKUqVaxlKWY6EsjoYzflLKcxyNKx2JRDh0OiBnczUMVr/82TEOxvCOs43SygC6aG3t6P9Csj1RWKqot3zKKrTeeed63CupWSftdlp5iSYiPKWfaPALzUaLOURUQN1yRLbFBbbbbbbbbbZbLZabRaeWlkZgihhMGcCZ2D00jpGTgtX9LtsCEoZJ/8vUeRVPrafQij/9LVIWqJ5CAmiwGyb3/PZrlBQbccBAkkjAOiFRH//82TETzEEOuZfgkgAZ7579EaKJYkRBgnUUPlZgSPdPP9/8PD7tICZQxKZhowgEWQjKc5P9lWIZD/J+dZD/8wuXBMVnSCSSSqBgkYhU7naJaM4QpdKEP//WQ/2EGM+1CGdA4YBgGJkZHHUkhkTiyNwnC5gvJmm8xemqcps5xv6uVWYG22lddKR79rqjUD2Tlb/82TEDhtBeuZb0VgAhSSNR1jngnQtGKzP+xMlgRgJE2DZdGoh66LmsPO9A7S7m1/MzJueH10u/t74omx1Utl06zpFy/FwVCbjolgFiOHHV86eFJtJti7EpNckrJGPYqj6qRE+RrbY1VsO6BTOdFQHTMuSSN6HGA0yqAQeA7ckOMsp5VQ968Q3CaClikp4UtX/82TEJBkxWur+K8ao80olVFGDOcOsx/5QozYOKz6+ZK1BuLEhppLKqux0qp7SBUVes6wmLBUNKO83ZzqKFuFbdGl1mt2dbpkNuvO/RlkZiEAGQL2ZmZvOp3tOh+X3yRQUx5MycOrW3cCRp1EFLIgtM3yMyiyRJ8Z7b5c5ctj9DWSNUbQ6QAQbQNFQiaGuCpn/82TEQhzxJsJTTDAAgmTFDLBUUQLEskuKpMnGz4gFyBk+oVfl2IsF13wKdambtRfQ3TyCS71egutN4q0Ismn8dDSCtxODQOJWMHpelQom48ZVMu28vOdmTrESNPpQ5zeB/87o5KhZZoO8tiagQdWbLvfV+xruK+rL7+/bo2qNfuqHPOI7ySLjNde2s4xTP3//82TEUTDEOrABh3gAWFIyn+1TNajf0+v/r1+/b7+c3+qfe64Q853I61M6snDIYPj4t//779c6/+fv/4+r//PMtdEIQ5hc4T1jVsjO+Utfrfzr7ltv2/rX2ta+8aiZ383v/8Y1n59HaHrafP063Zxm+0s7EhBxtzigWyIc5czr/8eFv8gAMA4e1qFKgCARasX/82TEERsb/twByigB0sRNJUeq/VLnCZiymNd5zKr2vlNVDRXS29jJ2LXqjzFxVHlQWlVqTkGsViopHtK1S0zOxlQyqhlKn7GEZu/11YqOiFS0xk7KUil9pzId0dUXMToYpdRnnUzXO2rfdYQWTQuWSNzwLi9Q00BKD+Pi52Ql5ZVdM6vKQwBkYjQsoQcI4X//82TEJxrBau7+Qwao9zVq2//YTMfEuyxmYvdBYkIGYcxMMQBll3guAiQLh8qcF3GSxHbdV6TgooPQuwVoDzWz4DueOFjiP1O/wuyf0XeywujLU8IAzVOSyy/73nuDkmIii65ZJnUYgl7g0ii3hBMj5yqvWwUl27+am6fv/8yS7ROSevmf7GkiQVFA6PDLbEH/82TEPxvJTuL/RjAAJyKVgrvGLOqeFGLCbelYK4lGUMDSw7fKnSrmPnTzMs8SzvlXCJ8lPSphK9Z095YS1f//zrajBwxw5IVD5ABsEZVASNGptVJky4Yt6ouhhYm90dW5Yuta8ObN/A+Kx8U7G+gYgy5mYHLGdvsWZrUkfXlZNwtywZ1fq0q1LR9TNIP+LZ3/82TEUi/kMrABiXgBa+oUj+u7f5v64xmPbMOHvWryWgaiWjuD6v3WFJJmmaW+oPr4PpAe6ziPS0m5L0rLe26Ra0ri1P/91pO9+87rXedbfvoesT+mbzv5tQM0eUrD1Eg1lzGu6rSXGswIMOaeSuLWxa8b0rr4tbFoPoX/SgA6bNc2xjxEAwrFP7/zBb+va6L/82TEFSGUIuABglgBrmN39f3TY3zUnGx/PvVOVcxLDqcs3P/uYr38xcSmyXNbx//s/r7cdl6x9y769myVEXdLPfdsp/bGMZ+xCIh6m+j74h66OubOOuqdN9q11/7+/hlf3V19pvOIQ1d9NY+0tpxqa76SY06pUxLZRqDwULwVCmWCEkbJUun/4xbFrog61Tr/82TEERvhVub9z2gAw+xveKkPJaXFli7wXxhwU8BvAC6JSastB3N1GJq3u6CzyTItqZzWzMgggtJJaLbVppJl0NDWjh8SjXj0RcRvDVvF5YjNpSHjB0c83CEy+htH1kqu6PbKhrVV/097frUJEHAA4VRbMX5Y3z6Z3SNmVaH0Lkny7rqDmG2REOdp278L+Tn/82TEJB0hbsrSA8wcr5XICyyM5m2qttGZ9XyhWAZHYX8ZobKSecjUt0xJipUNyx1gdIa3XolQ1LJEUcBRCoSiJIelk3HjoiTRwqdq7VPIw7Ep2Rs0WtO3LfqeVnqVCjJxA/K+l/ub1YUHatD1ZNliWNwAoJprRt+IYsDUQgXHG9ctZTNeiRFXa3v/TSw9mg3/82TEMhzhpsbVS0AAurZK+/IMi1JWoPeI67uPjyAGDYPwcUbQXaPeo4D6lQ/kFgSwcGDjSB9YDHHB7wfPtE6GCcH35TiCj/rfW53VtHn1/lQG5YSGcB3ocHiT9estPfakOr0Fhue6em7fymMDxqk3zL1pSlIl9145urHvvMUzPMa581Q9Lp3VlLM5Pzl5vRb/82TEQSysOsQBgmAAZT5usMzGiVOH8X36k9Mzs/tKv82/HB07HTUiIG6EkcRHBcVErJrM/n2nJy+fTn8cuv+95v8zjhhKweSYhJ1R9Y5PFvU/tmcnr9kz8zN67vUR04zfxhyW46LKOTf1kT5IJ1W1FcdVm78EQrOB7OCzHRP6AEikkkbaoH/kAM7+4swDgGz/82TEERnBHu5d0HgAbGy908hfBGBRsta6/pJSN96znNKQbfGd7ktTNs6xa1HkRjkeJShAHBE0QCoPhpQqCqVPU/eMRWdAxqIvapQFXUDSKgp09Hzst2rlfe09+sRMVw34dW79V7EQ6xKWSOf3lqeyMNIqqRf0mSJDyad8mSOJEkowsmUclRLX5s3On8n9yqD/82TELRnxVu7+SYZ0Zoxlcofn8VAREOh2+UMoHIeyxhNuVGaiJwWilSOeFUirA40azbGNABx5pqvS69D7O7VeS4ZwqyZFnE7+dWQUPWOba3bvnGqJd0M5+mgRKzIxQTAONCo+nEBhhTCv9McKq9Yc4cZjPzZRR5DBEZxmjexFgiMKDofFQkSGQaMCI8iRjmX/82TESB0ZWt7/SRgAE6RCp0KucFQlSbeBh1Z0CooVH/Doavf/JXpYsJBQVapddgBdgqCrM2OHtFEV/CxqD44NEFrh5wZKJVK7xwU1wApsZBVdFy1yfTL1c236t2pa7VL2pH94fjmbUs0vM16oibWqx7N/2HZlDWnhhuGcbi/5oxLW0ZvO/25nr5thY6JX94f/82TEVi7UOrQBh2AAX7Uuomb6tXWXUxZy93OcjYMCPitYsNHq3dyGt+rlenMrabQsOzeU323MgJB4bz8KuhLM15YQ3y2hRxw29q3QTWdtS9K0q9e1N+CHt62X2zT3u/evmHr7k9fxwoVOd5/HQ/POYPOV/7S15kQOWy03TByOYWeMOW0Q5jzDTV3R6rNUpdT/82TEHSOD5uQBh2gBtJLUpcjOhQZN2rZ002qVONd2nU2UiildJGtnW9auitnQQM2dNNbJIonGUmuzUkVooorXVWyS3ZzdE0QopVMXjQ2RSQapJFFA3PNpPrZa6qKVbH75mtSKDmCnRcwZSS2Wt52pFk2pKWjTPdoY7T/3lbPuXLCJ3ZJ26SVOytY/hbwVIjL/82TEEhqZUvL/zTAAs4bZPGWMKVvdUkxxE12ghyaRuZERNrtHMyH1Isj//2pzZf47Nsz/9ZtNCZipFwQWLuUFl9NaEgRdem8PgQdKOiReZcIL/QZLoUz2vqrxdtXXLvM4n9SoBWoKRDIVP1R6SOfdBnFjc8EWwGVkhSIg0Kp+aBpFrNe7BRIINagIqv1qFyv/82TEKhiZQub+EkaMD7aQVxDGWeZYYJPEofG7IGaHWhyRSDPSeEShE/qkSrt4NPd1uaedOy1hX5VR5HlSX+o9POlX8Q0VqEVhFGtTk+v9v3ZZQSrw4T8PBiWFHpnjxskUP+II1R1hgMBUVYfYASXLA0eGNAJpSBOFA5eRclZknGrvFqG6XOwG8+w5SX1CxwP/82TEShgQntb9RjAAwRewV/nL/8vpKZv0JUuEeOmhU/NE5NUAWW22Sx22yy222yWyz/8eQ6YEKPZDoCZyjiKCCQe8RYEDhGyIWHE7HwITE6fF0F7cXhXyoW1G5wmElGRFTc+mbJlZhnh5L5OLUQxZ08fKCRWQIOWTqKyRUgOIvHyDl2bol83c4XEiFsgix13/82TEbDWkOu5fi5gCMvJLTQUmYrZz7oHjBA8gXTYyKxiTqBiYlhbpLRN1oJsgn2TuzGi3NziTOiklZJ1u71qsyn+kzKJg8TibJqoKQZczTNZsqaoJostFKtNSziKKnS60WQdVakTFBl6nqaYMeL7pqNDRp5Os3QX/4SlWQ2rW/AQEz+k1FUiH/+lJZla3P/f/82TEGCCUKuABgkAB1EisbLC0IPFX7/N270zHUtvf+k4xt17jKhof1JT4SEo/hCFEbNHLY89ZiB6LFiskmU+k3vvFfva8kEjmrGG1dOTj/+0hUvp/PIqb5RLieXruWrIhEUfCWXc2SjomY0TFlVcUH8DauYGxTxUJVGAFmQgqv/+LWxAcn4ZZYWWv+VZLOuD/82TEGB1xetr7z0AAJIaLLXg+DYTHKWDcCYet3qStGBOLMqNNVBg4w6OV9+Q7DofzVfzmB7XCX3TwSjYCNLCY0sbJhViiz5msioiz2qHna51GVESWhMO0wEGr7Ia6vqxE+GsqWiXt1B0kZf2D0xM3mBKba3v4dJwVNF64ErD+gYvrYC0C003eA9i69x3gFSj/82TEJRzaFuceW8Swmt9bO6x4JRC2vnU30Agon+EAQwEOreHFFKXlVAgkxl/OOY387r/dCmR3edUUWow+9aLBqmSkXDxOAAHraXfuclzvpPsF/Tv+ABB/kyCTagBSl2Gsg5LrJ/MUY0kMecdjpJJiTjuD0CwQ86QyM4hg55v9vIYoHnf0Dr/4kDAQgpR2WIj/82TENB1J5uL+assgcAcPnr0EgFGAQXduzGchF+Zye7IURIH0iViQ2YfeG1EgUFqAaOkiUOsIlTD5WeFrA0hepoKy3cSY66HeItOG/rTVCZOUBh+ZVmsn//xBq+hQRcErbetPNfMVDyk/vDVrLFuxR0Hr//O7c3RPj6jaxjGflWj5Imr3IRGAaAXO+uQmC23/82TEQRxSKtr+eotk+zIGt+pREIi7IjvmMLDX/lKIGX92i9zWa27jjtBFlY1yrFpfR6v18ovdWzQyZS9a1QP/wC/L7t9tM5kCeArp6s+gloCWCYmv8wJAcv+4sJB6YuzMzOUbeWu9M3lszEMdgOwb35y87JZ8PohE7pnV69e9EtOjQ+D4bCTcEQ8DRBgIGQH/82TEUhz5bu5eA1g8ChwocPjCCRxmJ1txZAkWuH7/s+t4IbFJN6oY/24WOfi70j1x/8fJxPKf33r4BGCTpxgm3T/r5cmUSkWz0F2M7Xs4xXJtsgYHjtkIsTIZ/U4wFMb9TpMvsjfpi+yq6mcgem2NKcmRiTuwyKc7j7odsTFJnq/6cCFPv+/+wbTc3pL/vi//82TEYRwyAtTKA8o7/yeE6V8v6/xpLMTV57mNcv91xBBIwXZI3TmtA3Dq1kJMshjapLZxfZIhSyHl51j5v4JfY4QAEvxIHyGbqIo6N8wqLnOcxWxI79lMpQFHuKIPA2QNIcVNAcZYB9ah5qhRUWhvdtGjTwEFiSZ4dAtTI1jku2an2V/d6vUv7W39dMcQKAP/82TEcxspWuL+C8oc0u2OCUP8joFmNLnNWKrsxWlgCWllDW3vb/qiQ2Z/+0pHUk7/qSAAkG4blztPhyBMEpHNUa6XzQjACk64nvqjhrX7oj4X//51XT8T9UiA5BSBLpT7l6hWbaxY555vX5StY59/ts80xtdy11alCoIKAGl/m6I0BxhLn96EBlzxcZoKyKz/82TEiRxiCrAAbhaoU2FrUfRPTmSFXaBxzpnJME5jkTk4wscfPXUpxTqU1ccrisjNQblteZoUD0rl0K9uN9w+v2Y/i80eDQBJipHnHLeCj0tsUJlMYasZ1ft0V2qtcxfcz933cixacmoKdaBo50I3f+/Us0UDwUhHGqZEWzBBgOwZY9QY9sNsYUlWWLIQPSD/82TEmhyZbrmUbhiou45W6R2gbs79IfmS/pEoLI2f7orOoeo5Slk96utByKx/+2UUi/MEjKX+7QM8Y5gcSlClXJH1tGlBRjGnyiqRMrIPcrdzpQWwkz/k6gxSkRDYxLb/t8oBP6KloxC9/BI6U0x0R9Rfy6reYbGN5Ct/rjX8YuvSf/aLg6s//8F0JB2/7GH/82TEqhySRtL+aIegAAmBKM7kYegmTURnt9SwREpYPhgCiJ4JhYaZJOWOadHFRoUtFi9oYbP2HjIG5zfI+upzWXM27/iku1xjf1UpNf/6ydI9BDZJx0B4gQokpVIoeRScS8qLD4CeuMe0u0Jfvdz39z81r7tZKtYjV3ZYeYhbY0YUNUblZn8ZGr6Mp0d9knP/82TEuh0pitL+C8xYan3JiHcqqg6+07eYQXPV6Z9NgzbCqplteAtv1/9dojzbuif7RUZ/sQOufP8X3rLanz8ceB6V60GEM+EpxtrJmvVT2ap0b85gqNCnZui0CuMcWqYFh804QDQ+DwY2uUcYOlNY9GG0kt9EnCqq9mW9qlf96qKkDRYiaehySzyQGyQaeDT/82TEyB6SArzKgYUVShQsbFUkiUK5Z6dTzzMKAXwViKiu11HuhoS8ULB3o2ag6gk0s3ptAlv/9/73h/DDFZ3Frhqv80XB6f5TIU5W0LTCjXshhRkNqfU9/vFIDLJn48WHcxvfBCilKCO9zhjoGM+zMKBW/Q66/17Ie3nyFCxK9JTj6y5TcEIWLLBzm7lBfTv/82TE0BupWsreC9A0WtZnGdPu1vqfs/p3aExBTWtAgBEpC8+u9aq1lmxCfUTuY/T3kfPTnJIEOEowRm5PPUmHGLseRfVXf/7uFG4SDLqmy5c1KI+Q7VJo0mm4SBM9ByUZjGM4MY4vf0PO9uxtG+pSKrvToqW85AECKExwo8cIJIVdqxylxzLJJaP1etftyLn/82TE5BuCNs7+eIdMEco3osFX30zoVMIF7YI2/XXyNMv6tDoFSjiC4rXhkqlqIMeGf8Bil7ZcXA1SfRdwT0ZvjOmIvnYBcPP1FQuM/ygSiAOT4rZBSd8gc9SHucmg8QUeSvjpRjbsh24/T6MccQ55hUMmGnzI8JWgQwNDy+NGXRzg409R0+R9Tiooki0LJ1j/82TE9h56Prr2eYUoHOAFJBaYxUxBTUVVVVX9ZNABSQBy/XfdZAOOKYXwyIaf+7Qj3jth7uP/xsZ+Ydx9nDr5XO/dxcfsPr9xQw9f/0FDBOEK//FRar/MoIhY87A0EQq4k8QCwlLhAEAGIQ0FlHAswmUOJBAEFIE4EMGRHelFr+5qI71T4vRbL9IuhDskH8f/82TE/iBiQrb+C85cOcwVoE7xRbhCsgSpAc2v/9/v/1hKnCuLomab+ZV2XMzFjO9Y5+cok0PSRgjjBWReq+lkApmm57Oe2Z/n7GEr049Fs7TWtv/vmKqq39/d5VN//efa/+/Ljdwt9i3PCTr5Wy17jtp2RILk22o2QI4sTSfqJeKla0qshStI22o2zSOvUqr/82TE+B7hbrr+G9BYQtCkmbhSO/coyjkMe0hrKQrelrdexp07adKXyDNrtCgdMm2KYN0wWIvU0zwaKoIDYqHYCPVVkSFNgVYiVQoykzKQd2J/NuED0nqrQNU7NDLeorH6DWNwyYrUna22uixKBAHIZP/NGRbJf/8p8e2/7gwhDIhBKLOJPf/tvJoSPtp373z/82TE/y40MrL2wZMd3t/u1zngPWEodUtqr3gqQrwoloTDSTu2gkCukRGq0O//7+GmXRE7ytaEoWcjsgQmjIJ3bao+XzJKPDwMj9jFDjRkxPcWkK3XXRFZv4bwUkXI7zEn1SkSIRgNNSvJIGNblbVcXm1+gsRACURFajtEGMhn6IwED7N9mFTf6P/Q40hUdOv/82TEyRwxpqrWO8xUcVMvq4sY5EamXenbTs9OsjkIjqmWlH/X/T119bo1pNdaP9KW7ozvxiZaWREYDPipJP3R8tTGQ1va3OJUk2IkKXloJNbtTPcnAa6ps14JdTyWLCwQBAw9DGZok6jnv+HtQKARo9AsmswqyMyVEIUiSdFkpBwBpJOOBYW33xUFLGU3MaL/82TE2yC0CqseW8p84rIXvq7trGrTp2sPI1HFWC6K93Y/DsojfCe1lKoAHAAoP1////+O2mSNlE5jrKbvoeGqokWlKo2adz7cL2BCl1T95DiT/4YbZrj1Z3CA/e63/92Z3z6N//hxHeICq3uv/iCzYamhk2AMgeDxRF9R5SoYwxp0f5ctm852M5n1eUlmIcP/82TE2x0JZpouXgyo8aJUxiHGFVtOGRdLhZu8WJwFSz+ty0OmcsqUVya0GBAIGq+mDZ1QMRezOpupJxG4f9TxoDdabepuwUBZLPt15eXA4r+RDtf+7Yy6bnf//gQWpDr///aIagCIgyqz/82RT9XZxjf746rxJ3z7ftaNy4JKHH4sBQFrFTL18FSxNlQqMUj/82TE6SFCRoYsw8sQWoGueeAeRgq5aeikjInZXsIPeVd7dBLOmNy0VUxBTUU0LjEgKGFscGhhIDApVVVVVVVVVVVVVakxQggrAX99sfWIkLMtvNQzESMAoGTD8ajZYNPVFIL1K1lDoro5dDIZZvURZxEV4lc2sFQkHeVCZmo8EjWDIKkcqs7UHVBUJUWkPX3/82TE5x/JinXkFh5Uv//6f//9SkxBTUU0LjEgKGFscGhhIDApqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/82TEzxSZGnr+CkpUqqqqqqqqqkxBTUU0LjEgKGFscGhhIDApqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/82TEfAAAAdwAAEQAqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=' };
    const CZAS = { laskotki: 950, dynia: 1400 };
    const TWARZ = '<svg viewBox="0 0 100 100" focusable="false"><path d="M31 20C19 38 21 70 34 86M69 20C81 38 79 70 66 86" fill="none" stroke="#a84300" stroke-opacity=".35" stroke-width="2.5"/><path d="M47 4h6l-1 10h-4z" fill="#2f6b1a"/><path class="twarz" d="M27 40 36 24 45 40ZM55 40 64 24 73 40ZM46 50 50 43 54 50ZM24 54Q32 60 40 61V67H46V62.5H54V67H60V61Q68 60 76 54Q72 74 50 77Q28 74 24 54Z"/></svg>';
    const dzis = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const halloween = () => { const d = new Date(); return d.getMonth() === 9 && d.getDate() === 31; };
    const zAdresu = new URLSearchParams(location.search).get('prank') || '';
    let trwa = false; const grane = {};
    // Klucze pierwszej wersji z tego samego dnia (auta-psikus…) znikają. Podgląd dla Jacka („Najpierw pokaż mi”): Android Jacka po tej
    // aktualizacji dostaje raz trzy stuknięcia z prankiem. Kasia ma iPhone'a, więc jej to nie dotyczy. Do usunięcia po decyzji Jacka.
    for (const k of ['psikus', 'psikus-podglad', 'psikus-podglad-dany']) pamiec.usun(k);
    if (SKAD === 'Android' && pamiec.czytaj('prank-podglad-dany', null) === null) { pamiec.zapisz('prank-podglad', 3); pamiec.zapisz('prank-podglad-dany', true); }
    function wariant() {
      const dnia = halloween() ? 'dynia' : 'laskotki', podglad = Number(pamiec.czytaj('prank-podglad', 0)) || 0;
      if (podglad > 0) { if (podglad > 1) pamiec.zapisz('prank-podglad', podglad - 1); else pamiec.usun('prank-podglad'); return dnia; }
      if (zAdresu === 'dynia' || zAdresu === 'laskotki') return zAdresu;
      if (zAdresu === '1') return dnia;
      if (!NA_IPHONIE) return null;
      const d = dzis(), s = pamiec.czytaj('prank', null);
      if (s && s.d && s.d !== d) return null;
      const ile = s && s.d === d ? Number(s.n) || 0 : 0, dni = pamiec.czytaj('dni', []);
      if (ile >= ILE || !(halloween() || (Array.isArray(dni) && dni.length >= 3 && dni[2] === d))) return null;
      pamiec.zapisz('prank', { d, n: ile + 1 });
      return dnia;
    }
    return (b, potem) => {
      if (trwa) return true;
      const w = wariant();
      if (!w) return false;
      trwa = true;
      if (w === 'laskotki' && !b.querySelector('.czat-rumience')) b.prepend(el('span', { class: 'czat-rumience', 'aria-hidden': 'true' }, el('i'), el('i')));
      if (w === 'dynia' && !b.querySelector('.czat-dynia')) { const s = el('span', { class: 'czat-dynia', 'aria-hidden': 'true' }); s.innerHTML = TWARZ; b.prepend(s); }
      try { const d = grane[w] || (grane[w] = new Audio(DZWIEK[w])); d.currentTime = 0; const p = d.play(); if (p && p.catch) p.catch(() => {}); } catch { /* bez dźwięku */ }
      b.classList.remove('laskotki', 'dynia'); void b.offsetWidth; b.classList.add(w);
      setTimeout(() => { trwa = false; potem(); }, CZAS[w]);
      setTimeout(() => b.classList.remove(w), CZAS[w] + 200);
      return true;
    };
  })();
  const przyciskCzatu = $('#czat-otworz');
  // Przycisk asystenta na telefonie pływa i da się go przenosić (niżej, „Przycisk asystenta”); jego własne przytrzymanie otwiera małe okno, więc dymek z dotyku nie ma tu
  // czego szukać (dymek z myszy zostaje). Puszczenie po przeniesieniu albo przytrzymaniu nie jest stuknięciem.
  przyciskCzatu.dataset.dotyk = 'wlasne';
  przyciskCzatu.setAttribute('aria-description', 'Przytrzymaj, żeby zapytać o to, co widać na ekranie. Przeciągnij, żeby przenieść przycisk. Z klawiatury: Alt i strzałki.');
  let bezKlikuAI = 0;
  if (czat) { Czat.dymek(przyciskCzatu); przyciskCzatu.addEventListener('click', () => { if (Date.now() - bezKlikuAI < 600) return; if (prank(przyciskCzatu, () => czat.otworz())) return; czat.otworz(); }); } else przyciskCzatu.hidden = true;
  // Zakładka albo pigułka stuknięta przy otwartej rozmowie zamyka rozmowę, a potem jej własne kliknięcie pokazuje stronę
  // (faza przechwytywania, więc najpierw to).
  if (czat) $('.dol').addEventListener('click', (e) => { if (czat.otwarty() && e.target.closest('[role="tab"], [role="radio"]')) czat.zamknij(); }, true);
  // Wstecz (gest od lewej krawędzi w Aplikacja.swift, przycisk Wstecz na Androidzie): najpierw menu i czat, potem okno w stronie
  // (szczegóły auta, filtry, galeria), w Atlasie najpierw to, co otwarte w Atlasie, w całości powrót do skrótu, a na drugiej pigułce
  // powrót do pierwszej (Historia do Teraz, Marki do Podium, Kredyt do Leasingu). Dopiero potem Wstecz wychodzi z aplikacji. Atlas
  // odpowiada dopiero po chwili, więc gdy stoi na pierwszej pigułce rzędu, Wstecz idzie na pierwszą zakładkę.
  function wstecz() {
    if (menuOtomoto) { zamknijMenuOtomoto(true); return true; }
    if (sciaga.otwarta()) { sciaga.zamknij(); return true; }
    if (czat && (czat.halOtwarty() || czat.otwarty())) return czat.wstecz();
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

  // ---------------------------------------------------------------- nowa wersja na telefonie (od 28.10.2026)
  // Jacek: „żeby mi się wyświetlało w tym pięknym glassie, że teraz coś się ładuje na telefon … nie wiem, czy ja mam najnowszą wersję”. Pierwszy start nowej
  // wersji pokazuje u góry szklaną kartę z jej numerem przez 8 s; stuknięcie zamyka ją od razu. Numer daje kanal.js z budowy APK (window.WERSJA), a w przeglądarce
  // adres z ?wersja=… (zrzuty i testy). Strona w sieci i iPhone, bez tego numeru, karty nie pokazują.
  (() => {
    const w = String(window.WERSJA || new URLSearchParams(location.search).get('wersja') || '');
    if (!/^\d+\.\d+\.\d+$/.test(w)) return;
    const bylo = pamiec.czytaj('wersja-widziana', '');
    pamiec.zapisz('wersja-widziana', w);
    if (bylo === w) return;
    const k = el('div', { class: 'nowa-wersja', role: 'status' }, el('strong', { text: 'Nowa wersja na telefonie' }), el('span', { text: bylo ? `${w} · wcześniej ${bylo}` : w }));
    document.body.append(k);
    let zegar = 0;
    const zdejmij = () => { clearTimeout(zegar); k.classList.add('znika'); setTimeout(() => k.remove(), 400); };
    k.addEventListener('click', zdejmij);
    zegar = setTimeout(zdejmij, 8000);
  })();
  // ---------------------------------------------------------------- nawigacja na telefonie: pas na dole i przenoszenie
  // Od 25.10.2026 wieczorem nawigacja na telefonie to zwykły pas na dole, w układzie (styl.css, „Nawigacja na telefonie”), więc treść kończy się nad nim (--km-dol zostaje 0).
  // Przenoszenie (Jacek: „Powinniśmy być w stanie przesunąć to o 1 piksel w jedną lub w drugą stronę”): przytrzymanie wolnego miejsca w pasie przez 0,5 s podnosi pas,
  // który dostaje ramkę w barwie wybranej zakładki, telefon krótko pyka, a pas jedzie za palcem w górę albo w dół co do piksela, bez przyciągania. Najniżej 4 px nad
  // krawędzią ekranu, najwyżej górnym brzegiem w połowie ekranu. Bez kreseczki, strzałek i paska postępu (28.10.2026, Jacek: „To nie jest potrzebne nikomu. Samo
  // obramowanie … wystarczy”). Ruch o ponad 10 px przed czasem przerywa przytrzymanie. Miejsce zostaje w telefonie (pasek-wysokosc: piksele nad zwykłym miejscem,
  // ujemne pod nim), a Ctrl+Z i Ctrl+Y cofają i ponawiają; „Cofnij” na ekranie od 28.10.2026 nie wyskakuje. Z klawiatury Alt+↑ i Alt+↓ na zakładce albo pigułce o 1 px.
  const dol = $('.dol'), waski = matchMedia('(max-width: 759px)');
  const PRZENIES_MS = 500, PROG_PASKA = 10, KROK = 1, RUCH_PASKA = { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' };
  const pasek = { id: null, x: 0, y: 0, zegar: 0, postep: 0, niesie: false, start: 0, min: 0, max: 0, teraz: null, bylRuch: false };
  let wysokosc = 0;
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
    // Nawigację przenosi przytrzymanie wolnego miejsca w pasie (28.10.2026, Jacek: „wykluczyć ten licznik czasu … przytrzymasz w środku … który łatwo trafić bez
    // trafienia do jakiejkolwiek innej ikony, to po pół sekundy … obramka”). Zakładkę i pigułkę przytrzymanie 450 ms podnosi do przestawienia (rzadPrzestawiany).
    if (e.target.closest('[role="tab"], [role="radio"]')) return;
    Object.assign(pasek, { id: e.pointerId, x: e.clientX, y: e.clientY, niesie: false });
    // Zakładkę i pigułkę trzyma jej rząd (przestawianie), resztę pasa bierze sam pas.
    if (!e.target.closest('[role="tab"], [role="radio"]')) { try { dol.setPointerCapture(e.pointerId); } catch { /* wskaźnik z testu */ } }
    // Po 0,5 s nawigacja się podnosi, z samą ramką (styl.css) i krótkim pyknięciem wibracji.
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

  // ---------------------------------------------------------------- przycisk asystenta: pływający, przenoszony, z małym oknem
  // Jacek, 27.10.2026 wieczorem: asystent ma „inny znaczek” (iskrę), być przezroczysty, dać się przenosić („żeby był pod ręką”), a przytrzymanie ma otwierać małe okno
  // z pytaniem o to, co widać. Na telefonie przycisk pływa nad treścią: szklane kółko stoi na środku dwóch skrajnych kolumn siatki (z lewej albo z prawej), a wysokość jest
  // dowolna. Przeciągnięcie przenosi go (po puszczeniu przyciąga do bliższej krawędzi), przytrzymanie 0,45 s bez ruchu otwiera małe okno, stuknięcie czat na cały ekran.
  // Miejsce zostaje w telefonie, a Ctrl+Z i Ctrl+Y cofają i ponawiają (reguła cofnij-i-ponow; „Cofnij” na ekranie od 28.10.2026 nie wyskakuje). Szybko puszczone
  // leci dalej jak krążek (rzut, niżej). Z klawiatury Alt+strzałki. Od 29.10.2026 kółko odpoczywa (2,67 s po użyciu przygasa do połowy, przy przewijaniu do ćwierci),
  // potrząśnięcie telefonem je chowa, a drugie przywraca do doku u góry, i bez zapisu startuje w tym doku (część „Odpoczynek i potrząśnięcie”, niżej).
  const plywak = (() => {
    const p = przyciskCzatu, DLUGO_MS = 450, PROG = 8;
    const sonda = el('div', { 'aria-hidden': 'true', style: 'position:absolute;visibility:hidden;height:0;pointer-events:none;padding:var(--km-gora) var(--km-prawo) var(--km-dol-min) var(--km-lewo)' });
    document.body.append(sonda);
    const zapis = pamiec.czytaj('ai-plywak', null);
    const ul = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);
    // x: miejsce w poziomie (ułamek), gdy kółko stanęło po rzucie; null to środek skrajnych kolumn po stronie b.
    const stan = { b: zapis && zapis.b === 'l' ? 'l' : 'p', y: zapis ? ul(zapis.y) : 0, x: zapis ? ul(zapis.x) : null };
    let g = null, lot = null;
    // Odpoczynek (29.10.2026, Jacek: „żeby ona się przygasła znacznie, jak jest przewijane … po dwóch sekundach … przygasała trochę … w 50% tego, co przy przewijaniu …
    // w gotowości, ale nie jest na maksa naświetlona, ale nie jest na minimum … przygasała w te 0,67”): 2 s po ostatnim użyciu kółko dostaje klasę spi i przez 0,67 s
    // gaśnie do 62,5% (czat.css), czyli o połowę tego, o ile gaśnie przy przewijaniu strony (do 25%, klasa przewija). Budzi je dotyk, klawiatura, przeniesienie
    // i zamknięcie czatu. Kółko w ruchu albo pod palcem nie zasypia.
    const SEN_MS = 2000;
    let zegarSnu = 0;
    function obudz() {
      clearTimeout(zegarSnu);
      p.classList.remove('spi');
      zegarSnu = setTimeout(() => { if (g || lot) obudz(); else p.classList.add('spi'); }, SEN_MS);
    }
    const ramy = () => {
      const s = getComputedStyle(sonda), x0 = parseFloat(s.paddingLeft) || 0, x1 = parseFloat(s.paddingRight) || 0, gora = parseFloat(s.paddingTop) || 0, dole = parseFloat(s.paddingBottom) || 0;
      // Siatka to ta, według której strona naprawdę układa rzędy (zakładki i pigułki stoją co 12 px od 26.10.2026), a nie sama zmienna --km-rynna: miejsce kółka to dwie skrajne
      // kolumny tej siatki. Kółko ma całe piksele i 48–56 px; cel dotyku 48 px wygrywa z siatką tam, gdzie miejsce jest ciaśniejsze (poniżej 380 px), i wtedy kółko stoi przy
      // samym marginesie. Iskra też ma całe piksele i tę samą parzystość co kółko: Chromium przyciąga znak z ułamkiem piksela, a pomiar (28.10.2026) pokazał go wtedy 0,4 px od środka.
      const rz = $('.karty'), rynna = (rz && parseFloat(getComputedStyle(rz).columnGap)) || 12;
      const kol = (innerWidth - x0 - x1 - 11 * rynna) / 12, miejsce = 2 * kol + rynna;
      const d = Math.round(Math.max(48, Math.min(56, miejsce))), przes = Math.max(0, (miejsce - d) / 2), par = d % 2, znak = Math.round((0.6 * d - par) / 2) * 2 + par;
      // Najwyżej kółko stoi na wysokości logo, w prawej części nagłówka (28.10.2026, Jacek: „obok Kasiomobile, tylko że w prawej sekcji”). W oknie auta (body.okno, nagłówka nie
      // ma) najwyżej pod paskiem okna z sercem, okiem i krzyżykiem (18–66 px pod pasem aparatu), żeby ich nie zasłaniało.
      const lg = $('.logo img'), lr = lg && lg.getBoundingClientRect();
      const ymin = document.body.classList.contains('okno') ? gora + 76 : lr && lr.height ? Math.max(gora + 4, Math.round(lr.top + lr.height / 2 - d / 2)) : gora + 8;
      return { d, znak, lewo: Math.round(x0 + przes), prawo: Math.round(innerWidth - x1 - d - przes), ymin, ymax: Math.max(ymin, innerHeight - d - Math.max(8, dole)) };
    };
    // Bez zapisu kółko stoi w doku u góry, obok logo, na jego osi (od 29.10.2026, Jacek: „Po włączeniu aplikacji, jeżeli nie ma innych przeciwwskazań lub ostatnich
    // ustawień … zaczynać od tego górnego … You decide”). Wysokość null (zapis sprzed tego dnia) to miejsce tuż nad chmurką nawigacji.
    // W oknie auta kółko z doku stoi w prawym dolnym rogu (od 29.10.2026, Jacek: „w specyfikacjach samochodu nie ma w ogóle tego clouda. That's useless”), bez zapisu:
    // po zamknięciu okna wraca do doku.
    const miejsce = (s) => {
      const r = ramy(), wOknie = document.body.classList.contains('okno');
      const y = wOknie && s.y === 0 ? r.ymax : s.y === null ? dol.offsetTop + 8 - 12 - r.d : r.ymin + s.y * (r.ymax - r.ymin);
      const x = Number.isFinite(s.x) ? Math.round(4 + s.x * Math.max(0, innerWidth - r.d - 8)) : s.b === 'l' ? r.lewo : r.prawo;
      return { x, y: Math.max(r.ymin, Math.min(r.ymax, Math.round(y))), d: r.d, znak: r.znak };
    };
    const ulamek = (y, r) => (r.ymax > r.ymin ? Math.round(((y - r.ymin) / (r.ymax - r.ymin)) * 1000) / 1000 : 0);
    const ulamekX = (x, r) => { const w = innerWidth - r.d - 8; return w > 0 ? Math.round(Math.min(1, Math.max(0, (x - 4) / w)) * 1000) / 1000 : 0; };
    const wolne = (x, y, r) => ({ b: x + r.d / 2 < innerWidth / 2 ? 'l' : 'p', x: ulamekX(x, r), y: ulamek(y, r) });
    function wstaw() {
      if (lot) return;
      const f = waski.matches && Boolean(czat), pierwszy = f && !p.classList.contains('czat-plywak');
      p.classList.toggle('czat-plywak', f);
      if (!f) { p.style.transform = ''; p.style.removeProperty('--ai-d'); p.style.removeProperty('--ai-s'); return; }
      // Pierwsze ustawienie (start aplikacji, zmiana szerokości okna) bez jazdy z lewego górnego rogu: ruch ma pokazywać tylko przesunięcie, które zrobił ktoś albo coś.
      if (pierwszy) p.classList.add('bez-ruchu');
      const q = miejsce(stan);
      p.style.setProperty('--ai-d', q.d + 'px');
      p.style.setProperty('--ai-s', q.znak + 'px');
      p.style.transform = `translate3d(${q.x}px, ${q.y}px, 0)`;
      p.dataset.bok = stan.b;
      if (pierwszy) { void p.offsetWidth; requestAnimationFrame(() => p.classList.remove('bez-ruchu')); }
    }
    const zapisz = () => pamiec.zapisz('ai-plywak', { b: stan.b, y: stan.y, x: stan.x });
    // Bez napisu „Zapytaj” przy kółku (28.10.2026, Jacek: „silly napis na ekranie, which I don't want”).
    const RZAD_AI = { cofnij: 'Cofnij przeniesienie asystenta', ustaw: (k) => { stan.b = k[0].b; stan.y = k[0].y; stan.x = ul(k[0].x); zapisz(); wstaw(); } };
    function przenies(nowy) {
      const przed = { b: stan.b, y: stan.y, x: stan.x };
      Object.assign(stan, { x: null }, nowy);
      zapisz();
      wstaw();
      obudz();
      if (przed.b === stan.b && przed.y === stan.y && przed.x === stan.x) return;
      PRZESTAWIENIA.wstecz.push({ rzad: RZAD_AI, przed: [przed], po: [{ b: stan.b, y: stan.y, x: stan.x }] });
      if (PRZESTAWIENIA.wstecz.length > 50) PRZESTAWIENIA.wstecz.shift();
      PRZESTAWIENIA.naprzod.length = 0;
      pokazCofnij(RZAD_AI);
      powiedz('Asystent: ' + (stan.b === 'l' ? 'lewa' : 'prawa') + ' strona');
    }
    // Rzut (28.10.2026, Jacek: „jak piłka … krążek hokejowy … curling”): kółko puszczone w ruchu (ponad 900 px/s) leci dalej, zwalnia jak krążek na lodzie i odbija
    // się od brzegów ekranu, spłaszczając się przy uderzeniu. Prawy górny róg (75% szerokości, od góry do dołu nagłówka, czyli do pola szukania) to strefa magnesu:
    // ściąga kółko na miejsce obok logo. Poza strefą kółko zostaje tam, gdzie stanęło. Przy ograniczonym ruchu staje od razu tam, gdzie by stanęło, bez spłaszczania.
    const RZUT = 900, TARCIE = 1.7, ODBICIE = 0.7, STOP = 40, MAGNES = 70, TLUMIK = 11;
    const strefa = (x, y, r, dolny) => dolny > 0 && x + r.d / 2 >= innerWidth * 0.25 && y + r.d / 2 <= dolny;
    function zatrzymajLot() {
      if (!lot) return null;
      cancelAnimationFrame(lot.raf);
      const q = { x: lot.x, y: lot.y };
      lot = null;
      p.classList.remove('leci');
      return q;
    }
    // o.wylot: kółko odbija się od brzegów o.odbic razy, potem brzegi go nie trzymają i wylatuje z ekranu (potrząśnięcie, niżej); na końcu woła o.koniec zamiast
    // zapisywać miejsce. o.wejscie: kółko wlatuje spoza ekranu, a magnes od razu ciągnie je do doku u góry; brzegi trzymają je dopiero, gdy jest na ekranie.
    function rzut(x0, y0, vx, vy, o = {}) {
      const r = ramy(), xmin = 4, xmax = Math.max(4, innerWidth - r.d - 4), dok = miejsce({ b: 'p', y: 0, x: null }), cicho = malyRuch.matches;
      const gl = $('.glowa'), dolny = gl && !document.body.classList.contains('okno') && !o.wylot ? gl.getBoundingClientRect().bottom : 0;
      const L = { x: x0, y: y0, raf: 0, mag: Boolean(o.wejscie), odbicia: 0, poza: Boolean(o.wejscie) };
      const tarcie = o.wylot ? 0.45 : TARCIE, odbicie = o.wylot ? 0.85 : ODBICIE;
      const zaEkranem = () => L.x < -r.d - 8 || L.x > innerWidth + 8 || L.y < -r.d - 8 || L.y > innerHeight + 8;
      lot = L;
      p.classList.add('leci');
      const splaszcz = (os, sila) => {
        if (cicho || sila < 320 || !p.animate) return;
        const s = Math.min(0.24, sila / 9000), a = (1 - s).toFixed(3), b = (1 + s * 0.7).toFixed(3);
        p.animate([{ scale: os === 'x' ? `${a} ${b}` : `${b} ${a}` }, { scale: '1 1' }], { duration: 280, easing: 'cubic-bezier(.3, 1.6, .5, 1)' });
        if (sila > 900 && navigator.vibrate) { try { navigator.vibrate(8); } catch { /* bez wibracji */ } }
      };
      // Kółko, które raz wpadło do strefy, zostaje przy magnesie: mocno rzucone odbija się od góry i bez tego wypadało dołem, zanim magnes je złapał.
      const krok = (h) => {
        if (!L.mag && strefa(L.x, L.y, r, dolny)) L.mag = true;
        if (L.mag) {
          vx += (dok.x - L.x) * MAGNES * h;
          vy += (dok.y - L.y) * MAGNES * h;
          const f = Math.exp(-TLUMIK * h);
          vx *= f; vy *= f;
        } else { const f = Math.exp(-tarcie * h); vx *= f; vy *= f; }
        L.x += vx * h;
        L.y += vy * h;
        if (L.poza) { if (L.x >= xmin && L.x <= xmax && L.y >= r.ymin && L.y <= r.ymax) L.poza = false; return; }
        if (o.wylot && L.odbicia >= (o.odbic ?? 2)) return;
        if (L.x < xmin) { L.x = xmin; splaszcz('x', -vx); vx = Math.abs(vx) * odbicie; L.odbicia++; } else if (L.x > xmax) { L.x = xmax; splaszcz('x', vx); vx = -Math.abs(vx) * odbicie; L.odbicia++; }
        if (L.y < r.ymin) { L.y = r.ymin; splaszcz('y', -vy); vy = Math.abs(vy) * odbicie; L.odbicia++; } else if (L.y > r.ymax) { L.y = r.ymax; splaszcz('y', vy); vy = -Math.abs(vy) * odbicie; L.odbicia++; }
      };
      const stoi = () => (o.wylot ? zaEkranem() : Math.hypot(vx, vy) < STOP && (!L.mag || Math.hypot(dok.x - L.x, dok.y - L.y) < 2));
      const wyladuj = () => {
        if (lot !== L) return;
        lot = null;
        p.classList.remove('leci');
        if (o.koniec) { o.koniec(); return; }
        przenies(L.mag ? { b: 'p', y: 0 } : wolne(L.x, L.y, r));
      };
      if (cicho) { if (!o.wylot && !o.wejscie) for (let i = 0; i < 2400 && !stoi(); i++) krok(1 / 240); else if (o.wejscie) L.mag = true; wyladuj(); return; }
      const t0 = performance.now();
      let ost = t0;
      const klatka = (teraz) => {
        if (lot !== L) return;
        let dt = Math.min(0.05, Math.max(0, teraz - ost) / 1000);
        ost = teraz;
        while (dt > 1e-6) { const h = Math.min(dt, 1 / 240); krok(h); dt -= h; }
        p.style.transform = `translate3d(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px, 0)`;
        if (stoi() || teraz - t0 > 6000) wyladuj(); else L.raf = requestAnimationFrame(klatka);
      };
      L.raf = requestAnimationFrame(klatka);
    }
    p.addEventListener('pointerdown', (e) => {
      if (!p.classList.contains('czat-plywak') || g || (e.pointerType === 'mouse' && e.button !== 0)) return;
      obudz();
      // Złapane w locie zostaje pod palcem, a puszczenie bez ruchu nie otwiera czatu.
      const zLotu = zatrzymajLot();
      if (zLotu) { bezKlikuAI = Date.now(); przenies(wolne(zLotu.x, zLotu.y, ramy())); }
      const q = zLotu || miejsce(stan);
      g = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: q.x, by: q.y, x2: q.x, y2: q.y, ruch: false, dlugo: false, zegar: 0, probki: [] };
      try { p.setPointerCapture(e.pointerId); } catch { /* wskaźnik z testu */ }
      p.classList.add('trzyma');
      g.zegar = setTimeout(() => {
        if (!g || g.ruch) return;
        g.dlugo = true;
        p.classList.remove('trzyma');
        if (navigator.vibrate) navigator.vibrate(12);
        czat.mini();
      }, DLUGO_MS);
    });
    p.addEventListener('pointermove', (e) => {
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.ruch && !g.dlugo && Math.hypot(dx, dy) > PROG) {
        g.ruch = true;
        clearTimeout(g.zegar);
        p.classList.remove('trzyma');
        p.classList.add('ciagniety');
      }
      if (!g.ruch) return;
      const r = ramy();
      g.x2 = Math.max(4, Math.min(innerWidth - r.d - 4, g.bx + dx));
      g.y2 = Math.max(r.ymin, Math.min(r.ymax, g.by + dy));
      p.style.transform = `translate3d(${g.x2}px, ${g.y2}px, 0)`;
      g.probki.push({ t: performance.now(), x: g.x2, y: g.y2 });
      if (g.probki.length > 8) g.probki.shift();
    });
    const koniec = (e, przerwane) => {
      if (!g || e.pointerId !== g.id) return;
      clearTimeout(g.zegar);
      p.classList.remove('trzyma', 'ciagniety');
      const s = g;
      g = null;
      obudz();
      if (!s.ruch && !s.dlugo) return;
      bezKlikuAI = Date.now();
      if (!s.ruch) return;
      if (przerwane) { wstaw(); return; }
      // Prędkość z ostatnich 90 ms ruchu. Palec, który stanął przed puszczeniem (ponad 60 ms bez ruchu), nie rzuca.
      const r = ramy(), teraz = performance.now(), pr = s.probki.filter((q) => teraz - q.t <= 90);
      let vx = 0, vy = 0;
      if (pr.length >= 2 && teraz - pr[pr.length - 1].t < 60) {
        const a = pr[0], z = pr[pr.length - 1], dt = (z.t - a.t) / 1000;
        if (dt > 0.008) { vx = (z.x - a.x) / dt; vy = (z.y - a.y) / dt; }
      }
      const v = Math.hypot(vx, vy);
      if (v > RZUT) { const k = Math.min(1, 5000 / v); rzut(s.x2, s.y2, vx * k, vy * k); return; }
      przenies({ b: s.x2 + r.d / 2 < innerWidth / 2 ? 'l' : 'p', y: ulamek(s.y2, r) });
    };
    p.addEventListener('pointerup', (e) => koniec(e, false));
    p.addEventListener('pointercancel', (e) => koniec(e, true));
    p.addEventListener('lostpointercapture', (e) => koniec(e, true));
    p.addEventListener('keydown', (e) => {
      if (!p.classList.contains('czat-plywak')) return;
      obudz();
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); czat.mini(); return; }
      if (!e.altKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      e.preventDefault();
      const r = ramy(), q = miejsce(stan), krok = e.key === 'ArrowUp' ? -16 : e.key === 'ArrowDown' ? 16 : 0;
      przenies({ b: e.key === 'ArrowLeft' ? 'l' : e.key === 'ArrowRight' ? 'p' : stan.b, y: ulamek(Math.max(r.ymin, Math.min(r.ymax, q.y + krok)), r) });
    });
    p.addEventListener('contextmenu', (e) => { if (p.classList.contains('czat-plywak')) e.preventDefault(); });
    p.addEventListener('focus', obudz);
    // Zamknięty czat (cały ekran albo małe okno) budzi kółko: wraca pełne i po 2,67 s znowu przygasa. Otwarte i zamknięte okno auta (body.okno) przestawia kółko z doku
    // do prawego dolnego rogu i z powrotem.
    let czatBylOtwarty = false, bylWOknie = false;
    new MutationObserver(() => {
      const o = document.body.classList.contains('czat-otwarty') || document.body.classList.contains('czat-mini'), wo = document.body.classList.contains('okno');
      if (czatBylOtwarty && !o) obudz();
      czatBylOtwarty = o;
      if (wo !== bylWOknie) { bylWOknie = wo; if (!lot && !g) { p.classList.add('bez-ruchu'); wstaw(); void p.offsetWidth; p.classList.remove('bez-ruchu'); obudz(); } }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // Potrząśnięcie (29.10.2026, Jacek: „typowe shake telefonem, jak się trzyma, powinien chować ten AI. A jeszcze jeden shake … I zawsze zadokowane w tym magnetycznej
    // sekcji, tak? U góry”): ręczne potrząśnięcie to co najmniej 4 wychyły ponad 13 m/s² w jednej osi, na zmianę w obie strony, w ciągu sekundy. Chodzenie (2–5 m/s²)
    // i pojedyncze uderzenie (telefon odłożony na stół) tego nie dają. Pierwsze chowa kółko (schowany), drugie przywraca je do doku u góry, obok logo, bez jazdy przez ekran.
    // Przy otwartym czacie nic. Przyspieszenie bez grawitacji (acceleration), a gdy telefon go nie daje, z grawitacją, od której odejmujemy jej wolno liczoną średnią.
    // Na iPhonie strona dostaje ruch dopiero po zgodzie (DeviceMotionEvent.requestPermission), więc tam do czasu zmiany w Swift potrząśnięcie nic nie robi.
    // Fizyka (od 29.10.2026 wieczorem, Jacek z dyktafonu: „zaczyna rzucać po ekranie, aż wypada … powiązane z tym właśnie twoim ruchem … dynamiką żyroskopu … jeśli tak za wolno
    // tym trzepiesz, to go nie rusza … szybko enough … wyrzuca z ekranu. A potem się pojawia w ten sam sposób. Skakuje na ekran i leci do góry … przykleja się”): siła to średnia
    // wychyłów potrząśnięcia. Do 17 m/s² kółko tylko podskakuje po ekranie i zostaje tam, gdzie stanie; mocniej leci w stronę wychyłu, dwa razy odbija się od brzegów i wylatuje.
    // Drugie potrząśnięcie wrzuca je spod dolnego brzegu, a magnes ciągnie je do doku u góry. Przy ograniczonym ruchu bez lotu: od razu schowane albo od razu w doku.
    const TRZES = { prog: 13, ile: 4, okno: 1000, przerwa: 1200, wychyl: 250, wyrzut: 17 };
    let piki = [], poTrzes = -1e9, grawitacja = null;
    function trzesienie(sila = TRZES.wyrzut, os = 0, zn = 1) {
      const wraca = p.classList.contains('schowany');
      if (navigator.vibrate) { try { navigator.vibrate(wraca ? [10, 60, 10] : 12); } catch { /* bez wibracji */ } }
      if (wraca) {
        if (malyRuch.matches) {
          p.classList.add('bez-ruchu');
          przenies({ b: 'p', y: 0 });
          void p.offsetWidth;
          p.classList.remove('schowany');
          requestAnimationFrame(() => p.classList.remove('bez-ruchu'));
        } else {
          const dok = miejsce({ b: 'p', y: 0, x: null }), x0 = Math.max(4, dok.x - 40), y0 = innerHeight + 12;
          p.classList.add('leci');
          p.style.transform = `translate3d(${x0}px, ${y0}px, 0)`;
          p.classList.remove('schowany');
          rzut(x0, y0, 260, -3400, { wejscie: true });
        }
        obudz();
        powiedz('Asystent wrócił');
        return;
      }
      const zLotu = zatrzymajLot(), q = zLotu || miejsce(stan);
      if (g) { clearTimeout(g.zegar); g = null; p.classList.remove('trzyma', 'ciagniety'); }
      // Kierunek: oś X telefonu to oś X ekranu, oś Y telefonu rośnie w górę ekranu, a oś Z (do patrzącego) rzuca w pionie. Bezwładność niesie kółko przeciwnie do wychyłu.
      const v = Math.min(5200, Math.max(1500, sila * 150)), k = -zn, skos = 0.35 * v;
      const [vx, vy] = os === 0 ? [k * v, -skos] : os === 1 ? [skos, -k * v] : [skos, k * v];
      if (sila < TRZES.wyrzut) { obudz(); if (malyRuch.matches) return; rzut(q.x, q.y, vx * 0.5, vy * 0.5); return; }
      const schowaj = () => { p.classList.add('schowany'); powiedz('Asystent schowany. Potrząśnij telefonem, żeby wrócił.'); };
      if (malyRuch.matches) { wstaw(); schowaj(); return; }
      rzut(q.x, q.y, vx, vy, { wylot: true, odbic: 2, koniec: schowaj });
    }
    addEventListener('devicemotion', (e) => {
      if (!p.classList.contains('czat-plywak') || document.body.classList.contains('czat-otwarty') || document.body.classList.contains('czat-mini')) return;
      const a = e.acceleration;
      let v;
      if (a && Number.isFinite(a.x)) v = [a.x, a.y || 0, a.z || 0];
      else {
        const b = e.accelerationIncludingGravity;
        if (!b || !Number.isFinite(b.x)) return;
        const s = [b.x, b.y || 0, b.z || 0];
        grawitacja = grawitacja ? grawitacja.map((q, i) => q * 0.9 + s[i] * 0.1) : s;
        v = s.map((q, i) => q - grawitacja[i]);
      }
      const t = performance.now();
      if (t - poTrzes < TRZES.przerwa) return;
      let os = 0;
      for (let k = 1; k < 3; k++) if (Math.abs(v[k]) > Math.abs(v[os])) os = k;
      if (Math.abs(v[os]) < TRZES.prog) return;
      const zn = v[os] > 0 ? 1 : -1, ost = piki[piki.length - 1];
      const wy = Math.abs(v[os]);
      if (ost && ost.os === os && ost.zn === zn && t - ost.t < TRZES.wychyl) { ost.t = t; ost.a = Math.max(ost.a, wy); return; }
      if (!ost || ost.os !== os || ost.zn === zn || t - piki[0].t > TRZES.okno) piki = [];
      piki.push({ t, os, zn, a: wy });
      if (piki.length >= TRZES.ile) { const sila = piki.reduce((s, x) => s + x.a, 0) / piki.length; piki = []; poTrzes = t; trzesienie(sila, os, zn); }
    });
    waski.addEventListener('change', wstaw);
    addEventListener('resize', wstaw);
    if (window.visualViewport) visualViewport.addEventListener('resize', wstaw);
    if (window.ResizeObserver) new ResizeObserver(wstaw).observe(dol);
    wstaw();
    obudz();
    return { wstaw, stan: () => ({ b: stan.b, y: stan.y, x: stan.x }), miejsce: () => miejsce(stan), leci: () => Boolean(lot),
      obudz, trzesienie, spi: () => p.classList.contains('spi'), schowany: () => p.classList.contains('schowany') };
  })();

  // ---------------------------------------------------------------- ściąga „i” od trzeciego dnia (od 29.10.2026)
  // Jacek, 24.10.2026: „tak prosto, że nie będzie potrzeba ściągi”, a 29.10.2026 w Fiszkach: „na razie będzie [bez], ale zrobimy twist i drugiego, czy trzeciego dnia
  // to się pojawi, okej? Trzeciego dnia. Użytkowania”. Telefon pamięta dni, w których aplikacja była otwarta (auta-dni, najwyżej trzy daty), i od trzeciego takiego
  // dnia w nagłówku na telefonie stoi kółko „i” na środku kolumn 9 i 10 siatki, tuż przed dokiem asystenta (kolumny 11 i 12). Kółka nie ma w nagłówku, póki nie przyjdzie
  // ten dzień, więc układ pierwszych dni się nie zmienia. Klik otwiera ściągę ukrytych gestów: osobne okienko na środku, bez tytułu i bez „Gotowe”, przesuwane chwytem
  // (myszą w dowolnym wolnym miejscu, palcem za pas u góry) i skalowane uchwytem w prawym dolnym rogu albo Ctrl i kółkiem od 75 do 160%. Zamyka je krzyżyk, Escape
  // i Wstecz. Niespodzianek (HAL z logo i z narysowanego kółka, prank) ściąga nie zdradza. ?dni=3 w adresie pokazuje kółko od razu (testy i zrzuty).
  const sciaga = (() => {
    const dzis = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const zAdresu = Number(new URLSearchParams(location.search).get('dni')) || 0;
    const dni = () => {
      const z = pamiec.czytaj('dni', []), l = Array.isArray(z) ? z.filter((x) => typeof x === 'string').slice(-3) : [], t = dzis();
      if (!l.includes(t) && l.length < 3) { l.push(t); pamiec.zapisz('dni', l); }
      return Math.max(l.length, zAdresu);
    };
    // Znaki rysowane w polu 24 × 24 ze środkiem w (12, 12), 20 px w kółku 32 px (po 6 px z każdej strony); pomiar środka: Plik Fucken Robocze\pomiar-sciagi.mjs.
    const SVG = (w, d) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
    const ZNAKI = {
      stuknij: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7.5"/>',
      przytrzymaj: '<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="9.6" opacity=".45"/>',
      przenies: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
      potrzasnij: '<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.6 9.2a4.4 4.4 0 0 0 0 5.6M19.4 9.2a4.4 4.4 0 0 1 0 5.6"/>',
      wBok: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
      naGore: '<path d="M6 4.5h12M12 9v10.5M7.5 13.5 12 9l4.5 4.5"/>',
      kolejnosc: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></g>',
      pas: '<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
      krawedz: '<path d="M5 4.5v15M9 12h10M15.5 8.5 19 12l-3.5 3.5"/>',
      kolko: '<path d="M18.4 8.2A7.5 7.5 0 1 1 12 4.5"/><path d="M15.5 2.8 18.6 4.6 16.8 7.7"/>',
    };
    const CZESCI = [
      ['Kółko asystenta', [['stuknij', 'Stuknij', 'Rozmowa'], ['przytrzymaj', 'Przytrzymaj', 'Pytanie o to, co widać'], ['przenies', 'Przeciągnij albo rzuć', 'Inne miejsce'],
        ['potrzasnij', 'Potrząśnij telefonem', 'Schowaj albo pokaż'], ['stuknij', 'Stuknij dymek w rozmowie', 'Kopiuj, popraw, usuń'], ['kolko', 'Narysuj palcem kółko', 'HAL 9000, rozmowa głosem']]],
      ['Oferty', [['wBok', 'Przesuń auto w bok', 'Następne auto'], ['naGore', 'Stuknij zakładkę drugi raz', 'Na górę listy']]],
      ['Zakładki i pas', [['kolejnosc', 'Przytrzymaj zakładkę', 'Zmień kolejność'], ['pas', 'Przytrzymaj pas', 'W górę albo w dół'], ['krawedz', 'Przesuń od lewej krawędzi', 'Wstecz']]],
    ];
    const ZNAK_I = '<circle cx="12" cy="6.8" r="1.65" fill="currentColor" stroke="none"/><path d="M12 10.6v7" stroke-width="2.6"/>';
    const ZNAK_X = '<path d="M7 7l10 10M17 7 7 17" stroke-width="2.2"/>';
    let kolko = null, okno = null, s = 1, xy = null, g = null;
    // Kółko „i” na środku kolumn 9 i 10 siatki strony (rynna rzędów jak w plywak.ramy), w rzędzie nagłówka, więc stoi na osi logo.
    function ulozKolko() {
      if (!kolko || !kolko.isConnected) return;
      const gl = $('.glowa'), rz = $('.karty');
      if (!gl || !rz) return;
      const r = rz.getBoundingClientRect(), rynna = parseFloat(getComputedStyle(rz).columnGap) || 12, kol = (r.width - 11 * rynna) / 12;
      const srodek = r.left + 8 * (kol + rynna) + (2 * kol + rynna) / 2, prawa = gl.getBoundingClientRect().right - parseFloat(getComputedStyle(gl).paddingRight);
      kolko.style.marginRight = Math.round(prawa - srodek - 24) + 'px';
    }
    function pokazKolko() {
      if (kolko || dni() < 3) return;
      kolko = el('button', { type: 'button', id: 'gesty', class: 'gesty', 'aria-label': 'Pokaż gesty', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
      kolko.innerHTML = SVG(20, ZNAK_I);
      kolko.addEventListener('click', () => (otwarta() ? zamknij() : otworz()));
      if (window.Czat && Czat.dymek) Czat.dymek(kolko);
      const gl = $('.glowa'), ai = $('#czat-otworz');
      if (ai && ai.parentNode === gl) gl.insertBefore(kolko, ai); else gl.append(kolko);
      ulozKolko();
    }
    const otwarta = () => Boolean(okno && !okno.hidden);
    function zbuduj() {
      okno = el('div', { class: 'sciaga', role: 'dialog', 'aria-label': 'Gesty', tabindex: '-1', hidden: '' });
      const gora = el('div', { class: 'sciaga-gora' }), x = el('button', { type: 'button', class: 'sciaga-x', 'aria-label': 'Zamknij' });
      x.innerHTML = SVG(20, ZNAK_X);
      x.addEventListener('click', zamknij);
      gora.append(x);
      const tresc = el('div', { class: 'sciaga-tresc' });
      for (const [tytul, l] of CZESCI) {
        const ul = el('ul');
        for (const [z, gest, skutek] of l) {
          const znak = el('span', { class: 'sciaga-znak' });
          znak.innerHTML = SVG(20, ZNAKI[z]);
          ul.append(el('li', null, znak, el('span', null, el('b', { text: gest }), el('span', { class: 'skutek', text: skutek }))));
        }
        tresc.append(el('section', { class: 'sciaga-czesc' }, el('h2', { text: tytul }), ul));
      }
      const uchwyt = el('span', { class: 'sciaga-uchwyt', 'aria-hidden': 'true' });
      uchwyt.innerHTML = SVG(16, '<path d="M15 7 7 15M15 11.5 11.5 15"/>');
      okno.append(gora, tresc, uchwyt);
      document.body.append(okno);
      // Przesuwanie: mysz w dowolnym wolnym miejscu, palec za pas u góry (w treści palec przewija). Skalowanie: uchwyt w rogu albo Ctrl i kółko.
      okno.addEventListener('pointerdown', (e) => {
        const naUchwycie = e.target.closest('.sciaga-uchwyt');
        if (e.button !== 0 || (!naUchwycie && e.target.closest('button'))) return;
        if (!naUchwycie && e.pointerType !== 'mouse' && !e.target.closest('.sciaga-gora')) return;
        const r = okno.getBoundingClientRect();
        g = { id: e.pointerId, x: e.clientX, y: e.clientY, l: xy.x, t: xy.y, w: r.width, s, skaluj: Boolean(naUchwycie), ruch: false };
        try { okno.setPointerCapture(e.pointerId); } catch { /* wskaźnik z testu */ }
      });
      okno.addEventListener('pointermove', (e) => {
        if (!g || e.pointerId !== g.id) return;
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!g.ruch && Math.hypot(dx, dy) < 5) return;
        g.ruch = true;
        if (g.skaluj) skala(g.s * (g.w + dx) / g.w); else { xy = { x: g.l + dx, y: g.t + dy }; uloz(); }
      });
      const puszczone = (e) => { if (g && e.pointerId === g.id) g = null; };
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) okno.addEventListener(t, puszczone);
      okno.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); skala(s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); }, { passive: false });
      okno.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zamknij(); } });
    }
    // Okno ma CSS zoom, więc położenie, szerokość i wysokość podajemy w jego pikselach (dzielone przez skalę). Nigdy nie wychodzi poza ekran: na wąskim telefonie
    // powiększenie daje większe litery w ramce na szerokość ekranu bez 12 px z każdej strony.
    function uloz() {
      okno.style.zoom = String(s);
      okno.style.width = Math.min(360, (innerWidth - 24) / s) + 'px';
      okno.style.maxHeight = Math.max(160, (innerHeight - 24) / s) + 'px';
      const rr = okno.getBoundingClientRect(), w = rr.width, h = rr.height;
      if (!xy) xy = { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2 };
      xy = { x: Math.min(Math.max(12, xy.x), Math.max(12, innerWidth - w - 12)), y: Math.min(Math.max(12, xy.y), Math.max(12, innerHeight - h - 12)) };
      okno.style.left = Math.round(xy.x) / s + 'px';
      okno.style.top = Math.round(xy.y) / s + 'px';
    }
    function skala(n) { s = Math.round(Math.min(1.6, Math.max(0.75, n)) * 100) / 100; uloz(); }
    function otworz() {
      if (!okno) zbuduj();
      okno.hidden = false;
      xy = null;
      uloz();
      if (kolko) kolko.setAttribute('aria-expanded', 'true');
      okno.focus({ preventScroll: true });
    }
    function zamknij() {
      if (!otwarta()) return;
      okno.hidden = true;
      g = null;
      if (kolko) { kolko.setAttribute('aria-expanded', 'false'); kolko.focus({ preventScroll: true }); }
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && otwarta()) { e.preventDefault(); zamknij(); } });
    addEventListener('resize', () => { ulozKolko(); if (otwarta()) uloz(); });
    if (window.ResizeObserver) { const ro = new ResizeObserver(ulozKolko); for (const q of ['.glowa', '.karty']) { const e = $(q); if (e) ro.observe(e); } }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pokazKolko(); });
    pokazKolko();
    return { otworz, zamknij, otwarta, kolko: () => Boolean(kolko), dni, skala: (n) => (n === undefined ? s : skala(n)) };
  })();

  // ---------------------------------------------------------------- gesty od krawędzi: wstecz i dalej
  // Jacek, 27.10.2026 wieczorem: „swipe back by dragging your finger from left to right … w drugą stronę go deeper”. Od lewej krawędzi w prawo to Wstecz (to samo co przycisk
  // Wstecz w Androidzie), od prawej w lewo Dalej: powtarza ostatnie wyjście (zamknięty czat, pigułka, z której wróciliśmy) przez dwie minuty. iPhone ma własny gest wstecz
  // w powłoce (Aplikacja.swift), więc tam lewy pas nie stoi. Pasy mają 16 px, tyle co margines strony, i działają tylko na dotyk.
  const DALEJ = [], PROG_KRAWEDZI = 64;
  function dalej() {
    const f = DALEJ.pop();
    if (!f || Date.now() - f.t > 120000) return false;
    try { return f.zrob() !== false; } catch { return false; }
  }
  function wsteczZDalej() {
    const cz = Boolean(czat) && czat.otwarty() && !czat.halOtwarty() && !czat.miniOtwarty(), id = ID_ZAKLADEK[widok], pig = wybrane[id];
    if (!wstecz()) return false;
    if (cz && !czat.otwarty()) DALEJ.push({ t: Date.now(), zrob: () => { czat.otworz(); return true; } });
    else if (!cz && PIGULKI[id] && ID_ZAKLADEK[widok] === id && wybrane[id] !== pig) DALEJ.push({ t: Date.now(), zrob: () => { ustawPigulke(id, pig, true, true); return true; } });
    return true;
  }
  if (czat) {
    const strzalka = (l) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${l ? 'M14.5 6.5 9 12l5.5 5.5' : 'M9.5 6.5 15 12l-5.5 5.5'}"/></svg>`;
    for (const strona of ['l', 'p']) {
      if (strona === 'l' && window.KASIOMOBILE_POWLOKA) continue;
      const k = el('div', { class: 'krawedz krawedz-' + strona, 'aria-hidden': 'true' }, el('span', { class: 'krawedz-znak', html: strzalka(strona === 'l') }));
      document.body.append(k);
      const kier = strona === 'l' ? 1 : -1;
      let s = null;
      k.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' || s) return;
        s = { id: e.pointerId, x: e.clientX, y: e.clientY, ruch: false };
        try { k.setPointerCapture(e.pointerId); } catch { /* wskaźnik z testu */ }
      });
      k.addEventListener('pointermove', (e) => {
        if (!s || e.pointerId !== s.id) return;
        const dx = kier * (e.clientX - s.x), dy = e.clientY - s.y;
        if (!s.ruch && dx > 10 && dx > Math.abs(dy) * 1.5) { s.ruch = true; k.classList.add('ciagnie'); }
        if (!s.ruch) return;
        k.style.setProperty('--k-dx', Math.min(Math.max(dx, 0), 90) + 'px');
        k.style.setProperty('--k-y', Math.round(s.y) + 'px');
        k.classList.toggle('gotowe', dx >= PROG_KRAWEDZI);
      });
      const puszczone = (e, przerwane) => {
        if (!s || e.pointerId !== s.id) return;
        const dx = kier * (e.clientX - s.x), ruch = s.ruch;
        s = null;
        k.classList.remove('ciagnie', 'gotowe');
        k.style.removeProperty('--k-dx');
        if (ruch && !przerwane && dx >= PROG_KRAWEDZI) (strona === 'l' ? wsteczZDalej : dalej)();
      };
      k.addEventListener('pointerup', (e) => puszczone(e, false));
      k.addEventListener('pointercancel', (e) => puszczone(e, true));
    }
  }
  // ---------------------------------------------------------------- co widać na ekranie (małe okno asystenta) i nawigacja spod belki
  // Opis tego, co widać, dla małego okna (czat.js, o.widok): krótko do napisu nad rozmową, a w całości, z tytułem i treścią otwartego okna w stronie, do komputera.
  function opisWidoku() {
    const id = ID_ZAKLADEK[widok], nazwa = NAZWY[widok], k = klucz(widok), s = STRONY[k];
    const pig = { teraz: 'Teraz', historia: 'Historia', podium: 'Ranking', modele: 'Modele', marki: 'Marki', leasing: 'Leasing', kredyt: 'Kredyt', skrot: 'Skrót', calosc: 'Całość' }[wybrane[id]] || '';
    const czysc = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    let tytul = '', tresc = '';
    try {
      const d = s && s.el.contentDocument, okno = d && d.querySelector('dialog[open]');
      if (okno) { const h = okno.querySelector('h1, h2, h3'); tytul = h ? h.textContent : ''; tresc = okno.innerText || okno.textContent; }
      else if (d) { const h = d.querySelector('h1'); tytul = h && h.getClientRects().length ? h.textContent : ''; }
    } catch { /* strona się jeszcze wczytuje */ }
    tytul = czysc(tytul).slice(0, 80);
    tresc = czysc(tresc).slice(0, 360);
    return { krotko: [nazwa, tytul || pig].filter(Boolean).join(' · ').slice(0, 48),
      pelny: `zakładka ${nazwa}${pig ? ', część ' + pig : ''}${tytul ? ', otwarte: ' + tytul : ''}${tresc ? '. Treść okna: ' + tresc : ''}`.slice(0, 480) };
  }
  // Nawigacja wyjeżdża spod belki za palcem (czat.js, belka): p od 0 do 1, null kończy i oddaje ją stylom.
  let zegarRuchu = 0;
  function ruchNawigacji() {
    document.body.classList.add('czat-ruch');
    clearTimeout(zegarRuchu);
    zegarRuchu = setTimeout(() => document.body.classList.remove('czat-ruch'), 450);
  }
  function wysunNawigacje(p) {
    if (p === null || p === undefined) { ruchNawigacji(); for (const a of ['transition', 'transform', 'opacity', 'visibility']) dol.style[a] = ''; return; }
    dol.style.transition = 'none';
    dol.style.visibility = 'visible';
    dol.style.opacity = String(Math.min(1, p * 1.4));
    dol.style.transform = `translateY(${Math.round((1 - p) * (dol.offsetHeight + 32))}px)`;
  }

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
    naStarcie, pierwsze, odswiez, pokazWidok, wstecz: wsteczZDalej, dalej, plywak, filtry: ustawFiltry, czat, sciaga,
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