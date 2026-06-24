# SAR Tools — VS Code Extension

Custom-Editors für die Projektdateien von SAR: Callsign WOLF (`.zcampaign`, `.zdef`, `.zsong`, `.zsound`).

## Build & Deploy

```bash
npm run deploy   # build + vsce package + code --install-extension
npm run build    # nur bauen (kein install)
npm run watch    # watch-Modus
```

Nach `deploy`: **Reload Window** in VS Code.

## Verzeichnisstruktur

```
vscode-ext/
├── src/                          ← Extension Host (Node.js, CJS)
│   ├── extension.ts              ← Aktivierungspunkt, registriert alle Provider
│   ├── campaign-editor.ts        ← Custom Editor Provider für .zcampaign
│   ├── zdef-editor.ts            ← Custom Editor Provider für .zdef
│   ├── zsong-editor.ts           ← Custom Editor Provider für .zsong
│   ├── zsound-editor.ts          ← Custom Editor Provider für .zsound
│   └── ui-preview-provider.ts    ← WebView-Provider für UI-Previews
│
├── editor-view/                  ← Campaign-Editor-Logik (Browser, IIFE)
│   ├── ui.ts                     ← Daten-Bridge: syncToData, loadMission, notifyWorkbench
│   ├── render.ts                 ← Canvas-Karten-Rendering (isometrisch)
│   ├── state.ts                  ← Editor-State (campaign[], curIdx, tool, …)
│   └── render-utils.ts           ← Isometrische Hilfs-Utilities
│
├── editor-view-entry/            ← esbuild-Einstiegspunkte (je ein Bundle)
│   ├── campaign-editor-main.ts   → media/campaign-editor.js
│   ├── campaign-main.ts          → media/campaign.js
│   ├── main.ts                   → media/tracker.js
│   ├── zdef-main.ts              → media/zdef.js
│   └── zsound-main.ts            → media/zsound.js
│
└── media/                        ← WebView-Assets (werden in VSIX eingebettet)
    ├── campaign-editor.html      ← Haupt-UI des Campaign-Editors
    ├── modeleditor.html          ← ZDEF Model-Editor
    └── ui-preview.html           ← UI-Komponenten-Preview
```

## Campaign-Editor-Architektur

### Rendering

Die **sichtbare Sidebar** wird vollständig als HTML-String in `campaign-editor.html` gerendert (Template-Strings, kein virtuelles DOM). Jede Änderung löst ein `notifyWorkbench()` aus, das den Parent-Frame benachrichtigt — dieser rendert die gesamte Sidebar neu.

```
Benutzeraktion → edDispatch('event-name', data)
  → switch/case in campaign-editor.html
  → Daten im state-Objekt mutieren
  → ed.notifyWorkbench()
  → Extension Host re-rendert Sidebar
```

### Daten-Bridge (`#editor-state`)

Ein verstecktes `<div hidden id="editor-state">` enthält klassische Form-Elemente (inputs, textareas, selects) für Missionsfelder wie Headline, Regen, Wind usw. `syncToData()` liest diese Felder und schreibt sie in `state`. Das ist die Brücke zwischen dem HTML-Panel und dem Daten-Modell.

Payload-/Objekt-/Foliage-Listen werden **nicht** über DOM-Elemente synchronisiert — nur direkt über `edDispatch`.

### Kommunikation

- **WebView → Extension Host**: `ed.notifyWorkbench()` → `window.parent.postMessage({type: 'editor-state-changed'})`
- **Preview-Fenster**: `BroadcastChannel('editor-preview')` mit `{type: 'mission-update', mission}`
- **Extension Host → WebView**: `panel.webview.postMessage({type: 'load', ...})`
