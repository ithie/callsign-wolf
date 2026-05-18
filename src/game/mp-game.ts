import { G, zstate } from './state';
import { mpState, resetMpState } from './multiplayer/mp-state';
import { applyHeliSnap, applyWorldSnap, packHeli, packWorld } from './multiplayer/sync';
import { MP_CAMPAIGN_INDEX, MP_COUNTDOWN_SEC, MP_PAD } from './multiplayer/mp-mission';
import type { MpChannels } from './multiplayer/rtc';
import { mountMpLobby, showMpLobby, hideMpLobby, setLobbyCallsign } from './ui/mp-lobby/mp-lobby';
import { soundHandler, campaignHandler, musicConfig } from './main';
import { stopMenuParticles } from './ui/menu-particles/menu-particles';
import { initGrid } from './sim/terrain';
import { spawnExplosion } from './sim/particles';
import { getHeliType } from './heli-types';
import { tileW as _tileW, tileH as _tileH, gameRenderScale } from './render-config';
const tileW = Math.round(_tileW * gameRenderScale);
const tileH = Math.round(_tileH * gameRenderScale);

type MpGameDeps = {
    cancelRaf: () => void;
    ctx: CanvasRenderingContext2D;
    getPlayerName: () => string;
    setTouchVisible: (v: boolean) => void;
    setSelectedCampaignIndex: (i: number) => void;
    launchMission: () => Promise<void>;
    showMsg: (txt: string) => void;
};

export let toMpLobby: (() => void) | undefined;
export let mpReturnToLobby: (() => void) | undefined;
export let mpMissionComplete: (() => void) | undefined;
export let mpTriggerCrash: ((reason: string) => void) | undefined;
export let mpTimeOut: (() => void) | undefined;

export const initMpGame = (deps: MpGameDeps): void => {
    const { cancelRaf, ctx, getPlayerName, setTouchVisible, setSelectedCampaignIndex, launchMission, showMsg } = deps;

    const _mpMissionComplete = () => {
        mpState.channels?.sendEvent({ t: 'done' });
        document.getElementById('mission-success-screen')!.style.display = 'flex';
    };

    const _mpTimeOut = () => {
        document.getElementById('campaign-failed-reason')!.innerHTML = 'ZEIT ABGELAUFEN';
        document.getElementById('campaign-failed-screen')!.style.display = 'flex';
    };

    const _setupMpChannels = (channels: MpChannels, isHost: boolean) => {
        mpState.channels = channels;
        channels.onPos(snap => {
            if (G.remoteHeli) applyHeliSnap(snap, G.remoteHeli);
        });
        channels.onEvent(evt => {
            if (evt.t === 'world' && !isHost) {
                applyWorldSnap(evt.s, G, n => { mpState.countdown = n; });
            } else if (evt.t === 'rescue') {
                G.totalRescued = evt.total;
            } else if (evt.t === 'done') {
                _mpMissionComplete();
            } else if (evt.t === 'heli') {
                if (G.remoteHeli) G.remoteHeli.type = evt.heliType;
            }
            // 'hello', 'ready', 'start', 'crash' handled in lobby or respawn
        });
    };

    const startMpGame = async (isHost: boolean, peerCallsign: string, heliType: string) => {
        stopMenuParticles();
        soundHandler.play(musicConfig.mainMenu || 'maintheme', false);

        mpState.active = true;
        mpState.isHost = isHost;
        mpState.peerCallsign = peerCallsign;
        mpState.countdown = MP_COUNTDOWN_SEC;
        mpState.countdownMax = MP_COUNTDOWN_SEC;
        mpState.respawnTimer = 0;

        setSelectedCampaignIndex(MP_CAMPAIGN_INDEX);
        campaignHandler.campaign.setActiveCampaign(MP_CAMPAIGN_INDEX);

        const { gridSize, objects: mpObjs } = campaignHandler.getCurrentMissionData();
        const padObj = (mpObjs || []).find((o: any) => o.type === 'pad') || MP_PAD;
        G.PAD = { xMin: padObj.x, xMax: padObj.x + 7, yMin: padObj.y, yMax: padObj.y + 7, z: 0.5 };
        G.START_POS = { x: padObj.x + 3.5, y: padObj.y + 3.5 };
        initGrid(gridSize, G.points);

        G.heli.type = heliType;
        const _heliType = getHeliType(heliType);
        G.heli.maxLoad = _heliType.maxLoad;
        G.heli.accel = _heliType.accel;
        G.heli.friction = _heliType.friction;
        G.heli.tiltSpeed = _heliType.tiltSpeed;
        G.heli.fuelRate = _heliType.fuelRate;
        G.heli.liftPower = _heliType.liftPower;
        G.heli.cargoResist = _heliType.cargoResist;

        G.remoteHeli = {
            type: heliType,
            x: 0, y: 0, z: 0,
            vx: 0, vy: 0, vz: 0,
            angle: 0, tilt: 0, roll: 0,
            rotorRPM: 0, rotationPos: 0,
            inAir: false,
        };

        ['splash', 'main-menu', 'campaign-select', 'heli-select'].forEach(id => {
            const e = document.getElementById(id);
            if (e) e.style.display = 'none';
        });

        await launchMission();

        mpState.spawnX = G.heli.x;
        mpState.spawnY = G.heli.y;
        mpState.spawnZ = G.heli.z;
        mpState.spawnAngle = G.heli.angle;

        if (!isHost) {
            G.heli.x = G.PAD.xMin + 3.5;
            G.heli.y = G.PAD.yMin + 3.5;
            G.heli.z = G.PAD.z + 0.1;
            G.heli.vx = 0; G.heli.vy = 0; G.heli.vz = 0;
            G.heli.angle = 0;
            G.heli.engineOn = false;
            G.heli.rotorRPM = 0;
            zstate.cam.x = (G.heli.x - G.heli.y) * (tileW / 2);
            zstate.cam.y = (G.heli.x + G.heli.y) * (tileH / 2);
            mpState.spawnX = G.heli.x;
            mpState.spawnY = G.heli.y;
            mpState.spawnZ = G.heli.z;
            mpState.spawnAngle = 0;
        }

        mpState.channels?.sendEvent({ t: 'heli', heliType });
        soundHandler.play(campaignHandler.getActiveCampaignMusic().ingame || 'clike', false);
    };

    const _toMpLobby = () => {
        document.getElementById('main-menu')!.style.display = 'none';
        setLobbyCallsign(getPlayerName());
        showMpLobby({
            onConnected: (isHost: boolean, peerCallsign: string, channels: MpChannels, heliType: string) => {
                _setupMpChannels(channels, isHost);
                startMpGame(isHost, peerCallsign, heliType);
            },
            onBack: () => {
                hideMpLobby();
                document.getElementById('main-menu')!.style.display = 'flex';
            },
        });
    };

    const _mpReturnToLobby = () => {
        cancelRaf();
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        G.remoteHeli = null;
        resetMpState();
        zstate.crashed = false;
        zstate.gameStarted = false;
        G.particles = [];
        G.debris = [];
        setTouchVisible(false);
        ['mission-success-screen', 'campaign-failed-screen', 'campaign-complete-screen', 'crash-screen'].forEach(id => {
            const e = document.getElementById(id);
            if (e) e.style.display = 'none';
        });
        _toMpLobby();
    };

    const _mpTriggerCrash = (reason: string) => {
        if (mpState.respawnTimer > 0) return;
        mpState.respawnTimer = 1;
        mpState.channels?.sendEvent({ t: 'crash', role: mpState.isHost ? 'host' : 'guest' });
        spawnExplosion(G.heli, G.particles, G.debris, G.points, G.CARRIER);
        showMsg(reason);
        G.heli.vx = 0; G.heli.vy = 0; G.heli.vz = 0;
        G.heli.engineOn = false;
        G.heli.rotorRPM = 0;
        G.heli.inAir = false;
        setTimeout(() => {
            G.heli.x = mpState.spawnX;
            G.heli.y = mpState.spawnY;
            G.heli.z = mpState.spawnZ;
            G.heli.angle = mpState.spawnAngle;
            G.heli.vx = 0; G.heli.vy = 0; G.heli.vz = 0;
            G.heli.engineOn = false;
            G.heli.rotorRPM = 0;
            G.heli.fuel = 1.0;
            G.heli.onboard = 0;
            G.heli.inAir = false;
            zstate.cam.x = (G.heli.x - G.heli.y) * (tileW / 2);
            zstate.cam.y = (G.heli.x + G.heli.y) * (tileH / 2);
            mpState.respawnTimer = 0;
        }, 2500);
    };

    toMpLobby = _toMpLobby;
    mpReturnToLobby = _mpReturnToLobby;
    mpMissionComplete = _mpMissionComplete;
    mpTriggerCrash = _mpTriggerCrash;
    mpTimeOut = _mpTimeOut;

    mountMpLobby();
};

// ─── Render / tick helpers called from game.ts behind !_IS_APP guards ─────────

type DrawHeliFn = (
    type: string, x: number, y: number, z: number,
    angle: number, tilt: number, roll: number, rotorPos: number,
    camX: number, camY: number,
    opts?: Record<string, unknown>,
) => void;

type IsoFn = (wx: number, wy: number, wz: number, cx: number, cy: number) => { x: number; y: number };

export const mpHandleReturnToBase = (): boolean => {
    if (mpState.active && mpReturnToLobby) {
        mpReturnToLobby();
        return true;
    }
    return false;
};

export const mpRenderRemoteHeli = (
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    drawHeli: DrawHeliFn,
    isoFn: IsoFn,
): void => {
    if (!G.remoteHeli) return;
    drawHeli(
        G.remoteHeli.type, G.remoteHeli.x, G.remoteHeli.y, G.remoteHeli.z,
        G.remoteHeli.angle, G.remoteHeli.tilt, G.remoteHeli.roll, G.remoteHeli.rotationPos,
        camX, camY, { fillColor: '#4488ff', strokeColor: '#2255cc' },
    );
    const rPos = isoFn(G.remoteHeli.x, G.remoteHeli.y, G.remoteHeli.z, camX, camY);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#7cf';
    ctx.textAlign = 'center';
    ctx.fillText(mpState.peerCallsign || 'P2', rPos.x, rPos.y - 32);
    ctx.textAlign = 'left';
};

export const mpRenderMinimapDot = (
    ctx: CanvasRenderingContext2D,
    bx: number,
    by: number,
    sc: number,
    inMM: (x: number, y: number) => boolean,
): void => {
    if (!mpState.active || !G.remoteHeli || !inMM(G.remoteHeli.x, G.remoteHeli.y)) return;
    ctx.fillStyle = '#7cf';
    ctx.fillRect(bx + G.remoteHeli.x * sc - 1.5, by + G.remoteHeli.y * sc - 1.5, 3, 3);
};

export const mpTickAndHUD = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    dt: number,
): void => {
    if (!mpState.active) return;

    {
        const cd = Math.max(0, Math.ceil(mpState.countdown));
        const mins = Math.floor(cd / 60);
        const secs = cd % 60;
        const cdStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = cd < 60 ? '#f44' : '#ff0';
        ctx.textAlign = 'center';
        ctx.fillText(cdStr, canvas.width / 2, 28);
        ctx.textAlign = 'left';
    }

    const now = performance.now();
    if (now - mpState.lastPosSent > 50) {
        mpState.channels?.sendPos(packHeli(G.heli));
        mpState.lastPosSent = now;
    }
    if (mpState.isHost) {
        if (mpState.respawnTimer === 0) {
            mpState.countdown = Math.max(0, mpState.countdown - dt / 60);
        }
        if (mpState.countdown <= 0 && mpState.respawnTimer === 0) {
            mpTimeOut?.();
        }
        if (now - mpState.lastWorldSent > 100) {
            mpState.channels?.sendEvent({
                t: 'world',
                s: packWorld(G.seaTime, G.payloads, G.totalRescued, mpState.countdown),
            });
            mpState.lastWorldSent = now;
        }
    }
};

export const mpGetMissionComplete = (fallback: () => void): (() => void) =>
    mpState.active ? mpMissionComplete ?? fallback : fallback;

export const mpGetTriggerCrash = (fallback: (reason: string) => void): ((reason: string) => void) =>
    mpState.active ? mpTriggerCrash ?? fallback : fallback;
