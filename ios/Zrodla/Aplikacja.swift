// Kasiomobile na iPhone'a (do 18.10.2026 „Auta”): okno WKWebView wokół strony z folderu www (index.html, app.js, styl.css,
// czat.js, czat.css, logo.svg, kanal.js), tej samej co na Androidzie i w przeglądarce. Strona otwiera się pod adresem
// auta://app/, który podaje ten kod (Pliki). Ogłoszenia ze Skanera Produktów, katalog modeli, kalkulator kredytu i historię
// ogłoszeń pobiera sama strona z ntfy.sh i trzyma je w kontenerze aplikacji (localStorage, IndexedDB), więc działają też
// bez internetu i zostają po ponownym podpisaniu.
// Ogłoszenia i strony banków otwiera Safari. Przeciągnięcie od lewej krawędzi działa jak Wstecz.
// Budowane bez projektu Xcode: swiftc + actool (ios/buduj.sh), na Macu GitHub Actions.
// Kolory idą za motywem iPhone'a; ciemny to czerń.
// Mikrofon w czacie nagrywa ten kod (klasa Glos, od 26.10.2026), bo strona spod auta:// mikrofonu nie dostaje.
import UIKit
import WebKit
import AVFoundation

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

final class Ekran: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply,
                   UIScrollViewDelegate, UIGestureRecognizerDelegate {
    private var web: WKWebView!
    /// W teście odnośniki na zewnątrz trafiają tutaj zamiast do Safari (Safari zabrałby ekran testowi).
    private var zewnetrzne: [String] = []
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
        konf.setURLSchemeHandler(Pliki(), forURLScheme: "auta")
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
        web.load(URLRequest(url: start))
        // Po powrocie do aplikacji strona od razu pyta o nowe dane: ogłoszenia, katalag, kalkulator i historię.
        NotificationCenter.default.addObserver(self, selector: #selector(naPierwszyPlan), name: UIApplication.willEnterForegroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(wTle), name: UIApplication.didEnterBackgroundNotification, object: nil)
    }

    @objc private func naPierwszyPlan() {
        web.evaluateJavaScript("window.Auta && (Auta.odswiez(), 0)", completionHandler: nil)
    }

    /// Mikrofon w czacie (klasa Glos niżej): strona woła window.webkit.messageHandlers.glos.postMessage({ co, klucz, konfiguracja, zaraz }).
    private lazy var glos = Glos(web: web)
    private func obsluzGlos(_ cialo: Any) {
        guard let d = cialo as? [String: Any] else { return }
        switch d["co"] as? String {
        case "start": glos.start(klucz: d["klucz"] as? String ?? "", konfiguracja: d["konfiguracja"] as? String ?? "{}")
        case "stop": glos.stop(zaraz: d["zaraz"] as? Bool ?? false)
        default: break
        }
    }
    /// Aplikacja schodzi z ekranu: iOS odcina mikrofon, więc nagranie kończy się bez wysyłania pytania.
    @objc private func wTle() { glos.przerwij() }

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
        webView.load(URLRequest(url: start))
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
/// Strona woła: start (klucz i pierwsza wiadomość z ustawieniami) i stop (koniec mówienia; zaraz: także koniec połączenia).
/// Do strony idą: { stan: "nagrywa" }, { wiadomosc }, { blad: "mikrofon" | "soniox" } i { koniec, bezWysylki }.
/// Zgoda na mikrofon: NSMicrophoneUsageDescription w Info.plist; iOS pyta raz, przy pierwszym stuknięciu.
final class Glos: NSObject, URLSessionWebSocketDelegate {
    private weak var web: WKWebView?
    private let silnik = AVAudioEngine()
    private var nagrywa = false
    private var sesja: URLSession?
    private var gniazdo: URLSessionWebSocketTask?
    private var zamkniete = false
    private var ustawienia = "{}"
    /// Numer nagrania: zgoda na mikrofon, która przyjdzie już po stop, niczego nie włącza.
    private var numer = 0
    private static let cel = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: 16000, channels: 1, interleaved: true)!

    init(web: WKWebView) {
        self.web = web
        super.init()
    }

    func start(klucz: String, konfiguracja: String) {
        zakoncz()
        let moj = numer
        guard !klucz.isEmpty, let adres = URL(string: "wss://stt-rt.soniox.com/transcribe-websocket") else { dalej(["blad": "soniox"]); return }
        ustawienia = konfiguracja
        AVAudioSession.sharedInstance().requestRecordPermission { zgoda in
            DispatchQueue.main.async {
                guard moj == self.numer else { return }
                guard zgoda else { self.dalej(["blad": "mikrofon"]); return }
                var z = URLRequest(url: adres)
                z.setValue("Bearer " + klucz, forHTTPHeaderField: "Authorization")
                let s = URLSession(configuration: .ephemeral, delegate: self, delegateQueue: .main)
                let g = s.webSocketTask(with: z)
                self.sesja = s
                self.gniazdo = g
                self.zamkniete = false
                g.resume()
                self.odbieraj(g)
            }
        }
    }

    /// Koniec mówienia: mikrofon gaśnie, a Soniox dostaje pusty kawałek, oddaje resztę tekstu z „finished” i zamyka połączenie.
    func stop(zaraz: Bool) {
        if zaraz { zakoncz(); return }
        zatrzymajMikrofon()
        gniazdo?.send(.string("")) { _ in }
    }

    /// Aplikacja zeszła z ekranu: kończymy bez wysyłania pytania.
    func przerwij() {
        guard gniazdo != nil else { return }
        zakoncz()
        dalej(["koniec": true, "bezWysylki": true])
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol wybrany: String?) {
        guard webSocketTask === gniazdo else { return }
        webSocketTask.send(.string(ustawienia)) { _ in }
        do {
            try nagrywaj(webSocketTask)
            dalej(["stan": "nagrywa"])
        } catch {
            zakoncz()
            dalej(["blad": "mikrofon"])
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

    private func nagrywaj(_ g: URLSessionWebSocketTask) throws {
        let s = AVAudioSession.sharedInstance()
        try s.setCategory(.record, mode: .measurement, options: [])
        try s.setActive(true)
        let wejscie = silnik.inputNode
        let format = wejscie.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0, let k = AVAudioConverter(from: format, to: Glos.cel) else {
            throw NSError(domain: "Glos", code: 1)
        }
        wejscie.removeTap(onBus: 0)
        wejscie.installTap(onBus: 0, bufferSize: 4096, format: format) { bufor, _ in Glos.wyslij(bufor, k, g) }
        silnik.prepare()
        try silnik.start()
        nagrywa = true
    }

    /// Kawałek z mikrofonu (wątek dźwięku): 16 kHz, mono, liczby 16-bitowe, prosto do Soniox.
    private static func wyslij(_ b: AVAudioPCMBuffer, _ k: AVAudioConverter, _ g: URLSessionWebSocketTask) {
        let ile = AVAudioFrameCount(Double(b.frameLength) * cel.sampleRate / b.format.sampleRate) + 64
        guard let wy = AVAudioPCMBuffer(pcmFormat: cel, frameCapacity: ile) else { return }
        var dany = false
        var blad: NSError?
        let stan = k.convert(to: wy, error: &blad) { _, co in
            if dany { co.pointee = .noDataNow; return nil }
            dany = true
            co.pointee = .haveData
            return b
        }
        guard stan != .error, blad == nil, wy.frameLength > 0, let p = wy.int16ChannelData else { return }
        g.send(.data(Data(bytes: p[0], count: Int(wy.frameLength) * MemoryLayout<Int16>.size))) { _ in }
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
        zatrzymajMikrofon()
        gniazdo?.cancel(with: .normalClosure, reason: nil)
        gniazdo = nil
        sesja?.invalidateAndCancel()
        sesja = nil
    }

    private func dalej(_ d: [String: Any]) {
        guard let dane = try? JSONSerialization.data(withJSONObject: d), let t = String(data: dane, encoding: .utf8) else { return }
        web?.evaluateJavaScript("window.Czat && Czat.zGlosu(\(t)); 0", completionHandler: nil)
    }
}

/// Pliki strony z folderu www w aplikacji.
final class Pliki: NSObject, WKURLSchemeHandler {
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
        let plik = www.appendingPathComponent(String(p.dropFirst()))
        guard let dane = try? Data(contentsOf: plik) else { odpowiedz(urlSchemeTask, 404, Data(), "text/plain"); return }
        odpowiedz(urlSchemeTask, 200, dane, Pliki.typy[plik.pathExtension.lowercased()] ?? "application/octet-stream")
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