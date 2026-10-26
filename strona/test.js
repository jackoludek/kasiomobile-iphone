// Test aplikacji Kasiomobile (dawniej Auta): na symulatorze iPhone'a (ios/test-symulator.sh) i w przeglądarce na komputerze
// (testy/przegladarka.mjs). Ładuje go app.js, gdy adres ma ?test=1 albo ?test=2.
//   etap 1: świeża instalacja: dane z sieci, nawigacja (cztery zakładki, pod nimi pigułki wybranej, siatka 12 kolumn), Ogłoszenia
//           ze słowem „Nowe”, filtry, karty i szczegóły auta, Historia, Podium i Atlas w Katalagu, Finanse z Leasingiem i Kredytem,
//           Poradnik od skrótu, menu Otomoto pod logo i napisem, galerie zdjęć, gest wstecz, nagłówek w jednym rzędzie, kontrast
//           i cele dotyku, a w aplikacji także to, czy ogłoszenia i strony banków idą do Safari,
//   etap 2: ponowne uruchomienie: czy ogłoszenia, katalag, kalkulator i historia są od razu z pamięci telefonu i czy została
//           kolejność zakładek z etapu 1. Na końcu układ (kolejność, wybrane pigułki, miejsce nawigacji) wraca do stanu sprzed testu.
// Przy każdym kroku zgłasza „krok-…” i czeka, aż skrypt zrobi zrzut ekranu
// (aplikacja: pytanie do Aplikacja.swift; przeglądarka: window.zrobioneZrzuty).
'use strict';
(async () => {
  const ETAP = Number((location.search.match(/[?&]test=(\d)/) || [])[1] || 1);
  // Szybki test (telefon Jacka w nocy): prośba o skan idzie, ale test nie czeka, aż komputer skończy.
  const SZYBKO = /[?&]szybko=1/.test(location.search);
  const czekaj = (ms) => new Promise((r) => setTimeout(r, ms));
  const mh = window.webkit && window.webkit.messageHandlers;
  const most = mh && mh.test;
  const pytaj = mh && mh.pytaj;
  // Odnośniki na zewnątrz sprawdzamy w aplikacji: na iPhonie zapisuje je Aplikacja.swift, na Androidzie dziennik MainActivity.
  const ANDROID = location.hostname === 'appassets.androidplatform.net';
  const zewn = Boolean(pytaj) || ANDROID;
  window.raportTestu = [];
  const zglos = (plik, d) => {
    const t = JSON.stringify(Object.assign({ plik }, d));
    window.raportTestu.push(JSON.parse(t));
    if (most) most.postMessage(t);
  };

  // Kontrast liczony z kolorów, które naprawdę widać, nie z arkusza.
  // Kolor z getComputedStyle: rgb(…) albo color(srgb 0–1 …), którym przeglądarka podaje color-mix.
  const rgb = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    const c = String(s).match(/color\(srgb\s+([^)]+)\)/);
    if (!c) return null;
    const q = c[1].split(/[\s/]+/).filter(Boolean).map(Number);
    return { r: q[0] * 255, g: q[1] * 255, b: q[2] * 255, a: q.length > 3 ? q[3] : 1 };
  };
  const tloPod = (e) => {
    for (let x = e; x; x = x.parentElement) {
      const c = rgb(getComputedStyle(x).backgroundColor);
      if (c && c.a > 0.99) return c;
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  };
  const jasnosc = (c) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const kontrast = (a, b) => {
    const x = jasnosc(a), y = jasnosc(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  // Napisy liczą się od 4,5:1, a znaki asystenta i Odśwież od 3:1, bo to grafika (WCAG 1.4.11). Każda zakładka to osobny przycisk
  // (od 22.10.2026): napis na jej własnym tle, wybranej na pastelu. Znaki w nagłówku stoją na swoim kółku (::before).
  const kontr = {}, kontrIkon = {};
  const zapamietaj = (m, k, v) => { if (v) m[k] = Math.min(m[k] ?? 99, Math.round(v * 100) / 100); };
  const para = (kolor, tlo) => { const a = rgb(kolor), b = rgb(tlo); return a && b && b.a > 0.99 ? kontrast(a, b) : 0; };
  const zmierz = () => {
    for (const s of ['.pusto-tekst', '.stan-danych', '.cofnij-zakladki .pigulka', '.menu-otomoto .menu-otomoto-nazwa', '.menu-otomoto-tytul']) {
      for (const e of document.querySelectorAll(s)) {
        if (e.getClientRects().length) zapamietaj(kontr, s, kontrast(rgb(getComputedStyle(e).color), tloPod(e)));
      }
    }
    // Zakładka w trakcie przejścia (barwa wyboru 160 ms) stoi między dwiema barwami: 26.10.2026 o 14:04 symulator złapał wybraną w połowie
    // drogi z bieli do pomarańczu (1,14:1, w spoczynku 4,70:1), a o 17:05 niewybraną (3,89:1, w spoczynku 13,7:1), choć test pomijał już
    // zakładki w ruchu: Safari zaczyna przejście dopiero przy odczycie stylu. Dlatego na czas pomiaru przejścia stają (transition: none
    // kończy je od razu) i liczą się barwy, na których zakładka się zatrzyma.
    const bezPrzejscia = (lista, f) => {
      const stare = lista.map((e) => [e, e.style.getPropertyValue('transition'), e.style.getPropertyPriority('transition')]);
      for (const e of lista) e.style.setProperty('transition', 'none', 'important');
      try { return f(); } finally { for (const [e, t, p] of stare) { if (t) e.style.setProperty('transition', t, p); else e.style.removeProperty('transition'); } }
    };
    for (const b of document.querySelectorAll('.karty [role="tab"]')) {
      const wybrana = b.getAttribute('aria-selected') === 'true', napis = b.querySelector('.nazwa > span');
      if (napis) zapamietaj(kontr, wybrana ? 'zakładka wybrana' : 'zakładka', bezPrzejscia([b, napis], () => para(getComputedStyle(napis).color, getComputedStyle(b).backgroundColor)));
    }
    for (const s of ['#czat-otworz']) {
      const e = document.querySelector(s);
      if (!e || !e.getClientRects().length) continue;
      // Kółko ze szkła (od 26.10.2026) jest półprzezroczyste, więc jego tło liczymy razem z tłem nagłówka pod nim.
      const t = rgb(getComputedStyle(e, '::before').backgroundColor), g = tloPod(document.querySelector('.glowa'));
      const tlo = t ? { r: t.r * t.a + g.r * (1 - t.a), g: t.g * t.a + g.g * (1 - t.a), b: t.b * t.a + g.b * (1 - t.a) } : null;
      if (tlo) zapamietaj(kontrIkon, s, kontrast(rgb(getComputedStyle(e).color), tlo));
    }
  };
  const opisz = (e) => (e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') : '');
  const zrzuty = {};
  const krok = async (nazwa) => {
    const plik = `krok-${ETAP}-${nazwa}`;
    zmierz();
    zglos(plik, { t: Date.now(), naWierzchu: opisz(document.elementFromPoint(innerWidth / 2, innerHeight / 2)) });
    const t0 = Date.now();
    for (let i = 0; i < 300; i++) {
      await czekaj(200);
      if ((window.zrobioneZrzuty || []).includes(plik)) break;
      if (pytaj) { try { if (await pytaj.postMessage({ co: 'zrzut', plik })) break; } catch { /* jeszcze nie */ } }
    }
    zrzuty[nazwa] = Date.now() - t0;
  };
  const naRamke = async (r, ms) => {
    for (let i = 0; i < ms / 200; i++) {
      try {
        const d = r.contentDocument;
        if (!r.hidden && d && d.readyState === 'complete' && d.body && d.body.childElementCount) return d;
      } catch { /* jeszcze nie */ }
      await czekaj(200);
    }
    return null;
  };
  const bezPoziomego = (d) => d.documentElement.scrollWidth <= d.defaultView.innerWidth + 1;
  // Cele dotyku: każdy widoczny element do stuknięcia ma co najmniej 48 px w obu wymiarach (reguła Jacka;
  // Apple 44 pt mieści się w tym). Pomijamy odnośniki w zdaniu (WCAG 2.5.8 je wyłącza), przygaszone i to, co stoi
  // poza stroną (np. „Przejdź do treści”). Odnośnik, którego ::after obejmuje całą komórkę, mierzymy po komórce.
  const male = [];
  const maleCele = (dok, gdzie, korzen = dok) => {
    const okno = dok.defaultView;
    for (const e of korzen.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]')) {
      if (e.disabled || e.closest('[hidden], [inert]')) continue;
      const cs = okno.getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let cel = e;
      if ((e.type === 'checkbox' || e.type === 'radio') && e.closest('label')) cel = e.closest('label');
      // Odnośnik albo przycisk, którego ::after obejmuje całą komórkę (nazwa w tabeli Ogłoszeń, od Skanera 0.4.24), mierzymy po komórce.
      if (e.tagName === 'A' || e.tagName === 'BUTTON') {
        const po = okno.getComputedStyle(e, '::after');
        if (po.position === 'absolute' && po.content !== 'none' && po.content !== 'normal' && e.offsetParent) cel = e.offsetParent;
        else if (e.tagName === 'A' && cs.display === 'inline' && e.closest('p, li, figcaption, small, .male')) continue;
      }
      const r = cel.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right + okno.scrollX <= 0 || r.bottom + okno.scrollY <= 0) continue;
      // Niewidoczny pas ::before poza przyciskiem (pigułki w nawigacji: 44 px widać, 48 px pod palcem) liczy się do celu.
      const pb = okno.getComputedStyle(e, '::before'), poza = (v) => Math.max(0, -parseFloat(v) || 0);
      const zPasem = pb.position === 'absolute' && pb.content !== 'none' && pb.content !== 'normal';
      const szer = r.width + (zPasem ? poza(pb.left) + poza(pb.right) : 0), wys = r.height + (zPasem ? poza(pb.top) + poza(pb.bottom) : 0);
      if (Math.min(szer, wys) >= 47.5) continue;
      const klasa = typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '';
      const nazwa = (e.getAttribute('aria-label') || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      male.push(`${gdzie}: ${e.tagName.toLowerCase()}${klasa} „${nazwa}” ${Math.round(szer)}×${Math.round(wys)}`);
    }
  };
  // Odnośnik na zewnątrz: w aplikacji Aplikacja.swift zapisuje go zamiast otwierać Safari (w teście).
  const klik = (dok, adres) => {
    const a = dok.createElement('a');
    a.href = adres;
    a.textContent = 'test';
    dok.body.append(a);
    a.click();
    a.remove();
  };

  // Otwarte okno w stronie (filtry, szczegóły auta, galeria) dostaje cały ekran: bez nagłówka i bez zakładek.
  const schowane = () => document.body.classList.contains('okno') && getComputedStyle(document.querySelector('.dol')).display === 'none'
    && !document.querySelector('.glowa .logo').getClientRects().length;
  const widac = () => !document.body.classList.contains('okno') && getComputedStyle(document.querySelector('.dol')).display !== 'none';

  const w = { etap: ETAP, aplikacja: Boolean(pytaj) };
  const zewnetrzne = [];
  // Na czym test teraz czeka: gdy utknie, skrypt testu czyta to ze strony.
  const gdzie = (t) => { window.testGdzie = t; };
  // Klucze pamięci z układem: kolejność i wybór zakładek, pigułki każdej zakładki i miejsce nawigacji (od 25.10.2026).
  const UKLAD = ['auta-kolejnosc', 'auta-zakladka', 'auta-pigulka-katalog', 'auta-pigulka-modele', 'auta-pigulka-kredyt',
    'auta-pigulki-kolejnosc-katalog', 'auta-pigulki-kolejnosc-katalag', 'auta-pigulki-kolejnosc-kredyt', 'auta-pasek-wysokosc'];
  try {
    // Test przestawia zakładki i pigułki i wybiera pigułki, więc na prawdziwym telefonie zapamiętuje układ sprzed testu i oddaje go
    // na końcu etapu 2 (20.10.2026 po teście na telefonie Jacka pierwsza stała Historia).
    if (ETAP === 1) localStorage.setItem('auta-test-przed', JSON.stringify(Object.fromEntries(UKLAD.map((k) => [k, localStorage.getItem(k)]))));
    gdzie('aplikacja');
    for (let i = 0; i < 100 && !window.Auta; i++) await czekaj(100);
    w.adres = location.href;
    gdzie('pamięć telefonu');
    w.naStarcie = await Auta.naStarcie;
    // Nawigacja przeniesiona wyżej (przytrzymanie 2 s) wraca na czas testu na swoje miejsce; po teście dostaje miejsce sprzed testu.
    if (Auta.stan().pasek) Auta.pasek(0);
    gdzie('pierwsze odświeżenie');
    w.odswiezenie = await Auta.pierwsze;
    gdzie('komputer na starcie');
    w.katalogMinut = Math.round((Date.now() - Auta.stan().katalogCzas * 1000) / 60000);
    // Prośba o skan ze startu: najpierw czekamy na odpowiedź komputera (najwyżej 90 s), żeby test sprawdzał
    // już nowy katalog. Komputer Jacka może być wyłączony: wtedy test idzie dalej po 90 sekundach.
    const czekanieStart = SZYBKO ? null : Auta.czekanie();
    if (czekanieStart) w.komputerStart = await Promise.race([czekanieStart, czekaj(90000).then(() => 'czeka dłużej niż 90 s')]);
    w.ciemny = matchMedia('(prefers-color-scheme: dark)').matches;
    w.tlo = getComputedStyle(document.body).backgroundColor;
    w.szer = innerWidth;
    w.wys = innerHeight;

    // Ogłoszenia (od 19.10.2026 razem z dawnym „Nowe”): kafelki aut, a dodane dziś albo wczoraj mają słowo „Nowe”.
    gdzie('Ogłoszenia');
    await Auta.pokazWidok(0);
    await Auta.pokazPigulke('katalog', 'teraz');
    const k = await naRamke(document.querySelector('#ramka-katalogu'), 20000);
    w.katalog = Boolean(k);
    w.stronaBezPoziomego = bezPoziomego(document);
    if (k) {
      await czekaj(2000);
      if (!k.querySelector('button.kafel-glowny')) {
        const m = k.querySelector('a.kafel-glowny');
        if (m) { m.click(); await czekaj(2000); }
      }
      w.katalogKafelki = k.querySelectorAll('button.kafel-glowny').length;
      const pasek = k.getElementById('pasek');
      w.pasekUkryty = !pasek || k.defaultView.getComputedStyle(pasek).display === 'none';
      w.katalogBezPoziomego = bezPoziomego(k);
      w.katalogCiemny = k.defaultView.matchMedia('(prefers-color-scheme: dark)').matches;
      await krok('ogloszenia');
      maleCele(k, 'Ogłoszenia');
      // Nagłówek stoi, gdy strona pod nim się przewija (od 19.10.2026 nie zwija się wcale, więc nie ma czego skakać).
      const gl = document.querySelector('.glowa'), r0 = gl.getBoundingClientRect(), okno = k.defaultView;
      for (let y = 0; y <= 900; y += 60) { okno.scrollTo(0, y); await czekaj(40); }
      await czekaj(400);
      const r1 = gl.getBoundingClientRect();
      w.naglowekStoi = Math.abs(r1.top - r0.top) < 0.5 && Math.abs(r1.height - r0.height) < 0.5 && widac();
      okno.scrollTo(0, 0);
      await czekaj(300);
      // „N nowe” przy liczniku stawia najświeższe na górze. Gdy dziś i wczoraj nic nie doszło, przycisku nie ma.
      w.noweZnaczki = k.querySelectorAll('.chip.nowe').length;
      const pn = k.querySelector('.licznik .przycisk-nowe');
      w.nowePigulka = pn ? pn.textContent.trim() : '';
      if (pn && pn.offsetWidth) {
        pn.click();
        await czekaj(900);
        const pk = k.querySelector('button.kafel-glowny');
        w.noweNaGorze = Boolean(pk) && / Nowe\./.test(pk.getAttribute('aria-label') || '');
        await krok('nowe-na-gorze');
      }
      // Filtry na telefonie (od 15.10.2026): arkusz na cały ekran, zamykany przyciskiem „Pokaż N wyników”.
      // Nagłówek i zakładki chowają się pod nim, a formularz wraca potem do panelu.
      const fm = k.querySelector('.mobilne-filtry');
      if (fm && fm.offsetWidth) {
        fm.click();
        await czekaj(600);
        const ark = k.querySelector('dialog.arkusz-filtrow');
        w.arkuszFiltrow = Boolean(ark && ark.open && ark.querySelector('.grupy-filtrow fieldset'));
        if (w.arkuszFiltrow) {
          const r = ark.getBoundingClientRect();
          w.arkuszNaEkran = r.width >= k.defaultView.innerWidth - 1 && r.height >= k.defaultView.innerHeight - 1;
          w.filtryBezNaglowka = schowane();
          maleCele(k, 'Filtry');
          await krok('filtry');
        }
        const pokaz = ark && ark.querySelector('.arkusz-stopka .glowny');
        if (pokaz) pokaz.click();
        await czekaj(400);
        w.arkuszZamkniety = Boolean(ark && !ark.open && k.querySelector('.panel-filtrow .filtry'));
      }
      // Jeden widok (od Skanera 0.4.25, Jacek: „TAK” na jeden widok kart zamiast kafelków, listy i tabeli): bez przełącznika,
      // na telefonie karty ze zdjęciem jedna pod drugą w jednej kolumnie, bez przewijania w bok.
      const kolumny = () => { const p = k.querySelector('.produkty'); return p ? k.defaultView.getComputedStyle(p).gridTemplateColumns.split(' ').filter(Boolean).length : 0; };
      w.przelacznikWidoku = k.querySelectorAll('.przelacznik-widoku button').length;
      w.kafelkiKolumn = kolumny();
      w.kafelkiBezPoziomego = bezPoziomego(k);
      const pierwszy = k.querySelector('button.kafel-glowny');
      if (pierwszy) {
        pierwszy.click();
        await czekaj(2000);
        const d = k.querySelector('dialog[open]');
        w.szczegoly = Boolean(d);
        if (d) {
          w.szczegolyBezNaglowka = schowane();
          maleCele(k, 'Szczegóły');
          await krok('szczegoly');
          // „Otwórz stronę w sklepie” (window.open) i zwykły odnośnik w katalogu.
          const sklep = d.querySelector('.przycisk.glowny');
          if (zewn && ETAP === 1 && sklep) { sklep.click(); zewnetrzne.push('otomoto.pl'); }
          if (zewn && ETAP === 1) { klik(k, 'https://example.com/z-katalogu'); zewnetrzne.push('https://example.com/z-katalogu'); }
          w.wsteczSzczegoly = Auta.wstecz() && !d.open;
          await czekaj(400);
          w.szczegolyWrocil = widac();
        }
      }
    }

    // Katalag (do 19.10.2026 „Modele”): karty modeli z oceną, ranking, galeria zdjęć modelu, gest wstecz ją zamyka.
    gdzie('Katalag');
    await Auta.pokazWidok(1);
    await Auta.pokazPigulke('modele', 'podium');
    const md = await naRamke(document.querySelector('#ramka-modeli'), 20000);
    w.modele = Boolean(md);
    if (md) {
      await czekaj(2000);
      w.modeleKarty = md.querySelectorAll('.card.model').length;
      w.modeleRanking = md.querySelectorAll('table.ranking tbody tr').length;
      w.modeleBezPoziomego = bezPoziomego(md);
      w.modeleCiemny = md.defaultView.matchMedia('(prefers-color-scheme: dark)').matches;
      await krok('katalag');
      maleCele(md, 'Katalag');
      // Całość Podium otwiera przycisk na końcu skrótu (od 25.10.2026; rzędu „Skrót | Pełny widok” w aplikacji nie ma).
      w.katalagCalosc = Boolean(md.querySelector('.przycisk-p[data-widok-modeli="pelny"]'));
      const f = md.querySelector('.foto-modelu');
      if (f) {
        f.click();
        await czekaj(1500);
        const g = md.querySelector('dialog.galeria');
        w.modeleGaleria = Boolean(g && g.open && g.querySelector('.g-podpis').textContent.includes('Wikimedia'));
        if (w.modeleGaleria) {
          await krok('katalag-galeria');
          w.wsteczModele = Auta.wstecz() && !g.open;
        }
      }
    }
    // Atlas w Katalagu (od 25.10.2026): pigułki Modele i Marki pokazują Atlas Samochodów z sieci w ramce. Marki przełączają widok
    // wiadomością, bez przeładowania ramki, a Wstecz, gdy w Atlasie nic nie jest otwarte, wraca na Podium.
    gdzie('Atlas');
    await Auta.pokazPigulke('modele', 'modele');
    // Atlas idzie z sieci: na Macu GitHuba bywa wolny (26.10.2026 raz „nie ma” po 20 s), więc czekamy do 40 s.
    for (let i = 0; i < 160 && Auta.stan().atlas !== 'gotowy'; i++) await czekaj(250);
    w.atlas = Auta.stan().atlas;
    const ra = document.querySelector('#ramka-atlasu');
    w.atlasAdres = ra.getAttribute('src');
    w.atlasWKatalagu = /[?&]k=katalag/.test(w.atlasAdres || '') && !ra.hidden;
    if (!SZYBKO) { await czekaj(1500); await krok('atlas'); }
    maleCele(document, 'Pigułki Katalagu', document.querySelector('.podkarty'));
    await Auta.pokazPigulke('modele', 'marki');
    await czekaj(600);
    w.atlasMarkiBezPrzeladowania = ra.getAttribute('src') === w.atlasAdres && Auta.stan().pigulki.includes('modele:marki');
    w.atlasWstecz = Auta.wstecz();
    for (let i = 0; i < 20 && !Auta.stan().pigulki.includes('modele:podium'); i++) await czekaj(150);
    w.atlasWsteczNaPodium = Auta.stan().pigulki.includes('modele:podium');
    // Finanse (od 25.10.2026): pigułki Leasing i Kredyt nad jednym kalkulatorem. Aplikacja wpisuje stronie data-czesc i pokazuje
    // jedną część, a całość otwiera przycisk na końcu skrótu; Wstecz wraca do skrótu.
    gdzie('Finanse');
    await Auta.pokazWidok(2);
    await Auta.pokazPigulke('kredyt', 'leasing');
    const c = await naRamke(document.querySelector('#ramka-kredytu'), 20000);
    w.kalkulator = Boolean(c);
    if (c) {
      await czekaj(1500);
      w.kalkulatorTytul = c.title;
      w.kalkulatorBezPoziomego = bezPoziomego(c);
      w.finanseLeasing = c.documentElement.dataset.czesc === 'leasing';
      await krok('finanse');
      if (zewn && ETAP === 1) { klik(c, 'https://example.com/z-kalkulatora'); zewnetrzne.push('https://example.com/z-kalkulatora'); }
      maleCele(c, 'Finanse, Leasing');
      await Auta.pokazPigulke('kredyt', 'kredyt');
      await czekaj(600);
      w.finanseKredyt = c.documentElement.dataset.czesc === 'kredyt';
      maleCele(c, 'Finanse, Kredyt');
      // Całość kalkulatora: suwaki, tabela banków bez przewijania w bok, cele dotyku. Wstecz wraca do skrótu.
      const calosc = c.querySelector('#skrot > .przycisk');
      if (calosc) {
        calosc.click();
        await czekaj(800);
        const wy = c.getElementById('wyniki'), pe = c.getElementById('pelny');
        w.kalkulatorPelny = Boolean(pe && !pe.hidden);
        w.kalkulatorPelnyBezPoziomego = bezPoziomego(c) && (!wy || wy.scrollWidth <= wy.clientWidth + 1);
        maleCele(c, 'Finanse, całość');
        await krok('kredyt-pelny');
        w.kalkulatorWstecz = Auta.wstecz() && Boolean(pe && pe.hidden);
        await czekaj(300);
      }
      await Auta.pokazPigulke('kredyt', 'leasing');
    }
    // Historia ogłoszeń (od 25.10.2026 pigułka w Ogłoszeniach): miniatury zdjęć, galeria na cały ekran bez nagłówka i zakładek,
    // gest wstecz ją zamyka.
    gdzie('Historia');
    await Auta.pokazWidok(0);
    await Auta.pokazPigulke('katalog', 'historia');
    const h = await naRamke(document.querySelector('#ramka-historii'), 20000);
    w.historia = Boolean(h);
    if (h) {
      await czekaj(2000); // miniatury zdjęć
      w.historiaTytul = h.title;
      w.historiaMiniatury = h.querySelectorAll('button.miniatura').length;
      w.historiaBezPoziomego = bezPoziomego(h);
      w.historiaCiemny = h.defaultView.matchMedia('(prefers-color-scheme: dark)').matches;
      await krok('historia');
      maleCele(h, 'Historia');
      if (zewn && ETAP === 1) { klik(h, 'https://example.com/z-historii'); zewnetrzne.push('https://example.com/z-historii'); }
      const m = h.querySelector('button.miniatura');
      if (m) {
        m.click();
        await czekaj(1500);
        const g = h.querySelector('dialog.galeria');
        w.galeria = Boolean(g && g.open);
        if (w.galeria) {
          w.galeriaBezNaglowka = schowane();
          maleCele(h, 'Galeria', g);
          await krok('galeria');
          w.wsteczGaleria = Auta.wstecz() && !g.open;
          await czekaj(600);
          w.naglowekWrocil = widac();
        }
      }
    }
    gdzie('nagłówek i zakładki');
    await Auta.pokazWidok(0);
    await Auta.pokazPigulke('katalog', 'teraz');
    await czekaj(400);
    // Nagłówek w jednym rzędzie (od 19.10.2026): logo, napis „Kasiomobile®” i asystent na jednej osi (od 24.10.2026 bez godziny i ściągi).
    const srodek = (e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; };
    const czesci = ['.glowa .logo', '.glowa h1 svg.napis', '#czat-otworz'].map((s) => document.querySelector(s)).filter((e) => e && e.getClientRects().length);
    const sr = czesci.map(srodek);
    w.naglowekJedenRzad = czesci.length === 3 && Math.max(...sr) - Math.min(...sr) < 2;
    // Wcięcia z paddingu, w którym naprawdę stoją: sonda env() na starcie testu dawała w WKWebView 0 (symulator, 19.10.2026).
    // Od 26.10.2026 nad rzędem stoi połowa górnego wcięcia i 8 px, a pod nim samo 8 px, więc wcięcie to dwa razy górny padding bez 8 px.
    const gl = document.querySelector('.glowa'), dolE = document.querySelector('.dol'), cg = getComputedStyle(gl);
    w.wciecia = { gora: Math.round(2 * (parseFloat(cg.paddingTop) - 8)), dol: Math.round(Math.max(0, parseFloat(getComputedStyle(dolE).paddingBottom) - 8)) };
    w.naglowekNetto = Math.round(gl.getBoundingClientRect().height - w.wciecia.gora / 2);
    // Logo na środku między górą ekranu a pierwszą rzeczą w Ofertach (od 26.10.2026, Jacek: nagłówek „niepotrzebnie jest takie długie”),
    // liczone tak, jakby strona nie była przewinięta.
    const rk = document.querySelector('#ramka-katalogu'), pk = rk && rk.contentDocument && [...rk.contentDocument.querySelectorAll('input[type="search"], .pasek-narzedzi, input')].find((x) => x.getBoundingClientRect().height > 0);
    w.naglowekSrodek = pk ? Math.round((srodek(document.querySelector('.glowa .logo')) - (rk.getBoundingClientRect().top + pk.getBoundingClientRect().top + rk.contentWindow.scrollY) / 2) * 10) / 10 : null;
    const napis = document.querySelector('.glowa h1 svg.napis'), rn = napis && napis.getBoundingClientRect();
    w.napis = Boolean(napis && napis.querySelectorAll('path').length === 3 && rn.width > 100 && rn.height > 12);
    // Bez Odśwież, godziny skanu i ściągi (od 24.10.2026), a Ogłoszenia bez tytułu stoją w siatce nagłówka: logo nad lewą
    // krawędzią treści, kółko asystenta nad prawą, pierwsza zakładka nad kolumną aut (na telefonie pasek na dole, tak samo).
    w.bezOdswiez = !document.querySelector('#odswiez') && !document.querySelector('.pusto button');
    w.bezGodzinyISciagi = !document.querySelector('#stan-danych') && !document.querySelector('#sciaga-otworz');
    try {
      const dk = document.querySelector('#ramka-katalogu').contentDocument, st = dk.querySelector('.strona'), cs = dk.defaultView.getComputedStyle(st), rs = st.getBoundingClientRect();
      const kolka = [...document.querySelectorAll('.glowa .czat-ikonka')].filter((b) => getComputedStyle(b).visibility !== 'hidden' && b.getClientRects().length);
      const t0 = document.querySelector('.karty [role="tab"]').getBoundingClientRect(), kol = dk.querySelector('.katalog > div').getBoundingClientRect();
      const z = (v) => Math.round(v * 10) / 10;
      w.wyrownanie = { logo: z(document.querySelector('#logo img').getBoundingClientRect().left - rs.left - parseFloat(cs.paddingLeft)),
        prawo: z(kolka[kolka.length - 1].getBoundingClientRect().right - 4 - rs.right + parseFloat(cs.paddingRight)), zakladki: z(t0.left - kol.left) };
      w.tytulStrony = [...dk.querySelectorAll('h1')].some((h) => h.getClientRects().length > 0);
    } catch (e) { w.wyrownanie = { blad: String(e) }; }
    // Nawigacja (od 25.10.2026): cztery zakładki z ikoną i nazwą, a pod nimi pigułki wybranej zakładki, jeden blok nad treścią
    // (na telefonie na dole, na szerokim ekranie u góry). Na telefonie siatka 12 kolumn z jedną rynną 8 px (reguła siatka-wszedzie):
    // zakładki po 3 kolumny, dwie pigułki po 6, każda dokładnie pod dwiema zakładkami, brzegi na brzegach treści.
    const dol = document.querySelector('.dol'), rd = dol.getBoundingClientRect();
    w.zakladkiNaDole = innerWidth < 760 ? rd.top > innerHeight / 2 && innerHeight - rd.bottom < 80 : rd.bottom < 200;
    const t = ['katalog', 'modele', 'kredyt', 'poradnik'].map((id) => document.querySelector('#seg-' + id));
    w.zakladki = t.map((b) => (b ? b.textContent.trim() : '')).join(',');
    w.zakladkiIkony = t.filter((b) => b && b.querySelector('svg.znak use') && b.querySelector('svg.znak').getBoundingClientRect().width >= 20).length;
    w.dolNetto = Math.round(rd.height);
    const rt = t.filter(Boolean).map((b) => b.getBoundingClientRect()), rp = [...document.querySelectorAll('.podkarty .podwidoki:not([hidden]) [role="radio"]')].map((b) => b.getBoundingClientRect());
    const rowne = (a) => a.length < 2 || Math.max(...a.map((q) => q.width)) - Math.min(...a.map((q) => q.width)) <= 0.5;
    if (innerWidth < 760) {
      const ss = getComputedStyle(document.querySelector('.siatka-sonda')), sx0 = parseFloat(ss.paddingLeft), sx1 = innerWidth - parseFloat(ss.paddingRight);
      const brzeg = (a) => !a.length || (Math.abs(a[0].left - sx0) <= 0.5 && Math.abs(a[a.length - 1].right - sx1) <= 0.5);
      w.siatka = { rynna: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--km-rynna')), zakladkiRowne: rowne(rt), pigulkiRowne: rowne(rp),
        brzegi: brzeg(rt) && brzeg(rp), dwiePodDwiema: rp.length !== 2 || (Math.abs(rp[0].right - rt[1].right) <= 0.5 && Math.abs(rp[1].left - rt[2].left) <= 0.5),
        pigulkiPodZakladkami: rp.length > 0 && rp.every((q) => q.top >= Math.max(...rt.map((r) => r.bottom)) + 4) };
      // Od dolnej krawędzi ekranu nawigacja stoi tak daleko, jak logo od górnej (Jacek, 24.10.2026: „przynajmniej tak od krawędzi
      // ekranu, tak bufor jest u góry”): liczy się dolny rząd, czyli pigułki, gdy zakładka je ma.
      const dolKart = Math.max(...rt.concat(rp).map((r) => r.bottom));
      w.odKrawedzi = { gora: Math.round(document.querySelector('#logo img').getBoundingClientRect().top * 10) / 10, dol: Math.round((innerHeight - dolKart) * 10) / 10 };
    }
    // Zakładki to osobne przyciski co najmniej 8 px od siebie (od 22.10.2026). Wybrana stoi na pastelu swojej ikony,
    // z pierścieniem w akcencie i pogrubioną nazwą.
    const wybranaE = document.querySelector('.karty [aria-selected="true"]'), innaE = document.querySelector('.karty [aria-selected="false"]');
    if (wybranaE && innaE) {
      const sw = getComputedStyle(wybranaE), si = getComputedStyle(innaE);
      w.wybranaPastel = sw.backgroundColor !== si.backgroundColor && /rgb/.test(sw.boxShadow) && Number(sw.fontWeight) >= 600;
      w.wybranaKolor = sw.backgroundColor;
      const ra = [...document.querySelectorAll('.karty [role="tab"]')].map((b) => b.getBoundingClientRect());
      w.zakladkiOsobno = ra.every((r, i) => i === 0 || r.left - ra[i - 1].right >= 7.5);
    }
    zmierz();
    maleCele(document, 'Aplikacja');
    // Napis Kasiomobile® (od 22.10.2026, rano tego dnia logo): stuknięcie pokazuje pod nim te same wyszukiwania na Otomoto, Escape je
    // zamyka. Pozycji nie stukamy, bo otworzyłyby przeglądarkę.
    gdzie('napis');
    document.querySelector('#napis').click();
    for (let i = 0; i < 40 && !document.querySelector('.menu-otomoto'); i++) await czekaj(100);
    const mo = document.querySelector('.menu-otomoto');
    w.otomotoMenu = mo ? mo.querySelectorAll('[role="menuitem"]').length : 0;
    w.otomotoMenuPodNapisem = Boolean(mo) && mo.getBoundingClientRect().top >= document.querySelector('#napis').getBoundingClientRect().bottom;
    if (mo) { zmierz(); maleCele(document, 'Menu pod napisem', mo); await krok('napis'); }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await czekaj(150);
    w.otomotoMenuZamkniete = !document.querySelector('.menu-otomoto');
    // Logo (od 25.10.2026): to samo menu Otomoto, pod logo.
    gdzie('logo');
    document.querySelector('#logo').click();
    for (let i = 0; i < 40 && !document.querySelector('.menu-otomoto'); i++) await czekaj(100);
    const ml = document.querySelector('.menu-otomoto');
    w.logoMenu = ml ? ml.querySelectorAll('[role="menuitem"]').length : 0;
    w.logoMenuPodLogo = Boolean(ml) && ml.getBoundingClientRect().top >= document.querySelector('#logo').getBoundingClientRect().bottom;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await czekaj(150);
    w.logoMenuZamkniete = !document.querySelector('.menu-otomoto');
    // Poradnik (od 25.10.2026 zakładka, od 22 do 24.10.2026 pod logo): przychodzi z komputera (kanał „<kanał>-poradnik”), jak strony
    // w innych zakładkach.
    gdzie('poradnik');
    await Auta.pokazWidok(3);
    const pr = await naRamke(document.querySelector('#ramka-poradnika'), 20000);
    w.poradnik = Boolean(pr);
    if (pr) {
      await czekaj(800);
      w.poradnikRozdzialy = pr.querySelectorAll('h2').length;
      w.poradnikBezPoziomego = bezPoziomego(pr);
      w.poradnikNaZewnatrz = [...pr.querySelectorAll('a[href^="http"]')].every((a) => a.target === '_blank');
      maleCele(pr, 'Poradnik, strona');
      // Najpierw skrót, potem całość (od 23.10.2026, poradnik.js w misji). Etap 1 zaczyna od skrótu, a „Czytaj całość” odsłania
      // resztę w tym samym miejscu; etap 2 (ta sama karta) pamięta to do końca sesji. Strona sprzed tej zmiany nie ma przycisku.
      const calosc = pr.querySelector('#calosc');
      if (!calosc) w.poradnikSkrot = 'strona bez skrótu';
      else if (ETAP === 1) w.poradnikSkrot = calosc.hidden && Boolean(pr.querySelector('#czytaj-calosc'));
      else w.poradnikPamieta = !calosc.hidden;
      await krok('poradnik');
      if (calosc && ETAP === 1) {
        pr.querySelector('#czytaj-calosc').click();
        await czekaj(400);
        w.poradnikCalosc = !calosc.hidden && !pr.querySelector('#czytaj-calosc') && pr.activeElement === calosc;
        maleCele(pr, 'Poradnik, całość');
      }
    }
    // Przestawianie pigułek (od 25.10.2026): Alt+← na Historii stawia ją przed Teraz, a „Cofnij” nad nawigacją oddaje kolejność.
    gdzie('pigułki');
    await Auta.pokazWidok(0);
    await Auta.pokazPigulke('katalog', 'teraz');
    if (ETAP === 1) {
      const pig = () => [...document.querySelectorAll('.podwidoki[data-z="katalog"] [role="radio"]')].map((b) => b.dataset.p).join(',');
      const przedP = pig(), ph = document.querySelector('.podwidoki[data-z="katalog"] [data-p="historia"]');
      ph.focus();
      ph.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true, cancelable: true }));
      await czekaj(200);
      const cp = document.querySelector('.cofnij-zakladki'), cb = document.querySelector('#cofnij-zakladki'), rc = cb.getBoundingClientRect();
      w.pigulkiPoAlt = pig();
      w.pigulkiCofnijNaWierzchu = !cp.hidden && document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2) === cb;
      if (!SZYBKO) await krok('pigulki-cofnij');
      cb.click();
      await czekaj(200);
      w.pigulkiPoCofnij = pig() === przedP && cp.hidden;
    }
    // Przestawianie zakładek: Alt+→, „Cofnij” i pociągnięcie palcem w bok. Etap 2 sprawdza,
    // czy kolejność z etapu 1 została po ponownym uruchomieniu.
    const pasekZ = document.querySelector('.karty');
    const kol = () => [...pasekZ.children].filter((b) => b.id).map((b) => b.id.slice(4)).join(',');
    if (ETAP === 1) {
      const pierwsza = document.querySelector('#seg-katalog');
      pierwsza.focus();
      pierwsza.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true }));
      await czekaj(200);
      w.kolejnoscPoAlt = kol();
      w.cofnijWidac = !document.querySelector('.cofnij-zakladki').hidden;
      zmierz();
      maleCele(document, 'Cofnij', document.querySelector('.cofnij-zakladki'));
      await krok('cofnij');
      document.querySelector('#cofnij-zakladki').click();
      await czekaj(200);
      w.kolejnoscPoCofnij = kol();
      w.cofnijSchowane = document.querySelector('.cofnij-zakladki').hidden;
      // Palec: „Poradnik” pociągnięty w bok na lewo od „Ogłoszenia”, puszczenie (od 20.10.2026 wystarczy pociągnąć; na telefonie
      // przytrzymanie 2 s przenosi całą nawigację, więc zakładki przestawia sam ruch w bok). Prawdziwy dotyk sprawdza testy/palec.mjs:
      // zdarzenia z dispatchEvent omijają gesty przeglądarki.
      const hs = document.querySelector('#seg-poradnik'), cel = document.querySelector('#seg-katalog').getBoundingClientRect();
      const r0 = hs.getBoundingClientRect(), x0 = r0.left + r0.width / 2, y0 = r0.top + r0.height / 2;
      const palec = (typ, x) => hs.dispatchEvent(new PointerEvent(typ, { pointerId: 41, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y0, bubbles: true, cancelable: true }));
      palec('pointerdown', x0);
      await czekaj(40);
      for (let i = 1; i <= 12; i++) { palec('pointermove', x0 + ((cel.left + 4 - x0) * i) / 12); await czekaj(30); }
      palec('pointerup', cel.left + 4);
      await czekaj(300);
      w.kolejnoscPoPalcu = kol();
    } else {
      w.kolejnoscNaStarcie = kol();
    }
    if (ANDROID) w.zewnetrzne = zewnetrzne;
    if (zewnetrzne.length && pytaj) {
      await czekaj(1000);
      const byly = (await pytaj.postMessage({ co: 'zewnetrzne' })) || [];
      w.safari = zewnetrzne.map((z) => ({ adres: z, otwarty: byly.some((b) => b.includes(z)) }));
      w.safariWszystkie = byly;
      w.stronaZostala = location.href.startsWith('auta://app/');
    }
    // Prośba o skan do komputera: przy starcie idzie sama, gdy katalog ma ponad 10 minut. Gdy był świeższy, etap 1 woła
    // Auta.odswiez(true), które prosi zawsze (przycisku Odśwież nie ma od 24.10.2026; to samo wołają Aplikacja.swift i MainActivity.java
    // po powrocie do aplikacji). Odpowiedź komputera to tylko informacja: komputer Jacka może być wyłączony.
    gdzie('prośba o skan');
    w.prosba = w.odswiezenie && w.odswiezenie.prosba;
    w.prosbaSkad = w.prosba ? 'start' : '';
    if (!w.prosba && ETAP === 1 && !Auta.czekanie()) {
      const r = await Auta.odswiez(true);
      w.prosba = r && r.prosba;
      w.prosbaSkad = w.prosba ? 'Auta.odswiez z testu' : '';
    }
    const cz = Auta.czekanie();
    gdzie('komputer na końcu');
    w.komputer = SZYBKO ? 'test bez czekania na komputer' : cz ? (ETAP === 1 ? await Promise.race([cz, czekaj(60000).then(() => 'czeka dłużej niż minutę')]) : 'czeka') : (w.komputerStart || 'bez prośby');
    Object.assign(w, Auta.stan());
  } catch (e) {
    w.blad = String((e && e.stack) || e);
  }
  if (ETAP === 2) {
    let przed = null;
    try { przed = JSON.parse(localStorage.getItem('auta-test-przed')); } catch { /* bez zapisu */ }
    for (const k of UKLAD) {
      if (!przed || !(k in przed)) continue;
      if (przed[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, przed[k]);
    }
    localStorage.removeItem('auta-test-przed');
    try { sessionStorage.removeItem('poradnik-calosc'); } catch { /* bez pamięci sesji */ }
    w.poTescie = 'kolejność zakładek i pigułek, wybrane pigułki i miejsce nawigacji jak przed testem';
  }
  w.maleCele = male.slice(0, 40);
  w.maleCeleIle = male.length;
  w.kontrast = kontr;
  w.kontrastIkon = kontrIkon;
  w.czekanieNaZrzut = zrzuty;
  zglos(`test-etap${ETAP}`, w);
})();
