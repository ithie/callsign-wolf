# SAR Tools — VS Code Extension

Custom-Editors für die Projektdateien von SAR: Callsign WOLF (`.zcampaign`, `.zdef`, `.zsong`, `.zsound`).

## Inhaltsverzeichnis

- [Tools & File-Extensions](#tools--file-extensions)
- [Build & Deploy](#build--deploy)
- [Verzeichnisstruktur](#verzeichnisstruktur)
- [Campaign-Preview-Architektur](#campaign-preview-architektur)
- [Campaign-Editor-Architektur](#campaign-editor-architektur)
- [ZDEF Model-Editor-Architektur](#zdef-model-editor-architektur)

---

## Tools & File-Extensions

| Dateiendung | Editor | Beschreibung |
|---|---|---|
| `.zcampaign` | **Campaign Editor** | Visueller Kampagnen-Editor mit isometrischer Karten-Preview, Mission-Settings (Regen, Wind, Zeit), Payload-/Objekt-/Foliage-Listen und Sequenz-Editor |
| `.zdef` | **ZDEF Editor** | 3D-Modell-Editor mit 4-Ansicht-Canvas (isometrisch), Face-/Vertex-Editing, Kontext-Menü, Kollisionsboxen, Rescue-Zones, Landing-Zones, Fragment-System, Gitter-Werkzeuge und Wireframe-Modus |
| `.zsong` | **ZSong Editor** | Musik-Sequenzer für das interne ZSong-Format |
| `.zsound` | **Sound Lab** | Sound-Design-Werkzeug für `.zsound`-Synthesizer-Presets |

### Commands (Editor-Toolbar)

| Command | Erscheint bei | Beschreibung |
|---|---|---|
| **Open Campaign Preview** (`$(open-preview)`) | `.zcampaign` | Öffnet eine Live-Karten-Preview neben dem Campaign-Editor (verbindet sich mit dem Vite-Devserver auf Port 5173) |
| **Open RAW JSON** (`$(json)`) | `.zdef` | Öffnet die rohe JSON-Datei der aktuell bearbeiteten `.zdef` neben dem Editor |
| **Open UI Preview** (`$(symbol-color)`) | `*.ui.ts` | Öffnet eine isolierte Vorschau für UI-Komponenten |

### Extension-Settings

| Setting | Default | Beschreibung |
|---|---|---|
| `zw.devServerPort` | `5173` | Port des Vite-Devservers für die Campaign-Preview |

---

## Build & Deploy

```bash
npm run deploy   # build + vsce package + code --install-extension
npm run build    # nur bauen (kein install)
npm run watch    # watch-Modus
```

Nach `deploy`: **Reload Window** in VS Code.

---

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
    ├── modeleditor.html          ← ZDEF Model-Editor (HTML + CSS; JS kommt aus zdef.js)
    └── ui-preview.html           ← UI-Komponenten-Preview
```

---

## Campaign-Preview-Architektur

### Separater Dev-Einstiegspunkt

Die Campaign-Preview lädt **nicht** dieselbe `index.html` wie das Spiel, sondern `index-campaign-preview.html` (Projekt-Root). Diese HTML-Datei lädt `src/game/main-campaign-preview.ts` statt `game.ts`.

**Warum?** `main.ts` importiert Kampagnen statisch. Neue Kampagnen würden manuell eingetragen und könnten vergessen werden. `main-campaign-preview.ts` umgeht das komplett:

```
VS Code öffnet .zcampaign
  → "Open Campaign Preview" → http://localhost:5173/index-campaign-preview.html?preview=<key>
    → main-campaign-preview.ts (Top-Level-await):
        1. fetch('/src/game/campaigns/<key>.zcampaign') — Vite serviert Raw-JSON im Dev-Modus
        2. campaignHandler._replaceCampaigns([fetchedCampaign])
        3. Modul fertig → window.onload feuert → _onloadPreview() → getCampaignByKey() findet die Kampagne
    → game.ts läuft normal, aber mit der dynamisch geladenen Kampagne
```

**Schlüsselprinzip — Top-Level await blockiert window.onload:**
`<script type="module">` mit `await` hält den Browser auf — `window.onload` feuert erst, wenn das Modul vollständig evaluiert ist. So sind die Kampagnendaten garantiert verfügbar, bevor `_onloadPreview()` → `getCampaignByKey()` aufgerufen wird.

**Wo was geändert werden muss:**
- Neue Kampagne zur Release → `src/game/main.ts` (statische Imports + Array)
- Kampagne previews testen → einfach die `.zcampaign`-Datei öffnen und "Open Campaign Preview" klicken — `main.ts` bleibt unberührt

### Betriebsvoraussetzung

`npm run dev` muss laufen (Vite Dev-Server auf Port 5173 oder `zw.devServerPort`). Der Campaign-Preview öffnet sich als Simple Browser in VS Code.

---

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

---

## ZDEF Model-Editor-Architektur

### Zwei Dateien, eine Funktion

Der Model-Editor besteht aus zwei unterschiedlichen Dateien, die **beide gepflegt werden müssen**:

| Datei | Zweck | Wird genutzt von |
|---|---|---|
| `media/modeleditor.html` | HTML-Struktur + CSS + Dev-Inline-Script | Extension Host (HTML-Gerüst) + Vite-Devserver (Vorschau) |
| `editor-view-entry/zdef-main.ts` → `media/zdef.js` | Gesamte JS-Logik als kompiliertes Bundle | Extension Host (Laufzeit) |

### KRITISCH: Das Inline-Script wird zur Laufzeit gestripped

`zdef-editor.ts` (Extension Host) lädt `modeleditor.html`, **entfernt den `<script type="module">`-Block vollständig** und injiziert stattdessen `zdef.js`:

```typescript
// zdef-editor.ts, resolveCustomEditor()
const stripped = raw.replace(/<script\s+type="module"[\s\S]*?<\/script>/, '');
panel.webview.html = stripped.replace('</body>', `<script src="${scriptUri}"></script>\n</body>`);
```

**Konsequenz:** Alle JS-Änderungen am Editor **müssen in `zdef-main.ts` gemacht werden**, nicht im Inline-Script von `modeleditor.html`. Das Inline-Script dient ausschließlich als Vite-Dev-Vorschau (mit `import`-Statements für `/src/game/...`).

Änderungen nur in `modeleditor.html`'s Inline-Script haben **keinerlei Effekt** auf die installierte Extension.

### HTML-Struktur und JS-Bundle müssen synchron bleiben

Da `zdef-editor.ts` die HTML-Struktur aus `modeleditor.html` übernimmt und das JS-Bundle (`zdef.js`) darauf zugreift, müssen beide immer zueinander passen:

- DOM-Elemente hinzufügen/entfernen → HTML in `modeleditor.html` UND Referenzen in `zdef-main.ts` anpassen
- Neue Features implementieren → nur in `zdef-main.ts`
- CSS-Änderungen → nur in `modeleditor.html`

### Kommunikation (Load-Flow)

```
1. Extension Host lädt .zdef-Datei
2. zdef-editor.ts baut HTML (stripped + zdef.js injiziert)
3. zdef.js startet → sendet: vscode.postMessage({ type: 'ready' })
4. Extension Host empfängt 'ready' → sendet: postMessage({ type: 'load', content })
5. zdef.js empfängt 'load' → ruft fromJSON(content) auf → Modell wird geladen
6. Auf Änderung: zdef.js → vscode.postMessage({ type: 'change', content: toJSON() })
```

### Nach Änderungen

Immer `npm run deploy` aus `vscode-ext/` ausführen und **Reload Window** in VS Code.
