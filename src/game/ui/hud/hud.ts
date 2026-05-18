import { showMinimap, updateMinimap, type MinimapData } from '../minimap/minimap';
import { setDeliverToggle } from '../touch-controls/touch-controls';

type IsoFn = (wx: number, wy: number, wz: number, cx: number, cy: number) => { x: number; y: number };

export interface HudUpdateState {
    camX: number;
    camY: number;
    dt: number;
    heli: {
        x: number; y: number; z: number;
        vx: number; vy: number;
        winch: number; fuel: number;
        inAir: boolean; engineOn: boolean;
        onboard: number; maxLoad: number;
    };
    groundUnderHeli: number;
    totalRescued: number;
    goalCount: number;
    playerName: string;
    deliverMode: boolean;
    minimap: MinimapData;
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
    const isTouch = () =>
        ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
    const touchShadow = () => (isTouch() ? 'text-shadow:0 0 3px rgba(0,0,0,0.9),0 0 3px rgba(0,0,0,0.9);' : '');

    const panel = d('hud-panel', `font:bold 13px monospace;color:#5f5;line-height:16px;white-space:nowrap;${touchShadow()}`);
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
    const callsign = document.createElement('div');
    callsign.style.cssText = 'font-size:11px;color:#888;';
    panel.appendChild(callsign);

    const deliver = d('hud-deliver', 'left:0;right:0;top:20px;text-align:center;font:bold 14px monospace;color:#f90;');

    let _fuelBeepTimer = 0;
    const _playFuelBeep = () => {
        try {
            const ac = new AudioContext();
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.18, ac.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
            osc.start(ac.currentTime);
            osc.stop(ac.currentTime + 0.15);
            osc.onended = () => ac.close();
        } catch {}
    };

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

        obj.textContent = `SAVED: ${s.totalRescued}/${s.goalCount}`;
        callsign.textContent = s.playerName || '';

        deliver.style.display = s.deliverMode ? 'block' : 'none';
        setDeliverToggle(s.deliverMode);

        updateMinimap(s.minimap);
    };

    return { showAll, update };
};
