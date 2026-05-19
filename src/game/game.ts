import './ui/base.css';
import './ui/screens.css';
import { showLoadingScreen } from './ui/loading-screen/loading-screen';
import { ensureEl } from './ui/dom-helpers';
import { mountTouchControls, initPitchWheel, setRightStickProfi } from './ui/touch-controls/touch-controls';
import { iso } from './render';
import { campaignHandler, soundHandler, zinit, musicConfig } from './main';
import {
    loadSession,
    saveSession,
    getRank,
    RANKS,
    isConsentExpired,
    isConsentOutdated,
    CONSENT_VERSION,
    STORAGE_KEY,
    type PlayerSession,
    type Rank,
} from './session';
import { initAppStorage, storageGet, storageSet, storageRemove } from './storage';
import { zstate } from './state';
import { initHeliSound, updateHeliSound, stopHeliSound, setSfxEnabled, isSfxEnabled } from './heli-sound';

import { createDrawWorld } from './draw-world';
import CARRIER_DEF from './models/carrier.zdef';
import RESEARCH_PLATFORM_DEF from './models/research_platform.zdef';
import { createSceneRenderer } from './scene-renderer';
import { getHeliType, HELI_TYPES } from './heli-types';
import { G } from './state';
import { getGround, initGrid, generateTerrain } from './sim/terrain';
import {
    initCarrierFromMission,
    initBoatsFromMission,
    initSubmarinesFromMission,
    initStaticObjectsFromMission,
    initPayloadsFromMission,
} from './sim/world-init';
import { carrierCar } from './sim/vehicles/carrier-car';
import { fuelTruck } from './sim/vehicles/fuel-truck';
import { initBirds, updateBirds, updateDebris, spawnExplosion } from './sim/particles';
import { updatePhysics } from './sim/simulation';
import { createDrawObjects } from './draw-objects';
import { initFoliageFromMission, createFoliage } from './foliage';
import { initNpcHelisFromMission, updateNpcHelis } from './sim/npc-helis';
import { createDrawTerrain } from './draw-terrain';
import { tileW as _tileW, tileH as _tileH, stepH as _stepH, gameRenderScale } from './render-config';
const tileW = Math.round(_tileW * gameRenderScale);
const tileH = Math.round(_tileH * gameRenderScale);
const stepH = _stepH * gameRenderScale;
import { mountCreditsScreen, toCredits } from './ui/credits-screen/credits-screen';
import { mountLegalScreen, toLegalScreen } from './ui/legal-screen/legal-screen';
import { createBackButton } from './ui/back-button/back-button';
import { startMenuParticles, stopMenuParticles } from './ui/menu-particles/menu-particles';
import {
    toMpLobby,
    initMpGame,
    mpHandleReturnToBase,
    mpRenderRemoteHeli,
    mpTickAndHUD,
    mpGetMissionComplete,
    mpGetTriggerCrash,
} from './mp-game';
import { initHeliSelect, mountHeliSelect, showHeliSelect, animMainMenuBg } from './ui/heli-select/heli-select';
import {
    I18N,
    I18N_DE,
    I18N_EN,
    LANG_PREF_KEY,
    LEGAL_DATENSCHUTZ_IMPRINT,
    localize,
    onLanguageChange,
    setLanguage,
} from './i18n';
import { mountCookieBanner, notifyConsent } from './ui/cookie-banner/cookie-banner';
import { mountBriefing, showBriefingOverlay, hideBriefing } from './ui/briefing/briefing';
import { mountSettings, initSettings, toSettings } from './ui/settings/settings';
import { mountRankup, showRankUp, initRankup } from './ui/rankup/rankup';
import { mountPauseButton, showPauseButton, hidePauseButton } from './ui/pause-overlay/pause-overlay';
import { mountWhatsNew, showWhatsNewIfNeeded } from './ui/whats-new/whats-new';
import { mountMainMenu } from './ui/main-menu/main-menu';
import { mountMissionSelect, showMissionSelect } from './ui/mission-select/mission-select';
import { mountCampaignSelect, showCampaignSelect } from './ui/campaign-select/campaign-select';
import { showScreen } from './ui/nav';
import { mountMinimap, initMinimapTerrain } from './ui/minimap/minimap';
import { createHud } from './ui/hud/hud';
import { initTutorial, tutorialTick, destroyTutorial, isTutorialRunning } from './ui/tutorial/tutorial';
import { requestReview } from './reviewRequest';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';
const _PARTY_PALETTE = ['#ff0044', '#ff6600', '#ffcc00', '#00ff88', '#00ccff', '#cc44ff', '#ff44cc', '#44ffcc'];

const assertDom = () => {
    if (!document.getElementById('gameCanvas')) {
        throw new Error('[zeewolf] Missing DOM element: gameCanvas');
    }
};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const isoFn = (wx: number, wy: number, wz: number, cx: number, cy: number) =>
    iso(wx, wy, wz, cx, cy, { canvas, tileW, tileH, stepH });
const _hud = createHud({ isoFn, canvas });
const SceneRenderer = createSceneRenderer(ctx, isoFn);
const { drawTree, drawPerson, drawTractor, drawFuelTruck, drawHeli } = createDrawObjects(
    ctx,
    isoFn,
    tileW,
    tileH,
    SceneRenderer
);

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
    getLighthouse: () => (_missionHasLighthouse ? { x: _lighthouseX, y: _lighthouseY } : null),
    getWindStr: () => _missionWindStr,
    isNight: () => _missionNight,
    isApp: _IS_APP,
    isMissionRain: () => _missionRain,
    getShowCollisionBoxes: () => showCollisionBoxes,
    triggerCrash: (reason: string) => _physicsCtx.triggerCrash(reason),
});
const {
    drawWorldObjects,
    drawBirds,
    drawDebris,
    drawPayloadObjects,
    drawDiscoBall,
    renderRain,
    drawDebugOverlay,
    handleCollisionBoxes,
} = _drawWorldFns;

const { drawTrees } = createFoliage({
    canvas,
    tileW,
    tileH,
    drawTree,
    isApp: _IS_APP,
    getPartyMode: () => _partyMode,
});

initHeliSelect(G, drawHeli);
initRankup(drawHeli);

// ─── helper flags ────────────────────────────────────────────────────────────
function hasCarrier() {
    return _missionHasCarrier;
}
function hasPad() {
    return _missionHasPad;
}
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
    isApp: _IS_APP,
    getPartyMode: () => _partyMode,
    partyPalette: _PARTY_PALETTE,
});

import { buildStartZone } from './start-zone';

// ─── UI helpers ──────────────────────────────────────────────────────────────
function showMsg(txt: string) {
    const m = document.getElementById('msg')!;
    m.innerHTML = txt;
    m.style.opacity = '1';
    setTimeout(() => {
        m.style.opacity = '0';
    }, 2000);
}

function isVisible(objX: number, objY: number, margin = 16) {
    if (_isTouchDevice()) {
        const viewCX = zstate.cam.x / tileW + zstate.cam.y / tileH;
        const viewCY = zstate.cam.y / tileH - zstate.cam.x / tileW;
        return Math.abs(objX - viewCX) < margin && Math.abs(objY - viewCY) < margin;
    }
    const rx = G.heli.x;
    const ry = G.heli.y;
    return Math.abs(objX - rx) < margin && Math.abs(objY - ry) < margin;
}

// ─── screens ────────────────────────────────────────────────────────────────
const _stopMission = () => {
    cancelAnimationFrame(_rafId);
    _rafId = 0;
    destroyTutorial();
    hidePauseButton();
    stopHeliSound();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _hud.showAll(false);
    setTouchVisible(false);
    _showRainOverlay(false);
    const flashEl = document.getElementById('flash-overlay');
    if (flashEl) flashEl.style.opacity = '0';
};

function triggerCrash(reason: string) {
    if (zstate.crashed) return;
    stopHeliSound();
    soundHandler.play(musicConfig.defeat || 'final', false);
    spawnExplosion(G.heli, G.particles, G.debris, G.points, G.CARRIER);
    zstate.crashed = true;
    setTimeout(() => {
        _stopMission();
        document.getElementById('campaign-failed-reason')!.innerHTML = reason;
        document.getElementById('campaign-failed-screen')!.style.display = 'flex';
    }, 1800); // Explosion erst austoben lassen
}

function missionComplete() {
    destroyTutorial();
    const { campaignType } = campaignHandler.getCurrentMissionData();
    const isTutorial = campaignType === 'tutorial';

    const prevRank = getRank(_session, _getRankMissions());

    // Record mission progress + best time
    const elapsed = Date.now() - _missionStartTime;
    const campaignKey = String(_selectedCampaignIndex);
    if (!_session.campaignProgress[campaignKey]) {
        _session.campaignProgress[campaignKey] = { completed: false, missions: [] };
    }
    const cp = _session.campaignProgress[campaignKey];
    if (!cp.missions[_selectedMissionIndex]) {
        cp.missions[_selectedMissionIndex] = { completed: false, bestTimeMs: null };
    }
    const mp = cp.missions[_selectedMissionIndex];
    mp.completed = true;
    if (_missionStartTime > 0 && (mp.bestTimeMs === null || elapsed < mp.bestTimeMs)) {
        mp.bestTimeMs = elapsed;
    }

    // Check if the entire campaign is now done
    const campaigns = campaignHandler.getCampaigns();
    const totalMissions = campaigns[_selectedCampaignIndex].levels.length;
    const allDone = cp.missions.filter((m, i) => i < totalMissions && m?.completed).length >= totalMissions;
    if (allDone) {
        cp.completed = true;
        // Unlock next regular campaign for cross-device import
        if (campaignType !== 'tutorial' && campaignType !== 'free-flight') {
            const regular = campaigns
                .map((c, i) => ({ type: c.type, i }))
                .filter(
                    c =>
                        (!_IS_APP ? c.type !== 'multiplayer' : true) &&
                        c.type !== 'tutorial' &&
                        c.type !== 'free-flight'
                );
            const pos = regular.findIndex(c => c.i === _selectedCampaignIndex);
            if (pos >= 0 && pos + 1 < regular.length) {
                _session.highestUnlockedCampaignIndex = Math.max(
                    _session.highestUnlockedCampaignIndex ?? 0,
                    regular[pos + 1].i
                );
            }
        }
    }

    // Rank check — only tutorial missions don't count
    let rankUpRank: Rank | null = null;
    if (!isTutorial) {
        const newRank = getRank(_session, _getRankMissions());
        if (newRank.name !== prevRank.name) rankUpRank = newRank;
    }

    saveSession(_session);
    _stopMission();

    // Review triggers: any campaign completed, or promotion — Apple limits to 3×/year
    if (allDone || rankUpRank) requestReview();

    if (allDone) {
        document.getElementById('campaign-complete-name')!.textContent = '';
        document.getElementById('campaign-complete-screen')!.style.display = 'flex';
        soundHandler.play(musicConfig.success || 'final', false);
        if (rankUpRank)
            showRankUp(rankUpRank, HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.selectLabel);
        return;
    }

    const successEl = document.getElementById('mission-success-screen')!;
    successEl.style.display = 'flex';
    successEl.onclick = () => {
        successEl.style.display = 'none';
        if (!_IS_APP && _partyMode) soundHandler.play(musicConfig.mainMenu || 'maintheme', true);
        if (!_IS_APP) _partyMode = false;
        zstate.gameStarted = false;
        setTouchVisible(false);
        _hud.showAll(false);
        zstate.crashed = false;
        G.heli.fuel = 100;
        G.heli.onboard = 0;
        G.heli.engineOn = false;
        G.heli.rotorRPM = 0;
        G.heli.vx = 0;
        G.heli.vy = 0;
        G.heli.vz = 0;
        G.particles = [];
        G.debris = [];
        _openMissionSelect();
        if (rankUpRank)
            showRankUp(rankUpRank, HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.selectLabel);
    };
}

const _resetHeliState = () => {
    zstate.crashed = false;
    G.heli.fuel = 100;
    G.heli.onboard = 0;
    G.heli.engineOn = false;
    G.heli.rotorRPM = 0;
    G.heli.vx = 0;
    G.heli.vy = 0;
    G.heli.vz = 0;
    G.particles = [];
    G.debris = [];
    G.totalRescued = 0;
};

function returnToBase() {
    _stopMission();
    if (!_IS_APP && _partyMode) soundHandler.play(musicConfig.mainMenu || 'maintheme', true);
    if (!_IS_APP) _partyMode = false;
    zstate.gameStarted = false;
    if (!_IS_APP && mpHandleReturnToBase()) return;
    _resetHeliState();

    document.getElementById('campaign-complete-screen')!.style.display = 'none';
    document.getElementById('campaign-failed-screen')!.style.display = 'none';
    document.getElementById('mission-success-screen')!.style.display = 'none';
    document.getElementById('crash-screen')!.style.display = 'none';
    hideBriefing();
    _openMissionSelect(); // calls showScreen('mission-select')
    soundHandler.play(musicConfig.mainMenu || 'maintheme', true);
}

const returnToCampaignSelect = () => {
    _stopMission();
    if (!_IS_APP && _partyMode) soundHandler.play(musicConfig.mainMenu || 'maintheme', true);
    if (!_IS_APP) _partyMode = false;
    zstate.gameStarted = false;
    _resetHeliState();
    document.getElementById('campaign-complete-screen')!.style.display = 'none';
    hideBriefing();
    _openCampaignSelect(); // calls showScreen('campaign-select')
    soundHandler.play(musicConfig.mainMenu || 'maintheme', true);
};

const _openCampaignSelect = () => {
    showCampaignSelect({
        session: _session,
        campaigns: campaignHandler.getCampaigns(),
        onSelect: idx => selectCampaign(String(idx)),
        onBack: toMainMenu,
    });
};

// ─── campaign / G.heli select ──────────────────────────────────────────────────
function toCampaignSelect() {
    soundHandler.play(musicConfig.mainMenu || 'maintheme', false);
    _openCampaignSelect();
}

function selectCampaign(index: string) {
    const idx = Number(index);
    const campaigns = campaignHandler.getCampaigns();
    const type = campaigns[idx]?.type;
    const isAlwaysAvailable = type === 'tutorial' || type === 'free-flight';

    if (!isAlwaysAvailable && _session.activeCampaignIndex !== idx) {
        const activeKey = String(_session.activeCampaignIndex);
        const activeCp = _session.campaignProgress[activeKey];
        const activeType = campaigns[_session.activeCampaignIndex]?.type;
        const activeIsRegular = activeType !== 'tutorial' && activeType !== 'free-flight';
        const hasProgress = activeCp && activeCp.missions.some(m => m?.completed) && !activeCp.completed;

        if (activeIsRegular && hasProgress) {
            _pendingSwitchIndex = idx;
            document.getElementById('campaign-switch-warning')!.style.display = 'flex';
            return;
        }
    }

    _doSelectCampaign(idx);
}

const _doSelectCampaign = (idx: number) => {
    const campaigns = campaignHandler.getCampaigns();
    const type = campaigns[idx]?.type;
    const isAlwaysAvailable = type === 'tutorial' || type === 'free-flight';

    if (!isAlwaysAvailable) {
        _session.activeCampaignIndex = idx;
        saveSession(_session);
    }

    _selectedCampaignIndex = idx;
    _selectedMissionIndex = 0;
    campaignHandler.campaign.setActiveCampaign(idx);

    if (type === 'tutorial') {
        selectMission(0);
        return;
    }
    _openMissionSelect(); // calls showScreen('mission-select')
};

const _openMissionSelect = () => {
    const campaigns = campaignHandler.getCampaigns();
    showMissionSelect({
        campaign: campaigns[_selectedCampaignIndex],
        campaignIndex: _selectedCampaignIndex,
        session: _session,
        onSelect: selectMission,
        onBack: toCampaignSelect,
    });
};

const selectMission = (missionIndex: number) => {
    _selectedMissionIndex = missionIndex;
    campaignHandler.campaign.setActiveMission(missionIndex);

    const { gridSize, objects: selObjects, campaignType } = campaignHandler.getCurrentMissionData();
    const selPad = (selObjects || []).find((o: any) => o.type === 'pad') || { x: 10, y: 10 };
    G.PAD = { xMin: selPad.x, xMax: selPad.x + 7, yMin: selPad.y, yMax: selPad.y + 7, z: 0.5 };
    G.START_POS = { x: selPad.x + 4, y: selPad.y + 4 };
    initGrid(gridSize, G.points);

    if (campaignType === 'tutorial') {
        startGame('dolphin');
        return;
    }

    showHeliSelect({
        rankIndex: RANKS.indexOf(getRank(_session, _getRankMissions())),
        onSelect: startGame,
        onBack: backFromHeliSelect,
    });
};

const startGame = (type: string): void => {
    if (zstate.gameStarted) return;
    stopMenuParticles();
    G.heli.type = type;
    const _heliType = getHeliType(type);
    G.heli.maxLoad = _heliType.maxLoad;
    G.heli.accel = _heliType.accel;
    G.heli.friction = _heliType.friction;
    G.heli.tiltSpeed = _heliType.tiltSpeed;
    G.heli.fuelRate = _heliType.fuelRate;
    G.heli.liftPower = _heliType.liftPower;
    G.heli.cargoResist = _heliType.cargoResist;
    showScreen(null);
    void launchMission();
};

const _tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));

const _maybeSpawnOrniWreck = () => {
    if (!_IS_APP) return;
    if (getRank(_session, _getRankMissions()).name === RANKS[RANKS.length - 1].name) return;
    if (Math.random() >= 1 / 12) return;
    const gridSize = campaignHandler.getTerrain().gridSize;
    const margin = 6;
    for (let attempt = 0; attempt < 120; attempt++) {
        const x = margin + Math.random() * (gridSize - margin * 2);
        const y = margin + Math.random() * (gridSize - margin * 2);
        const gz = getGround(x, y, G.points, G.CARRIER);
        if (gz <= G.waterLevel + 0.3) continue;
        const sx = G.START_POS?.x ?? gridSize / 2;
        const sy = G.START_POS?.y ?? gridSize / 2;
        if (Math.hypot(x - sx, y - sy) < 14) continue;
        G.payloads.push({
            type: 'orni_wreck',
            x,
            y,
            z: gz,
            angle: Math.random() * Math.PI * 2,
            hanging: false,
            rescued: false,
            deliverTo: 'pad',
        });
        break;
    }
};

const launchMission = async (showLoader = true): Promise<void> => {
    // Populate per-mission cache — never call getCurrentMissionData() in the render loop
    const _lmd = campaignHandler.getCurrentMissionData();
    const _lmdObjs = _lmd.objects || [];
    _missionHasPad = !!_lmdObjs.find((o: any) => o.type === 'pad');
    _missionHasCarrier = !!_lmdObjs.find((o: any) => o.type === 'carrier');
    _missionHasLighthouse = !!_lmdObjs.find((o: any) => o.type === 'lighthouse');
    _missionRain = !!_lmd.rain;
    _missionNight = !!_lmd.night;
    _missionWindStr = _lmd.windStr ?? 1;
    _missionWindDir = _lmd.windDir ?? 0;
    _missionWindVar = !!_lmd.windVar;
    G.waterLevel = _lmd.waterLevel ?? 0;
    const _lhObj = _lmdObjs.find((o: any) => o.type === 'lighthouse');
    _lighthouseX = _lhObj ? _lhObj.x : -1;
    _lighthouseY = _lhObj ? _lhObj.y : -1;
    _missionGridSize = campaignHandler.getTerrain().gridSize;

    const handle = showLoader ? showLoadingScreen(localize(_lmd.headline) || 'MISSION') : null;

    // Step 1 — terrain
    generateTerrain(G.points, _missionHasPad ? { ...G.PAD, yMin: G.PAD.yMin - 3 } : null);
    initMinimapTerrain(G.points, _missionGridSize, G.waterLevel);
    precomputeDayColors(_missionRain);
    handle?.step('Gelände…', 0.25);
    if (handle) await _tick();

    // Step 2 — objects
    initCarrierFromMission();
    if (G.CARRIER && G.CARRIER.x !== undefined) G.CARRIER.rescueZones = CARRIER_DEF.rescueZones || [];
    if (hasCarrier()) carrierCar.init();
    initBoatsFromMission();
    initSubmarinesFromMission();
    initStaticObjectsFromMission();
    G.RESEARCH_PLATFORMS.forEach((rp: any) => {
        rp.rescueZones = (RESEARCH_PLATFORM_DEF as any).rescueZones || [];
    });
    handle?.step('Objekte…', 0.5);
    if (handle) await _tick();

    // Step 3 — environment
    initFoliageFromMission();
    initBirds();
    G.deliverMode = false;
    initPayloadsFromMission();
    initNpcHelisFromMission();
    _maybeSpawnOrniWreck();
    if (hasPad()) fuelTruck.init();
    handle?.step('Umgebung…', 0.75);
    if (handle) await _tick();

    // Step 4 — ready; wait for minimum display time then fade out
    handle?.step('Bereit.', 1.0);
    if (handle) await handle.done();

    G.heli.winch = 0;
    zstate.crashed = false;
    zstate.gameStarted = true;
    _hud.showAll(true);

    const _startZone = buildStartZone();
    const _sp = _startZone.getPos();
    G.heli.x = _sp.x;
    G.heli.y = _sp.y;
    G.heli.z = _sp.z;
    G.heli.vx = 0;
    G.heli.vy = 0;
    G.heli.vz = 0;
    G.heli.inAir = false;
    G.heli.angle = _startZone.getAngle();
    G.heli.engineOn = false;
    G.heli.rotorRPM = 0;
    G.rescuerSwing.x = _sp.x;
    G.rescuerSwing.y = _sp.y;
    G.rescuerSwing.vx = 0;
    G.rescuerSwing.vy = 0;
    zstate.cam.x = (_sp.x - _sp.y) * (tileW / 2);
    zstate.cam.y = (_sp.x + _sp.y) * (tileH / 2);

    _showRainOverlay(_missionRain, _lmd.windDir ?? 225, _lmd.windStr ?? 1);
    cancelAnimationFrame(_rafId);
    initHeliSound(G.heli.type);
    _briefingActive = true;
    _rafId = requestAnimationFrame(drawScene);
    showPauseButton();

    const rank = getRank(_session, _getRankMissions());
    const address = I18N.BRIEFING_ADDRESS(rank.name, _session.playerName).toUpperCase();
    const briefingSong = campaignHandler.getActiveCampaignMusic().briefing;
    if (briefingSong) soundHandler.play(briefingSong, true);

    showBriefingOverlay({ headline: _lmd.headline, sublines: _lmd.sublines, briefing: _lmd.briefing, address }, () => {
        _briefingActive = false;
        _missionStartTime = Date.now();
        soundHandler.play(campaignHandler.getActiveCampaignMusic().ingame || 'clike', false, 0.4);
        setTouchVisible(true);
        if (_lmd.campaignType === 'tutorial') {
            initTutorial(_isTouchDevice(), getControlMode(), G, missionComplete);
        }
    });
};

//
// KOORDINATENSYSTEM (isometrisch, Kamera schaut von NW):
//   +X  = Welt-rechts  = iso: rechts-unten im Bild
//   +Y  = Welt-oben    = iso: links-unten im Bild
//   +Z  = Höhe         = iso: senkrecht nach oben im Bild
//
// PAD-Layout (Beispiel: xMin=44 xMax=51 yMin=69 yMax=76, z=0.5):
//
//   Y=76 ┌─────────────────────┐
//        │        PAD           │
//   Y=71 │       ┌─────────────┐│  ← Hangar (x: xMax-4..xMax, y: yMin..yMin+2)
//   Y=69 │       └─────────────┘│  ← Hangar-Öffnung zeigt in +Y Richtung
//        └─────────────────────┘
//        X=44                 X=51
//
// TRUCK-GEOMETRIE (lokales Koordinatensystem, +X = Vorwärts = Cab-Richtung):
//   local X=0      : Heck (Arm-Pivot)
//   local X=0.25-1.4: Tank
//   local X=1.5-2.2 : Cab / Front
//   Fahrtrichtung  : world angle = atan2(dy,dx), truck +X zeigt dahin
//
// PARKPOSITION: direkt neben linker Hangar-Wand (bei xMax-5), längs dazu
//   parkX = PAD.xMax - 6.2  (rechte Truck-Seite xMax-5.75, Abstand 0.75 zur Hangar-Wand)
//   parkY = PAD.yMin - 1    (Mitte der Hangar-Tiefe yMin-2..yMin)
//   parkAngle = +PI/2        (Nase zeigt in +Y = Richtung Landeplatz)
//
let _fpsLastTime = 0;
function drawScene() {
    const _now = performance.now();
    if (_isTouchDevice() && _fpsLastTime > 0 && _now - _fpsLastTime < 1000 / 30 - 1) {
        _rafId = requestAnimationFrame(drawScene);
        return;
    }
    const dt = _fpsLastTime > 0 ? Math.min((_now - _fpsLastTime) / (1000 / 60), 3.0) : 1.0;
    _fpsLastTime = _now;

    const rain = _missionRain;
    const isNight = _missionNight;
    const gridSize = _missionGridSize;

    if (!zstate.gameStarted) return;
    if (!zstate.crashed && !_briefingActive) updatePhysics(dt, _physicsCtx);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tx = (G.heli.x - G.heli.y) * (tileW / 2);
    if (_isTouchDevice()) {
        // Mobile: snap camera to heli incl. altitude so terrain shifts with height
        const ty = (G.heli.x + G.heli.y) * (tileH / 2) - G.heli.z * stepH;
        zstate.cam.x = tx;
        zstate.cam.y = ty;
    } else {
        // Desktop: smooth-follow ground point only — camera doesn't rise with heli
        const ty = (G.heli.x + G.heli.y) * (tileH / 2);
        zstate.cam.x += (tx - zstate.cam.x) * 0.1 * dt;
        zstate.cam.y += (ty - zstate.cam.y) * 0.1 * dt;
    }

    const camX = zstate.cam.x,
        camY = zstate.cam.y;

    let rx: number, ry: number;
    if (_isTouchDevice()) {
        // Mobile: derive tile center from camera (includes z-shift)
        rx = camX / tileW + camY / tileH;
        ry = camY / tileH - camX / tileW;
    } else {
        rx = G.heli.x;
        ry = G.heli.y;
    }

    drawTerrain(camX, camY, rx, ry, isNight, rain);

    const _visMargin = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 4;

    drawWorldObjects(camX, camY, _visMargin);

    drawTrees(camX, camY, rx, ry);

    updateNpcHelis(dt);

    // Vögel
    updateBirds();
    drawBirds(camX, camY);

    // flapRate: vertical climb + horizontal speed (braking from speed → faster flapping)
    const _flapRate = Math.max(0.5, Math.min(3.0, 1.0 + G.heli.vz * 20 + Math.hypot(G.heli.vx, G.heli.vy) * 8));

    // shadow pass
    if (!zstate.crashed) {
        drawHeli(
            G.heli.type,
            G.heli.x,
            G.heli.y,
            G.heli.z,
            G.heli.angle,
            G.heli.tilt,
            G.heli.roll,
            G.heli.rotationPos,
            camX,
            camY,
            { isShadow: true, shadowGetGround: (x, y) => getGround(x, y, G.points, G.CARRIER), flapRate: _flapRate }
        );
        if (G.remoteHeli) {
            drawHeli(
                G.remoteHeli.type,
                G.remoteHeli.x,
                G.remoteHeli.y,
                G.remoteHeli.z,
                G.remoteHeli.angle,
                G.remoteHeli.tilt,
                G.remoteHeli.roll,
                G.remoteHeli.rotationPos,
                camX,
                camY,
                { isShadow: true, shadowGetGround: (x, y) => getGround(x, y, G.points, G.CARRIER) }
            );
        }
    }

    // G.particles
    G.particles.forEach(p => {
        p.vz = (p.vz || 0) + (p.gravity || 0);
        p.z = (p.z || 0) + p.vz;
        p.x += p.vx || 0;
        p.y += p.vy || 0;
        p.life -= p.isSmoke ? 0.018 : 0.025;
        let pos = iso(p.x, p.y, Math.max(p.z, 0), camX, camY, { stepH, tileW, tileH, canvas });
        const alpha = Math.min(1.0, p.life * (p.isSmoke ? 1.5 : 2.0));
        const pScale = tileW / 64;
        const size = (p.size || 3) * pScale;
        ctx.globalAlpha = Math.max(0, alpha);
        if (p.isSmoke) {
            ctx.fillStyle = `rgb(${p.color})`;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size * (1.5 - p.life * 0.5), 0, Math.PI * 2);
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

    // G.debris (Heli-Trümmer)
    if (G.debris.length > 0) {
        updateDebris();
        drawDebris(G.debris, camX, camY);
    }

    // Heli nur rendern wenn nicht gecrasht
    if (!zstate.crashed) {
        // ground persons drawn BEFORE heli for correct depth order
        drawPayloadObjects(false);
        // ropes, payload figures + rescuer all BEFORE heli — heli always on top
        drawPayloadObjects(true, true);
        drawPayloadObjects(true, false);

        // winch line (only when extended and nothing hanging)
        if (!G.activePayload && G.heli.winch > 0.05) {
            const rs = G.rescuerSwing;
            const winchTipZ = Math.max(getGround(rs.x, rs.y), G.heli.z - G.heli.winch);
            const hP = iso(G.heli.x, G.heli.y, G.heli.z, camX, camY, { stepH, tileW, tileH, canvas });
            const wP = iso(rs.x, rs.y, winchTipZ, camX, camY, { stepH, tileW, tileH, canvas });
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hP.x, hP.y);
            ctx.lineTo(wP.x, wP.y);
            ctx.stroke();
        }
        // rescuer at winch tip drawn BEFORE heli (appears behind heli body)
        if (G.heli.winch > 0.3) {
            const rs = G.rescuerSwing;
            const winchTipZ = G.activePayload
                ? G.activePayload.z +
                  (G.activePayload.type === 'person' || G.activePayload.type === 'rescuer' ? 0.35 : 0)
                : Math.max(getGround(rs.x, rs.y), G.heli.z - G.heli.winch);
            drawPerson(
                rs.x,
                rs.y,
                winchTipZ,
                0,
                false,
                camX,
                camY,
                'rescuer',
                !_IS_APP && _partyMode ? { shirt: '#ffffff', pants: '#ffffff' } : undefined
            );
        }

        if (!_IS_APP && _partyMode && Math.floor(Date.now() / 80) % 2 === 0) _refreshPartyColors();
        drawHeli(
            G.heli.type,
            G.heli.x,
            G.heli.y,
            G.heli.z,
            G.heli.angle,
            G.heli.tilt,
            G.heli.roll,
            G.heli.rotationPos,
            camX,
            camY,
            {
                shadowGetGround: (x, y) => getGround(x, y),
                flapRate: _flapRate,
                tailRotorRate: 1.0 + Math.abs(G.heli.roll) * 4,
                ...(!_IS_APP && _partyMode ? { fillColor: _partyColors[0], strokeColor: _partyColors[1] } : {}),
            }
        );

        if (!_IS_APP) mpRenderRemoteHeli(ctx, camX, camY, drawHeli, isoFn);

        renderRain();

        // collision box checks + optional debug rendering
        handleCollisionBoxes();
        if (!_IS_APP && showCollisionBoxes) drawDebugOverlay(camX, camY);
    } // end if (!zstate.crashed)

    _hud.update({
        camX,
        camY,
        dt,
        heli: G.heli,
        groundUnderHeli: getGround(G.heli.x, G.heli.y),
        totalRescued: G.totalRescued,
        goalCount: G.goalCount,
        playerName: _session.playerName || '',
        deliverMode: G.deliverMode,
        minimap: {
            gridSize,
            isTouch: _isTouchDevice(),
            pad: hasPad() ? G.PAD : null,
            carrier: hasCarrier() ? G.CARRIER : null,
            heli: G.heli,
            payloads: G.payloads,
        },
    });

    if (!_IS_APP) mpTickAndHUD(ctx, canvas, dt);

    if (!_IS_APP && _partyMode) drawDiscoBall();

    updateHeliSound(G.heli.rotorRPM, G.heli.engineOn, G.heli.type, Math.hypot(G.wind.x, G.wind.y), _flapRate);
    if (isTutorialRunning()) tutorialTick(G);
    _rafId = requestAnimationFrame(drawScene);
}

// ─── collision boxes ─────────────────────────────────────────────────────────
let showCollisionBoxes = false;
if (!_IS_APP) {
    window.addEventListener('keydown', e => {
        if (e.key === 'c' || e.key === 'C') {
            showCollisionBoxes = !showCollisionBoxes;
            SceneRenderer.debugAltitude = showCollisionBoxes;
        }
    });
}

// ─── main menu ───────────────────────────────────────────────────────────────
function toMainMenu() {
    hidePauseButton();
    cancelAnimationFrame(_rafId);
    _rafId = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    zstate.gameStarted = false;
    if (!_IS_APP) _partyMode = false;
    showScreen('main-menu');
    soundHandler.play(musicConfig.mainMenu || 'maintheme', true);
    animMainMenuBg();
    startMenuParticles();
}

function backFromHeliSelect() {
    _openMissionSelect();
}

let _rafId = 0;

// ─── mission-local cache (set once per launch, never changes mid-mission) ─────
let _missionHasPad = false;
let _missionHasCarrier = false;
let _missionHasLighthouse = false;
let _missionRain = false;
let _missionNight = false;
let _missionWindStr = 1;
let _missionWindDir = 0;
let _missionWindVar = false;
let _lighthouseX = -1;
let _lighthouseY = -1;
let _missionGridSize = 28;

let _partyMode = false;
let _partySeq = '';
let _partyColors: string[] = [];
const _randomPartyColor = () => _PARTY_PALETTE[Math.floor(Math.random() * _PARTY_PALETTE.length)];
const _refreshPartyColors = () => {
    _partyColors = Array.from({ length: 8 }, _randomPartyColor);
};

const _physicsCtx = {
    get windStr() {
        return _missionWindStr;
    },
    get windDir() {
        return _missionWindDir;
    },
    get windVar() {
        return _missionWindVar;
    },
    get hasPad() {
        return _missionHasPad;
    },
    get hasCarrier() {
        return _missionHasCarrier;
    },
    get isTutorialMode() {
        return campaignHandler.getCurrentMissionData().campaignType === 'tutorial';
    },
    showMsg,
    get missionComplete() {
        return !_IS_APP ? mpGetMissionComplete(missionComplete) : missionComplete;
    },
    get triggerCrash() {
        if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview') && _previewLaunch) {
            return (_reason: string) => {
                if (zstate.crashed) return;
                stopHeliSound();
                spawnExplosion(G.heli, G.particles, G.debris, G.points, G.CARRIER);
                zstate.crashed = true;
                setTimeout(() => {
                    _previewLaunch!((campaignHandler as any).getPreviewMissionData?.());
                }, 1800);
            };
        }
        return !_IS_APP ? mpGetTriggerCrash(triggerCrash) : triggerCrash;
    },
    orniWreckDelivered() {
        _session.rankOverride = RANKS.length - 1;
        saveSession(_session);
        _stopMission();
        showRankUp(RANKS[RANKS.length - 1], undefined);
    },
} as import('./sim/simulation').PhysicsCtx;

if (!_IS_APP) {
    Object.defineProperty(_physicsCtx, 'partyMode', { get: () => _partyMode, enumerable: true, configurable: true });
    (_physicsCtx as any).partyPalette = _PARTY_PALETTE;
}

// ─── session ──────────────────────────────────────────────────────────────────
let _session: PlayerSession = loadSession();

const _getRankMissions = (): number => {
    const tutorialKeys = new Set(
        campaignHandler
            .getCampaigns()
            .map((c, i) => (c.type === 'tutorial' ? String(i) : null))
            .filter((k): k is string => k !== null)
    );
    return Object.entries(_session.campaignProgress)
        .filter(([key]) => !tutorialKeys.has(key))
        .reduce((sum, [, cp]) => sum + cp.missions.filter(m => m.completed).length, 0);
};

let _selectedCampaignIndex = 0;
let _selectedMissionIndex = 0;
let _missionStartTime = 0;
let _briefingActive = false;
let _pendingSwitchIndex = -1;
let _unlockSeq = '';

const approveCookies = () => {
    _session.cookieConsent = true;
    _session.consentTimestamp = Date.now();
    _session.consentVersion = CONSENT_VERSION;
    saveSession(_session);
    (document.getElementById('cookie-banner') as HTMLElement).style.display = 'none';
    notifyConsent();
};

const declineCookies = () => {
    _session.cookieConsent = false;
    storageRemove(STORAGE_KEY);
    (document.getElementById('cookie-banner') as HTMLElement).style.display = 'none';
    notifyConsent();
};

window.onkeydown = e => {
    G.keys[e.code] = true;
    if ((document.activeElement as HTMLElement)?.tagName === 'INPUT') return;
    if (!_IS_APP) {
        _unlockSeq = (_unlockSeq + e.key.toUpperCase()).slice(-6);
        if (_unlockSeq === 'UNLOCK') {
            const _campaigns = campaignHandler.getCampaigns();
            _session.allUnlocked = true;
            _session.rankOverride = RANKS.length - 1;
            _session.highestUnlockedCampaignIndex = _campaigns.length - 1;
            _campaigns.forEach((c, i) => {
                _session.campaignProgress[String(i)] = {
                    completed: true,
                    missions: c.levels.map(() => ({ completed: true, bestTimeMs: null })),
                };
            });
            saveSession(_session);
            _unlockSeq = '';
            showMsg(I18N.UNLOCK_ALL!);
        }
        if (zstate.gameStarted) {
            _partySeq = (_partySeq + e.key.toUpperCase()).slice(-5);
            if (_partySeq === 'PARTY') {
                _partyMode = !_partyMode;
                _partySeq = '';
                if (_partyMode) {
                    _refreshPartyColors();
                    showMsg(I18N.PARTY_ON!);
                    soundHandler.play('partytime', true);
                } else {
                    soundHandler.play(musicConfig.mainMenu || 'maintheme', true);
                }
            }
        }
    }
};
window.onkeyup = e => (G.keys[e.code] = false);
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
const _resizeCanvas = () => {
    if (_IS_APP) {
        // App bundle only: phone 2.0×, tablet (≥768px short-side) 2.5× upscale — landscape-safe
        //const scale = Math.min(screen.width, screen.height) >= 768 ? 2.5 : 2.8;
        const scale = 2;
        canvas.width = Math.round(window.innerWidth / scale);
        canvas.height = Math.round(window.innerHeight / scale);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
    } else {
        // Webapp only: mobile 1.6× upscale for performance, desktop 1×
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isMobile) {
            canvas.width = Math.round(window.innerWidth / 0.8 / 2);
            canvas.height = Math.round(window.innerHeight / 0.8 / 2);
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';
        } else {
            canvas.width = Math.round(window.innerWidth * gameRenderScale);
            canvas.height = Math.round(window.innerHeight * gameRenderScale);
            canvas.style.width = window.innerWidth + 'px';
            canvas.style.height = window.innerHeight + 'px';
        }
    }
};
window.addEventListener('resize', _resizeCanvas);
_resizeCanvas();

const _isTouchDevice = () =>
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
const setTouchVisible = (v: boolean) => {
    if (!_isTouchDevice()) return;
    const touchEl = document.getElementById('touch-controls');
    if (touchEl) touchEl.style.display = v ? 'flex' : 'none';
    if (!_IS_APP) {
        const debugEl = document.getElementById('debug-toggle');
        if (debugEl) debugEl.style.display = v ? 'block' : 'none';
    }
};

const CTRL_MODE_KEY = 'zeewolf-ctrl-mode';
const getControlMode = (): 'heading' | 'screen' => (storageGet(CTRL_MODE_KEY) === 'screen' ? 'screen' : 'heading');
const setControlMode = (m: 'heading' | 'screen') => {
    storageSet(CTRL_MODE_KEY, m);
    setRightStickProfi(m === 'screen');
};

const _setupJoystick = (id: string, up: string, down: string, left: string, right: string, safeVertical = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    const knob = el.querySelector('.joystick-knob') as HTMLElement;
    const keys = [up, down, left, right];
    let active = false,
        cx = 0,
        cy = 0,
        jr = 0;
    const setKeys = (dx: number, dy: number) => {
        const dead = jr * 0.18;
        const inVertSector = safeVertical && Math.abs(dy) > dead && Math.abs(dx) < Math.abs(dy) * 0.4;
        (G.keys as Record<string, boolean>)[up] = dy < -dead;
        (G.keys as Record<string, boolean>)[down] = dy > dead;
        (G.keys as Record<string, boolean>)[left] = !inVertSector && dx < -dead;
        (G.keys as Record<string, boolean>)[right] = !inVertSector && dx > dead;
    };
    el.addEventListener('pointerdown', e => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const r = el.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        jr = r.width / 2;
        active = true;
        knob.style.transition = 'none';
    });
    el.addEventListener('pointermove', e => {
        if (!active) return;
        const dx = e.clientX - cx,
            dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const clamped = Math.min(dist, jr * 0.55) / dist;
        knob.style.transform = `translate(calc(-50% + ${dx * clamped}px), calc(-50% + ${dy * clamped}px))`;
        setKeys(dx, dy);
    });
    const release = () => {
        if (!active) return;
        active = false;
        knob.style.transition = 'transform 0.12s ease-out';
        knob.style.transform = 'translate(-50%, -50%)';
        keys.forEach(k => {
            (G.keys as Record<string, boolean>)[k] = false;
        });
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
};

const _setupRightJoystick = () => {
    const el = document.getElementById('joystick-right');
    if (!el) return;
    const knob = el.querySelector('.joystick-knob') as HTMLElement;
    let active = false,
        cx = 0,
        cy = 0,
        jr = 0;
    let _stickDx = 0,
        _stickDy = 0;

    el.addEventListener('pointerdown', e => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const r = el.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
        jr = r.width / 2;
        active = true;
        _stickDx = 0;
        _stickDy = 0;
        knob.style.transition = 'none';
    });
    el.addEventListener('pointermove', e => {
        if (!active) return;
        const dx = e.clientX - cx,
            dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const clamped = Math.min(dist, jr * 0.55) / dist;
        knob.style.transform = `translate(calc(-50% + ${dx * clamped}px), calc(-50% + ${dy * clamped}px))`;
        _stickDx = dx;
        _stickDy = dy;
        if (getControlMode() === 'screen') {
            const dead = jr * 0.18;
            const inVertSector = Math.abs(dy) > dead && Math.abs(dx) < Math.abs(dy) * 0.4;
            (G.keys as Record<string, boolean>)['ArrowUp'] = dy < -dead;
            (G.keys as Record<string, boolean>)['ArrowDown'] = dy > dead;
            (G.keys as Record<string, boolean>)['ArrowLeft'] = !inVertSector && dx < -dead;
            (G.keys as Record<string, boolean>)['ArrowRight'] = !inVertSector && dx > dead;
        }
    });
    const release = () => {
        if (!active) return;
        active = false;
        _stickDx = 0;
        _stickDy = 0;
        knob.style.transition = 'transform 0.12s ease-out';
        knob.style.transform = 'translate(-50%, -50%)';
        (G.keys as Record<string, boolean>)['ArrowUp'] = false;
        (G.keys as Record<string, boolean>)['ArrowDown'] = false;
        (G.keys as Record<string, boolean>)['ArrowLeft'] = false;
        (G.keys as Record<string, boolean>)['ArrowRight'] = false;
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    // Heading mode: run each frame, maps stick direction relative to heli heading
    const tick = () => {
        if (
            active &&
            getControlMode() === 'heading' &&
            zstate.gameStarted &&
            Math.hypot(_stickDx, _stickDy) > jr * 0.18
        ) {
            const targetAngle = Math.atan2(_stickDy, _stickDx);
            let diff = targetAngle - G.heli.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const turnDead = 0.15;
            (G.keys as Record<string, boolean>)['ArrowLeft'] = diff < -turnDead;
            (G.keys as Record<string, boolean>)['ArrowRight'] = diff > turnDead;
            const stickLen = Math.hypot(_stickDx, _stickDy);
            const normSx = _stickDx / stickLen,
                normSy = _stickDy / stickLen;
            const fwdX = Math.cos(G.heli.angle),
                fwdY = Math.sin(G.heli.angle);
            const dot = normSx * fwdX + normSy * fwdY;
            const accelDead = 0.3;
            (G.keys as Record<string, boolean>)['ArrowUp'] = dot > accelDead;
            (G.keys as Record<string, boolean>)['ArrowDown'] = dot < -accelDead;
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
};

const setupTouchControls = () => {
    if (!_isTouchDevice()) return;
    mountTouchControls();
    setRightStickProfi(getControlMode() === 'screen');
    if (!_IS_APP) {
        document.getElementById('debug-toggle')?.addEventListener('click', () => {
            showCollisionBoxes = !showCollisionBoxes;
            SceneRenderer.debugAltitude = showCollisionBoxes;
        });
    }
    // pitch wheel (winch)
    initPitchWheel((key, val) => {
        (G.keys as Record<string, boolean>)[key] = val;
    });
    // touch buttons (R / any future data-key buttons)
    document.querySelectorAll<HTMLElement>('.touch-btn').forEach(btn => {
        const key = btn.dataset.key;
        if (!key) return;
        btn.addEventListener('pointerdown', e => {
            e.preventDefault();
            btn.setPointerCapture(e.pointerId);
            (G.keys as Record<string, boolean>)[key] = true;
            btn.classList.add('active');
        });
        const release = () => {
            (G.keys as Record<string, boolean>)[key] = false;
            btn.classList.remove('active');
        };
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
    });
    // joysticks
    _setupJoystick('joystick-left', 'KeyW', 'KeyS', 'KeyA', 'KeyD');
    _setupRightJoystick();
};

const _ensureEl = ensureEl;

const _showRainOverlay = (active: boolean, windDir = 225, windStr = 1) => {
    const el = document.getElementById('rain-overlay');
    if (!el) return;
    if (active) {
        // Map wind direction to a visible tilt angle: convert compass degrees to CSS rotation
        const angleDeg = -10 + ((windDir - 225) / 360) * 20 * windStr;
        el.style.setProperty('--rain-angle', `${angleDeg.toFixed(1)}deg`);
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
};

const mountGameOverlays = () => {
    _ensureEl('rain-overlay');
    _ensureEl('flash-overlay');
    _ensureEl('msg');
    if (!_IS_APP) {
        _ensureEl('debug-toggle');
    }
    if (!_IS_APP) {
        const egg = _ensureEl('easter-egg');
        egg.onclick = () => (window as any).launchEasterEgg?.();
    }
};

const mountGameScreens = () => {
    [
        'campaign-select',
        'mission-select',
        'heli-select',
        'crash-screen',
        'mission-success-screen',
        'win-screen',
        'campaign-complete-screen',
        'campaign-failed-screen',
    ].forEach(id => {
        _ensureEl(id).classList.add('ui-screen');
    });
    mountMissionSelect();
    mountCampaignSelect();
    mountHeliSelect();

    document.getElementById('crash-screen')!.innerHTML = `
        <div class="title" style="color: #fff">${I18N.TERMINATED}</div>
        <p id="crash-reason" style="color: #f00; font-size: 24px; font-weight: bold"></p>
        <p class="start-hint">${I18N.RETRY}</p>`;

    document.getElementById('mission-success-screen')!.innerHTML = `
        <div class="title" style="color: #fff">${I18N.MISSION_COMPLETE}</div>
        <p style="color: rgb(50, 74, 50); font-size: 24px">${I18N.OBJECTIVES_CLEARED}</p>
        <p class="start-hint">${I18N.RETURN_TO_BASE}</p>`;

    document.getElementById('win-screen')!.innerHTML = `
        <div class="title" style="color: #fff">${I18N.CAMPAIGN_COMPLETE}</div>
        <p style="color: #5f5; font-size: 24px">${I18N.ALL_MISSIONS_CLEARED}</p>
        <p class="start-hint">${I18N.RETURN_TO_BASE}</p>`;

    document.getElementById('campaign-complete-screen')!.innerHTML = `
        <div class="title" style="color: #ff6600">${I18N.CAMPAIGN_COMPLETE}</div>
        <div id="campaign-complete-name" style="color: #5f5; font-size: 24px; margin: 10px 0"></div>
        <p style="color: #aaa; font-size: 16px; letter-spacing: 2px">${I18N.ALL_MISSIONS_CLEARED}</p>
        <p class="start-hint">${I18N.RETURN_TO_BASE}</p>`;
    document.getElementById('campaign-complete-screen')!.addEventListener('click', returnToCampaignSelect);

    document.getElementById('campaign-failed-screen')!.innerHTML = `
        <div class="title" style="color: #fff">${I18N.CAMPAIGN_FAILED}</div>
        <p id="campaign-failed-reason" style="color: #f00; font-size: 24px; font-weight: bold"></p>
        <p style="color: #aaa; font-size: 16px; letter-spacing: 2px">${I18N.MISSION_ABORTED}</p>
        <p class="start-hint">${I18N.RETURN_TO_BASE}</p>`;
    document.getElementById('campaign-failed-screen')!.addEventListener('click', returnToBase);

    // Campaign-switch warning overlay
    const warningEl = _ensureEl('campaign-switch-warning');
    warningEl.innerHTML = `
        <div class="title" style="font-size: 26px; color: #f90">${I18N.CAMPAIGN_SWITCH_WARNING}</div>
        <p style="color:#aaa; font-size:15px; letter-spacing:1px; margin: 10px 0 24px">
            ${I18N.CAMPAIGN_SWITCH_PROGRESS_WARN}
        </p>
        <div style="display:flex; gap: 20px">
            <div class="back-btn" style="color:#f90; border-color:#f90" id="campaign-switch-confirm">
                ${I18N.CAMPAIGN_SWITCH_CONFIRM}
            </div>
        </div>`;
    (warningEl.lastElementChild as HTMLElement).prepend(
        createBackButton(() => {
            warningEl.style.display = 'none';
            _pendingSwitchIndex = -1;
        })
    );
    document.getElementById('campaign-switch-confirm')!.addEventListener('click', () => {
        warningEl.style.display = 'none';
        const switchTo = _pendingSwitchIndex;
        _pendingSwitchIndex = -1;
        if (switchTo >= 0) {
            // Clear progress of old active campaign
            const oldKey = String(_session.activeCampaignIndex);
            delete _session.campaignProgress[oldKey];
            saveSession(_session);
            _doSelectCampaign(switchTo);
        }
    });
};

// ─── Preview mode (Kampagnen-Editor Live-Preview) — DEV only ──────────────────
const _previewLaunch = !import.meta.env.DEV
    ? undefined
    : (missionData: any, heliType?: string) => {
          (campaignHandler as any).setPreviewMission(missionData);
          cancelAnimationFrame(_rafId);
          _rafId = 0;
          stopHeliSound();
          _showRainOverlay(false);
          const _flashEl = document.getElementById('flash-overlay');
          if (_flashEl) _flashEl.style.opacity = '0';

          showScreen(null);
          hideBriefing();

          // Reset heli + state
          zstate.crashed = false;
          zstate.gameStarted = false;
          G.heli.fuel = 100;
          G.heli.onboard = 0;
          G.heli.engineOn = false;
          G.heli.rotorRPM = 0;
          G.heli.vx = 0;
          G.heli.vy = 0;
          G.heli.vz = 0;
          G.heli.winch = 0;
          G.deliverMode = false;
          G.particles = [];
          G.debris = [];
          G.totalRescued = 0;

          // Setup from mission objects
          const objs = missionData.objects || [];
          const padObj = objs.find((o: any) => o.type === 'pad') ||
              objs.find((o: any) => o.type === 'carrier') || { x: 10, y: 10 };
          G.PAD = { xMin: padObj.x, xMax: padObj.x + 7, yMin: padObj.y, yMax: padObj.y + 7, z: 0.5 };
          G.START_POS = { x: padObj.x + 4, y: padObj.y + 4 };
          initGrid(missionData.gridSize, G.points);

          // Use selected heli type, fall back to current or dolphin
          const previewHeliType = heliType || G.heli.type || 'dolphin';
          const _ht = getHeliType(previewHeliType);
          G.heli.type = previewHeliType;
          G.heli.maxLoad = _ht.maxLoad;
          G.heli.accel = _ht.accel;
          G.heli.friction = _ht.friction;
          G.heli.tiltSpeed = _ht.tiltSpeed;
          G.heli.fuelRate = _ht.fuelRate;
          G.heli.liftPower = _ht.liftPower;
          G.heli.cargoResist = _ht.cargoResist;

          void launchMission(false);
      };

if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview') && _previewLaunch) {
    window.addEventListener('message', e => {
        if (e.data?.type === 'preview-mission') _previewLaunch(e.data.mission, e.data.heliType);
        if (e.data?.type === 'preview-reset')
            _previewLaunch((campaignHandler as any).getPreviewMissionData?.(), e.data.heliType);
    });
}

// ── Minimal startup for workbench preview (DEV only) ──────────────────────────
const _onloadPreview = !import.meta.env.DEV
    ? undefined
    : () => {
          assertDom();
          mountGameOverlays();
          mountGameScreens();
          mountBriefing();
          mountMinimap();
          zinit();
          soundHandler.mute();
          setSfxEnabled(false);
          setupTouchControls();
      };

window.onload = () => {
    requestAnimationFrame(() => {
        void (async () => {
            if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview') && _onloadPreview) {
                _onloadPreview();
                return;
            }
            if (_IS_APP) {
                await initAppStorage([STORAGE_KEY, LANG_PREF_KEY, CTRL_MODE_KEY, 'zw_music', 'zw_sfx']);
                _session = loadSession();
                const _sl = storageGet(LANG_PREF_KEY);
                if (_sl === 'de' || _sl === 'en') setLanguage(_sl);
            }
            _onloadMain();
        })();
    });
};

const _onloadMain = () => {
    if (!_IS_APP && new URLSearchParams(window.location.search).has('imprint')) {
        document.head.insertAdjacentHTML(
            'beforeend',
            `<style>
                body{background:#050505;color:#5f5;font-family:monospace;margin:0;padding:24px max(24px,env(safe-area-inset-left,0px));overflow-x:hidden;position:static;height:auto;width:auto;}
                h1{color:#ff6600;font-size:clamp(24px,5vw,42px);letter-spacing:6px;margin-bottom:4px;font-weight:bold;}
                h2{color:#ff6600;font-size:11px;letter-spacing:4px;font-weight:bold;margin:28px 0 10px;border-bottom:1px solid #1a1a1a;padding-bottom:6px;}
                p{color:#666;font-size:12px;line-height:1.8;margin:4px 0;letter-spacing:0.5px;}
                .sub{color:#5f5;letter-spacing:4px;font-size:12px;margin-bottom:36px;}
                .lang-row{margin-bottom:28px;}
                .lang-btn{background:none;border:1px solid #333;color:#444;font-family:monospace;font-size:11px;letter-spacing:3px;padding:4px 14px;cursor:pointer;margin-right:8px;}
                .lang-btn.active{border-color:#5f5;color:#5f5;}
                .block{padding-left:10px;border-left:1px solid #1a1a1a;}
                .wrap{max-width:640px;margin:0 auto;padding-bottom:48px;}
                .wrap[data-lang="en"] .sec-de{display:none;}
                .wrap[data-lang="de"] .sec-en{display:none;}
            </style>`
        );
        const _rows = (lines: readonly string[]) => lines.map(l => (l ? `<p>${l}</p>` : '<br>')).join('');
        const _initLang = navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
        document.body.innerHTML = `<div class="wrap" id="imp" data-lang="${_initLang}">
                <h1>SAR: CALLSIGN WOLF</h1>
                <div class="sub">${I18N_EN.LEGAL_TITLE} · ${I18N_DE.LEGAL_TITLE}</div>
                <div class="lang-row">
                    <button class="lang-btn en" onclick="document.getElementById('imp').dataset.lang='en';document.querySelector('.lang-btn.en').classList.add('active');document.querySelector('.lang-btn.de').classList.remove('active')">ENGLISH</button>
                    <button class="lang-btn de" onclick="document.getElementById('imp').dataset.lang='de';document.querySelector('.lang-btn.de').classList.add('active');document.querySelector('.lang-btn.en').classList.remove('active')">DEUTSCH</button>
                </div>

                <h2 class="sec-en">${I18N_EN.LEGAL_IMPRESSUM_HEADING}</h2>
                <div class="block sec-en">${_rows(I18N_EN.LEGAL_IMPRESSUM)}</div>
                <h2 class="sec-de">${I18N_DE.LEGAL_IMPRESSUM_HEADING}</h2>
                <div class="block sec-de">${_rows(I18N_DE.LEGAL_IMPRESSUM)}</div>

                <h2 class="sec-en">${I18N_EN.LEGAL_DATENSCHUTZ_HEADING}</h2>
                <div class="block sec-en">${_rows(LEGAL_DATENSCHUTZ_IMPRINT.en)}</div>
                <h2 class="sec-de">${I18N_DE.LEGAL_DATENSCHUTZ_HEADING}</h2>
                <div class="block sec-de">${_rows(LEGAL_DATENSCHUTZ_IMPRINT.de)}</div>
            </div>`;
        document.documentElement.style.overflowY = 'auto';
        document.body.style.overflowY = 'auto';
        const initBtn = document.querySelector<HTMLElement>(`.lang-btn.${_initLang}`);
        if (initBtn) initBtn.classList.add('active');
        return;
    }
    assertDom();
    if (!_IS_APP) {
        initMpGame({
            cancelRaf: () => {
                cancelAnimationFrame(_rafId);
                _rafId = 0;
            },
            ctx,
            getPlayerName: () => _session.playerName || 'WOLF',
            setTouchVisible,
            setSelectedCampaignIndex: (i: number) => {
                _selectedCampaignIndex = i;
            },
            launchMission,
            showMsg,
        });
    }
    const _mountScreens = () => {
        mountCreditsScreen(toMainMenu);
        mountLegalScreen(toMainMenu);
        mountMainMenu({
            onSplashClick: toMainMenu,
            onStart: toCampaignSelect,
            ...(!_IS_APP ? { onMultiplayer: toMpLobby } : {}),
            onSettings: toSettings,
            onCredits: toCredits,
            onLegal: toLegalScreen,
        });
        mountBriefing();
        mountSettings();
        mountRankup();
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

    // Apply saved preferences on startup
    if (!_getPref('zw_music', true)) soundHandler.mute();
    setSfxEnabled(_getPref('zw_sfx', true));

    // DEV mode: mute everything initially
    if (import.meta.env.DEV) {
        soundHandler.mute();
        setSfxEnabled(false);
    }

    if (_isTouchDevice()) {
        mountPauseButton({
            isMusicEnabled: () => !soundHandler.state.isMuted,
            setMusicEnabled: (v: boolean) => {
                v ? soundHandler.unmute() : soundHandler.mute();
                _setPref('zw_music', v);
            },
            isSfxEnabled: () => isSfxEnabled(),
            setSfxEnabled: (v: boolean) => {
                setSfxEnabled(v);
                _setPref('zw_sfx', v);
            },
            getControlMode,
            setControlMode,
            onPause: () => {
                cancelAnimationFrame(_rafId);
                _rafId = 0;
                stopHeliSound();
                soundHandler.stop();
            },
            onResume: () => {
                if (!soundHandler.state.isMuted) soundHandler.play(soundHandler.state.activeTheme, false, 0.4);
                initHeliSound(G.heli.type);
                _rafId = requestAnimationFrame(drawScene);
            },
            onAbort: () => returnToBase(),
        });
    }

    initSettings({
        getSession: () => _session,
        saveSession,
        getRankMissions: _getRankMissions,
        getControlMode,
        setControlMode,
        isTouchDevice: _isTouchDevice,
        isMusicEnabled: () => !soundHandler.state.isMuted,
        setMusicEnabled: (v: boolean) => {
            v ? soundHandler.unmute() : soundHandler.mute();
            _setPref('zw_music', v);
        },
        isSfxEnabled: () => isSfxEnabled(),
        setSfxEnabled: (v: boolean) => {
            setSfxEnabled(v);
            _setPref('zw_sfx', v);
        },
        onBack: animMainMenuBg,
    });
    if (!_IS_APP) mountWhatsNew();
    onLanguageChange(_mountScreens);
    setupTouchControls();
    startMenuParticles();

    const _showSplash = () => {
        showScreen('splash');
    };

    const _afterConsent = () => {
        if (!_IS_APP) {
            const shown = showWhatsNewIfNeeded(_session.lastSeenVersion, () => {
                _session.lastSeenVersion = I18N.WHATS_NEW_VERSION;
                saveSession(_session);
                _showSplash();
            });
            if (!shown) {
                _session.lastSeenVersion = I18N.WHATS_NEW_VERSION;
                saveSession(_session);
                _showSplash();
            }
        } else {
            _showSplash();
        }
    };

    // Show cookie banner if consent not yet given, expired, or privacy notice was updated
    if (!_IS_APP && (_session.cookieConsent === null || isConsentExpired(_session) || isConsentOutdated(_session))) {
        _session.cookieConsent = null;
        _session.consentTimestamp = null;
        _session.consentVersion = '';
        mountCookieBanner(_afterConsent);
        (document.getElementById('cookie-banner') as HTMLElement).style.display = 'flex';
    } else {
        _afterConsent();
    }
};

window.toCampaignSelect = toCampaignSelect;
window.toMainMenu = toMainMenu;
window.toCredits = toCredits;
window.backFromHeliSelect = backFromHeliSelect;
window.returnToBase = returnToBase;
window.selectCampaign = selectCampaign;
window.selectMission = selectMission;
window.startGame = startGame;
window.toSettings = toSettings;
if (!_IS_APP) {
    window.approveCookies = approveCookies;
    window.declineCookies = declineCookies;
    window.confirmDeleteSession = () => {
        storageRemove(STORAGE_KEY);
        setTimeout(() => window.location.reload(), 1200);
    };
}
