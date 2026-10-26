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
    const gora = el('div', { class: 'czat-gora' }, tryb === 'arkusz' ? el('span', { class: 'czat-uchwyt', 'aria-hidden': 'true' }) : null, zamknijB);
    const lista = el('div', { class: 'czat-lista', role: 'log', 'aria-live': 'polite', 'aria-label': 'Rozmowa z asystentem' });
    const stanL = el('p', { class: 'czat-stan', role: 'status', hidden: true });
    const pole = el('textarea', { class: 'czat-tekst', rows: '1', maxlength: '600', placeholder: 'Zapytaj o auta…', 'aria-label': 'Pytanie do asystenta', enterkeyhint: 'send', autocomplete: 'off' });
    const mikB = przycisk('mikrofon', 'Powiedz pytanie', 'czat-mik');
    mikB.hidden = true;
    const wyslijB = przycisk('wyslij', 'Wyślij', 'czat-wyslij');
    const forma = el('form', { class: 'czat-pole' }, pole, mikB, wyslijB);
    korzen.append(gora, lista, stanL, forma);
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
      if (p.podium) return 'Pokaż Podium';
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
      // Duży mikrofon na pustej rozmowie (od 26.10.2026, Jacek: „Brak dużego mikrofonu”), ten sam co mały przy polu pytania.
      const duzy = el('button', { type: 'button', class: 'czat-duzy-mik', 'aria-label': 'Powiedz pytanie', html: ikona('mikrofon', 32) + '<span>Powiedz pytanie</span>' });
      duzy.hidden = !(mozeNagrywac() && pamiec.czytaj('glos', null) !== false);
      duzy.addEventListener('click', () => (glos.stan === 'nic' ? glosStart() : glosStop(true)));
      return el('div', { class: 'czat-pusto' }, el('p', { text: ZDANIA.pusto }), duzy, rzad);
    }
    function dodaj(w) {
      historia.push(w);
      zapiszHistorie();
      usunPusto();
      const e = wiadomosc(w);
      lista.insertBefore(e, mysli && mysli.parentNode === lista ? mysli : null);
      return e;
    }
    function rysuj() {
      lista.replaceChildren(...(historia.length ? historia.map(wiadomosc) : [pusto()]));
      if (mysli) lista.append(mysli);
      naDol();
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
      if (typeof d.glos === 'boolean') { pamiec.zapisz('glos', d.glos); pokazMik(); }
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
    if (zaslona) zaslona.addEventListener('click', zamknij);
    forma.addEventListener('submit', (e) => { e.preventDefault(); wyslij(pole.value); });
    wyslijB.addEventListener('click', () => wyslij(pole.value));
    pole.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); wyslij(pole.value); } });
    pole.addEventListener('input', () => { rosnij(); przyciski(); });
    korzen.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); if (glos.stan !== 'nic') glosStop(false); else zamknij(); return; }
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
    const KONF_SONIOX = { model: 'stt-rt-v5', audio_format: 'auto', language_hints: ['pl'], enable_endpoint_detection: true };
    const glos = { stan: 'nic', ws: null, rec: null, media: null, gotowe: '', tym: '', wyslij: true, zegar: 0 };
    const mozeNagrywac = () => Boolean(natywny)
      || Boolean(o.mikrofon && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.WebSocket);
    function pokazMik() {
      mikB.hidden = !(mozeNagrywac() && pamiec.czytaj('glos', null) !== false);
      for (const b of lista.querySelectorAll('.czat-duzy-mik')) b.hidden = mikB.hidden;
    }
    function pokazGlos() {
      const n = glos.stan !== 'nic';
      mikB.classList.toggle('nagrywa', n);
      mikB.setAttribute('aria-label', n ? 'Zakończ i wyślij' : 'Powiedz pytanie');
      mikB.setAttribute('aria-pressed', String(n));
      pole.placeholder = n ? 'Słucham…' : 'Zapytaj o auta…';
      if (glos.stan === 'start') stan('Włączam mikrofon…');
      else if (glos.stan === 'nagrywa') stan('Słucham. Gdy skończysz, pytanie pójdzie samo.');
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
      if (d && d.glos === false) { pamiec.zapisz('glos', false); pokazMik(); }
      throw new Error(d && d.blad ? d.blad : ZDANIA.klucz);
    }
    async function glosStart() {
      if (glos.stan !== 'nic' || pracuje) return;
      Object.assign(glos, { stan: 'start', gotowe: '', tym: '', wyslij: true });
      pokazGlos();
      let k;
      try { k = await klucz(); } catch (e) { glosKoniec(e.message); return; }
      if (glos.stan !== 'start') return;
      // iPhone: Aplikacja.swift nagrywa PCM 16 kHz mono i sama łączy się z Soniox; „nagrywa” i słowa przyjdą przez Czat.zGlosu.
      if (natywny) { natywny.start(k, JSON.stringify(Object.assign({}, KONF_SONIOX, glos.konf || {}, { audio_format: 'pcm_s16le', sample_rate: 16000, num_channels: 1 }))); return; }
      // Ustawienia jak domyślne w Web SDK Soniox (MicrophoneSource): mono, 16 kHz, bez obróbki dźwięku w przeglądarce,
      // kawałki co 60 ms. Do 20.10.2026 z redukcją szumu i echa oraz kawałkami co 250 ms.
      try {
        glos.media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 16000, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch { glosKoniec(ZDANIA.mikrofon); return; }
      if (glos.stan !== 'start') { glosSprzatnij(); return; }
      const ws = new WebSocket(SONIOX, ['soniox-api-key', k]);
      glos.ws = ws;
      ws.onopen = () => {
        ws.send(JSON.stringify(Object.assign({}, KONF_SONIOX, glos.konf || {})));
        const typ = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
        try {
          const rec = new MediaRecorder(glos.media, typ ? { mimeType: typ } : undefined);
          glos.rec = rec;
          rec.ondataavailable = (e) => { if (e.data && e.data.size && ws.readyState === 1) ws.send(e.data); };
          rec.onstop = () => { if (ws.readyState === 1) ws.send(''); };
          rec.start(60);
        } catch { glosKoniec(ZDANIA.mikrofon); return; }
        glos.stan = 'nagrywa';
        pokazGlos();
      };
      ws.onmessage = (e) => zSoniox(e.data);
      ws.onerror = () => glosKoniec(ZDANIA.soniox);
      ws.onclose = () => glosKoniec();
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
      let tym = '', koniec = false;
      for (const t of d.tokens || []) {
        if (t.text === '<end>') koniec = true;
        else if (t.is_final) glos.gotowe += t.text;
        else tym += t.text;
      }
      glos.tym = tym;
      pole.value = (glos.gotowe + glos.tym).replace(/\s+/g, ' ').trim();
      rosnij();
      przyciski();
      if (koniec) glosStop(true);
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
      glos.wyslij = wyslijPo !== false;
      clearTimeout(glos.zegar);
      glos.zegar = setTimeout(() => glosKoniec(), 4000);
      if (natywny) { natywny.stop(); return; }
      if (!glos.rec) { glosKoniec(); return; }
      glos.stan = 'konczy';
      glosSprzatnij(); // rec.stop → onstop wysyła pusty kawałek, Soniox kończy i zamyka połączenie
    }
    function glosKoniec(blad) {
      if (glos.stan === 'nic') return;
      const ws = glos.ws;
      Object.assign(glos, { stan: 'nic', ws: null });
      clearTimeout(glos.zegar);
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
    const api = { otworz, zamknij, przelacz: () => (otwarty() ? zamknij() : otworz()), otwarty, wyslij, zGlosu, korzen, pracuje: () => pracuje, wrocDoRozmowy };
    aktywny = api;
    return api;
  }
  window.Czat = { uruchom, dymek, ikona, zGlosu: (d) => { if (aktywny) aktywny.zGlosu(d); } };
})();