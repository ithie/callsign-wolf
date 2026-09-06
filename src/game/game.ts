import '@/ui/base.css';
import '@/ui/screens.css';
import { ensureEl } from '@/ui/dom-helpers';
import { createIsoFn } from './render';
import { campaignHandler, soundHandler, zinit } from './main';
import { loadSession, saveSession, STORAGE_KEY, UNLOCK_KEY } from './session';
import { initAppStorage, storageGet, storageSet } from './storage';
import { G, zstate } from './state';
import { initHeliSound, stopHeliSound, setSfxEnabled, isSfxEnabled, updateHeliSound } from './heli-sound';
import { createDrawWorld } from './draws-world/draw-world';
import { createSceneRenderer } from './scene-renderer';
import { HELI_TYPES } from './heli-types';
import { getGround, initGrid } from './sim/terrain';
import { spawnExplosion } from './sim/particles';
import { updatePhysics } from './sim/simulation';
import { mountVoiceLine } from './ui/voice-line/voice-line';
import { createDrawObjects } from './draw-objects';
import { createFoliage } from './foliage';
import { updateNpcHelis } from './sim/npc-helis';
import { createDrawTerrain } from './draw-terrain';
import { tileW as _tileW, tileH as _tileH, stepH as _stepH, gameRenderScale } from './render-config';
const tileW = Math.round(_tileW * gameRenderScale);
const tileH = Math.round(_tileH * gameRenderScale);
const stepH = _stepH * gameRenderScale;
import { decompressHelis } from './model-loader';
import * as CreditsScreen from './ui/credits-screen/credits-screen';
import * as LegalScreen from './ui/legal-screen/legal-screen';
import { startMenuParticles } from './ui/menu-particles/menu-particles';
import * as HeliSelect from './ui/heli-select/heli-select';
import { LANG_PREF_KEY, onLanguageChange, setLanguage } from './i18n';
import * as Briefing from './ui/briefing/briefing';
import * as Settings from './ui/settings/settings';
import * as Rankup from './ui/rankup/rankup';
import * as PauseOverlay from './ui/pause-overlay/pause-overlay';
import * as MainMenu from './ui/main-menu/main-menu';
import * as MissionSelect from './ui/mission-select/mission-select';
import * as CampaignSelect from './ui/campaign-select/campaign-select';
import * as CampaignCompleteScreen from './ui/campaign-complete-screen/campaign-complete-screen';
import * as CampaignEndScreen from './ui/campaign-end-screen/campaign-end-screen';
import * as Paywall from './ui/paywall/paywall';
import { showScreen } from './ui/nav';
import { mountMinimap } from './ui/minimap/minimap';
import { createHud } from './ui/hud/hud';
import {
    tutorialTick,
    isTutorialRunning,
    getAllowedKeys,
    notifyTutorialInput,
} from './ui/tutorial/tutorial';
import { VESSEL, PAYLOAD, CAMPAIGN_TYPE } from '../shared/types';
import { isMac } from './platform';

import * as Flow from './game-flow';
import { initInputHandlers } from './game-input';
import { createPhysicsCtx } from './game-physics-ctx';

// ─── DOM guard ────────────────────────────────────────────────────────────────
const assertDom = () => {
    if (!document.getElementById('gameCanvas')) {
        throw new Error('[z] Missing DOM element: gameCanvas');
    }
};

// ─── Canvas + renderer ────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const isoFn = createIsoFn({ canvas, tileW, tileH, stepH });
const _hud = createHud({ isoFn, canvas });
const SceneRenderer = createSceneRenderer(ctx, isoFn);
const { drawTree, drawPerson, drawTractor, drawFuelTruck, drawHeli } = createDrawObjects(
    ctx,
    isoFn,
    tileW,
    tileH,
    SceneRenderer
);

const hasCarrier = () => Flow.missionHasCarrier;
const hasPad = () => Flow.missionHasPad;
const isVisible = (objX: number, objY: number, margin = 19) => {
    const viewCX = zstate.cam.x / tileW + zstate.cam.y / tileH;
    const viewCY = zstate.cam.y / tileH - zstate.cam.x / tileW;
    return Math.abs(objX - viewCX) < margin && Math.abs(objY - viewCY) < margin;
};

const _drawWorldFns = createDrawWorld({
    ctx,
    canvas,
    isoFn,
    SceneRenderer,
    tileW,
    tileH,
    stepH,
    drawFns: { drawTree, drawPerson, drawTractor, drawFuelTruck, drawHeli } as any,
    hasCarrier,
    hasPad,
    isVisible,
    getLighthouse: () => (Flow.missionHasLighthouse ? { x: Flow.lighthouseX, y: Flow.lighthouseY } : null),
    getWindStr: () => Flow.missionWindStr,
    isNight: () => Flow.missionNight,
    isMissionRain: () => Flow.missionRain,
    getShowCollisionBoxes: () => showCollisionBoxes,
    triggerCrash: () => Flow.triggerCrash(),
});
const {
    drawWorldObjects,
    drawBirds,
    drawDebris,
    drawPayloadObjects,
    renderRain,
    renderSnow,
    drawDebugOverlay,
    handleCollisionBoxes,
} = _drawWorldFns;

const { drawTrees, rebuildEntryCache } = createFoliage({
    canvas,
    tileW,
    tileH,
    drawTree,
    sceneAdd: (def, opts) => SceneRenderer.add(def, opts),
    isNight: () => Flow.missionNight,
});

HeliSelect.init(G, drawHeli);
Rankup.init(() => Flow.session.playerName || 'WOLF');

const _isPadTile = (x: number, y: number): boolean =>
    hasPad() && x >= G.PAD.xMin && x <= G.PAD.xMax && y >= G.PAD.yMin && y <= G.PAD.yMax;
const _isServiceTile = (x: number, y: number): boolean =>
    hasPad() && x >= G.PAD.xMin && x <= G.PAD.xMax && y >= G.PAD.yMin - 3 && y < G.PAD.yMin;

const { drawTerrain, precomputeDayColors } = createDrawTerrain({
    ctx,
    canvas,
    tileW,
    tileH,
    stepH,
    getTerrain: () => campaignHandler.getTerrain(),
    isPadTile: _isPadTile,
    isServiceTile: _isServiceTile,
});

// ─── Shared RAF handle ────────────────────────────────────────────────────────
// Both game.ts (drawScene) and game-flow.ts (launchMission/stopMission) manipulate this.
const _rafRef = { id: 0 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const setTouchVisible = (v: boolean) => {
    window.webkit?.messageHandlers?.controls?.postMessage({ type: 'showControls', visible: v });
    const touchEl = document.getElementById('touch-controls');
    if (touchEl) touchEl.style.display = v ? 'flex' : 'none';
};

const _CRASH_KEY = '_lastCrash';

const _showDebugError = (msg: string) => {
    try { localStorage.setItem(_CRASH_KEY, msg); } catch { /* storage unavailable */ }
    const stored = msg === 'Script error.' ? (() => { try { return localStorage.getItem(_CRASH_KEY); } catch { return null; } })() : null;
    const display = stored && stored !== 'Script error.' ? stored : msg;
    const session = (window as any).__nativeStorage?.z_session ?? localStorage.getItem?.('z_session') ?? '(nicht lesbar)';
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#900;color:#fff;font:14px monospace;padding:20px;z-index:99999;overflow:auto;white-space:pre-wrap';
    el.textContent = 'Something went wrong. Please take a screenshot of this screen and send it to the developer.\n\nERROR:\n' + display + '\n\nSESSION:\n' + session;
    document.body.appendChild(el);
};

window.addEventListener('unhandledrejection', e => {
    const msg = e.reason instanceof Error ? (e.reason.stack ?? e.reason.message) : String(e.reason);
    try { localStorage.setItem(_CRASH_KEY, msg); } catch { /* storage unavailable */ }
    _showDebugError(msg);
}, { capture: true });
window.addEventListener('error', e => {
    const detail = e.error?.stack ?? (e.filename ? `${e.message}\n${e.filename}:${e.lineno}:${e.colno}` : e.message);
    try { localStorage.setItem(_CRASH_KEY, detail); } catch { /* storage unavailable */ }
    _showDebugError(detail);
}, { capture: true });

// ─── Physics context ──────────────────────────────────────────────────────────
// Preview-mode crash handler (DEV only): replays the current preview mission.
const _getPreviewTriggerCrash = (): (() => void) | null => {
    if (!import.meta.env.DEV) return null;
    if (!new URLSearchParams(location.search).has('preview')) return null;
    if (!_previewLaunch) return null;
    return () => {
        if (zstate.crashed) return;
        stopHeliSound();
        spawnExplosion({ ctx: Flow.makePCtx(), dt: 0 });
        zstate.crashed = true;
        setTimeout(() => {
            _previewLaunch!((campaignHandler as any).getPreviewMissionData?.());
        }, 1800);
    };
};

const _physicsCtx = createPhysicsCtx({
    getMissionState: () => ({
        windStr: Flow.missionWindStr,
        windDir: Flow.missionWindDir,
        windVar: Flow.missionWindVar,
        hasPad: Flow.missionHasPad,
        hasCarrier: Flow.missionHasCarrier,
        snow: Flow.missionSnow,
        padPayloadRefill: Flow.missionPadPayloadRefill,
    }),
    isTutorialMode: () => campaignHandler.getCurrentMissionData().campaignType === CAMPAIGN_TYPE.TUTORIAL,
    getMissionComplete: () => {
        const t = _getPreviewTriggerCrash();
        return t ? () => {} : Flow.missionComplete;
    },
    getTriggerCrash: () => _getPreviewTriggerCrash() ?? Flow.triggerCrash,
    orniWreckDelivered: Flow.orniWreckDelivered,
    onBoatTurbineCollision: Flow.onBoatTurbineCollision,
});

// ─── Render loop ──────────────────────────────────────────────────────────────
let showCollisionBoxes = false;
if (import.meta.env.DEV) {
    window.addEventListener('keydown', e => {
        if (e.key === 'c' || e.key === 'C') showCollisionBoxes = !showCollisionBoxes;
    });
}

let _fpsLastTime = 0;
const drawScene = () => {
    try { _drawSceneInner(); } catch (err) {
        _showDebugError(err instanceof Error ? (err.stack ?? err.message) : String(err));
    }
};
const _drawSceneInner = () => {
    const _now = performance.now();
    if (_fpsLastTime > 0 && _now - _fpsLastTime < 1000 / 30 - 1) {
        _rafRef.id = requestAnimationFrame(drawScene);
        return;
    }
    const dt = _fpsLastTime > 0 ? Math.min((_now - _fpsLastTime) / (1000 / 60), 3.0) : 1.0;
    _fpsLastTime = _now;

    const rain = Flow.missionRain;
    const isNight = Flow.missionNight;
    const gridSize = Flow.missionGridSize;

    if (!zstate.gameStarted) return;
    if (!zstate.crashed && !Flow.briefingActive) updatePhysics(dt, _physicsCtx);
    if (!zstate.gameStarted) return;

    if (Flow.missionMaxTime !== null && Flow.missionStartTime > 0 && !Flow.briefingActive && !zstate.crashed) {
        const remaining = Math.max(0, Flow.missionMaxTime - (Date.now() - Flow.missionStartTime) / 1000);
        Flow.setHudMaxTimeRemaining(remaining);
        if (remaining <= 0) Flow.triggerCrash();
    } else if (Flow.missionMaxTime === null) {
        Flow.setHudMaxTimeRemaining(null);
    }

    if (Flow.missionAltLimit !== null && !Flow.briefingActive && !zstate.crashed) {
        const aboveGround = G.heli.z - getGround(G.heli.x, G.heli.y);
        if (aboveGround > Flow.missionAltLimit) {
            if (Flow.altViolationStart === null) Flow.setAltViolationStart(Date.now());
            else if ((Date.now() - Flow.altViolationStart) / 1000 >= 5) Flow.triggerCrash();
        } else {
            if (Flow.altViolationStart !== null) Flow.setAltViolationStart(null);
        }
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tx = (G.heli.x - G.heli.y) * (tileW / 2);
    const ty = (G.heli.x + G.heli.y) * (tileH / 2) - (isMac() ? 0 : G.heli.z * stepH);
    zstate.cam.x = tx;
    zstate.cam.y = ty;

    const camX = zstate.cam.x,
        camY = zstate.cam.y;

    const rx = camX / tileW + camY / tileH;
    const ry = camY / tileH - camX / tileW;

    drawTerrain(camX, camY, rx, ry, isNight, rain);
    Flow.updateSnowDrift();

    const _visMargin = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH) * 2) + 8;

    const _flapRate = Math.max(0.5, Math.min(3.0, 1.0 + G.heli.vz * 20 + Math.hypot(G.heli.vx, G.heli.vy) * 8));
    const _clr = storageGet('z_heli_color');
    const _heliColorOpts = (_clr === 'blue' || _clr === 'sand' || _clr === 'green') ? { colorVariant: _clr } : {};

    const _overResearchPlatform = G.RESEARCH_PLATFORMS.some(
        (rp: any) => Math.abs(G.heli.x - rp.x) <= 3 && Math.abs(G.heli.y - rp.y) <= 3
    );
    const _overFrigate = G.BOATS.some((b: any) => {
        if (b.objectType !== 'frigate') return false;
        const cosA = Math.cos(b.angle), sinA = Math.sin(b.angle);
        const dx = G.heli.x - b.x, dy = G.heli.y - b.y;
        return Math.abs(dx * cosA + dy * sinA) <= 14 && Math.abs(-dx * sinA + dy * cosA) <= 5;
    });
    if (!zstate.crashed && !_overResearchPlatform && !_overFrigate) {
        drawHeli(
            G.heli.type,
            G.heli.x, G.heli.y, G.heli.z,
            G.heli.angle, G.heli.tilt, G.heli.roll, G.heli.rotationPos,
            camX, camY,
            { isShadow: true, shadowGetGround: (x, y) => getGround(x, y, G.points, G.CARRIER), flapRate: _flapRate, ..._heliColorOpts }
        );
    }

    if (!zstate.crashed) drawPayloadObjects(false);

    drawWorldObjects(
        camX, camY, _visMargin,
        !zstate.crashed
            ? {
                  x: G.heli.x,
                  y: G.heli.y,
                  fn: (cx, cy) => {
                      drawPayloadObjects(true, true);
                      drawPayloadObjects(true, false);

                      if (
                          !G.activePayload &&
                          G.heli.winch > 0.05 &&
                          Math.hypot(G.rescuerSwing.x - G.heli.x, G.rescuerSwing.y - G.heli.y) <= G.heli.winch + 3
                      ) {
                          const rs = G.rescuerSwing;
                          const winchTipZ = Math.max(getGround(rs.x, rs.y), G.heli.z - G.heli.winch);
                          const hP = isoFn(G.heli.x, G.heli.y, G.heli.z, cx, cy);
                          const wP = isoFn(rs.x, rs.y, winchTipZ, cx, cy);
                          ctx.strokeStyle = '#bbb';
                          ctx.lineWidth = 1;
                          ctx.beginPath();
                          ctx.moveTo(hP.x, hP.y);
                          ctx.lineTo(wP.x, wP.y);
                          ctx.stroke();
                      }
                      if (G.heli.winch > 0.3) {
                          const rs = G.rescuerSwing;
                          const winchTipZ = G.activePayload
                              ? G.activePayload.z +
                                (G.activePayload.type === PAYLOAD.PERSON || G.activePayload.type === PAYLOAD.RESCUER
                                    ? 0.35
                                    : 0)
                              : Math.max(getGround(rs.x, rs.y), G.heli.z - G.heli.winch);
                          drawPerson(rs.x, rs.y, winchTipZ, 0, false, cx, cy, PAYLOAD.RESCUER,
                              G.heli.type === 'spinner' ? { shirt: '#0044cc', pants: '#001f80' } : undefined);
                      }

                      drawHeli(
                          G.heli.type,
                          G.heli.x, G.heli.y, G.heli.z,
                          G.heli.angle, G.heli.tilt, G.heli.roll, G.heli.rotationPos,
                          cx, cy,
                          {
                              shadowGetGround: (x, y) => getGround(x, y),
                              flapRate: _flapRate,
                              tailRotorRate: 1.0 + Math.abs(G.heli.roll) * 4,
                              ..._heliColorOpts,
                          }
                      );
                  },
              }
            : undefined,
        (cx, cy) => drawTrees(cx, cy, rx, ry)
    );

    updateNpcHelis(dt);

    drawBirds(camX, camY);

    G.particles.forEach(p => {
        p.vz = (p.vz || 0) + (p.gravity || 0);
        p.z = (p.z || 0) + p.vz;
        p.x += p.vx || 0;
        p.y += p.vy || 0;
        p.life -= p.isSmoke ? 0.018 : 0.025;
        const pos = isoFn(p.x, p.y, Math.max(p.z, 0), camX, camY);
        const alpha = Math.min(1.0, p.life * (p.isSmoke ? 1.5 : 2.0));
        const pScale = tileW / 64;
        const size = (p.size || 3) * pScale;
        ctx.globalAlpha = Math.max(0, alpha);
        if (p.isSmoke) {
            ctx.fillStyle = `rgb(${p.color})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, Math.max(0, size * (1.5 - p.life * 0.5)), 0, Math.PI * 2);
            ctx.fill();
        } else if (p.isMetal) {
            ctx.fillStyle = `rgb(${p.color})`;
            ctx.fillRect(pos.x - 1.5 * pScale, pos.y - 1.5 * pScale, 3 * pScale, 3 * pScale);
        } else if (p.isConfetti) {
            ctx.fillStyle = `rgb(${p.color})`;
            ctx.fillRect(pos.x - 2 * pScale, pos.y - 2 * pScale, 4 * pScale, 4 * pScale);
        } else {
            ctx.fillStyle = `rgb(${p.color})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    });
    G.particles = G.particles.filter(p => p.life > 0);

    if (G.debris.length > 0) drawDebris(G.debris, camX, camY);

    if (!zstate.crashed) {
        renderRain();
        renderSnow(camX, camY);
        handleCollisionBoxes();
        if (import.meta.env.DEV && showCollisionBoxes) drawDebugOverlay(camX, camY);
    }

    _hud.update({
        camX,
        camY,
        dt,
        heli: G.heli,
        groundUnderHeli: getGround(G.heli.x, G.heli.y),
        totalRescued: G.totalRescued,
        goalCount: G.goalCount,
        playerName: Flow.session.playerName || '',
        deliverMode: G.deliverMode,
        maxTimeRemaining: Flow.hudMaxTimeRemaining,
        ringsFlown: G.RINGS.filter(r => r.flown).length,
        ringsTotal: G.RINGS.length,
        altLimit: Flow.missionAltLimit,
        altViolationStart: Flow.altViolationStart,
        minimap: {
            gridSize,
            pad: hasPad() ? G.PAD : null,
            carrier: hasCarrier() ? G.CARRIER : null,
            vessels: [
                ...G.SUBMARINES.map((s: any) => ({ x: s.x, y: s.y, type: VESSEL.SUBMARINE })),
                ...G.BOATS.map((b: any) => ({ x: b.x, y: b.y, type: b.objectType ?? VESSEL.BOAT })),
                ...G.WIND_TURBINES.map((wt: any) => ({ x: wt.x, y: wt.y, type: VESSEL.WIND_TURBINE })),
                ...G.RESEARCH_PLATFORMS.map((rp: any) => ({ x: rp.x, y: rp.y, type: VESSEL.RESEARCH_PLATFORM })),
            ],
            heli: G.heli,
            payloads: G.payloads,
            windBft: Flow.missionWindBft,
            windAngle: Flow.missionWindDir * (Math.PI / 180),
            rings: G.RINGS.map(r => ({ x: r.x, y: r.y, flown: r.flown })),
        },
    });

    updateHeliSound(G.heli.rotorRPM, G.heli.engineOn, G.heli.type, Math.hypot(G.wind.x, G.wind.y), _flapRate);
    if (isTutorialRunning()) tutorialTick(G);
    _rafRef.id = requestAnimationFrame(drawScene);
};

// ─── Wire up flow deps (after drawScene and _physicsCtx are defined) ──────────
Flow.initFlow({
    ctx,
    canvas,
    hud: { showAll: (v) => _hud.showAll(v) },
    drawScene,
    rafRef: _rafRef,
    setTouchVisible,
    showDebugError: _showDebugError,
    precomputeDayColors,
    rebuildEntryCache,
});

// ─── Input ────────────────────────────────────────────────────────────────────
initInputHandlers({
    keys: G.keys as Record<string, boolean>,
    isKeyAllowed: (code: string) => { const a = getAllowedKeys(); return a === null || a.has(code); },
    isTutorialRunning,
    notifyTutorialInput,
    canvas,
});

// ─── Screen mounts ────────────────────────────────────────────────────────────
const mountGameOverlays = () => {
    ensureEl('rain-overlay');
    ensureEl('snow-overlay');
    ensureEl('flash-overlay');
    mountVoiceLine();
};

const mountGameScreens = () => {
    ['campaign-select', 'mission-select', 'heli-select'].forEach(id => {
        ensureEl(id).classList.add('ui-screen');
    });
    MissionSelect.mount();
    CampaignSelect.mount();
    HeliSelect.mount();
    Paywall.mount();
    CampaignCompleteScreen.mount(Flow.returnToCampaignSelect);
    CampaignEndScreen.mount(() => { CampaignEndScreen.hide(); showScreen('main-menu'); soundHandler.play('maintheme'); });
};

// ─── Preview mode (Kampagnen-Editor Live-Preview) — DEV only ──────────────────
const _previewLaunch = !import.meta.env.DEV
    ? undefined
    : (missionData: any, heliType?: string) => {
          (campaignHandler as any).setPreviewMission(missionData);
          cancelAnimationFrame(_rafRef.id);
          _rafRef.id = 0;
          stopHeliSound();
          Flow.showRainOverlay(false);
          Flow.showSnowOverlay(false);
          const _flashEl = document.getElementById('flash-overlay');
          if (_flashEl) _flashEl.style.opacity = '0';
          showScreen(null);
          Briefing.hide();

          zstate.crashed = false;
          zstate.gameStarted = false;
          Flow.resetHeliState();
          G.heli.winch = 0;
          G.deliverMode = false;

          const objs = missionData.objects || [];
          const padObj = objs.find((o: any) => o.type === VESSEL.PAD) ||
              objs.find((o: any) => o.type === VESSEL.CARRIER) || { x: 10, y: 10 };
          G.PAD = { xMin: padObj.x, xMax: padObj.x + 7, yMin: padObj.y, yMax: padObj.y + 7, z: 0.5, towerVariant: padObj.towerVariant };
          G.START_POS = { x: padObj.x + 4, y: padObj.y + 4 };
          initGrid(missionData.gridSize, G.points);

          const previewHeliType = heliType || G.heli.type || 'dolphin';
          Flow.setupHeliType(previewHeliType);

          Flow.launchMission(false).catch(err => _showDebugError(err instanceof Error ? (err.stack ?? err.message) : String(err)));
      };

if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview') && _previewLaunch) {
    window.addEventListener('message', e => {
        if (e.data?.type === 'preview-mission') _previewLaunch(e.data.mission, e.data.heliType);
        if (e.data?.type === 'preview-reset')
            _previewLaunch((campaignHandler as any).getPreviewMissionData?.(), e.data.heliType);
    });
    const _previewBc = new BroadcastChannel('editor-preview');
    _previewBc.onmessage = e => {
        if (e.data?.type === 'mission-update' && e.data.mission) {
            const sel = document.getElementById('pvw-heli') as HTMLSelectElement | null;
            const heliType = e.data.heliType ?? sel?.value;
            if (sel && e.data.heliType) sel.value = e.data.heliType;
            _previewLaunch(e.data.mission, heliType);
        }
    };
}

// ─── Startup ──────────────────────────────────────────────────────────────────
const _onloadPreview = !import.meta.env.DEV
    ? undefined
    : () => {
          assertDom();
          mountGameOverlays();
          mountGameScreens();
          Briefing.mount();
          mountMinimap();
          zinit();
          soundHandler.mute();
          setSfxEnabled(false);

          const _pvwBar = document.createElement('div');
          _pvwBar.style.cssText = 'position:fixed;top:8px;right:8px;z-index:9999;display:flex;gap:6px;align-items:center;background:rgba(0,0,0,0.72);border-radius:6px;padding:5px 8px;font:11px monospace;color:#fff';
          _pvwBar.innerHTML =
              '<span style="opacity:.6">🚁</span>' +
              '<select id="pvw-heli" style="background:#1a1a1a;color:#fff;border:1px solid #555;border-radius:3px;padding:2px 5px;font-size:11px">' +
              HELI_TYPES.map(h => `<option value="${h.id}">${h.label}</option>`).join('') +
              '</select>' +
              '<button id="pvw-restart" style="background:#1a1a1a;color:#fff;border:1px solid #555;border-radius:3px;padding:2px 7px;font-size:13px;cursor:pointer;line-height:1">↺</button>';
          document.body.appendChild(_pvwBar);

          const _pvwSel = document.getElementById('pvw-heli') as HTMLSelectElement;
          const _pvwRestart = () => {
              if (_previewLaunch)
                  _previewLaunch((campaignHandler as any).getPreviewMissionData?.(), _pvwSel.value);
          };
          _pvwSel.addEventListener('change', _pvwRestart);
          document.getElementById('pvw-restart')?.addEventListener('click', _pvwRestart);

          const params = new URLSearchParams(location.search);
          const campaignKey = params.get('preview') ?? '';
          const missionIdx = parseInt(params.get('mission') ?? '0', 10);
          const campaign = campaignHandler.getCampaignByKey(campaignKey) ?? campaignHandler.getCampaigns()[0];
          if (campaign && _previewLaunch) {
              const mission = campaign.levels[missionIdx] ?? campaign.levels[0];
              if (mission) {
                  const initialHeli = (mission as any).heliOverride || 'dolphin';
                  _pvwSel.value = initialHeli;
                  _previewLaunch(mission, initialHeli);
              }
          }
      };

const _onloadMain = () => {
    decompressHelis(); // fire-and-forget — done long before user reaches heli-select
    assertDom();
    const _mountScreens = () => {
        CreditsScreen.mount(Flow.toMainMenu);
        LegalScreen.mount(Flow.toMainMenu);
        MainMenu.mount({
            onSplashStart: () => soundHandler.play('maintheme'),
            onSplashClick: Flow.toMainMenu,
            onStart: Flow.toCampaignSelect,
            onSettings: Settings.show,
            onCredits: CreditsScreen.show,
            onLegal: LegalScreen.show,
        });
        Briefing.mount();
        Settings.mount();
        Rankup.mount();
        mountGameScreens();
    };

    mountGameOverlays();
    mountMinimap();
    _mountScreens();
    zinit();
    const _getPref = (key: string, def: boolean) => {
        const v = storageGet(key);
        return v === null ? def : v === '1';
    };
    const _setPref = (key: string, v: boolean) => storageSet(key, v ? '1' : '0');

    if (!_getPref('z_music', true)) soundHandler.mute();
    setSfxEnabled(_getPref('z_sfx', true));

    if (import.meta.env.DEV) {
        soundHandler.mute();
        setSfxEnabled(false);
    }

    PauseOverlay.mount({
        isMusicEnabled: () => !soundHandler.state.isMuted,
        setMusicEnabled: (v: boolean) => {
            v ? soundHandler.unmute() : soundHandler.mute();
            _setPref('z_music', v);
        },
        isSfxEnabled: () => isSfxEnabled(),
        setSfxEnabled: (v: boolean) => {
            setSfxEnabled(v);
            _setPref('z_sfx', v);
        },
        onPause: () => {
            cancelAnimationFrame(_rafRef.id);
            _rafRef.id = 0;
            stopHeliSound();
            setTouchVisible(false);
        },
        onResume: () => {
            initHeliSound(G.heli.type);
            _rafRef.id = requestAnimationFrame(drawScene);
            setTouchVisible(true);
        },
        onAbort: () => Flow.returnToBase(),
    });

    Settings.init({
        getSession: () => Flow.session,
        saveSession,
        getRankMissions: Flow.getRankMissions,
        isMusicEnabled: () => !soundHandler.state.isMuted,
        setMusicEnabled: (v: boolean) => {
            v ? soundHandler.unmute() : soundHandler.mute();
            _setPref('z_music', v);
        },
        isSfxEnabled: () => isSfxEnabled(),
        setSfxEnabled: (v: boolean) => {
            setSfxEnabled(v);
            _setPref('z_sfx', v);
        },
        onBack: HeliSelect.animMainMenuBg,
        onSessionDeleted: () => {
            Flow.session.playerName = '';
            Flow.session.highestUnlockedCampaignIndex = 0;
            Flow.session.campaignProgress = {};
            Flow.session.rankOverride = 0;
            saveSession(Flow.session);
        },
    });
    onLanguageChange(_mountScreens);
    startMenuParticles();

    showScreen('splash');
};

window.onload = () => {
    requestAnimationFrame(() => {
        (async () => {
            if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview') && _onloadPreview) {
                _onloadPreview();
                return;
            }
            await initAppStorage([STORAGE_KEY, LANG_PREF_KEY, 'z_music', 'z_sfx', 'z_heli_color', 'z_unlocked']);
            Flow.setSession(loadSession());
            const _sl = storageGet(LANG_PREF_KEY);
            if (_sl === 'de' || _sl === 'en') setLanguage(_sl);
            _onloadMain();
        })().catch(err => _showDebugError(err instanceof Error ? (err.stack ?? err.message) : String(err)));
    });
};

window.toCampaignSelect = Flow.toCampaignSelect;

// Called by Swift after async entitlement/grandfathering check completes.
// Updates the storage cache so isUnlocked() returns true immediately,
// then fires __iapResult if the paywall happens to be open.
(window as any).__grantUnlock = () => {
    storageSet(UNLOCK_KEY, '1');
    (window as any).__iapResult?.('success');
};
window.toMainMenu = Flow.toMainMenu;
window.toCredits = CreditsScreen.show;
window.backFromHeliSelect = Flow.backFromHeliSelect;
window.returnToBase = Flow.returnToBase;
window.selectCampaign = Flow.selectCampaign;
window.selectMission = Flow.selectMission;
window.startGame = Flow.startGame;
window.toSettings = Settings.show;
