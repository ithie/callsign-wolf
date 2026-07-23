// ── Game Flow ─────────────────────────────────────────────────────────────────
// Mission lifecycle: launch, complete, crash, navigation, session handling.
// Render-side deps (ctx, canvas, hud, drawScene) are injected via initFlow().

import { campaignHandler, soundHandler } from './main';
import { G, zstate } from './state';
import { loadSession, saveSession, getRank, RANKS, type PlayerSession } from './session';
import { getHeliType, HELI_TYPES } from './heli-types';
import { initHeliSound, stopHeliSound } from './heli-sound';
import { getGround, initGrid, generateTerrain } from './sim/terrain';
import {
    initCarrierFromMission,
    initBoatsFromMission,
    initSubmarinesFromMission,
    initStaticObjectsFromMission,
    initPayloadsFromMission,
    initRingsFromMission,
    spawnPayload,
} from './sim/world-init';
import { carrierCar } from './sim/vehicles/carrier-car';
import { fuelTruck } from './sim/vehicles/fuel-truck';
import { initParticles, spawnExplosion, spawnPositionExplosion, type ParticlesCtx } from './sim/particles';
import { initNpcHelisFromMission } from './sim/npc-helis';
import { initFoliageFromMission } from './foliage';
import { buildStartZone } from './start-zone';
import { VESSEL, PAYLOAD, CAMPAIGN_TYPE } from '../shared/types';
import { I18N, localize } from './i18n';
import { voiceEvents } from './voice-events';
import { hideVoiceLine } from './ui/voice-line/voice-line';
import { requestReview } from './reviewRequest';
import RESEARCH_PLATFORM_DEF from './models/research_platform.zdef';
import * as LoadingScreen from './ui/loading-screen/loading-screen';
import { showScreen } from './ui/nav';
import * as Briefing from './ui/briefing/briefing';
import * as HeliSelect from './ui/heli-select/heli-select';
import { initMinimapTerrain } from './ui/minimap/minimap';
import * as CampaignSelect from './ui/campaign-select/campaign-select';
import * as MissionSelect from './ui/mission-select/mission-select';
import * as MissionFailedScreen from './ui/mission-failed-screen/mission-failed-screen';
import * as MissionSuccessScreen from './ui/mission-success-screen/mission-success-screen';
import * as CampaignCompleteScreen from './ui/campaign-complete-screen/campaign-complete-screen';
import * as CampaignEndScreen from './ui/campaign-end-screen/campaign-end-screen';
import * as PauseOverlay from './ui/pause-overlay/pause-overlay';
import * as Rankup from './ui/rankup/rankup';
import { startMenuParticles, stopMenuParticles } from './ui/menu-particles/menu-particles';
import {
    initTutorial,
    destroyTutorial,
} from './ui/tutorial/tutorial';
import type { Rank } from './session';

// ─── Mission-local state (exported as live bindings — game.ts reads these) ────

export let session: PlayerSession = loadSession();
export const setSession = (s: PlayerSession): void => { session = s; };
export let selectedCampaignIndex = 0;
export let selectedMissionIndex = 0;
export let missionStartTime = 0;
export let briefingActive = false;

// Mission cache — set once in launchMission, never changes mid-mission
export let missionHasPad = false;
export let missionHasCarrier = false;
export let missionHasLighthouse = false;
export let missionRain = false;
export let missionSnow = false;
export let missionPadPayloadRefill = false;
export let missionNight = false;
export let missionWindStr = 1;
export let missionWindDir = 0;
export let missionWindVar = false;
export let missionWindBft = 0;
export let lighthouseX = -1;
export let lighthouseY = -1;
export let missionGridSize = 28;
export let missionMaxTime: number | null = null;
export let missionTypeRatingFor: string | undefined;
export let hudMaxTimeRemaining: number | null = null;
export const setHudMaxTimeRemaining = (v: number | null): void => { hudMaxTimeRemaining = v; };

// ─── Render-side deps (set by initFlow before first use) ─────────────────────

interface FlowDeps {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    hud: { showAll: (v: boolean) => void };
    drawScene: () => void;
    rafRef: { id: number };
    setTouchVisible: (v: boolean) => void;
    showDebugError: (msg: string) => void;
    precomputeDayColors: (rain: boolean, snow: boolean) => void;
    rebuildEntryCache: () => void;
}

let _deps: FlowDeps;

export const initFlow = (deps: FlowDeps): void => {
    _deps = deps;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const getRankMissions = (): number => {
    const tutorialKeys = new Set(
        campaignHandler
            .getCampaigns()
            .map((c, i) => (c.type === CAMPAIGN_TYPE.TUTORIAL ? String(i) : null))
            .filter((k): k is string => k !== null)
    );
    return Object.entries(session.campaignProgress)
        .filter(([key]) => !tutorialKeys.has(key))
        .reduce((sum, [, cp]) => sum + cp.missions.reduce((s, m) => s + (m?.count ?? 0), 0), 0);
};

export const makePCtx = (): ParticlesCtx => ({
    particles: G.particles,
    debris: G.debris,
    flocks: G.flocks,
    emitters: G.PARTICLE_EMITTERS,
    heli: G.heli,
    wind: G.wind,
    waterLevel: G.waterLevel,
    gridSize: missionGridSize,
    getGround: (x, y) => getGround(x, y, G.points, G.CARRIER),
    getHeliType,
});

export const showSnowOverlay = (active: boolean): void => {
    const el = document.getElementById('snow-overlay');
    if (!el) return;
    el.style.display = active ? 'block' : 'none';
};

export const showRainOverlay = (active: boolean, windDir = 225, windStr = 1): void => {
    const el = document.getElementById('rain-overlay');
    if (!el) return;
    if (active) {
        const angleDeg = -10 + ((windDir - 225) / 360) * 20 * windStr;
        el.style.setProperty('--rain-angle', `${angleDeg.toFixed(1)}deg`);
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
};

export const updateSnowDrift = (): void => {
    if (!missionSnow) return;
    const el = document.getElementById('snow-overlay');
    if (!el) return;
    const driftX = Math.cos(G.wind.angle) * G.wind.rawStr * 80;
    el.style.setProperty('--snow-drift-x', `${driftX.toFixed(1)}px`);
};

// ─── Core mission lifecycle ───────────────────────────────────────────────────

export const stopMission = (): void => {
    cancelAnimationFrame(_deps.rafRef.id);
    _deps.rafRef.id = 0;
    zstate.gameStarted = false;
    destroyTutorial();
    PauseOverlay.hide();
    stopHeliSound();
    _deps.ctx.clearRect(0, 0, _deps.canvas.width, _deps.canvas.height);
    _deps.hud.showAll(false);
    _deps.setTouchVisible(false);
    showRainOverlay(false);
    showSnowOverlay(false);
    const flashEl = document.getElementById('flash-overlay');
    if (flashEl) flashEl.style.opacity = '0';
    hideVoiceLine();
};

export const resetHeliState = (): void => {
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

export const triggerCrash = (): void => {
    if (zstate.crashed) return;
    voiceEvents.emit('mayday');
    stopHeliSound();
    soundHandler.play('final');
    spawnExplosion({ ctx: makePCtx(), dt: 0 });
    zstate.crashed = true;
    setTimeout(() => {
        stopMission();
        MissionFailedScreen.mount(
            returnToBase,
            retryMission,
            missionTypeRatingFor ? I18N.TYPE_RATING_FAILED : undefined
        );
        MissionFailedScreen.show();
    }, 1800);
};

export const returnToBase = (): void => {
    stopMission();
    zstate.gameStarted = false;
    resetHeliState();
    CampaignCompleteScreen.hide();
    MissionFailedScreen.hide();
    MissionSuccessScreen.hide();
    Briefing.hide();
    _openMissionSelect();
    soundHandler.play('maintheme');
};

export const retryMission = (): void => {
    const heliType = G.heli.type;
    stopMission();
    zstate.gameStarted = false;
    resetHeliState();
    MissionFailedScreen.hide();
    campaignHandler.campaign.setActiveMission(selectedMissionIndex);
    const { gridSize, objects: selObjects } = campaignHandler.getCurrentMissionData();
    const selPad = (selObjects || []).find((o: any) => o.type === VESSEL.PAD) || { x: 10, y: 10 };
    G.PAD = { xMin: selPad.x, xMax: selPad.x + 7, yMin: selPad.y, yMax: selPad.y + 7, z: 0.5 };
    G.START_POS = { x: selPad.x + 4, y: selPad.y + 4 };
    initGrid(gridSize, G.points);
    startGame(heliType);
};

export const returnToCampaignSelect = (): void => {
    stopMission();
    zstate.gameStarted = false;
    resetHeliState();
    CampaignCompleteScreen.hide();
    Briefing.hide();
    _openCampaignSelect();
    soundHandler.play('maintheme');
};

// ─── Mission completion ───────────────────────────────────────────────────────

export const missionComplete = (): void => {
    destroyTutorial();
    const { campaignType } = campaignHandler.getCurrentMissionData();
    const isTutorial = campaignType === CAMPAIGN_TYPE.TUTORIAL;

    const prevRank = getRank(session.rankOverride ?? 0, getRankMissions());

    const elapsed = Date.now() - missionStartTime;
    const campaignKey = String(selectedCampaignIndex);
    if (!session.campaignProgress[campaignKey]) {
        session.campaignProgress[campaignKey] = { completed: false, missions: [] };
    }
    const cp = session.campaignProgress[campaignKey];
    if (!cp.missions[selectedMissionIndex]) {
        cp.missions[selectedMissionIndex] = { completed: false, bestTimeMs: null, count: 0 };
    }
    const mp = cp.missions[selectedMissionIndex];
    mp.completed = true;
    mp.count = (mp.count ?? 0) + 1;
    if (missionStartTime > 0 && (mp.bestTimeMs === null || elapsed < mp.bestTimeMs)) {
        mp.bestTimeMs = elapsed;
    }

    const campaigns = campaignHandler.getCampaigns();
    const totalMissions = campaigns[selectedCampaignIndex].levels.length;
    const allDone = cp.missions.filter((m, i) => i < totalMissions && m?.completed).length >= totalMissions;
    const firstCompletion = allDone && !(selectedCampaignIndex < (session.highestUnlockedCampaignIndex ?? 0));
    if (allDone) {
        cp.completed = true;
        if (campaignType !== CAMPAIGN_TYPE.TUTORIAL && campaignType !== CAMPAIGN_TYPE.FREE_FLIGHT) {
            session.highestUnlockedCampaignIndex = Math.max(
                session.highestUnlockedCampaignIndex ?? 0,
                selectedCampaignIndex + 1
            );
        }
    }

    let rankUpRank: Rank | null = null;
    if (!isTutorial) {
        const newRank = getRank(session.rankOverride ?? 0, getRankMissions());
        if (newRank.key !== prevRank.key) rankUpRank = newRank;
    }

    const _rankUpHeliId = rankUpRank
        ? HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.id
        : undefined;
    const typeRatingHint = _rankUpHeliId && !session.typeRatings?.[_rankUpHeliId]
        ? I18N.TYPE_RATING_UNLOCKED(HELI_TYPES.find(h => h.id === _rankUpHeliId)!.label)
        : undefined;

    const isFirstTypeRating = !!(missionTypeRatingFor && !session.typeRatings?.[missionTypeRatingFor]);
    if (missionTypeRatingFor) {
        const heliId = missionTypeRatingFor;
        if (!session.typeRatings) session.typeRatings = {};
        session.typeRatings[heliId] = true;
        if (!session.typeRatingBestTime) session.typeRatingBestTime = {};
        if (missionStartTime > 0) {
            const t = Date.now() - missionStartTime;
            if (!session.typeRatingBestTime[heliId] || t < session.typeRatingBestTime[heliId]) {
                session.typeRatingBestTime[heliId] = t;
            }
        }
    }

    saveSession(session);
    stopMission();

    if (firstCompletion || rankUpRank) requestReview();

    if (firstCompletion) {
        const isStoryCampaign = campaignType !== CAMPAIGN_TYPE.TUTORIAL && campaignType !== CAMPAIGN_TYPE.FREE_FLIGHT;
        soundHandler.play('success');
        const showEndScreen = isStoryCampaign
            ? () => {
                const campaignTitle = campaignHandler.getCampaigns()[selectedCampaignIndex]?.campaignTitle;
                const name =
                    typeof campaignTitle === 'string' ? campaignTitle : (campaignTitle?.de ?? campaignTitle?.en ?? '');
                CampaignEndScreen.show(name, () => soundHandler.play('destroid'));
            }
            : () => CampaignCompleteScreen.show('');
        if (rankUpRank) {
            soundHandler.play('fanfare');
            Rankup.show(
                rankUpRank,
                HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.id,
                () => { soundHandler.play('maintheme'); showEndScreen(); },
                typeRatingHint,
            );
        } else {
            showEndScreen();
        }
        return;
    }

    const heliType = G.heli.type;
    const nextMissionIndex = selectedMissionIndex + 1;
    const hasNext = nextMissionIndex < totalMissions
        && campaignType !== CAMPAIGN_TYPE.FREE_FLIGHT
        && !isTutorial;

    const onBack = () => {
        MissionSuccessScreen.hide();
        zstate.gameStarted = false;
        _deps.setTouchVisible(false);
        _deps.hud.showAll(false);
        resetHeliState();
        _openMissionSelect();
        if (rankUpRank) {
            soundHandler.play('fanfare');
            Rankup.show(rankUpRank, HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.id, () => soundHandler.play('maintheme'), typeRatingHint);
        }
    };

    const onNext = hasNext ? () => {
        MissionSuccessScreen.hide();
        zstate.gameStarted = false;
        resetHeliState();
        selectedMissionIndex = nextMissionIndex;
        campaignHandler.campaign.setActiveMission(nextMissionIndex);
        const { gridSize, objects: selObjects } = campaignHandler.getCurrentMissionData();
        const selPad = (selObjects || []).find((o: any) => o.type === VESSEL.PAD) || { x: 10, y: 10 };
        G.PAD = { xMin: selPad.x, xMax: selPad.x + 7, yMin: selPad.y, yMax: selPad.y + 7, z: 0.5 };
        G.START_POS = { x: selPad.x + 4, y: selPad.y + 4 };
        initGrid(gridSize, G.points);
        startGame(heliType);
        if (rankUpRank) {
            soundHandler.play('fanfare');
            Rankup.show(rankUpRank, HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.id, () => soundHandler.play('maintheme'), typeRatingHint);
        }
    } : null;

    MissionSuccessScreen.mount(onNext, onBack, undefined, isFirstTypeRating ? I18N.TYPE_RATING_GRANTED : undefined);
    MissionSuccessScreen.show();
};

// ─── PhysicsCtx callbacks (exported for game-physics-ctx.ts) ─────────────────

export const orniWreckDelivered = (): void => {
    const _alreadyMajor = RANKS.indexOf(getRank(session.rankOverride ?? 0, getRankMissions())) >= RANKS.length - 1;
    if (!_alreadyMajor) {
        session.rankOverride = RANKS.length - 1;
        saveSession(session);
    }
    stopMission();
    if (_alreadyMajor) {
        returnToBase();
    } else {
        Rankup.show(RANKS[RANKS.length - 1], undefined, returnToBase);
    }
};

export const onBoatTurbineCollision = (boatIdx: number, wtIdx: number): void => {
    const b = G.BOATS[boatIdx];
    const wt = G.WIND_TURBINES[wtIdx];
    if (!b || !wt) return;
    const _boatObjIdx = b._objIdx;
    const _personsLost = G.payloads.some((p: any) =>
        !p.rescued && !p.hanging &&
        p.attachTo?.objectType === VESSEL.SUPPLY_VESSEL &&
        p.attachTo?.objectIdx === _boatObjIdx,
    );
    const bx = b.x, by = b.y, bAngle = b.angle;
    G.BOATS.splice(boatIdx, 1);
    G.BOAT_WRECKS.push({ x: bx, y: by, angle: bAngle });
    const pCtx = makePCtx();
    spawnPositionExplosion({ ctx: pCtx, dt: 0 }, bx, by, G.waterLevel + 0.5);
    G.PARTICLE_EMITTERS.push({ type: 'smoke', x: bx, y: by, gz: G.waterLevel, particles: [], spawnTimer: 0 });
    G.PARTICLE_EMITTERS.push({ type: 'fire', x: wt.x, y: wt.y, gz: wt.gz + 12.3, particles: [], spawnTimer: 0 });
    wt.collapsing = true;
    wt.collapseT = 0;
    if (_personsLost && !zstate.crashed) {
        zstate.crashed = true;
        setTimeout(() => {
            stopMission();
            MissionFailedScreen.mount(returnToBase, retryMission, undefined);
            MissionFailedScreen.show();
        }, 2500);
    }
};

// ─── Navigation ───────────────────────────────────────────────────────────────

const _openCampaignSelect = (): void => {
    CampaignSelect.show({
        session,
        campaigns: campaignHandler.getCampaigns(),
        onSelect: idx => _doSelectCampaign(Number(idx)),
        onBack: toMainMenu,
    });
};

export const toCampaignSelect = (): void => {
    soundHandler.play('maintheme');
    _openCampaignSelect();
};

export const selectCampaign = (index: string): void => {
    _doSelectCampaign(Number(index));
};

const _doSelectCampaign = (idx: number): void => {
    const campaigns = campaignHandler.getCampaigns();
    const type = campaigns[idx]?.type;
    const isAlwaysAvailable = type === CAMPAIGN_TYPE.TUTORIAL || type === CAMPAIGN_TYPE.FREE_FLIGHT;
    if (!isAlwaysAvailable) saveSession(session);

    selectedCampaignIndex = idx;
    selectedMissionIndex = 0;
    campaignHandler.campaign.setActiveCampaign(idx);

    if (type === CAMPAIGN_TYPE.TUTORIAL) {
        const tutKey = String(idx);
        const m0done = !!session.campaignProgress[tutKey]?.missions[0]?.completed;
        if (!m0done) { selectMission(0); return; }
    }
    _openMissionSelect();
};

const _openMissionSelect = (): void => {
    const campaigns = campaignHandler.getCampaigns();
    MissionSelect.show({
        campaign: campaigns[selectedCampaignIndex],
        campaignIndex: selectedCampaignIndex,
        session,
        rankIndex: RANKS.indexOf(getRank(session.rankOverride ?? 0, getRankMissions())),
        onSelect: selectMission,
        onBack: toCampaignSelect,
    });
};

export const selectMission = (missionIndex: number): void => {
    selectedMissionIndex = missionIndex;
    campaignHandler.campaign.setActiveMission(missionIndex);

    const { gridSize, objects: selObjects, campaignType } = campaignHandler.getCurrentMissionData();
    const selPad = (selObjects || []).find((o: any) => o.type === VESSEL.PAD) || { x: 10, y: 10 };
    G.PAD = { xMin: selPad.x, xMax: selPad.x + 7, yMin: selPad.y, yMax: selPad.y + 7, z: 0.5 };
    G.START_POS = { x: selPad.x + 4, y: selPad.y + 4 };
    initGrid(gridSize, G.points);

    if (campaignType === CAMPAIGN_TYPE.TUTORIAL) {
        const _tutMd = campaignHandler.getCurrentMissionData();
        startGame((_tutMd as any).heliOverride || 'dolphin');
        return;
    }

    HeliSelect.show({
        rankIndex: RANKS.indexOf(getRank(session.rankOverride ?? 0, getRankMissions())),
        typeRatings: session.typeRatings ?? {},
        onSelect: startGame,
        onBack: backFromHeliSelect,
    });
};

export const backFromHeliSelect = (): void => {
    _openMissionSelect();
};

export const toMainMenu = (): void => {
    PauseOverlay.hide();
    cancelAnimationFrame(_deps.rafRef.id);
    _deps.rafRef.id = 0;
    _deps.ctx.clearRect(0, 0, _deps.canvas.width, _deps.canvas.height);
    zstate.gameStarted = false;
    showScreen('main-menu');
    soundHandler.play('maintheme');
    HeliSelect.animMainMenuBg();
    startMenuParticles();
};

// ─── Game start / launch ──────────────────────────────────────────────────────

export const setupHeliType = (type: string): void => {
    G.heli.type = type;
    const ht = getHeliType(type);
    G.heli.maxLoad = ht.maxLoad;
    G.heli.accel = ht.accel;
    G.heli.friction = ht.friction;
    G.heli.tiltSpeed = ht.tiltSpeed;
    G.heli.fuelRate = ht.fuelRate;
    G.heli.liftPower = ht.liftPower;
    G.heli.cargoResist = ht.cargoResist;
};

export const startGame = (type: string): void => {
    if (zstate.gameStarted) return;
    stopMenuParticles();
    setupHeliType(type);
    showScreen(null);
    launchMission().catch(err => _deps.showDebugError(err instanceof Error ? (err.stack ?? err.message) : String(err)));
};

const _tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));

const _maybeSpawnOrniWreck = (): void => {
    const _orniRankIdx = RANKS.indexOf(getRank(session.rankOverride ?? 0, getRankMissions()));
    if (_orniRankIdx >= RANKS.length - 1) return;
    if (session.typeRatings?.['ornithopter']) return;
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
        const orniAngle = Math.random() * Math.PI * 2;
        G.ORNI_RESIDUES.push({ x: c.x, y: c.y, angle: orniAngle });
        spawnPayload({ type: PAYLOAD.ORNI_WRECK, x: c.x, y: c.y, z: gz, angle: orniAngle, deliverTo: VESSEL.PAD }, false);
        return;
    }
};

export const launchMission = async (showLoader = true): Promise<void> => {
    const _lmd = campaignHandler.getCurrentMissionData();
    const _lmdObjs = _lmd.objects || [];
    missionHasPad = !!_lmdObjs.find((o: any) => o.type === VESSEL.PAD);
    missionHasCarrier = !!_lmdObjs.find((o: any) => o.type === VESSEL.CARRIER);
    missionHasLighthouse = !!_lmdObjs.find((o: any) => o.type === VESSEL.LIGHTHOUSE);
    missionRain = !!_lmd.rain;
    missionSnow = !!_lmd.snow;
    missionNight = !!_lmd.night;
    missionPadPayloadRefill = !!_lmd.padPayloadRefill;
    missionWindBft = _lmd.windStr ?? 0;
    missionWindStr = missionWindBft * 0.6;
    missionWindDir = _lmd.windDir ?? 0;
    missionWindVar = !!_lmd.windVar;
    G.waterLevel = _lmd.waterLevel ?? 0;
    const _lhObj = _lmdObjs.find((o: any) => o.type === VESSEL.LIGHTHOUSE);
    lighthouseX = _lhObj ? _lhObj.x : -1;
    lighthouseY = _lhObj ? _lhObj.y : -1;
    await campaignHandler.prewarmTerrain();
    missionGridSize = campaignHandler.getTerrain().gridSize;
    missionMaxTime = (_lmd as any).maxTime ?? null;
    missionTypeRatingFor = (_lmd as any).typeRatingFor as string | undefined;
    hudMaxTimeRemaining = null;

    const handle = showLoader ? LoadingScreen.show(localize(_lmd.headline) || 'MISSION') : null;

    generateTerrain(G.points, missionHasPad ? { ...G.PAD, yMin: G.PAD.yMin - 3 } : null);
    G.sandPoints = campaignHandler.getTerrain().sand ?? [];
    G.pavementPoints = campaignHandler.getTerrain().pavement ?? [];
    initMinimapTerrain(G.points, missionGridSize, G.waterLevel);
    _deps.precomputeDayColors(missionRain, missionSnow);
    handle?.step('Gelände…', 0.25);
    if (handle) await _tick();

    initCarrierFromMission();
    if (missionHasCarrier) carrierCar.init();
    initBoatsFromMission();
    initSubmarinesFromMission();
    initStaticObjectsFromMission();
    initRingsFromMission();
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

    initFoliageFromMission();
    _deps.rebuildEntryCache();
    initParticles({ ctx: makePCtx(), dt: 0 });
    G.deliverMode = false;
    initPayloadsFromMission();
    initNpcHelisFromMission();
    _maybeSpawnOrniWreck();
    if (missionHasPad) fuelTruck.init();
    handle?.step('Umgebung…', 0.75);
    if (handle) await _tick();

    handle?.step(I18N.LOADING_READY, 1.0);
    if (handle) await handle.done();

    G.heli.winch = 0;
    zstate.crashed = false;
    zstate.gameStarted = true;
    _deps.hud.showAll(true);

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

    showRainOverlay(missionRain, _lmd.windDir ?? 225, _lmd.windStr ?? 1);
    showSnowOverlay(missionSnow);
    cancelAnimationFrame(_deps.rafRef.id);
    try { soundHandler.play(_lmd.music || 'clike', 'game'); } catch { /* audio unavailable */ }
    initHeliSound(G.heli.type);
    briefingActive = true;
    _deps.rafRef.id = requestAnimationFrame(_deps.drawScene);
    PauseOverlay.show();

    const rank = getRank(session.rankOverride ?? 0, getRankMissions());
    const address = I18N.BRIEFING_ADDRESS(I18N.RANK_NAME(rank.key), session.playerName).toUpperCase();

    Briefing.show({ headline: _lmd.headline, sublines: _lmd.sublines, briefing: _lmd.briefing, address }, () => {
        briefingActive = false;
        missionStartTime = Date.now();
        _deps.setTouchVisible(true);

        if (_lmd.campaignType === CAMPAIGN_TYPE.TUTORIAL && !(_lmd as any).heliOverride) {
            initTutorial(G, getGround(G.heli.x, G.heli.y, G.points, G.CARRIER), missionComplete, () => {
                const personDef = campaignHandler
                    .getCurrentMissionData()
                    .payloads?.find((p: any) => p.type === PAYLOAD.PERSON);
                if (!personDef) return;
                spawnPayload({ ...personDef, deliverTo: VESSEL.PAD }, false);
            });
        }
    });

    // Note: zstate.cam is not initialised here — drawScene sets it on the first frame.
};
