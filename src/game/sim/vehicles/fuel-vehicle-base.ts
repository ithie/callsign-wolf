import { G } from '../../state';
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

// Path in local coords (41 sampled points).
// Small angle diff → straight line. Otherwise → quadratic Bezier (single arc, no S-curve).
// DRIVING: on-rails t 0→1. RETURNING: same path t 1→0, reverse gear.

export const runFuelVehicle = (v: FuelVehicleState, dt: number, _ctx: PhysicsCtx, cfg: FuelVehicleCfg) => {
    const heli = G.heli;

    const buildPath = (): { lx: number; ly: number }[] => {
        const p0 = { lx: v.localParkX, ly: v.localParkY };
        const heliLoc = cfg.worldToLocal(heli.x, heli.y);
        const dx = heliLoc.lx - p0.lx, dy = heliLoc.ly - p0.ly;
        const dist = Math.hypot(dx, dy) || 1;
        const stopScale = Math.max(0, dist - cfg.STOP_DIST) / dist;
        const p3 = { lx: p0.lx + dx * stopScale, ly: p0.ly + dy * stopScale };

        const targetAngle = Math.atan2(dy, dx);
        const rawDiff = targetAngle - v.localParkAngle;
        const angleDiff = Math.abs(((rawDiff % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI);

        type Pt = { lx: number; ly: number };
        const N = 40;
        const sample = (fn: (t: number) => Pt): Pt[] => {
            const pts: Pt[] = [];
            for (let i = 0; i <= N; i++) pts.push(fn(i / N));
            return pts;
        };
        const quadratic = (a: Pt, c: Pt, b: Pt, t: number): Pt => {
            const mt = 1 - t;
            return { lx: mt*mt*a.lx + 2*mt*t*c.lx + t*t*b.lx, ly: mt*mt*a.ly + 2*mt*t*c.ly + t*t*b.ly };
        };
        const cubic = (a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt => {
            const mt = 1 - t;
            return {
                lx: mt*mt*mt*a.lx + 3*mt*mt*t*c1.lx + 3*mt*t*t*c2.lx + t*t*t*b.lx,
                ly: mt*mt*mt*a.ly + 3*mt*mt*t*c1.ly + 3*mt*t*t*c2.ly + t*t*t*b.ly,
            };
        };

        if (angleDiff < 0.18) {
            // ~10° or less: straight line
            return sample(t => ({ lx: p0.lx + (p3.lx - p0.lx) * t, ly: p0.ly + (p3.ly - p0.ly) * t }));
        } else if (angleDiff < 0.52) {
            // ~10°–30°: quadratic Bezier — single smooth arc for gentle turns
            const ctrlDist = dist * 0.45 * Math.sin(angleDiff * 0.5);
            const c = {
                lx: p0.lx + Math.cos(v.localParkAngle) * ctrlDist,
                ly: p0.ly + Math.sin(v.localParkAngle) * ctrlDist,
            };
            return sample(t => quadratic(p0, c, p3, t));
        } else {
            // >30°: cubic Bezier — tight exit (p1 short) then broad approach (p2 long)
            const p1 = {
                lx: p0.lx + Math.cos(v.localParkAngle) * dist * 0.15,
                ly: p0.ly + Math.sin(v.localParkAngle) * dist * 0.15,
            };
            const p2 = {
                lx: p3.lx - (dx / dist) * dist * 0.35,
                ly: p3.ly - (dy / dist) * dist * 0.35,
            };
            return sample(t => cubic(p0, p1, p2, p3, t));
        }
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

    // Returns 1.0 on straight sections, down to 0.35 on tight curves.
    const localSpeedFactor = (t: number): number => {
        const wps = v.wps!;
        const N = wps.length - 1;
        const i = Math.min(N - 1, Math.max(1, Math.floor(t * N)));
        const a = wps[i - 1], b = wps[i], c = wps[i + 1] ?? b;
        const ang1 = Math.atan2(b.ly - a.ly, b.lx - a.lx);
        const ang2 = Math.atan2(c.ly - b.ly, c.lx - b.lx);
        const curvature = Math.abs(((ang2 - ang1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        return Math.max(0.35, 1 - curvature * 3);
    };

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
        if (!v.wps) { v.wps = buildPath(); }
        if (v.state !== 'DRIVING') v.t = 1.0;
        v.state = 'RETURNING';
    }

    if (v.state === 'DRIVING') {
        if (!v.wps) { v.wps = buildPath(); v.t = 0; }
        v.t = Math.min(1, v.t + cfg.SPEED * localSpeedFactor(v.t) * dt / pathLength());
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
    } else if (v.state === 'ARM_IN') {
        v.t = Math.min(1, v.t + 0.016 * dt);
        v.arm = 1 - v.t;
        if (v.t >= 1) { v.state = 'RETURNING'; v.t = 1.0; }
    } else if (v.state === 'RETURNING') {
        v.t = Math.max(0, v.t - cfg.SPEED_REV * localSpeedFactor(v.t) * dt / pathLength());
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
