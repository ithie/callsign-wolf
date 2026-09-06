import { showMinimap, updateMinimap, type MinimapData } from '../minimap/minimap';
import { setDeliverToggle } from '../touch-controls/touch-controls';
import { playSfx } from '../../heli-sound';

type IsoFn = (wx: number, wy: number, wz: number, cx: number, cy: number) => { x: number; y: number };

export interface HudUpdateState {
    camX: number;
    camY: number;
    dt: number;
    heli: {
        x: number;
        y: number;
        z: number;
        vx: number;
        vy: number;
        winch: number;
        fuel: number;
        inAir: boolean;
        engineOn: boolean;
        onboard: number;
        maxLoad: number;
    };
    groundUnderHeli: number;
    totalRescued: number;
    goalCount: number;
    playerName: string;
    deliverMode: boolean;
    minimap: MinimapData;
    maxTimeRemaining: number | null;
    ringsFlown: number;
    ringsTotal: number;
    altLimit: number | null;
    altViolationStart: number | null;
}

interface HudOpts {
    isoFn: IsoFn;
    canvas: HTMLCanvasElement;
}

export const createHud = ({ isoFn, canvas }: HudOpts) => {
    const d = (id: string, css: string) => {
        const el = document.createElement('div');
        el.id = id;
        el.style.cssText = `position:absolute;pointer-events:none;z-index:120;display:none;${css}`;
        document.body.appendChild(el);
        return el;
    };

    const touchShadow = () => 'text-shadow:0 0 3px rgba(0,0,0,0.9),0 0 3px rgba(0,0,0,0.9);';

    const panel = d(
        'hud-panel',
        `font:bold 13px monospace;color:#5f5;line-height:16px;white-space:nowrap;${touchShadow()}`
    );
    const alt = document.createElement('div');
    panel.appendChild(alt);
    const spd = document.createElement('div');
    panel.appendChild(spd);
    const winch = document.createElement('div');
    panel.appendChild(winch);
    const fuel = document.createElement('div');
    panel.appendChild(fuel);
    const pax = document.createElement('div');
    panel.appendChild(pax);
    const obj = document.createElement('div');
    panel.appendChild(obj);
    const countdown = document.createElement('div');
    panel.appendChild(countdown);
    const rings = document.createElement('div');
    panel.appendChild(rings);
    const altWarn = document.createElement('div');
    panel.appendChild(altWarn);
    const callsign = document.createElement('div');
    callsign.style.cssText = 'font-size:11px;color:#888;';
    panel.appendChild(callsign);

    const deliver = d('hud-deliver', 'left:0;right:0;top:20px;text-align:center;font:bold 14px monospace;color:#f90;');

    let _fuelBeepTimer = 0;
    const _playFuelBeep = () => playSfx(880, 0.15, 0.18);

    const showAll = (v: boolean) => {
        panel.style.display = v ? 'block' : 'none';
        showMinimap(v);
    };

    const update = (s: HudUpdateState) => {
        const scale = window.innerWidth / canvas.width;
        const heliPos = isoFn(s.heli.x, s.heli.y, s.heli.z, s.camX, s.camY);
        panel.style.left = `${heliPos.x * scale + 45}px`;
        panel.style.top = `${heliPos.y * scale - 35}px`;

        alt.textContent = `ALT: ${Math.round((s.heli.z - s.groundUnderHeli) * 10)}m`;
        spd.textContent = `SPD: ${Math.round(Math.hypot(s.heli.vx, s.heli.vy) * 1115)}km/h`;
        winch.textContent = `WINCH: ${Math.round(s.heli.winch * 10)}m`;
        fuel.textContent = `FUEL: ${Math.max(0, Math.round(s.heli.fuel))}%`;
        fuel.style.color = s.heli.fuel < 20 ? '#f00' : '#5f5';

        if (s.heli.fuel > 0 && s.heli.fuel < 20 && s.heli.inAir && s.heli.engineOn) {
            _fuelBeepTimer -= s.dt;
            if (_fuelBeepTimer <= 0) {
                _fuelBeepTimer = s.heli.fuel < 10 ? 60 : 120;
                _playFuelBeep();
            }
        } else {
            _fuelBeepTimer = 0;
        }

        pax.textContent = `PAX: ${s.heli.onboard}/${s.heli.maxLoad}`;
        pax.style.color = s.heli.onboard >= s.heli.maxLoad ? '#f90' : '#5f5';

        obj.textContent = s.goalCount > 0 ? `SAVED: ${s.totalRescued}/${s.goalCount}` : '';

        if (s.maxTimeRemaining !== null) {
            const secs = Math.max(0, Math.ceil(s.maxTimeRemaining));
            const mm = Math.floor(secs / 60).toString().padStart(2, '0');
            const ss = (secs % 60).toString().padStart(2, '0');
            countdown.textContent = `TIME: ${mm}:${ss}`;
            countdown.style.color = s.maxTimeRemaining < 30 ? '#f44' : '#5f5';
            countdown.style.display = 'block';
        } else {
            countdown.style.display = 'none';
        }

        if (s.ringsTotal > 0) {
            rings.textContent = `RINGS: ${s.ringsFlown}/${s.ringsTotal}`;
            rings.style.color = s.ringsFlown >= s.ringsTotal ? '#4f4' : '#FFD700';
            rings.style.display = 'block';
        } else {
            rings.style.display = 'none';
        }

        if (s.altLimit !== null) {
            const aboveGround = s.heli.z - s.groundUnderHeli;
            const ratio = aboveGround / s.altLimit;
            if (ratio >= 1.0 && s.altViolationStart !== null) {
                const secLeft = Math.max(0, 5 - (Date.now() - s.altViolationStart) / 1000);
                altWarn.textContent = `MAX ALT! ${secLeft.toFixed(1)}s`;
                altWarn.style.color = '#f44';
                altWarn.style.display = 'block';
            } else if (ratio >= 0.8) {
                altWarn.textContent = `MAX ALT: ${Math.round(s.altLimit * 10)}m`;
                altWarn.style.color = '#ff0';
                altWarn.style.display = 'block';
            } else {
                altWarn.style.display = 'none';
            }
        } else {
            altWarn.style.display = 'none';
        }

        callsign.textContent = s.playerName || '';

        deliver.style.display = s.deliverMode ? 'block' : 'none';
        setDeliverToggle(s.deliverMode);

        updateMinimap(s.minimap);
    };

    return { showAll, update };
};
