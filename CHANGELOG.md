# SAR: Callsign WOLF — Changelog

## v26.5.0 — Callsign Wolf Demo Campaign & Editor Overhaul

### New

- **Demo campaign: Callsign Wolf** — 5-mission story campaign now available in-game; missions 4 & 5 (»Überflutetes Atoll«, »Rückzug«) expanded to 500×500 grid with centered atoll geography
- **New scene objects: Plane Wreck & Broken Sailboat** — two new static decorative objects with full 3D isometric models (`.zdef`); placeable in the mission editor
    - Plane wreck: Cessna-style crash with yellow fuselage, red accents, snapped propeller blade, asymmetric wing damage, scorch marks
    - Broken sailboat: intact hull with mast stump, fallen mast bar, and collapsed sail on deck
- **Persons snap to broken sailboat** — persons placed near a broken sailboat in the editor auto-attach to its deck (`waterLevel + 0.35`); position is preserved at runtime
- **Persons half-submerged in water** — persons in water are now rendered with a canvas clip at the waterline; legs are hidden below the surface
- **`waterLevel` in mission editor** — the virtual water level (🌊) is now editable in the mission settings panel
- **Wind turbine: optional rotation** — each wind turbine now has an individual `spinning` flag; only rotating turbines animate the rotor each frame. Configurable per-object in the editor
- **Windsock is wind-aware** — at `windStr = 0` the sock hangs straight down and is static; intensity of flutter and extension scale linearly with wind strength (0–10)

### Editor

- **Plane wreck & broken sailboat** — rendered on the editor map (top-down): scorch ellipse + fuselage + wings for the wreck; hull + fallen mast line for the broken sailboat. Both respect the `angle` property
- **Pilot boat & salvage tug added to tool palette** — were missing from `ED_TOOLS`; now placeable with full path/angle/speed/radius editing via the boat panel
- **Pilot boat & salvage tug rotation fixed** — `syncVesselFromUI` guard was comparing `obj.type !== 'boat'`, causing angle/path changes to be silently dropped for both vessel types
- **Wind turbine panel** — selecting a wind turbine now opens a floating panel with a »Rotiert« checkbox
- **Research platform & wind turbine** — both were missing from the editor tool palette; added
- **Preview auto-restart on crash** — crashing in the editor preview no longer shows the campaign-failed screen; after the explosion the mission restarts automatically from the start position
- **Briefing fixed in preview** — `mountBriefing()` was not called in the preview startup path, causing a null-reference error when a mission with a briefing was previewed

### Fixes

- **Object pop-in** — `isVisible()` margin for all static objects (research platform, wind turbines, plane wrecks, broken sailboats) was hardcoded to small values (4–15 tiles). Now computed dynamically from `canvas.width / tileW` and `canvas.height / tileH` — objects appear as soon as they enter the visible tile area
- **Render performance: static objects** — `drawResearchPlatform()`, `drawWindTurbine()`, `drawPlaneWreck()`, and `drawBrokenSailboat()` were each calling `SceneRenderer.flush()` directly, forcing a premature depth-sort pass per object. All four now only call `add()`; the shared flush at the end of the frame handles depth sorting correctly
- **Gray winch line at mission start** — `G.rescuerSwing` was initialised to `{x:0, y:0}` (world origin), causing a line to be drawn from the helicopter to the map corner. Fixed by initialising `rescuerSwing` to the heli's actual start position
- **Winch line visible when retracted** — the winch rope was drawn even when `heli.winch = 0`. Added a `> 0.05` threshold guard

### Technical

- `MissionObject` union extended with `PlaneWreckObject` and `SailboatBrokenObject` types
- `MissionPayload.attachTo.objectType` union extended with `'sailboat_broken'`
- `WindTurbineObject`: new optional `spinning?: boolean` field
- `G.BROKEN_SAILBOATS` now stores `_objIdx` for `attachTo` resolution at runtime
- `initPayloadsFromMission`: `sailboat_broken` case sets `pz = waterLevel + 0.35` directly, bypassing `getGround` (which has no knowledge of static vessel objects)

---

## v25.3.4 — Campaign Progression & Fixes

### Changed

- **Tutorial gate**: Free-Flight and regular campaigns are now locked until the tutorial campaign is fully completed. Cross-device imported saves (via save code) are unaffected.
- **Mission complete**: canvas is now cleared immediately when a mission is won — the game world no longer shows behind the success screen.
- **Screen scroll reset**: all UI screens scroll back to the top when navigated to.

---

## v25.3.3 — Privacy & Mobile Performance

### New

- **Privacy banner reworked**: consent model under Art.&nbsp;6 para.&nbsp;1 lit.&nbsp;a GDPR — **ACCEPT** stores data persistently in localStorage, **DECLINE** plays fully without persistence (no reload, no data loss). New **REVOKE & DELETE** button appears only when existing data is present. Banner is bilingual (DE/EN).
- **`declineCookies()`**: new decline path — clears any existing localStorage data, sets `cookieConsent = false`, starts the game in pure in-memory mode.

### Fix

- **FPS counter on touch devices**: counter now always visible (not only when `showCollisionBoxes` is set) — simplifies performance diagnostics on iOS/iPad.
- **Back button duplication fixed**: `mountCreditsScreen` was appending an additional button on every language change — guard prevents double-mount.

### Technical

- **`createBackButton(onClick)`**: centralized back button as a standalone component (`src/game/ui/back-button/back-button.ts`) with scoped CSS. All UI screens use the component; no button IDs required.
- **Mobile performance**: 30 FPS cap on touch devices (`requestAnimationFrame` skip) — physics remains dt-coupled with no quality loss. Rain drops reduced to 40. `MOBILE_ZOOM_OUT` adjusted to 0.8.

---

## v25.3.2 — iOS-Vorbereitungen & TypeScript 6

### Technical

- **TypeScript 6.0.3**: upgraded from 5.9.3 — zero breaking changes in this codebase
- **`tsconfig.json`**: removed deprecated `baseUrl`; `paths` entry changed to `"./src/*"` (TS6 requires explicit relative paths without `baseUrl`)
- **`src/workbench/tsconfig.json`**: switched to `module: ES2022` + `moduleResolution: bundler` + `noEmit: true`; removed `outDir` — reflects that esbuild handles compilation, tsc handles type-checking only
- **`build.mjs`**: added comment explaining the esbuild/tsc split and why the Electron dist build step is required
- **`deploy.yml`**: release is no longer triggered on every push to `main`; deploy now runs on version tag push (`v*`) or manual `workflow_dispatch` — enables safe pushes without accidental releases
- **`package.json`**: added `"build:app"` script (`VITE_TARGET=app vite build`)
- **iOS: rubber-band prevention**: `html` and `body` set to `position: fixed; overflow: hidden; touch-action: none; width/height: 100%`
- **iOS: first-paint timing**: `window.onload` body wrapped in `requestAnimationFrame` — JS init defers until after first paint
- **iOS: resize handling**: `window.onresize` replaced with `window.addEventListener('resize', …)` — more robust for orientation changes
- **iOS: safe area**: `viewport-fit=cover` added; `env(safe-area-inset-*)` applied to touch controls, mute button, easter egg, and `.ui-screen` padding
- **iOS: AudioContext**: `ZsynthPlayer.play()` now calls `ctx.resume()` when context is suspended — required on iOS where AudioContext starts suspended before first user gesture
- **iOS: canvas**: `#gameCanvas { background: #050505; display: block }` — prevents white flash on WKWebView load
- **iOS: touch callout**: `-webkit-touch-callout: none` added — suppresses iOS long-press context menu
- **Scroll bug fix**: `justify-content: safe center` on all full-screen overlay containers — previously content above the flex center point was unreachable after scrolling down
- **`.ui-screen`**: `touch-action: pan-y` added — restores touch scroll on overlay screens despite `touch-action: none` on `body`

---

## v25.3.1 — App-Build-Trennung

### Technical

- **`VITE_TARGET=app` build target**: single-file HTML bundle without WebRTC/multiplayer and What's New overlay — suitable for iOS App Store distribution via WKWebView
- **`src/game/mp-game.ts`**: all multiplayer game logic (`toMpLobby`, `_mpReturnToLobby`, `_setupMpChannels`, `startMpGame`, `_mpTriggerCrash`, `_mpMissionComplete`, `_mpTimeOut`) extracted from `game.ts` into a dedicated module; wired via `initMpGame(deps)` factory
- **`src/game/mp-game-stub.ts`**: no-op replacement for `mp-game.ts` in app builds — all exports are `undefined` or `() => {}`
- **`src/game/ui/whats-new/whats-new-stub.ts`**: no-op replacement for `whats-new.ts` in app builds
- **No runtime `if`-guards**: build-specific exclusions are handled entirely by Vite module aliases — `game.ts` contains no `IS_APP` checks; the multiplayer button is absent because `toMpLobby` is `undefined` from the stub, not because of a conditional
- **`injectAppCsp` plugin**: `Content-Security-Policy` header injected into `index.html` automatically for app builds

---

## v25.3 — SAR: Callsign WOLF

### New

- **Neuer Name**: Das Spiel heißt jetzt **SAR: Callsign WOLF**
- **Standard-Rufzeichen WOLF**: Briefing und Ranganzeige zeigen `WOLF` als Callsign bis ein eigenes gesetzt wird
- **Ladescreen**: Neuer Ladescreen vor jedem Missionstart mit Fortschrittsbalken (Gelände → Objekte → Umgebung)

### Technical

- **Full `src/` consolidation**: all source now lives under a single `src/` root — `workbench/` moved to `src/workbench/`, `tests/` to `src/tests/`, `src/styles/` to `src/game/styles/`, mission editor to `src/workbench/renderer/editor/`, ZSynth tracker UI to `src/workbench/renderer/tracker/`
- **ZSynth library decoupled from tracker UI**: `ZsynthPlayer` and tracker types moved to `src/shared/` — importable by game and workbench without pulling in the tracker UI
- **`.ui-screen` shared CSS base class**: all full-screen overlays now share a common base (scrollable, mobile `webkit-overflow-scrolling`, `box-sizing`, responsive padding) — applied via `classList.add('ui-screen')` at mount time
- **`ensureEl` extracted to `src/game/ui/dom-helpers.ts`**: removed 10 duplicate private copies across UI modules
- **`@/` import alias wired up**: `resolve.alias: { '@': 'src/' }` added to `vite.config.ts` — works across all tools under `src/workbench/`
- **`zdefPlugin` added to `vitest.config.ts`**: `.zdef` imports now resolve correctly in tests
- **`HANGAR_DEF` / `LIGHTHOUSE_DEF` exported from `defs.ts`**: required by tests and editor
- **New: `def-utils.test.ts`**: unit tests for Rodrigues rotation math (`applyParts` / `applyRotateNodes`) — covers 90°/180° rotation, pivot offsets, identity, filtering, and alias equivalence
- **New: `ui-screens.test.ts`**: DOM snapshot tests for all 11 UI screens (jsdom, `vi.mock` for heavy deps)
- **Workbench Tests tab fixed**: `suite.testFilePath` → `suite.name` (Vitest JSON reporter field rename)
- **Electron 41.2.2**: confirmed compatible; no code changes required

---

## v24.1 — SPA Pages, Mobile Fixes, Loop Correctness

### Technical

- **Cookie banner & What's New as virtual SPA pages**: both screens are now full-page, scrollable, and responsive — no more z-index overlays. Sequence: cookie banner (if needed) → What's New (if needed) → splash. Splash is hidden until all pre-screens are dismissed.
- **Result screens fully opaque**: crash, mission success, win, campaign complete, campaign failed screens no longer show the game canvas in the background (removed `rgba` transparency).
- **Game loop stopped on result screens**: `cancelAnimationFrame` is now called when any result screen appears. Loop restarts only when the next mission launches.
- **Mobile: zoom-out**: canvas renders at ~1.54× logical resolution and is CSS-scaled down — more of the world is visible on small screens.
- **Mobile: terrain culling fixed at altitude**: visible tile range is now derived from the camera position (iso inverse), not the heli's tile coordinates. Fixes black edges when flying high with the camera snapped to the heli.
- **`isVisible` culling**: same camera-derived logic on mobile; desktop retains heli-tile-based culling (unchanged behaviour).
- **Commander SVG**: explicit `width: 186px` on the SVG element — fixes invisible commander on iOS (WebKit `width:auto` in flexbox bug).
- **`game-state.ts` removed**: `G` and `GameState` merged into `state.ts` alongside `zstate`. No separate file needed.
- **`settings-rankup/` renamed to `settings/`**: module directory reflects actual scope.

---

## v23.3 — Mobile Controls (Hotfix 2)

### Fixes

- Fixed crash on load in production build: `briefing-commander-img` was accessed at module level before DOM was ready, preventing session saves from ever executing
- All DOM access now guarded by `assertDom()` inside `window.onload`
- Cookie banner consent callback (`notifyConsent`) now correctly triggers What's New overlay after consent

### New

- **Heading-based touch controls**: the right joystick now uses world-space steering on mobile — point the stick in any direction and the helicopter rotates toward it and accelerates accordingly; pulling back brakes
- Left joystick (throttle/altitude) unchanged

---

## v23.2.1 — Internal Housekeeping

### Technical

- Extracted all screen-specific CSS into co-located CSS files per module
- Responsive rules moved into their respective CSS files; `responsive.css` removed
- All UI screens extracted from `index.html` into standalone modules mounted at runtime: briefing (`ui/briefing/`), settings + rank-up (`ui/settings/`), campaign select, heli select, and all mission result screens
- Cookie banner, credits, heli-info, heli-select each organised into their own subdirectory
- All remaining hardcoded UI strings moved to `i18n.ts` (`CLICK_TO_DEPLOY`, `BACK`, `RETRY`, `RETURN_TO_BASE`, `TERMINATED`, `MISSION_COMPLETE`, `CAMPAIGN_COMPLETE`, `CAMPAIGN_FAILED`, and more)
- `onclick=` attributes removed from HTML; all handlers now use `addEventListener`
- Global `window` exposure reduced: `dismissBriefing`, `fromSettings`, `dismissRankUp`, `applySaveCode`, `deleteSessionData`, `confirmDeleteSession` removed

---

## v23.2 — Data Deletion

### New

- **Delete save state**: Settings screen now includes a "SPIELSTAND LÖSCHEN" button with a two-step confirmation; deletes all localStorage data and reloads the page
- **Revoke & delete in cookie banner**: Cookie banner now includes a "WIDERRUFEN & LÖSCHEN" button for explicit, direct withdrawal of consent and deletion of stored data — no longer requires navigating browser settings
- Cookie banner withdrawal text updated to reference the in-app button instead of browser storage

### Technical

- New i18n strings: `DELETE_SESSION`, `DELETE_CONFIRM`, `SESSION_DELETED`
- `deleteSessionData()` / `confirmDeleteSession()` exposed on `window`
- Full TypeScript compliance: all ~210 previously unreported type errors resolved (implicit `any` parameters, DOM null assertions, CSS string types, missing `Mission` interface fields)

---

## v23.1 — Privacy Fixes

### Fixes

- **Cookie consent**: declining now clears localStorage immediately
- **Consent expiry**: banner re-appears after 2 weeks (TTL stored as timestamp)
- **Cookie banner**: no longer click-through; responsive on small screens
- **Tutorial unlock**: completing the tutorial now correctly unlocks the next campaign
- Party mode now resets correctly on all mission-end paths (was missing failure/abort)

---

## v23 — Party & Progression

### New

#### Session System

- **Cookie consent banner** (GDPR-compliant) on first visit
- Persistent save state via `localStorage` (rank, callsign, progress)
- **Military ranks** (German Air Force): Leutnant → Oberleutnant → Hauptmann → Major
- Promotion overlay when rank increases
- Campaigns unlock sequentially; Tutorial is always available
- **Settings** screen in the main menu: callsign (max. 8 chars, A–Z) + rank display

#### Save Code

- 9-character code (`XXXXX-XXXX`) for cross-device save transfer
- Base32 encoding (RFC 4648), case-insensitive, no backend required
- Contains: rank, highest unlocked campaign, callsign
- Importing via the Settings screen overwrites the existing save state

#### Easter Eggs

- **PARTY**: Type in-game → Party mode (disco tiles, confetti, disco ball, John Travolta rescuer, BeeGees-inspired song)
- **UNLOCK**: Type anywhere → all campaigns unlocked immediately

#### Party Mode (details)

- Tiles flash in random colours, each tile independently
- Confetti particles from rotors and trees (wind-affected)
- Rotating disco ball
- Rescuer wears a white suit (John Travolta / Night Fever)
- Trees and bushes flash in random greens, colour waves upward per height layer
- Helipad stays grey
- Custom music: _Stayin' Alive_-inspired ZSynth track
- Resets on mission end (success or failure)

#### Bo-105 Model

- New model available as a preset in the Model Editor
- All models from the `models/` directory added as Model Editor presets

### Fixes

- **Ground sliding**: helicopter no longer drifts after landing
- **Cargo physics**: excessive pendulum drag at low framerates (dt scaling) corrected
- Party mode now correctly resets on mission failure / abort as well

### Technical

- All player-facing UI strings centralised in `src/game/i18n.ts`
- New module `src/game/session.ts` for session logic and save code encoding
- Global window type declarations in `src/game/window.d.ts`
- App version injected from `package.json` via Vite `define`; splash screen reads version dynamically
- Documentation: [`docs/SESSION_SYSTEM.md`](./docs/SESSION_SYSTEM.md)
