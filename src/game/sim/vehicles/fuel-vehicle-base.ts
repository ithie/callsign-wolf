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
    localFuelX?: number; localFuelY?: number; localFuelAngle?: number;
    wps: { lx: number; ly: number }[] | null;
    wpI: number;
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
    MAX_STEER: number;
    STOP_DIST: number;
    FUEL_RATE: number;
    hasArm: boolean;
}

// wps[0] = park, wps[1] = stop point — straight line in local coord space.
// DRIVING: navigate forward, then final approach to heli.
// RETURNING: on-rails t 1→0, t=0 = exact park.

export const runFuelVehicle = (v: FuelVehicleState, dt: number, ctx: PhysicsCtx, cfg: FuelVehicleCfg) => {
    const heli = G.heli;

    const navigate = (tx: number, ty: number): number => {
        const dx = tx - v.x, dy = ty - v.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.01) return 0;
        const desired = Math.atan2(dy, dx);
        const diff = ((desired - v.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        v.angle += Math.max(-cfg.MAX_STEER * dt, Math.min(cfg.MAX_STEER * dt, diff));
        v.x += Math.cos(v.angle) * cfg.SPEED * dt;
        v.y += Math.sin(v.angle) * cfg.SPEED * dt;
        return dist;
    };

    const buildWps = () => {
        const p0 = { lx: v.localParkX, ly: v.localParkY };
        const heliLoc = cfg.worldToLocal(heli.x, heli.y);
        const fullDx = heliLoc.lx - p0.lx, fullDy = heliLoc.ly - p0.ly;
        const fullDist = Math.hypot(fullDx, fullDy) || 1;
        const stopScale = Math.max(0, fullDist - cfg.STOP_DIST) / fullDist;
        return [p0, { lx: p0.lx + fullDx * stopScale, ly: p0.ly + fullDy * stopScale }];
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

    if (v.state === 'PARKED') { cfg.parkSnapFn?.(); return; }

    if (heli.engineOn && v.state !== 'RETURNING') {
        v.arm = 0;
        if (!v.wps) { v.wps = buildWps(); v.wpI = 0; }
        const progress = v.state === 'DRIVING' && v.wps
            ? Math.min(1.0, (v.wpI ?? 0) / Math.max(1, v.wps.length - 1))
            : 1.0;
        v.state = 'RETURNING';
        v.t = progress;
    }

    if (v.state === 'DRIVING') {
        if (!v.wps) { v.wps = buildWps(); v.wpI = 0; }
        if (v.wpI < v.wps.length) {
            const wp = cfg.localToWorld(v.wps[v.wpI].lx, v.wps[v.wpI].ly);
            if (navigate(wp.x, wp.y) < 1.4) v.wpI++;
        } else {
            const heliLoc = cfg.worldToLocal(heli.x, heli.y);
            const fullDx = heliLoc.lx - v.localParkX, fullDy = heliLoc.ly - v.localParkY;
            const fullDist = Math.hypot(fullDx, fullDy) || 1;
            const stopScale = Math.max(0, fullDist - cfg.STOP_DIST) / fullDist;
            const sw = cfg.localToWorld(v.localParkX + fullDx * stopScale, v.localParkY + fullDy * stopScale);
            if (navigate(sw.x, sw.y) <= 0.5) {
                v.state = cfg.hasArm ? 'ARM_OUT' : 'FUELING';
                v.t = cfg.hasArm ? 0 : 1.0;
                const lp = cfg.worldToLocal(v.x, v.y);
                v.localFuelX = lp.lx; v.localFuelY = lp.ly;
                v.localFuelAngle = cfg.getParentAngle ? v.angle - cfg.getParentAngle() : v.angle;
            }
        }
    } else if (v.state === 'ARM_OUT') {
        v.t = Math.min(1, v.t + 0.016 * dt);
        v.arm = v.t;
        if (v.t >= 1) { v.state = 'FUELING'; v.t = 0; }
    } else if (v.state === 'FUELING') {
        if (v.localFuelX !== undefined) {
            const wp = cfg.localToWorld(v.localFuelX, v.localFuelY!);
            v.x = wp.x; v.y = wp.y;
            if (cfg.getParentAngle) v.angle = v.localFuelAngle! + cfg.getParentAngle();
        }
        if (heli.fuel < 100) {
            heli.fuel = Math.min(100, heli.fuel + cfg.FUEL_RATE * dt);
        } else {
            v.state = cfg.hasArm ? 'ARM_IN' : 'RETURNING';
            v.t = cfg.hasArm ? 0 : 1.0;
            if (!cfg.hasArm && !v.wps) { v.wps = buildWps(); }
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
        if (v.t >= 1) {
            if (!v.wps) { v.wps = buildWps(); }
            v.state = 'RETURNING'; v.t = 1.0;
        }
    } else if (v.state === 'RETURNING') {
        v.t = Math.max(0, v.t - cfg.SPEED_REV * dt / pathLength());
        const pos = sampleWorld(v.t);
        v.x = pos.x; v.y = pos.y;
        const eps = 0.04;
        const pFwd = sampleWorld(Math.min(1, v.t + eps));
        const pBwd = sampleWorld(Math.max(0, v.t - eps));
        v.angle = Math.atan2(pFwd.y - pBwd.y, pFwd.x - pBwd.x);
        if (v.t <= 0) { v.wps = null; v.state = 'PARKED'; }
    }
};
