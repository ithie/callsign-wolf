import './ui/base.css';
import './ui/screens.css';
import { showLoadingScreen } from './ui/loading-screen/loading-screen';
import { ensureEl } from './ui/dom-helpers';
import { mountTouchControls, setDeliverToggle, initPitchWheel } from './ui/touch-controls/touch-controls';
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

import HANGAR_DEF from './models/hangar.zdef';
import TOWER_DEF from './models/tower.zdef';
import LIGHTHOUSE_DEF from './models/lighthouse.zdef';
import SAILBOAT_DEF from './models/sailboat.zdef';
import CARRIER_DEF from './models/carrier.zdef';
import SUBMARINE_DEF from './models/submarine.zdef';
import { applyParts } from './def-utils';
import { createSceneRenderer } from './scene-renderer';
import { getHeliType, HELI_TYPES } from './heli-types';
import { G } from './state';
import {
    getGround,
    initGrid,
    generateTerrain,
    initCarrierFromMission,
    initCarrierFuelCar,
    initBoatsFromMission,
    initSubmarinesFromMission,
    initPayloadsFromMission,
    initFuelTruck,
    initBirds,
    updateBirds,
    updateDebris,
    spawnExplosion,
    updatePhysics,
} from './physics';
import { createDrawObjects } from './draw-objects';
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
import {
    initHeliSelect,
    mountHeliSelect,
    showHeliSelect,
    animMainMenuBg,
} from './ui/heli-select/heli-select';
import { I18N, I18N_DE, I18N_EN, LANG_PREF_KEY, LEGAL_DATENSCHUTZ_IMPRINT, localize, onLanguageChange, setLanguage } from './i18n';
import { mountCookieBanner, notifyConsent } from './ui/cookie-banner/cookie-banner';
import { mountBriefing, showBriefingOverlay, hideBriefing } from './ui/briefing/briefing';
import { mountSettings, initSettings, toSettings } from './ui/settings/settings';
import { mountRankup, showRankUp } from './ui/rankup/rankup';
import { mountPauseButton, showPauseButton, hidePauseButton } from './ui/pause-overlay/pause-overlay';
import { mountWhatsNew, showWhatsNewIfNeeded } from './ui/whats-new/whats-new';
import { mountMainMenu } from './ui/main-menu/main-menu';
import { mountMissionSelect, showMissionSelect } from './ui/mission-select/mission-select';
import { mountCampaignSelect, showCampaignSelect } from './ui/campaign-select/campaign-select';
import { showScreen } from './ui/nav';
import { initTutorial, tutorialTick, destroyTutorial, isTutorialRunning } from './ui/tutorial/tutorial';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

const assertDom = () => {
    if (!document.getElementById('gameCanvas')) {
        throw new Error('[zeewolf] Missing DOM element: gameCanvas');
    }
};

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const _hud = (() => {
    const d = (id: string, css: string) => {
        const el = document.createElement('div');
        el.id = id;
        el.style.cssText = `position:absolute;pointer-events:none;z-index:120;display:none;${css}`;
        document.body.appendChild(el);
        return el;
    };
    const isTouch = () => ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
    const touchShadow = () => isTouch() ? 'text-shadow:0 0 3px rgba(0,0,0,0.9),0 0 3px rgba(0,0,0,0.9);' : '';
    const panel = d('hud-panel', `font:bold 13px monospace;color:#5f5;line-height:16px;white-space:nowrap;${touchShadow()}`);
    const alt      = Object.assign(document.createElement('div'), { }); panel.appendChild(alt);
    const spd      = document.createElement('div'); panel.appendChild(spd);
    const winch    = document.createElement('div'); panel.appendChild(winch);
    const fuel     = document.createElement('div'); panel.appendChild(fuel);
    const pax      = document.createElement('div'); panel.appendChild(pax);
    const obj      = document.createElement('div'); panel.appendChild(obj);
    const callsign = document.createElement('div');
    callsign.style.cssText = 'font-size:11px;color:#888;';
    panel.appendChild(callsign);

    const deliver = d('hud-deliver', 'left:0;right:0;top:20px;text-align:center;font:bold 14px monospace;color:#f90;');

    const minimap = d('minimap-dom', 'width:130px;height:130px;background:rgba(0,20,10,0.8);border:1px solid #5f5;overflow:hidden;box-sizing:border-box;');
    const mmPad = document.createElement('div');
    mmPad.style.cssText = 'position:absolute;background:#666;display:none;';
    minimap.appendChild(mmPad);
    const mmCarrier = document.createElement('div');
    mmCarrier.style.cssText = 'position:absolute;width:6px;height:6px;border-radius:50%;background:#889;transform:translate(-50%,-50%);display:none;';
    minimap.appendChild(mmCarrier);
    const mmHeli = document.createElement('div');
    mmHeli.style.cssText = 'position:absolute;width:3px;height:3px;background:#fff;transform:translate(-50%,-50%);display:none;';
    minimap.appendChild(mmHeli);
    const mmPool: HTMLElement[] = [];
    const getDot = (i: number) => {
        if (!mmPool[i]) {
            const dot = document.createElement('div');
            dot.style.cssText = 'position:absolute;width:4px;height:4px;border-radius:50%;transform:translate(-50%,-50%);display:none;';
            minimap.appendChild(dot);
            mmPool.push(dot);
        }
        return mmPool[i];
    };

    const showAll = (v: boolean) => {
        const s = v ? 'block' : 'none';
        panel.style.display = s;
        minimap.style.display = s;
    };

    return { panel, alt, spd, winch, fuel, pax, obj, callsign, deliver, minimap, mmPad, mmCarrier, mmHeli, getDot, mmPool, showAll };
})();
const isoFn = (wx: number, wy: number, wz: number, cx: number, cy: number) =>
    iso(wx, wy, wz, cx, cy, { canvas, tileW, tileH, stepH });
const SceneRenderer = createSceneRenderer(ctx, isoFn);
const { drawTree, drawPerson, drawTractor, drawFuelTruck, drawHeli } = createDrawObjects(
    ctx,
    isoFn,
    tileW,
    tileH,
    SceneRenderer
);

const { parkedHelis } = G;

initHeliSelect(G, drawHeli);

// ─── helper flags ────────────────────────────────────────────────────────────
// ─── object helpers ──────────────────────────────────────────────────────────
function getObjects() {
    return campaignHandler.getCurrentMissionData().objects || [];
}
function getObjectByType(type: string) {
    return getObjects().find(o => o.type === type) || null;
}
function hasCarrier() {
    return _missionHasCarrier;
}
function hasLighthouse() {
    return _missionHasLighthouse;
}
function hasPad() {
    return _missionHasPad;
}
function isStartsOnCarrier() {
    return campaignHandler.getCurrentMissionData().spawnObject === 'carrier';
}

function drawDebris(
    debris: any[],
    camX: number,
    camY: number,
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
) {
    debris.forEach(d => {
        const pos = iso(d.x, d.y, d.z, camX, camY, { stepH, tileW, tileH, canvas });
        const cosA = Math.cos(d.angle),
            sinA = Math.sin(d.angle);
        const hw = (d.w * tileW) / 2,
            hh = (d.h * tileW) / 2;
        const corners = [
            [-hw, -hh],
            [hw, -hh],
            [hw, hh],
            [-hw, hh],
        ].map(([lx, ly]) => ({
            x: pos.x + lx * cosA - ly * sinA,
            y: pos.y + lx * sinA * 0.5 + ly * cosA * 0.5,
        }));
        const alpha = Math.min(1.0, d.life * 0.5);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = d.color;
        ctx.strokeStyle = d.stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        corners.slice(1).forEach(c => ctx.lineTo(c.x, c.y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    });
}

function drawBirds(camX: number, camY: number) {
    G.flocks.forEach(flock => {
        flock.birds.forEach((bird: any) => {
            if (!isVisible(bird.x, bird.y, 20)) return;
            const pos = iso(bird.x, bird.y, bird.z, camX, camY, { stepH, tileW, tileH, canvas });
            // Flügelschlag: M-Form
            const wing = Math.sin(bird.wingPhase) * 3;
            const s = flock.fleeing ? 2.5 : 2.0;
            ctx.strokeStyle = flock.fleeing ? '#ccc' : '#888';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pos.x - s * 2, pos.y - wing * 0.4);
            ctx.lineTo(pos.x - s, pos.y + wing);
            ctx.lineTo(pos.x, pos.y);
            ctx.lineTo(pos.x + s, pos.y + wing);
            ctx.lineTo(pos.x + s * 2, pos.y - wing * 0.4);
            ctx.stroke();
        });
    });
}

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
};

function triggerCrash(reason: string) {
    if (zstate.crashed) return;
    stopHeliSound();
    soundHandler.play(musicConfig.defeat || 'final', false);
    spawnExplosion(G.heli, G.particles, G.debris, G.points, G.CARRIER);
    zstate.crashed = true;
    _showRainOverlay(false);
    setTimeout(() => {
        _stopMission();
        document.getElementById('campaign-failed-reason')!.innerHTML = reason;
        document.getElementById('campaign-failed-screen')!.style.display = 'flex';
    }, 1800); // Explosion erst austoben lassen
}


function missionComplete() {
    _showRainOverlay(false);
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

    if (allDone) {
        document.getElementById('campaign-complete-name')!.textContent = '';
        document.getElementById('campaign-complete-screen')!.style.display = 'flex';
        soundHandler.play(musicConfig.success || 'final', false);
        if (rankUpRank)
            showRankUp(
                rankUpRank,
                _session.playerName,
                HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.selectLabel
            );
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
            showRankUp(
                rankUpRank,
                _session.playerName,
                HELI_TYPES.find(h => h.minRankIndex === RANKS.indexOf(rankUpRank))?.selectLabel
            );
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

    if (type === 'tutorial') { selectMission(0); return; }
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
    const _lhObj = _lmdObjs.find((o: any) => o.type === 'lighthouse');
    _lighthouseX = _lhObj ? _lhObj.x : -1;
    _lighthouseY = _lhObj ? _lhObj.y : -1;
    _missionGridSize = campaignHandler.getTerrain().gridSize;

    const handle = showLoader ? showLoadingScreen(localize(_lmd.headline) || 'MISSION') : null;

    // Step 1 — terrain
    generateTerrain(G.points, _missionHasPad ? { ...G.PAD, yMin: G.PAD.yMin - 3 } : null);
    _precomputeDayColors(_missionRain);
    handle?.step('Gelände…', 0.25);
    if (handle) await _tick();

    // Step 2 — objects
    initCarrierFromMission();
    if (G.CARRIER && G.CARRIER.x !== undefined) G.CARRIER.rescueZones = CARRIER_DEF.rescueZones || [];
    if (hasCarrier()) initCarrierFuelCar();
    initBoatsFromMission();
    initSubmarinesFromMission();
    handle?.step('Objekte…', 0.5);
    if (handle) await _tick();

    // Step 3 — environment
    initFoliageFromMission();
    initBirds();
    G.deliverMode = false;
    initPayloadsFromMission();
    if (hasPad()) initFuelTruck();
    handle?.step('Umgebung…', 0.75);
    if (handle) await _tick();

    // Step 4 — ready; wait for minimum display time then fade out
    handle?.step('Bereit.', 1.0);
    if (handle) await handle.done();

    G.heli.winch = 0;
    zstate.crashed = false;
    zstate.gameStarted = true;
    _hud.showAll(true);

    if (isStartsOnCarrier()) {
        const _cosA = Math.cos(G.CARRIER.angle), _sinA = Math.sin(G.CARRIER.angle);
        G.heli.x = G.CARRIER.x + (-3.5) * _cosA;
        G.heli.y = G.CARRIER.y + (-3.5) * _sinA;
        G.heli.z = G.CARRIER.zDeck + 0.1;
        G.heli.vx = 0;
        G.heli.vy = 0;
        G.heli.vz = 0;
        G.heli.inAir = false;
        G.heli.angle = G.CARRIER.angle;
        G.heli.engineOn = false;
        G.heli.rotorRPM = 0;
        zstate.cam.x = (G.heli.x - G.heli.y) * (tileW / 2);
        zstate.cam.y = (G.heli.x + G.heli.y) * (tileH / 2);
    } else {
        G.heli.x = G.START_POS.x;
        G.heli.y = G.START_POS.y;
        G.heli.z = G.PAD?.z ?? 0.5;
        G.heli.vx = 0;
        G.heli.vy = 0;
        G.heli.vz = 0;
        G.heli.inAir = false;
        G.heli.engineOn = false;
        G.heli.rotorRPM = 0;
        zstate.cam.x = (G.START_POS.x - G.START_POS.y) * (tileW / 2);
        zstate.cam.y = (G.START_POS.x + G.START_POS.y) * (tileH / 2);
    }


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
    const lighthouseX = _lighthouseX;
    const lighthouseY = _lighthouseY;
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

    _drawTerrain(camX, camY, rx, ry, isNight, rain);

    if (hasLighthouse() && isVisible(lighthouseX, lighthouseY)) drawLighthouse(camX, camY);
    if (hasCarrier() && isVisible(G.CARRIER.x, G.CARRIER.y, 25)) drawVectorCarrier(camX, camY);
    drawParkedHelis(camX, camY);
    G.BOATS.forEach(b => {
        if (isVisible(b.x, b.y, 15)) drawSailboat(b.x, b.y, b.angle, camX, camY);
    });
    G.SUBMARINES.forEach(s => {
        if (isVisible(s.x, s.y, 15)) drawSubmarine(s.x, s.y, s.angle, camX, camY);
    });
    if (hasPad() && isVisible(G.PAD.xMin + 3, G.PAD.yMin + 3)) drawHangar();
    if (hasPad() && G.fuelTruck && isVisible(G.fuelTruck.x, G.fuelTruck.y))
        drawFuelTruck(G.fuelTruck.x, G.fuelTruck.y, G.fuelTruck.angle, {
            z: G.PAD ? G.PAD.z : 0,
            armExtend: G.fuelTruck.arm,
            armTarget: { x: G.heli.x, y: G.heli.y },
            getFuelingState: () => G.fuelTruck.state === 'FUELING',
        });
    SceneRenderer.flush(camX, camY);
    if (hasPad()) drawPadLights(camX, camY, G.PAD.z, false);
    if (hasPad() && isVisible(G.PAD.xMin, G.PAD.yMin)) drawWindsock(camX, camY); // pad always in range if visible

    // Bäume als vorgerenderte Sprites — nur sichtbare Tiles via Spatial-Index
    {
        const _tr = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 2;
        const xFrom = Math.floor(rx - _tr), xTo = Math.ceil(rx + _tr);
        const yFrom = Math.floor(ry - _tr), yTo = Math.ceil(ry + _tr);
        for (let tx = xFrom; tx <= xTo; tx++) {
            for (let ty = yFrom; ty <= yTo; ty++) {
                const bucket = _treeIndex.get(`${tx}_${ty}`);
                if (!bucket) continue;
                for (const t of bucket) {
                    drawTree(t.x, t.y, camX, camY, t.s, t.gz, t.type || 'pine', G.wind, !_IS_APP && _partyMode && t.type !== 'dead');
                }
            }
        }
    }

    // Vögel
    updateBirds();
    drawBirds(camX, camY);

    // flapRate: vertical climb + horizontal speed (braking from speed → faster flapping)
    const _flapRate = Math.max(0.5, Math.min(3.0,
        1.0 + G.heli.vz * 20 + Math.hypot(G.heli.vx, G.heli.vy) * 8
    ));

    // shadow pass
    if (!isNight && !zstate.crashed) {
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
        drawDebris(G.debris, camX, camY, ctx, canvas);
    }

    // Heli nur rendern wenn nicht gecrasht
    if (!zstate.crashed) {
        // ground persons drawn BEFORE heli for correct depth order
        drawPayloadObjects(false);
        // ropes drawn BEFORE heli so heli body renders over rope top
        drawPayloadObjects(true, true);

        // winch line (only when nothing hanging)
        if (!G.activePayload) {
            const rs = G.rescuerSwing;
            const winchTipZ = Math.max(getGround(rs.x, rs.y), G.heli.z - G.heli.winch);
            let hP = iso(G.heli.x, G.heli.y, G.heli.z, camX, camY, { stepH, tileW, tileH, canvas });
            let wP = iso(rs.x, rs.y, winchTipZ, camX, camY, { stepH, tileW, tileH, canvas });
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(hP.x, hP.y);
            ctx.lineTo(wP.x, wP.y);
            ctx.stroke();
        }
        // rescuer always at winch tip when winch is extended
        if (G.heli.winch > 0.3) {
            const rs = G.rescuerSwing;
            const winchTipZ = G.activePayload
                ? G.activePayload.z + (G.activePayload.type === 'person' ? 0.35 : 0)
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
                ...(!_IS_APP && _partyMode ? { fillColor: _partyColors[0], strokeColor: _partyColors[1] } : {}),
            }
        );

        if (!_IS_APP) mpRenderRemoteHeli(ctx, camX, camY, drawHeli, isoFn);

        renderRain();

        // collision box checks + optional debug rendering
        handleCollisionBoxes();
        if (!_IS_APP && showCollisionBoxes) drawDebugOverlay(camX, camY);

        // hanging payload figures drawn after heli (no rope, that's done above)
        drawPayloadObjects(true, false);
    } // end if (!zstate.crashed)

    // HUD — DOM elements (sharp on all devices, zero canvas draw calls)
    {
        const scale = window.innerWidth / canvas.width;
        const heliPos = iso(G.heli.x, G.heli.y, G.heli.z, camX, camY, { stepH, tileW, tileH, canvas });
        _hud.panel.style.left = `${heliPos.x * scale + 45}px`;
        _hud.panel.style.top  = `${heliPos.y * scale - 35}px`;

        _hud.alt.textContent   = `ALT: ${Math.round((G.heli.z - getGround(G.heli.x, G.heli.y)) * 10)}m`;
        _hud.spd.textContent   = `SPD: ${Math.round(Math.hypot(G.heli.vx, G.heli.vy) * 1115)}km/h`;
        _hud.winch.textContent = `WINCH: ${Math.round(G.heli.winch * 10)}m`;
        _hud.fuel.textContent  = `FUEL: ${Math.max(0, Math.round(G.heli.fuel))}%`;
        _hud.fuel.style.color  = G.heli.fuel < 20 ? '#f00' : '#5f5';
        _hud.pax.textContent   = `PAX: ${G.heli.onboard}/${G.heli.maxLoad}`;
        _hud.pax.style.color   = G.heli.onboard >= G.heli.maxLoad ? '#f90' : '#5f5';

        _hud.obj.textContent = `SAVED: ${G.totalRescued}/${G.goalCount}`;
        _hud.callsign.textContent = _session.playerName || '';

        _hud.deliver.style.display = G.deliverMode ? 'block' : 'none';
        setDeliverToggle(G.deliverMode);

        // minimap
        const isTouch = _isTouchDevice();
        const mmSize = 130;
        const mmPadPx = 20;
        _hud.minimap.style.right  = isTouch ? 'max(16px, env(safe-area-inset-right))' : `${mmPadPx}px`;
        _hud.minimap.style.top    = isTouch ? 'max(12px, env(safe-area-inset-top))' : '';
        _hud.minimap.style.bottom = isTouch ? '' : `${mmPadPx}px`;

        const sc = mmSize / gridSize;

        if (hasPad()) {
            const pw = (G.PAD.xMax - G.PAD.xMin) * sc;
            const ph = (G.PAD.yMax - G.PAD.yMin) * sc;
            _hud.mmPad.style.left    = `${G.PAD.xMin * sc}px`;
            _hud.mmPad.style.top     = `${G.PAD.yMin * sc}px`;
            _hud.mmPad.style.width   = `${pw}px`;
            _hud.mmPad.style.height  = `${ph}px`;
            _hud.mmPad.style.display = 'block';
        } else {
            _hud.mmPad.style.display = 'none';
        }

        if (hasCarrier()) {
            _hud.mmCarrier.style.left    = `${G.CARRIER.x * sc}px`;
            _hud.mmCarrier.style.top     = `${G.CARRIER.y * sc}px`;
            _hud.mmCarrier.style.display = 'block';
        } else {
            _hud.mmCarrier.style.display = 'none';
        }

        _hud.mmHeli.style.left    = `${G.heli.x * sc}px`;
        _hud.mmHeli.style.top     = `${G.heli.y * sc}px`;
        _hud.mmHeli.style.display = 'block';

        const activePays = G.payloads.filter((p: any) => !p.rescued && !p.npcTarget && !p.hanging);
        activePays.forEach((p: any, i: number) => {
            const dot = _hud.getDot(i);
            dot.style.left       = `${p.x * sc}px`;
            dot.style.top        = `${p.y * sc}px`;
            dot.style.background = p.type === 'crate' ? '#d84' : '#f00';
            dot.style.display    = 'block';
        });
        for (let i = activePays.length; i < _hud.mmPool.length; i++) {
            _hud.mmPool[i].style.display = 'none';
        }
    }

    if (!_IS_APP) mpTickAndHUD(ctx, canvas, dt);

    if (!_IS_APP && _partyMode) drawDiscoBall();

    updateHeliSound(G.heli.rotorRPM, G.heli.engineOn, G.heli.type, Math.hypot(G.wind.x, G.wind.y), _flapRate);
    if (isTutorialRunning()) tutorialTick(G);
    _rafId = requestAnimationFrame(drawScene);
}

const _drawDiscoBall = (() => {
    // Pre-bake tile positions so we don't recompute every frame
    type Tile = { row: number; col: number; phi: number; basePhi: number; ringR: number; tileW: number; tileH: number };
    let _tiles: Tile[] = [];
    const ROWS = 9,
        BASE_COLS = 14,
        R = 38;
    for (let row = 0; row < ROWS; row++) {
        const phi = ((row + 0.5) / ROWS) * Math.PI;
        const ringR = Math.sin(phi);
        const cols = Math.max(4, Math.round(BASE_COLS * ringR));
        for (let col = 0; col < cols; col++) {
            _tiles.push({
                row,
                col,
                phi,
                basePhi: (col / cols) * Math.PI * 2,
                ringR,
                tileW: R * 0.22 * ringR,
                tileH: R * 0.16,
            });
        }
    }
    return () => {
        const w = canvas.width,
            h = canvas.height;
        const cx = w / 2,
            cy = R + 12;
        const t = Date.now() / 1000;

        ctx.save();

        // String
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, cy - R);
        ctx.stroke();

        // Reflection spots scattered across the canvas
        for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2 + t * 0.6;
            const dist = 80 + i * 28;
            const sx = cx + Math.cos(angle + Math.sin(t * 0.4 + i)) * dist * (w / 800);
            const sy = cy + Math.sin(angle * 1.3 + t * 0.3) * dist * 0.9;
            if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
            const col = _PARTY_PALETTE[(i + Math.floor(t * 3)) % _PARTY_PALETTE.length];
            ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 4 + i);
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.arc(sx, sy, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Ball body
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();

        // Mirror tiles
        _tiles.forEach(({ row, basePhi, phi, ringR, tileW, tileH }) => {
            const theta = basePhi + t * 1.1;
            const z3d = ringR * Math.sin(theta);
            if (z3d < 0) return; // back face culling
            const x3d = ringR * Math.cos(theta);
            const sx = cx + x3d * R;
            const sy = cy - Math.cos(phi) * R;
            const brightness = 0.3 + z3d * 0.7;
            const colorIdx = Math.abs(row * 5 + Math.floor(basePhi * 3) + Math.floor(t * 5)) % _PARTY_PALETTE.length;
            ctx.globalAlpha = brightness;
            ctx.fillStyle = _PARTY_PALETTE[colorIdx];
            ctx.fillRect(sx - tileW / 2, sy - tileH / 2, tileW, tileH);
        });

        // Highlight gloss
        ctx.globalAlpha = 1;
        const hl = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, 0, cx, cy, R);
        hl.addColorStop(0, 'rgba(255,255,255,0.55)');
        hl.addColorStop(0.4, 'rgba(255,255,255,0.05)');
        hl.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hl;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    };
})();
const drawDiscoBall = _drawDiscoBall;

// ─── draw all G.payloads ───────────────────────────────────────────────────────
function drawPayloadObjects(hangingOnly = false, ropeOnly = false) {
    const isNight = _missionNight;
    const { cam } = zstate;

    G.payloads.forEach(payload => {
        if (payload.rescued && !payload.hanging) return;
        if (hangingOnly && !payload.hanging) return;
        if (!hangingOnly && payload.hanging) return;
        if (!payload.hanging && !isVisible(payload.x, payload.y)) return;

        if (isNight && !payload.hanging) {
            const dx = payload.x - G.heli.x,
                dy = payload.y - G.heli.y;
            const alt = G.heli.z - getGround(G.heli.x, G.heli.y, G.points, G.CARRIER);
            if (Math.hypot(dx, dy) > 10 + alt * 2.0) return;
            let diff = Math.atan2(dy, dx) - G.heli.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            if (Math.abs(diff) > 0.3 + alt * 0.05) return;
        }

        // Rope-only pass: draw rope before heli so heli renders over it
        if (ropeOnly) {
            if (!payload.hanging || G.heli.winch < 0.4) return;
            const hPos = iso(G.heli.x, G.heli.y, G.heli.z, cam.x, cam.y, { stepH, tileW, tileH, canvas });
            const pp = iso(payload.x, payload.y, payload.z, cam.x, cam.y, { stepH, tileW, tileH, canvas });
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(hPos.x, hPos.y);
            ctx.lineTo(pp.x, pp.y - (payload.type === 'person' ? 5 : 0));
            ctx.stroke();
            return;
        }

        // Hide hanging payload when nearly winched in (avoids "spawn into heli" look)
        if (payload.hanging && G.heli.winch < 0.4) return;

        let p = iso(payload.x, payload.y, payload.z, cam.x, cam.y, { stepH, tileW, tileH, canvas });
        if (payload.type === 'crate') {
            ctx.fillStyle = '#d84';
            ctx.strokeStyle = '#530';
            ctx.lineWidth = Math.max(0.5, tileW / 64);
            let s = tileW * 0.22;
            ctx.fillRect(p.x - s / 2, p.y - s, s, s);
            ctx.strokeRect(p.x - s / 2, p.y - s, s, s);
        } else {
            drawPerson(
                payload.x,
                payload.y,
                payload.z,
                0,
                !payload.hanging,
                cam.x,
                cam.y,
                undefined,
                payload.outfitColors
            );
            if (payload.z < 0) {
                ctx.strokeStyle = '#aaf';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 6, 0, 7);
                ctx.stroke();
            }
        }
    });
}

function drawVectorCarrier(cx: number, cy: number) {
    const objX = G.CARRIER.x,
        objY = G.CARRIER.y;
    const deckZ = G.CARRIER.zDeck;
    const angle = G.CARRIER.angle;
    const cosA = Math.cos(angle),
        sinA = Math.sin(angle);
    function r(rx: number, ry: number) {
        return { x: objX + rx * cosA - ry * sinA, y: objY + rx * sinA + ry * cosA };
    }
    // Pass 1: Hull (flush alone so deck objects always render on top)
    SceneRenderer.add(applyParts(CARRIER_DEF, {}, { only: ['hull'] }), { x: objX, y: objY, z: 0, angle });
    SceneRenderer.flush(cx, cy);

    // Pass 2: Tractors (drawFn) + Tower (depth-sorted together)
    const ix = -5.5,
        iy = 2.6,
        iw = 4.5,
        il = 1.5,
        ih = 2.5;
    const tractorData = [
        {
            tx: 0.2,
            ty: 2.7,
            ta: Math.PI / 2,
            bc: '#9a7a00',
            bs: '#c8a000',
            bd: '#8a6c00',
            cc: '#b09000',
            cs: '#e0b800',
            ct: '#caa800',
        },
        {
            tx: 1.4,
            ty: 2.7,
            ta: Math.PI / 2,
            bc: '#9a7a00',
            bs: '#c8a000',
            bd: '#8a6c00',
            cc: '#b09000',
            cs: '#e0b800',
            ct: '#caa800',
        },
    ];
    tractorData.forEach(t => {
        const wx = objX + (t.tx + 0.5) * cosA - (t.ty + 0.35) * sinA;
        const wy = objY + (t.tx + 0.5) * sinA + (t.ty + 0.35) * cosA;
        SceneRenderer.add(null, {
            x: wx,
            y: wy,
            z: deckZ,
            drawFn: (cx, cy) =>
                drawTractor(objX, objY, angle, deckZ, cx, cy, t.tx, t.ty, t.ta, t.bc, t.bs, t.bd, t.cc, t.cs, t.ct),
        });
    });
    // Carrier fuel car — world position, drawn independently of carrier transform
    const car = G.carrierFuelCar;
    SceneRenderer.add(null, {
        x: car.x,
        y: car.y,
        z: deckZ,
        drawFn: (cx, cy) =>
            drawTractor(car.x, car.y, 0, deckZ, cx, cy, 0, 0, car.angle + Math.PI, '#888888', '#dddddd', '#666666', '#aaaaaa', '#ffffff', '#eeeeee'),
    });
    const towerWX = objX + (ix + iw / 2) * cosA - (iy + il / 2) * sinA;
    const towerWY = objY + (ix + iw / 2) * sinA + (iy + il / 2) * cosA;
    SceneRenderer.add(applyParts(CARRIER_DEF, {}, { only: ['tower'] }), {
        x: objX,
        y: objY,
        z: 0,
        angle,
        depth: towerWX + towerWY,
    });
    // Radar depth 0.01 above tower so it sorts on top within the same flush
    SceneRenderer.add(
        applyParts(CARRIER_DEF, { radarAngle: Date.now() * 0.002 }, { only: ['radar_mast', 'radar_arm'] }),
        { x: objX, y: objY, z: 0, angle, depth: towerWX + towerWY + 0.01 }
    );
    SceneRenderer.flush(cx, cy);

    // Antenna — direct draw after flush, always on top
    const antB = r(ix + iw * 0.5, iy + il * 0.25);
    const a0 = iso(antB.x, antB.y, deckZ + ih, cx, cy, { stepH, tileW, tileH, canvas });
    const a1 = iso(antB.x, antB.y, deckZ + ih + 0.6, cx, cy, { stepH, tileW, tileH, canvas });
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.stroke();

    drawPadLights(cx, cy, G.CARRIER.zDeck, true);
}

function drawParkedHelis(cx: number, cy: number) {
    if (!hasCarrier()) return;
    const angle = G.CARRIER.angle;
    const deckZ = G.CARRIER.zDeck;
    parkedHelis.forEach(h => {
        if (!isVisible(G.CARRIER.x, G.CARRIER.y)) return;
        const cosA = Math.cos(angle),
            sinA = Math.sin(angle);
        const wx = G.CARRIER.x + h.xRel * cosA - h.yRel * sinA;
        const wy = G.CARRIER.y + h.xRel * sinA + h.yRel * cosA;
        const totalAng = h.angle + angle;
        const rotorPos = 0;
        drawHeli(h.type, wx, wy, deckZ + 0.1, totalAng, 0, 0, rotorPos, cx, cy, {
            isShadow: true,
            scaleOverride: 1,
            fillColor: '#556b2f',
            strokeColor: '#3a4a1f',
            shadowGetGround: () => deckZ + 0.1,
        });
        drawHeli(h.type, wx, wy, deckZ + 0.1, totalAng, 0, 0, rotorPos, cx, cy, {
            scaleOverride: 1,
            fillColor: '#556b2f',
            strokeColor: '#3a4a1f',
        });
    });
}
// ─── pad / hangar / lights / windsock / lighthouse ───────────────────────────
function drawHangar() {
    SceneRenderer.add(HANGAR_DEF, {
        x: G.PAD.xMax - 3,
        y: G.PAD.yMin - 1,
        z: G.PAD.z,
        angle: Math.PI / 2,
    });
    SceneRenderer.add(TOWER_DEF, {
        x: G.PAD.xMax - 0.5,
        y: G.PAD.yMin - 1,
        z: G.PAD.z,
        angle: 0,
    });
}

function drawPadLights(cx: number, cy: number, z: number, isCarrier = false) {
    let blink = Math.floor(Date.now() / 500) % 2 === 0;
    if (isCarrier) {
        let cw = G.CARRIER.w + 1.2,
            cl = G.CARRIER.l + 1.2,
            ang = G.CARRIER.angle;
        function r(rx: number, ry: number) {
            return {
                x: G.CARRIER.x + rx * Math.cos(ang) - ry * Math.sin(ang),
                y: G.CARRIER.y + rx * Math.sin(ang) + ry * Math.cos(ang),
            };
        }
        setLightsOnDeck([r(-cw, -cl), r(cw, -cl), r(cw, cl), r(-cw, cl)], blink, cx, cy, z);
    } else {
        setLightsOnDeck(
            [
                { x: G.PAD.xMin + 0.5, y: G.PAD.yMin + 0.5 },
                { x: G.PAD.xMax + 0.5, y: G.PAD.yMin + 0.5 },
                { x: G.PAD.xMax + 0.5, y: G.PAD.yMax + 0.5 },
                { x: G.PAD.xMin + 0.5, y: G.PAD.yMax + 0.5 },
            ],
            blink,
            cx,
            cy,
            z
        );
    }
}

function setLightsOnDeck(lights: Array<{ x: number; y: number }>, blink: boolean, cx: number, cy: number, z: number) {
    lights.forEach(l => {
        let p = iso(l.x, l.y, z + 0.05, cx, cy, { stepH, tileW, tileH, canvas });
        ctx.fillStyle = blink ? '#f00' : '#500';
        ctx.beginPath();
        const s = tileW / 64;
        ctx.arc(p.x, p.y, blink ? Math.max(1.5, 3 * s) : Math.max(1.2, 2.5 * s), 0, 7);
        ctx.fill();
    });
}

function drawWindsock(cx: number, cy: number) {
    let wx = G.PAD.xMin,
        wy = G.PAD.yMin + 8.8;
    let base = iso(wx, wy, getGround(wx, wy), cx, cy, { stepH, tileW, tileH, canvas });
    let top = iso(wx, wy, getGround(wx, wy) + 1.2, cx, cy, { stepH, tileW, tileH, canvas });
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
    let windAngle = G.wind.angle ?? Math.PI * 0.75;
    let wIsoX = (Math.cos(windAngle) - Math.sin(windAngle)) * (tileW / 2);
    let wIsoY = (Math.cos(windAngle) + Math.sin(windAngle)) * (tileH / 2);
    let len = Math.hypot(wIsoX, wIsoY);
    wIsoX = (wIsoX / len) * 5;
    wIsoY = (wIsoY / len) * 5;
    // perpendicular for cone width
    let perpX = -wIsoY,
        perpY = wIsoX;
    let phase = Date.now() * 0.005;
    ctx.fillStyle = 'orange';
    ctx.beginPath();
    ctx.moveTo(top.x - perpX * 0.5, top.y - perpY * 0.5);
    ctx.lineTo(top.x + perpX * 0.5, top.y + perpY * 0.5);
    for (let i = 1; i <= 4; i++) {
        let t = i / 4;
        let bend = Math.sin(phase + i * 0.5) * 1.5 * t;
        let px = top.x + wIsoX * i * 0.6 + perpX * (0.5 - t * 0.5) + bend * perpX * 0.2;
        let py = top.y + wIsoY * i * 0.6 + perpY * (0.5 - t * 0.5) + bend * perpY * 0.2;
        ctx.lineTo(px, py);
    }
    for (let i = 3; i >= 1; i--) {
        let t = i / 4;
        let bend = Math.sin(phase + i * 0.5) * 1.5 * t;
        let px = top.x + wIsoX * i * 1.5 - perpX * (0.5 - t * 0.5) + bend * perpX * 0.2;
        let py = top.y + wIsoY * i * 1.5 - perpY * (0.5 - t * 0.5) + bend * perpY * 0.2;
        ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
}

function drawSailboat(sX: number, sY: number, angle: number, cx: number, cy: number) {
    SceneRenderer.add(SAILBOAT_DEF, { x: sX, y: sY, z: 0, angle });
    SceneRenderer.flush(cx, cy);
}

function drawSubmarine(sX: number, sY: number, angle: number, cx: number, cy: number) {
    SceneRenderer.add(SUBMARINE_DEF, { x: sX, y: sY, z: 0, angle });
    SceneRenderer.flush(cx, cy);
}

// Beflockung aus Missionsdaten laden
// G.TREES_MAP initialized in G object
const FOLIAGE_DECODE: Record<string, string> = { p: 'pine', o: 'oak', b: 'bush', d: 'dead' };
function decompressFoliage(str: string | { x: number; y: number; s: number; type: string }[]) {
    if (!str) return [];
    if (typeof str !== 'string') return str; // bereits dekomprimiert (Array)
    return str.split('|').map(token => {
        const type = FOLIAGE_DECODE[token[0]] || 'pine';
        const [x, y, s] = token.slice(1).split(',').map(Number);
        return { type, x: x / 10, y: y / 10, s: s / 10 };
    });
}
function initFoliageFromMission() {
    const md = campaignHandler.getCurrentMissionData();
    const foliage = decompressFoliage(md.foliage || []);
    G.TREES_MAP = foliage.map(f => ({
        x: f.x,
        y: f.y,
        s: f.s || 1.0,
        type: f.type || 'pine',
        gz: null,
    }));
    G.TREES_MAP.forEach((t: any) => {
        t.gz = getGround(t.x, t.y, G.points, G.CARRIER);
    });
    _treeIndex.clear();
    G.TREES_MAP.forEach((t: any) => {
        const key = `${Math.floor(t.x)}_${Math.floor(t.y)}`;
        const bucket = _treeIndex.get(key);
        if (bucket) bucket.push(t);
        else _treeIndex.set(key, [t]);
    });
}


function drawLighthouse(cx: number, cy: number) {
    const _lhObj = getObjectByType('lighthouse');
    if (!_lhObj) return;
    const lhX = _lhObj.x,
        lhY = _lhObj.y;
    SceneRenderer.add(LIGHTHOUSE_DEF, { x: lhX, y: lhY, z: 0 });
    SceneRenderer.flush(cx, cy);
    // Antenna + blinking light (screen-space, drawn after DEF)
    const p = iso(lhX, lhY, 8.1, cx, cy, { stepH, tileW, tileH, canvas });
    ctx.fillStyle = '#333';
    ctx.fillRect(p.x - 2, p.y - 10, 4, 10);
    if (Math.floor(Date.now() / 300) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,200,0.8)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 25, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function renderRain() {
    if (!_missionRain) return;
    if (Math.random() < 0.005) {
        const el = document.getElementById('flash-overlay')!;
        el.style.opacity = '0.8';
        setTimeout(() => (el.style.opacity = '0'), 100);
    }
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

// Draw an oriented bounding box in isometric space (debug visual).
// wX/wY: world center, angle: rotation, ox/oy/oz: local extents min/max
function drawCollisionBox(
    wX: number,
    wY: number,
    angle: number,
    oxMin: number,
    oxMax: number,
    oyMin: number,
    oyMax: number,
    ozMin: number,
    ozMax: number,
    color: string
) {
    const camX = zstate.cam.x,
        camY = zstate.cam.y;
    const cosA = Math.cos(angle),
        sinA = Math.sin(angle);
    function wp(lx: number, ly: number, lz: number) {
        return {
            x: wX + lx * cosA - ly * sinA,
            y: wY + lx * sinA + ly * cosA,
            z: lz,
        };
    }
    const corners = [
        wp(oxMin, oyMin, ozMin),
        wp(oxMax, oyMin, ozMin),
        wp(oxMax, oyMax, ozMin),
        wp(oxMin, oyMax, ozMin),
        wp(oxMin, oyMin, ozMax),
        wp(oxMax, oyMin, ozMax),
        wp(oxMax, oyMax, ozMax),
        wp(oxMin, oyMax, ozMax),
    ];
    const sc = corners.map(p => iso(p.x, p.y, p.z, camX, camY, { stepH, tileW, tileH, canvas }));
    const edges = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
    ];
    ctx.save();
    ctx.strokeStyle = color || 'rgba(0,255,100,0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.shadowColor = color || '#00ff66';
    ctx.shadowBlur = 4;
    edges.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(sc[a].x, sc[a].y);
        ctx.lineTo(sc[b].x, sc[b].y);
        ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.restore();
}

// Check if a world point (px, py, pz) is inside an oriented bounding box.
function checkCollisionBox(
    px: number,
    py: number,
    pz: number,
    wX: number,
    wY: number,
    angle: number,
    oxMin: number,
    oxMax: number,
    oyMin: number,
    oyMax: number,
    ozMin: number,
    ozMax: number
) {
    const dx = px - wX,
        dy = py - wY;
    const cosA = Math.cos(-angle),
        sinA = Math.sin(-angle);
    const lx = dx * cosA - dy * sinA;
    const ly = dx * sinA + dy * cosA;
    return lx >= oxMin && lx <= oxMax && ly >= oyMin && ly <= oyMax && pz >= ozMin && pz <= ozMax;
}

// Draw all collision boxes and check G.heli collisions (called from drawScene).
function drawDebugOverlay(camX: number, camY: number) {
    const OPT = { stepH, tileW, tileH, canvas };

    function isoP(wx: number, wy: number, wz = 0) {
        return iso(wx, wy, wz, camX, camY, OPT);
    }

    // ── World grid (every 5 units, labelled every 10) ─────────────
    const hx = G.heli.x,
        hy = G.heli.y;
    const gMin = -30,
        gMax = 30,
        gStep = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let x = Math.floor((hx + gMin) / gStep) * gStep; x <= hx + gMax; x += gStep) {
        const a = isoP(x, hy + gMin),
            b = isoP(x, hy + gMax);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    for (let y = Math.floor((hy + gMin) / gStep) * gStep; y <= hy + gMax; y += gStep) {
        const a = isoP(hx + gMin, y),
            b = isoP(hx + gMax, y);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    // Grid labels every 10 units
    ctx.font = '9px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let x = Math.floor((hx + gMin) / 10) * 10; x <= hx + gMax; x += 10) {
        for (let y = Math.floor((hy + gMin) / 10) * 10; y <= hy + gMax; y += 10) {
            const p = isoP(x, y);
            ctx.fillText(`${x},${y}`, p.x + 2, p.y - 2);
        }
    }

    // ── World axes at heli position ───────────────────────────────
    function drawArrow(fromP: { x: number; y: number }, toP: { x: number; y: number }, color: string, label: string) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromP.x, fromP.y);
        ctx.lineTo(toP.x, toP.y);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 10px monospace';
        ctx.fillText(label, toP.x + 3, toP.y - 3);
    }
    const orig = isoP(hx, hy, G.heli.z);
    drawArrow(orig, isoP(hx + 3, hy, G.heli.z), '#f44', '+X');
    drawArrow(orig, isoP(hx, hy + 3, G.heli.z), '#4f4', '+Y');
    drawArrow(orig, { x: orig.x, y: orig.y - 30 }, '#44f', '+Z');

    // ── PAD bounds ────────────────────────────────────────────────
    if (hasPad()) {
        const p = G.PAD;
        const corners = [
            isoP(p.xMin, p.yMin, p.z),
            isoP(p.xMax, p.yMin, p.z),
            isoP(p.xMax, p.yMax, p.z),
            isoP(p.xMin, p.yMax, p.z),
        ];
        ctx.strokeStyle = 'rgba(0,255,200,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        corners.forEach(c => ctx.lineTo(c.x, c.y));
        ctx.closePath();
        ctx.stroke();
        ctx.font = '10px monospace';
        ctx.fillStyle = '#0fc';
        const lbl = isoP(p.xMin, p.yMin, p.z);
        ctx.fillText(`PAD xMin=${p.xMin} xMax=${p.xMax}`, lbl.x, lbl.y - 6);
        ctx.fillText(`yMin=${p.yMin} yMax=${p.yMax} z=${p.z}`, lbl.x, lbl.y + 6);

        // Hangar outline
        const hX = p.xMax - 5,
            hY = p.yMin - 2;
        const hc = [isoP(hX, hY, p.z), isoP(hX + 4, hY, p.z), isoP(hX + 4, hY + 2, p.z), isoP(hX, hY + 2, p.z)];
        ctx.strokeStyle = 'rgba(255,80,0,0.8)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(hc[0].x, hc[0].y);
        hc.forEach(c => ctx.lineTo(c.x, c.y));
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#f50';
        ctx.font = '10px monospace';
        ctx.fillText('HANGAR', hc[0].x, hc[0].y - 5);

        // Fuel truck: position dot, heading arrow, state label
        const ft = G.fuelTruck;
        const ftP = isoP(ft.x, ft.y, p.z + 0.5);
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(ftP.x, ftP.y, 5, 0, Math.PI * 2);
        ctx.fill();
        // Heading arrow: forward = +X in local = cosA, sinA in world
        const ftFwd = isoP(ft.x + Math.cos(ft.angle) * 2.5, ft.y + Math.sin(ft.angle) * 2.5, p.z + 0.5);
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ftP.x, ftP.y);
        ctx.lineTo(ftFwd.x, ftFwd.y);
        ctx.stroke();
        // Rear marker
        const ftBack = isoP(ft.x - Math.cos(ft.angle) * 1.1, ft.y - Math.sin(ft.angle) * 1.1, p.z + 0.5);
        ctx.fillStyle = 'rgba(255,200,0,0.5)';
        ctx.beginPath();
        ctx.arc(ftBack.x, ftBack.y, 3, 0, Math.PI * 2);
        ctx.fill();
        // Target position
        if (ft.targetX != null && ft.targetY != null) {
            const tgt = isoP(ft.targetX, ft.targetY, p.z);
            ctx.strokeStyle = 'rgba(255,255,0,0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(ftP.x, ftP.y);
            ctx.lineTo(tgt.x, tgt.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ff0';
            ctx.beginPath();
            ctx.arc(tgt.x, tgt.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        // State + angle label
        ctx.fillStyle = '#ff0';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`TRUCK: ${ft.state}`, ftP.x + 7, ftP.y - 8);
        ctx.fillText(`ang=${((ft.angle * 180) / Math.PI).toFixed(0)}°`, ftP.x + 7, ftP.y + 4);
        ctx.fillText(`x=${ft.x.toFixed(1)} y=${ft.y.toFixed(1)}`, ftP.x + 7, ftP.y + 16);
        // Park position marker
        const parkP = isoP(ft.parkX, ft.parkY, p.z);
        ctx.strokeStyle = 'rgba(255,200,0,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(parkP.x, parkP.y, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,200,0,0.6)';
        ctx.font = '9px monospace';
        ctx.fillText('PARK', parkP.x - 12, parkP.y + 14);
    }

    // ── Heli position label ───────────────────────────────────────
    const heliP = isoP(hx, hy, G.heli.z);
    ctx.fillStyle = '#f88';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`HELI x=${hx.toFixed(1)} y=${hy.toFixed(1)} z=${G.heli.z.toFixed(2)}`, heliP.x - 40, heliP.y - 50);
    ctx.fillText(`inAir=${G.heli.inAir} RPM=${G.heli.rotorRPM.toFixed(2)}`, heliP.x - 40, heliP.y - 38);
    ctx.fillText(`ang=${((G.heli.angle * 180) / Math.PI).toFixed(0)}°`, heliP.x - 40, heliP.y - 26);
}

function handleCollisionBoxes() {
    // ── Carrier ────────────────────────────────────────────────────────────────
    if (hasCarrier()) {
        const cx = G.CARRIER.x,
            cy = G.CARRIER.y,
            ca = G.CARRIER.angle;
        const deckZ = G.CARRIER.zDeck; // 4.2

        // Flugdeck: long axis X (±8.7), short axis Y (±4.2)
        if (showCollisionBoxes) drawCollisionBox(cx, cy, ca, -8.7, 8.7, -4.2, 4.2, 0, deckZ, 'rgba(0,200,255,0.8)');

        // Tower: xMin=-5.5, xMax=-1.0, yMin=2.6, yMax=4.1 (from zdef)
        if (showCollisionBoxes)
            drawCollisionBox(cx, cy, ca, -5.5, -1.0, 2.6, 4.1, deckZ, deckZ + 2.5, 'rgba(255,80,0,0.9)');

        // Tower-Kollision – nur wenn Heli in der Luft ist
        if (!zstate.crashed && G.heli.inAir) {
            if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, cx, cy, ca, -5.5, -1.0, 2.6, 4.1, deckZ, deckZ + 2.5)) {
                _physicsCtx.triggerCrash(I18N.CRASH_CARRIER_TOWER);
            }
        }

        // Parked Helis auf dem Deck
        const cosC = Math.cos(ca),
            sinC = Math.sin(ca);
        parkedHelis.forEach(h => {
            const pos = {
                x: cx + h.xRel * cosC - h.yRel * sinC,
                y: cy + h.xRel * sinC + h.yRel * cosC,
            };
            const totalAng = h.angle + ca;
            const _hcb = getHeliType(h.type).collisionBox;
            const hb = { x1: _hcb.xMin, x2: _hcb.xMax, y1: _hcb.yMin, y2: _hcb.yMax, z2: _hcb.zMax };
            if (showCollisionBoxes)
                drawCollisionBox(
                    pos.x,
                    pos.y,
                    totalAng,
                    hb.x1,
                    hb.x2,
                    hb.y1,
                    hb.y2,
                    deckZ + 0.1,
                    deckZ + 0.1 + hb.z2,
                    'rgba(0,255,100,0.8)'
                );
            if (!zstate.crashed && G.heli.inAir) {
                if (
                    checkCollisionBox(
                        G.heli.x,
                        G.heli.y,
                        G.heli.z,
                        pos.x,
                        pos.y,
                        totalAng,
                        hb.x1,
                        hb.x2,
                        hb.y1,
                        hb.y2,
                        deckZ + 0.1,
                        deckZ + 0.1 + hb.z2
                    )
                ) {
                    _physicsCtx.triggerCrash(I18N.CRASH_PARKED_HELI);
                }
            }
        });
    }

    // ── Hangar ────────────────────────────────────────────────────────────────
    if (hasPad()) {
        // Hangar: hX=G.PAD.xMax-5, hY=G.PAD.yMin-2, Breite=4, Tiefe=2, Höhe=1.8
        const hX = G.PAD.xMax - 5,
            hY = G.PAD.yMin - 2,
            hZ = G.PAD.z;
        // Mittelpunkt + lokale Extents (keine Rotation)
        const hmx = hX + 2,
            hmy = hY + 1;
        if (showCollisionBoxes) drawCollisionBox(hmx, hmy, 0, -2, 2, -1, 1, hZ, hZ + 1.8, 'rgba(255,80,0,0.9)');
        if (!zstate.crashed && G.heli.inAir) {
            if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, hmx, hmy, 0, -2, 2, -1, 1, hZ, hZ + 1.8)) {
                _physicsCtx.triggerCrash(I18N.CRASH_HANGAR);
            }
        }

        // ── Tower ──────────────────────────────────────────────────────────────
        const tmx = G.PAD.xMax - 0.5, tmy = G.PAD.yMin - 1, tZ = G.PAD.z;
        if (showCollisionBoxes) drawCollisionBox(tmx, tmy, 0, -0.5, 0.5, -0.5, 0.5, tZ, tZ + 5, 'rgba(255,200,0,0.9)');
        if (!zstate.crashed && G.heli.inAir) {
            if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, tmx, tmy, 0, -0.5, 0.5, -0.5, 0.5, tZ, tZ + 5)) {
                _physicsCtx.triggerCrash(I18N.CRASH_TOWER);
            }
        }
    }

    // ── Fuel Truck ───────────────────────────────────────────────────────────────
    if (hasPad() && G.fuelTruck.state !== 'PARKED') {
        const ft = G.fuelTruck;
        const fZ = G.PAD.z;
        if (showCollisionBoxes)
            drawCollisionBox(ft.x, ft.y, ft.angle, 0, 2.2, -0.45, 0.45, fZ, fZ + 0.9, 'rgba(255,200,0,0.8)');
        if (!zstate.crashed && G.heli.inAir) {
            if (
                checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, ft.x, ft.y, ft.angle, 0, 2.2, -0.45, 0.45, fZ, fZ + 0.9)
            ) {
                _physicsCtx.triggerCrash(I18N.CRASH_FUEL_TRUCK);
            }
        }
    }

    if (hasLighthouse()) {
        const lh = getObjectByType('lighthouse');
        if (lh) {
            // Sockel (radius 4, aber nur die Platte – kein Flughindernis über 0.4)
            if (showCollisionBoxes)
                drawCollisionBox(lh.x, lh.y, 0, -4.0, 4.0, -4.0, 4.0, 0, 0.4, 'rgba(255,220,0,0.6)');
            // Turm (radius 1.0, Höhe 0.4–8)
            if (showCollisionBoxes)
                drawCollisionBox(lh.x, lh.y, 0, -1.0, 1.0, -1.0, 1.0, 0.4, 8.0, 'rgba(255,80,0,0.9)');

            if (!zstate.crashed) {
                if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, lh.x, lh.y, 0, -1.0, 1.0, -1.0, 1.0, 0.4, 8.5)) {
                    _physicsCtx.triggerCrash(I18N.CRASH_LIGHTHOUSE);
                }
            }
        }
    }

    // ── Sailboats ──────────────────────────────────────────────────────────────
    G.BOATS.forEach(b => {
        // Rumpf
        if (showCollisionBoxes)
            drawCollisionBox(b.x, b.y, b.angle, -1.1, 1.3, -0.45, 0.45, 0, 0.35, 'rgba(0,255,100,0.8)');
        // Mast
        if (showCollisionBoxes)
            drawCollisionBox(b.x, b.y, b.angle, -0.4, -0.2, -0.1, 0.1, 0.35, 3.2, 'rgba(255,80,0,0.9)');

        if (!zstate.crashed) {
            if (
                checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, b.x, b.y, b.angle, -1.1, 1.3, -0.45, 0.45, 0, 0.35) ||
                checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, b.x, b.y, b.angle, -0.4, -0.2, -0.1, 0.1, 0.35, 3.2)
            ) {
                _physicsCtx.triggerCrash(I18N.CRASH_BOAT);
            }
        }
    });

    // ── Submarines ────────────────────────────────────────────────────────────
    G.SUBMARINES.forEach(s => {
        // Hull box: from submarine.zdef collision box coords
        if (showCollisionBoxes)
            drawCollisionBox(s.x, s.y, s.angle, -5.2, 5.6, -0.7, 0.7, 0, 0.3, 'rgba(0,180,255,0.8)');
        // Tower box
        if (showCollisionBoxes)
            drawCollisionBox(s.x, s.y, s.angle, 0.8, 2.3, -0.32, 0.32, 0.3, 2.4, 'rgba(255,80,0,0.9)');

        if (!zstate.crashed) {
            if (
                checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, s.x, s.y, s.angle, -5.2, 5.6, -0.7, 0.7, 0, 0.3) ||
                checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, s.x, s.y, s.angle, 0.8, 2.3, -0.32, 0.32, 0.3, 2.4)
            ) {
                _physicsCtx.triggerCrash(I18N.CRASH_SUBMARINE);
            }
        }
    });

    // ── Bäume ─────────────────────────────────────────────────────────────────
    // Kollisions-Check + optionaler Debug-Draw in einem einzigen batched Pass
    if (showCollisionBoxes) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,255,100,0.75)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        const camX2 = zstate.cam.x,
            camY2 = zstate.cam.y;
        G.TREES_MAP.forEach((t: any) => {
            if (!isVisible(t.x, t.y)) return;
            const r = 0.35 * t.s;
            const h = 2.3 * t.s;
            const corners = [
                { x: t.x - r, y: t.y - r, z: t.gz },
                { x: t.x + r, y: t.y - r, z: t.gz },
                { x: t.x + r, y: t.y + r, z: t.gz },
                { x: t.x - r, y: t.y + r, z: t.gz },
                { x: t.x - r, y: t.y - r, z: t.gz + h },
                { x: t.x + r, y: t.y - r, z: t.gz + h },
                { x: t.x + r, y: t.y + r, z: t.gz + h },
                { x: t.x - r, y: t.y + r, z: t.gz + h },
            ].map(p => iso(p.x, p.y, p.z, camX2, camY2, { stepH, tileW, tileH, canvas }));
            [
                [0, 1],
                [1, 2],
                [2, 3],
                [3, 0],
                [4, 5],
                [5, 6],
                [6, 7],
                [7, 4],
                [0, 4],
                [1, 5],
                [2, 6],
                [3, 7],
            ].forEach(([a, b]) => {
                ctx.beginPath();
                ctx.moveTo(corners[a].x, corners[a].y);
                ctx.lineTo(corners[b].x, corners[b].y);
                ctx.stroke();
            });
        });
        ctx.setLineDash([]);
        ctx.restore();
    }
    if (!zstate.crashed) {
        G.TREES_MAP.forEach((t: any) => {
            if (!isVisible(t.x, t.y)) return;
            const r = 0.35 * t.s;
            const h = 2.3 * t.s;
            if (checkCollisionBox(G.heli.x, G.heli.y, G.heli.z, t.x, t.y, 0, -r, r, -r, r, t.gz, t.gz + h)) {
                _physicsCtx.triggerCrash(I18N.CRASH_TREE);
            }
        });
    }

    // ── Player Heli box (nur Debug-Visualisierung) ────────────────────────────
    if (showCollisionBoxes) {
        const _phcb = getHeliType(G.heli.type).collisionBox;
        const hb = { x1: _phcb.xMin, x2: _phcb.xMax, y1: _phcb.yMin, y2: _phcb.yMax, z2: _phcb.zMax };
        drawCollisionBox(
            G.heli.x,
            G.heli.y,
            G.heli.angle,
            hb.x1,
            hb.x2,
            hb.y1,
            hb.y2,
            G.heli.z,
            G.heli.z + hb.z2,
            'rgba(255,255,0,0.9)'
        );
    }
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
let _treeIndex: Map<string, any[]> = new Map();
let _lighthouseX = -1;
let _lighthouseY = -1;
let _missionGridSize = 28;

let _partyMode = false;
let _partySeq = '';
let _partyColors: string[] = [];
const _PARTY_PALETTE = ['#ff0044', '#ff6600', '#ffcc00', '#00ff88', '#00ccff', '#cc44ff', '#ff44cc', '#44ffcc'];
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
        return !_IS_APP ? mpGetTriggerCrash(triggerCrash) : triggerCrash;
    },
} as import('./physics').PhysicsCtx;

if (!_IS_APP) {
    Object.defineProperty(_physicsCtx, 'partyMode', { get: () => _partyMode, enumerable: true, configurable: true });
    (_physicsCtx as any).partyPalette = _PARTY_PALETTE;
}

let _tileColors: string[][] = []; // precomputed day/rain colors, indexed [x][y]
// Reusable batch map — cleared each render, no per-frame Map allocation
const _terrainBatch = new Map<string, number[]>();

const _precomputeDayColors = (rain: boolean) => {
    const { gridSize } = campaignHandler.getTerrain();
    _tileColors = [];
    for (let x = 0; x < gridSize; x++) {
        _tileColors[x] = [];
        for (let y = 0; y < gridSize; y++) {
            const h0 = G.points[x]?.[y] ?? 0;
            const isPad = hasPad() && x >= G.PAD.xMin && x <= G.PAD.xMax && y >= G.PAD.yMin && y <= G.PAD.yMax;
            const isService = hasPad() && x >= G.PAD.xMin && x <= G.PAD.xMax && y >= G.PAD.yMin - 3 && y < G.PAD.yMin;
            const c = 35 + Math.floor(h0 * 15);
            _tileColors[x][y] = isPad
                ? '#444'
                : isService
                  ? '#444'
                  : h0 > 0
                    ? `rgb(${c - 10},${c + 30},${c - 10})`
                    : rain
                      ? '#002244'
                      : '#003d7a';
        }
    }
};

// Renders terrain via path-batching to any 2D context.
// Uses inline iso math to avoid per-tile object allocations.
const _renderTerrainBatched = (
    tCtx: CanvasRenderingContext2D,
    tW: number,
    tH: number,
    ccX: number,
    ccY: number,
    xFrom: number,
    xTo: number,
    yFrom: number,
    yTo: number,
    getFill: (x: number, y: number, h0: number) => string
) => {
    const { gridSize } = campaignHandler.getTerrain();
    _terrainBatch.clear();
    const hw = tW / 2,
        hh = tH / 2;
    const htW = tileW / 2,
        htH = tileH / 2;

    for (let x = Math.max(0, xFrom); x < Math.min(gridSize - 1, xTo); x++) {
        for (let y = Math.max(0, yFrom); y < Math.min(gridSize - 1, yTo); y++) {
            const h0 = G.points[x][y],
                h1 = G.points[x + 1][y];
            const h2 = G.points[x + 1][y + 1],
                h3 = G.points[x][y + 1];
            const fill = getFill(x, y, h0);
            // Inline iso — no object allocation
            const p0x = hw + (x - y) * htW - ccX;
            const p0y = hh + (x + y) * htH - h0 * stepH - ccY;
            const p1x = hw + (x + 1 - y) * htW - ccX;
            const p1y = hh + (x + 1 + y) * htH - h1 * stepH - ccY;
            const p2x = hw + (x + 1 - (y + 1)) * htW - ccX;
            const p2y = hh + (x + 1 + (y + 1)) * htH - h2 * stepH - ccY;
            const p3x = hw + (x - (y + 1)) * htW - ccX;
            const p3y = hh + (x + (y + 1)) * htH - h3 * stepH - ccY;

            let batch = _terrainBatch.get(fill);
            if (!batch) {
                batch = [];
                _terrainBatch.set(fill, batch);
            }
            batch.push(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y);
        }
    }

    for (const [fill, coords] of _terrainBatch) {
        tCtx.fillStyle = fill;
        tCtx.beginPath();
        for (let i = 0; i < coords.length; i += 8) {
            tCtx.moveTo(coords[i], coords[i + 1]);
            tCtx.lineTo(coords[i + 2], coords[i + 3]);
            tCtx.lineTo(coords[i + 4], coords[i + 5]);
            tCtx.lineTo(coords[i + 6], coords[i + 7]);
            tCtx.closePath();
        }
        tCtx.fill();
    }
};

// Renders terrain with offscreen cache for day/rain mode, or batched for night/party.
const _drawTerrain = (camX: number, camY: number, _rx: number, _ry: number, isNight: boolean, _rain: boolean) => {
    const _tileRange = Math.ceil(Math.max(canvas.width / tileW, canvas.height / tileH)) + 2;
    const xFrom = Math.floor(_rx - _tileRange);
    const xTo = Math.ceil(_rx + _tileRange);
    const yFrom = Math.floor(_ry - _tileRange);
    const yTo = Math.ceil(_ry + _tileRange);

    if (isNight) {
        // Night: spotlight cone is dynamic → path-batch on main canvas every frame
        const alt = G.heli.z - getGround(G.heli.x, G.heli.y, G.points, G.CARRIER);
        const coneWidth = 0.3 + alt * 0.05;
        const range = 10 + alt * 2.0;
        const range2 = range * range;
        const intensity = Math.floor(255 * Math.max(0.1, 1.0 - alt / 15));
        const haX = G.heli.x,
            haY = G.heli.y,
            haA = G.heli.angle;
        _renderTerrainBatched(ctx, canvas.width, canvas.height, camX, camY, xFrom, xTo, yFrom, yTo, (x, y, h0) => {
            const isPad = hasPad() && x >= G.PAD.xMin && x <= G.PAD.xMax && y >= G.PAD.yMin && y <= G.PAD.yMax;
            const isService = hasPad() && x >= G.PAD.xMin && x <= G.PAD.xMax && y >= G.PAD.yMin - 3 && y < G.PAD.yMin;
            let diff = Math.atan2(y - haY, x - haX) - haA;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const dx = x - haX,
                dy = y - haY;
            const inLight = Math.abs(diff) < coneWidth && dx * dx + dy * dy < range2;
            if (!inLight) return '#020205';
            if (isPad) return `rgb(${intensity - 30},${intensity - 30},${intensity - 30})`;
            if (isService) return `rgb(${Math.floor(intensity * 0.55)},${Math.floor(intensity * 0.55)},${Math.floor(intensity * 0.55)})`;
            return h0 > 0
                ? `rgb(${intensity - 20},${intensity + 10},${intensity - 20})`
                : `rgb(0,${Math.floor(intensity * 0.3)},${Math.floor(intensity * 0.6)})`;
        });
        return;
    }

    if (!_IS_APP && _partyMode) {
        // Party: tile colors change ~3.5×/sec → path-batch on main canvas
        _renderTerrainBatched(ctx, canvas.width, canvas.height, camX, camY, xFrom, xTo, yFrom, yTo, (x, y, _h0) => {
            const isPad = hasPad() && x >= G.PAD.xMin && x <= G.PAD.xMax && y >= G.PAD.yMin && y <= G.PAD.yMax;
            const isService = hasPad() && x >= G.PAD.xMin && x <= G.PAD.xMax && y >= G.PAD.yMin - 3 && y < G.PAD.yMin;
            if (isPad) return '#444';
            if (isService) return '#aaaaaa';
            const tileOffset = Math.abs(x * 173 + y * 251) % 800;
            const phase = Math.floor((Date.now() + tileOffset * 320) / 280);
            return _PARTY_PALETTE[phase % _PARTY_PALETTE.length];
        });
        return;
    }

    // Day / rain mode — direct batched render every frame
    _renderTerrainBatched(
        ctx,
        canvas.width,
        canvas.height,
        camX,
        camY,
        xFrom,
        xTo,
        yFrom,
        yTo,
        (x, y, _h0) => _tileColors[x]?.[y] ?? '#003d7a'
    );
};

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
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
const _resizeCanvas = () => {
    if (_IS_APP) {
        // App bundle only: phone 2.0×, tablet (≥768px short-side) 2.5× upscale — landscape-safe
        const scale = Math.min(screen.width, screen.height) >= 768 ? 2.5 : 3.0;
        canvas.width  = Math.round(window.innerWidth  / scale);
        canvas.height = Math.round(window.innerHeight / scale);
        canvas.style.width  = window.innerWidth  + 'px';
        canvas.style.height = window.innerHeight + 'px';
    } else {
        // Webapp only: mobile 1.6× upscale for performance, desktop 1×
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isMobile) {
            canvas.width  = Math.round(window.innerWidth  / 0.8 / 2);
            canvas.height = Math.round(window.innerHeight / 0.8 / 2);
            canvas.style.width  = window.innerWidth  + 'px';
            canvas.style.height = window.innerHeight + 'px';
        } else {
            canvas.width  = Math.round(window.innerWidth  * gameRenderScale);
            canvas.height = Math.round(window.innerHeight * gameRenderScale);
            canvas.style.width  = window.innerWidth  + 'px';
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
const getControlMode = (): 'heading' | 'screen' =>
    storageGet(CTRL_MODE_KEY) === 'screen' ? 'screen' : 'heading';
const setControlMode = (m: 'heading' | 'screen') => storageSet(CTRL_MODE_KEY, m);

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
        (G.keys as Record<string, boolean>)[up]    = dy < -dead;
        (G.keys as Record<string, boolean>)[down]  = dy > dead;
        (G.keys as Record<string, boolean>)[left]  = !inVertSector && dx < -dead;
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

const _setupHeadingJoystick = (id: string) => {
    const el = document.getElementById(id);
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

    // Run each frame — reads current heli angle and maps stick to heading keys
    const tick = () => {
        if (active && zstate.gameStarted && Math.hypot(_stickDx, _stickDy) > jr * 0.18) {
            const targetAngle = Math.atan2(_stickDy, _stickDx);
            let diff = targetAngle - G.heli.angle;
            // Normalise to [-π, π]
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            const turnDead = 0.15;
            (G.keys as Record<string, boolean>)['ArrowLeft'] = diff < -turnDead;
            (G.keys as Record<string, boolean>)['ArrowRight'] = diff > turnDead;

            // Dot product of stick direction vs current heli forward
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
    if (getControlMode() === 'screen') {
        _setupJoystick('joystick-right', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', true);
    } else {
        _setupHeadingJoystick('joystick-right');
    }
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
        createBackButton(() => { warningEl.style.display = 'none'; _pendingSwitchIndex = -1; })
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

declare const __APP_VERSION__: string;

// ─── Preview mode (Kampagnen-Editor Live-Preview) — DEV only ──────────────────
const _previewLaunch = !import.meta.env.DEV
    ? undefined
    : (missionData: any, heliType?: string) => {
          (campaignHandler as any).setPreviewMission(missionData);
          cancelAnimationFrame(_rafId);
          _rafId = 0;
          stopHeliSound();

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

window.onload = () => {
    requestAnimationFrame(() => {
        void (async () => {
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
            document.head.insertAdjacentHTML('beforeend', `<style>
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
            </style>`);
            const _rows = (lines: readonly string[]) => lines.map(l => l ? `<p>${l}</p>` : '<br>').join('');
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
                    if (!soundHandler.state.isMuted)
                        soundHandler.play(soundHandler.state.activeTheme, false, 0.4);
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

        document.addEventListener('pointerdown', () => soundHandler.play(musicConfig.mainMenu || 'maintheme', true), {
            once: true,
        });
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
