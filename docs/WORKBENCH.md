# Zeewolf SAR Tools — VS Code Extension

The old Electron-based workbench has been replaced by a VS Code extension. Install it once; all editors open directly inside VS Code as custom editor panels.

---

## Setup

```sh
cd vscode-ext
npm run deploy
```

This builds the extension and installs it into the local VS Code instance. After installation, reload the window (`Cmd+Shift+P` → **Developer: Reload Window**).

To rebuild and reinstall after changes:

```sh
npm run deploy
```

---

## Editors

The extension registers custom editors for four file types. Opening a matching file in VS Code automatically opens the corresponding editor.

| File extension | Editor | Description |
| --- | --- | --- |
| `*.zcampaign` | Campaign Editor | Paint terrain, place objects, configure missions |
| `*.zsong` | ZSong Editor | Step-sequencer tracker for in-game music |
| `*.zdef` | ZDEF Editor | Isometric geometry editor (vertices, faces, colors) |
| `*.zsound` | Sound Lab | Synthesizer parameter editor |

---

## Campaign Editor

Opens when you click a `*.zcampaign` file. Provides:

- Terrain painter (tile types, foliage, water)
- Object placement (carriers, boats, submarines, pads, rescue zones, wind zones)
- Mission-level fields: title, objectives, music selection
- Campaign-level fields: title, sublines, briefing/in-game music

A **preview button** (`$(open-preview)`) in the editor title bar opens a live isometric preview of the current mission alongside the editor.

The preview connects to the running Vite dev server (`localhost:5173` by default). The port is configurable via **Settings → Zeewolf SAR Tools → Dev Server Port**.

---

## ZSong Editor

Opens when you click a `*.zsong` file. Provides:

- 3 drum tracks (Kick, Snare, Hi-Hat) with toggle pads per step
- 3 synth tracks with per-step note selection
- Per-track controls: instrument preset, waveform, filter, attack, release, detune
- Global BPM control
- ▶ / ■ live preview buttons

Changes are saved directly to the file on disk.

---

## ZDEF Editor

Opens when you click a `*.zdef` file. Provides:

- Isometric canvas with the current model rendered
- Add / select / move / delete vertices and faces
- Per-face controls: fill color, stroke color, normal for backface culling
- Saves directly to the `.zdef` file

---

## Sound Lab

Opens when you click a `*.zsound` file. Synthesizer parameter editor for sound effect design.

---

## UI Preview

Any `*.ui.ts` file gains a preview button (`$(symbol-color)`) in the editor title bar. Clicking it opens a Webview panel that renders the component in isolation — no dev server required.

The extension auto-starts an esbuild watcher when it activates. The preview panel reloads automatically whenever the bundle changes.

See [UI.md](./UI.md) for component documentation.

---

## Extension source

```text
vscode-ext/
  src/
    extension.ts          Entry point, registers all providers
    campaign-editor.ts    Campaign editor WebviewPanel
    zsong-editor.ts       ZSong editor WebviewPanel
    zdef-editor.ts        ZDEF editor WebviewPanel
    zsound-editor.ts      Sound Lab WebviewPanel
    ui-preview-provider.ts  UI component preview WebviewPanel
  editor-view/            Campaign editor renderer (bundled separately)
  tracker-view/           ZSong/ZDEF/Sound Lab renderers (bundled separately)
  esbuild.mjs             Build script (bundles all views + extension host)
  package.json
```

Build output goes to `vscode-ext/dist/`. The `.vsix` package is produced by `npm run package`.
