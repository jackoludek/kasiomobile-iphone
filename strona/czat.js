// czat.js: asystent Kasiomobile w aplikacji (od 19.10.2026). Jeden kod dla iPhone'a, Androida, komputera i wersji w przeglądarce.
// Jacek, 19.10.2026: „THE APKA MUSI KONIECZNIE MIEĆ SPOSÓB A VOICE RECOGNITION (OUR BOX SOLUTION THAT WE WILL FEED WITH SONIOX API)
// ANDROID AND IN IPHONE – AS WELL AS ON PC (TU JUŻ MAMY – WYSTARCZY EMBEDDED SIMPLY CHATBOX) … FAJNE ŻEBY MIAŁA RĘCE – … JAK O COŚ
// ŻONA ZAPYTA TO MOŻE PRZENIEŚĆ SIĘ DO WŁAŚCIWEJ SEKCJI … OTHERWISE JUST CHAT AWAY – PROPOSE LINKS TO SPECS ARTICLES … LESS, BUT BETTER”.
//
// Pytanie idzie na kanał ntfy.sh „<kanał>-pytanie”, a komputer w domu (Asystent\asystent.js, Kiro CLI) odpisuje na
// „<kanał>-odpowiedz”, zwykle po 8–15 sekundach. Odpowiedź może pokazać zakładkę, model albo Podium („ręce”, opcje.pokaz)
// i polecić do trzech odnośników. Rozmowa zostaje w pamięci urządzenia (ostatnie 40 wiadomości), a pytanie bez odpowiedzi
// czeka dalej także po zamknięciu aplikacji, do 90 sekund od wysłania.
// Mikrofon (Soniox, rozpoznawanie mowy na żywo; od 26.10.2026 także duży na pustej rozmowie) stoi od razu, póki komputer nie powie, że klucza nie da (pole „glos” w każdej
// odpowiedzi), a przeglądarka umie nagrywać: Android i strona w sieci w Safari albo Chrome. Telefon dostaje od komputera
// krótki, jednorazowy klucz z Bramy Opusa i nagrywa w stronie (getUserMedia i MediaRecorder, tak samo jak Web SDK Soniox). Aplikacja
// na iPhone'a (auta://) nagrywa w Swift (od 26.10.2026, Aplikacja.swift, klasa Glos): dostaje glosNatywny.start(klucz, ustawienia),
// sama łączy się z Soniox i oddaje jego wiadomości przez Czat.zGlosu, a tekst z nich liczy ta sama funkcja co w stronie (zSoniox).
// Gdy rozpoznawanie uzna, że pytanie się skończyło, pytanie idzie samo. W oknie na komputerze mikrofonu nie ma, bo tam
// dyktuje Dyktowanie (kółko myszy wkleja tekst w pole pytania i daje Enter). Test bez prawdziwego Soniox: testy/mikrofon.mjs.
//
//   const czat = Czat.uruchom({ kanal, tryb: 'arkusz' | 'panel' | 'strona', skad, miejsce, zakladka(), pokaz(p, reka), zamknij(),
//                               mikrofon: true, glosNatywny: { start(klucz, ustawienia), stop(zaraz) }, naZmiane(otwarty),
//                               dol(): ile pikseli od dołu ekranu ma zostać widać pod arkuszem, na przykład nawigacja aplikacji,
//                               widok(): { krotko, pelny } opis tego, co widać na ekranie (małe okno), kotwica(): prostokąt przycisku asystenta,
//                               nawigacja(p): p od 0 do 1 mówi, jak wysoko wyjechała nawigacja aplikacji spod belki, null kończy })
//   czat.mini(): małe okno po przytrzymaniu przycisku asystenta (od 27.10.2026 wieczorem); stuknięcie w przycisk, „Otwórz na cały ekran”
//                albo odpowiedź spoza ekranu rozwija je na cały ekran, tak samo odpowiedź na pytanie o rzecz wskazaną celownikiem (od 29.10.2026),
//                a belka na dole pełnego okna zamyka czat i przywraca nawigację.
//   Czat.dymek(przycisk): dymek przy ikonce bez podpisu. Wołaj go przed dodaniem własnego „click”.
//   czat.wstecz(): Wstecz w telefonie; zamyka menu rozmowy, z archiwum i kosza wraca do Historii, zamyka Historię, a gdy jej nie ma,
//                  rozmowę (true, gdy coś zamknął).
// Historia (od 26.10.2026): „Nowa rozmowa” odkłada bieżącą do Historii, a „Rozmowy” pokazują wcześniejsze i wracają do każdej z nich.
// Pasek u góry (od 28.10.2026, jak w aplikacjach czatu na iPhonie i w pasku nawigacji Apple): Rozmowy (w listach strzałka wstecz), tytuł, Nowa rozmowa i krzyżyk,
// każde na stałym miejscu siatki 12 kolumn. Nowa rozmowa wraca do pustej rozmowy z pytaniami na stałe.
// Wskazanie (próba od 28.10.2026, tylko małe okno): celownik przeciągnięty na rzecz w aplikacji mówi komputerowi, o którą rzecz chodzi (pole „w”).
'use strict';
(() => {
  // Ścieżki do zrzutów w pytaniu (od 7.11.2026, Jacek: „zamiast tego linku pokazywał się thumbnail tego właściwego screenshotu”): program do zrzutów wkleja
// ścieżkę jako tekst. Dymek pokazuje miniaturę (stuknięcie: cały ekran), a tytuł rozmowy bierze słowa po ścieżce. Do asystenta ścieżka idzie dalej, a komputer
// czyta plik i pokazuje go modelowi.
const OBRAZ_RE = /[A-Za-z]:\\(?:[^\\\n:*?"<>|]+\\)*[^\\\n:*?"<>|]*?\.(?:png|jpe?g|webp|gif)\b/gi;
const FOLDER_RE = /^[A-Za-z]:\\(?:[^\\\n]+\\)+(?:\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2})?\s*/;
const obrazyZ = (t) => String(t || '').match(OBRAZ_RE) || [];
const bezSciezek = (t) => String(t || '').replace(OBRAZ_RE, ' ').replace(FOLDER_RE, '').replace(/\s+/g, ' ').trim();
function pelnyObraz(src) {
  const z = el('div', { class: 'czat-obraz-pelny', role: 'dialog', 'aria-label': 'Obraz', tabindex: '-1' }, el('img', { src, alt: '' }));
  const zamk = () => { z.remove(); removeEventListener('keydown', kl, true); };
  const kl = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zamk(); } };
  z.addEventListener('click', zamk);
  addEventListener('keydown', kl, true);
  document.body.append(z);
  z.focus({ preventScroll: true });
}
const SERWER = 'https://ntfy.sh', SONIOX = 'wss://stt-rt.soniox.com/transcribe-websocket';
// Autor rozmowy (od 7.11.2026, Jacek: urządzenia Apple „To będzie Kasia. Jacek jest na Androidzie i na Windowsie … na Linuxie”).
const autorZ = (skad) => (skad === 'iPhone' || (skad !== 'Android' && skad !== 'komputer' && /iPhone|iPad|Macintosh/.test(navigator.userAgent)) ? 'Kasia' : 'Jacek');
  const CZEKAJ_MS = 90000, KLUCZ_MS = 20000, NAJWIECEJ = 40, NOWA_ROZMOWA_MS = 6 * 3600 * 1000;
  // Nazwy zakładek w bierniku, do przycisku „Pokaż …” pod odpowiedzią. Od 19.10.2026 „katalog” to Oferty (do 25.10.2026 Ogłoszenia, razem z dawnym
  // „Nowe”, które zostaje dla starych odpowiedzi w pamięci), a „modele” to Podium (do 25.10.2026 Katalag). Od 25.10.2026 „kredyt” to Finanse, „historia”
  // pigułka Historia w Ogłoszeniach, a „poradnik” zakładka Poradnik.
  const BIERNIK = { katalog: 'Oferty', nowe: 'Oferty', modele: 'Podium', kredyt: 'Finanse', historia: 'Historię', poradnik: 'Poradnik' };
  // Podpowiedzi w barwach zakładek, których dotyczą (od 26.10.2026): Podium niebieskie, Oferty zielone, Poradnik fioletowy, Finanse pomarańczowe.
  const PODPOWIEDZI = [['Najbezpieczniejsze auto do 90 tys. zł?', 'modele'], ['Co nowego dziś na Otomoto?', 'katalog'], ['Czy Corolla kombi zmieści psa?', 'poradnik'], ['Ile wyjdzie rata za 60 tys. zł?', 'kredyt']];
  // Własne pytania na stałe (od 27.10.2026; Jacek: „możliwość edytowania i ustawienia sobie własnych pytań na stałe, a jeden klik za pytanie”): na pustej rozmowie
  // zamiast czterech stałych podpowiedzi stoi lista z pamięci telefonu (za pierwszym razem te same cztery). Najwyżej 12 pytań po 600 znaków (od wieczora 27.10.2026; Jacek: „killer feature”: pytanie może być całym poleceniem, które się przewija).
  const PYTANIA_MAX = 12, PYTANIE_DL = 600;
  const ZDANIA = {
    pusto: 'Zapytaj o auta, raty albo oferty. Odpowiada komputer w domu, zwykle w kilka sekund.',
    edycja: 'Stuknij pytanie, żeby je zmienić. Nowe wpisz albo podyktuj.',
    brak: 'Komputer nie odpowiedział. Może jest wyłączony albo śpi.',
    siec: 'Brak połączenia z internetem. Pytanie nie poszło.',
    klucz: 'Komputer nie dał klucza do mikrofonu. Może jest wyłączony.',
    mikrofon: 'Mikrofon nie ruszył. Sprawdź, czy Kasiomobile ma do niego dostęp w ustawieniach telefonu.',
    // Zgoda jest, ale telefon nie dał dźwięku (od 26.10.2026: na Redmi tak było bez zgody MODIFY_AUDIO_SETTINGS w aplikacji).
    mikrofonBrak: 'Telefon nie dał dźwięku z mikrofonu. Spróbuj jeszcze raz albo napisz pytanie.',
    soniox: 'Rozpoznawanie mowy nie odpowiedziało. Spróbuj jeszcze raz albo napisz pytanie.',
    // Mikrofon wyłączył się sam (od 27.10.2026): cisza dłuższa niż bezpiecznik albo zamknięte połączenie. Nic nie poszło, tekst zostaje w polu.
    cisza: (s) => `Cisza od ${s} sekund, więc przestałem słuchać. Tekst zostaje w polu.`,
    zerwane: (jest) => `Rozpoznawanie mowy się rozłączyło.${jest ? ' Tekst zostaje w polu.' : ''}`,
  };
  // Strumień odpowiedzi z ntfy.sh czytany na bieżąco; bez strumieni (stara przeglądarka) pytamy co 2,5 sekundy.
  const STRUMIEN = typeof ReadableStream === 'function' && typeof TextDecoder === 'function';
  const pamiec = {
    czytaj(k, d) { try { const v = localStorage.getItem('kasiomobile-czat:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    zapisz(k, v) { try { localStorage.setItem('kasiomobile-czat:' + k, JSON.stringify(v)); } catch { /* pełna pamięć: zostaje poprzednie */ } },
  };
  // Dziennik użycia (app.js, „dziennik użycia”) dostaje od czatu pytania, odpowiedzi (sam rozmiar), HAL-a i mikrofon; bez niego nic się nie zmienia.
  const uz = (typ, dane) => { try { if (window.Uzycie) window.Uzycie.czat(typ, dane); } catch { /* dziennik nie psuje czatu */ } };
  const pauza = (ms) => new Promise((r) => setTimeout(r, ms));
  const losowe = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  function el(tag, atr, ...dzieci) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(atr || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : String(v));
    }
    e.append(...dzieci.filter((x) => x !== null && x !== undefined));
    return e;
  }
  // Znaki w polu 24 × 24, każdy z rysunkiem na środku pola (środek liczony z krawędzi rysunku, nie z pudełka).
  const IKONY = {
    czat: '<path d="M5.5 4h13a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-7l-4.5 3.4v-3.4h-1.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.5" cy="10.25" r="1.25"/><circle cx="12" cy="10.25" r="1.25"/><circle cx="15.5" cy="10.25" r="1.25"/>',
    zamknij: '<path d="M6.7 5.3 12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3z"/>',
    wyslij: '<path d="M12 4.2 18.8 11l-1.4 1.4L13 8v11.8h-2V8l-4.4 4.4L5.2 11z"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="2.2"/>',
    // Mikrofon jak w Kiro na Telefonie (od 7.11.2026, Jacek: „Daj taki mikrofon, jak jest tutaj, dokładnie”): ten sam rysunek kreską.
    mikrofon: '<path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3zM6.5 11a5.5 5.5 0 0 0 11 0M12 16.5v4M9 20.5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    zewnatrz: '<path d="M13.5 4H20v6.5h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6h-3.1zM5 6.5h6v2H6v9.5h9.5v-5h2v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1z"/>',
    dalej: '<path d="M9.3 6.3 15 12l-5.7 5.7-1.4-1.4 4.3-4.3-4.3-4.3z"/>',
    historia: '<path fill-rule="evenodd" d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm0 1.9a6.6 6.6 0 1 0 0 13.2 6.6 6.6 0 0 0 0-13.2zM11.05 7.5h1.9v4.45l3.3 1.95-.97 1.64-4.23-2.5z"/>',
    nowa: '<path d="M11.05 5h1.9v6.05H19v1.9h-6.05V19h-1.9v-6.05H5v-1.9h6.05z"/>',
    // Archiwum, kosz i strzałka wstecz dla historii rozmów (od 26.10.2026), środek rysunku w punkcie 12, 12.
    archiwum: '<path fill-rule="evenodd" d="M4 4.2h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1zm.9 1.9v1.2h14.2V6.1zM4.9 11.1h1.9v6.8h10.4v-6.8h1.9v7.7a1 1 0 0 1-1 1H5.9a1 1 0 0 1-1-1zm4.6 1.7h5v1.9h-5z"/>',
    kosz: '<path fill-rule="evenodd" d="M9.5 3.5h5l.8 1.5H19v1.9H5V5h3.7zM6.4 8.4h11.2l-.9 10.4a1.9 1.9 0 0 1-1.9 1.7H9.2a1.9 1.9 0 0 1-1.9-1.7zm2.1 1.9.7 8.3h5.6l.7-8.3z"/>',
    wstecz: '<path d="M14.7 6.3 9 12l5.7 5.7 1.4-1.4-4.3-4.3 4.3-4.3z"/>',
    // Strzałka „Cofnij”, ta sama co w aplikacji (index.html), środek rysunku w punkcie 12, 12.
    cofnij: '<path d="M9.75 4.75 5.25 9.25l4.5 4.5M5.75 9.25h8a5 5 0 0 1 0 10h-2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    // Pytania na stałe (od 27.10.2026): ołówek (edytuj), ptaszek (zapisz, gotowe) i uchwyt z sześciu kropek (przesuń), środek rysunku w punkcie 12, 12.
    olowek: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="m15 5 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    ptak: '<path d="M5 12.2l4.5 4.5L19 7.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    uchwyt: '<circle cx="9" cy="7" r="1.7"/><circle cx="15" cy="7" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="17" r="1.7"/><circle cx="15" cy="17" r="1.7"/>',
    // Iskra asystenta (od 27.10.2026 wieczorem; Jacek: „inny znaczek … wariację” logo Claude): dwanaście promieni o różnej długości wokół jądra. Środek rysunku w punkcie 12, 12.
    iskra: '<g transform="translate(-.3 .4)" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M11.91 8.6L11.74 2M13.8 9.12L15.82 5.89M14.9 10.22L19.67 7.3M15.4 12.12L18.8 12.24M14.99 13.62L20.96 16.87M13.6 15L15.29 18.18M12.09 15.4L12.24 21.2M10.2 14.88L8.5 17.6M9.1 13.78L3.64 17.12M8.6 11.88L4.6 11.74M9.01 10.38L4.27 7.8M10.4 9L8.76 5.91"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></g>',
    // Rozwiń na cały ekran (strzałki od środka do rogów).
    pelny: '<path d="M14 4h6v6h-2V7.4l-4.3 4.3-1.4-1.4L16.6 6H14zM10 20H4v-6h2v2.6l4.3-4.3 1.4 1.4L7.4 18H10z"/>',
    // Pasek u góry i wskazanie (od 28.10.2026): rysunki na 24 px w polu 24 × 24, więc proste kreski stoją na całych pikselach, a kółko 40 px i rysunek 24 px mają
    // tę samą parzystość. Atrament każdego zajmuje 18 × 18 px ze środkiem w punkcie 12, 12 (zmierzone na zrzutach w 1×, 1,2× i 4×).
    // Rozmowy: zegar ze strzałką w lewo, jak SF Symbol clock.arrow.circlepath.
    rozmowy: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 8-8 8.5 8.5 0 0 0-5.9 2.4L4 9"/><path d="M4 4v5h5"/><path d="M12 8v4l3 1.5"/></g>',
    // Nowa rozmowa: kartka z ołówkiem, jak square.and.pencil.
    pisz: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M16.94 4.94a1.5 1.5 0 0 1 2.12 2.12l-7 7-3.06.94.94-3.06z"/></g>',
    // Wstecz z listy: strzałka „‹”.
    wroc: '<path d="M15.5 5 8.5 12l7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    // Wskaż rzecz na ekranie: celownik.
    celownik: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5.5"/><path d="M12 4v3.5M12 16.5V20M4 12h3.5M16.5 12H20"/></g><circle cx="12" cy="12" r="1.5"/>',
  };
  const ikona = (n, r = 20) => `<svg width="${r}" height="${r}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${IKONY[n]}</svg>`;

  // Dymek przy ikonce bez podpisu (reguły ikonki-z-dymkami i dymki-na-miejscu): kursor po pół sekundy, fokus z klawiatury od razu,
  // palec po przytrzymaniu (wtedy przycisk nie działa). Stoi na środku pod ikonką, a gdy brakuje miejsca, nad nią.
  // Tekst bierze z aria-label, więc zmienia się razem z nim.
  function dymek(b) {
    let d = null, zegar = 0, przytrzymane = false;
    const pokaz = () => {
      // Nad ciągniętym kółkiem dymka nie ma (przestawianie w app.js, od 22.10.2026).
      if (d || !b.isConnected || b.classList.contains('ciagniety')) return;
      d = el('div', { class: 'czat-dymek', role: 'tooltip', text: b.getAttribute('aria-label') || '' });
      document.body.append(d);
      const r = b.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
      d.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
      d.style.top = (r.bottom + 6 + h > innerHeight - 8 ? r.top - h - 6 : r.bottom + 6) + 'px';
    };
    const schowaj = () => { clearTimeout(zegar); if (d) { d.remove(); d = null; } };
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { clearTimeout(zegar); zegar = setTimeout(pokaz, 500); } });
    b.addEventListener('pointerleave', schowaj);
    b.addEventListener('focus', () => { try { if (b.matches(':focus-visible')) pokaz(); } catch { /* bez :focus-visible */ } });
    b.addEventListener('blur', schowaj);
    b.addEventListener('keydown', (e) => { if (e.key === 'Escape' && d) { schowaj(); e.stopPropagation(); } });
    b.addEventListener('pointerdown', (e) => {
      schowaj();
      if (e.pointerType === 'mouse' || b.dataset.dotyk === 'wlasne') return;
      przytrzymane = false;
      zegar = setTimeout(() => { przytrzymane = true; pokaz(); }, 500);
    });
    b.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { clearTimeout(zegar); if (przytrzymane) setTimeout(schowaj, 1500); } });
    b.addEventListener('pointercancel', schowaj);
    b.addEventListener('click', (e) => {
      if (przytrzymane) { przytrzymane = false; e.preventDefault(); e.stopImmediatePropagation(); return; }
      schowaj();
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function przycisk(n, opis, klasa, r) {
    const b = el('button', { type: 'button', class: 'czat-ikonka ' + klasa, 'aria-label': opis, html: ikona(n, r) });
    dymek(b);
    return b;
  }

  let aktywny = null;
  function uruchom(o) {
    const tryb = o.tryb || 'arkusz';
    const dotyk = matchMedia('(pointer: coarse)').matches;
    let historia = pamiec.czytaj('historia', []);
    if (!Array.isArray(historia)) historia = [];
    // Tryb edycji pytań na stałe (pusta rozmowa): pole pytania i mikrofon zapisują pytanie zamiast je wysyłać. id to edytowane pytanie albo null dla nowego.
    const edycja = { aktywna: false, id: null };
    // Przewinięcie listy pytań w trybie edycji (rysuj() zawsze przerysowuje całą listę): bez tego każda zmiana ściągałaby widok na dół, a pierwsze pytania uciekałyby z ekranu.
    let pustoST = 0;
    // Małe okno po przytrzymaniu przycisku asystenta (mini) i chwila ostatniego przytrzymania pytania (bezKlikuPyt), żeby puszczenie nie wysłało go od razu.
    let mini = false, bezKlikuPyt = 0, otwartoMini = 0;
    // Wskazanie w małym oknie: wskazana rzecz { el, tekst, ramki }, trwające przeciąganie celownika i chwila jego końca (żeby puszczenie nie było stuknięciem).
    let wskaz = null, celowanie = null, wskazPoRuchu = 0, zegarRamki = 0;

    // ---------------------------------------------------------------- budowa
    const zaslona = tryb === 'arkusz' ? el('div', { class: 'czat-zaslona', hidden: true }) : null;
    const korzen = el('section', { class: `czat czat-${tryb}`, 'aria-label': 'Asystent', tabindex: '-1' });
    if (tryb === 'arkusz') { korzen.setAttribute('role', 'dialog'); korzen.setAttribute('aria-modal', 'true'); korzen.hidden = true; }
    const zamknijB = przycisk('zamknij', 'Zamknij', 'czat-zamknij', 18);
    // Pigułka z napisem: Cofnij, Edytuj pytania, Gotowe, Archiwum i Kosz, pozycje menu rozmowy.
    const pigulka = (n, napis, klasa) => { const b = el('button', { type: 'button', class: 'czat-pigulka ' + klasa, html: ikona(n, 18) }); b.append(el('span', { text: napis })); return b; };
    // Pasek u góry (od 28.10.2026; Jacek o dawnych pigułkach Rozmowy i Nowa rozmowa nad polem pytania: „te propozycje i ta ergonomia is NO GOOD! Think Different, think
    // what would Apple do!!!”, a o powrocie do czterech pytań: „don't make me think, don't make me guess”). Jak w aplikacjach czatu na iPhonie (ChatGPT, Claude, Gemini)
    // i w pasku nawigacji Apple: z lewej Rozmowy (zegar ze strzałką; w listach w tym samym miejscu strzałka wstecz), na środku tytuł, z prawej Nowa rozmowa (kartka
    // z ołówkiem) i krzyżyk. Przyciski nigdy się nie przesuwają, a Nowa rozmowa na pustej rozmowie jest przygaszona, ale stoi. Nowa rozmowa odkłada bieżącą do Rozmów
    // i wraca do pustej rozmowy z pytaniami na stałe.
    const historiaB = przycisk('rozmowy', 'Rozmowy', 'czat-historia', 24);
    const tytulL = el('h2', { class: 'czat-tytul', 'aria-hidden': 'true' });
    const nowaB = przycisk('pisz', 'Nowa rozmowa', 'czat-nowa', 24);
    // Poziom myślenia (od 7.11.2026, Jacek: „mieć wybór poziomu myślenia … czasami chciałbym głębsze odpowiedzi, czasami wolniejsze”): kółko z trzema słupkami
    // jak zasięg w telefonie, stuknięcie przełącza Szybko, Zwykle i Głęboko (Opus 5.5 z wysiłkiem low, high i xhigh). Wybór zostaje w pamięci urządzenia.
    // Od 7.11.2026 wieczorem cztery poziomy, każdy z długością odpowiedzi (Jacek: „ja będę sobie wybierał, czy chcę dłuższą, czy krótszą … Opus 5.5 nawet max”).
    const POZIOMY = [['low', 'Krótko', 'Szybka, krótka odpowiedź.'], ['high', 'Zwykle', 'Jak dotąd.'], ['xhigh', 'Dłużej', 'Dłuższa odpowiedź, trochę poczekasz.'], ['max', 'Max', 'Opus 5.5 na maksimum: pełna odpowiedź, do 3 minut.']];
    let poziom = POZIOMY.some(([k]) => k === pamiec.czytaj('poziom', 'high')) ? pamiec.czytaj('poziom', 'high') : 'high';
    const poziomB = el('button', { type: 'button', class: 'czat-ikonka czat-poziom' });
    function ustawPoziom() {
      const i = POZIOMY.findIndex(([k]) => k === poziom);
      poziomB.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">' + [[3, 15], [8, 11.5], [13, 8], [18, 4.5]].map(([x, y], j) => `<rect x="${x}" y="${y}" width="3" height="${19 - y}" rx="1.5" fill="currentColor" opacity="${j <= i ? 1 : 0.28}"/>`).join('') + '</svg>';
      poziomB.setAttribute('aria-label', `Myślenie: ${POZIOMY[i][1]}. Stuknij, żeby zmienić`);
      poziomB.dataset.poziom = poziom;
    }
    ustawPoziom();
    dymek(poziomB);
    poziomB.addEventListener('click', () => {
      const i = (POZIOMY.findIndex(([k]) => k === poziom) + 1) % POZIOMY.length;
      poziom = POZIOMY[i][0];
      pamiec.zapisz('poziom', poziom);
      ustawPoziom();
      stan(`Myślenie: ${POZIOMY[i][1]}. ${POZIOMY[i][2]}`, 4000);
    });
    // Małe okno (od 27.10.2026 wieczorem): ten sam czat w mniejszej postaci po przytrzymaniu przycisku asystenta. U góry napis, o czym pyta (to, co widać
    // na ekranie), przycisk na cały ekran i krzyżyk. W pełnym oknie obu pierwszych nie widać (czat.css, .czat-mini-tylko).
    const miniChip = el('span', { class: 'czat-mini-chip czat-mini-tylko' });
    const rozwinB = przycisk('pelny', 'Otwórz na cały ekran', 'czat-rozwin czat-mini-tylko', 20);
    // Wskazanie (próba od 28.10.2026, Jacek o pomyśle „ping”: „Tak, zrób próbę”): celownik w pasku małego okna, przytrzymany i przeciągnięty nad aplikację (niżej, „wskazanie”).
    // Przytrzymanie palcem niesie pinezkę, więc dymek przy nim pokazuje tylko kursor i fokus (dotyk: „wlasne”).
    const wskazB = przycisk('celownik', 'Wskaż rzecz na ekranie', 'czat-wskaz czat-mini-tylko', 24);
    wskazB.dataset.dotyk = 'wlasne';
    const gora = el('div', { class: 'czat-gora' }, tryb === 'arkusz' ? el('span', { class: 'czat-uchwyt', 'aria-hidden': 'true' }) : null, historiaB, tytulL, miniChip, wskazB, rozwinB, poziomB, nowaB, zamknijB);
    const lista = el('div', { class: 'czat-lista', role: 'log', 'aria-live': 'polite', 'aria-label': 'Rozmowa z asystentem' });
    const stanL = el('p', { class: 'czat-stan', role: 'status', hidden: true });
    const pole = el('textarea', { class: 'czat-tekst', rows: '1', placeholder: 'Zapytaj o auta…', 'aria-label': 'Pytanie do asystenta', enterkeyhint: 'send', autocomplete: 'off' });
    const mikB = przycisk('mikrofon', 'Powiedz pytanie', 'czat-mik');
    mikB.hidden = true;
    const wyslijB = przycisk('wyslij', 'Wyślij', 'czat-wyslij');
    const forma = el('form', { class: 'czat-pole' }, pole, mikB, wyslijB);
    // „Cofnij” po przeniesieniu rozmowy do kosza albo archiwum i po zmianie pytań na stałe (od 26.10.2026): paruje w 6 s jak „Cofnij” w aplikacji (błękitne szkło
    // ze strzałką, styl w czat.css). Od 28.10.2026 stoi na środku, 12 px nad polem pytania, a w listach (bez pola) 12 px nad dołem listy, więc nigdy nie zasłania pola.
    const cofnijC = pigulka('cofnij', 'Cofnij', 'czat-cofnij');
    const cofnijPole = el('div', { class: 'czat-cofnij-pole', hidden: true }, cofnijC);
    // Wskazana rzecz nad polem pytania małego okna: „O tym: …” (stuknięcie pokazuje ją jeszcze raz na ekranie) i krzyżyk, który ją zdejmuje.
    const wskazTekst = el('button', { type: 'button', class: 'czat-wskazane-tekst' });
    const wskazUsun = przycisk('zamknij', 'Usuń wskazanie', 'czat-zamknij czat-wskazane-usun', 16);
    const wskazane = el('div', { class: 'czat-wskazane', hidden: true }, wskazTekst, wskazUsun);
    // Pinezka, która idzie za palcem, i ramka wokół rzeczy pod nią: w dokumencie aplikacji, nad zasłoną, bo rzecz bywa w stronie w ramce.
    const pinezka = tryb === 'arkusz' ? el('div', { class: 'czat-wskaznik', hidden: true, 'aria-hidden': 'true', html: ikona('celownik', 24) }) : null;
    const ramkaW = tryb === 'arkusz' ? el('div', { class: 'czat-wskaz-ramka', hidden: true, 'aria-hidden': 'true' }) : null;
    // Belka na dole pełnego okna (od 27.10.2026 wieczorem; Jacek: „menu na dole powinno się zsuwać do takiej belki małej na dole, i jak chcemy powrócić, to robimy swipe up”):
    // nawigacja aplikacji zsuwa się do niej, a przesunięcie jej w górę (albo stuknięcie) zamyka czat i przywraca nawigację.
    const belka = tryb === 'arkusz' ? el('div', { class: 'czat-belka', role: 'button', tabindex: '0', 'aria-label': 'Wróć do aplikacji. Przesuń w górę albo stuknij.' }, el('span', { class: 'czat-belka-kreska', 'aria-hidden': 'true' })) : null;
    // Podpis belki dla nowej osoby (28.10.2026, ocena według zasad Ramsa, punkt 4 „Zrozumiałe”): przy pierwszych pięciu otwarciach obok kreski stoi „Wróć do aplikacji”,
    // a znika po pierwszym powrocie belką. Napis mówi, dokąd belka prowadzi, a nie każe przesuwać: na iPhonie ruch w górę przy dolnej krawędzi łapie też system.
    if (belka) belka.append(el('span', { class: 'czat-belka-podpis', 'aria-hidden': 'true', text: 'Wróć do aplikacji' }));
    korzen.append(gora, lista, stanL, wskazane, forma, cofnijPole);
    if (belka) korzen.append(belka);
    if (zaslona) document.body.append(zaslona);
    if (pinezka) document.body.append(ramkaW, pinezka);
    (o.miejsce || document.body).append(korzen);

    // ---------------------------------------------------------------- wiadomości
    let pracuje = false, mysli = null, zegarStanu = 0;
    function stan(t, ms) {
      clearTimeout(zegarStanu);
      stanL.textContent = t || '';
      stanL.hidden = !t;
      if (t && ms) zegarStanu = setTimeout(() => stan(''), ms);
    }
    function przyciski() {
      // W trakcie odpowiedzi Wyślij jest kwadratem Stop (od 7.11.2026, niżej „zatrzymaj”).
      const stopTeraz = pracuje && !edycja.aktywna;
      wyslijB.disabled = stopTeraz ? false : pracuje || !pole.value.trim();
      wyslijB.setAttribute('aria-label', edycja.aktywna ? 'Zapisz pytanie' : stopTeraz ? 'Zatrzymaj odpowiedź' : 'Wyślij');
      ikonaWyslij();
      korzen.classList.toggle('czat-pracuje', pracuje);
      mikB.disabled = pracuje;
      nowaB.disabled = pracuje || !historia.length;
      // Przy zmianie pytań na stałe wychodzi się przez „Gotowe” (jak dawniej, gdy rząd Rozmów chował się w edycji), więc Rozmowy stoją wtedy przygaszone.
      historiaB.disabled = pracuje || edycja.aktywna;
      ustawGore();
    }
    // Pasek u góry: znak i nazwa przycisku Rozmowy (w listach strzałka wstecz w tym samym miejscu) i tytuł: pusty na pustej rozmowie, w rozmowie jej pierwsze pytanie,
    // w listach „Rozmowy” albo „Archiwum i kosz”, a przy zmianie pytań na stałe „Pytania na stałe”.
    function ustawGore() {
      const w = widokHistorii, znak = w ? 'wroc' : 'rozmowy';
      if (historiaB.dataset.znak !== znak) { historiaB.innerHTML = ikona(znak, 24); historiaB.dataset.znak = znak; }
      historiaB.setAttribute('aria-label', w === 'historia' ? 'Wróć do rozmowy' : 'Rozmowy');
      const pierwsze = historia.find((x) => x.kto === 'ja');
      const t = w === 'historia' ? 'Rozmowy' : w ? 'Archiwum i kosz' : edycja.aktywna ? 'Pytania na stałe' : pierwsze ? (bezSciezek(pierwsze.tekst) || 'Zrzut ekranu') : '';
      if (tytulL.textContent !== t) tytulL.textContent = t;
      tytulL.setAttribute('aria-hidden', t ? 'false' : 'true');
    }
    // Pole pytania (27.10.2026; Jacek: tekst z dyktowania ma mieć ostatnie zdanie przy palcu i nie może uciekać poza ekran): pole rośnie do 132 px, a dalej
    // przewija się do końca. Litery stoją w miejscu (28.10.2026, Jacek o malejących literach: „Look at the text which shrinks as you … read on it … That's not how
    // people work”). Tekst w polu leży też w pamięci jako szkic (szkic), więc zamknięcie okna albo aplikacji go nie gubi; znika dopiero po wysłaniu.
    const POLE_MAX = 132;
    // Przy zmianie pytania na stałe pole sięga do 36% wysokości ekranu, żeby długie polecenie dało się czytać i przewijać (od 27.10.2026 wieczorem).
    const poleMax = () => (edycja.aktywna ? Math.max(POLE_MAX, Math.round(innerHeight * 0.36)) : POLE_MAX);
    // Tekst nigdy nie ginie (od 7.11.2026, reguła tekst-nigdy-nie-ginie.md; Jacek: „ja muszę być w stanie wrócić do tego, co już wpisałem lub powiedziałem”):
    // każda zmiana pola, z klawiatury i z dyktowania, trafia od razu do trwałej listy „pisane” w pamięci urządzenia, zanim padnie Wyślij. Wpisy z przerwą krótszą
    // niż minuta (i całe dyktowanie, z oddechami) to jeden wątek; dłuższa przerwa albo duże skasowanie zaczyna nowy, więc skasowany tekst zostaje w starym.
    // Wątki stoją w Rozmowach pod „Wpisane wcześniej”, a stuknięcie oddaje tekst do pola. Najwyżej 60 wątków z 30 dni.
    const PISANE_MAX = 60, WATEK_MS = 60000;
    let poprzedniTekst = pole.value, bezCofnijPola = false;
    function zapiszPisane(t) {
      if (!String(t || '').trim()) return;
      let l = pamiec.czytaj('pisane', []);
      if (!Array.isArray(l)) l = [];
      const teraz = Date.now(), ost = l[0];
      const ciagle = ost && (teraz - ost.do < WATEK_MS || (() => { try { return glos.stan !== 'nic'; } catch { return false; } })());
      if (ciagle && !(ost.tekst.length - t.length > 20 && !ost.tekst.startsWith(t))) { ost.tekst = t; ost.do = teraz; }
      else if (!ost || ost.tekst !== t) l.unshift({ od: teraz, do: teraz, tekst: t });
      pamiec.zapisz('pisane', l.filter((w) => teraz - w.do < 30 * 864e5).slice(0, PISANE_MAX));
    }
    function rosnij() {
      pole.style.height = 'auto';
      pole.style.height = Math.min(pole.scrollHeight + 2, poleMax()) + 'px';
      if (!edycja.aktywna) {
        pamiec.zapisz('szkic', pole.value);
        zapiszPisane(pole.value);
        // Duże skasowanie (co najmniej dwa zdania albo 120 znaków), które nie jest wysłaniem: „Cofnij” przez 6 s i Ctrl+Z oddają tekst, bez okienka.
        const usuniete = poprzedniTekst.length - pole.value.length, zdan = (poprzedniTekst.match(/[.!?…]+(\s|$)/g) || []).length - (pole.value.match(/[.!?…]+(\s|$)/g) || []).length;
        if (!bezCofnijPola && usuniete > 0 && (usuniete >= 120 || zdan >= 2) && typeof pokazCofnijCzat === 'function') try {
          ruchy.wstecz.push({ pole: { przed: poprzedniTekst, po: pole.value } });
          ruchy.naprzod.length = 0;
          pokazCofnijCzat('Cofnij skasowanie tekstu');
        } catch { /* przed zbudowaniem cofania */ }
        poprzedniTekst = pole.value;
        bezCofnijPola = false;
      }
      ustawCofnij();
    }
    const poleNaDole = () => pole.scrollTop + pole.clientHeight >= pole.scrollHeight - 4;
    { const sz = pamiec.czytaj('szkic', ''); if (typeof sz === 'string' && sz) pole.value = sz; }
    const naDol = () => { lista.scrollTop = lista.scrollHeight; };
    const usunPusto = () => { const p = lista.querySelector('.czat-pusto'); if (p) p.remove(); };
    function zapiszHistorie() {
      if (historia.length > NAJWIECEJ) historia = historia.slice(-NAJWIECEJ);
      pamiec.zapisz('historia', historia);
    }
    // Odpowiedź to akapity i punkty „- ”. Gwiazdki z Markdownu znikają.
    function bloki(t) {
      const wynik = [];
      let ul = null;
      for (const linia of String(t || '').replace(/\*\*/g, '').split(/\n+/)) {
        const s = linia.trim();
        if (!s) continue;
        const m = /^[-•*]\s+(.*)$/.exec(s);
        if (m) {
          if (!ul) { ul = el('ul'); wynik.push(ul); }
          ul.append(el('li', { text: m[1] }));
        } else { ul = null; wynik.push(el('p', { text: s })); }
      }
      return wynik.length ? wynik : [el('p', { text: '…' })];
    }
    // Napis odnośnika pod odpowiedzią: krótki tytuł, nigdy cały adres (od 26.10.2026: odpowiedź z adresem w tytule wychodziła poza ekran).
    function tytulOdnosnika(l) {
      let t = String(l.tytul || '').replace(/\s+/g, ' ').trim();
      if (!t || /^https?:\/\//i.test(t)) { try { t = new URL(l.adres).hostname.replace(/^www\./, ''); } catch { t = 'Odnośnik'; } }
      return t.length > 70 ? t.slice(0, 69).replace(/\s+\S*$/, '') + '…' : t;
    }
    // Napis przycisku „Ustaw filtry w Ofertach: …”: tylko to, co się zmienia, po polsku i krótko (kwoty i przebieg w tysiącach).
    function opisFiltrow(f, szukaj) {
      const cz = [], tys = (n) => String(Math.round(n / 1000));
      if (szukaj) cz.push(szukaj);
      if (f.wyczysc) cz.push('filtry z początku');
      if (f.cenaOd > 0 && f.cenaDo > 0) cz.push(`cena ${tys(f.cenaOd)}–${tys(f.cenaDo)} tys. zł`);
      else if (f.cenaDo > 0) cz.push(`cena do ${tys(f.cenaDo)} tys. zł`);
      else if (f.cenaOd > 0) cz.push(`cena od ${tys(f.cenaOd)} tys. zł`);
      else if (f.cenaOd === 0 || f.cenaDo === 0) cz.push('bez limitu ceny');
      if (f.rokOd > 0 && f.rokDo > 0) cz.push(`rocznik ${f.rokOd}–${f.rokDo}`);
      else if (f.rokOd > 0) cz.push(`od ${f.rokOd}`);
      else if (f.rokDo > 0) cz.push(`do ${f.rokDo}`);
      else if (f.rokOd === 0 || f.rokDo === 0) cz.push('każdy rocznik');
      if (f.kmDo > 0) cz.push(`przebieg do ${tys(f.kmDo)} tys. km`);
      else if (f.kmDo === 0) cz.push('bez limitu przebiegu');
      if (f.sprzedawca) cz.push({ firma: 'od firm', prywatny: 'od prywatnych', wszyscy: 'każdy sprzedawca' }[f.sprzedawca]);
      if (f.werdykt) cz.push(f.werdykt === 'wszystkie' ? 'także słabsze oferty' : 'tylko warte uwagi');
      if (f.kolejnosc) cz.push({ dopasowanie: 'najlepsze dopasowanie', najtansze: 'od najtańszych', najdrozsze: 'od najdroższych', przebieg: 'najmniejszy przebieg', swieze: 'najświeższe' }[f.kolejnosc]);
      return cz.filter(Boolean).join(', ');
    }
    function napisPokazu(p) {
      if (p.model && p.nazwa) return 'Pokaż model: ' + p.nazwa;
      if (p.porownaj) return 'Pokaż porównanie';
      if (p.podium) return 'Pokaż Podium';
      if (p.finanse) return 'Pokaż ratę w Finansach';
      if (p.filtry) { const o = opisFiltrow(p.filtry, p.szukaj); return 'Ustaw filtry w Ofertach' + (o ? ': ' + o : ''); }
      if (p.szukaj) return 'Szukaj w Ofertach: ' + p.szukaj;
      if (p.rozdzial && p.nazwa) return 'Otwórz w Poradniku: ' + p.nazwa;
      return 'Pokaż ' + BIERNIK[p.zakladka];
    }
    function wiadomosc(w) {
      // Podpis pytania (od 7.11.2026): imię stoi nad dymkiem, gdy pytanie zadał ktoś inny niż właściciel tego urządzenia.
      if (w.kto === 'ja') return el('div', { class: 'czat-w ja' }, w.autor && w.autor !== autorZ(o.skad) ? el('span', { class: 'czat-autor', text: w.autor }) : null, el('div', { class: 'czat-babelek' }, ...obrazyZ(w.tekst).map((s) => { const i = el('img', { class: 'czat-miniatura', src: 'file:///' + s.replace(/\\/g, '/').split('/').map((x, j) => (j ? encodeURIComponent(x) : x)).join('/'), alt: 'Zrzut ekranu', loading: 'lazy' }); i.addEventListener('click', (e) => { e.stopPropagation(); pelnyObraz(i.src); }); i.addEventListener('error', () => i.replaceWith(el('span', { class: 'czat-zrzut', text: 'Zrzut ekranu' }))); return i; }), ...(bezSciezek(w.tekst) ? bloki(bezSciezek(w.tekst)) : [])));
      const box = el('div', { class: 'czat-w ai' });
      if (w.blad) {
        box.append(el('div', { class: 'czat-babelek blad' }, el('p', { text: w.blad })));
        if (w.q) {
          const b = el('button', { type: 'button', class: 'czat-akcja', text: 'Spróbuj jeszcze raz' });
          b.addEventListener('click', () => {
            if (pracuje) return;
            const i = historia.indexOf(w);
            if (i >= 0) historia.splice(i, 1);
            zapiszHistorie();
            box.remove();
            zadaj(w.q);
          });
          box.append(b);
        }
        return box;
      }
      box.append(el('div', { class: 'czat-babelek' }, ...bloki(w.tekst)));
      if (w.pokaz && BIERNIK[w.pokaz.zakladka]) {
        const b = el('button', { type: 'button', class: 'czat-akcja', html: `<span></span>${ikona('dalej', 18)}` });
        b.firstChild.textContent = napisPokazu(w.pokaz);
        b.addEventListener('click', () => pokazTeraz(w.pokaz, true));
        box.append(b);
      }
      for (const l of w.linki || []) {
        if (!l || !/^https:\/\//.test(String(l.adres || ''))) continue;
        const a = el('a', { class: 'czat-akcja czat-link', href: l.adres, target: '_blank', rel: 'noopener noreferrer', html: `<span></span>${ikona('zewnatrz', 16)}` });
        a.firstChild.textContent = tytulOdnosnika(l);
        box.append(a);
      }
      return box;
    }
    function pusto() {
      const l = pytaniaMoje();
      if (!edycja.aktywna) {
        const rzad = el('div', { class: 'czat-podpowiedzi' });
        for (const p of l) {
          const b = el('button', { type: 'button', class: 'czat-podpowiedz', 'data-id': p.id }, el('span', { class: 'czat-podp-tekst', text: p.t }));
          b.addEventListener('click', () => { if (Date.now() < bezKlikuPyt) return; wyslij(p.t); });
          przytrzymajPytanie(b, p);
          rzad.append(b);
        }
        const edytuj = pigulka('olowek', 'Edytuj pytania', 'czat-pyt-edytuj');
        edytuj.addEventListener('click', () => edytujPytania(true));
        // Puste okno rozmowy: zdanie i pytania na stałe w jednej spokojnej barwie (za pierwszym razem cztery stałe podpowiedzi). Dużego oka HAL-a nie ma tu od wieczora
        // 26.10.2026 (Jacek: „fajna, ale trochę przesadzona”); oko żyje w małym mikrofonie przy polu pytania i w trybie HAL (przytrzymanie logo w app.js).
        return el('div', { class: 'czat-pusto' }, el('span', { class: 'czat-iskra', html: ikona('iskra', 44), 'aria-hidden': 'true' }), el('p', { text: ZDANIA.pusto }), rzad, edytuj);
      }
      const rzad = el('div', { class: 'czat-podpowiedzi czat-pytania-edycja' }, ...l.map(wierszPytania));
      const dodajP = pigulka('nowa', 'Dodaj pytanie', 'czat-pyt-dodaj');
      dodajP.addEventListener('click', () => {
        edycja.id = null;
        pole.value = '';
        pole.placeholder = 'Nowe pytanie na stałe…';
        rosnij();
        przyciski();
        pustoST = lista.scrollTop;
        rysuj();
        pole.focus({ preventScroll: true });
      });
      const gotowe = pigulka('ptak', 'Gotowe', 'czat-pyt-gotowe');
      gotowe.addEventListener('click', () => edytujPytania(false));
      return el('div', { class: 'czat-pusto' }, el('p', { text: ZDANIA.edycja }), rzad, el('div', { class: 'czat-pyt-akcje' }, dodajP, gotowe));
    }
    function ikonaWyslij() { const n = edycja.aktywna ? 'ptak' : pracuje ? 'stop' : 'wyslij'; if (wyslijB.dataset.ikona !== n) { wyslijB.dataset.ikona = n; wyslijB.innerHTML = ikona(n); } korzen.classList.toggle('edytuje', edycja.aktywna); }
    function edytujPytania(wl) {
      if (pracuje) return;
      edycja.aktywna = wl;
      edycja.id = null;
      pole.value = wl ? '' : pamiec.czytaj('szkic', '');
      pole.placeholder = wl ? 'Nowe pytanie na stałe…' : 'Zapytaj o auta…';
      ikonaWyslij();
      rosnij();
      przyciski();
      pustoST = 0;
      rysuj();
    }
    // Wyjście z trybu edycji bez przerysowania (przejście do Rozmów, zamknięcie czatu): niezapisany tekst z pola przepada, żeby nie poszedł potem jako pytanie.
    function wylaczEdycje() {
      if (!edycja.aktywna) return;
      edycja.aktywna = false;
      edycja.id = null;
      pole.value = pamiec.czytaj('szkic', '');
      pole.placeholder = 'Zapytaj o auta…';
      ikonaWyslij();
      rosnij();
      przyciski();
    }
    // ---------------------------------------------------------------- pytania na stałe (od 27.10.2026)
    function pytaniaMoje() {
      const z = pamiec.czytaj('pytania', null);
      if (!Array.isArray(z)) return PODPOWIEDZI.map(([t], i) => ({ id: 'd' + (i + 1), t }));
      return z.filter((x) => x && typeof x.id === 'string' && typeof x.t === 'string' && x.t.trim()).slice(0, PYTANIA_MAX);
    }
    const zapiszPytania = (l) => pamiec.zapisz('pytania', l);
    // Przytrzymanie pytania na pustej rozmowie (0,5 s) otwiera je od razu do zmiany, bez wchodzenia w „Edytuj pytania” (od 27.10.2026 wieczorem).
    function zmienJedno(p) {
      edycja.aktywna = true;
      edycja.id = p.id;
      pole.value = p.t;
      pole.placeholder = 'Zmień pytanie…';
      ikonaWyslij();
      rosnij();
      przyciski();
      pustoST = 0;
      rysuj();
      pole.focus({ preventScroll: true });
      try { pole.setSelectionRange(pole.value.length, pole.value.length); } catch { /* bez zaznaczenia */ }
    }
    function przytrzymajPytanie(b, p) {
      let zegar = 0, x = 0, y = 0;
      const stop = () => clearTimeout(zegar);
      b.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        x = e.clientX;
        y = e.clientY;
        stop();
        // Puszczenie palca po przytrzymaniu daje „click” na tym, co stoi teraz pod palcem (lista pytań przerysowała się do zmiany), więc kliknięcia stoją, póki palec jest na
        // ekranie, i jeszcze pół sekundy po nim.
        zegar = setTimeout(() => {
          bezKlikuPyt = Date.now() + 10000;
          const koniec = () => { bezKlikuPyt = Date.now() + 500; };
          window.addEventListener('pointerup', koniec, { once: true, capture: true });
          window.addEventListener('pointercancel', koniec, { once: true, capture: true });
          if (navigator.vibrate) navigator.vibrate(10);
          zmienJedno(p);
        }, 500);
      });
      b.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - x) > 10 || Math.abs(e.clientY - y) > 10) stop(); });
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, stop);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    // Każda zmiana listy to krok „Cofnij” (przycisk nad dołem czatu, Ctrl+Z i Ctrl+Y jak przy ruchach rozmów).
    function zmienPytania(po, opis) {
      const przed = pytaniaMoje();
      zapiszPytania(po);
      ruchy.wstecz.push({ pytania: { przed, po } });
      if (ruchy.wstecz.length > 50) ruchy.wstecz.shift();
      ruchy.naprzod.length = 0;
      pustoST = lista.scrollTop;
      rysuj();
      pokazCofnijCzat(opis);
    }
    function zapiszPytanie(t) {
      const q = String(t || '').replace(/\s+/g, ' ').trim();
      if (!q) return false;
      if (q.length > PYTANIE_DL) { stan(`Pytanie jest za długie: najwyżej ${PYTANIE_DL} znaków.`, 5000); return false; }
      const l = pytaniaMoje();
      let nowa;
      if (edycja.id && l.some((x) => x.id === edycja.id)) nowa = l.map((x) => (x.id === edycja.id ? { id: x.id, t: q } : x));
      else if (l.length >= PYTANIA_MAX) { stan(`Jest już ${PYTANIA_MAX} pytań. Usuń któreś.`, 5000); return false; }
      else nowa = l.concat({ id: losowe(), t: q });
      edycja.id = null;
      pole.value = '';
      pole.placeholder = 'Nowe pytanie na stałe…';
      rosnij();
      zmienPytania(nowa, 'Cofnij zapis pytania');
      return true;
    }
    function usunPytanie(id) {
      const l = pytaniaMoje();
      if (!l.some((x) => x.id === id)) return;
      if (edycja.id === id) { edycja.id = null; pole.value = ''; rosnij(); }
      zmienPytania(l.filter((x) => x.id !== id), 'Cofnij usunięcie pytania');
    }
    function przestawPytanie(id, o) {
      const l = pytaniaMoje(), i = l.findIndex((x) => x.id === id), j = i + o;
      if (i < 0 || j < 0 || j >= l.length) return;
      const po = l.slice();
      [po[i], po[j]] = [po[j], po[i]];
      zmienPytania(po, 'Cofnij przesunięcie pytania');
      const u = lista.querySelector(`.czat-pyt-wiersz[data-id="${id}"] .czat-pyt-uchwyt`);
      if (u) u.focus({ preventScroll: true });
    }
    function wierszPytania(p) {
      const uch = el('button', { type: 'button', class: 'czat-pyt-uchwyt', 'aria-label': 'Przesuń pytanie', html: ikona('uchwyt', 20) });
      const tekst = el('button', { type: 'button', class: 'czat-pyt-tekst' }, el('span', { class: 'czat-podp-tekst', text: p.t }));
      const usun = el('button', { type: 'button', class: 'czat-pyt-usun', 'aria-label': 'Usuń pytanie', html: ikona('zamknij', 18) });
      const w = el('div', { class: 'czat-pyt-wiersz' + (edycja.id === p.id ? ' edytowany' : ''), 'data-id': p.id }, uch, tekst, usun);
      tekst.addEventListener('click', () => {
        if (Date.now() < bezKlikuPyt) return;
        edycja.id = p.id;
        pole.value = p.t;
        pole.placeholder = 'Zmień pytanie…';
        rosnij();
        przyciski();
        pustoST = lista.scrollTop;
        rysuj();
        pole.focus({ preventScroll: true });
      });
      usun.addEventListener('click', () => usunPytanie(p.id));
      uch.addEventListener('pointerdown', (e) => przeciagajPytanie(w, uch, e));
      uch.addEventListener('keydown', (e) => { if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); przestawPytanie(p.id, e.key === 'ArrowUp' ? -1 : 1); } });
      return w;
    }
    // Przeciąganie uchwytem (mysz, palec, pióro): wiersz skacze na miejsce pod kursorem, a po puszczeniu kolejność się zapisuje jako jeden krok „Cofnij”.
    function przeciagajPytanie(wiersz, uch, e) {
      if (e.button) return;
      e.preventDefault();
      const kont = wiersz.parentNode, przed = pytaniaMoje(), id = e.pointerId;
      wiersz.classList.add('przeciagany');
      // Zdarzenia słucha okno, a nie uchwyt: przestawienie wiersza w drzewie zwalnia przechwycenie wskaźnika i uchwyt przestaje je dostawać (sprawdzone testem na dotyku).
      const ruchP = (ev) => {
        if (ev.pointerId !== id) return;
        const inne = [...kont.querySelectorAll('.czat-pyt-wiersz')].filter((x) => x !== wiersz);
        const cel = inne.find((x) => { const b = x.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
        if (cel) { if (wiersz.nextElementSibling !== cel) kont.insertBefore(wiersz, cel); }
        else if (kont.lastElementChild !== wiersz) kont.append(wiersz);
      };
      const koniec = (ev) => {
        if (ev && ev.pointerId !== id) return;
        window.removeEventListener('pointermove', ruchP, true);
        window.removeEventListener('pointerup', koniec, true);
        window.removeEventListener('pointercancel', koniec, true);
        wiersz.classList.remove('przeciagany');
        const po = [...kont.querySelectorAll('.czat-pyt-wiersz')].map((x) => przed.find((y) => y.id === x.dataset.id)).filter(Boolean);
        if (po.length === przed.length && po.some((x, i) => x !== przed[i])) zmienPytania(po, 'Cofnij przesunięcie pytania');
      };
      window.addEventListener('pointermove', ruchP, true);
      window.addEventListener('pointerup', koniec, true);
      window.addEventListener('pointercancel', koniec, true);
    }
    function dodaj(w) {
      historia.push(w);
      zapiszHistorie();
      if (widokHistorii) { rysuj(); return lista.lastElementChild; }
      usunPusto();
      const e = wiadomosc(w);
      lista.insertBefore(e, mysli && mysli.parentNode === lista ? mysli : null);
      return e;
    }
    // ---------------------------------------------------------------- historia rozmów (od 26.10.2026)
    // Wcześniejsze rozmowy leżą w pamięci urządzenia (najwyżej 20, każda do 40 wiadomości) razem z identyfikatorem rozmowy dla komputera,
    // więc po powrocie da się dopytać dalej. Nic nie znika: nowa rozmowa odkłada bieżącą, a powrót do starej odkłada bieżącą też.
    const ARCHIWUM = 20;
    // Archiwum i kosz (od 26.10.2026, Jacek: „left i right swipe, jeden to będzie tam kasowanie do kosza, na jakiś czas. A drugi do
    // archiwum”): rozmowę na liście przesuwa się palcem albo myszą w bok. Z Historii w lewo idzie do kosza (czerwony, jak w Poczcie
    // Apple), w prawo do archiwum; z archiwum w prawo wraca do Historii, w lewo idzie do kosza; z kosza w prawo wraca do Historii.
    // Kosz trzyma rozmowę 30 dni, potem znika sama, archiwum bez końca (najwyżej 50), a nadmiar Historii (ponad 20) idzie do archiwum.
    // Stuknięcie zawsze otwiera rozmowę. Bez przesuwania to samo daje małe menu (przytrzymanie, prawy klik, klawisz menu), a Delete
    // wysyła do kosza. Każdy ruch ma „Cofnij” (paruje w 4 s) i Ctrl+Z, Ctrl+Y.
    const LISTY = { historia: 'archiwum', archiwum: 'w-archiwum', kosz: 'w-koszu', usun: 'usuniete' };
    const NAJWIECEJ_W = { historia: ARCHIWUM, archiwum: 50, kosz: 50, usun: 20 };
    const KOSZ_MS = 30 * 864e5;
    // Od 27.10.2026 Archiwum i Kosz to jeden widok „Schowek” (Jacek: „Tak, scal”): sekcje Zachowane i Kosz, a dane dalej leżą w dwóch listach.
    const PUSTE = { historia: 'Wcześniejszych rozmów jeszcze nie ma.', schowek: 'Archiwum i kosz są puste.' };
    // Cel ruchu palca w prawo i w lewo w każdej liście i jego wygląd (biały napis: archiwum 5,7:1, Historia 4,7:1, kosz 5,4:1).
    const AKCJE = { historia: { prawo: 'archiwum', lewo: 'kosz' }, archiwum: { prawo: 'historia', lewo: 'kosz' }, kosz: { prawo: 'historia', lewo: 'usun' } };
    const CEL = {
      archiwum: { napis: 'Do archiwum', ikona: 'archiwum', kolor: '#5856d6', cofnij: 'Cofnij przeniesienie do archiwum' },
      kosz: { napis: 'Do kosza', ikona: 'kosz', kolor: '#d70015', cofnij: 'Cofnij przeniesienie do kosza' },
      usun: { napis: 'Usuń na stałe', ikona: 'kosz', kolor: '#a3000f', cofnij: 'Cofnij usunięcie na stałe' },
      historia: { napis: 'Do rozmów', ikona: 'historia', kolor: '#0071e3', cofnij: 'Cofnij powrót do rozmów' },
    };
    const ruchy = { wstecz: [], naprzod: [] };
    let widokHistorii = false, menuR = null, zegarCofnij = 0;
    function rysuj() {
      widokHistorii = false;
      zamknijMenu(false);
      pokazCofnijCzat(null);
      lista.setAttribute('aria-label', 'Rozmowa z asystentem');
      lista.replaceChildren(...(historia.length ? historia.map(wiadomosc) : [pusto()]));
      if (mysli) lista.append(mysli);
      forma.hidden = false;
      forma.style.visibility = '';
      forma.inert = false;
      przyciski();
      rzadDymka = null;
      if (historia.length) naDol(); else lista.scrollTop = edycja.aktywna ? pustoST : 0;
    }
    const wsteczHistorii = () => (widokHistorii === 'historia' ? rysuj() : pokazHistorie('historia'));
    function czytajListe(n) {
      const a = pamiec.czytaj(LISTY[n], []);
      let l = Array.isArray(a) ? a.filter((r) => r && Array.isArray(r.wpisy) && r.wpisy.length) : [];
      if (n === 'kosz' || n === 'usun') {
        const swieze = l.filter((r) => Date.now() - (r.usunieto || 0) < KOSZ_MS);
        if (swieze.length !== l.length) { l = swieze; pamiec.zapisz(LISTY[n], l); }
      }
      return l;
    }
    function zapiszListe(n, l) {
      if (n === 'historia' && l.length > NAJWIECEJ_W.historia) zapiszListe('archiwum', l.splice(NAJWIECEJ_W.historia).concat(czytajListe('archiwum')));
      pamiec.zapisz(LISTY[n], l.slice(0, NAJWIECEJ_W[n]));
    }
    const archiwum = () => czytajListe('historia');
    const ta = (r) => (x) => x.id === r.id && x.czas === r.czas;
    function odloz() {
      if (!historia.length) return;
      const a = archiwum();
      a.unshift({ id: pamiec.czytaj('rozmowa', null) || losowe(), autor: autorZ(o.skad), czas: pamiec.czytaj('ostatnio', Date.now()), wpisy: historia });
      zapiszListe('historia', a);
    }
    function odNowa() {
      odloz();
      historia = [];
      zapiszHistorie();
      pamiec.zapisz('rozmowa', losowe());
      pamiec.zapisz('ostatnio', Date.now());
      rysuj();
    }
    function nowaRozmowa() {
      if (pracuje || !historia.length) return;
      if (glos.stan !== 'nic') glosStop(false);
      odNowa();
      stan('Poprzednia rozmowa jest w Rozmowach.', 5000);
    }
    // Po 6 godzinach ciszy rozmowa zaczyna się od nowa, jak dla komputera (rozmowa() niżej), a stara czeka w Historii.
    function poCzasie() {
      if (!historia.length || pracuje || czeka.size || (pamiec.czytaj('czeka', []) || []).length) return;
      if (Date.now() - pamiec.czytaj('ostatnio', 0) > NOWA_ROZMOWA_MS) odNowa();
    }
    // Otwiera rozmowę z Historii, archiwum albo kosza: wraca jako bieżąca, a bieżąca idzie do Historii.
    function wrocDo(n, r) {
      if (pracuje) return;
      // Rozmowa otwarta z małego okna idzie na cały ekran (28.10.2026, Jacek: „pretty much stuck in it … don't make me think”).
      if (mini && otwarty()) otworz();
      const a = czytajListe(n), i = a.findIndex(ta(r));
      if (i < 0) return;
      a.splice(i, 1);
      zapiszListe(n, a);
      odloz();
      historia = r.wpisy.slice(-NAJWIECEJ);
      zapiszHistorie();
      pamiec.zapisz('rozmowa', r.id);
      pamiec.zapisz('ostatnio', Date.now());
      rysuj();
    }
    function kiedy(t) {
      const d = new Date(t), dzis = new Date();
      const godz = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
      if (d.toDateString() === dzis.toDateString()) return 'Dziś, ' + godz;
      if (d.toDateString() === new Date(dzis - 864e5).toDateString()) return 'Wczoraj, ' + godz;
      return d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }) + ', ' + godz;
    }
    const pytan = (n) => `${n} ${n === 1 ? 'pytanie' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'pytania' : 'pytań'}`;
    const rozmow = (n) => `${n} ${n === 1 ? 'rozmowa' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'rozmowy' : 'rozmów'}`;
    // Ile dni rozmowa jeszcze poleży w koszu.
    function zniknie(t) {
      const d = Math.max(1, Math.ceil(((t || 0) + KOSZ_MS - Date.now()) / 864e5));
      return `Zniknie za ${d} ${d === 1 ? 'dzień' : 'dni'}`;
    }
    // Przenosi rozmowę między listami: na początek celu albo na podane miejsce (cofanie). Oddaje krok do cofnięcia.
    function przenies(z, na, r, miejsce) {
      const a = czytajListe(z), i = a.findIndex(ta(r));
      if (i < 0) return null;
      const [x] = a.splice(i, 1);
      zapiszListe(z, a);
      // „Usuń na stałe” chowa rozmowę z kosza, ale jeszcze 30 dni leży po cichu w osobnej liście (Jacek: „takie możesz gdzieś sobie tam je po
      // cichu trzymać”), więc „Cofnij” zawsze oddaje ją do kosza z dawnym terminem.
      if (na === 'kosz') { x.usunieto = z === 'usun' && x.zKosza ? x.zKosza : Date.now(); delete x.zKosza; }
      else if (na === 'usun') { x.zKosza = x.usunieto || Date.now(); x.usunieto = Date.now(); }
      else { delete x.usunieto; delete x.zKosza; }
      const b = czytajListe(na), j = Math.min(miejsce === undefined ? 0 : miejsce, b.length);
      b.splice(j, 0, x);
      zapiszListe(na, b);
      return { id: x.id, czas: x.czas, z, na, i, j };
    }
    function ruch(z, na, r) {
      const k = przenies(z, na, r);
      if (!k) return;
      ruchy.wstecz.push(k);
      if (ruchy.wstecz.length > 50) ruchy.wstecz.shift();
      ruchy.naprzod.length = 0;
      pokazHistorie(widokHistorii || z, true);
      pokazCofnijCzat(CEL[na].cofnij);
    }
    // Opróżnia kosz (Jacek, 26.10.2026: „nie ma opcji opróżnienia kosza … ja chcę, żeby można było usuwać z kosza”): rozmowy znikają z widoku,
    // a „Cofnij” i Ctrl+Z oddają je wszystkie naraz. Po cichu leżą jeszcze 30 dni w osobnej liście (przenies, „usun”).
    function oproznijKosz() {
      const grupa = [];
      for (const r of czytajListe('kosz').slice()) { const k = przenies('kosz', 'usun', r); if (k) grupa.push(k); }
      if (!grupa.length) return;
      ruchy.wstecz.push({ grupa });
      if (ruchy.wstecz.length > 50) ruchy.wstecz.shift();
      ruchy.naprzod.length = 0;
      pokazHistorie('schowek', true);
      pokazCofnijCzat('Cofnij opróżnienie kosza');
    }
    // Cofa albo ponawia ostatni ruch rozmowy. Oddaje false, gdy nie było czego.
    function cofnijRuch(ponow) {
      const k = (ponow ? ruchy.naprzod : ruchy.wstecz).pop();
      if (!k) return false;
      // Usunięty dymek rozmowy (od 7.11.2026): wraca na swoje miejsce, a Ponów zdejmuje go znowu.
      // Skasowany tekst w polu pytania (od 7.11.2026): wraca cały, a Ponów kasuje go znowu.
      if (k.pole) {
        pole.value = ponow ? k.pole.po : k.pole.przed;
        bezCofnijPola = true;
        rosnij();
        przyciski();
        (ponow ? ruchy.wstecz : ruchy.naprzod).push(k);
        pokazCofnijCzat(null);
        pole.focus({ preventScroll: true });
        return true;
      }
      if (k.dymek) {
        if (ponow) historia.splice(k.dymek.i, 1); else historia.splice(k.dymek.i, 0, k.dymek.w);
        zapiszHistorie();
        (ponow ? ruchy.wstecz : ruchy.naprzod).push(k);
        pokazCofnijCzat(null);
        if (!widokHistorii) rysuj();
        return true;
      }
      // Krok listy pytań na stałe: wraca cała lista sprzed zmiany albo po niej.
      if (k.pytania) {
        zapiszPytania(ponow ? k.pytania.po : k.pytania.przed);
        (ponow ? ruchy.wstecz : ruchy.naprzod).push(k);
        pokazCofnijCzat(null);
        if (!widokHistorii && !historia.length) { pustoST = lista.scrollTop; rysuj(); }
        return true;
      }
      // Krok grupowy (opróżnienie kosza) cofa się od końca, żeby każda rozmowa wróciła na swoje miejsce.
      const kroki = k.grupa ? (ponow ? k.grupa : k.grupa.slice().reverse()) : [k];
      let zrobione = false;
      for (const x of kroki) if (ponow ? przenies(x.z, x.na, x, x.j) : przenies(x.na, x.z, x, x.i)) zrobione = true;
      if (zrobione) (ponow ? ruchy.wstecz : ruchy.naprzod).push(k);
      pokazCofnijCzat(null);
      if (widokHistorii) pokazHistorie(widokHistorii, true);
      return true;
    }
    function pokazCofnijCzat(opis) {
      clearTimeout(zegarCofnij);
      cofnijPole.classList.remove('paruje');
      cofnijPole.hidden = !opis;
      korzen.classList.toggle('z-cofnij', Boolean(opis));
      if (!opis) return;
      cofnijC.setAttribute('aria-label', opis);
      ustawCofnij();
      void cofnijPole.offsetWidth;
      cofnijPole.classList.add('paruje');
      if (getComputedStyle(cofnijC).animationName === 'none' && !cofnijC.matches(':hover, :focus-visible')) zegarCofnij = setTimeout(() => pokazCofnijCzat(null), 6000);
    }
    // „Cofnij” stoi na środku, 12 px nad polem pytania, a w listach (pole schowane) 12 px nad dołem listy.
    function ustawCofnij() {
      if (cofnijPole.hidden) return;
      const k = korzen.getBoundingClientRect(), y = forma.hidden ? lista.getBoundingClientRect().bottom : forma.getBoundingClientRect().top;
      cofnijPole.style.bottom = Math.max(0, Math.round(k.bottom - y + 12)) + 'px';
    }
    function zamknijMenu(fokus) {
      if (!menuR) return false;
      const z = menuR.zrodlo;
      menuR.remove();
      menuR = null;
      if (fokus && z && z.isConnected) z.focus({ preventScroll: true });
      return true;
    }
    // Małe menu przy rozmowie (przytrzymanie, prawy klik, klawisz menu): te same ruchy co przesunięcie w bok, pozycje jako pigułki.
    function menuRozmowy(b, pozycje) {
      zamknijMenu(false);
      const m = el('div', { class: 'czat-menu', role: 'menu', 'aria-label': 'Rozmowa' });
      for (const p of pozycje) {
        const x = el('button', { type: 'button', role: 'menuitem', class: 'czat-pigulka czat-menu-poz' + (p.cel === 'kosz' || p.cel === 'usun' ? ' czat-do-kosza' : ''), html: ikona(p.ikona, 20) });
        x.append(el('span', { text: p.napis }));
        x.addEventListener('click', () => { zamknijMenu(false); p.zrob(); });
        m.append(x);
      }
      m.zrodlo = b;
      korzen.append(m);
      menuR = m;
      const k = korzen.getBoundingClientRect(), r = b.getBoundingClientRect(), s = m.getBoundingClientRect();
      const pod = r.bottom + 8 + s.height <= k.bottom - 8;
      m.style.top = Math.round((pod ? r.bottom + 8 : Math.max(k.top + 8, r.top - 8 - s.height)) - k.top) + 'px';
      m.style.left = Math.round(Math.max(8, Math.min(r.left - k.left, k.width - s.width - 8))) + 'px';
      m.querySelector('button').focus({ preventScroll: true });
    }
    // Wiersz odjeżdża w bok, lista się domyka, a potem rozmowa idzie do celu (ruch szuka jej po id, więc przerysowanie w tym czasie nie szkodzi).
    function odjedz(w, b, kier, zrob) {
      const r = w.getBoundingClientRect();
      w.classList.add('przesuwa', 'odjezdza');
      w.dataset.kierunek = kier > 0 ? 'prawo' : 'lewo';
      b.style.transition = 'transform 200ms cubic-bezier(.2, 0, 0, 1)';
      b.style.transform = `translateX(${kier * (r.width + 48)}px)`;
      w.style.height = r.height + 'px';
      setTimeout(() => {
        w.style.transition = 'height 200ms cubic-bezier(.2, 0, 0, 1), margin 200ms cubic-bezier(.2, 0, 0, 1), opacity 160ms ease';
        w.style.height = '0px';
        w.style.marginBottom = '-12px';
        w.style.opacity = '0';
      }, 160);
      setTimeout(zrob, 380);
    }
    // Przesuwanie w bok (palec, pióro i mysz): rusza po 10 px, gdy ruch idzie bardziej w bok niż w pionie (w pionie lista się przewija,
    // touch-action: pan-y). Za progiem (35% szerokości, najwyżej 120 px) wiersz odjeżdża do celu, przed progiem wraca. W stronę bez celu
    // wiersz stawia opór. Przytrzymanie palcem 0,5 s bez ruchu otwiera menu, a klik po przesunięciu albo przytrzymaniu nie otwiera rozmowy.
    function przesuwalny(w, b, akcje, pozycje) {
      let s = null, dx = 0, tryb = '', zegar = 0, bezKliku = 0;
      const prog = () => Math.min(120, w.getBoundingClientRect().width * 0.35);
      const ustaw = (x, czas) => { b.style.transition = czas ? `transform ${czas}ms cubic-bezier(.2, 0, 0, 1)` : 'none'; b.style.transform = x ? `translateX(${x}px)` : ''; };
      b.addEventListener('pointerdown', (e) => {
        if (pracuje || (e.pointerType === 'mouse' && e.button !== 0)) return;
        s = { x: e.clientX, y: e.clientY, id: e.pointerId };
        dx = 0;
        tryb = '';
        clearTimeout(zegar);
        if (e.pointerType !== 'mouse') zegar = setTimeout(() => { if (s && !tryb) { tryb = 'menu'; bezKliku = Date.now(); menuRozmowy(b, pozycje); if (navigator.vibrate) navigator.vibrate(10); } }, 500);
      });
      b.addEventListener('pointermove', (e) => {
        if (!s || e.pointerId !== s.id || tryb === 'menu') return;
        const x = e.clientX - s.x, y = e.clientY - s.y;
        if (!tryb) {
          if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
          clearTimeout(zegar);
          if (Math.abs(x) <= Math.abs(y)) { s = null; return; }
          tryb = 'w-bok';
          try { b.setPointerCapture(e.pointerId); } catch { /* bez przechwycenia */ }
          w.classList.add('przesuwa');
        }
        const kier = x > 0 ? 'prawo' : 'lewo', a = akcje[kier];
        dx = a ? x : x / 5;
        w.dataset.kierunek = kier;
        const gotowe = Boolean(a) && Math.abs(dx) >= prog();
        if (gotowe !== w.classList.contains('gotowe')) { w.classList.toggle('gotowe', gotowe); if (gotowe && navigator.vibrate) navigator.vibrate(8); }
        ustaw(dx, 0);
      });
      const koniec = (e, przerwane) => {
        clearTimeout(zegar);
        if (!s || e.pointerId !== s.id) return;
        const t = tryb;
        s = null;
        tryb = '';
        if (t === 'menu') { bezKliku = Date.now(); return; }
        if (t !== 'w-bok') return;
        bezKliku = Date.now();
        const a = akcje[dx > 0 ? 'prawo' : 'lewo'];
        if (!przerwane && a && Math.abs(dx) >= prog()) { odjedz(w, b, Math.sign(dx), a); return; }
        w.classList.remove('gotowe');
        ustaw(0, 240);
        setTimeout(() => { if (!w.classList.contains('odjezdza')) { w.classList.remove('przesuwa'); b.style.transition = ''; } }, 260);
      };
      b.addEventListener('pointerup', (e) => koniec(e, false));
      b.addEventListener('pointercancel', (e) => koniec(e, true));
      // Ten słuchacz stoi przed słuchaczem otwarcia (dodany wcześniej), więc zatrzymuje go po przesunięciu albo przytrzymaniu.
      b.addEventListener('click', (e) => { if (Date.now() - bezKliku < 600) { e.preventDefault(); e.stopImmediatePropagation(); } });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!menuR || menuR.zrodlo !== b) menuRozmowy(b, pozycje); });
      // Po przytrzymaniu palcem przeglądarka daje jeszcze „mousedown”, który zabrałby fokus z menu z powrotem na rozmowę.
      b.addEventListener('mousedown', (e) => { if (Date.now() - bezKliku < 600) e.preventDefault(); });
    }
    // Rozmowa na liście: przycisk, który ją otwiera, a pod nim kolor celu z napisem, widoczny przy przesuwaniu w bok.
    function wierszRozmowy(n, r) {
      const pytania = r.wpisy.filter((x) => x.kto === 'ja'), { prawo, lewo } = AKCJE[n];
      const b = el('button', { type: 'button', class: 'czat-rozmowa' },
        el('span', { class: 'czat-rozmowa-tytul', text: pytania[0] ? bezSciezek(pytania[0].tekst) || 'Zrzut ekranu' : 'Rozmowa' }),
        el('span', { class: 'czat-rozmowa-kiedy', text: `${r.autor || autorZ(o.skad)} · ${n === 'kosz' ? zniknie(r.usunieto) : n === 'historia' || n === 'archiwum' ? kiedyKrotko(r.czas) : kiedy(r.czas)} · ${pytan(pytania.length)}` }));
      const strona = (cel, klasa) => (cel ? el('span', { class: klasa, html: ikona(CEL[cel].ikona, 22) }, el('span', { text: CEL[cel].napis })) : null);
      const w = el('div', { class: 'czat-wiersz', style: `--k-prawo:${prawo ? CEL[prawo].kolor : 'transparent'};--k-lewo:${lewo ? CEL[lewo].kolor : 'transparent'}` },
        el('div', { class: 'czat-pod', 'aria-hidden': 'true' }, strona(prawo, 'czat-pod-l'), strona(lewo, 'czat-pod-p')), b);
      const zrob = (cel) => () => ruch(n, cel, r);
      const pozycje = [prawo, lewo].filter(Boolean).map((cel) => ({ cel, napis: CEL[cel].napis, ikona: CEL[cel].ikona, zrob: () => odjedz(w, b, cel === lewo ? -1 : 1, zrob(cel)) }));
      przesuwalny(w, b, { prawo: prawo ? zrob(prawo) : null, lewo: lewo ? zrob(lewo) : null }, pozycje);
      b.addEventListener('click', () => wrocDo(n, r));
      b.addEventListener('keydown', (e) => { if (e.key === 'Delete' && lewo) { e.preventDefault(); odjedz(w, b, -1, zrob(lewo)); } });
      return w;
    }
    function sekcjaListy(nazwa, przycisk, cel) {
      return el('div', { class: 'czat-sekcja', 'data-sekcja': cel || null }, el('h4', { class: 'czat-sekcja-nazwa', text: nazwa }), przycisk);
    }
    // Rozmowy pogrupowane po dniach, z małą datą (od 27.10.2026 wieczorem; Jacek: „bardzo prosta i delikatna, a skuteczna nawigacja w historii … małe daty”):
    // nagłówek Dziś, Wczoraj, Ostatnie 7 dni, Ostatnie 30 dni albo Wcześniej, a w wierszu sama godzina (starsze: dzień i miesiąc).
    function grupyDni(a) {
      const dzis = new Date();
      dzis.setHours(0, 0, 0, 0);
      const g = [];
      for (const r of a) {
        const d = new Date(r.czas);
        d.setHours(0, 0, 0, 0);
        const n = Math.round((dzis - d) / 864e5), nazwa = n <= 0 ? 'Dziś' : n === 1 ? 'Wczoraj' : n < 7 ? 'Ostatnie 7 dni' : n < 30 ? 'Ostatnie 30 dni' : 'Wcześniej';
        const ost = g[g.length - 1];
        if (ost && ost.nazwa === nazwa) ost.wiersze.push(r); else g.push({ nazwa, wiersze: [r] });
      }
      return g;
    }
    function kiedyKrotko(t) {
      const d = new Date(t), dzis = new Date(), godz = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
      if (Date.now() - t < 2 * 864e5 && (d.toDateString() === dzis.toDateString() || d.toDateString() === new Date(dzis - 864e5).toDateString())) return godz;
      return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) + ', ' + godz;
    }
    // Wspólne rozmowy (od 7.11.2026): plik od komputera z kanału „<kanał>-rozmowy”, najwyżej raz na minutę. W Rozmowach stoją te, których to urządzenie nie ma,
    // pod nazwą autora; stuknięcie kopiuje rozmowę tutaj i otwiera ją, a komputer pamięta ją po identyfikatorze, więc da się dopytać dalej.
    const wspolneR = { lista: [], czas: 0, znak: '' };
    async function pobierzWspolne(gdy) {
      if (Date.now() - wspolneR.czas < 60000) return;
      wspolneR.czas = Date.now();
      try {
        const r = await fetch(`${SERWER}/${o.kanal}-rozmowy/json?poll=1&since=12h`, { cache: 'no-store' });
        const linie = (await r.text()).trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((w) => w && w.event === 'message' && w.attachment && w.attachment.url);
        const ost = linie[linie.length - 1];
        if (!ost) return;
        const d = await (await fetch(ost.attachment.url, { cache: 'no-store' })).json();
        if (!d || !Array.isArray(d.rozmowy) || String(d.czas) === wspolneR.znak) return;
        wspolneR.lista = d.rozmowy;
        wspolneR.znak = String(d.czas);
        scalWspolne();
        gdy();
      } catch { /* bez sieci zostaje ostatnia lista */ }
    }
    // Synchronizacja (od 7.11.2026 wieczorem, Jacek: „Gadałem sobie przed chwilą na telefonie … idę do komputera, chcę kontynuować tę rozmowę i vice versa”):
    // rozmowa, którą to urządzenie już ma, a którą ktoś pociągnął dalej gdzie indziej (więcej pytań we wspólnej kopii), dostaje nowe wpisy. Dotyczy bieżącej
    // rozmowy i Rozmów. Lista przychodzi przy otwarciu czatu i co minutę, gdy czat jest na ekranie.
    const pytanJa = (w) => w.filter((x) => x && x.kto === 'ja').length;
    const zWspolnej = (r) => r.wpisy.map((x) => Object.assign({ kto: x.kto === 'ja' ? 'ja' : 'ai', tekst: String(x.tekst || '') }, x.autor ? { autor: x.autor } : {}));
    function scalWspolne() {
      const biez = pamiec.czytaj('rozmowa', null);
      for (const r of wspolneR.lista) {
        if (!r || !r.id || !Array.isArray(r.wpisy)) continue;
        if (r.id === biez) {
          if (!pracuje && pytanJa(r.wpisy) > pytanJa(historia)) { historia = zWspolnej(r).slice(-NAJWIECEJ); zapiszHistorie(); pamiec.zapisz('ostatnio', Math.max(r.czas || 0, Date.now() - 1000)); if (!widokHistorii) rysuj(); }
          continue;
        }
        for (const n of ['historia', 'archiwum']) {
          const l = czytajListe(n), x = l.find((y) => y.id === r.id);
          if (x && pytanJa(r.wpisy) > pytanJa(x.wpisy)) { x.wpisy = zWspolnej(r); x.czas = r.czas || x.czas; zapiszListe(n, l); }
        }
      }
    }
    setInterval(() => { if (!document.hidden && (tryb === 'panel' || otwarty())) pobierzWspolne(() => { if (widokHistorii === 'historia') pokazHistorie('historia', true); }); }, 60000);
    function wierszWspolny(r) {
      const pytania = r.wpisy.filter((x) => x.kto === 'ja');
      const b = el('button', { type: 'button', class: 'czat-rozmowa' }, el('span', { class: 'czat-rozmowa-tytul', text: pytania[0] ? pytania[0].tekst : 'Rozmowa' }),
        el('span', { class: 'czat-rozmowa-kiedy', text: `${r.autor} · ${kiedyKrotko(r.czas)} · ${pytan(pytania.length)}` }));
      b.addEventListener('click', () => {
        const kopia = { id: r.id, autor: r.autor, czas: r.czas, wpisy: r.wpisy.map((x) => ({ kto: x.kto === 'ja' ? 'ja' : 'ai', tekst: String(x.tekst || '') })) };
        const l = czytajListe('historia');
        l.unshift(kopia);
        zapiszListe('historia', l);
        wrocDo('historia', kopia);
      });
      return el('div', { class: 'czat-wiersz' }, b);
    }
    // Dwa widoki listy: „historia” (przycisk Rozmowy) i „schowek” (dawne Archiwum i Kosz: sekcje Zachowane i Kosz, „Opróżnij” przy Koszu).
    function pokazHistorie(n = 'historia', zostan = false) {
      if (pracuje) return;
      wylaczEdycje();
      if (n === 'archiwum' || n === 'kosz') n = 'schowek';
      if (glos.stan !== 'nic') glosStop(false);
      zamknijMenu(false);
      const bylo = lista.scrollTop;
      widokHistorii = n;
      ustawGore();
      lista.setAttribute('aria-label', n === 'historia' ? 'Wcześniejsze rozmowy' : 'Archiwum i kosz');
      const tresc = [];
      if (n === 'schowek') {
        // Nazwa widoku stoi w tytule paska u góry, a powrót do Rozmów to strzałka wstecz w miejscu przycisku Rozmowy (od 28.10.2026).
        const zachowane = czytajListe('archiwum'), kosz = czytajListe('kosz');
        if (zachowane.length) tresc.push(sekcjaListy('Archiwum', null, 'archiwum'), el('div', { class: 'czat-rozmowy' }, ...zachowane.map((r) => wierszRozmowy('archiwum', r))));
        if (kosz.length) {
          const oproznij = pigulka('kosz', 'Opróżnij', 'czat-oproznij');
          oproznij.setAttribute('aria-label', 'Opróżnij kosz');
          oproznij.addEventListener('click', oproznijKosz);
          tresc.push(sekcjaListy('Kosz', oproznij, 'kosz'), el('div', { class: 'czat-rozmowy' }, ...kosz.map((r) => wierszRozmowy('kosz', r))));
        }
        if (!zachowane.length && !kosz.length) tresc.push(el('p', { class: 'czat-pusto', text: PUSTE.schowek }));
      } else {
        const a = czytajListe('historia'), arch = czytajListe('archiwum').length, kosz = czytajListe('kosz').length;
        // Archiwum i Kosz stoją zawsze na górze listy, widoczne, z liczbą (od 27.10.2026 wieczorem; Jacek: „łatwa i widoczna, i ten kosz, i ten archiwum”);
        // pusty przycisk jest przygaszony, ale nie znika, więc nic się nie przesuwa. Klik otwiera widok „Archiwum i kosz” na swojej sekcji.
        const chip = (nazwa, znak, ile, cel) => {
          const b = pigulka(znak, nazwa, 'czat-schowek');
          b.append(el('span', { class: 'czat-ile', text: String(ile) }));
          b.setAttribute('aria-label', `${nazwa}: ${rozmow(ile)}`);
          b.disabled = !ile;
          b.addEventListener('click', () => { pokazHistorie('schowek'); const s = lista.querySelector(`[data-sekcja="${cel}"]`); if (s) s.scrollIntoView({ block: 'start' }); });
          return b;
        };
        tresc.push(el('div', { class: 'czat-schowki' }, chip('Archiwum', 'archiwum', arch, 'archiwum'), chip('Kosz', 'kosz', kosz, 'kosz')));
        if (!a.length) tresc.push(el('p', { class: 'czat-pusto', text: PUSTE.historia }));
        else for (const g of grupyDni(a)) tresc.push(el('h4', { class: 'czat-grupa', text: g.nazwa }), el('div', { class: 'czat-rozmowy' }, ...g.wiersze.map((r) => wierszRozmowy('historia', r))));
        const znane = new Set([pamiec.czytaj('rozmowa', null), ...[...a, ...czytajListe('archiwum'), ...czytajListe('kosz')].map((r) => r.id)]);
        const obce = wspolneR.lista.filter((r) => r && r.id && !znane.has(r.id) && Array.isArray(r.wpisy) && r.wpisy.length);
        for (const kto of ['Jacek', 'Kasia']) {
          const l = obce.filter((r) => r.autor === kto);
          if (l.length) tresc.push(el('h4', { class: 'czat-grupa', text: kto === autorZ(o.skad) ? 'Twoje z innych urządzeń' : kto === 'Jacek' ? 'Rozmowy Jacka' : 'Rozmowy Kasi' }), el('div', { class: 'czat-rozmowy' }, ...l.map(wierszWspolny)));
        }
        // Wpisane wcześniej (od 7.11.2026): wątki z listy „pisane” bez tych, które są w polu albo poszły jako pytanie tej rozmowy.
        const wyslane = new Set(historia.filter((x) => x.kto === 'ja').map((x) => String(x.tekst || '').trim()));
        const pisane = (pamiec.czytaj('pisane', []) || []).filter((w) => w && w.tekst && w.tekst !== pole.value && !wyslane.has(w.tekst.replace(/\s+/g, ' ').trim())).slice(0, 15);
        if (pisane.length) tresc.push(el('h4', { class: 'czat-grupa', text: 'Wpisane wcześniej' }), el('div', { class: 'czat-rozmowy' }, ...pisane.map((w) => {
          const b = el('button', { type: 'button', class: 'czat-rozmowa' }, el('span', { class: 'czat-rozmowa-tytul', text: w.tekst }), el('span', { class: 'czat-rozmowa-kiedy', text: kiedyKrotko(w.do) }));
          b.addEventListener('click', () => { const bylo = pole.value; if (bylo.trim()) zapiszPisane(bylo); rysuj(); pole.value = w.tekst; bezCofnijPola = true; rosnij(); przyciski(); pole.focus({ preventScroll: true }); });
          return el('div', { class: 'czat-wiersz' }, b);
        })));
        pobierzWspolne(() => { if (widokHistorii === 'historia') pokazHistorie('historia', true); });
      }
      lista.replaceChildren(...tresc);
      // W listach pola pytania nie ma, więc lista sięga do dołu (od 28.10.2026: przyciski stoją w pasku u góry i nic pod nimi się nie rusza; do tego dnia pole
      // stało niewidoczne w układzie, żeby rząd Rozmów i Nowej rozmowy nad nim nie spadał).
      forma.hidden = true;
      if (zostan) { lista.scrollTop = bylo; return; }
      pokazCofnijCzat(null);
      stan('');
      lista.scrollTop = 0;
    }

    // ---------------------------------------------------------------- kanał ntfy.sh
    // Odpowiedzi słuchamy tylko wtedy, gdy na coś czekamy: jedno połączenie, od chwili najstarszego pytania.
    const czeka = new Map();
    let strumien = null, tylkoPytaj = !STRUMIEN;
    function zapiszCzekajace() {
      pamiec.zapisz('czeka', [...czeka.entries()].filter(([, c]) => c.q).map(([id, c]) => ({ id, q: c.q, czas: c.czas })));
    }
    function zamknijStrumien() { if (strumien) { strumien.abort(); strumien = null; } }
    function odebrane(w) {
      let d;
      // Długa odpowiedź przychodzi jako plik (ntfy.sh robi z wiadomości ponad 4 KB załącznik, od 7.11.2026).
      if (w.attachment && w.attachment.url && !w.zPliku) { fetch(w.attachment.url, { cache: 'no-store' }).then((r) => r.text()).then((t) => odebrane({ message: t, zPliku: true })).catch(() => {}); return; }
      try { d = JSON.parse(w.message); } catch { return; }
      if (!d || typeof d.id !== 'string') return;
      if (typeof d.glos === 'boolean') { zapiszGlos(d.glos); pokazMik(); }
      const c = czeka.get(d.id);
      if (!c) return;
      czeka.delete(d.id);
      clearTimeout(c.zegar);
      zapiszCzekajace();
      c.ok(d);
      if (!czeka.size) zamknijStrumien();
    }
    function sluchaj() {
      if (strumien || !czeka.size) return;
      const ac = new AbortController();
      strumien = ac;
      let od = Math.floor(Math.min(...[...czeka.values()].map((c) => c.czas)) / 1000) - 30;
      (async () => {
        while (strumien === ac && czeka.size) {
          try {
            const r = await fetch(`${SERWER}/${o.kanal}-odpowiedz/json?since=${encodeURIComponent(od)}${tylkoPytaj ? '&poll=1' : ''}`, { signal: ac.signal, cache: 'no-store' });
            if (!r.ok) throw new Error('ntfy.sh ' + r.status);
            const linia = (l) => {
              if (!l.trim()) return;
              try { const w = JSON.parse(l); if (w.event === 'message') { od = w.id; odebrane(w); } } catch { /* zła linia */ }
            };
            if (!tylkoPytaj && !r.body) { tylkoPytaj = true; continue; }
            if (tylkoPytaj) (await r.text()).split('\n').forEach(linia);
            else {
              const czytnik = r.body.getReader(), dek = new TextDecoder();
              let bufor = '';
              for (;;) {
                const { value, done } = await czytnik.read();
                if (done) break;
                bufor += dek.decode(value, { stream: true });
                let i;
                while ((i = bufor.indexOf('\n')) >= 0) { linia(bufor.slice(0, i)); bufor = bufor.slice(i + 1); }
              }
            }
          } catch { if (ac.signal.aborted) break; }
          if (strumien === ac && czeka.size) await pauza(2500);
        }
        if (strumien === ac) strumien = null;
      })();
    }
    function zapytaj(tresc, ms, q) {
      return new Promise((ok) => {
        const id = losowe(), czas = Date.now();
        const zegar = setTimeout(() => {
          if (!czeka.delete(id)) return;
          zapiszCzekajace();
          ok(null);
          if (!czeka.size) zamknijStrumien();
        }, ms);
        czeka.set(id, { ok, zegar, czas, q });
        zapiszCzekajace();
        sluchaj();
        fetch(`${SERWER}/${o.kanal}-pytanie`, { method: 'POST', body: JSON.stringify(Object.assign({ id, skad: o.skad || '', autor: autorZ(o.skad) }, tresc)), cache: 'no-store' })
          .then((r) => { if (!r.ok) throw new Error('ntfy.sh ' + r.status); })
          .catch(() => {
            const c = czeka.get(id);
            if (!c) return;
            czeka.delete(id);
            clearTimeout(c.zegar);
            zapiszCzekajace();
            ok({ blad: ZDANIA.siec });
            if (!czeka.size) zamknijStrumien();
          });
      });
    }
    // ---------------------------------------------------------------- Brama Opusa w telefonie (od 8.11.2026)
    // Jacek: „Kasiomobile mogła korzystać z Opusa 5.5 nawet gdy mój laptop jest wyłączony”. Na Androidzie (most AutaBrama, Brama.java) pytanie idzie najpierw
    // do Bramy w samym telefonie, z kontekstem, który komputer wysyła na kanał „<kanał>-kontekst” (telefon trzyma ostatni w pamięci), a z historią z tej rozmowy.
    // Gdy Bramy w telefonie nie ma albo nie odpowie, pytanie idzie jak dotąd do komputera. W telefonie nie ma internetu dla modelu ani przekazywania zmian.
    const lokalne = new Map();
    // Powód odmowy Bramy w telefonie (od 9.11.2026): gdy laptop też nie odpowie, telefon mówi ten powód zamiast „Komputer nie odpowiedział”.
    let bladTel = '';
    let kontekstCzas = 0;
    async function pobierzKontekst() {
      if (Date.now() - kontekstCzas < 600000) return;
      kontekstCzas = Date.now();
      try {
        const r = await fetch(`${SERWER}/${o.kanal}-kontekst/json?poll=1&since=12h`, { cache: 'no-store' });
        const w = (await r.text()).trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x) => x && x.attachment && x.attachment.url).pop();
        if (!w) return;
        const k = await (await fetch(w.attachment.url, { cache: 'no-store' })).json();
        if (k && typeof k.tekst === 'string' && typeof k.prompt === 'string') pamiec.zapisz('kontekst', k);
      } catch { /* bez sieci zostaje ostatni */ }
    }
    if (window.AutaBrama) pobierzKontekst();
    window.__bramaOdp = (id, kod, tekst) => { const c = lokalne.get(id); if (c) { lokalne.delete(id); c(kod, tekst); } };
    function zJsona(t) {
      const a = t.indexOf('{'), b = t.lastIndexOf('}');
      if (a < 0 || b <= a) return t.trim() ? { odpowiedz: t.trim() } : null;
      const s = t.slice(a, b + 1);
      for (const j of [s, s.replace(/„([^"”\n]{0,80})"/g, '„$1”')]) { try { return JSON.parse(j); } catch { /* następna */ } }
      const m = /"odpowiedz"\s*:\s*"([\s\S]*?)"\s*,\s*"/.exec(s);
      return m ? { odpowiedz: m[1].replace(/\\n/g, '\n') } : null;
    }
    function lokalnie(tresc, ms) {
      let ma = false; try { ma = !!(window.AutaBrama && window.AutaBrama.jest()); } catch { ma = false; }
      const k = pamiec.czytaj('kontekst', null);
      // Bardzo długie pytanie (ponad 150 tys. znaków) idzie do laptopa, który dzieli je na części (od 8.11.2026).
      if (!ma || !k || !k.tekst || tresc.hal || String(tresc.q || '').length > 150000) return Promise.resolve(null);
      const wys = ['low', 'medium', 'high', 'xhigh', 'max'].includes(tresc.poziom) ? tresc.poziom : 'high';
      const dlugosc = { low: 'Długość odpowiedzi: krótko, 1–3 zdania.', xhigh: 'Długość odpowiedzi: dłużej i dokładniej, do 12 punktów, z uzasadnieniem.', max: 'Długość odpowiedzi: pełna i wyczerpująca, tyle, ile temat wymaga, punktami, z liczbami z danych i wnioskiem na końcu.' }[wys] || '';
      const wczesniej = historia.filter((x) => x.tekst && !x.blad).slice(-13, -1).map((x) => (x.kto === 'ja' ? 'Pytanie: ' : 'Odpowiedź: ') + x.tekst).join('\n');
      const tekst = [wczesniej ? 'Wcześniej w tej rozmowie:\n\n' + wczesniej : '', 'Pyta: ' + autorZ(o.skad) + '.', dlugosc, tresc.ekran ? 'Na ekranie jest teraz: ' + tresc.ekran + ' Gdy pytanie mówi o „tym aucie” albo „tym”, chodzi o to, co na ekranie.' : '', 'Pytanie: ' + tresc.q].filter(Boolean).join('\n\n');
      const cialo = JSON.stringify({ model: 'opus', max_tokens: wys === 'max' ? 16000 : wys === 'xhigh' ? 8000 : 4000, output_config: { effort: wys },
        system: k.prompt + '\n\nTa odpowiedź powstaje w samym telefonie, bez komputera: pól czytaj, wSieci i zmiana nie używaj (zostaw null).\n\nTreść pliku kontekst.md:\n\n' + k.tekst,
        messages: [{ role: 'user', content: tekst }] });
      const id = losowe();
      return new Promise((ok) => {
        lokalne.set(id, (kod, odp) => {
          if (kod === -1) { ok({ zatrzymane: true }); return; }
          let o2 = null; try { o2 = JSON.parse(odp); } catch { o2 = null; }
          const t = o2 && Array.isArray(o2.content) ? o2.content.filter((x) => x && x.type === 'text').map((x) => x.text).join('') : '';
          bladTel = kod === 429 && /kredyt/i.test(odp) ? 'Skończyły się kredyty Kiro, więc asystent teraz nie odpowie. Odpowie, gdy kredyty wrócą.' : kod === 200 ? '' : bladTel;
          const w = kod === 200 ? zJsona(t) : null;
          if (!w || !String(w.odpowiedz || '').trim()) { ok(null); return; }
          const z = { katalog: 'katalog', modele: 'modele', kredyt: 'kredyt', poradnik: 'poradnik', historia: 'historia' }[w.zakladka] || null;
          const pokaz = w.model && k.modele && k.modele[w.model] ? { zakladka: 'modele', model: w.model, nazwa: k.modele[w.model].n + ' ' + k.modele[w.model].l } : z ? { zakladka: z } : null;
          const linki = (Array.isArray(w.linki) ? w.linki : []).filter((l) => l && /^https:/.test(String(l.adres || '')) && k.tekst.includes(String(l.adres))).slice(0, 3);
          ok({ odpowiedz: String(w.odpowiedz).replace(/\*\*/g, ''), linki, pokaz, zTelefonu: true });
        });
        try { window.AutaBrama.zapytaj(id, cialo, ms); } catch { lokalne.delete(id); ok(null); }
      });
    }
    async function zapytajGdzies(tresc, ms, q) {
      const d = await lokalnie(tresc, ms - 10000);
      if (d) return d;
      // Od 9.11.2026 brak kredytów w telefonie widać od razu (Brama Opusa: zamiast cichego przejścia na laptopa), a pytanie i tak idzie do komputera w domu.
      // Telefon i laptop korzystają z tego samego konta Kiro (9.11.2026: oba „0 z 1212”), więc przy braku kredytów nie czekamy 90 s na laptopa.
      if (bladTel) return { blad: bladTel };
      const z = await zapytaj(tresc, ms, q);
      return !z && bladTel ? { blad: bladTel } : z;
    }
    // Stop (od 7.11.2026, Jacek: „musi być opcja … do przerwania toku myślenia. Jak się to źle wpisało, to po chuj ma mielić. Zatrzymujemy”):
    // w trakcie odpowiedzi Wyślij jest kwadratem. Telefon przestaje czekać (późniejsza odpowiedź przepada, bo jej nie ma w „czeka”), a pytanie wraca
    // do pola do poprawy. Komputer kończy swoje w tle; następne pytanie idzie z polem popraw, więc komputer zapomina w tej rozmowie poprzednie.
    let poprawka = 0;
    function zatrzymaj() {
      for (const [id, c] of [...lokalne]) { lokalne.delete(id); c(-1, ''); }
      for (const [id, c] of [...czeka]) { if (!c.q) continue; czeka.delete(id); clearTimeout(c.zegar); c.ok({ zatrzymane: true }); }
      zapiszCzekajace();
      if (!czeka.size) zamknijStrumien();
      uz('stop', '');
    }
    // Pięć podstaw czatu (reguła czat-z-ai-podstawy, od 7.11.2026; Jacek: „opcja do edytowania ostatniego zapytania”): dymek widać w całości,
    // a stuknięcie dymka pokazuje pod nim rząd: Kopiuj, Popraw (własne pytanie), Usuń i Kopiuj rozmowę. Popraw wkłada pytanie do pola, a ono
    // i wszystko po nim znika z rozmowy; komputer zapomina tyle pytań (pole popraw przy następnym). Usuń zdejmuje dymek z „Cofnij” na 6 s i Ctrl+Z.
    // Stop jest w miejscu Wyślij (wyżej). Do tego dnia pod ostatnim pytaniem stał sam ołówek.
    let rzadDymka = null;
    function zamknijRzad() { if (rzadDymka) { rzadDymka.remove(); rzadDymka = null; } }
    function kopiujTekst(t, b) {
      const gotowe = () => { if (b) b.textContent = 'Skopiowane'; setTimeout(zamknijRzad, 900); };
      const zapas = () => { const x = el('textarea', { 'aria-hidden': 'true' }); x.value = t; x.style.cssText = 'position:fixed;opacity:0;left:0;top:0'; document.body.append(x); x.select(); try { document.execCommand('copy'); } catch { /* bez schowka */ } x.remove(); gotowe(); };
      try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(gotowe, zapas); return; } } catch { /* niżej */ }
      zapas();
    }
    const tekstWpisu = (w) => String(w.tekst || w.blad || '').trim();
    const calaRozmowa = () => historia.map((w) => `${w.kto === 'ja' ? 'Ja' : 'Asystent'}: ${tekstWpisu(w)}`).join('\n\n');
    function popraw(i) {
      if (pracuje || !historia[i] || historia[i].kto !== 'ja') return;
      const t = historia[i].tekst || '', k = historia.slice(i).filter((w) => w.kto === 'ja').length;
      historia.splice(i);
      zapiszHistorie();
      poprawka = (Number(poprawka) || 0) + k;
      rysuj();
      pole.value = t;
      rosnij();
      przyciski();
      pole.focus();
      uz('popraw', String(k));
    }
    function usunDymek(i) {
      if (pracuje || !historia[i]) return;
      const [w] = historia.splice(i, 1);
      zapiszHistorie();
      ruchy.wstecz.push({ dymek: { i, w } });
      ruchy.naprzod.length = 0;
      rysuj();
      pokazCofnijCzat('Cofnij usunięcie dymka');
      uz('usun-dymek', w.kto);
    }
    function pokazRzad(e, i) {
      const byl = rzadDymka && rzadDymka.parentNode === e;
      zamknijRzad();
      if (byl) return;
      const w = historia[i];
      const r = el('div', { class: 'czat-dymek-akcje', role: 'group', 'aria-label': 'Ten dymek' });
      const b = (napis, fn) => { const x = el('button', { type: 'button', class: 'czat-dymek-akcja', text: napis }); x.addEventListener('click', (ev) => { ev.stopPropagation(); fn(x); }); r.append(x); };
      b('Kopiuj', (x) => kopiujTekst(tekstWpisu(w), x));
      if (w.kto === 'ja') b('Popraw', () => popraw(i));
      b('Usuń', () => usunDymek(i));
      b('Kopiuj rozmowę', (x) => kopiujTekst(calaRozmowa(), x));
      e.append(r);
      rzadDymka = r;
    }
    // Ta sama rozmowa dla komputera (pamięta 6 ostatnich pytań), a po 6 godzinach ciszy nowa.
    function rozmowa() {
      let r = pamiec.czytaj('rozmowa', null);
      if (!r || Date.now() - pamiec.czytaj('ostatnio', 0) > NOWA_ROZMOWA_MS) { r = losowe(); pamiec.zapisz('rozmowa', r); }
      pamiec.zapisz('ostatnio', Date.now());
      return r;
    }
    async function zadaj(q, czekanie) {
      pracuje = true;
      przyciski();
      mysli = el('div', { class: 'czat-w ai czat-mysli', role: 'status', 'aria-label': 'Komputer myśli' }, el('div', { class: 'czat-babelek', html: '<i></i><i></i><i></i>' }));
      usunPusto();
      lista.append(mysli);
      naDol();
      // Licznik czasu przy kropkach (od 8.11.2026): po 10 s widać, ile sekund komputer już myśli, więc długa odpowiedź nie wygląda na zawieszenie. Stop przerywa.
      const odMysli = Date.now(), licznik = el('span', { class: 'czat-mysli-czas' }), zegarMysli = setInterval(() => { const s = Math.round((Date.now() - odMysli) / 1000); if (s >= 10 && mysli) { if (!licznik.isConnected) mysli.append(licznik); licznik.textContent = `Myślę ${s} s`; } }, 1000);
      // Z małego okna komputer dostaje też opis tego, co widać na ekranie (pole „w”), a odpowiada polem „poza” (od 27.10.2026 wieczorem).
      const widok = mini && o.widok ? o.widok() : null;
      const wskazano = !czekanie && mini && Boolean(wskaz);
      const wPole = czekanie ? '' : opisDlaKomputera(widok);
      // Asystent wie, na co patrzysz (od 9.11.2026): z dużego okna też idzie opis ekranu (pole „ekran”), bez krótkiej odpowiedzi małego okienka.
      const ekranW = !mini && !czekanie && o.widok ? o.widok() : null, ekran = ekranW && ekranW.pelny ? String(ekranW.pelny) : '';
      const popraw = czekanie ? 0 : Number(poprawka) || 0;
      if (!czekanie) poprawka = 0;
      const d = await (czekanie || zapytajGdzies(Object.assign({ q, rozmowa: rozmowa(), z: (o.zakladka && o.zakladka()) || '', poziom }, wPole ? { w: wPole } : {}, ekran ? { ekran } : {}, popraw ? { popraw } : {}), poziom === 'max' ? 305000 : poziom === 'xhigh' ? 215000 : CZEKAJ_MS, q));
      clearInterval(zegarMysli);
      mysli.remove();
      mysli = null;
      pracuje = false;
      przyciski();
      if (d && d.zatrzymane) {
        const i = historia.length - 1;
        if (historia[i] && historia[i].kto === 'ja') { historia.pop(); zapiszHistorie(); }
        poprawka = (Number(poprawka) || 0) + 1;
        if (!widokHistorii) rysuj();
        if (!pole.value.trim()) { pole.value = q; rosnij(); przyciski(); }
        stan('Zatrzymane. Popraw pytanie i wyślij.', 5000);
        return;
      }
      const w = !d ? { kto: 'ai', blad: ZDANIA.brak, q } : d.blad ? { kto: 'ai', blad: String(d.blad), q }
        : { kto: 'ai', tekst: String(d.odpowiedz || ''), linki: Array.isArray(d.linki) ? d.linki.slice(0, 3) : [], pokaz: d.pokaz && BIERNIK[d.pokaz.zakladka] ? d.pokaz : null };
      uz('odpowiedz', w.blad ? 'błąd: ' + String(w.blad).slice(0, 80) : `${(w.tekst || '').length} znaków, odnośników ${(w.linki || []).length}${w.pokaz ? ', pokaż ' + w.pokaz.zakladka : ''}`);
      const e = dodaj(w);
      // Długa odpowiedź: widać jej początek, nie koniec.
      if (e.offsetHeight > lista.clientHeight - 48) e.scrollIntoView({ block: 'start' }); else naDol();
      if (w.pokaz && otwarty()) pokazTeraz(w.pokaz, false);
      // Małe okno rozwija się na cały ekran, gdy pytanie było o rzecz wskazaną celownikiem (od 29.10.2026, Jacek: „to okno małe, jak już user point it as something
      // and it produces answer – then it should go full screen ai”), gdy wykracza poza to, co widać (pole „poza” od komputera), albo gdy odpowiedź jest długa.
      // Odpowiedź z błędem zostaje w małym oknie, żeby od razu można było spytać jeszcze raz.
      if (mini && otwarty() && !w.blad && (wskazano || (d && d.poza === true) || (w.tekst || '').length > 420)) setTimeout(() => { if (mini && otwarty()) otworz(); }, 700);
      else if (mini) setTimeout(() => { if (mini) odswiezChip(); }, 900);
    }
    // Wysłanie w trakcie dyktowania (strzałką albo Enterem): mikrofon gaśnie bez drugiego wysłania, a słowa, które Soniox odda jeszcze potem, nie wracają do pola
    // (30.10.2026; Jacek: „wysłało, wyświetliło u góry i zatrzymało na dole ten sam tekst … jak jest wysłane, to musi kasować”). Wcześniej mikrofon słuchał dalej,
    // wpisywał całe pytanie z powrotem i zostawiał je w polu i w szkicu.
    function glosBezWysylki() {
      if (glos.stan === 'nic') return;
      glos.wyslij = false;
      glosKoniec();
    }
    function wyslij(t) {
      if (edycja.aktywna) { if (String(t || '').trim()) glosBezWysylki(); return zapiszPytanie(t); }
      // Do 7.11.2026 pytanie było ucinane do 600 znaków, więc długie dyktowanie przepadało (Jacek: „nagrało tylko tyle, ile się nagra”). Teraz 6000.
      const q = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 4000000);
      if (!q || pracuje) return false;
      glosBezWysylki();
      if (hal.otwarty) { uz('hal-pytanie', q); pole.value = ''; bezCofnijPola = true; rosnij(); przyciski(); halZadaj(q); return true; }
      uz('pytanie', q);
      pole.value = '';
      bezCofnijPola = true;
      rosnij();
      przyciski();
      dodaj({ kto: 'ja', tekst: q, autor: autorZ(o.skad) });
      zadaj(q);
      return true;
    }
    // „Ręce”: zakładka, model albo Podium. Na telefonie stuknięcie w „Pokaż …” zamyka czat, żeby było widać, co pokazał.
    function pokazTeraz(p, reka) {
      if (reka && tryb === 'arkusz') { zamknij(); doRozmowy = Date.now(); }
      if (o.pokaz) Promise.resolve().then(() => o.pokaz(p, reka)).catch(() => { /* aplikacja pokaże, co umie */ });
    }

    // ---------------------------------------------------------------- otwieranie i zamykanie
    const otwarty = () => (tryb === 'strona' ? true : tryb === 'panel' ? !o.miejsce.hidden : korzen.classList.contains('widac'));
    // doRozmowy: chwila przejścia z rozmowy do zakładki („Pokaż …”). Wstecz w ciągu 10 minut wraca do rozmowy (od 26.10.2026,
    // Jacek: „Do tyłu nie działa”), app.js pyta o to przez wrocDoRozmowy.
    let wroc = null, zegarZamkniecia = 0, doRozmowy = 0;
    function dopasuj() {
      // Arkusz na telefonie stoi w widocznej części ekranu, więc klawiatura nie zasłania pola. Bez klawiatury kończy się nad
      // nawigacją aplikacji (o.dol), która zostaje widać, a z klawiaturą sięga do niej, bo nawigacja i tak leży pod klawiaturą.
      const v = window.visualViewport;
      if (tryb !== 'arkusz' || !v) return;
      const klawiatura = innerHeight - v.height > 120, dol = !klawiatura && o.dol ? Math.max(0, Math.round(o.dol() || 0)) : 0;
      korzen.style.setProperty('--czat-y', Math.round(v.offsetTop) + 'px');
      korzen.style.setProperty('--czat-h', Math.round(v.height) + 'px');
      korzen.style.setProperty('--czat-dol', dol + 'px');
      korzen.classList.toggle('klawiatura', klawiatura);
      korzen.classList.toggle('nad-nawigacja', dol > 0);
      if (mini) miniUstaw(v, klawiatura);
      ustawCofnij();
      if (document.activeElement === pole) naDol();
    }
    // ---------------------------------------------------------------- małe okno (od 27.10.2026 wieczorem)
    // Jacek: „long press … mały, przezroczysty ‚instant’ panel (pytanie i odpowiedź w odniesieniu do tego, co widać na bieżącej stronie)”. To ten sam czat, ta sama rozmowa i ten
    // sam mikrofon, tylko mniejszy i szklany: stoi nad przyciskiem asystenta (pod nim, gdy ten jest u góry ekranu), a nad klawiaturą, gdy ta jest otwarta. Komputer dostaje z pytaniem
    // opis tego, co widać (o.widok), a w odpowiedzi pole „poza”: gdy pytanie wykracza poza ekran, okno rozwija się na cały ekran.
    function odswiezChip() {
      const w = o.widok ? o.widok() : null;
      miniChip.textContent = w && w.krotko ? w.krotko : 'To, co widzisz';
    }
    function miniKlasy() {
      korzen.classList.toggle('czat-mini', mini);
      if (zaslona) zaslona.classList.toggle('mini', mini);
      pole.placeholder = edycja.aktywna ? 'Nowe pytanie na stałe…' : mini ? 'Zapytaj o to, co widzisz…' : 'Zapytaj o auta…';
      if (mini) odswiezChip();
    }
    function miniUstaw(v, klawiatura) {
      const k = o.kotwica ? o.kotwica() : null;
      const dolV = Math.max(0, innerHeight - (v.offsetTop + v.height));
      const nad = klawiatura || !k || k.top + k.height / 2 >= innerHeight * 0.4;
      korzen.classList.toggle('mini-pod', !nad);
      korzen.style.setProperty('--mini-b', Math.max(8, Math.round(klawiatura || !k ? dolV + 8 : innerHeight - k.top + 12)) + 'px');
      korzen.style.setProperty('--mini-t', (k ? Math.round(k.bottom + 12) : 72) + 'px');
    }
    function otworz(m) {
      if (tryb === 'strona') return;
      doRozmowy = 0;
      poCzasie();
      if (window.AutaBrama) pobierzKontekst();
      pobierzWspolne(() => { if (widokHistorii === 'historia') pokazHistorie('historia', true); });
      // Małe okno tylko na telefonie, w arkuszu. Otwarte małe okno rozwija się na cały ekran, gdy ktoś otwiera czat zwykłym stuknięciem.
      const malo = m === true && tryb === 'arkusz' && innerWidth < 760;
      if (otwarty() && mini && !malo) { mini = false; zdejmijWskazanie(); miniKlasy(); dopasuj(); naDol(); if (o.naZmiane) o.naZmiane(true, false); return; }
      if (otwarty() && malo) return;
      mini = malo;
      if (malo) otwartoMini = Date.now();
      if (malo && korzen.kasujMiniY) korzen.kasujMiniY();
      if (belka && !malo && !otwarty()) { const n = pamiec.czytaj('belka-pokazy', 0); belka.classList.toggle('z-podpisem', !pamiec.czytaj('belka-umie', false) && n < 5); pamiec.zapisz('belka-pokazy', n + 1); }
      miniKlasy();
      if (!otwarty()) wroc = document.activeElement;
      if (tryb === 'panel') o.miejsce.hidden = false;
      else {
        clearTimeout(zegarZamkniecia);
        zaslona.hidden = false;
        korzen.hidden = false;
        dopasuj();
        void korzen.offsetWidth;
        zaslona.classList.add('widac');
        korzen.classList.add('widac');
      }
      rosnij();
      // Pusta rozmowa zaczyna od góry (iskra, zdanie, pytania), także na niskim ekranie, gdzie treść nie mieści się w całości.
      if (!widokHistorii) { if (historia.length) naDol(); else lista.scrollTop = edycja.aktywna ? pustoST : 0; }
      if (dotyk || mini) korzen.focus({ preventScroll: true }); else pole.focus({ preventScroll: true });
      if (czeka.size) sluchaj();
      if (o.naZmiane) o.naZmiane(true, mini);
    }
    function zamknij() {
      wylaczEdycje();
      zamknijMenu(false);
      pokazCofnijCzat(null);
      if (celowanie) wskazKoniec(null, true);
      zdejmijWskazanie();
      if (glos.stan !== 'nic') glosStop(false);
      if (tryb === 'strona') { if (o.zamknij) o.zamknij(); return; }
      if (!otwarty()) return;
      const bylMini = mini;
      mini = false;
      if (tryb === 'panel') o.miejsce.hidden = true;
      else {
        zaslona.classList.remove('widac');
        korzen.classList.remove('widac');
        zegarZamkniecia = setTimeout(() => { korzen.hidden = true; zaslona.hidden = true; miniKlasy(); }, 340);
      }
      if (wroc && wroc.isConnected && wroc.focus) wroc.focus({ preventScroll: true });
      wroc = null;
      if (o.naZmiane) o.naZmiane(false, bylMini);
    }
    zamknijB.addEventListener('click', zamknij);
    rozwinB.addEventListener('click', () => otworz());
    if (belka) {
      let y0 = null, id = null, dy = 0;
      const nawigacja = (p) => { if (o.nawigacja) o.nawigacja(p); };
      belka.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        y0 = e.clientY;
        id = e.pointerId;
        dy = 0;
        try { belka.setPointerCapture(id); } catch { /* bez przechwycenia */ }
        belka.classList.add('ciagnie');
      });
      belka.addEventListener('pointermove', (e) => {
        if (y0 === null || e.pointerId !== id) return;
        dy = Math.max(0, y0 - e.clientY);
        nawigacja(Math.min(1, dy / 90));
      });
      const puszczone = (e, przerwane) => {
        if (y0 === null || e.pointerId !== id) return;
        const d = dy;
        y0 = null;
        belka.classList.remove('ciagnie');
        if (przerwane || (d >= 6 && d < 40)) { nawigacja(null); return; }
        pamiec.zapisz('belka-umie', true);
        belka.classList.remove('z-podpisem');
        zamknij();
        nawigacja(null);
      };
      belka.addEventListener('pointerup', (e) => puszczone(e, false));
      belka.addEventListener('pointercancel', (e) => puszczone(e, true));
      belka.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); zamknij(); } });
    }
    // Rozmowy otwierają listę; w listach ten sam przycisk to strzałka wstecz: z Rozmów do rozmowy, z Archiwum i kosza do Rozmów.
    historiaB.addEventListener('click', () => (widokHistorii ? wsteczHistorii() : pokazHistorie('historia')));
    nowaB.addEventListener('click', nowaRozmowa);
    cofnijC.addEventListener('click', () => cofnijRuch(false));
    // Stuknięcie dymka rozmowy (nie odnośnika ani przycisku w nim) pokazuje albo chowa jego rząd akcji; stuknięcie obok chowa rząd.
    lista.addEventListener('click', (e) => {
      if (widokHistorii || e.target.closest('a, button, .czat-dymek-akcje')) return;
      const bab = e.target.closest('.czat-babelek'), w = bab && bab.closest('.czat-w');
      if (!w || w.classList.contains('czat-mysli') || (getSelection && String(getSelection()).length)) { zamknijRzad(); return; }
      const i = [...lista.querySelectorAll(':scope > .czat-w:not(.czat-mysli)')].indexOf(w);
      if (i >= 0 && historia[i]) pokazRzad(w, i); else zamknijRzad();
    });
    cofnijC.addEventListener('animationend', (e) => { if (e.animationName.startsWith('czat-paruje')) pokazCofnijCzat(null); });
    // ---------------------------------------------------------------- wskazanie rzeczy na ekranie (próba od 28.10.2026, tylko małe okno)
    // Jacek o pomyśle „ping” (przeciągnąć wskaźnik na rzecz na ekranie, żeby asystent wiedział, o co chodzi): „Tak, zrób próbę”. Celownik w pasku małego okna, przytrzymany
    // i przeciągnięty palcem albo myszą, niesie pinezkę (przy palcu 48 px nad nim, żeby palec jej nie zasłaniał). Rzecz pod pinezką, w aplikacji albo w widocznej stronie
    // w ramce, dostaje ramkę w akcencie: karta auta w Ofertach (tytuł, cena, rocznik, przebieg), a gdzie indziej najbliższy element z tekstem od 3 do 300 znaków (karta
    // modelu na Podium, pole kalkulatora z podpisem). Puszczenie zostawia nad polem „O tym: …” z krzyżykiem; puszczenie obok wszystkiego albo Escape nic nie zostawia.
    // Pytanie z małego okna niesie wtedy komputerowi „Kasia wskazała: …” na początku opisu ekranu (opisDlaKomputera). Zastąpiło zamianę miejsc dawnych pigułek.
    const WSKAZ_NAD = 48;
    const czystyTekst = (t) => String(t || '').replace(/\s+/g, ' ').trim();
    const tekstEl = (x) => czystyTekst(typeof x.innerText === 'string' ? x.innerText : x.textContent);
    // Podpis pola bez samych pól (lista wyboru w podpisie oddałaby wszystkie swoje pozycje).
    const tekstPodpisu = (l) => { const c = l.cloneNode(true); c.querySelectorAll('input, select, textarea, output, button').forEach((x) => x.remove()); return czystyTekst(c.textContent); };
    function opisRzeczy(e) {
      if (!e || !e.closest) return null;
      const d = e.ownerDocument, karta = e.closest('.karta-produktu');
      if (karta) {
        // Bez przekreślonej dawnej ceny: sklejała się z aktualną („69 999 zł72 999 zł”).
        const bezStarej = (x) => { const c = x.cloneNode(true); c.querySelectorAll('s, del').forEach((y) => y.remove()); return czystyTekst(c.textContent); };
        const cz = ['.tytul', '.cena', '.cechy-male'].map((s) => karta.querySelector(s)).filter(Boolean).map(bezStarej).filter(Boolean);
        const t = cz.length ? cz.join(', ') : tekstEl(karta);
        if (t) return { el: karta, tekst: t.slice(0, 300) };
      }
      const p = e.closest('input, select, textarea, output');
      if (p) {
        const lab = (p.labels && p.labels[0]) || p.closest('label');
        const opis = lab ? tekstPodpisu(lab) : czystyTekst(p.getAttribute('aria-label') || p.getAttribute('placeholder') || '');
        const wart = p.tagName === 'SELECT' ? (p.selectedOptions && p.selectedOptions[0] ? p.selectedOptions[0].textContent : '') : p.value;
        const t = [opis, czystyTekst(wart)].filter(Boolean).join(': ');
        if (t.length >= 3) return { el: lab && lab.contains(p) ? lab : p, tekst: t.slice(0, 300) };
      }
      for (let x = e; x && x !== d.body && x !== d.documentElement; x = x.parentElement) {
        const t = tekstEl(x);
        if (t.length > 300) break;
        if (t.length >= 3) return { el: x, tekst: t };
      }
      return null;
    }
    // Rzecz pod punktem okna: najpierw w dokumencie aplikacji (bez czatu, zasłony i kółka asystenta), a gdy pod spodem jest ramka ze stroną, w jej dokumencie
    // i w jej współrzędnych (do trzech ramek w głąb). Oddaje { el, tekst, ramki } albo null.
    function rzeczPod(x, y) {
      let d = document, ox = 0, oy = 0;
      const ramki = [];
      for (let glebiej = 0; glebiej < 4; glebiej++) {
        const e = glebiej ? d.elementFromPoint(x - ox, y - oy)
          : document.elementsFromPoint(x, y).find((z) => !korzen.contains(z) && z !== zaslona && z !== pinezka && z !== ramkaW && !(z.closest && z.closest('.czat-plywak')));
        if (!e) return null;
        if (e.tagName !== 'IFRAME') { const r = opisRzeczy(e); return r ? Object.assign(r, { ramki }) : null; }
        let wd = null;
        try { wd = e.contentDocument; } catch { /* strona z innego miejsca */ }
        if (!wd) return null;
        const b = e.getBoundingClientRect();
        ox += b.left + e.clientLeft;
        oy += b.top + e.clientTop;
        ramki.push(e);
        d = wd;
      }
      return null;
    }
    // Ramka 2 px w akcencie, 3 px od wskazanej rzeczy, z jej zaokrągleniem. Przesunięcie ramek stron liczy się za każdym razem, bo strona mogła się przewinąć.
    function pokazRamke(r) {
      if (!ramkaW) return;
      if (!r || !r.el.isConnected) { ramkaW.hidden = true; return; }
      let ox = 0, oy = 0;
      for (const f of r.ramki) { const b = f.getBoundingClientRect(); ox += b.left + f.clientLeft; oy += b.top + f.clientTop; }
      const b = r.el.getBoundingClientRect(), widok = r.el.ownerDocument.defaultView;
      const rog = (widok && parseFloat(widok.getComputedStyle(r.el).borderTopLeftRadius)) || 0;
      Object.assign(ramkaW.style, { left: Math.round(b.left + ox - 3) + 'px', top: Math.round(b.top + oy - 3) + 'px', width: Math.round(b.width + 6) + 'px',
        height: Math.round(b.height + 6) + 'px', borderRadius: Math.round(rog + 3) + 'px' });
      ramkaW.hidden = false;
    }
    // Po wskazaniu i po stuknięciu w „O tym: …” ramka stoi przez chwilę (idzie za stroną, gdy ta się przewija), potem znika.
    function mignijRamka() {
      clearTimeout(zegarRamki);
      if (!wskaz) { if (ramkaW) ramkaW.hidden = true; return; }
      const start = Date.now();
      const krok = () => {
        pokazRamke(wskaz);
        zegarRamki = Date.now() - start < 800 ? setTimeout(krok, 100) : setTimeout(() => { if (ramkaW && !celowanie) ramkaW.hidden = true; }, 1000);
      };
      krok();
    }
    function ustawWskazanie(r) {
      wskaz = r;
      wskazTekst.replaceChildren(el('span', { class: 'czat-wskazane-o', text: 'O tym: ' }), document.createTextNode(r.tekst));
      wskazTekst.setAttribute('aria-label', `O tym: ${r.tekst}. Pokaż na ekranie`);
      wskazane.hidden = false;
      mignijRamka();
      uz('wskazanie', r.tekst.slice(0, 120));
    }
    function zdejmijWskazanie() {
      wskaz = null;
      wskazane.hidden = true;
      clearTimeout(zegarRamki);
      if (ramkaW) ramkaW.hidden = true;
    }
    // Pole „w” pytania z małego okna: opis ekranu od aplikacji, a gdy coś wskazano, najpierw ta rzecz („Kasia wskazała: …”), razem najwyżej 500 znaków.
    // Wskazanie znika po wysłaniu pytania.
    function opisDlaKomputera(widok) {
      const ekran = widok && widok.pelny ? String(widok.pelny) : '';
      if (!mini || !wskaz) return ekran;
      const t = `Kasia wskazała: ${wskaz.tekst.slice(0, 200).replace(/[\s.,;:…]+$/u, '')}.${ekran ? ' ' + ekran : ''}`.slice(0, 500);
      zdejmijWskazanie();
      return t;
    }
    function wskazStart(e) {
      if (!mini || celowanie || !pinezka || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      e.stopPropagation();
      celowanie = { id: e.pointerId, x: e.clientX, y: e.clientY, nad: e.pointerType === 'mouse' ? 0 : WSKAZ_NAD, ruszyl: false, px: 0, py: 0 };
      try { wskazB.setPointerCapture(e.pointerId); } catch { /* wskaźnik z testu */ }
      addEventListener('pointermove', wskazRuch, true);
      addEventListener('pointerup', wskazKoniec, true);
      addEventListener('pointercancel', wskazKoniec, true);
      addEventListener('keydown', wskazKlawisz, true);
    }
    function wskazRuch(e) {
      const c = celowanie;
      if (!c || e.pointerId !== c.id) return;
      if (!c.ruszyl) {
        if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 6) return;
        c.ruszyl = true;
        clearTimeout(zegarRamki);
        korzen.classList.add('wskazuje');
        if (zaslona) zaslona.classList.add('wskazuje');
        pinezka.hidden = false;
      }
      e.preventDefault();
      c.px = e.clientX;
      c.py = Math.max(0, e.clientY - c.nad);
      pinezka.style.transform = `translate(${Math.round(c.px)}px, ${Math.round(c.py)}px)`;
      pokazRamke(rzeczPod(c.px, c.py));
    }
    function wskazKlawisz(e) {
      if (e.key !== 'Escape' || !celowanie) return;
      e.preventDefault();
      e.stopPropagation();
      wskazKoniec(null, true);
    }
    function wskazKoniec(e, anuluj) {
      const c = celowanie;
      if (!c || (e && e.pointerId !== c.id)) return;
      celowanie = null;
      removeEventListener('pointermove', wskazRuch, true);
      removeEventListener('pointerup', wskazKoniec, true);
      removeEventListener('pointercancel', wskazKoniec, true);
      removeEventListener('keydown', wskazKlawisz, true);
      korzen.classList.remove('wskazuje');
      if (zaslona) zaslona.classList.remove('wskazuje');
      if (pinezka) pinezka.hidden = true;
      if (!c.ruszyl) return;
      wskazPoRuchu = Date.now();
      const r = anuluj === true || !e || e.type !== 'pointerup' ? null : rzeczPod(c.px, c.py);
      if (r) ustawWskazanie(r); else if (ramkaW) ramkaW.hidden = true;
    }
    wskazB.addEventListener('pointerdown', wskazStart);
    // Samo stuknięcie (albo Enter) mówi, jak się celownikiem posługiwać.
    wskazB.addEventListener('click', () => { if (Date.now() - wskazPoRuchu < 600) return; stan('Przytrzymaj celownik i przeciągnij go na rzecz na ekranie.', 4000); });
    wskazTekst.addEventListener('click', () => {
      if (!wskaz || !wskaz.el.isConnected) return;
      try { wskaz.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { wskaz.el.scrollIntoView(); }
      mignijRamka();
    });
    wskazUsun.addEventListener('click', () => { zdejmijWskazanie(); pole.focus({ preventScroll: true }); });
    // Menu rozmowy zamyka stuknięcie obok i przewinięcie listy.
    document.addEventListener('pointerdown', (e) => { if (menuR && !menuR.contains(e.target)) zamknijMenu(false); }, true);
    lista.addEventListener('scroll', () => zamknijMenu(false), { passive: true });
    // Puszczenie palca po przytrzymaniu przycisku asystenta nie zamyka od razu otwartego małego okna (zasłona dostaje wtedy „click” w niektórych przeglądarkach).
    if (zaslona) zaslona.addEventListener('click', () => { if (Date.now() - otwartoMini < 500 || Date.now() - wskazPoRuchu < 500) return; zamknij(); });
    forma.addEventListener('submit', (e) => { e.preventDefault(); wyslij(pole.value); });
    wyslijB.addEventListener('click', () => (pracuje && !edycja.aktywna ? zatrzymaj() : wyslij(pole.value)));
    pole.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); wyslij(pole.value); } });
    pole.addEventListener('input', () => { rosnij(); przyciski(); });
    korzen.addEventListener('keydown', (e) => {
      if (menuR) {
        const l = [...menuR.querySelectorAll('button')], i = l.indexOf(document.activeElement), dol = e.key === 'ArrowDown';
        if (e.key === 'Escape') { e.preventDefault(); zamknijMenu(true); return; }
        if (dol || e.key === 'ArrowUp') { e.preventDefault(); l[i < 0 ? (dol ? 0 : l.length - 1) : (i + (dol ? 1 : l.length - 1)) % l.length].focus(); return; }
        if (e.key === 'Tab') zamknijMenu(false);
      }
      // Ctrl+Z i Ctrl+Y cofają i ponawiają ruchy rozmów i zmiany pytań na stałe (reguła cofnij-i-ponow); bez ruchu do cofnięcia działa skrót aplikacji.
      const zy = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (zy === 'z' || zy === 'y') && e.target !== pole) {
        if (cofnijRuch(zy === 'y' || e.shiftKey)) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); if (glos.stan !== 'nic') glosStop(false); else if (edycja.aktywna) edytujPytania(false); else if (widokHistorii) wsteczHistorii(); else zamknij(); return; }
      if (e.key !== 'Tab' || tryb !== 'arkusz') return;
      const f = [...korzen.querySelectorAll('button, a[href], textarea')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (document.activeElement === korzen) { e.preventDefault(); (e.shiftKey ? z : a).focus(); }
      else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    // Małe okno przesuwa się w górę i w dół (28.10.2026; Jacek: „ja dotykam na wolnym miejscu … i ono jest wtedy dragable. Po pół sekundy … albo od razu”,
    // „all the way up”): za górny pasek od razu, za każde inne wolne miejsce po przytrzymaniu 0,5 s, które zapala ramkę. Przyciski, pole pytania i odnośniki
    // działają jak zawsze. Przesunięcie (--mini-y) trzyma się do zamknięcia okna i nie wypuszcza okna poza ekran.
    if (tryb === 'arkusz') {
      let miniY = 0;
      const m = { id: null, x: 0, y: 0, start: 0, lo: 0, hi: 0, niesie: false, zegar: 0, gora: false, mysz: false, bylRuch: false };
      const ustawY = (y) => { miniY = y; korzen.style.setProperty('--mini-y', Math.round(y) + 'px'); };
      korzen.kasujMiniY = () => ustawY(0);
      // Wielkość małego okna (28.10.2026; Jacek: „you should be able to maybe resize a little bit”): kreska pod polem pytania. Ciągnięta w dół wydłuża rozmowę
      // (dół jedzie za palcem, góra stoi), w górę skraca; rozmowa od 96 px do 70% wysokości ekranu. Wielkość zostaje w pamięci, a powiększone okno pokazuje całą
      // rozmowę, a nie tylko ostatnie pytanie i odpowiedź.
      const uchwyt = el('span', { class: 'czat-mini-uchwyt', 'aria-hidden': 'true' }, el('i'));
      korzen.append(uchwyt);
      const listaH = (v, od = 96) => Math.round(Math.max(Math.min(96, od), Math.min(innerHeight * 0.7, v)));
      const ustawH = (h) => { korzen.style.setProperty('--mini-lista', h + 'px'); korzen.classList.add('mini-rozmiar'); };
      { const z = Number(pamiec.czytaj('mini-lista', 0)); if (z > 0) ustawH(listaH(z)); }
      const rm = { id: null, y: 0, h0: 0, y0: 0, pod: false };
      uchwyt.addEventListener('pointerdown', (e) => {
        if (!mini || (e.pointerType === 'mouse' && e.button !== 0)) return;
        e.preventDefault();
        e.stopPropagation();
        // Miejsce na powiększenie: w dół do kółka asystenta (okno stoi nad nim) albo do dołu ekranu, w górę do górnej krawędzi. Gdy w dół brakuje miejsca,
        // okno rośnie w górę, a nigdy nie wchodzi na kółko.
        const r0 = korzen.getBoundingClientRect(), kr = o.kotwica ? o.kotwica() : null, pod = korzen.classList.contains('mini-pod');
        const dolMax = !pod && kr && kr.top >= r0.bottom - 1 ? kr.top - 12 : innerHeight - 8;
        Object.assign(rm, { id: e.pointerId, y: e.clientY, h0: lista.getBoundingClientRect().height, y0: miniY, pod, dol: Math.max(0, dolMax - r0.bottom), gora: Math.max(0, r0.top - 8) });
        try { uchwyt.setPointerCapture(e.pointerId); } catch { /* wskaźnik z testu */ }
        korzen.classList.add('mini-niesie');
      });
      uchwyt.addEventListener('pointermove', (e) => {
        if (e.pointerId !== rm.id) return;
        e.preventDefault();
        let h = listaH(rm.h0 + (e.clientY - rm.y), rm.h0);
        if (rm.pod) { h = Math.min(h, rm.h0 + rm.dol); ustawH(h); return; }
        const wiecej = h - rm.h0, wDol = Math.min(Math.max(0, wiecej), rm.dol);
        if (wiecej > wDol + rm.gora) h = rm.h0 + wDol + rm.gora;
        ustawH(h);
        ustawY(rm.y0 + (wiecej > 0 ? wDol : wiecej));
      });
      const puscUchwyt = (e) => {
        if (e.pointerId !== rm.id) return;
        rm.id = null;
        korzen.classList.remove('mini-niesie');
        const v = parseFloat(korzen.style.getPropertyValue('--mini-lista'));
        if (v) pamiec.zapisz('mini-lista', v);
      };
      uchwyt.addEventListener('pointerup', puscUchwyt);
      uchwyt.addEventListener('pointercancel', puscUchwyt);
      const podnies = () => {
        const r = korzen.getBoundingClientRect();
        Object.assign(m, { niesie: true, start: miniY, lo: 8 - r.top, hi: innerHeight - 8 - r.bottom });
        korzen.classList.add('mini-niesie');
        try { korzen.setPointerCapture(m.id); } catch { /* wskaźnik z testu */ }
        if (!m.mysz && navigator.vibrate) { try { navigator.vibrate(12); } catch { /* bez wibracji */ } }
      };
      korzen.addEventListener('pointerdown', (e) => {
        if (!mini || m.id !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (e.target.closest('button, textarea, input, a, select, [role="button"], .czat-akcja')) return;
        Object.assign(m, { id: e.pointerId, x: e.clientX, y: e.clientY, niesie: false, gora: Boolean(e.target.closest('.czat-gora')), mysz: e.pointerType === 'mouse' });
        clearTimeout(m.zegar);
        if (!m.gora && !m.mysz) m.zegar = setTimeout(podnies, 500);
      });
      korzen.addEventListener('pointermove', (e) => {
        if (e.pointerId !== m.id) return;
        const dy = e.clientY - m.y;
        if (!m.niesie) {
          if ((m.gora || m.mysz) && Math.abs(dy) >= 6) podnies();
          else { if (Math.hypot(e.clientX - m.x, dy) > 10) { clearTimeout(m.zegar); m.id = null; } return; }
        }
        e.preventDefault();
        ustawY(m.start + Math.max(m.lo, Math.min(m.hi, dy)));
      });
      const pusc = (e) => {
        if (e.pointerId !== m.id) return;
        clearTimeout(m.zegar);
        m.id = null;
        if (!m.niesie) return;
        m.niesie = false;
        korzen.classList.remove('mini-niesie');
        m.bylRuch = true;
        setTimeout(() => { m.bylRuch = false; }, 400);
      };
      for (const ty of ['pointerup', 'pointercancel']) korzen.addEventListener(ty, pusc);
      // Po podniesieniu palec przesuwa okno, a nie przewija rozmowę.
      korzen.addEventListener('touchmove', (e) => { if (m.niesie) e.preventDefault(); }, { passive: false });
      korzen.addEventListener('click', (e) => { if (!m.bylRuch) return; m.bylRuch = false; e.preventDefault(); e.stopImmediatePropagation(); }, true);
    }
    // Arkusz zamyka też przeciągnięcie w dół za górny pasek, jak w iOS.
    if (tryb === 'arkusz') {
      let y0 = null, dy = 0;
      gora.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || innerWidth >= 760 || mini) return;
        y0 = e.clientY;
        dy = 0;
        try { gora.setPointerCapture(e.pointerId); } catch { /* bez przechwycenia */ }
        korzen.style.transition = 'none';
      });
      gora.addEventListener('pointermove', (e) => {
        if (y0 === null) return;
        dy = Math.max(0, e.clientY - y0);
        korzen.style.transform = `translateY(${dy}px)`;
      });
      const puszczone = () => {
        if (y0 === null) return;
        y0 = null;
        korzen.style.transition = '';
        korzen.style.transform = '';
        if (dy > 90) zamknij();
      };
      gora.addEventListener('pointerup', puszczone);
      gora.addEventListener('pointercancel', puszczone);
      if (window.visualViewport) { visualViewport.addEventListener('resize', dopasuj); visualViewport.addEventListener('scroll', dopasuj); }
      addEventListener('resize', dopasuj);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (hal.otwarty) halCisza(); if (glos.stan !== 'nic') glosStop(false); return; }
      if (czeka.size) { zamknijStrumien(); sluchaj(); }
    });

    // ---------------------------------------------------------------- mikrofon (Soniox)
    const natywny = o.glosNatywny || null;
    // Koniec wypowiedzi (od 27.10.2026; Jacek, zasada 28 z „dobry-interfejs.md”: „Jak ja skończę, to ja powiem: odbiór”, „jak skończę, to będę mówił bez odbioru … wtedy
    // niech się zamknie już”, „ja się złapię oddech i wtedy przerywa. To jest tak wkurzające”): pytanie kończy tylko słowo „odbiór” na końcu tekstu albo stuknięcie
    // mikrofonu. Cisza nie kończy niczego: oddech, pauza między zdaniami i kilka sekund bez słowa nie wysyłają pytania ani nie wyłączają mikrofonu. „Bez odbioru”
    // zamyka słuchanie bez wysyłania i zamyka okno rozmowy (albo HAL-a). Słowo kończące nie trafia do pola ani do pytania. Soniox daje tu tylko wskazówkę: „<end>”
    // (pauza w mowie, najpóźniej max_endpoint_delay_ms po ostatnim słowie) znaczy, że tekst przed nim jest już ostateczny, więc dopiero na „<end>” sprawdzamy, czy
    // tekst kończy się słowem kończącym. Bezpiecznik ciszy (CISZA_MS) wyłącza zapomniany mikrofon, niczego nie wysyła i mówi o tym pod polem.
    // Słowa kończące są też w context.terms, żeby Soniox rozpoznawał je pewniej (https://soniox.com/docs/stt/rt/endpoint-detection).
    const KONF_SONIOX = { model: 'stt-rt-v5', audio_format: 'auto', language_hints: ['pl'], enable_endpoint_detection: true, max_endpoint_delay_ms: 1000, context: { terms: ['odbiór', 'bez odbioru'] } };
    // W trybie HAL mikrofon słucha po angielsku i po polsku i podaje język każdego słowa (token.language), a pytanie niesie ten język do komputera.
    const konfSoniox = () => (hal.otwarty ? Object.assign({}, KONF_SONIOX, { language_hints: ['en', 'pl'], enable_language_identification: true }) : KONF_SONIOX);
    const CISZA_MS = 15000;
    // „Bez odbioru” sprawdzamy przed „odbiorem”. Wielkość liter, kropka i inne znaki na końcu nie mają znaczenia, a „od biór” rozdzielone przez Soniox też się liczy.
    const KONIEC_BEZ = /(^|[^\p{L}\p{N}])bez\s+od\s?bi[oó]r(?:u)?[^\p{L}\p{N}]*$/iu;
    const KONIEC_ODBIOR = /(^|[^\p{L}\p{N}])od\s?bi[oó]r[^\p{L}\p{N}]*$/iu;
    // Zwraca rodzaj końca ('bez', 'odbior' albo '') i tekst bez słowa kończącego. Kropka, pytajnik i wykrzyknik przed nim zostają, przecinek i myślnik znikają.
    function koniecWypowiedzi(tekst) {
      for (const [re, rodzaj] of [[KONIEC_BEZ, 'bez'], [KONIEC_ODBIOR, 'odbior']]) {
        const m = re.exec(tekst);
        if (!m) continue;
        const poz = m.index + (/^\s?$/.test(m[1]) ? 0 : m[1].length);
        return { rodzaj, tekst: tekst.slice(0, poz).replace(/[\s,;:\u2013\u2014-]+$/u, '') };
      }
      return { rodzaj: '', tekst };
    }
    const glos = { stan: 'nic', ws: null, rec: null, media: null, gotowe: '', tym: '', wyslij: true, konczy: false, zegar: 0, cisza: 0, zegarKlucza: 0, maKlucz: false, czekaNaKlucz: false };
    // „glos: false” (komputer nie da klucza) chowa mikrofon na 20 minut, a nie na zawsze (od 26.10.2026: na Redmi mikrofon został
    // schowany od nocy, kiedy klucza jeszcze nie było, choć komputer dostał go kilka godzin później; Jacek: „rozpoznał moje pisanie,
    // ale nie gadanie”). W pamięci stoi chwila odmowy, a dawne „false” nic już nie chowa.
    const BEZ_GLOSU_MS = 20 * 60000;
    let wlasnyZly = false;
    const wlasnyKlucz = () => (!wlasnyZly && typeof window.SONIOX_KLUCZ === 'string' && window.SONIOX_KLUCZ.length > 20 ? window.SONIOX_KLUCZ : '');
    const glosWolno = () => { if (wlasnyKlucz()) return true; const v = pamiec.czytaj('glos', null); return !(typeof v === 'number' && Date.now() - v < BEZ_GLOSU_MS); };
    const zapiszGlos = (jest) => pamiec.zapisz('glos', jest ? true : Date.now());
    const mozeNagrywac = () => Boolean(natywny)
      || Boolean(o.mikrofon && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.WebSocket);
    function pokazMik() {
      mikB.hidden = !(mozeNagrywac() && glosWolno());
    }
    function pokazGlos() {
      const n = glos.stan !== 'nic';
      mikB.classList.toggle('nagrywa', n);
      mikB.setAttribute('aria-label', n ? 'Zakończ dyktowanie' : 'Powiedz pytanie');
      mikB.setAttribute('aria-pressed', String(n));
      pole.placeholder = n ? 'Słucham…' : edycja.aktywna ? 'Nowe pytanie na stałe…' : mini ? 'Zapytaj o to, co widzisz…' : 'Zapytaj o auta…';
      if (glos.stan === 'start') stan('Włączam mikrofon…');
      else if (glos.stan === 'nagrywa') stan(glos.czekaNaKlucz ? 'Słucham. Komputer jeszcze łączy rozpoznawanie mowy…' : 'Słucham. Stuknij mikrofon, gdy skończysz, albo powiedz „odbiór”.');
      else if (!n && /^(Włączam|Słucham)/.test(stanL.textContent)) stan('');
      halStan();
    }
    // Własny klucz Soniox w aplikacji (od 6.11.2026, Jacek przez Nadzór: rozpoznawanie mowy ma iść prosto z telefonu do Soniox, bez komputera,
    // bo poza domem połączenie z komputerem często nie działa). Daje go kanal.js z budowy APK i IPA (window.SONIOX_KLUCZ), a strona w sieci go
    // nie ma i dalej prosi komputer. Gdy Soniox odrzuci własny klucz (401), do zamknięcia strony idzie dawna droga przez komputer.
    async function klucz() {
      if (wlasnyKlucz()) { glos.konf = null; return wlasnyKlucz(); }
      const k = pamiec.czytaj('klucz', null);
      if (k && k.klucz && Date.parse(k.do) - Date.now() > 120000) return k.klucz;
      const d = await zapytaj({ co: 'klucz' }, KLUCZ_MS);
      if (d && d.klucz) { pamiec.zapisz('klucz', d.jednorazowy ? null : { klucz: d.klucz, do: d.do }); glos.konf = d.konfiguracja || null; return d.klucz; }
      if (d && d.glos === false) { zapiszGlos(false); pokazMik(); }
      throw new Error(d && d.blad ? d.blad : ZDANIA.klucz);
    }
    // Mikrofon słucha od stuknięcia (od 26.10.2026, Jacek: „działa, ale wolno … speed up bez poświęcania jakości”): klucz od komputera
    // (około 2 s przez ntfy.sh) i połączenie z Soniox idą w tle, a kawałki dźwięku czekają w kolejce i lecą do Soniox zaraz po połączeniu,
    // więc można mówić od razu i nic nie przepada (Soniox przyjmuje dźwięk szybciej niż na żywo; tak wysyła go mikrofon-zywy.mjs).
    // Na iPhonie to samo robi Aplikacja.swift od powłoki 2 (natywny.wczesnie, window.KASIOMOBILE_POWLOKA); starsza powłoka nagrywa
    // dopiero po połączeniu, jak dawniej. Gdy klucza nie ma po 3 s, pod polem stoi, że komputer jeszcze łączy rozpoznawanie mowy.
    async function glosStart() {
      if (glos.stan !== 'nic' || pracuje) return;
      Object.assign(glos, { stan: 'start', gotowe: '', tym: '', przed: hal.otwarty ? '' : pole.value.replace(/\s+$/, ''), pomin: 0, ostatnio: null, dykt: '', wyslij: true, konczy: false, maKlucz: false, czekaNaKlucz: false });
      clearTimeout(glos.cisza);
      glos.cisza = 0;
      uz('mik', 'start');
      pokazGlos();
      const kluczTeraz = klucz();
      kluczTeraz.catch(() => { /* błąd przychodzi niżej, przez await */ });
      clearTimeout(glos.zegarKlucza);
      glos.zegarKlucza = setTimeout(() => { if (glos.stan !== 'nic' && !glos.maKlucz) { glos.czekaNaKlucz = true; pokazGlos(); } }, 3000);
      const jest = (k) => { glos.maKlucz = true; clearTimeout(glos.zegarKlucza); if (glos.czekaNaKlucz) { glos.czekaNaKlucz = false; pokazGlos(); } ciszaOdNowa(); return k; };
      // iPhone: Aplikacja.swift nagrywa PCM 16 kHz mono i sama łączy się z Soniox; „nagrywa” i słowa przyjdą przez Czat.zGlosu.
      if (natywny) {
        if (natywny.wczesnie && natywny.nagrywaj) natywny.nagrywaj();
        let k;
        try { k = jest(await kluczTeraz); } catch (e) { glosKoniec(e.message); return; }
        if (glos.stan === 'nic') return;
        natywny.start(k, JSON.stringify(Object.assign({}, konfSoniox(), glos.konf || {}, { audio_format: 'pcm_s16le', sample_rate: 16000, num_channels: 1 })));
        return;
      }
      // Ustawienia jak domyślne w Web SDK Soniox (MicrophoneSource): mono, 16 kHz, bez obróbki dźwięku w przeglądarce,
      // kawałki co 60 ms. Do 20.10.2026 z redukcją szumu i echa oraz kawałkami co 250 ms.
      try {
        glos.media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (e) { glosKoniec(e && /NotAllowed|Security/.test(e.name) ? ZDANIA.mikrofon : ZDANIA.mikrofonBrak); return; }
      if (glos.stan === 'nic') { glosSprzatnij(); return; }
      const typ = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
      // Kawałki sprzed połączenia czekają tutaj; pusty kawałek (koniec dźwięku) idzie zawsze po nich.
      const kolejka = [];
      let ws = null, koniecDzwieku = false;
      try {
        const rec = new MediaRecorder(glos.media, typ ? { mimeType: typ } : undefined);
        rec.ondataavailable = (e) => { if (!e.data || !e.data.size) return; if (ws && ws.readyState === 1) ws.send(e.data); else kolejka.push(e.data); };
        rec.onstop = () => { if (ws && ws.readyState === 1) ws.send(''); else koniecDzwieku = true; };
        glos.rec = rec;
        rec.start(60);
      } catch { glosKoniec(ZDANIA.mikrofonBrak); return; }
      if (glos.stan === 'start') { glos.stan = 'nagrywa'; pokazGlos(); }
      let k;
      try { k = jest(await kluczTeraz); } catch (e) { glosKoniec(e.message); return; }
      if (glos.stan === 'nic') return;
      ws = new WebSocket(SONIOX, ['soniox-api-key', k]);
      glos.ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify(Object.assign({}, konfSoniox(), glos.konf || {})));
        for (const c of kolejka.splice(0)) ws.send(c);
        if (koniecDzwieku) ws.send('');
      };
      // Połączenie po skończonym nagraniu (pytanie już poszło albo zaczęło się nowe) niczego już nie zmienia.
      ws.onmessage = (e) => { if (glos.ws === ws) zSoniox(e.data); };
      ws.onerror = () => { if (glos.ws === ws) glosKoniec(ZDANIA.soniox); };
      ws.onclose = () => { if (glos.ws === ws) glosKoniec(); };
    }
    // Wiadomość od Soniox: z WebSocketu strony albo, na iPhonie, przekazana przez Aplikacja.swift.
    function zSoniox(tekst) {
      let d;
      try { d = JSON.parse(tekst); } catch { return; }
      if (d.error_code) {
        if (d.error_code === 401) { pamiec.zapisz('klucz', null); wlasnyZly = true; }
        glosKoniec(ZDANIA.soniox);
        return;
      }
      let tym = '', koniec = false, slowa = false;
      for (const t of d.tokens || []) {
        const s = String(t.text || '');
        if (s === '<end>') koniec = true;
        else if (/^<[a-z]+>$/.test(s)) continue;
        else {
          if (s.trim()) slowa = true;
          if (t.language) glos.jezyk = t.language;
          if (t.is_final) glos.gotowe += s; else tym += s;
        }
      }
      glos.tym = tym;
      // Pole pokazuje tekst bez słowa kończącego („odbiór”, „bez odbioru”): ono nie należy do pytania, więc nie widać go ani w polu, ani w wysłanym pytaniu.
      const k = koniecWypowiedzi((glos.gotowe + glos.tym).replace(/\s+/g, ' ').trim());
      // Jeśli pole stało na dole, po dopisaniu słów przewija się do końca (ostatnie zdanie zawsze widać). Przewinięte ręcznie wyżej zostaje tam, gdzie je zostawiono.
      const bylNaDole = poleNaDole();
      // Dyktowanie dopisuje się za tekstem, który już stał w polu (od 7.11.2026, Jacek przez Nadzór: przejście z klawiatury Android na mikrofon aplikacji
      // i z powrotem niczego nie kasuje). Do tego dnia pole dostawało sam tekst z Soniox i wpisane wcześniej słowa znikały. Gdy w trakcie dyktowania
      // ktoś dopisze coś klawiaturą, to zostaje, a dalsze słowa idą za nim.
      if (glos.ostatnio !== null && pole.value !== glos.ostatnio) { glos.przed = pole.value.replace(/\s+$/, ''); glos.pomin = glos.dykt.length; }
      const nowe = k.tekst.slice(glos.pomin).trim();
      pole.value = glos.przed ? (nowe ? glos.przed + ' ' + nowe : glos.przed) : nowe;
      glos.ostatnio = pole.value;
      glos.dykt = k.tekst;
      rosnij();
      if (bylNaDole) pole.scrollTop = pole.scrollHeight;
      przyciski();
      if (slowa) ciszaOdNowa();
      // „<end>” to tylko granica: wypowiedź kończy się dopiero wtedy, gdy tuż przed nią padło słowo kończące (pauza w środku zdania nie kończy niczego).
      if (koniec && (glos.stan === 'nagrywa' || glos.stan === 'start')) {
        if (k.rodzaj === 'bez') { glosBezOdbioru(); return; }
        if (k.rodzaj === 'odbior') { glosWyslijTeraz(); return; }
      }
      if (d.finished) glosKoniec();
    }
    function glosSprzatnij() {
      try { if (glos.rec && glos.rec.state !== 'inactive') glos.rec.stop(); } catch { /* już stoi */ }
      if (glos.media) glos.media.getTracks().forEach((t) => t.stop());
      glos.media = null;
      glos.rec = null;
    }
    function glosStop(wyslijPo) {
      if (glos.stan === 'nic') return;
      clearTimeout(glos.cisza);
      glos.cisza = 0;
      glos.konczy = true;
      glos.wyslij = wyslijPo !== false;
      clearTimeout(glos.zegar);
      glos.zegar = setTimeout(() => glosKoniec(), 4000);
      if (natywny) { natywny.stop(); return; }
      if (!glos.rec) { glosKoniec(); return; }
      glos.stan = 'konczy';
      glosSprzatnij(); // rec.stop → onstop wysyła pusty kawałek, Soniox kończy i zamyka połączenie
    }
    // Koniec wypowiedzi słowem „odbiór” (od 27.10.2026): pytanie idzie od razu, bez czekania na ostatnią odpowiedź Soniox, bo wszystko przed „<end>” jest już ostateczne.
    // Mikrofon gaśnie, a Soniox dostaje pusty kawałek i kończy w tle; do strony już nic z niego nie wraca. Stuknięcie mikrofonu w trakcie (glosStop) dalej czeka
    // na resztę tekstu, bo palec bywa szybszy od słów.
    function glosWyslijTeraz() {
      if (glos.stan === 'nic') return;
      const ws = glos.ws;
      Object.assign(glos, { stan: 'nic', ws: null });
      clearTimeout(glos.zegar);
      clearTimeout(glos.cisza);
      clearTimeout(glos.zegarKlucza);
      glos.cisza = 0;
      if (natywny) natywny.stop(false); else glosSprzatnij();
      if (ws) setTimeout(() => { try { if (ws.readyState <= 1) ws.close(); } catch { /* zamknięte */ } }, 3000);
      uz('mik', 'odbiór');
      pokazGlos();
      if (glos.wyslij && pole.value.trim()) wyslij(pole.value);
    }
    function glosKoniec(blad) {
      if (glos.stan === 'nic') return;
      const ws = glos.ws;
      Object.assign(glos, { stan: 'nic', ws: null });
      clearTimeout(glos.zegar);
      clearTimeout(glos.cisza);
      clearTimeout(glos.zegarKlucza);
      glos.cisza = 0;
      if (natywny) natywny.stop(true);
      glosSprzatnij();
      if (ws && ws.readyState <= 1) { try { ws.close(); } catch { /* zamknięte */ } }
      pokazGlos();
      if (blad) { stan(blad, 7000); uz('mik', 'błąd: ' + blad); if (hal.otwarty) halNapis(blad); return; }
      // Połączenie zamknęło się samo, choć nikt nie kończył wypowiedzi (ani słowem „odbiór”, ani przyciskiem): nic nie idzie, a tekst zostaje w polu.
      if (glos.wyslij && !glos.konczy) {
        const t = ZDANIA.zerwane(Boolean(pole.value.trim()));
        stan(t, 9000);
        uz('mik', 'rozłączone');
        if (hal.otwarty) halNapis(t);
        return;
      }
      if (glos.wyslij && pole.value.trim()) wyslij(pole.value);
    }
    // Bezpiecznik ciszy: gdy po połączeniu z Soniox przez CISZA_MS nie padło żadne słowo, mikrofon gaśnie, nic nie idzie, a pod polem stoi, co się stało.
    // Każde nowe słowo liczy od nowa. window.KM_CISZA_MS skraca ten czas w testach.
    const ciszaMs = () => Number(window.KM_CISZA_MS) || CISZA_MS;
    function ciszaOdNowa() {
      clearTimeout(glos.cisza);
      glos.cisza = 0;
      if (glos.stan === 'nagrywa' || glos.stan === 'start') glos.cisza = setTimeout(glosCisza, ciszaMs());
    }
    function glosCisza() {
      glos.cisza = 0;
      if (glos.stan !== 'nagrywa' && glos.stan !== 'start') return;
      glos.wyslij = false;
      glosKoniec();
      const t = ZDANIA.cisza(Math.round(ciszaMs() / 1000));
      stan(t, 9000);
      uz('mik', 'cisza');
      if (hal.otwarty) halNapis(t);
    }
    // „Bez odbioru”: koniec rozmowy. Mikrofon gaśnie, nic nie idzie, okno rozmowy (albo HAL) się zamyka. Tekst, który zdążył wejść do pola, zostaje w nim
    // jak po zamknięciu okna w trakcie mówienia.
    function glosBezOdbioru() {
      if (glos.stan === 'nic') return;
      glos.wyslij = false;
      glosKoniec();
      uz('mik', 'bez odbioru');
      if (hal.otwarty) halZamknij(); else zamknij();
    }
    // iPhone: Aplikacja.swift podaje { stan: 'nagrywa' } po włączeniu mikrofonu, { wiadomosc } z każdą wiadomością Soniox,
    // { blad: 'mikrofon' | 'soniox' } i { koniec, bezWysylki } po zamknięciu połączenia (bezWysylki: aplikacja zeszła z ekranu).
    function zGlosu(d) {
      if (!d || glos.stan === 'nic') return;
      if (d.blad) { glosKoniec(d.blad === 'mikrofon' ? ZDANIA.mikrofon : ZDANIA.soniox); return; }
      if (d.stan === 'nagrywa' && glos.stan === 'start') { glos.stan = 'nagrywa'; pokazGlos(); }
      if (typeof d.wiadomosc === 'string') zSoniox(d.wiadomosc);
      if (d.koniec && glos.stan !== 'nic') { if (d.bezWysylki) glos.wyslij = false; glosKoniec(); }
    }
    // Stuknięcie w trakcie kończy dyktowanie, a tekst zostaje w polu do poprawy i Wyślij (od 7.11.2026, Jacek: „taki sam mikrofon i tak samo … działający …
    // Wciskam mikrofon, to jest tekst, pozostaje. A nie że od razu się wysyła”). Słowo „odbiór” dalej wysyła od razu; HAL wysyła stuknięciem jak dotąd.
    mikB.addEventListener('click', () => (glos.stan === 'nic' ? glosStart() : glosStop(false)));

    // ---------------------------------------------------------------- HAL (niespodzianka, od 26.10.2026 wieczorem)
    // Jacek: „przytrzymać przez pół sekundy … samą ikonę … tylko oko tego Hala. Podpis Hal jakiś tam, delikatny … Dzień dobry, Jacku albo
    // Kasiu … po angielsku i tym jego typowym głosem … rozmowa tylko głosowo, slightly animacyjnie … sam by czuł, jaki język … zaczynał od
    // angielskiego … czysty Opus, extra high, high, medium, losowo”. Ekran z samym okiem na cały ekran (przytrzymanie logo, app.js):
    // stuknięcie oka włącza mikrofon, drugie wysyła pytanie, a stuknięcie w trakcie mowy HAL-a ją przerywa i od razu słucha. Pytanie idzie
    // z polem hal: true, więc komputer odpowiada samym Opusem z Bramy, bez Kiro CLI i bez zapasowego modelu, z wysiłkiem wylosowanym
    // spośród medium, high i xhigh (asystent.js, „HAL”). HAL mówi głosem urządzenia (speechSynthesis) w języku odpowiedzi, nisko i wolno,
    // a pod okiem stoi napis tego, co mówi. Rozmowa nie trafia do czatu ani do Historii. Mikrofon słucha po angielsku i po polsku.
    const hal = { otwarty: false, korzen: null, oko: null, napis: null, rozmowa: '', pracuje: false, mowi: false, numer: 0 };
    const halImie = () => autorZ(o.skad);
    // Po angielsku HAL mówi do Jacka „Jack” (28.10.2026, Jacek: „mówi: good evening, Jack”).
    const halImieEn = () => (autorZ(o.skad) === 'Jacek' ? 'Jack' : 'Kasia');
    function halNapis(t) { if (hal.napis) hal.napis.textContent = t || ''; }
    function halStan() {
      if (!hal.korzen) return;
      const s = glos.stan !== 'nic' ? 'slucha' : hal.pracuje ? 'mysli' : hal.mowi ? 'mowi' : 'czeka';
      hal.korzen.dataset.stan = s;
      hal.oko.setAttribute('aria-label', { slucha: 'Zakończ i wyślij pytanie', mysli: 'HAL myśli', mowi: 'Przerwij i mów', czeka: 'Powiedz pytanie' }[s]);
    }
    function halCisza() {
      hal.numer++;
      hal.mowi = false;
      try { if (window.AutaGlos) window.AutaGlos.cisza(); else if (window.speechSynthesis) speechSynthesis.cancel(); } catch { /* bez głosu */ }
    }
    function halGlos(j) {
      let g = [];
      try { g = (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch { /* bez głosów */ }
      const lang = (x) => String(x.lang || '').toLowerCase().replace('_', '-');
      const meski = (x) => /male|george|ryan|daniel|thomas|guy|rjs|gbd|david|alex|jacek|krzysztof/i.test(x.name) && !/female/i.test(x.name);
      g = g.filter((x) => lang(x).startsWith(j));
      // Po angielsku najpierw głos brytyjski (28.10.2026, Jacek: „Przypuszczam, że on miał brytyjski akcent”); HAL-a grał Douglas Rain, spokojnie i wolno.
      const gb = j === 'en' ? g.filter((x) => lang(x).startsWith('en-gb')) : [];
      return gb.find(meski) || gb[0] || g.find(meski) || g[0] || null;
    }
    // Mówi zdanie po zdaniu, bo długa wypowiedź w jednym kawałku urywa się w części przeglądarek. Napis stoi od razu.
    function halMow(tekst, jezyk) {
      const t = String(tekst || '').replace(/\s+/g, ' ').trim();
      halNapis(t);
      halCisza();
      const zdania = (t.match(/[^.!?…]+[.!?…]*/g) || []).map((z) => z.trim()).filter(Boolean);
      const j = jezyk === 'pl' || jezyk === 'en' ? jezyk : /[ąćęłńóśźż]/i.test(t) ? 'pl' : 'en';
      // Android (od 7.11.2026): WebView nie ma speechSynthesis, więc mówi TextToSpeech telefonu przez most AutaGlos (Glos.java). Oko pulsuje, póki mówi.
      let natywny = false; try { natywny = !!(window.AutaGlos && window.AutaGlos.jest()); } catch { /* bez mostu */ }
      if (zdania.length && natywny) {
        hal.mowi = true;
        halStan();
        let n = 0;
        try { n = window.AutaGlos.mow(t, j, 0.55, j === 'pl' ? 0.92 : 0.82); } catch { n = 0; }
        if (!n) { hal.mowi = false; halStan(); return; }
        const puls = setInterval(() => { if (!hal.mowi || !hal.korzen) { clearInterval(puls); return; } hal.korzen.style.setProperty('--hal-moc', (0.72 + Math.random() * 0.5).toFixed(2)); }, 180);
        window.__halKoniec = (k) => { if (k === n) { hal.mowi = false; clearInterval(puls); halStan(); } };
        return;
      }
      if (!zdania.length || !window.speechSynthesis || typeof SpeechSynthesisUtterance !== 'function') { halStan(); return; }
      const numer = hal.numer, g = halGlos(j);
      hal.mowi = true;
      halStan();
      zdania.forEach((z, i) => {
        const u = new SpeechSynthesisUtterance(z);
        u.lang = j === 'pl' ? 'pl-PL' : 'en-GB';
        // Każde słowo rozjaśnia oko na chwilę, jak w filmie, gdy HAL mówi (--hal-moc w czat.css).
        u.onboundary = () => { if (numer === hal.numer && hal.korzen) hal.korzen.style.setProperty('--hal-moc', (0.72 + Math.random() * 0.5).toFixed(2)); };
        if (g) u.voice = g;
        u.pitch = 0.55;
        u.rate = j === 'pl' ? 0.92 : 0.82;
        const koniec = () => { if (numer === hal.numer && i === zdania.length - 1) { hal.mowi = false; halStan(); } };
        u.onend = koniec;
        u.onerror = koniec;
        speechSynthesis.speak(u);
      });
    }
    function halPowitaj() {
      const h = new Date().getHours();
      halMow(`Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}, ${halImieEn()}. I am a HAL 9000 computer. I am completely operational, and all my circuits are functioning perfectly.`, 'en');
    }
    async function halZadaj(q) {
      hal.pracuje = true;
      halCisza();
      halNapis('');
      halStan();
      const d = await zapytaj({ q, rozmowa: hal.rozmowa, z: '', hal: true, jezyk: glos.jezyk || '' }, CZEKAJ_MS);
      hal.pracuje = false;
      if (!hal.otwarty) return;
      if (d && d.odpowiedz && !d.blad) { uz('hal-odpowiedz', `${String(d.odpowiedz).length} znaków, ${d.jezyk || ''}`); halMow(String(d.odpowiedz), d.jezyk); return; }
      uz('hal-odpowiedz', 'błąd');
      // Bez odpowiedzi HAL mówi swoją znaną kwestią, a napis pod okiem mówi prawdę po polsku.
      halMow(`I am sorry, ${halImieEn()}. I am afraid I can not do that.`, 'en');
      halNapis(d && d.blad ? String(d.blad) : ZDANIA.brak);
    }
    function halOtworz() {
      if (hal.otwarty) return;
      if (otwarty()) zamknij();
      zamknijMenu(false);
      Object.assign(hal, { otwarty: true, rozmowa: 'hal-' + losowe(), pracuje: false, mowi: false, szkic: pole.value });
      // Pole pytania słucha w trybie HAL, więc szkic rozmowy czeka obok i wraca po zamknięciu HAL-a.
      pole.value = '';
      const x = przycisk('zamknij', 'Zamknij HAL', 'czat-zamknij', 18);
      x.addEventListener('click', halZamknij);
      const oko = el('button', { type: 'button', class: 'czat-hal-oko', 'aria-label': 'Powiedz pytanie' }, el('span', { class: 'czat-oko', 'aria-hidden': 'true' }), el('span', { class: 'czat-hal-swiatlo', 'aria-hidden': 'true' }));
      const napis = el('p', { class: 'czat-hal-napis', role: 'status', 'aria-live': 'polite' });
      const k = el('section', { class: 'czat czat-hal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'HAL', 'data-stan': 'czeka' },
        el('div', { class: 'czat-hal-gora' }, x),
        el('div', { class: 'czat-hal-srodek' }, oko, el('p', { class: 'czat-hal-podpis', text: 'HAL 9000' }), napis,
          // Jak z niego wyjść i jak pytać (od 7.11.2026, Jacek: „nie wiem, jak go wywołać … Nie wiem, jak tego odwrócić”).
          el('p', { class: 'czat-hal-rada', text: 'Stuknij oko i mów, stuknij znowu, żeby wysłać. Krzyżyk albo Wstecz zamyka.' })));
      Object.assign(hal, { korzen: k, oko, napis });
      oko.addEventListener('click', () => {
        if (hal.pracuje) return;
        if (hal.mowi) halCisza();
        if (glos.stan === 'nic') { halNapis(''); glosStart(); } else glosStop(true);
        halStan();
      });
      k.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); halZamknij(); } });
      document.body.append(k);
      void k.offsetWidth;
      k.classList.add('widac');
      oko.focus({ preventScroll: true });
      uz('hal', 'otwarty');
      halPowitaj();
    }
    function halZamknij() {
      if (!hal.otwarty) return;
      uz('hal', 'zamkniety');
      hal.otwarty = false;
      halCisza();
      if (glos.stan !== 'nic') glosStop(false);
      const k = hal.korzen;
      const szkic = hal.szkic || '';
      Object.assign(hal, { korzen: null, oko: null, napis: null, pracuje: false, szkic: '' });
      pole.value = szkic;
      rosnij();
      przyciski();
      // Oko gaśnie jak w filmie, potem znika cała scena.
      if (k) { k.classList.add('gasnie'); setTimeout(() => k.classList.remove('widac'), 560); setTimeout(() => k.remove(), 900); }
    }

    // ---------------------------------------------------------------- start
    // Dawna zamiana miejsc Rozmów i Nowej rozmowy (do 28.10.2026) nie ma już czego pamiętać.
    try { localStorage.removeItem('kasiomobile-czat:nawi-odwrot'); } catch { /* bez pamięci */ }
    rysuj();
    poCzasie();
    przyciski();
    pokazMik();
    for (const c of pamiec.czytaj('czeka', []) || []) {
      if (!c || !c.id || !c.q || pracuje) continue;
      const zostalo = CZEKAJ_MS - (Date.now() - c.czas);
      if (zostalo > 3000) {
        zadaj(c.q, new Promise((ok) => {
          const zegar = setTimeout(() => { if (czeka.delete(c.id)) { zapiszCzekajace(); ok(null); if (!czeka.size) zamknijStrumien(); } }, zostalo);
          czeka.set(c.id, { ok, zegar, czas: c.czas, q: c.q });
          sluchaj();
        }));
      } else {
        historia.push({ kto: 'ai', blad: ZDANIA.brak, q: c.q });
        zapiszHistorie();
        rysuj();
      }
    }
    zapiszCzekajace();
    const wrocDoRozmowy = () => { if (!doRozmowy || Date.now() - doRozmowy > 600000) return false; doRozmowy = 0; otworz(); return true; };
    const wstecz = () => { if (hal.otwarty) { halZamknij(); return true; } if (zamknijMenu(true)) return true; if (mini && otwarty()) { zamknij(); return true; } if (edycja.aktywna) { edytujPytania(false); return true; } if (widokHistorii) { wsteczHistorii(); return true; } if (!otwarty()) return false; zamknij(); return true; };
    // Wpis „O tym aucie …” z ikonki na karcie Ofert (od 9.11.2026): otwiera rozmowę, dopisuje tekst za tym, co już było w polu, i stawia kursor na końcu.
    function zapytajO(t) {
      if (hal.otwarty) return;
      otworz();
      if (widokHistorii) rysuj();
      const bylo = pole.value.replace(/\s+$/, '');
      if (bylo) zapiszPisane(bylo);
      pole.value = bylo ? bylo + '\n' + t : t;
      bezCofnijPola = true;
      rosnij();
      przyciski();
      pole.focus({ preventScroll: true });
      try { pole.setSelectionRange(pole.value.length, pole.value.length); } catch { /* starsze pole */ }
      pole.scrollTop = pole.scrollHeight;
    }
    const api = { zapytajO, otworz, mini: () => otworz(true), miniOtwarty: () => mini && otwarty(), zamknij, przelacz: () => (otwarty() ? zamknij() : otworz()), otwarty, wyslij, zGlosu, korzen, pracuje: () => pracuje, wrocDoRozmowy, wstecz, hal: halOtworz, halOtwarty: () => hal.otwarty };
    aktywny = api;
    return api;
  }
  window.Czat = { uruchom, dymek, ikona, zGlosu: (d) => { if (aktywny) aktywny.zGlosu(d); } };
})();