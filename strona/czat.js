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
//                               dol(): ile pikseli od dołu ekranu ma zostać widać pod arkuszem, na przykład nawigacja aplikacji })
//   Czat.dymek(przycisk): dymek przy ikonce bez podpisu. Wołaj go przed dodaniem własnego „click”.
//   czat.wstecz(): Wstecz w telefonie; zamyka menu rozmowy, z archiwum i kosza wraca do Historii, zamyka Historię, a gdy jej nie ma,
//                  rozmowę (true, gdy coś zamknął).
// Historia (od 26.10.2026): „Nowa rozmowa” odkłada bieżącą do Historii, a „Historia” pokazuje wcześniejsze i wraca do każdej z nich.
'use strict';
(() => {
  const SERWER = 'https://ntfy.sh', SONIOX = 'wss://stt-rt.soniox.com/transcribe-websocket';
  const CZEKAJ_MS = 90000, KLUCZ_MS = 20000, NAJWIECEJ = 40, NOWA_ROZMOWA_MS = 6 * 3600 * 1000;
  // Nazwy zakładek w bierniku, do przycisku „Pokaż …” pod odpowiedzią. Od 19.10.2026 „katalog” to Oferty (do 25.10.2026 Ogłoszenia, razem z dawnym
  // „Nowe”, które zostaje dla starych odpowiedzi w pamięci), a „modele” to Podium (do 25.10.2026 Katalag). Od 25.10.2026 „kredyt” to Finanse, „historia”
  // pigułka Historia w Ogłoszeniach, a „poradnik” zakładka Poradnik.
  const BIERNIK = { katalog: 'Oferty', nowe: 'Oferty', modele: 'Podium', kredyt: 'Finanse', historia: 'Historię', poradnik: 'Poradnik' };
  // Podpowiedzi w barwach zakładek, których dotyczą (od 26.10.2026): Podium niebieskie, Oferty zielone, Poradnik fioletowy, Finanse pomarańczowe.
  const PODPOWIEDZI = [['Najbezpieczniejsze auto do 75 tys. zł?', 'modele'], ['Co nowego dziś na Otomoto?', 'katalog'], ['Czy Corolla kombi zmieści psa?', 'poradnik'], ['Ile wyjdzie rata za 60 tys. zł?', 'kredyt']];
  const ZDANIA = {
    pusto: 'Zapytaj o auta, raty albo oferty. Odpowiada komputer w domu, zwykle w kilka sekund.',
    brak: 'Komputer nie odpowiedział. Może jest wyłączony albo śpi.',
    siec: 'Brak połączenia z internetem. Pytanie nie poszło.',
    klucz: 'Komputer nie dał klucza do mikrofonu. Może jest wyłączony.',
    mikrofon: 'Mikrofon nie ruszył. Sprawdź, czy Kasiomobile ma do niego dostęp w ustawieniach telefonu.',
    // Zgoda jest, ale telefon nie dał dźwięku (od 26.10.2026: na Redmi tak było bez zgody MODIFY_AUDIO_SETTINGS w aplikacji).
    mikrofonBrak: 'Telefon nie dał dźwięku z mikrofonu. Spróbuj jeszcze raz albo napisz pytanie.',
    soniox: 'Rozpoznawanie mowy nie odpowiedziało. Spróbuj jeszcze raz albo napisz pytanie.',
  };
  // Strumień odpowiedzi z ntfy.sh czytany na bieżąco; bez strumieni (stara przeglądarka) pytamy co 2,5 sekundy.
  const STRUMIEN = typeof ReadableStream === 'function' && typeof TextDecoder === 'function';
  const pamiec = {
    czytaj(k, d) { try { const v = localStorage.getItem('kasiomobile-czat:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    zapisz(k, v) { try { localStorage.setItem('kasiomobile-czat:' + k, JSON.stringify(v)); } catch { /* pełna pamięć: zostaje poprzednie */ } },
  };
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
    mikrofon: '<path d="M12 3.5a3.4 3.4 0 0 0-3.4 3.4v5a3.4 3.4 0 0 0 6.8 0v-5A3.4 3.4 0 0 0 12 3.5zM18 11.9h-1.9a4.1 4.1 0 0 1-8.2 0H6a6 6 0 0 0 5.1 5.9v2.7h1.8v-2.7A6 6 0 0 0 18 11.9z"/>',
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
      if (e.pointerType === 'mouse') return;
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

    // ---------------------------------------------------------------- budowa
    const zaslona = tryb === 'arkusz' ? el('div', { class: 'czat-zaslona', hidden: true }) : null;
    const korzen = el('section', { class: `czat czat-${tryb}`, 'aria-label': 'Asystent', tabindex: '-1' });
    if (tryb === 'arkusz') { korzen.setAttribute('role', 'dialog'); korzen.setAttribute('aria-modal', 'true'); korzen.hidden = true; }
    const zamknijB = przycisk('zamknij', 'Zamknij', 'czat-zamknij', 18);
    // Historia i nowa rozmowa (od 26.10.2026, Jacek: „nie ma możliwości nawigacji i historii, i wyjścia z tego, i … rozpoczęcia od nowa”):
    // dwa przyciski z napisem, bo samej ikonki nikt nie brał za przycisk. Historia przełącza widok na listę wcześniejszych rozmów,
    // a Nowa rozmowa odkłada bieżącą do Historii i zaczyna od pustej. Wyjście to krzyżyk, Escape, Wstecz i zakładki pod rozmową.
    const pigulka = (n, napis, klasa) => { const b = el('button', { type: 'button', class: 'czat-pigulka ' + klasa, html: ikona(n, 18) }); b.append(el('span', { text: napis })); return b; };
    const historiaB = pigulka('historia', 'Historia', 'czat-historia');
    historiaB.setAttribute('aria-pressed', 'false');
    const nowaB = pigulka('nowa', 'Nowa rozmowa', 'czat-nowa');
    const gora = el('div', { class: 'czat-gora' }, tryb === 'arkusz' ? el('span', { class: 'czat-uchwyt', 'aria-hidden': 'true' }) : null,
      el('div', { class: 'czat-gora-lewo' }, historiaB, nowaB), zamknijB);
    const lista = el('div', { class: 'czat-lista', role: 'log', 'aria-live': 'polite', 'aria-label': 'Rozmowa z asystentem' });
    const stanL = el('p', { class: 'czat-stan', role: 'status', hidden: true });
    const pole = el('textarea', { class: 'czat-tekst', rows: '1', maxlength: '600', placeholder: 'Zapytaj o auta…', 'aria-label': 'Pytanie do asystenta', enterkeyhint: 'send', autocomplete: 'off' });
    const mikB = przycisk('mikrofon', 'Powiedz pytanie', 'czat-mik');
    mikB.hidden = true;
    const wyslijB = przycisk('wyslij', 'Wyślij', 'czat-wyslij');
    const forma = el('form', { class: 'czat-pole' }, pole, mikB, wyslijB);
    // „Cofnij” po przeniesieniu rozmowy do kosza albo archiwum (od 26.10.2026): nad dołem czatu, paruje w 6 s jak „Cofnij” w aplikacji
    // (błękitne szkło ze strzałką, styl w czat.css).
    const cofnijC = pigulka('cofnij', 'Cofnij', 'czat-cofnij');
    const cofnijPole = el('div', { class: 'czat-cofnij-pole', hidden: true }, cofnijC);
    korzen.append(gora, lista, stanL, forma, cofnijPole);
    if (zaslona) document.body.append(zaslona);
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
      wyslijB.disabled = pracuje || !pole.value.trim();
      wyslijB.setAttribute('aria-label', pracuje ? 'Komputer jeszcze odpowiada' : 'Wyślij');
      mikB.disabled = pracuje;
      nowaB.disabled = pracuje || !historia.length;
      historiaB.disabled = pracuje;
    }
    function rosnij() {
      pole.style.height = 'auto';
      pole.style.height = Math.min(pole.scrollHeight + 2, 132) + 'px';
    }
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
    function napisPokazu(p) {
      if (p.model && p.nazwa) return 'Pokaż model: ' + p.nazwa;
      if (p.porownaj) return 'Pokaż porównanie';
      if (p.podium) return 'Pokaż Podium';
      if (p.finanse) return 'Pokaż ratę w Finansach';
      if (p.szukaj) return 'Szukaj w Ofertach: ' + p.szukaj;
      if (p.rozdzial && p.nazwa) return 'Otwórz w Poradniku: ' + p.nazwa;
      return 'Pokaż ' + BIERNIK[p.zakladka];
    }
    function wiadomosc(w) {
      if (w.kto === 'ja') return el('div', { class: 'czat-w ja' }, el('div', { class: 'czat-babelek' }, ...bloki(w.tekst)));
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
        a.firstChild.textContent = String(l.tytul || l.adres);
        box.append(a);
      }
      return box;
    }
    function pusto() {
      const rzad = el('div', { class: 'czat-podpowiedzi' });
      for (const [t, z] of PODPOWIEDZI) {
        const b = el('button', { type: 'button', class: 'czat-podpowiedz', 'data-z': z, text: t });
        b.addEventListener('click', () => wyslij(t));
        rzad.append(b);
      }
      // Duży mikrofon na pustej rozmowie (od 26.10.2026, Jacek: „Brak dużego mikrofonu”), ten sam co mały przy polu pytania. Od tego samego
      // dnia to oko w stylu HAL 9000 (Jacek: „ever so slightly … reminiscent of HAL z Odysei Kosmicznej 2001”), a podpis mówi, co robi.
      const duzy = el('button', { type: 'button', class: 'czat-duzy-mik', 'aria-label': 'Powiedz pytanie', html: '<span class="czat-oko" aria-hidden="true"></span><span>Powiedz pytanie</span>' });
      duzy.hidden = !(mozeNagrywac() && glosWolno());
      duzy.addEventListener('click', () => (glos.stan === 'nic' ? glosStart() : glosStop(true)));
      return el('div', { class: 'czat-pusto' }, el('p', { text: ZDANIA.pusto }), duzy, rzad);
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
    const LISTY = { historia: 'archiwum', archiwum: 'w-archiwum', kosz: 'w-koszu' };
    const NAJWIECEJ_W = { historia: ARCHIWUM, archiwum: 50, kosz: 50 };
    const KOSZ_MS = 30 * 864e5;
    const NAZWY_LIST = { archiwum: 'Archiwum', kosz: 'Kosz' };
    const PUSTE = { historia: 'Wcześniejszych rozmów jeszcze nie ma.', archiwum: 'W archiwum nic nie ma.', kosz: 'Kosz jest pusty.' };
    // Cel ruchu palca w prawo i w lewo w każdej liście i jego wygląd (biały napis: archiwum 5,7:1, Historia 4,7:1, kosz 5,4:1).
    const AKCJE = { historia: { prawo: 'archiwum', lewo: 'kosz' }, archiwum: { prawo: 'historia', lewo: 'kosz' }, kosz: { prawo: 'historia', lewo: null } };
    const CEL = {
      archiwum: { napis: 'Do archiwum', ikona: 'archiwum', kolor: '#5856d6', cofnij: 'Cofnij przeniesienie do archiwum' },
      kosz: { napis: 'Do kosza', ikona: 'kosz', kolor: '#d70015', cofnij: 'Cofnij przeniesienie do kosza' },
      historia: { napis: 'Do Historii', ikona: 'historia', kolor: '#0071e3', cofnij: 'Cofnij powrót do Historii' },
    };
    const ruchy = { wstecz: [], naprzod: [] };
    let widokHistorii = false, menuR = null, zegarCofnij = 0;
    function rysuj() {
      widokHistorii = false;
      zamknijMenu(false);
      pokazCofnijCzat(null);
      historiaB.setAttribute('aria-pressed', 'false');
      lista.setAttribute('aria-label', 'Rozmowa z asystentem');
      lista.replaceChildren(...(historia.length ? historia.map(wiadomosc) : [pusto()]));
      if (mysli) lista.append(mysli);
      forma.hidden = false;
      przyciski();
      naDol();
    }
    const wsteczHistorii = () => (widokHistorii === 'historia' ? rysuj() : pokazHistorie('historia'));
    function czytajListe(n) {
      const a = pamiec.czytaj(LISTY[n], []);
      let l = Array.isArray(a) ? a.filter((r) => r && Array.isArray(r.wpisy) && r.wpisy.length) : [];
      if (n === 'kosz') {
        const swieze = l.filter((r) => Date.now() - (r.usunieto || 0) < KOSZ_MS);
        if (swieze.length !== l.length) { l = swieze; pamiec.zapisz(LISTY.kosz, l); }
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
      a.unshift({ id: pamiec.czytaj('rozmowa', null) || losowe(), czas: pamiec.czytaj('ostatnio', Date.now()), wpisy: historia });
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
      stan('Poprzednia rozmowa jest w Historii.', 5000);
    }
    // Po 6 godzinach ciszy rozmowa zaczyna się od nowa, jak dla komputera (rozmowa() niżej), a stara czeka w Historii.
    function poCzasie() {
      if (!historia.length || pracuje || czeka.size || (pamiec.czytaj('czeka', []) || []).length) return;
      if (Date.now() - pamiec.czytaj('ostatnio', 0) > NOWA_ROZMOWA_MS) odNowa();
    }
    // Otwiera rozmowę z Historii, archiwum albo kosza: wraca jako bieżąca, a bieżąca idzie do Historii.
    function wrocDo(n, r) {
      if (pracuje) return;
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
      if (na === 'kosz') x.usunieto = Date.now(); else delete x.usunieto;
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
    // Cofa albo ponawia ostatni ruch rozmowy. Oddaje false, gdy nie było czego.
    function cofnijRuch(ponow) {
      const k = (ponow ? ruchy.naprzod : ruchy.wstecz).pop();
      if (!k) return false;
      if (ponow ? przenies(k.z, k.na, k, k.j) : przenies(k.na, k.z, k, k.i)) (ponow ? ruchy.wstecz : ruchy.naprzod).push(k);
      pokazCofnijCzat(null);
      if (widokHistorii) pokazHistorie(widokHistorii, true);
      return true;
    }
    function pokazCofnijCzat(opis) {
      clearTimeout(zegarCofnij);
      cofnijPole.classList.remove('paruje');
      cofnijPole.hidden = !opis;
      if (!opis) return;
      cofnijC.setAttribute('aria-label', opis);
      void cofnijPole.offsetWidth;
      cofnijPole.classList.add('paruje');
      if (getComputedStyle(cofnijC).animationName === 'none' && !cofnijC.matches(':hover, :focus-visible')) zegarCofnij = setTimeout(() => pokazCofnijCzat(null), 6000);
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
        const x = el('button', { type: 'button', role: 'menuitem', class: 'czat-pigulka czat-menu-poz' + (p.cel === 'kosz' ? ' czat-do-kosza' : ''), html: ikona(p.ikona, 20) });
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
        el('span', { class: 'czat-rozmowa-tytul', text: pytania[0] ? pytania[0].tekst : 'Rozmowa' }),
        el('span', { class: 'czat-rozmowa-kiedy', text: `${n === 'kosz' ? zniknie(r.usunieto) : kiedy(r.czas)} · ${pytan(pytania.length)}` }));
      const strona = (cel, klasa) => (cel ? el('span', { class: klasa, html: ikona(CEL[cel].ikona, 22) }, el('span', { text: CEL[cel].napis })) : null);
      const w = el('div', { class: 'czat-wiersz', style: `--k-prawo:${prawo ? CEL[prawo].kolor : 'transparent'};--k-lewo:${lewo ? CEL[lewo].kolor : 'transparent'}` },
        el('div', { class: 'czat-pod', 'aria-hidden': 'true' }, strona(prawo, 'czat-pod-l'), strona(lewo, 'czat-pod-p')), b);
      const zrob = (cel) => () => ruch(n, cel, r);
      const pozycje = [prawo, lewo].filter(Boolean).map((cel) => ({ cel, napis: CEL[cel].napis, ikona: CEL[cel].ikona, zrob: () => odjedz(w, b, cel === lewo ? -1 : 1, zrob(cel)) }));
      przesuwalny(w, b, { prawo: prawo ? zrob(prawo) : null, lewo: lewo ? zrob(lewo) : null }, pozycje);
      b.addEventListener('click', () => wrocDo(n, r));
      b.addEventListener('keydown', (e) => { if (e.key === 'Delete' && lewo === 'kosz') { e.preventDefault(); odjedz(w, b, -1, zrob('kosz')); } });
      return w;
    }
    function pokazHistorie(n = 'historia', zostan = false) {
      if (pracuje) return;
      if (glos.stan !== 'nic') glosStop(false);
      zamknijMenu(false);
      const bylo = lista.scrollTop;
      widokHistorii = n;
      historiaB.setAttribute('aria-pressed', 'true');
      lista.setAttribute('aria-label', n === 'historia' ? 'Wcześniejsze rozmowy' : NAZWY_LIST[n]);
      const a = czytajListe(n), tresc = [];
      if (n !== 'historia') {
        const wroc = pigulka('wstecz', 'Historia', 'czat-wroc');
        wroc.addEventListener('click', () => pokazHistorie('historia'));
        tresc.push(el('div', { class: 'czat-naglowek-listy' }, wroc, el('h3', { class: 'czat-gdzie', text: NAZWY_LIST[n] })));
      }
      tresc.push(a.length ? el('div', { class: 'czat-rozmowy' }, ...a.map((r) => wierszRozmowy(n, r))) : el('p', { class: 'czat-pusto', text: PUSTE[n] }));
      if (n === 'historia') {
        const schowki = ['archiwum', 'kosz'].map((m) => [m, czytajListe(m).length]).filter(([, ile]) => ile).map(([m, ile]) => {
          const b = pigulka(m, NAZWY_LIST[m], 'czat-schowek');
          b.append(el('span', { class: 'czat-ile', text: String(ile) }));
          b.setAttribute('aria-label', `${NAZWY_LIST[m]}: ${rozmow(ile)}`);
          b.addEventListener('click', () => pokazHistorie(m));
          return b;
        });
        if (schowki.length) tresc.push(el('div', { class: 'czat-schowki' }, ...schowki));
      }
      lista.replaceChildren(...tresc);
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
        fetch(`${SERWER}/${o.kanal}-pytanie`, { method: 'POST', body: JSON.stringify(Object.assign({ id, skad: o.skad || '' }, tresc)), cache: 'no-store' })
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
      const d = await (czekanie || zapytaj({ q, rozmowa: rozmowa(), z: (o.zakladka && o.zakladka()) || '' }, CZEKAJ_MS, q));
      mysli.remove();
      mysli = null;
      pracuje = false;
      przyciski();
      const w = !d ? { kto: 'ai', blad: ZDANIA.brak, q } : d.blad ? { kto: 'ai', blad: String(d.blad), q }
        : { kto: 'ai', tekst: String(d.odpowiedz || ''), linki: Array.isArray(d.linki) ? d.linki.slice(0, 3) : [], pokaz: d.pokaz && BIERNIK[d.pokaz.zakladka] ? d.pokaz : null };
      const e = dodaj(w);
      // Długa odpowiedź: widać jej początek, nie koniec.
      if (e.offsetHeight > lista.clientHeight - 48) e.scrollIntoView({ block: 'start' }); else naDol();
      if (w.pokaz && otwarty()) pokazTeraz(w.pokaz, false);
    }
    function wyslij(t) {
      const q = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 600);
      if (!q || pracuje) return false;
      pole.value = '';
      rosnij();
      przyciski();
      dodaj({ kto: 'ja', tekst: q });
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
      if (document.activeElement === pole) naDol();
    }
    function otworz() {
      if (tryb === 'strona') return;
      doRozmowy = 0;
      poCzasie();
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
      naDol();
      if (dotyk) korzen.focus({ preventScroll: true }); else pole.focus({ preventScroll: true });
      if (czeka.size) sluchaj();
      if (o.naZmiane) o.naZmiane(true);
    }
    function zamknij() {
      zamknijMenu(false);
      pokazCofnijCzat(null);
      if (glos.stan !== 'nic') glosStop(false);
      if (tryb === 'strona') { if (o.zamknij) o.zamknij(); return; }
      if (!otwarty()) return;
      if (tryb === 'panel') o.miejsce.hidden = true;
      else {
        zaslona.classList.remove('widac');
        korzen.classList.remove('widac');
        zegarZamkniecia = setTimeout(() => { korzen.hidden = true; zaslona.hidden = true; }, 340);
      }
      if (wroc && wroc.isConnected && wroc.focus) wroc.focus({ preventScroll: true });
      wroc = null;
      if (o.naZmiane) o.naZmiane(false);
    }
    zamknijB.addEventListener('click', zamknij);
    historiaB.addEventListener('click', () => (widokHistorii === 'historia' ? rysuj() : pokazHistorie('historia')));
    nowaB.addEventListener('click', nowaRozmowa);
    cofnijC.addEventListener('click', () => cofnijRuch(false));
    cofnijC.addEventListener('animationend', (e) => { if (e.animationName.startsWith('czat-paruje')) pokazCofnijCzat(null); });
    // Menu rozmowy zamyka stuknięcie obok i przewinięcie listy.
    document.addEventListener('pointerdown', (e) => { if (menuR && !menuR.contains(e.target)) zamknijMenu(false); }, true);
    lista.addEventListener('scroll', () => zamknijMenu(false), { passive: true });
    if (zaslona) zaslona.addEventListener('click', zamknij);
    forma.addEventListener('submit', (e) => { e.preventDefault(); wyslij(pole.value); });
    wyslijB.addEventListener('click', () => wyslij(pole.value));
    pole.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); wyslij(pole.value); } });
    pole.addEventListener('input', () => { rosnij(); przyciski(); });
    korzen.addEventListener('keydown', (e) => {
      if (menuR) {
        const l = [...menuR.querySelectorAll('button')], i = l.indexOf(document.activeElement), dol = e.key === 'ArrowDown';
        if (e.key === 'Escape') { e.preventDefault(); zamknijMenu(true); return; }
        if (dol || e.key === 'ArrowUp') { e.preventDefault(); l[i < 0 ? (dol ? 0 : l.length - 1) : (i + (dol ? 1 : l.length - 1)) % l.length].focus(); return; }
        if (e.key === 'Tab') zamknijMenu(false);
      }
      // Ctrl+Z i Ctrl+Y w historii cofają i ponawiają ruchy rozmów (reguła cofnij-i-ponow); bez ruchu do cofnięcia działa skrót aplikacji.
      const zy = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (zy === 'z' || zy === 'y') && widokHistorii && e.target !== pole) {
        if (cofnijRuch(zy === 'y' || e.shiftKey)) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); if (glos.stan !== 'nic') glosStop(false); else if (widokHistorii) wsteczHistorii(); else zamknij(); return; }
      if (e.key !== 'Tab' || tryb !== 'arkusz') return;
      const f = [...korzen.querySelectorAll('button, a[href], textarea')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (document.activeElement === korzen) { e.preventDefault(); (e.shiftKey ? z : a).focus(); }
      else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    // Arkusz zamyka też przeciągnięcie w dół za górny pasek, jak w iOS.
    if (tryb === 'arkusz') {
      let y0 = null, dy = 0;
      gora.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || innerWidth >= 760) return;
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
      if (document.hidden) { if (glos.stan !== 'nic') glosStop(false); return; }
      if (czeka.size) { zamknijStrumien(); sluchaj(); }
    });

    // ---------------------------------------------------------------- mikrofon (Soniox)
    const natywny = o.glosNatywny || null;
    // max_endpoint_delay_ms (od 26.10.2026): Soniox daje „<end>” najpóźniej 1 s po ostatnim słowie, a nie po 2 s (domyślnie; dozwolone
    // 500–3000, https://soniox.com/docs/stt/rt/endpoint-detection). Pauzę między zdaniami i tak przeczekuje CHWILA_MS niżej.
    const KONF_SONIOX = { model: 'stt-rt-v5', audio_format: 'auto', language_hints: ['pl'], enable_endpoint_detection: true, max_endpoint_delay_ms: 1000 };
    // Soniox daje „<end>” już na pauzie krótszej niż sekunda między zdaniami (26.10.2026, rozmowa „Rozmowa z Opusem” na prawdziwym Soniox,
    // przy każdym ustawieniu wykrywania końca), więc po „<end>” czat czeka jeszcze CHWILA_MS. Nowe słowa w tym czasie znaczą, że pytanie
    // trwa: czekanie znika i zaczyna się od nowa przy następnym „<end>”. Pytanie idzie więc około 2 s po ostatnim słowie, a mikrofon
    // stuknięty w trakcie wysyła od razu. To samo na iPhonie, bo słowa ze Swifta idą przez zSoniox.
    const CHWILA_MS = 1500;
    const glos = { stan: 'nic', ws: null, rec: null, media: null, gotowe: '', tym: '', wyslij: true, zegar: 0, chwila: 0, zegarKlucza: 0, maKlucz: false, czekaNaKlucz: false };
    // „glos: false” (komputer nie da klucza) chowa mikrofon na 20 minut, a nie na zawsze (od 26.10.2026: na Redmi mikrofon został
    // schowany od nocy, kiedy klucza jeszcze nie było, choć komputer dostał go kilka godzin później; Jacek: „rozpoznał moje pisanie,
    // ale nie gadanie”). W pamięci stoi chwila odmowy, a dawne „false” nic już nie chowa.
    const BEZ_GLOSU_MS = 20 * 60000;
    const glosWolno = () => { const v = pamiec.czytaj('glos', null); return !(typeof v === 'number' && Date.now() - v < BEZ_GLOSU_MS); };
    const zapiszGlos = (jest) => pamiec.zapisz('glos', jest ? true : Date.now());
    const mozeNagrywac = () => Boolean(natywny)
      || Boolean(o.mikrofon && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.WebSocket);
    function pokazMik() {
      mikB.hidden = !(mozeNagrywac() && glosWolno());
      for (const b of lista.querySelectorAll('.czat-duzy-mik')) b.hidden = mikB.hidden;
    }
    function pokazGlos() {
      const n = glos.stan !== 'nic';
      mikB.classList.toggle('nagrywa', n);
      mikB.setAttribute('aria-label', n ? 'Zakończ i wyślij' : 'Powiedz pytanie');
      mikB.setAttribute('aria-pressed', String(n));
      pole.placeholder = n ? 'Słucham…' : 'Zapytaj o auta…';
      if (glos.stan === 'start') stan('Włączam mikrofon…');
      else if (glos.stan === 'nagrywa') stan(glos.czekaNaKlucz ? 'Słucham. Komputer jeszcze łączy rozpoznawanie mowy…' : 'Słucham. Gdy skończysz, pytanie pójdzie samo.');
      else if (!n && /^(Włączam|Słucham)/.test(stanL.textContent)) stan('');
      for (const b of lista.querySelectorAll('.czat-duzy-mik')) {
        b.classList.toggle('nagrywa', n);
        b.setAttribute('aria-label', n ? 'Zakończ i wyślij' : 'Powiedz pytanie');
        b.lastChild.textContent = n ? 'Słucham…' : 'Powiedz pytanie';
      }
    }
    async function klucz() {
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
      Object.assign(glos, { stan: 'start', gotowe: '', tym: '', wyslij: true, maKlucz: false, czekaNaKlucz: false });
      pokazGlos();
      const kluczTeraz = klucz();
      kluczTeraz.catch(() => { /* błąd przychodzi niżej, przez await */ });
      clearTimeout(glos.zegarKlucza);
      glos.zegarKlucza = setTimeout(() => { if (glos.stan !== 'nic' && !glos.maKlucz) { glos.czekaNaKlucz = true; pokazGlos(); } }, 3000);
      const jest = (k) => { glos.maKlucz = true; clearTimeout(glos.zegarKlucza); if (glos.czekaNaKlucz) { glos.czekaNaKlucz = false; pokazGlos(); } return k; };
      // iPhone: Aplikacja.swift nagrywa PCM 16 kHz mono i sama łączy się z Soniox; „nagrywa” i słowa przyjdą przez Czat.zGlosu.
      if (natywny) {
        if (natywny.wczesnie && natywny.nagrywaj) natywny.nagrywaj();
        let k;
        try { k = jest(await kluczTeraz); } catch (e) { glosKoniec(e.message); return; }
        if (glos.stan === 'nic') return;
        natywny.start(k, JSON.stringify(Object.assign({}, KONF_SONIOX, glos.konf || {}, { audio_format: 'pcm_s16le', sample_rate: 16000, num_channels: 1 })));
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
        ws.send(JSON.stringify(Object.assign({}, KONF_SONIOX, glos.konf || {})));
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
        if (d.error_code === 401) pamiec.zapisz('klucz', null);
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
          if (t.is_final) glos.gotowe += s; else tym += s;
        }
      }
      glos.tym = tym;
      pole.value = (glos.gotowe + glos.tym).replace(/\s+/g, ' ').trim();
      rosnij();
      przyciski();
      if (slowa) { clearTimeout(glos.chwila); glos.chwila = 0; }
      if (koniec && (glos.stan === 'nagrywa' || glos.stan === 'start')) {
        clearTimeout(glos.chwila);
        glos.chwila = setTimeout(() => { glos.chwila = 0; if (glos.stan === 'nagrywa' || glos.stan === 'start') glosWyslijTeraz(); }, CHWILA_MS);
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
      clearTimeout(glos.chwila);
      glos.chwila = 0;
      glos.wyslij = wyslijPo !== false;
      clearTimeout(glos.zegar);
      glos.zegar = setTimeout(() => glosKoniec(), 4000);
      if (natywny) { natywny.stop(); return; }
      if (!glos.rec) { glosKoniec(); return; }
      glos.stan = 'konczy';
      glosSprzatnij(); // rec.stop → onstop wysyła pusty kawałek, Soniox kończy i zamyka połączenie
    }
    // Koniec wypowiedzi (chwila ciszy po „<end>”, od 26.10.2026): pytanie idzie od razu, bez czekania na ostatnią odpowiedź Soniox,
    // bo wszystko przed „<end>” jest już ostateczne. Mikrofon gaśnie, a Soniox dostaje pusty kawałek i kończy w tle; do strony już
    // nic z niego nie wraca. Stuknięcie mikrofonu w trakcie (glosStop) dalej czeka na resztę tekstu, bo palec bywa szybszy od słów.
    function glosWyslijTeraz() {
      if (glos.stan === 'nic') return;
      const ws = glos.ws;
      Object.assign(glos, { stan: 'nic', ws: null });
      clearTimeout(glos.zegar);
      clearTimeout(glos.chwila);
      clearTimeout(glos.zegarKlucza);
      glos.chwila = 0;
      if (natywny) natywny.stop(false); else glosSprzatnij();
      if (ws) setTimeout(() => { try { if (ws.readyState <= 1) ws.close(); } catch { /* zamknięte */ } }, 3000);
      pokazGlos();
      if (glos.wyslij && pole.value.trim()) wyslij(pole.value);
    }
    function glosKoniec(blad) {
      if (glos.stan === 'nic') return;
      const ws = glos.ws;
      Object.assign(glos, { stan: 'nic', ws: null });
      clearTimeout(glos.zegar);
      clearTimeout(glos.chwila);
      clearTimeout(glos.zegarKlucza);
      glos.chwila = 0;
      if (natywny) natywny.stop(true);
      glosSprzatnij();
      if (ws && ws.readyState <= 1) { try { ws.close(); } catch { /* zamknięte */ } }
      pokazGlos();
      if (blad) { stan(blad, 7000); return; }
      if (glos.wyslij && pole.value.trim()) wyslij(pole.value);
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
    mikB.addEventListener('click', () => (glos.stan === 'nic' ? glosStart() : glosStop(true)));

    // ---------------------------------------------------------------- start
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
    const wstecz = () => { if (zamknijMenu(true)) return true; if (widokHistorii) { wsteczHistorii(); return true; } if (!otwarty()) return false; zamknij(); return true; };
    const api = { otworz, zamknij, przelacz: () => (otwarty() ? zamknij() : otworz()), otwarty, wyslij, zGlosu, korzen, pracuje: () => pracuje, wrocDoRozmowy, wstecz };
    aktywny = api;
    return api;
  }
  window.Czat = { uruchom, dymek, ikona, zGlosu: (d) => { if (aktywny) aktywny.zGlosu(d); } };
})();