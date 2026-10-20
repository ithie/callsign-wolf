import type { DEF, DEFFace } from './defs';

const _rotateVerts = (
    verts: number[][],
    pivot: [number, number, number],
    axis: [number, number, number],
    angle: number,
): number[][] => {
    const [px, py, pz] = pivot;
    const [ax, ay, az] = axis;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const t = 1 - cos;
    return verts.map(([x, y, z]) => {
        const dx = x - px, dy = y - py, dz = z - pz;
        const dot = ax * dx + ay * dy + az * dz;
        return [
            px + dx * cos + (ay * dz - az * dy) * sin + ax * dot * t,
            py + dy * cos + (az * dx - ax * dz) * sin + ay * dot * t,
            pz + dz * cos + (ax * dy - ay * dx) * sin + az * dot * t,
        ];
    });
};

/**
 * Bakes parts (and legacy rotateNodes) into regular faces by applying Rodrigues' rotation formula.
 * opts.only filters which part IDs to include (default: all parts).
 * Parts with a parent field are rotated in the already-transformed space of their parent.
 * Call this each frame before passing a DEF to SceneRenderer.
 */
type RotFn = (verts: number[][]) => number[][];

const _buildRotFnCache = (def: DEF, params: Record<string, number>) => {
    const partMap = new Map(def.parts!.map(p => [p.id, p]));
    const cache = new Map<string, RotFn>();
    const getRotFn = (partId: string): RotFn => {
        if (cache.has(partId)) return cache.get(partId)!;
        const part = partMap.get(partId);
        if (!part) {
            const identity: RotFn = v => v;
            cache.set(partId, identity);
            return identity;
        }
        let fn: RotFn;
        if (part.parent) {
            const parentFn = getRotFn(part.parent);
            if (part.rotate) {
                const angle = params[part.rotate.param] ?? 0;
                const tPivot = parentFn([part.rotate.pivot])[0] as [number, number, number];
                const { axis } = part.rotate;
                fn = verts => _rotateVerts(parentFn(verts), tPivot, axis, angle);
            } else {
                fn = parentFn;
            }
        } else if (part.rotate) {
            const angle = params[part.rotate.param] ?? 0;
            const { pivot, axis } = part.rotate;
            fn = verts => _rotateVerts(verts, pivot, axis, angle);
        } else {
            fn = verts => verts;
        }
        cache.set(partId, fn);
        return fn;
    };
    return getRotFn;
};

const applyParts = (def: DEF, params: Record<string, number>, opts?: { only?: string[] }): DEF => {
    const extraFaces: DEFFace[] = [];

    if (def.parts?.length) {
        const getRotFn = _buildRotFnCache(def, params);
        for (const part of def.parts) {
            if (opts?.only && !opts.only.includes(part.id)) continue;
            const rotFn = getRotFn(part.id);
            for (const face of part.faces) {
                extraFaces.push({ ...face, verts: rotFn(face.verts) });
            }
        }
    }

    if (def.rotateNodes?.length) {
        for (const node of def.rotateNodes) {
            const angle = params[node.param] ?? 0;
            for (const face of node.faces) {
                extraFaces.push({ ...face, verts: _rotateVerts(face.verts, node.pivot, node.axis, angle) });
            }
        }
    }

    return { ...def, faces: [...def.faces, ...extraFaces] };
};

const applyRotateNodes = (def: DEF, params: Record<string, number>): DEF => applyParts(def, params);

/**
 * Returns the world-space pivot position for every part that has a rotate node,
 * after applying the full parent-chain transformation.
 * Use this to draw pivot indicators that follow their parent's animation.
 */
const getTransformedPivots = (def: DEF, params: Record<string, number>): Map<string, [number, number, number]> => {
    const result = new Map<string, [number, number, number]>();
    if (!def.parts?.length) return result;

    const getRotFn = _buildRotFnCache(def, params);
    for (const part of def.parts) {
        if (!part.rotate) continue;
        const parentFn = part.parent ? getRotFn(part.parent) : null;
        const pivot = parentFn ? (parentFn([part.rotate.pivot])[0] as [number, number, number]) : part.rotate.pivot;
        result.set(part.id, pivot);
    }
    return result;
};

import { newRenderGroup, type DEFInstanceOptions, type IsoFn } from './scene-renderer';
import type { DEF2, DEF3, DEF2Node, DEF2Face, DEF2Light } from './defs';
type _Renderer = { add: (def: DEF | null, opts: DEFInstanceOptions) => void };

// ─── ZDEF2 renderNodes ────────────────────────────────────────────────────────

type _RotFn2 = (verts: number[][]) => number[][];
const _id2: _RotFn2 = v => v;

type _DrawCtx = { ctx: CanvasRenderingContext2D; isoFn: IsoFn; tileW: number };
type _Special =
    | { kind: 'light'; lx: number; ly: number; lz: number; light: DEF2Light }
    | { kind: 'line';  v0: number[]; v1: number[]; face: DEF2Face };

// Light direction: normalize([-1, 2, 3]) — from starboard-above-forward
const _LIGHT: [number, number, number] = [-0.267, 0.535, 0.802];
const _SHADE_AMB = 0.82;
const _SHADE_DIFF = 0.18;

const _autoShade = (verts: number[][]): number => {
    if (verts.length < 3) return 1.0;
    const ax = verts[1][0]-verts[0][0], ay = verts[1][1]-verts[0][1], az = verts[1][2]-verts[0][2];
    const bx = verts[2][0]-verts[0][0], by = verts[2][1]-verts[0][1], bz = verts[2][2]-verts[0][2];
    const nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx;
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (len < 1e-9) return 1.0;
    const dot = (nx*_LIGHT[0] + ny*_LIGHT[1] + nz*_LIGHT[2]) / len;
    return _SHADE_AMB + _SHADE_DIFF * Math.max(0, dot);
};

// D3F: full 3D face normal from vertex winding (right-hand rule, first 3 verts).
// Returns null for degenerate faces (< 3 verts, collinear points) — caller treats
// that as "always visible", matching the existing no-normal fallback.
const _computeFaceNormal = (verts: number[][]): [number, number, number] | null => {
    if (verts.length < 3) return null;
    const ax = verts[1][0]-verts[0][0], ay = verts[1][1]-verts[0][1], az = verts[1][2]-verts[0][2];
    const bx = verts[2][0]-verts[0][0], by = verts[2][1]-verts[0][1], bz = verts[2][2]-verts[0][2];
    const nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx;
    const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (len < 1e-9) return null;
    return [nx/len, ny/len, nz/len];
};

const _applyShade = (hex: string, shade: number): string => {
    if (Math.abs(shade - 1.0) < 0.002) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 0xff) * shade));
    const g = Math.min(255, Math.round(((n >> 8) & 0xff) * shade));
    const b = Math.min(255, Math.round((n & 0xff) * shade));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
};

// Rotates a 2D face normal through the accumulated Rodrigues rotFn.
// Computes as direction vector: rotFn(origin→normal) - rotFn(origin).
const _rotNorm = (n: [number, number], rotFn: _RotFn2): [number, number] => {
    const [[ox, oy], [nx, ny]] = rotFn([[0, 0, 0], [n[0], n[1], 0]]);
    const dx = nx - ox, dy = ny - oy;
    const len = Math.sqrt(dx * dx + dy * dy);
    return len > 1e-9 ? [dx / len, dy / len] : n;
};

const _makeRotFn2 = (node: DEF2Node, params: Record<string, number>, parentFn: _RotFn2): _RotFn2 => {
    const r = node.rotate!;
    let angle: number;
    if (r.animate) {
        const t = Date.now() * r.animate.speed;
        angle = r.animate.type === 'oscillate' ? (r.animate.amplitude ?? 1) * Math.sin(t) : t;
    } else {
        angle = params[r.param ?? ''] ?? 0;
    }
    const tPivot = parentFn([r.pivot])[0] as [number, number, number];
    return verts => _rotateVerts(parentFn(verts), tPivot, r.axis, angle);
};

// ─── Generic collapse ─────────────────────────────────────────────────────────
// params[COLLAPSE_PARAM] = 0..1 (see sim/collapse.ts). Every node tilts around its
// own foot point in a pseudo-random direction and the whole model sinks towards
// its base, so upper parts end up piled into the lower ones.

const COLLAPSE_PARAM = '__collapse';
// Optional: model-local direction (radians) the wind blows towards, and its
// strength 0..1. Parts then mostly fall downwind; calm = random directions.
const COLLAPSE_DIR_PARAM = '__collapseDir';
const COLLAPSE_WIND_PARAM = '__collapseWind';
// 1 = burst instead of folding in: every face becomes its own piece of debris that
// flies outwards, tumbles and ends up lying flat (used for vessels).
const COLLAPSE_BURST_PARAM = '__collapseBurst';
// Fraction of its original height a part ends up lowered by.
const COLLAPSE_DROP = 0.92;
const collapseEase = (t: number): number => t * t * (3 - 2 * t);

const _hash01 = (i: number): number => {
    const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return s - Math.floor(s);
};

// verts: the node's own faces, already in model space. idx: stable per-node seed.
const _makeCollapseFn = (verts: number[][], c: _CollapseState, idx: number): _RotFn2 => {
    const { e, windDir, wind } = c;
    let cx = 0, cy = 0, minZ = Infinity;
    for (const v of verts) { cx += v[0]; cy += v[1]; if (v[2] < minZ) minZ = v[2]; }
    cx /= verts.length; cy /= verts.length;
    // Spread around the downwind direction narrows with wind strength (±36° at full wind).
    const dir = wind > 0
        ? windDir + (_hash01(idx) - 0.5) * Math.PI * 2 * (1 - 0.8 * wind)
        : _hash01(idx) * Math.PI * 2;
    // Moderate tilt: parts lean over and sink into the lower ones rather than toppling far out.
    const tilt = e * (0.2 + 0.35 * _hash01(idx + 17));
    const axis: [number, number, number] = [-Math.sin(dir), Math.cos(dir), 0];
    const pivot: [number, number, number] = [cx, cy, minZ];
    const squash = 1 - COLLAPSE_DROP * e;
    const spread = 1 + 0.15 * e;
    return vs => _rotateVerts(vs, pivot, axis, tilt).map(([x, y, z]) => [x * spread, y * spread, z * squash]);
};

// Burst: one face = one piece. Flies out from the model centre, hops, tumbles about its
// own centre and settles flat around the base (z = 0, the waterline for vessels).
const _makeBurstFn = (verts: number[][], c: _CollapseState, idx: number): _RotFn2 => {
    const { t, e } = c;
    let cx = 0, cy = 0, cz = 0;
    for (const v of verts) { cx += v[0]; cy += v[1]; cz += v[2]; }
    cx /= verts.length; cy /= verts.length; cz /= verts.length;
    const out = 1 - Math.pow(1 - t, 3); // fast start, slow end
    const len = Math.hypot(cx, cy);
    const dirA = len > 0.05 ? Math.atan2(cy, cx) + (_hash01(idx) - 0.5) * 0.8 : _hash01(idx) * Math.PI * 2;
    const dist = out * (1.0 + 2.0 * _hash01(idx + 3));
    const dx = Math.cos(dirA) * dist, dy = Math.sin(dirA) * dist;
    const hop = Math.sin(Math.PI * t) * (0.6 + 1.2 * _hash01(idx + 5));
    const spinA = _hash01(idx + 7) * Math.PI * 2;
    const axis: [number, number, number] = [Math.cos(spinA), Math.sin(spinA), 0];
    const spin = out * (0.8 + 2.0 * _hash01(idx + 11));
    const pivot: [number, number, number] = [cx, cy, cz];
    const squash = 1 - COLLAPSE_DROP * e;
    return vs => _rotateVerts(vs, pivot, axis, spin).map(([x, y, z]) => [x + dx, y + dy, z * squash + hop]);
};

type _CollapseState = { t: number; e: number; idx: number; windDir: number; wind: number; burst: boolean };

const _collectNode = (
    node: DEF2Node,
    params: Record<string, number>,
    parentFn: _RotFn2,
    outFaces: DEFFace[],
    outSpecial: _Special[],
    autoNormal = false,
    collapse?: _CollapseState,
): void => {
    const nodeFn = node.rotate ? _makeRotFn2(node, params, parentFn) : parentFn;
    // Collapse only deforms this node's own output — children get the plain
    // nodeFn and compute their own foot point, so tilts don't compound.
    let rotFn = nodeFn;
    if (collapse && node.faces?.length) {
        const own = node.faces.flatMap(f => nodeFn(f.verts));
        const cFn = _makeCollapseFn(own, collapse, collapse.idx++);
        rotFn = verts => cFn(nodeFn(verts));
    }
    for (const face of node.faces ?? []) {
        if (face.type === 'line') {
            const [v0, v1] = rotFn([face.verts[0], face.verts[1]]);
            outSpecial.push({ kind: 'line', v0, v1, face });
        } else {
            let rotVerts: number[][];
            if (collapse?.burst) {
                const base = nodeFn(face.verts);
                rotVerts = _makeBurstFn(base, collapse, collapse.idx++)(base);
            } else {
                rotVerts = rotFn(face.verts);
            }
            const shade = face.shade ?? _autoShade(rotVerts);
            const color = _applyShade(face.color, shade);
            const normal = face.normal ? _rotNorm(face.normal, rotFn) : undefined;
            // D3F: no hand-authored normal → derive one from winding instead of
            // always-visible. `normal` (legacy 2D override) always wins when present.
            const normal3d = autoNormal && normal === undefined ? _computeFaceNormal(rotVerts) ?? undefined : undefined;
            outFaces.push({
                ...face, verts: rotVerts, color,
                ...(normal !== undefined ? { normal } : {}),
                ...(normal3d !== undefined ? { normal3d } : {}),
            } as DEFFace);
        }
    }
    for (const light of node.lights ?? []) {
        const [rl] = rotFn([[light.x, light.y, light.z]]);
        outSpecial.push({ kind: 'light', lx: rl[0], ly: rl[1], lz: rl[2], light });
    }
    for (const child of node.children ?? []) {
        _collectNode(child, params, nodeFn, outFaces, outSpecial, autoNormal, collapse);
    }
};

const _collapseState = (params: Record<string, number>): _CollapseState | undefined => {
    const t = params[COLLAPSE_PARAM] ?? 0;
    if (t <= 0) return undefined;
    const wind = Math.max(0, Math.min(1, params[COLLAPSE_WIND_PARAM] ?? 0));
    return {
        t, e: collapseEase(t), idx: 0, windDir: params[COLLAPSE_DIR_PARAM] ?? 0, wind,
        burst: (params[COLLAPSE_BURST_PARAM] ?? 0) > 0,
    };
};

// True if this node or any descendant animates/rotates at runtime. Only such
// nodes need a live per-face depth sort — a purely static node's relative face
// depths never change, so its authored array order (verified once, by eye, at
// whatever angle the object is actually placed) is the more reliable choice.
// A centroid-based sort can misrank a small decal (e.g. a window covering half
// a wall's height) against its own much larger parent wall.
const _hasRotate = (node: DEF2Node): boolean =>
    !!node.rotate || (node.children ?? []).some(_hasRotate);

// Queues a ZDEF2/D3F model into the frame's single batch — never flushes. Each top-level
// node becomes its own sort item (its own bounding box), so e.g. a hull and a mast of
// one model sort independently against the heli and other objects. Faces of a node
// with moving parts (or while collapsing) are queued one by one in a per-face order,
// kept together as one render group.
const renderNodes = (
    def: DEF2 | DEF3,
    params: Record<string, number>,
    instanceProps: DEFInstanceOptions,
    renderer: _Renderer,
    drawCtx?: _DrawCtx,
): void => {
    const { x: ix, y: iy, z: iz = 0, angle: iAngle = 0 } = instanceProps;
    const cosA = Math.cos(iAngle), sinA = Math.sin(iAngle);
    const autoNormal = def.version === 3;
    const collapse = _collapseState(params);

    for (const topNode of def.nodes) {
        const faces: DEFFace[] = [];
        const special: _Special[] = [];
        _collectNode(topNode, params, _id2, faces, special, autoNormal, collapse);

        // Fallback depth key (only used where bounding boxes intersect).
        let baseDepth = ix + iy;
        if (topNode.depthAnchor) {
            const [dx, dy, dz = 0] = topNode.depthAnchor;
            baseDepth = (ix + dx * cosA - dy * sinA) + (iy + dx * sinA + dy * cosA) + (iz + dz);
        }
        if (collapse || _hasRotate(topNode)) {
            const cApS = cosA + sinA, cAmS = cosA - sinA;
            const allFaces: { face: DEFFace; key: number }[] = [];
            faces.forEach((face, fi) => {
                const verts = face.verts;
                let lcx = 0, lcy = 0, lcz = 0;
                for (const v of verts) { lcx += v[0]; lcy += v[1]; lcz += v[2]; }
                lcx /= verts.length; lcy /= verts.length; lcz /= verts.length;
                allFaces.push({ face, key: lcx * cApS + lcy * cAmS + lcz + fi * 1e-9 });
            });
            allFaces.sort((a, b) => a.key - b.key);
            const group = newRenderGroup();
            for (let si = 0; si < allFaces.length; si++) {
                renderer.add({ id: def.id, faces: [allFaces[si].face] } as DEF, { ...instanceProps, depth: baseDepth + si * 1e-7, group });
            }
        } else if (faces.length) {
            // No moving parts anywhere in this node: authored array order, one item.
            renderer.add({ id: def.id, faces } as DEF, { ...instanceProps, depth: baseDepth });
        }

        if (drawCtx) {
            const { ctx, isoFn, tileW } = drawCtx;
            for (const item of special) {
                if (item.kind === 'light') {
                    const { lx, ly, lz, light } = item;
                    const wx = ix + lx * cosA - ly * sinA;
                    const wy = iy + lx * sinA + ly * cosA;
                    const wz = iz + lz;
                    const blink = light.blink ?? false;
                    const radius = light.radius ?? 2;
                    renderer.add(null, {
                        x: wx, y: wy, z: wz,
                        drawFn: (cx: number, cy: number) => {
                            const isOn = !blink || Math.floor(Date.now() / 500) % 2 === 0;
                            const p = isoFn(wx, wy, wz, cx, cy);
                            ctx.fillStyle = isOn ? light.color : (light.colorOff ?? light.color);
                            ctx.beginPath();
                            ctx.arc(p.x, p.y, Math.max(1.2, radius * tileW / 64), 0, 7);
                            ctx.fill();
                        },
                    });
                } else {
                    const { v0, v1, face } = item;
                    const wx0 = ix + v0[0] * cosA - v0[1] * sinA, wy0 = iy + v0[0] * sinA + v0[1] * cosA, wz0 = iz + v0[2];
                    const wx1 = ix + v1[0] * cosA - v1[1] * sinA, wy1 = iy + v1[0] * sinA + v1[1] * cosA, wz1 = iz + v1[2];
                    renderer.add(null, {
                        x: (wx0 + wx1) / 2, y: (wy0 + wy1) / 2, z: (wz0 + wz1) / 2,
                        bounds: {
                            x0: Math.min(wx0, wx1), x1: Math.max(wx0, wx1),
                            y0: Math.min(wy0, wy1), y1: Math.max(wy0, wy1),
                            z0: Math.min(wz0, wz1), z1: Math.max(wz0, wz1),
                        },
                        drawFn: (cx: number, cy: number) => {
                            const p0 = isoFn(wx0, wy0, wz0, cx, cy);
                            const p1 = isoFn(wx1, wy1, wz1, cx, cy);
                            ctx.strokeStyle = face.color;
                            ctx.lineWidth = face.lineWidth ?? 1;
                            ctx.lineCap = 'round';
                            ctx.beginPath();
                            ctx.moveTo(p0.x, p0.y);
                            ctx.lineTo(p1.x, p1.y);
                            ctx.stroke();
                        },
                    });
                }
            }
        }
    }
};

/**
 * Bakes all ZDEF2 nodes into a flat face list (all node-local rotations + shading applied).
 * Returns a DEF-compatible object for use with custom draw paths (e.g. ornithopter).
 */
const applyNodes = (def: DEF2 | DEF3, params: Record<string, number>): DEF => {
    const faces: DEFFace[] = [];
    const discard: _Special[] = [];
    const autoNormal = def.version === 3;
    const collapse = _collapseState(params);
    for (const node of def.nodes) {
        _collectNode(node, params, _id2, faces, discard, autoNormal, collapse);
    }
    // Preserve top-level fields (collisionBoxes, palettes, ...) — only `nodes` is
    // replaced by the baked flat `faces` list.
    return { ...def, faces } as unknown as DEF;
};

export { applyParts, applyRotateNodes, getTransformedPivots, renderNodes, applyNodes, COLLAPSE_PARAM, COLLAPSE_DIR_PARAM, COLLAPSE_WIND_PARAM, COLLAPSE_BURST_PARAM, COLLAPSE_DROP, collapseEase };
