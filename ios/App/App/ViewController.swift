import UIKit
import WebKit
import StoreKit

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

    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        // WKScriptMessageHandler is already called on the main thread — no async dispatch needed.
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String,
              let overlay else { return }
        switch type {
        case "showControls":
            overlay.setVisible((body["visible"] as? Bool) == true)
        case "deliverToggle":
            overlay.setDeliverOn((body["on"] as? Bool) == true)
        case "tutorialHighlight":
            overlay.setTutorialHighlight(body["control"] as? String)
        case "tutorialDim":
            overlay.setTutorialDim(Set(body["controls"] as? [String] ?? []))
        default: break
        }
    }
}

// MARK: - ViewController

class ViewController: UIViewController {

    private var webView: WKWebView!
    private var controlsOverlay: GameControlOverlay!
    private let controlsHandler = ControlsHandler()

    override func viewDidLoad() {
        super.viewDidLoad()
        migrateCapacitorStorage()

        let config = WKWebViewConfiguration()
        injectNativeStorage(into: config)

        let ucc = config.userContentController
        ucc.add(StorageHandler(),   name: "storage")
        ucc.add(HapticsHandler(),   name: "haptics")
        ucc.add(AppReviewHandler(), name: "appReview")
        ucc.add(controlsHandler,    name: "controls")

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

    // MARK: - Storage helpers

    private let storageKeys = ["z_session", "z_lang", "z_music", "z_sfx"]

    private func migrateCapacitorStorage() {
        let prefix = "CapacitorStorage."
        for key in storageKeys {
            guard UserDefaults.standard.string(forKey: key) == nil,
                  let old = UserDefaults.standard.string(forKey: prefix + key) else { continue }
            UserDefaults.standard.set(old, forKey: key)
        }
    }

    private func injectNativeStorage(into config: WKWebViewConfiguration) {
        var dict: [String: String] = [:]
        for key in storageKeys {
            if let v = UserDefaults.standard.string(forKey: key) { dict[key] = v }
        }
        let json = (try? JSONSerialization.data(withJSONObject: dict))
            .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        config.userContentController.addUserScript(WKUserScript(
            source: "window.__nativeStorage = \(json);",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
    }

    // MARK: - Orientation / UI

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
}
