# iOS Build

## Prerequisites

- Node.js ≥ 18
- Xcode (App Store) with Command Line Tools (`xcode-select --install`)
- Apple Developer Account (for signing + device tests)

## One-time setup

Already done — lives in the repo:

| What             | Where                                                    |
| ---------------- | -------------------------------------------------------- |
| Xcode project    | `ios/App/App.xcworkspace`                                |
| Icons & Splash   | `ios/App/App/Assets.xcassets/`                           |
| Source assets    | `resources/icon.png` (1024×1024), `resources/splash.png` |

## Normal build workflow

```bash
npm install              # install dependencies
npm run build:ios        # build game + copy to Xcode project
npm run open:ios         # open Xcode
```

In Xcode: select signing team → Run (⌘R) or Archive.

## Regenerate icons / splash

Only needed when icons or splash images change. Update directly in Xcode via `ios/App/App/Assets.xcassets/`.

## iOS settings

| Setting           | Value                         |
| ----------------- | ----------------------------- |
| App ID            | `io.github.ithie`             |
| Orientation       | Landscape only                |
| Full screen       | `UIRequiresFullScreen = true` |
| Status bar        | hidden                        |

## Architecture

The app is a bare `WKWebView` loading `ios/App/App/public/index.html` (the Vite build artefact) directly from the bundle. No Capacitor, no HTTP server.

Native bridges (all in `ViewController.swift`):

| JS handler                        | Swift side                         |
| --------------------------------- | ---------------------------------- |
| `webkit.messageHandlers.storage`  | Reads/writes `UserDefaults`        |
| `webkit.messageHandlers.haptics`  | `UIImpactFeedbackGenerator`        |
| `webkit.messageHandlers.appReview`| `SKStoreReviewController`          |

Storage values are injected into `window.__nativeStorage` before the page loads. Existing saves from previous builds (stored under `CapacitorStorage.*` keys) are migrated automatically on first launch.
