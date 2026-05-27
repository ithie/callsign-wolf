# iOS Build — Capacitor

## Voraussetzungen

-   Node.js ≥ 18
-   Xcode (App Store) mit Command Line Tools (`xcode-select --install`)
-   Apple Developer Account (für Signing + Device-Tests)

## Einmaliges Setup

Bereits erledigt — liegt im Repo:

| Was              | Wo                                                       |
| ---------------- | -------------------------------------------------------- |
| Capacitor-Config | `capacitor.config.ts`                                    |
| Xcode-Projekt    | `ios/App/App.xcworkspace`                                |
| Icons & Splash   | `ios/App/App/Assets.xcassets/`                           |
| Quell-Assets     | `resources/icon.png` (1024×1024), `resources/splash.png` |

## Normaler Build-Workflow

```bash
npm install                  # Abhängigkeiten installieren
npm run build:ios            # App bauen + in Xcode-Projekt synchronisieren
npm run cap:open             # Xcode öffnen
```

In Xcode: Signing-Team auswählen → Run (⌘R) oder Archivieren.

## Assets neu generieren

Nur nötig wenn `resources/icon.png` oder `resources/splash.png` geändert wurden:

```bash
npx @capacitor/assets generate --ios
```

## Konfigurierte iOS-Einstellungen

| Einstellung       | Wert                          |
| ----------------- | ----------------------------- |
| App-ID            | `io.github.ithie`             |
| Orientierung      | Landscape only                |
| Vollbild          | `UIRequiresFullScreen = true` |
| Status Bar        | versteckt                     |
| Scheme / Hostname | `app` / `localhost`           |
| Scroll            | deaktiviert                   |

```bash
npm run build:ios
```
