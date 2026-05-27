# UI Architecture

All game UI is built from plain DOM modules. There is no framework — components are TypeScript modules that write directly into pre-existing `<div>` containers in `index.html`.

---

## File naming

| Pattern | Purpose |
| --- | --- |
| `*.ui.ts` | A UI component (screen or overlay). The VS Code preview button is scoped to these files. |
| `*.state.ts` | Isolated UI state shared between a component and its callers. Lives next to the component. |
| `*.css` | Styles for one component. Imported directly by the `*.ui.ts` file. |
| `*.spec.ts` | Unit tests, co-located next to the file under test. |

---

## Component API

Each component exports exactly `mount`, `show`, and `hide`.

```ts
export const mount = (): void => { ... };  // once, during app init
export const show = (): void => { ... };   // at runtime
export const hide = (): void => { ... };   // at runtime
```

`mount` is called once from `main.ts` during startup. Components never mount themselves from outside — `index.html` contains the empty container `<div>`, the module writes into it.

---

## Full-screen overlays

Every full-screen overlay must have the CSS class `.ui-screen`. This class is defined in `src/game/ui/base.css` and handles `position`, `inset`, `z-index`, `display`, and `overflow`. Never redefine these per component.

```ts
const el = ensureEl('pause-overlay');
el.classList.add('ui-screen');
```

---

## State modules

Global state that multiple UI components or game modules read is extracted into a `*.state.ts` file:

```
src/game/ui/pause-overlay/
  pause-overlay.ui.ts
  pause-overlay.state.ts   ← exported reactive state
  pause-overlay.css
```

The component imports its own state module. Game code imports it too and writes to it before calling `show*`.

---

## Events

UI → game communication uses `CustomEvent` dispatched on `window`:

```ts
window.dispatchEvent(new CustomEvent('ui:abort'));
window.dispatchEvent(new CustomEvent('ui:pause'));
```

Game code registers listeners in `main.ts`. This removes all callback dependencies from `show*` signatures.

---

## Screen navigation

Full-screen transitions go through `src/game/ui/nav.ts`:

```ts
showScreen('campaign-select');       // instant
showScreenCrtEnter('main-menu');     // with CRT-on effect
```

Each screen has a string ID that matches its container `<div id="...">` in `index.html`.

---

## Component list

| Component | Container ID | Description |
| --- | --- | --- |
| `briefing.ui.ts` | `briefing-overlay` | Pre-mission briefing |
| `campaign-select.ui.ts` | `campaign-select-screen` | Campaign picker |
| `cookie-banner.ui.ts` | `cookie-banner` | Consent / privacy banner |
| `credits-screen.ui.ts` | `credits-screen` | End credits |
| `heli-select.ui.ts` | `heli-select-screen` | Helicopter selection with 3D preview |
| `legal-screen.ui.ts` | `legal-screen` | Privacy policy / imprint |
| `loading-screen.ui.ts` | `loading-screen` | Startup loader |
| `main-menu.ui.ts` | `main-menu-screen` | Main menu |
| `mission-select.ui.ts` | `mission-select-screen` | Mission picker |
| `pause-overlay.ui.ts` | `pause-overlay` | In-game pause |
| `rankup.ui.ts` | `rankup-overlay` | Rank-up overlay with animated heli model |
| `settings.ui.ts` | `settings-screen` | Settings (controls, audio, language) |
| `touch-controls.ui.ts` | `touch-controls` | On-screen joysticks (app only) |
| `whats-new.ui.ts` | `whats-new-overlay` | What's New screen (web only) |

---

## VS Code preview

Open any `*.ui.ts` file in VS Code and click the `$(symbol-color)` button in the editor title bar. The extension bundles the component on the fly via esbuild and renders it in a Webview panel. The panel reloads automatically when the bundle changes.

See [VSCODE_EXT.md](./VSCODE_EXT.md) for setup.
