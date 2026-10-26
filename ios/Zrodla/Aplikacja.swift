// Kasiomobile na iPhone'a (do 18.10.2026 „Auta”): okno WKWebView wokół strony z folderu www (index.html, app.js, styl.css,
// czat.js, czat.css, logo.svg, kanal.js), tej samej co na Androidzie i w przeglądarce. Strona otwiera się pod adresem
// auta://app/, który podaje ten kod (Pliki). Ogłoszenia ze Skanera Produktów, katalog modeli, kalkulator kredytu i historię
// ogłoszeń pobiera sama strona z ntfy.sh i trzyma je w kontenerze aplikacji (localStorage, IndexedDB), więc działają też
// bez internetu i zostają po ponownym podpisaniu.
// Ogłoszenia i strony banków otwiera Safari. Przeciągnięcie od lewej krawędzi działa jak Wstecz.
// Budowane bez projektu Xcode: swiftc + actool (ios/buduj.sh), na Macu GitHub Actions.
// Kolory idą za motywem iPhone'a; ciemny to czerń.
// Mikrofon w czacie nagrywa ten kod (klasa Glos, od 26.10.2026), bo strona spod auta:// mikrofonu nie dostaje.
// Wygląd strony przychodzi też z sieci (Wyglad, od 26.10.2026), więc Sideloadly jest potrzebny tylko co 7 dni i przy zmianie tego kodu.
import UIKit
import WebKit
import AVFoundation
import CryptoKit

@main
final class Aplikacja: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let k = UISceneConfiguration(name: "Domyslna", sessionRole: connectingSceneSession.role)
        k.delegateClass = Scena.self
        return k
    }
}

final class Scena: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: ws)
        w.rootViewController = Ekran()
        w.makeKeyAndVisible()
        window = w
    }
}

/// Tło jak w styl.css: biel w jasnym motywie (od 26.10.2026, wcześniej #f5f5f7), czerń w ciemnym.
let kolorTla = UIColor { cechy in
    cechy.userInterfaceStyle == .dark ? UIColor.black : UIColor.white
}

/// Powłoka, czyli ten kod w Swift, ma numer (od 26.10.2026). Wygląd z sieci przychodzi tylko wtedy, gdy jego „minPowloka” nie jest wyższa:
/// 1 – do 26.10.2026; 2 – mikrofon od stuknięcia („nagrywaj”) i wygląd z sieci. Strona widzi numer w window.KASIOMOBILE_POWLOKA.
let WERSJA_POWLOKI = 2

/// Wygląd z sieci (od 26.10.2026; Jacek na pytanie, czy aplikacja na iPhonie ma sama brać nowy wygląd z sieci: „Tak, zrób”): strona
/// (index.html, app.js, styl.css, czat.js, czat.css, logo, krój) przychodzi z https://jackoludek.github.io/kasiomobile/aplikacja/
/// (wyslij-do-sieci.ps1), więc Sideloadly jest potrzebny tylko co 7 dni, do nowego podpisu, i przy zmianie tego kodu. kanal.js zostaje
/// zawsze z aplikacji. Pliki leżą w Application Support/Wyglad: „nowa” (pobrana, każdy plik sprawdzony SHA-256 z wersja.json, z plikiem
/// „gotowe”) staje się „aktywną” dopiero tuż przed wczytaniem strony, więc działająca strona nigdy nie miesza starych i nowych plików.
/// Adres strony zostaje auta://app/, więc rozmowy, filtry i dane w telefonie zostają. Wersja z aplikacji wygrywa, gdy jest tak samo nowa
/// albo nowsza (pole „zbudowano”), a wersja, przy której strona nie wstała w 12 s, trafia na listę złych i wraca wersja z aplikacji.
enum Wyglad {
    static let adres = URL(string: "https://jackoludek.github.io/kasiomobile/aplikacja/")!
    static var baza: URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Wyglad", isDirectory: true) }
    static var aktywna: URL { baza.appendingPathComponent("aktywna", isDirectory: true) }
    static var nowa: URL { baza.appendingPathComponent("nowa", isDirectory: true) }
    static var paczka: URL? { Bundle.main.resourceURL?.appendingPathComponent("www", isDirectory: true) }

    struct Wersja {
        let zbudowano: String
        let skrot: String
        let minPowloka: Int
        let pliki: [String: String]
    }
    static func wersja(_ d: Data) -> Wersja? {
        guard let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any], let z = o["zbudowano"] as? String,
              let s = o["skrot"] as? String, let p = o["pliki"] as? [String: String] else { return nil }
        return Wersja(zbudowano: z, skrot: s, minPowloka: (o["minPowloka"] as? Int) ?? 1, pliki: p)
    }
    static func wersja(w katalog: URL?) -> Wersja? {
        guard let k = katalog, let d = try? Data(contentsOf: k.appendingPathComponent("wersja.json")) else { return nil }
        return wersja(d)
    }
    static func sha(_ d: Data) -> String { SHA256.hash(data: d).map { String(format: "%02x", $0) }.joined() }
    /// Tylko płaskie nazwy plików strony; kanal.js zawsze z aplikacji.
    static func dobraNazwa(_ n: String) -> Bool {
        !n.isEmpty && !n.contains("/") && !n.contains("\\") && !n.hasPrefix(".") && !n.contains("..") && n != "kanal.js" && n != "wersja.json" && n != "gotowe"
    }
    static var zle: [String] { UserDefaults.standard.stringArray(forKey: "wyglad-zle") ?? [] }
    static func oznaczZla(_ skrot: String) { UserDefaults.standard.set(Array((zle + [skrot]).suffix(20)), forKey: "wyglad-zle") }
    static var czeka: Bool { FileManager.default.fileExists(atPath: nowa.appendingPathComponent("gotowe").path) }

    /// Katalog strony na to wczytanie. Gotowa „nowa” staje się „aktywną”, a aktywna liczy się tylko, gdy pasuje do tej powłoki, nie jest
    /// na liście złych i jest nowsza od wersji z aplikacji (w teście bez tego porównania). nil znaczy: wersja z aplikacji.
    static func katalogDoWczytania(test: Bool = false) -> URL? {
        let fm = FileManager.default
        if czeka {
            try? fm.removeItem(at: aktywna)
            try? fm.moveItem(at: nowa, to: aktywna)
        }
        guard let a = wersja(w: aktywna), a.minPowloka <= WERSJA_POWLOKI, !zle.contains(a.skrot) else { return nil }
        if !test, let p = wersja(w: paczka), p.zbudowano >= a.zbudowano {
            try? fm.removeItem(at: aktywna)
            return nil
        }
        return aktywna
    }

    /// Sprawdza wygląd w sieci i pobiera nowszy do „nowa”. Na koniec, na wątku głównym, gotowe(liczba plików pobranych z sieci):
    /// 0, gdy nic nowego, nil przy błędzie. wymus (test): bez porównań i bez kopii z telefonu, wszystko z sieci.
    static func sprawdz(wymus: Bool = false, gotowe: @escaping (Int?) -> Void) {
        let koniec: (Int?) -> Void = { n in DispatchQueue.main.async { gotowe(n) } }
        guard let u = URL(string: "wersja.json?t=\(Int(Date().timeIntervalSince1970))", relativeTo: adres)?.absoluteURL else { koniec(nil); return }
        URLSession.shared.dataTask(with: URLRequest(url: u, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20)) { dane, odp, _ in
            guard let dane = dane, (odp as? HTTPURLResponse)?.statusCode == 200, let w = Wyglad.wersja(dane), w.minPowloka <= WERSJA_POWLOKI,
                  w.pliki["index.html"] != nil, w.pliki.keys.allSatisfy({ Wyglad.dobraNazwa($0) }) else { koniec(nil); return }
            if !wymus {
                let paczka = Wyglad.wersja(w: Wyglad.paczka)
                let znane = [paczka, Wyglad.wersja(w: Wyglad.aktywna), Wyglad.wersja(w: Wyglad.nowa)].compactMap { $0 }
                if Wyglad.zle.contains(w.skrot) || znane.contains(where: { $0.skrot == w.skrot }) || (paczka.map { $0.zbudowano >= w.zbudowano } ?? false) {
                    koniec(0)
                    return
                }
            }
            PobieranieWygladu(w, dane, wymus: wymus, koniec: koniec).start()
        }.resume()
    }
}

/// Pobiera pliki jednej wersji wyglądu po kolei do katalogu tymczasowego, sprawdza SHA-256 każdego, a na końcu przenosi całość do „nowa”.
/// Plik, który już jest w telefonie z tym samym SHA-256 (wersja aktywna albo z aplikacji), idzie z kopii, bez sieci.
final class PobieranieWygladu {
    private let w: Wyglad.Wersja
    private let surowa: Data
    private let wymus: Bool
    private let koniec: (Int?) -> Void
    private let nazwy: [String]
    private let tmp: URL
    private var i = 0
    private var pobrane = 0

    init(_ w: Wyglad.Wersja, _ surowa: Data, wymus: Bool, koniec: @escaping (Int?) -> Void) {
        self.w = w
        self.surowa = surowa
        self.wymus = wymus
        self.koniec = koniec
        nazwy = w.pliki.keys.sorted()
        tmp = Wyglad.baza.appendingPathComponent("pobierana-" + UUID().uuidString, isDirectory: true)
    }

    func start() {
        let fm = FileManager.default
        for stary in (try? fm.contentsOfDirectory(at: Wyglad.baza, includingPropertiesForKeys: nil)) ?? [] where stary.lastPathComponent.hasPrefix("pobierana-") {
            try? fm.removeItem(at: stary)
        }
        do { try fm.createDirectory(at: tmp, withIntermediateDirectories: true) } catch { koniec(nil); return }
        dalej()
    }

    private func dalej() {
        let fm = FileManager.default
        while i < nazwy.count {
            let n = nazwy[i], cel = w.pliki[n] ?? ""
            if !wymus, let d = [Wyglad.aktywna, Wyglad.paczka].compactMap({ $0 }).lazy.compactMap({ try? Data(contentsOf: $0.appendingPathComponent(n)) }).first(where: { Wyglad.sha($0) == cel }) {
                guard (try? d.write(to: tmp.appendingPathComponent(n))) != nil else { przerwij(); return }
                i += 1
                continue
            }
            guard let sciezka = n.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
                  let u = URL(string: sciezka + "?h=" + String(cel.prefix(16)), relativeTo: Wyglad.adres)?.absoluteURL else { przerwij(); return }
            URLSession.shared.dataTask(with: URLRequest(url: u, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 30)) { d, odp, _ in
                guard let d = d, (odp as? HTTPURLResponse)?.statusCode == 200, Wyglad.sha(d) == cel,
                      (try? d.write(to: self.tmp.appendingPathComponent(n))) != nil else { self.przerwij(); return }
                self.pobrane += 1
                self.i += 1
                self.dalej()
            }.resume()
            return
        }
        do {
            try surowa.write(to: tmp.appendingPathComponent("wersja.json"))
            try Data().write(to: tmp.appendingPathComponent("gotowe"))
            try? fm.removeItem(at: Wyglad.nowa)
            try fm.moveItem(at: tmp, to: Wyglad.nowa)
            koniec(pobrane)
        } catch { przerwij() }
    }

    private func przerwij() {
        try? FileManager.default.removeItem(at: tmp)
        koniec(nil)
    }
}

final class Ekran: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply,
                   UIScrollViewDelegate, UIGestureRecognizerDelegate {
    private var web: WKWebView!
    /// W teście odnośniki na zewnątrz trafiają tutaj zamiast do Safari (Safari zabrałby ekran testowi).
    private var zewnetrzne: [String] = []
    /// Pliki strony: z wyglądu z sieci albo z aplikacji (Wyglad).
    private let pliki = Pliki()
    /// Skrót wersji z sieci, z której stoi strona (nil: wersja z aplikacji), i numer wczytania dla strażnika.
    private var zSieci: String?
    private var wczytanie = 0
    private var wTleOd: Date?
    private var sprawdzono = Date.distantPast
    /// Test wyglądu z sieci na symulatorze (ios/test-symulator.sh, --test-wyglad): wszystko z sieci, potem strona z pobranych plików.
    private let testWygladu = ProcessInfo.processInfo.arguments.contains("--test-wyglad")
    /// Etap testu na symulatorze (ios/test-symulator.sh): 0 = zwykła praca, 1 i 2 = test.
    private let etapTestu: Int = {
        let a = ProcessInfo.processInfo.arguments
        if a.contains("--test-etap1") { return 1 }
        if a.contains("--test-etap2") { return 2 }
        return 0
    }()
    private var start: URL {
        URL(string: etapTestu > 0 ? "auta://app/index.html?test=\(etapTestu)" : "auta://app/index.html")!
    }

    // Pełny ekran (od 24.10.2026, reguła pelny-ekran-telefon.md; Jacek: stałe paski wypalają ekran OLED, a o iPhonie „Jak się da,
    // to zrobimy”): bez paska stanu, a kreska na dole przygasa po chwili bez dotyku i wraca przy dotyku. Bardziej iOS nie pozwala.
    // Wcięcie przy wycięciu ekranu (env(safe-area-inset-top) w stronie) zostaje takie samo, więc nagłówek się nie przesuwa.
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override func loadView() {
        let konf = WKWebViewConfiguration()
        konf.setURLSchemeHandler(pliki, forURLScheme: "auta")
        // Numer powłoki dla strony: od 2 mikrofon słucha od stuknięcia (czat.js, natywny.wczesnie).
        konf.userContentController.addUserScript(WKUserScript(source: "window.KASIOMOBILE_POWLOKA = \(WERSJA_POWLOKI);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        konf.websiteDataStore = WKWebsiteDataStore.default()
        konf.defaultWebpagePreferences.allowsContentJavaScript = true
        konf.preferences.javaScriptCanOpenWindowsAutomatically = true
        konf.userContentController.add(self, name: "glos")
        if etapTestu > 0 {
            konf.userContentController.add(self, name: "test")
            konf.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "pytaj")
        }
        let w = WKWebView(frame: .zero, configuration: konf)
        w.isOpaque = false
        w.backgroundColor = kolorTla
        w.scrollView.backgroundColor = kolorTla
        // Strona sama pilnuje marginesów (env(safe-area-inset-*) z viewport-fit=cover) i sama przewija listę.
        w.scrollView.contentInsetAdjustmentBehavior = .never
        w.scrollView.bounces = false
        w.scrollView.delegate = self
        w.allowsBackForwardNavigationGestures = false
        w.allowsLinkPreview = false
        w.navigationDelegate = self
        w.uiDelegate = self
        let krawedz = UIScreenEdgePanGestureRecognizer(target: self, action: #selector(wstecz(_:)))
        krawedz.edges = .left
        krawedz.delegate = self
        w.addGestureRecognizer(krawedz)
        web = w
        view = w
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if testWygladu { testujWyglad() } else { zaladuj() }
        // Po powrocie do aplikacji strona od razu pyta o nowe dane: ogłoszenia, katalag, kalkulator i historię.
        NotificationCenter.default.addObserver(self, selector: #selector(naPierwszyPlan), name: UIApplication.willEnterForegroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(wTle), name: UIApplication.didEnterBackgroundNotification, object: nil)
        // Wygląd z sieci sprawdzamy kilka sekund po starcie, żeby nie spowalniać pierwszego ekranu.
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in self?.sprawdzWyglad() }
    }

    /// Wczytuje stronę: z wyglądu z sieci, gdy jest gotowy i nowszy od wersji z aplikacji, inaczej z aplikacji. W teście zawsze z aplikacji.
    private func zaladuj() {
        let k = etapTestu > 0 ? nil : Wyglad.katalogDoWczytania()
        pliki.katalog = k
        zSieci = k.flatMap { Wyglad.wersja(w: $0)?.skrot }
        web.load(URLRequest(url: start))
        pilnuj()
    }

    /// Strażnik wyglądu z sieci: strona, która nie wstała w 12 s (nie ma window.Auta), wraca do wersji z aplikacji, a ta wersja wyglądu
    /// trafia na listę złych i drugi raz nie przychodzi.
    private func pilnuj() {
        wczytanie &+= 1
        guard let skrot = zSieci else { return }
        let moje = wczytanie
        DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in
            guard let self = self, moje == self.wczytanie else { return }
            self.web.evaluateJavaScript("typeof window.Auta") { [weak self] wynik, _ in
                guard let self = self, moje == self.wczytanie, (wynik as? String) != "object" else { return }
                Wyglad.oznaczZla(skrot)
                try? FileManager.default.removeItem(at: Wyglad.aktywna)
                self.zaladuj()
            }
        }
    }

    /// Najwyżej raz na 30 minut: po starcie i po powrocie do aplikacji. Pobrana wersja czeka na następne wczytanie strony.
    private func sprawdzWyglad() {
        guard etapTestu == 0, !testWygladu, Date().timeIntervalSince(sprawdzono) > 1800 else { return }
        sprawdzono = Date()
        Wyglad.sprawdz { _ in }
    }

    /// Test na symulatorze: wszystko z sieci, strona z pobranych plików, a po 10 s wynik w Documents/test-wyglad.json.
    private func testujWyglad() {
        try? FileManager.default.removeItem(at: Wyglad.baza)
        UserDefaults.standard.removeObject(forKey: "wyglad-zle")
        Wyglad.sprawdz(wymus: true) { [weak self] pobrane in
            guard let self = self else { return }
            let k = Wyglad.katalogDoWczytania(test: true)
            self.pliki.katalog = k
            self.web.load(URLRequest(url: self.start))
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                self?.web.evaluateJavaScript("typeof window.Auta") { wynik, _ in
                    let w = Wyglad.wersja(w: k)
                    let d: [String: Any] = ["pobrane": pobrane ?? -1, "zrodlo": k == nil ? "paczka" : "pobrana", "auta": (wynik as? String) ?? "brak",
                                            "plikow": w?.pliki.count ?? 0, "zbudowano": w?.zbudowano ?? "", "powloka": WERSJA_POWLOKI]
                    let dok = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                    try? FileManager.default.createDirectory(at: dok, withIntermediateDirectories: true)
                    if let dane = try? JSONSerialization.data(withJSONObject: d) { try? dane.write(to: dok.appendingPathComponent("test-wyglad.json"), options: .atomic) }
                }
            }
        }
    }

    @objc private func naPierwszyPlan() {
        let dlugo = wTleOd.map { Date().timeIntervalSince($0) >= 600 } ?? false
        wTleOd = nil
        // Nowy wygląd czeka, a aplikacja leżała w tle co najmniej 10 minut: strona wczytuje się od nowa w nowym wyglądzie (dane zostają).
        if etapTestu == 0, !testWygladu, dlugo, Wyglad.czeka { zaladuj(); return }
        web.evaluateJavaScript("window.Auta && (Auta.odswiez(), 0)", completionHandler: nil)
        sprawdzWyglad()
    }

    /// Mikrofon w czacie (klasa Glos niżej): strona woła window.webkit.messageHandlers.glos.postMessage({ co, klucz, konfiguracja, zaraz }),
    /// co: nagrywaj (od powłoki 2), start albo stop.
    private lazy var glos = Glos(web: web)
    private func obsluzGlos(_ cialo: Any) {
        guard let d = cialo as? [String: Any] else { return }
        switch d["co"] as? String {
        case "start": glos.start(klucz: d["klucz"] as? String ?? "", konfiguracja: d["konfiguracja"] as? String ?? "{}")
        case "stop": glos.stop(zaraz: d["zaraz"] as? Bool ?? false)
        case "nagrywaj": glos.nagrywaj()
        default: break
        }
    }
    /// Aplikacja schodzi z ekranu: iOS odcina mikrofon, więc nagranie kończy się bez wysyłania pytania.
    @objc private func wTle() { wTleOd = Date(); glos.przerwij() }

    /// Przeciągnięcie od lewej krawędzi: zamyka okno w stronie (szczegóły auta, filtry, galerię zdjęć), jak Wstecz na Androidzie.
    @objc private func wstecz(_ g: UIScreenEdgePanGestureRecognizer) {
        guard g.state == .ended, g.translation(in: view).x > 60 else { return }
        web.evaluateJavaScript("window.Auta && Auta.wstecz()", completionHandler: nil)
    }
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith inny: UIGestureRecognizer) -> Bool { true }

    // Układ jest liczony na szerokość telefonu; powiększanie palcami by go rozsadziło.
    func viewForZooming(in scrollView: UIScrollView) -> UIView? { return nil }

    // Strona, katalog i kalkulator zostają w aplikacji; ogłoszenia i banki otwiera Safari.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = navigationAction.request.url, let s = u.scheme?.lowercased() else { decisionHandler(.cancel); return }
        if ["auta", "about", "blob", "data"].contains(s) { decisionHandler(.allow); return }
        // Atlas Samochodów pod logo (od 23.10.2026) to strona z sieci w ramce: zostaje w aplikacji. URL.path gubi ukośnik
        // na końcu („/atlas-samochodow/” daje „/atlas-samochodow”), więc liczy się też sama ścieżka bez niego: pierwsza budowa
        // z 23.10.2026 odsyłała przez to Atlas do Safari, a ramka stała pusta (test na symulatorze: atlas „nie ma”).
        if s == "https", u.host == "jackoludek.github.io", u.path == "/atlas-samochodow" || u.path.hasPrefix("/atlas-samochodow/") { decisionHandler(.allow); return }
        naZewnatrz(u)
        decisionHandler(.cancel)
    }
    // window.open (ogłoszenie z katalogu) też idzie do Safari.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = navigationAction.request.url { naZewnatrz(u) }
        return nil
    }
    private func naZewnatrz(_ u: URL) {
        if etapTestu > 0 { zewnetrzne.append(u.absoluteString); return }
        UIApplication.shared.open(u)
    }
    // Gdy iOS zamknie proces strony (np. przy braku pamięci), otwieramy ją od nowa. Dane są na dysku.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if testWygladu { webView.load(URLRequest(url: start)) } else { zaladuj() }
    }
    // Bez okienek z pytaniami (decyzja Jacka z 12.10.2026): confirm() strony od razu dostaje „tak”, alert() nic nie pokazuje.
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(true)
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        completionHandler()
    }
    /// Test na symulatorze: strona (test.js) zgłasza kroki i wynik, a my zapisujemy je w Documents jako <plik>.json.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "glos" { obsluzGlos(message.body); return }
        guard message.name == "test", let tekst = message.body as? String,
              let d = try? JSONSerialization.jsonObject(with: Data(tekst.utf8)) as? [String: Any],
              let plik = d["plik"] as? String else { return }
        let dok = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dok, withIntermediateDirectories: true)
        try? Data(tekst.utf8).write(to: dok.appendingPathComponent(plik + ".json"), options: .atomic)
    }
    /// Pytania testu: „zrzut” – czy skrypt zrobił już zrzut kroku (plik Documents/zrobione-<krok>),
    /// „zewnetrzne” – które odnośniki poszłyby do Safari.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void) {
        let d = message.body as? [String: Any] ?? [:]
        switch d["co"] as? String {
        case "zrzut":
            let dok = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let plik = dok.appendingPathComponent("zrobione-" + ((d["plik"] as? String) ?? ""))
            replyHandler(FileManager.default.fileExists(atPath: plik.path), nil)
        case "zewnetrzne":
            replyHandler(zewnetrzne, nil)
        default:
            replyHandler(nil, "Nieznane pytanie.")
        }
    }
}

/// Mikrofon w czacie (od 26.10.2026; Jacek: wersja na iPhone'a Kasi z działającym mikrofonem). Strona spod auta:// nie dostaje
/// mikrofonu (getUserMedia), więc nagrywa ten kod: dźwięk z mikrofonu jako PCM 16 kHz mono (AVAudioEngine i AVAudioConverter) idzie
/// WebSocketem do Soniox z krótkim, jednorazowym kluczem od komputera, a każda wiadomość Soniox wraca do strony bez zmian
/// (Czat.zGlosu({ wiadomosc })). Tekst na bieżąco, koniec wypowiedzi i błędy liczy więc czat.js, tak samo jak na Androidzie.
/// Strona woła: nagrywaj (od powłoki 2: mikrofon od stuknięcia, zanim przyjdzie klucz, a kawałki czekają w kolejce), start (klucz
/// i pierwsza wiadomość z ustawieniami; bez wcześniejszego „nagrywaj” mikrofon rusza dopiero wtedy) i stop (koniec mówienia; zaraz:
/// także koniec połączenia). Do strony idą: { stan: "nagrywa" }, { wiadomosc }, { blad: "mikrofon" | "soniox" } i { koniec, bezWysylki }.
/// Zgoda na mikrofon: NSMicrophoneUsageDescription w Info.plist; iOS pyta raz, przy pierwszym stuknięciu.
final class Glos: NSObject, URLSessionWebSocketDelegate {
    private weak var web: WKWebView?
    private let silnik = AVAudioEngine()
    private var nagrywa = false
    /// Zgoda na mikrofon albo jego włączanie jest w drodze (wątek główny).
    private var wlacza = false
    private var sesja: URLSession?
    private var gniazdo: URLSessionWebSocketTask?
    private var zamkniete = false
    private var ustawienia = "{}"
    /// Numer nagrania: zgoda na mikrofon, która przyjdzie już po stop, niczego nie włącza.
    private var numer = 0
    /// Dźwięk do Soniox (od 26.10.2026): kawałki sprzed połączenia czekają w `czeka`, a po wiadomości z ustawieniami lecą po kolei,
    /// potem już na bieżąco. Te trzy pola zmienia tylko `kolejka`, bo mikrofon oddaje dźwięk na swoim wątku.
    private let kolejka = DispatchQueue(label: "pl.jacek.auta.glos")
    private var czeka: [Data] = []
    private var dokad: URLSessionWebSocketTask?
    private var koniecDzwieku = false
    private static let cel = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!

    init(web: WKWebView) {
        self.web = web
        super.init()
    }

    /// Mikrofon od stuknięcia (powłoka 2): po zgodzie nagrywa do kolejki, zanim strona dostanie klucz.
    func nagrywaj() {
        zakoncz()
        wlaczPoZgodzie()
    }

    func start(klucz: String, konfiguracja: String) {
        guard !klucz.isEmpty, let adres = URL(string: "wss://stt-rt.soniox.com/transcribe-websocket") else { zakoncz(); dalej(["blad": "soniox"]); return }
        // Strona bez „nagrywaj” (starsza niż powłoka 2): mikrofon rusza teraz.
        if !nagrywa && !wlacza {
            zakoncz()
            wlaczPoZgodzie()
        }
        gniazdo?.cancel(with: .normalClosure, reason: nil)
        sesja?.invalidateAndCancel()
        ustawienia = konfiguracja
        var z = URLRequest(url: adres)
        z.setValue("Bearer " + klucz, forHTTPHeaderField: "Authorization")
        let s = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: .main)
        let g = s.webSocketTask(with: z)
        sesja = s
        gniazdo = g
        zamkniete = false
        g.resume()
        odbieraj(g)
    }

    /// Koniec mówienia: mikrofon gaśnie, a Soniox dostaje pusty kawałek (po zaległych), oddaje resztę tekstu z „finished” i zamyka połączenie.
    func stop(zaraz: Bool) {
        if zaraz { zakoncz(); return }
        numer &+= 1
        wlacza = false
        zatrzymajMikrofon()
        kolejka.async {
            guard !self.koniecDzwieku else { return }
            self.koniecDzwieku = true
            self.dokad?.send(.string("")) { _ in }
        }
    }

    /// Aplikacja zeszła z ekranu: kończymy bez wysyłania pytania.
    func przerwij() {
        guard gniazdo != nil || nagrywa || wlacza else { return }
        zakoncz()
        dalej(["koniec": true, "bezWysylki": true])
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol wybrany: String?) {
        guard webSocketTask === gniazdo else { return }
        let u = ustawienia
        kolejka.async {
            webSocketTask.send(.string(u)) { _ in }
            for d in self.czeka { webSocketTask.send(.data(d)) { _ in } }
            self.czeka.removeAll()
            if self.koniecDzwieku { webSocketTask.send(.string("")) { _ in } }
            self.dokad = webSocketTask
        }
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        guard webSocketTask === gniazdo else { return }
        zamkniete = true
        // Ostatnie wiadomości (reszta tekstu i „finished”) mogą jeszcze czekać w kolejce odbioru, więc dajemy im pół sekundy.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            guard webSocketTask === self.gniazdo else { return }
            self.zakoncz()
            self.dalej(["koniec": true])
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard task === gniazdo, !zamkniete else { return }
        zakoncz()
        dalej(error == nil ? ["koniec": true] : ["blad": "soniox"])
    }

    private func odbieraj(_ g: URLSessionWebSocketTask) {
        g.receive { [weak self] wynik in
            DispatchQueue.main.async {
                guard let self = self, g === self.gniazdo, case .success(let w) = wynik else { return }
                switch w {
                case .string(let t): self.dalej(["wiadomosc": t])
                case .data(let d): self.dalej(["wiadomosc": String(decoding: d, as: UTF8.self)])
                @unknown default: break
                }
                self.odbieraj(g)
            }
        }
    }

    private func wlaczPoZgodzie() {
        let moj = numer
        wlacza = true
        AVAudioSession.sharedInstance().requestRecordPermission { zgoda in
            DispatchQueue.main.async {
                guard moj == self.numer else { return }
                self.wlacza = false
                guard zgoda else { self.zakoncz(); self.dalej(["blad": "mikrofon"]); return }
                do {
                    try self.wlaczMikrofon()
                    self.dalej(["stan": "nagrywa"])
                } catch {
                    self.zakoncz()
                    self.dalej(["blad": "mikrofon"])
                }
            }
        }
    }

    private func wlaczMikrofon() throws {
        let s = AVAudioSession.sharedInstance()
        try s.setCategory(.record, mode: .measurement, options: [])
        try s.setActive(true)
        let wejscie = silnik.inputNode
        let format = wejscie.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0, let k = AVAudioConverter(from: format, to: Glos.cel) else {
            throw NSError(domain: "Glos", code: 1)
        }
        wejscie.removeTap(onBus: 0)
        wejscie.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] bufor, _ in
            guard let self = self, let d = Glos.pcm(bufor, k) else { return }
            self.kolejka.async { self.doSoniox(d) }
        }
        silnik.prepare()
        try silnik.start()
        nagrywa = true
    }

    /// Tylko na `kolejka`: kawałek idzie do Soniox, a przed połączeniem czeka (najwyżej kilka minut dźwięku).
    private func doSoniox(_ d: Data) {
        guard !koniecDzwieku else { return }
        if let g = dokad { g.send(.data(d)) { _ in } } else if czeka.count < 3000 { czeka.append(d) }
    }

    /// Kawałek z mikrofonu (wątek dźwięku): 16 kHz, mono, liczby 16-bitowe.
    private static func pcm(_ b: AVAudioPCMBuffer, _ k: AVAudioConverter) -> Data? {
        let ile = AVAudioFrameCount(Double(b.frameLength) * cel.sampleRate / b.format.sampleRate) + 64
        guard let wy = AVAudioPCMBuffer(pcmFormat: cel, frameCapacity: ile) else { return nil }
        var dany = false
        var blad: NSError?
        let stan = k.convert(to: wy, error: &blad) { _, co in
            if dany { co.pointee = .noDataNow; return nil }
            dany = true
            co.pointee = .haveData
            return b
        }
        guard stan != .error, blad == nil, wy.frameLength > 0, let p = wy.int16ChannelData else { return nil }
        return Data(bytes: p[0], count: Int(wy.frameLength) * MemoryLayout<Int16>.size)
    }

    private func zatrzymajMikrofon() {
        guard nagrywa else { return }
        nagrywa = false
        silnik.stop()
        silnik.inputNode.removeTap(onBus: 0)
        // Po nagraniu wraca zwykły dźwięk aplikacji, bo w kategorii „record” strona nie zagrałaby nawet cichego dźwięku niespodzianki.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [])
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func zakoncz() {
        numer &+= 1
        wlacza = false
        zatrzymajMikrofon()
        gniazdo?.cancel(with: .normalClosure, reason: nil)
        gniazdo = nil
        sesja?.invalidateAndCancel()
        sesja = nil
        kolejka.async {
            self.czeka.removeAll()
            self.dokad = nil
            self.koniecDzwieku = false
        }
    }

    private func dalej(_ d: [String: Any]) {
        guard let dane = try? JSONSerialization.data(withJSONObject: d), let t = String(data: dane, encoding: .utf8) else { return }
        web?.evaluateJavaScript("window.Czat && Czat.zGlosu(\(t)); 0", completionHandler: nil)
    }
}

/// Pliki strony: z wyglądu z sieci (katalog, od 26.10.2026) albo z folderu www w aplikacji. kanal.js zawsze z aplikacji, a plik, którego
/// w wyglądzie z sieci nie ma, też z aplikacji.
final class Pliki: NSObject, WKURLSchemeHandler {
    var katalog: URL?
    private static let typy: [String: String] = [
        "html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8",
        "json": "application/json", "svg": "image/svg+xml", "png": "image/png", "woff2": "font/woff2",
    ]
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let u = urlSchemeTask.request.url, let www = Bundle.main.resourceURL?.appendingPathComponent("www") else {
            odpowiedz(urlSchemeTask, 404, Data(), "text/plain"); return
        }
        var p = u.path
        if p.isEmpty || p == "/" { p = "/index.html" }
        let nazwa = String(p.dropFirst())
        guard !nazwa.contains("..") else { odpowiedz(urlSchemeTask, 404, Data(), "text/plain"); return }
        let zSieci = nazwa == "kanal.js" ? nil : katalog.flatMap { try? Data(contentsOf: $0.appendingPathComponent(nazwa)) }
        guard let dane = zSieci ?? (try? Data(contentsOf: www.appendingPathComponent(nazwa))) else { odpowiedz(urlSchemeTask, 404, Data(), "text/plain"); return }
        odpowiedz(urlSchemeTask, 200, dane, Pliki.typy[(nazwa as NSString).pathExtension.lowercased()] ?? "application/octet-stream")
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
    private func odpowiedz(_ t: WKURLSchemeTask, _ kod: Int, _ dane: Data, _ typ: String) {
        let naglowki = ["Content-Type": typ, "Content-Length": String(dane.count), "Cache-Control": "no-cache"]
        guard let u = t.request.url, let r = HTTPURLResponse(url: u, statusCode: kod, httpVersion: "HTTP/1.1", headerFields: naglowki) else { return }
        t.didReceive(r)
        t.didReceive(dane)
        t.didFinish()
    }
}