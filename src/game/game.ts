import './ui/base.css';
import './ui/screens.css';
import * as LoadingScreen from './ui/loading-screen/loading-screen';
import { ensureEl } from './ui/dom-helpers';
import { setDeliverToggle as _touchSetDeliverToggle } from './ui/touch-controls/touch-controls';
import { createIsoFn } from './render';
import { campaignHandler, soundHandler, zinit } from './main';
import { loadSession, saveSession, getRank, RANKS, STORAGE_KEY, type PlayerSession, type Rank } from './session';
import { initAppStorage, storageGet, storageSet } from './storage';
import { zstate } from './state';
import { initHeliSound, updateHeliSound, stopHeliSound, setSfxEnabled, isSfxEnabled } from './heli-sound';

import { createDrawWorld } from './draws-world/draw-world';
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
    spawnPayload,
} from './sim/world-init';
import { carrierCar } from './sim/vehicles/carrier-car';
import { fuelTruck } from './sim/vehicles/fuel-truck';
import { initParticles, spawnExplosion, type ParticlesCtx } from './sim/particles';
import { updatePhysics } from './sim/simulation';
import { voiceEvents } from './voice-events';
import { mountVoiceLine, hideVoiceLine } from './ui/voice-line/voice-line';
import { createDrawObjects } from './draw-objects';
import { initFoliageFromMission, createFoliage } from './foliage';
import { initNpcHelisFromMission, updateNpcHelis } from './sim/npc-helis';
import { createDrawTerrain } from './draw-terrain';
import { tileW as _tileW, tileH as _tileH, stepH as _stepH, gameRenderScale } from './render-config';
const tileW = Math.round(_tileW * gameRenderScale);
const tileH = Math.round(_tileH * gameRenderScale);
const stepH = _stepH * gameRenderScale;
import * as CreditsScreen from './ui/credits-screen/credits-screen';
import * as LegalScreen from './ui/legal-screen/legal-screen';
import { startMenuParticles, stopMenuParticles } from './ui/menu-particles/menu-particles';
import * as HeliSelect from './ui/heli-select/heli-select';
import { I18N, LANG_PREF_KEY, localize, onLanguageChange, setLanguage } from './i18n';
import * as Briefing from './ui/briefing/briefing';
import * as Settings from './ui/settings/settings';
import * as Rankup from './ui/rankup/rankup';
import * as PauseOverlay from './ui/pause-overlay/pause-overlay';
import * as MainMenu from './ui/main-menu/main-menu';
import * as MissionSelect from './ui/mission-select/mission-select';
import * as CampaignSelect from './ui/campaign-select/campaign-select';
import * as MissionFailedScreen from './ui/mission-failed-screen/mission-failed-screen';
import * as MissionSuccessScreen from './ui/mission-success-screen/mission-success-screen';
import * as CampaignCompleteScreen from './ui/campaign-complete-screen/campaign-complete-screen';
import * as CampaignEndScreen from './ui/campaign-end-screen/campaign-end-screen';
import { showScreen } from './ui/nav';
import { mountMinimap, initMinimapTerrain } from './ui/minimap/minimap';
import { createHud } from './ui/hud/hud';
import {
    initTutorial,
    tutorialTick,
    destroyTutorial,
    isTutorialRunning,
    getAllowedKeys,
    isTutorialFuelLocked,
} from './ui/tutorial/tutorial';
import { requestReview } from './reviewRequest';
import { VESSEL, PAYLOAD, CAMPAIGN_TYPE } from '../shared/types';

const assertDom = () => {
    if (!document.getElementById('gameCanvas')) {
        throw new Error('[z] Missing DOM element: gameCanvas');
    }
};

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

const hasCarrier = () => _missionHasCarrier;
const hasPad = () => _missionHasPad;
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
    getLighthouse: () => (_missionHasLighthouse ? { x: _lighthouseX, y: _lighthouseY } : null),
    getWindStr: () => _missionWindStr,
    isNight: () => _missionNight,
    isMissionRain: () => _missionRain,
    getShowCollisionBoxes: () => showCollisionBoxes,
    triggerCrash: () => _physicsCtx.triggerCrash(),
});
const {
    drawWorldObjects,
    drawBirds,
    drawDebris,
    drawPayloadObjects,
    renderRain,
    drawDebugOverlay,
    handleCollisionBoxes,
} = _drawWorldFns;

const { drawTrees, rebuildEntryCache } = createFoliage({
    canvas,
    tileW,
    tileH,
    drawTree,
    sceneAdd: (def, opts) => SceneRenderer.add(def, opts),
    isNight: () => _missionNight,
});

HeliSelect.init(G, drawHeli);
Rankup.init(drawHeli);

// ─── helper flags ────────────────────────────────────────────────────────────
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

import { buildStartZone } from './start-zone';

// ─── screens ────────────────────────────────────────────────────────────────
const _stopMission = () => {
    cancelAnimationFrame(_rafId);
    _rafId = 0;
    zstate.gameStarted = false;
    destroyTutorial();
    PauseOverlay.hide();
    stopHeliSound();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _hud.showAll(false);
    setTouchVisible(false);
    _showRainOverlay(false);
    const flashEl = document.getElementById('flash-overlay');
    if (flashEl) flashEl.style.opacity = '0';
    hideVoiceLine();
};

const triggerCrash = () => {
    if (zstate.crashed) return;
    voiceEvents.emit('mayday');
    stopHeliSound();
    soundHandler.play('final');
    spawnExplosion({ ctx: _makePCtx(), dt: 0 });
    zstate.crashed = true;
    setTimeout(() => {
        _stopMission();
        MissionFailedScreen.show();
    }, 1800);
};

const missionComplete = () => {
    destroyTutorial();
    const { campaignType } = campaignHandler.getCurrentMissionData();
    const isTutorial = campaignType === CAMPAIGN_TYPE.TUTORIAL;

    const prevRank = getRank(_session.rankOverride ?? 0, _getRankMissions());

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
    // Credits only on first completion: highest hasn't passed this campaign index yet
    const firstCompletion = allDone && !(_selectedCampaignIndex < (_session.highestUnlockedCampaignIndex ?? 0));
    if (allDone) {
        cp.completed = true;
        if (campaignType !== CAMPAIGN_TYPE.TUTORIAL && campaignType !== CAMPAIGN_TYPE.FREE_FLIGHT) {
            // Always advance highest past this campaign (sentinel), so replay is detected via < check
            _session.highestUnlockedCampaignIndex = Math.max(
                _session.highestUnlockedCampaignIndex ?? 0,
                _selectedCampaignIndex + 1
            );
        }
    }

    // Rank check — only tutorial missions don't count
    let rankUpRank: Rank | null = null;
    if (!isTutorial) {
        const newRank = getRank(_session.rankOverride ?? 0, _getRankMissions());
        if (newRank.key !== prevRank.key) rankUpRank = newRank;
    }

    saveSession(_session);
    _stopMission();

    // Review triggers: first campaign completion, or promotion — Apple limits to 3×/year
    if (firstCompletion || rankUpRank) requestReview();

    if (firstCompletion) {
        const isStoryCampaign = campaignType !== CAMPAIGN_TYPE.TUTORIAL && campaignType !== CAMPAIGN_TYPE.FREE_FLIGHT;
        soundHandler.play('success');
        const showEndScreen = isStoryCampaign
            ? () => {
                const campaignTitle = campaignHandler.getCampaigns()[_selectedCampaignIndex]?.campaignTitle;
                const name =
                    typeof campaignTitle === 'string' ? campaignTitle : (campaignTitle?.de ?? campaignTitle?.en ?? '');
                CampaignEndScreen.show(name, () => soundHandler.play('destroid'));
            }
            : () => CampaignCompleteScreen.show('');
        if (rankUpRank) {
            Rankup.show(
                rankUpRank,
                HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.id,
                showEndScreen,
            );
        } else {
            showEndScreen();
        }
        return;
    }

    const heliType = G.heli.type;
    const nextMissionIndex = _selectedMissionIndex + 1;
    const hasNext = nextMissionIndex < totalMissions
        && campaignType !== CAMPAIGN_TYPE.FREE_FLIGHT
        && !isTutorial;

    const onBack = () => {
        MissionSuccessScreen.hide();
        zstate.gameStarted = false;
        setTouchVisible(false);
        _hud.showAll(false);
        _resetHeliState();
        if (isTutorial) _openCampaignSelect(); else _openMissionSelect();
        if (rankUpRank)
            Rankup.show(rankUpRank, HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.id);
    };

    const onNext = hasNext ? () => {
        MissionSuccessScreen.hide();
        zstate.gameStarted = false;
        _resetHeliState();
        _selectedMissionIndex = nextMissionIndex;
        campaignHandler.campaign.setActiveMission(nextMissionIndex);
        const { gridSize, objects: selObjects } = campaignHandler.getCurrentMissionData();
        const selPad = (selObjects || []).find((o: any) => o.type === VESSEL.PAD) || { x: 10, y: 10 };
        G.PAD = { xMin: selPad.x, xMax: selPad.x + 7, yMin: selPad.y, yMax: selPad.y + 7, z: 0.5 };
        G.START_POS = { x: selPad.x + 4, y: selPad.y + 4 };
        initGrid(gridSize, G.points);
        startGame(heliType);
        if (rankUpRank)
            Rankup.show(rankUpRank, HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.id);
    } : null;

    MissionSuccessScreen.mount(onNext, onBack, isTutorial ? I18N.TO_CAMPAIGN_SELECT : undefined);
    MissionSuccessScreen.show();
};

const _resetHeliState = () => {
    zstate.crashed = false;
    G.heli.fuel = 100;
    G.heli.onboard = 0;
    G.heli.onboardDeliverQueue = [];
    G.heli.engineOn = false;
    G.heli.rotorRPM = 0;
    G.heli.vx = 0;
    G.heli.vy = 0;
    G.heli.vz = 0;
    G.particles = [];
    G.debris = [];
    G.totalRescued = 0;
};

const returnToBase = () => {
    _stopMission();
    zstate.gameStarted = false;
    _resetHeliState();

    CampaignCompleteScreen.hide();
    MissionFailedScreen.hide();
    MissionSuccessScreen.hide();
    Briefing.hide();
    const isTutorial = campaignHandler.getCurrentMissionData().campaignType === CAMPAIGN_TYPE.TUTORIAL;
    if (isTutorial) {
        toCampaignSelect();
    } else {
        _openMissionSelect();
    }
    soundHandler.play('maintheme');
};

const retryMission = () => {
    const heliType = G.heli.type;
    _stopMission();
    zstate.gameStarted = false;
    _resetHeliState();
    MissionFailedScreen.hide();
    campaignHandler.campaign.setActiveMission(_selectedMissionIndex);
    const { gridSize, objects: selObjects } = campaignHandler.getCurrentMissionData();
    const selPad = (selObjects || []).find((o: any) => o.type === VESSEL.PAD) || { x: 10, y: 10 };
    G.PAD = { xMin: selPad.x, xMax: selPad.x + 7, yMin: selPad.y, yMax: selPad.y + 7, z: 0.5 };
    G.START_POS = { x: selPad.x + 4, y: selPad.y + 4 };
    initGrid(gridSize, G.points);
    startGame(heliType);
};

const returnToCampaignSelect = () => {
    _stopMission();
    zstate.gameStarted = false;
    _resetHeliState();
    CampaignCompleteScreen.hide();
    Briefing.hide();
    _openCampaignSelect(); // calls showScreen('campaign-select')
    soundHandler.play('maintheme');
};

const _returnFromCampaignEnd = () => {
    CampaignEndScreen.hide();
    showScreen('main-menu');
    soundHandler.play('maintheme');
};

const _openCampaignSelect = () => {
    CampaignSelect.show({
        session: _session,
        campaigns: campaignHandler.getCampaigns(),
        onSelect: idx => selectCampaign(String(idx)),
        onBack: toMainMenu,
    });
};

// ─── campaign / G.heli select ──────────────────────────────────────────────────
const toCampaignSelect = () => {
    soundHandler.play('maintheme');
    _openCampaignSelect();
};

const selectCampaign = (index: string) => {
    _doSelectCampaign(Number(index));
};

const _doSelectCampaign = (idx: number) => {
    const campaigns = campaignHandler.getCampaigns();
    const type = campaigns[idx]?.type;
    const isAlwaysAvailable = type === CAMPAIGN_TYPE.TUTORIAL || type === CAMPAIGN_TYPE.FREE_FLIGHT;

    if (!isAlwaysAvailable) {
        saveSession(_session);
    }

    _selectedCampaignIndex = idx;
    _selectedMissionIndex = 0;
    campaignHandler.campaign.setActiveCampaign(idx);

    if (type === CAMPAIGN_TYPE.TUTORIAL) {
        selectMission(0);
        return;
    }
    _openMissionSelect(); // calls showScreen('mission-select')
};

const _openMissionSelect = () => {
    const campaigns = campaignHandler.getCampaigns();
    MissionSelect.show({
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
    const selPad = (selObjects || []).find((o: any) => o.type === VESSEL.PAD) || { x: 10, y: 10 };
    G.PAD = { xMin: selPad.x, xMax: selPad.x + 7, yMin: selPad.y, yMax: selPad.y + 7, z: 0.5 };
    G.START_POS = { x: selPad.x + 4, y: selPad.y + 4 };
    initGrid(gridSize, G.points);

    if (campaignType === CAMPAIGN_TYPE.TUTORIAL) {
        startGame('dolphin');
        return;
    }

    HeliSelect.show({
        rankIndex: RANKS.indexOf(getRank(_session.rankOverride ?? 0, _getRankMissions())),
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
    if (getRank(_session.rankOverride ?? 0, _getRankMissions()).key === RANKS[RANKS.length - 1].key) return;
    if (Math.random() >= 1 / __ORNI_SPAWN_RATE__) return;
    const gridSize = campaignHandler.getTerrain().gridSize;
    const margin = 6;
    const corners = [
        { x: margin, y: margin },
        { x: gridSize - margin, y: margin },
        { x: margin, y: gridSize - margin },
        { x: gridSize - margin, y: gridSize - margin },
    ];
    const order = corners.sort(() => Math.random() - 0.5);
    for (const c of order) {
        const gz = getGround(c.x, c.y, G.points, G.CARRIER);
        if (gz <= G.waterLevel + 0.3) continue;
        spawnPayload({
            type: PAYLOAD.ORNI_WRECK,
            x: c.x,
            y: c.y,
            z: gz,
            angle: Math.random() * Math.PI * 2,
            deliverTo: VESSEL.PAD,
        }, false); // Easter Egg zählt nicht zum Spielziel
        return;
    }
};

const launchMission = async (showLoader = true): Promise<void> => {
    // Populate per-mission cache — never call getCurrentMissionData() in the render loop
    const _lmd = campaignHandler.getCurrentMissionData();
    const _lmdObjs = _lmd.objects || [];
    _missionHasPad = !!_lmdObjs.find((o: any) => o.type === VESSEL.PAD);
    _missionHasCarrier = !!_lmdObjs.find((o: any) => o.type === VESSEL.CARRIER);
    _missionHasLighthouse = !!_lmdObjs.find((o: any) => o.type === VESSEL.LIGHTHOUSE);
    _missionRain = !!_lmd.rain;
    _missionNight = !!_lmd.night;
    _missionWindStr = _lmd.windStr ?? 1;
    _missionWindDir = _lmd.windDir ?? 0;
    _missionWindVar = !!_lmd.windVar;
    G.waterLevel = _lmd.waterLevel ?? 0;
    const _lhObj = _lmdObjs.find((o: any) => o.type === VESSEL.LIGHTHOUSE);
    _lighthouseX = _lhObj ? _lhObj.x : -1;
    _lighthouseY = _lhObj ? _lhObj.y : -1;
    _missionGridSize = campaignHandler.getTerrain().gridSize;

    const handle = showLoader ? LoadingScreen.show(localize(_lmd.headline) || 'MISSION') : null;

    // Step 1 — terrain
    generateTerrain(G.points, _missionHasPad ? { ...G.PAD, yMin: G.PAD.yMin - 3 } : null);
    G.sandPoints = campaignHandler.getTerrain().sand ?? [];
    initMinimapTerrain(G.points, _missionGridSize, G.waterLevel);
    precomputeDayColors(_missionRain);
    handle?.step('Gelände…', 0.25);
    if (handle) await _tick();

    // Step 2 — objects
    initCarrierFromMission();
    if (hasCarrier()) carrierCar.init();
    initBoatsFromMission();
    initSubmarinesFromMission();
    initStaticObjectsFromMission();
    G.LANDING_ZONES = [];
    G.RESEARCH_PLATFORMS.forEach((rp: any) => {
        const lz = (RESEARCH_PLATFORM_DEF as any).landingZone;
        if (lz) {
            G.LANDING_ZONES.push({
                xMin: rp.x + lz.x - lz.w,
                xMax: rp.x + lz.x + lz.w,
                yMin: rp.y + lz.y - lz.h,
                yMax: rp.y + lz.y + lz.h,
                z: G.waterLevel + lz.z,
            });
        }
    });
    handle?.step('Objekte…', 0.5);
    if (handle) await _tick();

    // Step 3 — environment
    initFoliageFromMission();
    rebuildEntryCache();
    initParticles({ ctx: _makePCtx(), dt: 0 });
    G.deliverMode = false;
    initPayloadsFromMission();
    initNpcHelisFromMission();
    _maybeSpawnOrniWreck();
    if (hasPad()) fuelTruck.init();
    handle?.step('Umgebung…', 0.75);
    if (handle) await _tick();

    // Step 4 — ready; wait for minimum display time then fade out
    handle?.step(I18N.LOADING_READY, 1.0);
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
    try { soundHandler.play(_lmd.music || 'clike', 'game'); } catch { /* audio unavailable */ }
    initHeliSound(G.heli.type);
    _briefingActive = true;
    _rafId = requestAnimationFrame(drawScene);
    PauseOverlay.show();

    const rank = getRank(_session.rankOverride ?? 0, _getRankMissions());
    const address = I18N.BRIEFING_ADDRESS(I18N.RANK_NAME(rank.key), _session.playerName).toUpperCase();

    Briefing.show({ headline: _lmd.headline, sublines: _lmd.sublines, briefing: _lmd.briefing, address }, () => {
        _briefingActive = false;
        _missionStartTime = Date.now();
        setTouchVisible(true);

        if (_lmd.campaignType === CAMPAIGN_TYPE.TUTORIAL) {
            initTutorial(G, getGround(G.heli.x, G.heli.y, G.points, G.CARRIER), missionComplete, () => {
                const personDef = campaignHandler
                    .getCurrentMissionData()
                    .payloads?.find((p: any) => p.type === PAYLOAD.PERSON);
                if (!personDef) return;
                spawnPayload({ ...personDef, deliverTo: VESSEL.PAD }, false);
            });
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
const drawScene = () => {
    const _now = performance.now();
    if (_fpsLastTime > 0 && _now - _fpsLastTime < 1000 / 30 - 1) {
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
    if (!zstate.gameStarted) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tx = (G.heli.x - G.heli.y) * (tileW / 2);

    const ty = (G.heli.x + G.heli.y) * (tileH / 2) - G.heli.z * stepH;
    zstate.cam.x = tx;
    zstate.cam.y = ty;

    const camX = zstate.cam.x,
        camY = zstate.cam.y;

    let rx: number, ry: number;

    rx = camX / tileW + camY / tileH;
    ry = camY / tileH - camX / tileW;

    drawTerrain(camX, camY, rx, ry, isNight, rain);

    const _visMargin = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH) * 2) + 8;

    // flapRate: vertical climb + horizontal speed (braking from speed → faster flapping)
    const _flapRate = Math.max(0.5, Math.min(3.0, 1.0 + G.heli.vz * 20 + Math.hypot(G.heli.vx, G.heli.vy) * 8));

    // shadow pass — before world objects so shadow appears on terrain, not over objects
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
    }

    // ground persons drawn before world objects for correct depth order
    if (!zstate.crashed) drawPayloadObjects(false);

    drawWorldObjects(
        camX,
        camY,
        _visMargin,
        !zstate.crashed
            ? {
                  x: G.heli.x,
                  y: G.heli.y,
                  fn: (cx, cy) => {
                      // ropes, payload figures + rescuer all BEFORE heli — heli always on top
                      drawPayloadObjects(true, true);
                      drawPayloadObjects(true, false);

                      // winch line (only when extended and nothing hanging)
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
                      // rescuer at winch tip drawn BEFORE heli (appears behind heli body)
                      if (G.heli.winch > 0.3) {
                          const rs = G.rescuerSwing;
                          const winchTipZ = G.activePayload
                              ? G.activePayload.z +
                                (G.activePayload.type === PAYLOAD.PERSON || G.activePayload.type === PAYLOAD.RESCUER
                                    ? 0.35
                                    : 0)
                              : Math.max(getGround(rs.x, rs.y), G.heli.z - G.heli.winch);
                          drawPerson(rs.x, rs.y, winchTipZ, 0, false, cx, cy, PAYLOAD.RESCUER, undefined);
                      }

                      drawHeli(
                          G.heli.type,
                          G.heli.x,
                          G.heli.y,
                          G.heli.z,
                          G.heli.angle,
                          G.heli.tilt,
                          G.heli.roll,
                          G.heli.rotationPos,
                          cx,
                          cy,
                          {
                              shadowGetGround: (x, y) => getGround(x, y),
                              flapRate: _flapRate,
                              tailRotorRate: 1.0 + Math.abs(G.heli.roll) * 4,
                          }
                      );
                  },
              }
            : undefined,
        (cx, cy) => drawTrees(cx, cy, rx, ry)
    );

    updateNpcHelis(dt);

    // Vögel
    drawBirds(camX, camY);

    // G.particles
    G.particles.forEach(p => {
        p.vz = (p.vz || 0) + (p.gravity || 0);
        p.z = (p.z || 0) + p.vz;
        p.x += p.vx || 0;
        p.y += p.vy || 0;
        p.life -= p.isSmoke ? 0.018 : 0.025;
        let pos = isoFn(p.x, p.y, Math.max(p.z, 0), camX, camY);
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
        drawDebris(G.debris, camX, camY);
    }

    if (!zstate.crashed) {
        renderRain();
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
        playerName: _session.playerName || '',
        deliverMode: G.deliverMode,
        minimap: {
            gridSize,
            pad: hasPad() ? G.PAD : null,
            carrier: hasCarrier() ? G.CARRIER : null,
            vessels: [
                ...G.SUBMARINES.map((s: any) => ({ x: s.x, y: s.y, type: VESSEL.SUBMARINE })),
                ...G.BOATS.map((b: any) => ({ x: b.x, y: b.y, type: VESSEL.BOAT })),
            ],
            heli: G.heli,
            payloads: G.payloads,
        },
    });

    updateHeliSound(G.heli.rotorRPM, G.heli.engineOn, G.heli.type, Math.hypot(G.wind.x, G.wind.y), _flapRate);
    if (isTutorialRunning()) tutorialTick(G);
    _rafId = requestAnimationFrame(drawScene);
};

// ─── collision boxes ─────────────────────────────────────────────────────────
let showCollisionBoxes = false;
if (import.meta.env.DEV) {
    window.addEventListener('keydown', e => {
        if (e.key === 'c' || e.key === 'C') showCollisionBoxes = !showCollisionBoxes;
    });
}

// ─── main menu ───────────────────────────────────────────────────────────────
const toMainMenu = () => {
    PauseOverlay.hide();
    cancelAnimationFrame(_rafId);
    _rafId = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    zstate.gameStarted = false;
    showScreen('main-menu');
    soundHandler.play('maintheme');
    HeliSelect.animMainMenuBg();
    startMenuParticles();
};

const backFromHeliSelect = () => {
    _openMissionSelect();
};

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

const _makePCtx = (): ParticlesCtx => ({
    particles: G.particles,
    debris: G.debris,
    flocks: G.flocks,
    emitters: G.PARTICLE_EMITTERS,
    heli: G.heli,
    wind: G.wind,
    waterLevel: G.waterLevel,
    gridSize: _missionGridSize,
    getGround: (x, y) => getGround(x, y, G.points, G.CARRIER),
    getHeliType,
});

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
        return campaignHandler.getCurrentMissionData().campaignType === CAMPAIGN_TYPE.TUTORIAL;
    },
    get isTutorialFuelLocked() {
        return isTutorialFuelLocked();
    },
    get missionComplete() {
        if (isTutorialRunning()) return () => {};
        return missionComplete;
    },
    get triggerCrash() {
        if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview') && _previewLaunch) {
            return () => {
                if (zstate.crashed) return;
                stopHeliSound();
                spawnExplosion({ ctx: _makePCtx(), dt: 0 });
                zstate.crashed = true;
                setTimeout(() => {
                    _previewLaunch!((campaignHandler as any).getPreviewMissionData?.());
                }, 1800);
            };
        }
        return triggerCrash;
    },
    orniWreckDelivered() {
        _session.rankOverride = RANKS.length - 1;
        saveSession(_session);
        _stopMission();
        Rankup.show(RANKS[RANKS.length - 1], undefined);
    },
} as import('./sim/simulation').PhysicsCtx;

// ─── session ──────────────────────────────────────────────────────────────────
let _session: PlayerSession = loadSession();

const _getRankMissions = (): number => {
    const tutorialKeys = new Set(
        campaignHandler
            .getCampaigns()
            .map((c, i) => (c.type === CAMPAIGN_TYPE.TUTORIAL ? String(i) : null))
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

const _isKeyAllowed = (code: string): boolean => {
    const allowed = getAllowedKeys();
    return allowed === null || allowed.has(code);
};

if (typeof (window as any).__nativeStorage === 'undefined') {
    window.onkeydown = e => {
        if (_isKeyAllowed(e.code)) G.keys[e.code] = true;
        if ((document.activeElement as HTMLElement)?.tagName === 'INPUT') return;
    };
    window.onkeyup = e => { G.keys[e.code] = false; };
}
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
const _resizeCanvas = () => {
    const scale = 2;
    canvas.width = Math.round(window.innerWidth / scale);
    canvas.height = Math.round(window.innerHeight / scale);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
};
window.addEventListener('resize', _resizeCanvas);
_resizeCanvas();

const setTouchVisible = (v: boolean) => {
    window.webkit?.messageHandlers?.controls?.postMessage({ type: 'showControls', visible: v });
    const touchEl = document.getElementById('touch-controls');

    if (touchEl) touchEl.style.display = v ? 'flex' : 'none';
};

// ─── Native touch control state (set by Swift via window.__nativeControls) ───

const _LEFT_KEYS = ['KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight'] as const;
const _RIGHT_KEYS = ['ArrowUp', 'ArrowDown', 'KeyA', 'KeyD'] as const;

(window as any).__nativeControls = (input: {
    leftKey: string | null;
    rightKey: string | null;
    pitchWheel: { dy: number; active: boolean };
    deliverBtn: boolean;
}) => {
    for (const k of _LEFT_KEYS) (G.keys as Record<string, boolean>)[k] = false;
    for (const k of _RIGHT_KEYS) (G.keys as Record<string, boolean>)[k] = false;
    if (input.leftKey && _isKeyAllowed(input.leftKey)) (G.keys as Record<string, boolean>)[input.leftKey] = true;
    if (input.rightKey && _isKeyAllowed(input.rightKey)) (G.keys as Record<string, boolean>)[input.rightKey] = true;
    (G.keys as Record<string, boolean>)['KeyQ'] = input.pitchWheel.active && input.pitchWheel.dy < -6;
    (G.keys as Record<string, boolean>)['KeyE'] = input.pitchWheel.active && input.pitchWheel.dy > 6;
    (G.keys as Record<string, boolean>)['KeyR'] = input.deliverBtn;
};

const setupTouchControls = () => {
    /* right stick always in screen mode — no init needed */
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
    mountVoiceLine();
};

const mountGameScreens = () => {
    ['campaign-select', 'mission-select', 'heli-select'].forEach(id => {
        _ensureEl(id).classList.add('ui-screen');
    });
    MissionSelect.mount();
    CampaignSelect.mount();
    HeliSelect.mount();
    MissionFailedScreen.mount(returnToBase, retryMission);
    // MissionSuccessScreen is mounted per-mission in missionComplete
    CampaignCompleteScreen.mount(returnToCampaignSelect);
    CampaignEndScreen.mount(_returnFromCampaignEnd);
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
          Briefing.hide();

          // Reset heli + state
          zstate.crashed = false;
          zstate.gameStarted = false;
          G.heli.fuel = 100;
          G.heli.onboard = 0;
          G.heli.onboardDeliverQueue = [];
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
          const padObj = objs.find((o: any) => o.type === VESSEL.PAD) ||
              objs.find((o: any) => o.type === VESSEL.CARRIER) || { x: 10, y: 10 };
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
    const _previewBc = new BroadcastChannel('editor-preview');
    _previewBc.onmessage = e => {
        if (e.data?.type === 'mission-update' && e.data.mission) _previewLaunch(e.data.mission);
    };
}

// ── Minimal startup for workbench preview (DEV only) ──────────────────────────
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
          setupTouchControls();

          // Auto-launch from URL params — no cross-origin messaging needed
          const params = new URLSearchParams(location.search);
          const campaignType = params.get('preview') ?? '';
          const missionIdx = parseInt(params.get('mission') ?? '0', 10);
          const allCampaigns = campaignHandler.getCampaigns();
          const campaign = allCampaigns.find(c => c.type === campaignType) ?? allCampaigns[0];
          if (campaign && _previewLaunch) {
              const mission = campaign.levels[missionIdx] ?? campaign.levels[0];
              if (mission) _previewLaunch(mission);
          }
      };

window.onload = () => {
    requestAnimationFrame(() => {
        void (async () => {
            if (import.meta.env.DEV && new URLSearchParams(location.search).has('preview') && _onloadPreview) {
                _onloadPreview();
                return;
            }
            await initAppStorage([STORAGE_KEY, LANG_PREF_KEY, 'z_music', 'z_sfx']);
            _session = loadSession();
            const _sl = storageGet(LANG_PREF_KEY);
            if (_sl === 'de' || _sl === 'en') setLanguage(_sl);
            _onloadMain();
        })();
    });
};

const _onloadMain = () => {
    assertDom();
    const _mountScreens = () => {
        CreditsScreen.mount(toMainMenu);
        LegalScreen.mount(toMainMenu);
        MainMenu.mount({
            onSplashStart: () => soundHandler.play('maintheme'),
            onSplashClick: toMainMenu,
            onStart: toCampaignSelect,
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

    // Apply saved preferences on startup
    if (!_getPref('z_music', true)) soundHandler.mute();
    setSfxEnabled(_getPref('z_sfx', true));

    // DEV mode: mute everything initially
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
            cancelAnimationFrame(_rafId);
            _rafId = 0;
            stopHeliSound();
            setTouchVisible(false);
        },
        onResume: () => {
            initHeliSound(G.heli.type);
            _rafId = requestAnimationFrame(drawScene);
            setTouchVisible(true);
        },
        onAbort: () => returnToBase(),
    });

    Settings.init({
        getSession: () => _session,
        saveSession,
        getRankMissions: _getRankMissions,
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
            _session.playerName = '';
            _session.highestUnlockedCampaignIndex = 0;
            _session.campaignProgress = {};
            _session.rankOverride = 0;
            saveSession(_session);
        },
    });
    onLanguageChange(_mountScreens);
    setupTouchControls();
    startMenuParticles();

    showScreen('splash');
};

window.toCampaignSelect = toCampaignSelect;
window.toMainMenu = toMainMenu;
window.toCredits = CreditsScreen.show;
window.backFromHeliSelect = backFromHeliSelect;
window.returnToBase = returnToBase;
window.selectCampaign = selectCampaign;
window.selectMission = selectMission;
window.startGame = startGame;
window.toSettings = Settings.show;
