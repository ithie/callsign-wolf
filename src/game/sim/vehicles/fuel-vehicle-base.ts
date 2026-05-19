import { G } from '../../state';
import { I18N } from '../../i18n';
import { PhysicsCtx } from '../ctx';

export interface FuelVehicle {
    init(): void;
    update(dt: number, ctx: PhysicsCtx): void;
}

export interface FuelVehicleState {
    x: number; y: number; angle: number;
    localParkX: number; localParkY: number; localParkAngle: number;
    wps: { lx: number; ly: number }[] | null;
    t: number;
    arm?: number;
    state: string;
}

export interface FuelVehicleCfg {
    localToWorld: (lx: number, ly: number) => { x: number; y: number };
    worldToLocal: (wx: number, wy: number) => { lx: number; ly: number };
    parkSnapFn?: () => void;
    getParentAngle?: () => number;
    SPEED: number;
    SPEED_REV: number;
    STOP_DIST: number;
    FUEL_RATE: number;
    hasArm: boolean;
}

// Cubic Bezier path in local coords (41 sampled points).
// DRIVING: on-rails t 0→1. RETURNING: same path t 1→0, reverse gear.

export const runFuelVehicle = (v: FuelVehicleState, dt: number, ctx: PhysicsCtx, cfg: FuelVehicleCfg) => {
    const heli = G.heli;

    const buildBezier = (): { lx: number; ly: number }[] => {
        const p0 = { lx: v.localParkX, ly: v.localParkY };
        const heliLoc = cfg.worldToLocal(heli.x, heli.y);
        const dx = heliLoc.lx - p0.lx, dy = heliLoc.ly - p0.ly;
        const dist = Math.hypot(dx, dy) || 1;
        const stopScale = Math.max(0, dist - cfg.STOP_DIST) / dist;
        const p3 = { lx: p0.lx + dx * stopScale, ly: p0.ly + dy * stopScale };
        const ctrlDist = dist * 0.4;
        const p1 = {
            lx: p0.lx + Math.cos(v.localParkAngle) * ctrlDist,
            ly: p0.ly + Math.sin(v.localParkAngle) * ctrlDist,
        };
        const p2 = {
            lx: p3.lx - (dx / dist) * ctrlDist,
            ly: p3.ly - (dy / dist) * ctrlDist,
        };
        const N = 40;
        const pts: { lx: number; ly: number }[] = [];
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            const mt = 1 - t;
            pts.push({
                lx: mt*mt*mt*p0.lx + 3*mt*mt*t*p1.lx + 3*mt*t*t*p2.lx + t*t*t*p3.lx,
                ly: mt*mt*mt*p0.ly + 3*mt*mt*t*p1.ly + 3*mt*t*t*p2.ly + t*t*t*p3.ly,
            });
        }
        return pts;
    };

    const sampleWorld = (t: number) => {
        const wps = v.wps!;
        const N = wps.length - 1;
        const raw = Math.max(0, Math.min(N, t * N));
        const i = Math.min(N - 1, Math.floor(raw));
        const f = raw - i;
        const a = wps[i], b = wps[i + 1] ?? a;
        return cfg.localToWorld(a.lx + (b.lx - a.lx) * f, a.ly + (b.ly - a.ly) * f);
    };

    const pathLength = () =>
        (v.wps ?? []).reduce((s, p, i, arr) =>
            i > 0 ? s + Math.hypot(p.lx - arr[i - 1].lx, p.ly - arr[i - 1].ly) : 0, 0) || 1;

    const setAngleFromTangent = (t: number) => {
        const eps = 0.03;
        const pFwd = sampleWorld(Math.min(1, t + eps));
        const pBwd = sampleWorld(Math.max(0, t - eps));
        v.angle = Math.atan2(pFwd.y - pBwd.y, pFwd.x - pBwd.x);
    };

    if (v.state === 'PARKED') { cfg.parkSnapFn?.(); return; }

    // Heli started engine — abort to RETURNING from current position
    if (heli.engineOn && v.state !== 'RETURNING') {
        v.arm = 0;
        if (!v.wps) { v.wps = buildBezier(); }
        if (v.state !== 'DRIVING') v.t = 1.0;
        v.state = 'RETURNING';
    }

    if (v.state === 'DRIVING') {
        if (!v.wps) { v.wps = buildBezier(); v.t = 0; }
        v.t = Math.min(1, v.t + cfg.SPEED * dt / pathLength());
        const pos = sampleWorld(v.t);
        v.x = pos.x; v.y = pos.y;
        setAngleFromTangent(v.t);
        if (v.t >= 1) {
            v.state = cfg.hasArm ? 'ARM_OUT' : 'FUELING';
            v.t = cfg.hasArm ? 0 : 1.0;
        }
    } else if (v.state === 'ARM_OUT') {
        v.t = Math.min(1, v.t + 0.016 * dt);
        v.arm = v.t;
        if (v.t >= 1) { v.state = 'FUELING'; v.t = 0; }
    } else if (v.state === 'FUELING') {
        const pos = sampleWorld(1.0);
        v.x = pos.x; v.y = pos.y;
        setAngleFromTangent(1.0);
        if (heli.fuel < 100) {
            heli.fuel = Math.min(100, heli.fuel + cfg.FUEL_RATE * dt);
        } else {
            v.state = cfg.hasArm ? 'ARM_IN' : 'RETURNING';
            v.t = cfg.hasArm ? 0 : 1.0;
        }
        if (heli.onboard > 0) {
            G.totalRescued += heli.onboard;
            heli.onboard = 0;
            if (G.totalRescued >= G.goalCount) ctx.missionComplete();
            else ctx.showMsg(I18N.SECURED(G.totalRescued, G.goalCount));
        }
    } else if (v.state === 'ARM_IN') {
        v.t = Math.min(1, v.t + 0.016 * dt);
        v.arm = 1 - v.t;
        if (v.t >= 1) { v.state = 'RETURNING'; v.t = 1.0; }
    } else if (v.state === 'RETURNING') {
        v.t = Math.max(0, v.t - cfg.SPEED_REV * dt / pathLength());
        const pos = sampleWorld(v.t);
        v.x = pos.x; v.y = pos.y;
        setAngleFromTangent(v.t);
        if (v.t <= 0) {
            const lp = cfg.worldToLocal(v.x, v.y);
            v.localParkX = lp.lx;
            v.localParkY = lp.ly;
            v.localParkAngle = cfg.getParentAngle ? v.angle - cfg.getParentAngle() : v.angle;
            v.wps = null;
            v.state = 'PARKED';
        }
    }
};
