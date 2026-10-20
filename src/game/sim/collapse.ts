import { G } from '../state';
import { getGround } from './terrain';
import { initAt as explosionAt } from './particles/explosion';
import { getAttachEntity } from './world-init';
import { COLLAPSE_PARAM, COLLAPSE_DIR_PARAM, COLLAPSE_WIND_PARAM, COLLAPSE_BURST_PARAM, COLLAPSE_DROP, collapseEase } from '../def-utils';

// Generic "falls in on itself" destruction for any placeable object — there are no
// separate wreck models. The renderer reads COLLAPSE_PARAM (see def-utils
// _collectNode) and tilts/drops every model node around its own foot point.

const COLLAPSE_SECONDS = 3.5;

export type Collapsible = {
    x: number;
    y: number;
    destroyed?: boolean;
    spinning?: boolean;
    // windDir is model-local (world wind direction minus the object's angle).
    // burst: vessels break apart into pieces instead of folding in on themselves.
    _collapse?: { t: number; windDir: number; wind: number; burst: boolean; baseZ: number };
};

const _collapsing: Collapsible[] = [];

export const resetCollapses = (): void => { _collapsing.length = 0; };

// Spread into the params of renderNodes()/applyNodes() for the object's model.
export const collapseParams = (e: Collapsible | null | undefined): Record<string, number> =>
    e?._collapse
        ? {
            [COLLAPSE_PARAM]: e._collapse.t, [COLLAPSE_DIR_PARAM]: e._collapse.windDir,
            [COLLAPSE_WIND_PARAM]: e._collapse.wind, [COLLAPSE_BURST_PARAM]: e._collapse.burst ? 1 : 0,
        }
        : {};

// Unsheltered wind at collapse time, ~Beaufort (rawStr = bft * 0.6 / 10 * 0.0002 * gust),
// mapped to 0..1 with Bft 6 as full strength.
const _windStrength01 = (): number => Math.min(1, G.wind.rawStr / 0.000012 / 6);

// Spray over water, dust on land — same palette as the heli downwash.
const _groundBurst = (x: number, y: number, baseZ: number): void => {
    const overWater = getGround(x, y) <= G.waterLevel + 0.1;
    const windX = Math.cos(G.wind.angle) * G.wind.rawStr * 0.006;
    const windY = Math.sin(G.wind.angle) * G.wind.rawStr * 0.006;
    for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 0.03 + Math.random() * 0.07;
        G.particles.push({
            x: x + Math.cos(a) * 0.4, y: y + Math.sin(a) * 0.4, z: baseZ + 0.1,
            vx: Math.cos(a) * spd + windX, vy: Math.sin(a) * spd + windY, vz: 0.005 + Math.random() * 0.02,
            life: 0.9 + Math.random() * 0.6,
            size: 6 + Math.random() * 8,
            color: overWater ? '200, 230, 255' : '150, 140, 120',
            isSmoke: true,
        });
    }
};

// The model itself falls apart (def-utils) — no separate fragment copies, which would
// show a second, flying-off version of the same parts.
export const startCollapse = (e: Collapsible, opts: { baseZ: number; angle?: number; burst?: boolean }): void => {
    if (e._collapse) return;
    // Direction is fixed at the moment of collapse, so the parts don't swing with gusts.
    e._collapse = { t: 0, windDir: G.wind.angle - (opts.angle ?? 0), wind: _windStrength01(), burst: !!opts.burst, baseZ: opts.baseZ };
    e.destroyed = true;
    if (e.spinning !== undefined) e.spinning = false;
    explosionAt({ particles: G.particles, debris: G.debris } as any, e.x, e.y, opts.baseZ + 0.5);
    _groundBurst(e.x, e.y, opts.baseZ);
    // Whoever still waits on the object goes down with it. Not rescued, so the
    // goal count stays — what follows (e.g. a failed mission) is up to the script.
    for (const p of G.payloads as any[]) {
        if (p.rescued || p.hanging || p._lost || !p.attachTo || getAttachEntity(p.attachTo) !== e) continue;
        p._lost = { owner: e, z0: p.z };
    }
    _collapsing.push(e);
};

export const updateCollapses = (dt: number): void => {
    for (const e of _collapsing) {
        if (e._collapse!.t < 1) e._collapse!.t = Math.min(1, e._collapse!.t + dt / (60 * COLLAPSE_SECONDS));
    }
    // Fire/smoke owned by an object sink onto its rubble with the same drop as its model.
    for (const em of G.PARTICLE_EMITTERS) {
        const owner = em.owner as Collapsible | undefined;
        if (!owner?._collapse || em.ownerZ === undefined || em.ownerBaseZ === undefined) continue;
        em.gz = em.ownerBaseZ + em.ownerZ * (1 - COLLAPSE_DROP * collapseEase(owner._collapse.t));
    }
    // Lost payloads sink with their object and disappear once it has come down.
    for (let i = G.payloads.length - 1; i >= 0; i--) {
        const p: any = G.payloads[i];
        const c = p._lost?.owner._collapse;
        if (!c) continue;
        p.z = c.baseZ + (p._lost.z0 - c.baseZ) * (1 - COLLAPSE_DROP * collapseEase(c.t));
        if (c.t >= 1) G.payloads.splice(i, 1);
    }
};
