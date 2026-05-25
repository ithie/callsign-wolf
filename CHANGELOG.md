# SAR: Callsign WOLF — Changelog

## v28.0.0 — Render Performance Overhaul & Dead Code Removal

### Performance

- **Zero-allocation SceneRenderer** — `SceneRenderer.flush()` no longer allocates any objects on the hot path. Face arrays, world vertex arrays and projected-point objects are all eliminated: faces are computed inline at flush time, and `iso()` writes into a pre-allocated scratch buffer (`_scratchPts[16]`) via an `out?` parameter. `Math.cos`/`Math.sin` are computed once per instance instead of once per vertex. For a typical scene with ~50 objects and 200+ faces this removes hundreds of short-lived allocations per frame, reducing GC pressure on iOS.
- **Pooled `_Instance` objects** — SceneRenderer maintains a fixed pool of 512 `_Instance` slots that are reused every frame. `add()` takes the next free slot from the pool; `flush()` resets `_poolNext = 0`. No instance objects are allocated during gameplay.
- **Pre-allocated tree entry cache** — `rebuildEntryCache()` is called once after terrain initialisation and builds a stable `{ x, y, depth, drawFn }` entry object per tree, stored on the tree as `t._entry`. `drawTrees` calls `sceneAdd(null, t._entry)` with zero per-frame allocation — no closure, no object literal.
- **`iso()` scratch output parameter** — `render.ts iso()` accepts an optional `out?: { x: number; y: number }` parameter. When provided, it writes into the existing object instead of returning a new one. Used by SceneRenderer's flush loop.

### Changed

- **Trees depth-sorted with scene objects** — trees are now added to SceneRenderer inside `drawWorldObjects` via a `queueFoliage` callback, called just before the final flush. Previously `drawTrees` ran *after* `flush()`, meaning trees always painted on top of the helicopter regardless of depth. Trees are now correctly occluded when the heli flies below them.
- **Minimap: Ziel-Objekte blau, Rettungsziele rot** — PAD, Carrier and Submarine dots are now blue; persons are red (`#ff3333`), crates orange-red (`#ff7755`); other NPC vessels (boats) are gray (`#888`).
- **Minimap: Sichtkegel** — a semi-transparent triangle is drawn on a dedicated overlay canvas each frame, originating from the heli dot and pointing in the heli's current flight direction. Helps testers orient themselves on the map at a glance.

### Removed

- **Party mode** — web-app-only feature; the iOS build never used it. All `partyMode`/`partyPalette`/`getPartyMode`/`isApp` parameters removed from `drawTree`, `createFoliage`, `drawTerrain`, `PhysicsCtx`. Confetti particle blocks and `SoundPartytime` removed. ~200 lines of dead code gone.
- **`debugCollision` / `debugAltitude`** — both debug visualisation paths removed from `SceneRenderer` interface and implementation. Every frame previously branched on these flags even in production builds.
- **Glider Easter Egg** — the `launchEasterEgg` hook and SOARING i18n keys removed. `glider.def` is kept.

### Fixes

- **SceneRenderer crash on iOS (lighthouse)** — scratch point buffer was sized to 16; the lighthouse base cap is a 32-gon. `_scratchPts[16+]` was `undefined`, causing a hard crash on first scene render. Buffer increased to 64.
- **Right stick stays stuck** — `pointerup`/`pointercancel` are occasionally swallowed by iOS when a touch is interrupted by a system gesture or notification. Added `lostpointercapture` listener to all input elements (left stick, right stick, pitch wheel, touch buttons); this event fires unconditionally whenever pointer capture is released for any reason.
- **Pinch-to-zoom / loupe in WKWebView** — the native WebKit gesture recognizer can fire before web pointer events, bypassing `touch-action: none`. Fixed by intercepting `gesturestart` and `gesturechange` (Safari-specific events) with `preventDefault()`, and blocking multi-touch `touchmove` at the document level.

### Technical

- `IsoFn` type updated: `(wx, wy, wz, camX, camY, out?) => { x: number; y: number }`.
- `SceneRenderer.debugCollision` and `SceneRenderer.debugAltitude` removed from public interface; update call sites accordingly.
- `MinimapData.heli` now requires `angle: number` for the vision cone.
- `foliage.ts` exports `rebuildEntryCache`; call after `initFoliageFromMission`.

---

## v27.0.0 — UI Architecture Overhaul & VS Code Tooling

### New

- **VS Code Extension: Zeewolf SAR Tools** — custom editors for `.zcampaign`, `.zsong`, `.zdef` and `.zsound` files, replacing the old Electron-based workbench. Live preview reloads automatically when source files change.
- **Per-component UI preview** — each UI screen can be previewed individually in VS Code via the `$(symbol-color)` button on any `*.ui.ts` file. No dev server required; bundled on-the-fly via esbuild.
- **Rankup overlay: rotating helicopter model** — the "rank up" screen now shows the newly unlocked helicopter as an animated 3D isometric model with spinning rotors instead of just displaying the name.

### Changed

- **UI component naming convention** — all UI component files renamed to `*.ui.ts` to distinguish them from state modules and helpers. VS Code preview is scoped to `*.ui.ts` files only.
- **Test layout** — unit tests moved next to their source files as `*.spec.ts`. Only integration tests remain in `src/tests/`.
- **`render-config.ts` simplified** — `_isMobile` removed entirely. The web build is desktop-only; the native app is always `_isApp`. All tile/scale values now branch on `_isApp` / `_isIPad` directly.

### Technical

- Campaign files renamed from `.json` to `.zcampaign`; loaded via the new `zcampaignPlugin` in vite.
- `vitest.config.ts` updated to `include: ['src/**/*.spec.ts']`.
- 🪦 R.I.P. `_isMobile` — du wirst nicht vermisst.

---

## v26.6.0 — Bug Fixes & Rendering Polish

### Fixes

- **Fuel truck collision** — truck was parking inside the helicopter because the Bezier path endpoint was set to the heli center. The path now ends `STOP_DIST` before the heli center; the final approach targets that stopping position, so the truck body no longer overlaps the heli.
- **Fuel truck abort on engine start** — if the player started the engine while the fuel truck was still en route, the truck continued navigating into the (now lifting) heli. The truck now immediately reverses to its parking spot the moment `engineOn` becomes true, at the correct progress position along its path (no teleport).
- **Carrier fuel car frame lag** — `updateCarrierFuelCar` ran before `updateCarrierPos`, so the car's world position was computed from the previous frame's carrier position. Moving it after the carrier position update eliminates the 1-frame sliding artefact on a turning/moving carrier.
- **Music starts mid-track** — `ZsynthPlayer` initialised `nextNoteTime = 0` for every new track. The scheduler's while-loop then caught up from time 0 to `audioContext.currentTime`, advancing `currentStep` through hundreds of steps before playing the first note. The track now starts at `currentTime + 0.05`.
- **UI freeze before explosion** — the same `nextNoteTime = 0` bug caused the scheduler to create hundreds of Web Audio nodes synchronously on the main thread when the defeat music started, freezing the screen for several seconds before the explosion animation appeared. Fixed by the same `currentTime + 0.05` initialisation.

### Changed

- **PAD position lights** — lights now participate in the scene depth sort (rendered via `SceneRenderer.add` before `flush`) instead of being drawn directly to canvas after the flush. Lights no longer bleed through the fuel truck.
- **Carrier position lights** — same depth-sort fix. Additionally, lights are now placed exactly at the visual hull edge (ZDEF `±8.7 / ±4.2`) instead of the physics bounds, where they previously floated outside the hull.
- **Heli spawn position on carrier** — heli now spawns on the open deck, clear of the tower/superstructure.
- **Music starts in main menu** — music no longer begins on the splash screen click. The first note plays when the main menu appears.
- **No music restart on menu re-entry** — navigating back to the main menu (e.g. after a mission) no longer interrupts the music if the correct track is already playing.

---

## v26.5.1 — Bow Waves, Ornithopter Wreck & Polish

### New

- **Bow waves** — all moving vessels (carrier, boats, submarines) now produce animated Kelvin wake patterns. Wave crests propagate backward in proportion to vessel speed. Carrier wake uses a hull offset and wider crest spacing; boats and submarines use tighter patterns appropriate to their size.
- **Ornithopter wreck split model** — the wreck is now two separate models: `ornithopter_wreck_residue` (scorch, stump, detached wing, glass shards) stays at the crash site permanently; `ornithopter_wreck_carry` (fuselage, intact wing, cockpit frame) hangs from the winch hook during transport.
- **`PAYLOAD_DEFS`** — payload physics properties (`baseMass`) extracted into `payload-defs.ts`; physics reads from the table instead of inline ternaries. Documented in `CAMPAIGN_FORMAT.md`.

### Changed

- **Intro sequence** — CRT collapse effect removed from the i.thie softworks and logo interstitials. Backgrounds are now transparent so the particle effect shows through. The i.thie text ends with a brightness flash instead.
- **Rescue handling improvements** — several edge cases in pickup/dropoff resolution fixed.
- **Night mode shadows** — shadows were missing in night mode; restored.

### Fixes

- **Bow wave speed bug** — `G.CARRIER.speed` stored the physics angular velocity (~0.0004 rad/tick), causing `armLen` to always fall below the 0.5 visibility threshold. Fixed by storing `speedKnots` (raw JSON value) on each vessel during `initVessel`.
- **Bow wave animation rate** — previously scaled by `√speed`, causing slow vessels to animate disproportionately fast. Now strictly linear with speed.

### Technical

- `initVessel` stores `vessel.speedKnots` for all vessel types; used by the renderer for wake animation.
- `ornithopter_wreck.zdef` removed; replaced by `ornithopter_wreck_carry.zdef` + `ornithopter_wreck_residue.zdef`.
- `src/game/payload-defs.ts` — new file; `physics.ts` imports `PAYLOAD_DEFS` from it.
- zdef plugin performance optimisation.
- Minimap rendering updated.

---

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
- Custom music: *Stayin' Alive*-inspired ZSynth track
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
