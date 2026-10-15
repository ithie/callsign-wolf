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

import type { DEFInstanceOptions, IsoFn } from './scene-renderer';
import type { DEF2, DEF3, DEF2Node, DEF2Face, DEF2Light } from './defs';
type _Renderer = { add: (def: DEF | null, opts: DEFInstanceOptions) => void; flush: (cx: number, cy: number) => void };

/**
 * Renders a DEF using its declared "passes" array (each pass = one applyParts + flush).
 * Falls back to a single applyParts add (no flush) when no passes are declared.
 */
const renderPasses = (
    def: DEF,
    params: Record<string, number>,
    instanceProps: DEFInstanceOptions,
    renderer: _Renderer,
    cx: number,
    cy: number,
): void => {
    if (!def.passes?.length) {
        renderer.add(applyParts(def, params), instanceProps);
        return;
    }
    for (const pass of def.passes) {
        renderer.add(applyParts(def, params, { only: pass.parts }), instanceProps);
        renderer.flush(cx, cy);
    }
};

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

const _collectNode = (
    node: DEF2Node,
    params: Record<string, number>,
    parentFn: _RotFn2,
    outFaces: DEFFace[],
    outSpecial: _Special[],
    autoNormal = false,
): void => {
    const rotFn = node.rotate ? _makeRotFn2(node, params, parentFn) : parentFn;
    for (const face of node.faces ?? []) {
        if (face.type === 'line') {
            const [v0, v1] = rotFn([face.verts[0], face.verts[1]]);
            outSpecial.push({ kind: 'line', v0, v1, face });
        } else {
            const rotVerts = rotFn(face.verts);
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
        _collectNode(child, params, rotFn, outFaces, outSpecial, autoNormal);
    }
};

// True if this node or any descendant animates/rotates at runtime. Only such
// nodes need a live per-face depth sort — a purely static node's relative face
// depths never change, so its authored array order (verified once, by eye, at
// whatever angle the object is actually placed) is the more reliable choice.
// A centroid-based sort can misrank a small decal (e.g. a window covering half
// a wall's height) against its own much larger parent wall.
const _hasRotate = (node: DEF2Node): boolean =>
    !!node.rotate || (node.children ?? []).some(_hasRotate);

const renderNodes = (
    def: DEF2 | DEF3,
    params: Record<string, number>,
    instanceProps: DEFInstanceOptions,
    renderer: _Renderer,
    camX: number,
    camY: number,
    drawCtx?: _DrawCtx,
    onBeforeFlush?: (nodeIndex: number) => void,
): void => {
    const { x: ix, y: iy, z: iz = 0, angle: iAngle = 0 } = instanceProps;
    const cosA = Math.cos(iAngle), sinA = Math.sin(iAngle);
    const autoNormal = def.version === 3;
    // Read from the file, never taken as a call-site parameter — renderNodes()
    // fully owns whether/when it flushes, so no caller can forget a required
    // follow-up call (see docs/D3F_SPEC.md § crossNodeDepth).
    const crossNodeDepth = def.crossNodeDepth === true;

    for (const topNode of def.nodes) {
        const faces: DEFFace[] = [];
        const special: _Special[] = [];
        _collectNode(topNode, params, _id2, faces, special, autoNormal);

        let baseDepth: number;
        if (topNode.depthAnchor) {
            const [dx, dy, dz = 0] = topNode.depthAnchor;
            // dz is NOT rotated (Z-axis instance rotation never touches Z) — it gives
            // a rotation-invariant depth separation, unlike dx/dy which flip relative
            // order depending on the sign of (cosA+sinA) at different instance angles.
            baseDepth = (ix + dx * cosA - dy * sinA) + (iy + dx * sinA + dy * cosA) + (iz + dz);
            for (let fi = 0; fi < faces.length; fi++) {
                renderer.add({ id: def.id, faces: [faces[fi]] } as DEF, { ...instanceProps, depth: baseDepth + fi * 1e-7 });
            }
        } else {
            baseDepth = ix + iy;
            if (_hasRotate(topNode)) {
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
                for (let si = 0; si < allFaces.length; si++) {
                    renderer.add({ id: def.id, faces: [allFaces[si].face] } as DEF, { ...instanceProps, depth: baseDepth + si * 1e-7 });
                }
            } else {
                // No moving parts anywhere in this node: authored array order,
                // one instance, same semantics as a plain v1 DEF.
                renderer.add({ id: def.id, faces } as DEF, { ...instanceProps, depth: baseDepth });
            }
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

        // Per-node flush is only for the onBeforeFlush contract (Carrier/Frigate/
        // research platform inject the heli between two specific nodes) — it must
        // NOT fire as a side effect for plain multi-node objects, because
        // renderer.flush() flushes the entire SHARED batch, not just this def's own
        // faces. Firing it unconditionally here was prematurely flushing whatever
        // unrelated geometry (e.g. wind turbines) another caller had already queued
        // but not yet flushed, splitting them from the heli into an earlier batch
        // and breaking their depth-sort against it (see feedback thread, Oct 2026).
        if (crossNodeDepth || !onBeforeFlush) continue; // single shared flush after the loop instead — see below
        onBeforeFlush(def.nodes.indexOf(topNode));
        renderer.flush(camX, camY);
    }
    // crossNodeDepth (or no onBeforeFlush at all): this def's top-level nodes are
    // fully self-contained — nothing outside this file injects geometry into one of
    // them via onBeforeFlush — so renderNodes() can safely sort and flush ALL of
    // them together, itself, right here, without touching the caller's shared batch
    // more than once. Each node already got its own correct depth above
    // (depthAnchor's dz, or the per-face sort), so this single shared flush paints
    // every face from every node in one correctly-ordered pass instead of the
    // "later node always wins" layering a per-node flush would give.
    if (crossNodeDepth || !onBeforeFlush) renderer.flush(camX, camY);
};

/**
 * Bakes all ZDEF2 nodes into a flat face list (all node-local rotations + shading applied).
 * Returns a DEF-compatible object for use with custom draw paths (e.g. ornithopter).
 */
const applyNodes = (def: DEF2 | DEF3, params: Record<string, number>): DEF => {
    const faces: DEFFace[] = [];
    const discard: _Special[] = [];
    const autoNormal = def.version === 3;
    for (const node of def.nodes) {
        _collectNode(node, params, _id2, faces, discard, autoNormal);
    }
    // Preserve top-level fields (collisionBoxes, palettes, ...) — only `nodes` is
    // replaced by the baked flat `faces` list.
    return { ...def, faces } as unknown as DEF;
};

export { applyParts, applyRotateNodes, getTransformedPivots, renderPasses, renderNodes, applyNodes };
