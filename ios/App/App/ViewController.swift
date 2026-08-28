import UIKit
import WebKit
import StoreKit
import AVFoundation

// MARK: - Storage bridge

private final class StorageHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: String],
              let action = body["action"],
              let key = body["key"] else { return }
        switch action {
        case "set":
            if let value = body["value"] { UserDefaults.standard.set(value, forKey: key) }
        case "remove":
            UserDefaults.standard.removeObject(forKey: key)
        default: break
        }
    }
}

// MARK: - Haptics bridge

private final class HapticsHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: String] else { return }
        DispatchQueue.main.async {
            if body["type"] == "notification" {
                let gen = UINotificationFeedbackGenerator()
                gen.prepare()
                switch body["notificationType"] {
                case "Success": gen.notificationOccurred(.success)
                case "Warning": gen.notificationOccurred(.warning)
                default:        gen.notificationOccurred(.error)
                }
            } else {
                let style: UIImpactFeedbackGenerator.FeedbackStyle
                switch body["style"] {
                case "Heavy": style = .heavy
                case "Light": style = .light
                default:      style = .medium
                }
                let gen = UIImpactFeedbackGenerator(style: style)
                gen.prepare()
                gen.impactOccurred()
            }
        }
    }
}

// MARK: - AppReview bridge

private final class AppReviewHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        DispatchQueue.main.async {
            if let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                SKStoreReviewController.requestReview(in: scene)
            }
        }
    }
}

// MARK: - Controls bridge (show/hide overlay + visual state updates from JS)

private final class ControlsHandler: NSObject, WKScriptMessageHandler {
    weak var overlay: GameControlOverlay?
    private let isMac = ProcessInfo.processInfo.isiOSAppOnMac

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        // WKScriptMessageHandler is already called on the main thread — no async dispatch needed.
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String,
              let overlay else { return }
        switch type {
        case "showControls":
            if !isMac { overlay.setVisible((body["visible"] as? Bool) == true) }
        case "deliverToggle":
            overlay.setDeliverOn((body["on"] as? Bool) == true)
        case "tutorialHighlight":
            overlay.setTutorialHighlight(body["control"] as? String,
                                         direction: body["direction"] as? String)
        case "tutorialDim":
            overlay.setTutorialDim(Set(body["controls"] as? [String] ?? []))
        default: break
        }
    }
}

// MARK: - IAP bridge

private let kProductID = "i.thie.softworks.wolf.fullgame"
private let kConversionVersion = "1.5" // First version where app is free — prior buyers are grandfathered

private final class IAPHandler: NSObject, WKScriptMessageHandler {
    weak var vc: ViewController?

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: String],
              let action = body["action"],
              let vc else { return }
        switch action {
        case "purchase":  Task { await vc.iapPurchase() }
        case "restore":   Task { await vc.iapRestore() }
        case "loadPrice": Task { await vc.iapLoadPrice() }
        default: break
        }
    }
}

// MARK: - ViewController

class ViewController: UIViewController {

    private var webView: WKWebView!
    private var controlsOverlay: GameControlOverlay!
    private let controlsHandler = ControlsHandler()
    private let iapHandler = IAPHandler()

    override func viewDidLoad() {
        super.viewDidLoad()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        NotificationCenter.default.addObserver(self, selector: #selector(_appDidBecomeActive),
                                               name: UIApplication.didBecomeActiveNotification, object: nil)
        // Dark background visible during the brief entitlement check
        view.backgroundColor = UIColor(red: 5/255, green: 5/255, blue: 5/255, alpha: 1)

        Task {
            // Resolve entitlements BEFORE building the WebView so injectNativeStorage
            // already sees z_unlocked = '1' for grandfathered / returning buyers.
            // Already-unlocked users hit the early return immediately — no delay.
            await checkEntitlementsOnLaunch()
            await MainActor.run { _setupAndLoadWebView() }
        }
    }

    @MainActor
    private func _setupAndLoadWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        injectNativeStorage(into: config)

        let ucc = config.userContentController
        ucc.add(StorageHandler(),   name: "storage")
        ucc.add(HapticsHandler(),   name: "haptics")
        ucc.add(AppReviewHandler(), name: "appReview")
        ucc.add(controlsHandler,    name: "controls")
        ucc.add(ZsynthHandler(),    name: "zsynthPlayer")
        ucc.add(HeliSoundHandler(), name: "heliSound")
        iapHandler.vc = self
        ucc.add(iapHandler,         name: "iap")

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask           = [.flexibleWidth, .flexibleHeight]
        webView.scrollView.isScrollEnabled              = false
        webView.scrollView.bounces                       = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview          = false
        webView.isOpaque                   = false
        let bg = UIColor(red: 5/255, green: 5/255, blue: 5/255, alpha: 1)
        webView.backgroundColor            = bg
        webView.scrollView.backgroundColor = bg
        view.addSubview(webView)

        // Controls overlay — sits on top of WKWebView, hidden until game starts
        controlsOverlay = GameControlOverlay(frame: view.bounds)
        controlsOverlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        controlsOverlay.webView  = webView
        controlsOverlay.isHidden = true
        controlsHandler.overlay  = controlsOverlay
        view.addSubview(controlsOverlay)

        guard let url = Bundle.main.url(forResource: "index", withExtension: "html",
                                        subdirectory: "public") else {
            fatalError("[SAR] index.html not found in bundle")
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    // MARK: - Audio resume

    @objc private func _appDidBecomeActive() {
        ZsynthPlayer.shared.resumeEngine()
        HeliSoundPlayer.shared.resumeEngine()
    }

    // MARK: - Storage helpers

    private let storageKeys = ["z_session", "z_lang", "z_music", "z_sfx", "z_unlocked"]

    private func migrateSession(_ raw: String) -> String {
        guard var session = (try? JSONSerialization.jsonObject(with: Data(raw.utf8))) as? [String: Any],
              var progress = session["campaignProgress"] as? [String: Any] else { return raw }
        var changed = false
        for (key, value) in progress {
            guard var cp = value as? [String: Any],
                  var missions = cp["missions"] as? [[String: Any]?] else { continue }
            for i in missions.indices {
                guard var m = missions[i], m["count"] == nil else { continue }
                m["count"] = (m["completed"] as? Bool == true) ? 1 : 0
                missions[i] = m
                changed = true
            }
            cp["missions"] = missions
            progress[key] = cp
        }
        if changed { session["campaignProgress"] = progress }

        // type-rating system migration: old saves get all ratings granted
        if session["typeRatingSystemSince"] == nil {
            let rankOverride = session["rankOverride"] as? Int ?? 0
            var ratings = session["typeRatings"] as? [String: Bool] ?? [:]
            if rankOverride >= 1 { ratings["dolphin"]     = true }
            if rankOverride >= 2 { ratings["atlas"]       = true }
            if rankOverride >= 3 { ratings["ornithopter"] = true }
            session["typeRatings"]           = ratings
            session["typeRatingBestTime"]    = session["typeRatingBestTime"] ?? [String: Int]()
            session["typeRatingSystemSince"] = 1
            changed = true
        }

        guard changed else { return raw }
        return (try? JSONSerialization.data(withJSONObject: session))
            .flatMap { String(data: $0, encoding: .utf8) } ?? raw
    }

    private func injectNativeStorage(into config: WKWebViewConfiguration) {
        var dict: [String: String] = [:]
        for key in storageKeys {
            if let v = UserDefaults.standard.string(forKey: key) {
                dict[key] = key == "z_session" ? migrateSession(v) : v
            }
        }
        let json = (try? JSONSerialization.data(withJSONObject: dict))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__nativeStorage = \(json);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        if ProcessInfo.processInfo.isiOSAppOnMac {
            config.userContentController.addUserScript(WKUserScript(
                source: "window.__platform = 'mac';",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            ))
        }
    }

    // MARK: - IAP helpers

    private func _compareVersions(_ a: String, _ b: String) -> ComparisonResult {
        let aParts = a.split(separator: ".").compactMap { Int($0) }
        let bParts = b.split(separator: ".").compactMap { Int($0) }
        let len = max(aParts.count, bParts.count)
        for i in 0..<len {
            let av = i < aParts.count ? aParts[i] : 0
            let bv = i < bParts.count ? bParts[i] : 0
            if av < bv { return .orderedAscending }
            if av > bv { return .orderedDescending }
        }
        return .orderedSame
    }

    func setUnlocked() {
        UserDefaults.standard.set("1", forKey: "z_unlocked")
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript("window.__iapResult && window.__iapResult('success')")
        }
    }

    func checkEntitlementsOnLaunch() async {
        // Already unlocked in storage — nothing to do
        if UserDefaults.standard.string(forKey: "z_unlocked") == "1" { return }

        // 1. Grandfathering: original purchase was before the freemium conversion (v1.5)
        if let appTx = try? await AppTransaction.shared,
           case .verified(let tx) = appTx,
           _compareVersions(tx.originalAppVersion, kConversionVersion) == .orderedAscending {
            UserDefaults.standard.set("1", forKey: "z_unlocked")
            return
        }

        // 2. Active entitlement via StoreKit 2
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.productID == kProductID {
                UserDefaults.standard.set("1", forKey: "z_unlocked")
                return
            }
        }
    }

    func iapLoadPrice() async {
#if targetEnvironment(simulator)
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript("window.__iapPrice && window.__iapPrice('1,99\u{a0}€')")
        }
#else
        guard let product = try? await Product.products(for: [kProductID]).first else { return }
        let price = product.displayPrice
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript("window.__iapPrice && window.__iapPrice('\(price)')")
        }
#endif
    }

    func iapPurchase() async {
        guard let product = try? await Product.products(for: [kProductID]).first else {
            _iapCallback("error"); return
        }
        guard let result = try? await product.purchase() else {
            _iapCallback("error"); return
        }
        switch result {
        case .success(let verification):
            if case .verified(let tx) = verification {
                await tx.finish()
                UserDefaults.standard.set("1", forKey: "z_unlocked")
                _iapCallback("success")
            } else {
                _iapCallback("error")
            }
        case .userCancelled:
            _iapCallback("cancelled")
        case .pending:
            _iapCallback("cancelled")
        @unknown default:
            _iapCallback("error")
        }
    }

    func iapRestore() async {
        try? await AppStore.sync()
        var found = false
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.productID == kProductID {
                UserDefaults.standard.set("1", forKey: "z_unlocked")
                found = true
                break
            }
        }
        _iapCallback(found ? "success" : "already")
    }

    private func _iapCallback(_ result: String) {
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript("window.__iapResult && window.__iapResult('\(result)')")
        }
    }

    // MARK: - Mac keyboard input

    private let _keyMap: [UIKeyboardHIDUsage: String] = [
        .keyboardW:          "KeyW",
        .keyboardS:          "KeyS",
        .keyboardA:          "KeyA",
        .keyboardD:          "KeyD",
        .keyboardQ:          "KeyQ",
        .keyboardE:          "KeyE",
        .keyboardR:          "KeyR",
        .keyboardUpArrow:    "ArrowUp",
        .keyboardDownArrow:  "ArrowDown",
        .keyboardLeftArrow:  "ArrowLeft",
        .keyboardRightArrow: "ArrowRight",
    ]

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        guard ProcessInfo.processInfo.isiOSAppOnMac else {
            super.pressesBegan(presses, with: event); return
        }
        for press in presses {
            guard let key = press.key, let code = _keyMap[key.keyCode] else { continue }
            webView.evaluateJavaScript("window.__setKey('\(code)',true)")
        }
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        guard ProcessInfo.processInfo.isiOSAppOnMac else {
            super.pressesEnded(presses, with: event); return
        }
        for press in presses {
            guard let key = press.key, let code = _keyMap[key.keyCode] else { continue }
            webView.evaluateJavaScript("window.__setKey('\(code)',false)")
        }
    }

    override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        guard ProcessInfo.processInfo.isiOSAppOnMac else {
            super.pressesCancelled(presses, with: event); return
        }
        webView.evaluateJavaScript("window.__clearAllKeys()")
    }

    // MARK: - Orientation / UI

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
}
