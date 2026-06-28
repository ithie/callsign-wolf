# SAR: Callsign WOLF — Changelog

## v28.7.2 — Rank System & Frigate Rework

### Added

- **Rang — jede Completion zählt** — `MissionProgress.count` zählt jeden Missionsabschluss einzeln (inkl. Wiederholungen). `_getRankMissions` summiert `count` statt nur unique Completions zu zählen.
- **Swift — Session-Migration** — `migrateSession()` in `ViewController.swift` ergänzt beim App-Start fehlende `count`-Felder in alten Saves (abgeleitet aus `completed`).

### Changed

- **Fregatte — Größe reduziert** — Rumpf von 24 auf 13 Einheiten Länge (x=-8.5 bis x=+4.5), Breite ±2.5 statt ±3.0. Landedeck (4.5×4.5) und Landing-Zone bleiben unverändert.
- **Fregatte — Geschützturm entfernt** — Bug-Part aus `frigate.zdef` entfernt.
- **simulation.ts — Fregatte Kollision** — Bounds-Check an neue Abmessungen angepasst (xMin -8.5, xMax +4.5, yMax ±2.5), Proximity-Radius 15 statt 20.

### Fixed

- **Crash — Null-Missions im Rank** — `_getRankMissions` und `encodeSession` crashten, wenn FreeFlight-Szenarien sparse gespeichert waren (Index 2 gespielt ohne 0/1 → JSON `[null, null, {...}]`). Guard `m?.completed` behebt den Fehler.

---

## v28.7.1 — Tutorial Improvements & Depth Sorting Fix

### Added

- **Tutorial — direction ghost knob** — Joystick highlight now shows an animated ghost knob that travels from centre toward the required direction, making the required gesture immediately clear.
- **Tutorial — background overlay** — Game world dims when a tutorial step is waiting for input; overlay fades as soon as the player starts interacting.
- **Tutorial — engine-off step** — New step between "Land" and "Refuel" instructs the player to stop the engine (left stick down again); controls are fully locked during the subsequent refuel wait.
- **Tutorial — i18n** — `TUT_ENGINE_STOP` added in German and English.

### Changed

- **Winch speed penalty** — extending the winch reduces helicopter acceleration by up to 22% at full extension; transition is smooth as the winch naturally extends/retracts gradually.

### Fixed

- **Depth sorting — carrier tower vs. deck vehicles** — Deck objects (tractors, crates, fuel car) are now queued inside the carrier's tower flush via `onBeforeFlush`, so they depth-sort correctly against the tower at all carrier angles.
- **Depth sorting — depthAnchor restored** — `depthAnchor` is now applied per node as the base depth for all faces in that node; fixes tower faces incorrectly claiming the carrier centre as their sort origin.
- **Depth sorting — per-face depth** — Each face is now queued individually with `baseDepth + faceIndex × 1e-7`, preserving face array order as a stable tiebreaker within a node.

---

## v28.7.0 — Frigate Operations & Stability

### Added

- **Frigate — heli carry mechanic** — helicopter now moves with the frigate when landed on deck; identical behaviour to the carrier.
- **Frigate — deck shadow** — helicopter casts a correct shadow on the frigate deck.
- **Mission editor — frigate as delivery target** — payloads can now be assigned `deliverTo: frigate`.
- **Mission editor — frigate as mission objective** — `land_at: frigate` available as a mission objective.
- **Mission editor — radio silence** — carrier and frigate can each be individually configured as radio-silent; silenced vessels transmit no voice callouts during gameplay.

### Fixed

- **Crash with old save data** — `getMissionsDone` could throw a `TypeError` when `campaignProgress` entries from older app versions lacked a `missions` array. Guards added at load time and at the call site.

---

## v28.6.0 — Research Platform & Visual Polish

### Added

- **Beach swimwear** — Person payloads with `"swimwear": true` in the mission data receive a random beach outfit: Badehose (skin-coloured shirt + coloured pants) or Badeanzug (one-piece, same colour for both). Assigned at world-init, stored on the payload object, not configurable in the campaign editor.

### Fixed

- **Research platform — heli depth rendering** — Platform was sorted with depth `rX + rY`, placing it in front of the helicopter on the landing pad (depth `rX + rY − 2.5`). Fixed by overriding platform sort depth to `rX + rY − 4`.
- **Research platform — double shadow** — Sea-level shadow and deck shadow were both visible simultaneously. Sea-level shadow is now suppressed when the heli is within 3 units of a platform; deck shadow (at `waterLevel + 6.5`) takes over.
- **Research platform — landing zone** — Landing zone in `research_platform.zdef` expanded to cover the full deck surface; previously only a fraction of the deck was detected, causing the helicopter to slowly sink through the platform when landing off-centre.
- **Night visibility — long vessels** — `_inNightConeRect` previously checked only 4 corner points. Extended to 9 points (4 corners + 4 edge midpoints + centre), fixing cases where a submarine or carrier was partially in the light cone but none of its corners were.

### Changed

- **Atlas helicopter — uniform body colour** — All orange/red face variants (`#dd5500`, `#ff7711`, `#cc4400`) unified to `#ff6600`, eliminating colour-bleed artefacts at face overlaps.
- **Atlas helicopter — face draw order** — Faces reordered back-to-front: bottom → sides → tail → nose → windows → pylons → tail roof → top. Top face drawn last ensures it always covers side and window faces in screen space.

---

## v28.5.3 — Campaign Completion & Exit Warnings

### Added

- **Vessel exit warnings** — Ships configured with `exitWarning: true` trigger a radio callout (`vessel-leaving-60`, `vessel-leaving-30`) when they are projected to leave the map within ~60 or ~30 seconds. Extrapolation supports both straight paths and circular sea patterns. Per-vessel name substitution via `{NAME}` placeholder.
- **Campaign editor — vessel name & exit warning** — New "Name" text field and "Exit Warning" checkbox in Carrier, Submarine, and Boat panels. Values are persisted in `.zcampaign` files.

### Fixed

- **Mission index after `onNext`** — `_selectedMissionIndex` was not updated when advancing to the next mission via the success screen. Caused wrong missions to restart and stale progress entries after the first completion.
- **"Spielstand löschen" reset** — Delete session now performs a full in-memory reset (name, campaign progress, rank override) without `window.location.reload()`. Previously the reload re-injected stale data from `WKUserScript` on iOS, leaving the session intact.
- **Rankup — helicopter area empty** — `Rankup.show` was passed the display label (e.g. `'DOLPHIN'`) instead of the heli type ID (`'dolphin'`). Canvas stayed blank because `drawHeli` looks up by ID.
- **Campaign completion — credits ran simultaneously with rank-up screen** — `CampaignEndScreen` and `Rankup` were both shown immediately. Rankup now shows first; credits start only after the player dismisses the rank-up overlay via the new `onDismiss` callback.

### Changed

- **Rank thresholds** — Major promoted from 30 → 20 cumulative missions, making the rank reachable with the current campaign lineup.
- **Session deleted message** — Text simplified to `GELÖSCHT.` / `DELETED.` (removed "Lade neu…" since no reload occurs).
- **Callsign Wolf campaign** — Mission data updated (manual adjustments).

---

## v28.5.2 — Terrain Rendering & Night Visibility

### Added

- **Particle emitter system** — World objects can now emit persistent smoke or fire. Each emitter spawns particles across 5 sub-points (centre + 4 cardinal offsets) for a natural spread. Particles are depth-sorted with the rest of the scene via `SceneRenderer`.
- **Wind-driven smoke trails** — Smoke and fire particles drift with the mission wind using exponential velocity convergence. Emitters use the unsheltered wind strength (`wind.rawStr`) so the trail is not affected by terrain shelter calculated for the helicopter. Older particles accumulate more drift, producing a realistic elongated downwind trail.
- **Campaign editor — particle emitter tab** — New "Ptcl" category in the context-menu tab bar; places smoke or fire emitters via double-click. Emitters can be dragged to reposition.
- **Campaign editor — tabbed sidebar** — Sidebar is now split into three tabs (Gelände / Objekte / Mission) with a sticky campaign header and mission list above.

### Changed

- **`src/game/sim/particles.ts` split into module folder** — Refactored into `particles/explosion.ts`, `particles/birds.ts`, `particles/emitters.ts`, und `particles/rotor.ts` mit Barrel `index.ts`. Alle bestehenden Import-Pfade funktionieren unverändert.
- **`dt` auf 30 fps normiert** — Partikel-Lifetime und Geschwindigkeit skalieren jetzt gegen die 30-fps-Ziel-Framerate.

### Fixed

- **Campaign editor — mission switching exception** — Switching missions threw when `windDir` or `windStr` were absent; guarded with `?? 0` defaults.
- **Terrain depth sort** — Tile batches are now filled in diagonal order (x+y ascending) instead of column-major order. Reduces depth-sort artefacts on steep mountain slopes significantly.
- **Night cone — vessel bounding box** — Carrier, boats, and submarines are now visible as soon as any corner of their bounding box enters the searchlight cone, not just when the cone hits their centre point.
- **Campaign editor — water level not persisted** — `m_water_level` input was missing from the change-listener list; changes are now saved and the map redraws immediately.

---

## v28.5.1 — Rotor Sound & UI Fixes

### Changed

- **Native rotor synthesis** — HeliSound runs entirely in Swift via `AVAudioSourceNode`. AM synthesis with clipped sawtooth carrier at the Nth harmonic (N=16, ~234 Hz for 4-blade helis); 80 ms spin-up smoothing; volume ramps down gracefully on engine-off instead of cutting abruptly.
- **SFX via Swift** — `playSfx` bridged to Swift `AVAudioPlayerNode` pool (4 voices). Typewriter and all other one-shot sound effects now route through `AVAudioEngine`; no more silent SFX on cold-start.
- **Music volume presets** — JS no longer passes a raw float volume. Instead it sends a context key (`'menu'` or `'game'`); Swift maps to 0.65 / 0.35. Eliminates the 3× loudness gap between main theme and in-mission music.
- **Control layout** — Winch rocker (up/down) and deliver toggle swapped sides; both buttons moved 12 px higher. Tutorial highlight/dim logic is position-independent and requires no change.

---

## v28.5.0 — Native Audio & Night Visibility (Revision 27)

### TestFlight Release Notes

**Revision 27** — What's new in this build:

- **Native audio engine** — Music now runs entirely in Swift via AVAudioEngine. No more audio dropouts or silent starts on iOS.
- **Lightning illuminates the landscape** — During storms at night, every lightning strike briefly lights up the entire terrain.
- **Night visibility** — All objects (trees, vehicles, buildings, ships, cargo) are only visible inside the searchlight cone. Everything flashes into view during lightning.

### Added

- **`ZsynthPlayer.swift`** — Full Swift port of the music synthesizer. Parses `.zsong` format natively, renders all drum and synth voices as PCM buffers via `AVAudioPlayerNode`, scheduled with Mach-time precision. Replaces Web Audio API on iOS entirely.
- **Lightning terrain illumination** — When lightning fires, all terrain tiles render in a brief dim panoramic palette instead of pure black, giving a realistic flash-of-the-landscape effect.
- **Night cone visibility for all world objects** — Trees, ZDEF structures (wind turbines, wrecks, lighthouses, hangars), vessels (boats, submarines, research platforms), carrier (hull, tractors, radar, windsock), NPC helicopters, fuel trucks, pad lights, attached deck payloads — all are now culled outside the searchlight cone at night. During lightning, everything is briefly visible.

### Changed

- **`ZsynthPlayer.ts` excluded from iOS app build** — The Web Audio player is replaced by a no-op stub in the `app` Vite target; the Swift engine handles all music on device.
- **`ViewController._appDidBecomeActive`** — Now calls `ZsynthPlayer.shared.resumeEngine()` instead of the old Web Audio resume JS injection.

---

## v28.4.1 — Localisation & Campaign Fixes

### Fixed

- **Helicopter stat labels localised** — speed, agility, capacity, and endurance labels in the helicopter detail overlay were hardcoded in German; now read from `I18N`.
- **Helicopter descriptions localised** — `description`, `selectCap`, and `selectSub` on all four helicopter types are now localised objects (`{ de, en }`); `localize()` applied at render time.
- **Loading screen "Ready" localised** — the final loading step text was hardcoded as `'Bereit.'`; now uses `I18N.LOADING_READY`.
- **Callsign Wolf missions 2, 3, 5 — spurious `land_at` objective removed** — "Night Flight", "Open Sea Transfer", and "Withdrawal" each carried a redundant `land_at: carrier` objective alongside `rescue_all`. Because objectives fire independently (OR), landing on the carrier without rescuing anyone was enough to complete the mission. Removed the `land_at` entries; `rescue_all` with `deliverTo: "carrier"` on each payload correctly enforces the full requirement.
- **Mission 1 briefing corrected** — text said "four survivors" but the mission has three persons and one crate (the black box); briefing updated in DE and EN to reflect this accurately.
- **Campaign editor: default tool on open is now Drag & Pan** — editor previously opened with the terrain brush active; now defaults to the move/pan tool.
- **Campaign editor: `deliverTo` dropdown in payload sidebar** — each person, crate, and rescuer entry in the sidebar now shows a destination dropdown (–, pad, carrier, submarine, boat), matching the map context menu. Pre-selects the current value correctly.

---

## v28.4.0 — FreeFlight Beach Mission & Editor Polish

### Added

- **FreeFlight: Beach Rescue (Level 3)** — new Baywatch-themed mission with shore terrain, sand layer, 9 swimmer payloads, two wrecked sailboats, SAR boat, pilot boat, five Baywatch cars, three towers, Baywatch HQ, and NPC lifeguard rescuers. Objective: rescue all.
- **`baywatch.zsong`** — new upbeat beach track (C major, 118 BPM, supersaw lead + bass + arp + pad) registered in `main.ts`; used as the in-game music for the Beach Rescue level.
- **Foliage brush: beach items** — beach umbrella, tilted umbrella, lounger, cooler, and beach person / swimmer added to the foliage tool in the campaign editor. A `beach_person` placed on water auto-renders as a swimmer. `CAMPAIGN_FORMAT.md` updated with all new foliage type chars (`u`, `v`, `l`, `c`, `g`).

### Changed

- **Rain density halved** — CSS rain overlay reduced from 23 to 12 lines per layer; less visual clutter on screen.
- **Legacy fields removed** — `goalPersons` and `goalCrates` were never read by the game engine; both fields removed from `freeFlight.zcampaign`.

### Fixed

- **Campaign editor: SAR boat selectable** — `sar_boat` was missing from the mousedown hit-detection array; clicking it now selects and opens its config panel.
- **Campaign editor: foliage brush broken** — `const type` was referenced before its declaration (TDZ), silently crashing every brush stroke. Declaration order corrected.
- **Campaign editor: tool radio buttons blocked panel refresh** — the `edRefreshPanel` focus guard incorrectly suppressed re-renders when a radio button was active; radio and checkbox inputs now excluded from the guard.
- **Campaign editor: NPC payload numbers hidden** — payloads with `npcTarget: true` no longer render a number label on the canvas.
- **ZSong editor: horizontal scrolling restored** — `overflow-x: hidden` on the editor body was suppressing horizontal scroll; removed.

---

## v28.3.7 — Baywatch Scene & Collision Refactor

### Added

- **SAR-Boot** (`sar_boat`) — neues Wasserfahrzeug; im Kampagnen-Editor platzierbar (Palette, Rendering, Vessel-UI, Mehrfachplatzierung + Shift-Click zum Entfernen). Im Spiel mit rotem Rumpf und weißem Aufbau gerendert; Kollisionsboxen in ZDef hinterlegt.

### Changed

- **Baywatch-Skalierungen** — Tower ×2.0, HQ ×2.0, Car ×0.85; Pilot-Boot und SAR-Boot jeweils ×0.7 (alle Werte inkl. Kollisionsboxen in ZDef übernommen).
- **Editor: keine Rotation für baywatch_hq / baywatch_tower** — Winkel-Input aus beiden Floating-UIs entfernt, analog zum Hangar.

### Fixed

- **Kollisions-Refaktor** — `collision.ts` las bisher alle Kollisionsboxen hardcodiert. `checkDef` / `drawDef` lesen jetzt zentral aus den ZDef-Dateien; kein einziger Zahlenwert mehr doppelt gepflegt. Ausnahmen bleiben hardcodiert: Carrier (deckZ-abhängig), Hangar/Pad-Tower, Fuel Truck (winkel­abhängiger Arm).
- **ZDef-Kollisionsboxen verfeinert** — `wind_turbine`: zwei dünne Pole (±0.12) durch `pole` (±0.3, 0–7.5) + `nacelle` (-0.6/1.2, 7.5–8.5) ersetzt. `lighthouse`: Tower-`zMax` 8 → 8.5 (war inkonsistent zwischen Draw und Check). `pilot_boat` / `sar_boat`: Einzelbox → `hull` (0–0.7) + `cabin` (0.7–1.4). `supply_vessel`: Einzelbox → `hull` + `superstructure`. `baywatch_tower`: Einzelbox → `base` (0–2.2) + `cabin` (2.2–3.9).
- **waterLevel-Offset für Sailboats und Salvage Tug** — beide Bootstypen hatten absolutes z=0 statt `waterLevel`-relativ; jetzt konsistent mit Pilot-Boot-Verhalten.
- **Baywatch-Kollision fehlte komplett** — `BAYWATCH_CARS` und `BAYWATCH_BUILDINGS` wurden in `collision.ts` nie iteriert; Objekte waren unzerstörbar.

---

## v28.3.6 — Audio Scheduler Hardening

### Fixed

- **ZSynth audio exception** — removed duplicate gain/filter scheduling block in `playSynth` (copy-paste artifact that caused `InvalidStateError` in the Web Audio API on certain transitions).
- **Zero-volume crash** — all `exponentialRampToValueAtTime` start values in `playSynth` and `playDrum` are now clamped to `0.0001`; a vol of 0 no longer produces a zero-to-zero exponential ramp that throws.
- **Unguarded scheduler loop** — each note scheduling call in `scheduler()` is now wrapped in a try/catch so a single bad note never breaks the entire playback loop.

---

## v28.3.5 — Campaign End Screen, Music System & Audio Fixes

### Added

- **Campaign End Screen** — cinematic credits roll with firework bursts, pulsing heart, and `destroid` soundtrack plays on first completion of any story campaign. Subsequent completions show the standard Campaign Complete screen.
- **Per-mission music** — missions now carry a `music` field; game reads `mission.music` with `clike` as fallback. Campaign-level music config removed entirely.
- **New mission tracks** — `coastal` (M1), `ignition` (M2), `offshore` (M3), `vigil` (M4) for Callsign Wolf; `thunderscene` for FreeFlight Carrier; `slowway` for Tutorial.
- **New instruments** — `clap` drum track (white noise + bandpass) and `synth4` added to ZSynth; music editor dropdown populated dynamically from `src/game/music/`.
- **AVAudioSession** — configured to `.playback` mode for more reliable audio on iOS; `visibilitychange` + `touchstart`/`click` listeners resume suspended AudioContext.

### Changed

- **Music keys** — `thunder_scene` → `thunderscene`, `carrier_ops` → `carrierops`, `anothermenu` → `success`. Removed `briefing`, `anothersound`. `musicConfig` object and `music-config.json` removed; all play calls use string literals directly.
- **Mission music volume** — 0.3 (down from 1.0).
- **Tutorial crash flow** — MissionFailedScreen still shows on crash, but "Return" navigates to campaign select instead of mission select.
- **Keyboard listeners** — `onkeydown`/`onkeyup` wrapped in `import.meta.env.DEV` guard; no keyboard input reaches `G.keys` in production builds.
- **CSS self-contained** — per-screen overlay styles moved out of `screens.css` into individual component CSS files; `nav-screens.css` introduced for shared nav screen base styles.
- **zsong Vite plugin** — `clap` and `synth4` added to `DRUM_IDS`/`TRACK_ORDER`; previously clap steps were silently dropped from production bundles.

### Fixed

- **Campaign editor buttons** — `edDispatch` and `edSetLang` exposed on `window` so inline `onclick` attributes work correctly.
- **ZSong tracker** — `clap` and `synth4` added to `DRUM_IDS`, `DRUM_LABEL`, and `TRACK_ORDER` in `zsong.ts`; editor now parses and displays all tracks correctly.

---

## v28.3.4 — Tutorial Payload Spawn Fix

### Fixed

- **Tutorial heli invisible after person pickup** — The tutorial person spawned at runtime via `_onSpawnPerson` was missing `vx`/`vy` initialisation. When the rescuer grabbed the person, payload physics produced NaN velocity on the heli, which propagated through `aero` into `G.heli.vAngle` and then `G.heli.angle` the first time the player steered. A NaN angle makes all vertex projections in `drawHeli` produce NaN canvas coordinates, silently rendering the heli and its shadow invisible for the remainder of the mission.

### Changed

- **`initPayloadEntry` extracted** (`world-init.ts`) — shared initialisation logic for payload entries (`vx`/`vy`, `npcTarget`, `attachTo`, `outfitColors` fallback). Used by both `initPayloadsFromMission` and runtime spawning.
- **`spawnPayload` added** (`world-init.ts`) — wraps `initPayloadEntry`, pushes to `G.payloads`, and optionally increments `G.goalCount` (`addToGoal` flag, default `true`). Use `false` when the payload is already counted in `goalCount` (e.g. was present in the mission JSON before being filtered).
- **`_maybeSpawnOrniWreck`** migrated to `spawnPayload`.

---

## v28.3.3 — Voice Line System & HUD Cleanup

### Added

- **Voice line system** — event-based architecture (`voice-events.ts`) with a typed event bus (`VoiceEvent`). The simulation emits abstract events; a decoupled UI subscriber (`ui/voice-line/`) maps them to blinking monospace text at the bottom of the screen (z-index 220, above crash screen). Placeholder beep SFX until audio sprite is ready.
- **Voice lines** — `LIFTOFF`, `WINCH DOWN`, `HAULING UP`, `PACKAGE SECURED`, `DELIVERED`, `NO DROP ZONE`, `DROP AT LANDING PAD`, `TOUCHDOWN`, `YOU'RE ON THE DECK`, `FUEL MAXED`, `WE'RE BINGO FUEL`, `HELI 1 DO YOU COPY`, `DECK CLEARED`.
- **Carrier proximity callout** — `DECK CLEARED` fires once per approach when the heli closes within 25 units of the carrier while airborne.

### Changed

- **Empty-tank crash** — fuel reaching zero now triggers a rapid descent (`vz` acceleration 9× higher than before). Any ground contact with an empty tank is a crash — no survivable landing. `vzAtImpact` is now captured before the ground clamp so the vertical speed at the moment of impact correctly drives the crash check.
- **`CABIN FULL` feedback** — replaced text message with a haptic error pulse (`NotificationType.Error`).

### Fixes

- **Vertical momentum on key release** — `vz` decay after releasing climb/descend now uses `0.80` per frame (half-life ~3 frames) instead of `friction²` (~69–173 frames). Heli stops climbing/sinking near-instantly when the pad is released.

### Removed

- **`showMsg` system removed entirely** — all in-game HUD text messages replaced by voice lines or made redundant by the permanent HUD display (`ALT`, `FUEL`, `PAX`, `SAVED`). The `#msg` DOM element, CSS rule, `showMsg()` function, and `PhysicsCtx.showMsg` are gone.
- **Dead I18N keys removed** — `OUT_OF_FUEL`, `MAX_ALTITUDE`, `CARGO_SECURED`, `PATIENT_SECURED`, `ONBOARD`, `CABIN_FULL`, `DELIVERED`, `DELIVERED_TO_ZONE`, `DELIVER_NO_ZONE`, `DROP_AT_PAD`, `SECURED` removed from both language blocks.
- **`I18N` import removed from `simulation.ts`** — simulation no longer touches localisation at all.

---

## v28.3.2 — Visibility Refactor, Controls Fixes & Performance

### Changed

- **Carrier/Pad visibility gating** — `drawWorldObjects` now computes `showCarrier` and `showPad` once as gate booleans; all sub-objects (bow wave, windsock, hangar, fuel truck, pad lights, NPC helis) inherit that visibility instead of each calling `isVisible` independently.
- **NPC heli visibility** — `parked ? showCarrier : isVisible(npc)` replaces the duplicated carrier/npc check; carrier half-length margin (+9) is automatically covered by the gate.
- **Default `isVisible` margin** — raised from 16 to 19 to cover the largest vessel radius without per-site workarounds.
- **`draw-world.ts` split** — extracted into `src/game/draws-world/` with one file per domain: `carrier`, `vessels`, `structures`, `payloads`, `collision` (incl. debug overlay), `misc`. Main file is now a thin compositor.
- **`createIsoFn` factory** — `render.ts` now exports `createIsoFn(config)` returning a pre-configured `IsoFn`; the manual 2-line wrapper in `game.ts` is gone and all remaining direct `iso(…, {config})` calls replaced.
- **Right joystick safe zones** — ±35° around the vertical axis: only accelerate/brake (no steering). ±35° around the horizontal axis: only steer (no acceleration). Diagonal zone: both simultaneously. Swift visual updated to show all four safe-zone sectors (N/S/E/W, 70° each).
- **Climb decay matches descent** — `vz` release decay now uses `friction²` in both directions; the previous `sqrt(friction)` for rising caused noticeable upward drift after releasing the climb key.
- **VEREINFACHT control mode removed** — only screen-relative (PROFI) steering remains. Heading-tick RAF loop, `CTRL_MODE` type, storage key `z_ctrl_mode`, settings toggle, and pause-overlay toggle all removed.
- **Controls IPC rate-limited to 30 fps** — a single `CADisplayLink` (30 fps, matches game loop) now drives all Swift→JS control updates and tutorial-pulse animation. Previously `evaluateJavaScript` was called on every `touchesMoved` event (up to 120 Hz on ProMotion), causing sustained HIGH energy impact and device heating.

### Fixes

- **Winch clamp ground-only** — winch length was clamped whenever a payload was hanging; now only triggers when `payload.z ≤ groundZ + 0.5`, preventing involuntary rope shortening mid-air.
- **Pad windsock margin** — missing `visMargin` argument in `isVisible` call restored.
- **Heli-select button fully tappable** — `GameControlOverlay.hitTest` override now includes the standard UIKit guards (`isHidden`, `isUserInteractionEnabled`, `alpha`). Without them, the overlay intercepted touches in joystick zones even when hidden, blocking the centre of the confirm button.
- **Controls overlay no longer blocks menus** — `ControlsHandler` previously wrapped state updates in `DispatchQueue.main.async`, adding a run-loop-cycle delay during which the overlay remained interactive. Now processed synchronously (WKScriptMessageHandler is already on the main thread).
- **Overlay non-interactive from startup** — `GameControlOverlay.init` sets `isUserInteractionEnabled = false`; `setVisible` toggles it in sync with `isHidden` as a second guard layer.

---

## v28.3.1 — Swift Controls Bugfixes & Physics Tweaks

### Fixes

- **Joystick safe-zone sectors corrected** — left stick showed 4 uniform sectors (full-circle fill, no contrast); now correctly renders 2 bright E/W strafe zones matching the original CSS conic-gradient. Right stick (PROFI) now shows N/S arcs only, not all 4 cardinal directions.
- **Deliver toggle rotation fixed** — was rotating in the Z-axis (2D plane rotation); now correctly simulates CSS `rotateX` via Y-scale so the rocker tilts top/bottom instead of spinning sideways.
- **Controls visibility regressions fixed** — `setTouchVisible` now sends the webkit message to the native overlay; all previously broken hide/show calls (`_stopMission`, mission screens, pause) work correctly again. Controls are shown exclusively via `setTouchVisible(true)` after briefing dismissal — no premature show during splash, menus, or pause.
- **Tutorial highlight/dim restored** — `_setHighlight` and `_setDim` now send `tutorialHighlight` / `tutorialDim` webkit messages; `GameControlOverlay` renders a pulsing white ring (1.4 s period matching original CSS) on the active control and dims inactive controls to 15 % opacity with touch-blocking.
- **Black bar on right side of screen** — `WKWebView.scrollView.contentInsetAdjustmentBehavior` set to `.never`; the home-indicator safe-area inset was offsetting the scroll view content, leaving a gap behind the canvas.
- **Carrier windsock position** — was placed at the tower centre (bow/stern axis was inverted); now correctly positioned at the stern on the port side. Also queued into `SceneRenderer` before flush so it depth-sorts properly with the ship.
- **Flat terrain landing crash** — `onFlatTerrain` was gated on `!inAir`, causing a crash in the z-window between `groundH+0.15` (inAir boundary) and `groundH+0.25` (crash-check boundary). Gate removed; engine-start on flat terrain still requires `!inAir`.
- **Capacitor artefacts removed** — `@capacitor/assets` removed from `package.json`; `capacitor.config.json`, `config.xml`, `capacitor-cordova-ios-plugins/` deleted from `ios/`; stale `config.xml` entry removed from `project.pbxproj`; dead `vi.mock('@capacitor/preferences')` removed from `session.spec.ts`; `SESSION_SYSTEM.md` and `INSTALL.md` updated.

### Changed

- **Vertical inertia** — `vz` decay now uses `sqrt(friction)` when rising (matches horizontal feel) and `friction` when sinking (half the lingering, prevents over-floating on descent).
- **Flat terrain landing enabled** — helicopter can now land and stand on any tile whose four corners are within 0.15 height of each other, without crashing. No refuelling, no drop-zone interactions.

---

## v28.3.0 — Native Touch Controls (Swift)

### Changed

- **Touch controls moved to Swift** — joysticks, pitch wheel, and deliver toggle are now rendered and tracked natively in `GameControlOverlay.swift` (Core Graphics + UIKit) on top of the WKWebView. The HTML/CSS touch-controls overlay is removed entirely.
- **No more WKWebView JS pause on touch-hold** — since Swift owns all game-control touches, the WKWebView gesture-recognition pipeline no longer pauses the JS thread. Fixes rotor-freeze and any similar input stutter on iPad.
- Controls overlay is hidden during menus and shown only during active gameplay via `window.webkit.messageHandlers.controls`.

### Technical

- `GameControlOverlay.swift`: full Core Graphics joystick rendering, multi-touch tracking, heading-mode RAF tick remains in JS reading Swift-supplied stick values via `window.__nativeControls(...)`.
- `touch-controls.ts` reduced to two thin functions (`setDeliverToggle`, `setRightStickProfi`) that forward state to Swift via message handler.
- `touch-controls.css` deleted.
- `storage.spec.ts` rewritten for the new native-bridge storage API.

---

## v28.2.0 — Remove Capacitor

### Technical

- **Capacitor removed** — replaced with a bare `WKWebView` in `ViewController.swift`. No Capacitor framework, no internal HTTP server, no SPM dependencies on `ionic-team/capacitor-swift-pm`.
- **Native storage bridge** — `UserDefaults` read/write via `window.webkit.messageHandlers.storage`. Values are injected into `window.__nativeStorage` at document start so reads are synchronous, writes are fire-and-forget.
- **Native haptics bridge** — `UIImpactFeedbackGenerator` / `UINotificationFeedbackGenerator` via `window.webkit.messageHandlers.haptics`.
- **Native AppReview bridge** — `SKStoreReviewController.requestReview` via `window.webkit.messageHandlers.appReview`.
- **Capacitor Preferences migration** — on first launch, existing save data stored under `CapacitorStorage.*` keys is automatically migrated to direct `UserDefaults` keys.
- `@capacitor/core`, `@capacitor/ios`, `@capacitor/haptics`, `@capacitor/preferences`, `@capacitor/cli` removed from `package.json`. `@capacitor/assets` kept for icon/splash generation.
- `build:ios` no longer runs `cap sync` — copies `dist/index.html` directly. `cap:open` replaced with `open:ios`.
- `capacitor.config.ts` deleted.

---

## v28.1.1 — Carrier Windsock, Shadow Fixes & Cleanup

### New

- **Carrier windsock** — windsock added at the carrier tower. Displays apparent wind (real wind minus carrier velocity vector), which is the correct reference for helicopter approach.

### Fixes

- **Player heli shadow missing on carrier deck** — shadow was rendered in the pre-pass before the carrier deck, which then covered it. Shadow is now drawn after the deck in the same pass as NPC heli shadows.
- **Player heli shadow missing on research platform** — same rendering-order fix applied for the research platform deck (`waterLevel + 6.5`).
- **Object pop-in on touch devices (especially iPad)** — `isVisible` used a broken coordinate formula for touch (`cam.x / tileW + cam.y / tileH`) that mixed world units with tile pixel sizes, causing objects to be culled too early. Now compares directly in world coordinates. More pronounced on iPad due to larger `tileW` (28 vs 20).

### Technical

- Removed legacy `_IS_APP` guards — `haptics.ts`, `reviewRequest.ts`, `game.ts`, and `render-config.ts` no longer branch on `VITE_TARGET`. Desktop render scale and fallback tile sizes removed; app values are now the only values.
- Removed dead CSS — `#audio-mute`, `#easter-egg`, `.grid-container`, `.grid-box`, `.mini-canvas` and related rules removed from `base.css` and `screens.css`.
- `build:app` script removed — logic inlined into `build:ios` (`VITE_TARGET=app vite build && npx cap sync ios`).
- Documentation updated — `INSTALL.md`, `RELEASE.md`, and `README.md` reflect current build commands and clarify that `npm run build` produces the promo page, not the game.

---

## v28.1.0 — Controls, UI & Winch Fixes

### Changed

- **Right stick (PROFI mode): combined steering + acceleration** — replaced hard sector lock with independent per-axis thresholds (35 % of radius). Full diagonal input fires both simultaneously; small deflections along one axis do not activate the other. Matches keyboard feel where Forward + Left can be held at the same time.
- **Mission briefing panel narrower and vertically centered** — `max-width` reduced from 700 px to 520 px; `align-items: center` replaces `flex-end` so the text box expands symmetrically from its vertical midpoint as content grows.
- **Hangar overlay: new column proportions** — ratio changed to 38 % | 30 % | 32 % (was 33/33/33); heli canvas scale reduced from 2.2× to 1.7× to prevent clipping; stats column gets `box-sizing: border-box` and `padding-right: env(safe-area-inset-right)` for Dynamic Island in landscape.

### Fixes

- **Game canvas visible after mission end** — `drawScene` continued rendering after `updatePhysics()` even when a physics callback (`missionComplete` / `triggerCrash`) had set `gameStarted = false` mid-frame. Added a guard immediately after `updatePhysics` to abort the render pass in that case. Also fixes the same artifact on crash.
- **Winch rope freezes in place (free winch)** — `rescuerSwing` was not updated when `winch` was between 0.1 and 0.3 (physics dead zone), causing the rope to stay at a fixed world position while the helicopter moved. Dead zone closed: snap-to-heli now applies for `winch ≤ 0.3` instead of only `winch ≤ 0.1`.
- **Winch rope too long with person attached** — rope draw guard only checked 2D distance (x/y). Transient z discrepancies (e.g. immediately after pickup) could still produce an oversized rope. Guard extended to full 3D distance (`Math.hypot(dx, dy, dz)`).

---

## v28.0.0 — Render Performance Overhaul & Dead Code Removal

### Performance

- **Zero-allocation SceneRenderer** — `SceneRenderer.flush()` no longer allocates any objects on the hot path. Face arrays, world vertex arrays and projected-point objects are all eliminated: faces are computed inline at flush time, and `iso()` writes into a pre-allocated scratch buffer (`_scratchPts[16]`) via an `out?` parameter. `Math.cos`/`Math.sin` are computed once per instance instead of once per vertex. For a typical scene with ~50 objects and 200+ faces this removes hundreds of short-lived allocations per frame, reducing GC pressure on iOS.
- **Pooled `_Instance` objects** — SceneRenderer maintains a fixed pool of 512 `_Instance` slots that are reused every frame. `add()` takes the next free slot from the pool; `flush()` resets `_poolNext = 0`. No instance objects are allocated during gameplay.
- **Pre-allocated tree entry cache** — `rebuildEntryCache()` is called once after terrain initialisation and builds a stable `{ x, y, depth, drawFn }` entry object per tree, stored on the tree as `t._entry`. `drawTrees` calls `sceneAdd(null, t._entry)` with zero per-frame allocation — no closure, no object literal.
- **`iso()` scratch output parameter** — `render.ts iso()` accepts an optional `out?: { x: number; y: number }` parameter. When provided, it writes into the existing object instead of returning a new one. Used by SceneRenderer's flush loop.

### Changed

- **Trees depth-sorted with scene objects** — trees are now added to SceneRenderer inside `drawWorldObjects` via a `queueFoliage` callback, called just before the final flush. Previously `drawTrees` ran _after_ `flush()`, meaning trees always painted on top of the helicopter regardless of depth. Trees are now correctly occluded when the heli flies below them.
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

- **VS Code Extension: SAR Tools** — custom editors for `.zcampaign`, `.zsong`, `.zdef` and `.zsound` files, replacing the old Electron-based workbench. Live preview reloads automatically when source files change.
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
