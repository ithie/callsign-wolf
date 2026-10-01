// ─── Decoupled Element Facets (DEF) ──────────────────────────────────────────
// Declarative geometry for isometric game objects.
// See DEF_SPEC.md for the full specification.
// ──────────────────────────────────────────────────────────────────────────────

export interface DEFFace {
    id: string;
    /** [x, y, z] tuples in local object space */
    verts: number[][];
    color: string;
    stroke?: string | null;
    strokeWidth?: number;
    /** Isometric backface cull: [nx, ny] in local XY. Face hidden when nx+ny ≤ 0 after rotation. */
    normal?: [number, number];
}

export interface DEFCollisionBox {
    id: string;
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    zMin: number; zMax: number;
}

export interface DEFRotateNode {
    /** Pivot point in local object space */
    pivot: [number, number, number];
    /** Unit rotation axis, e.g. [0,0,1] for Z */
    axis: [number, number, number];
    /** Name of the runtime parameter that drives the angle (radians) */
    param: string;
    faces: DEFFace[];
}

export interface DEFPart {
    id: string;
    faces: DEFFace[];
    rotate?: {
        pivot: [number, number, number];
        axis: [number, number, number];
        param: string;
    };
    /** ID of another part whose rotation is applied before this part's own rotation */
    parent?: string;
}

export interface DEFFragment {
    id: string;
    /** Face IDs from this DEF's faces array that belong to this fragment chunk */
    faceIds: string[];
    /** Local-space center of mass / rotation pivot for this chunk */
    pivot: [number, number, number];
    /** Local-space initial velocity (world-rotated at spawn). Default: [0,0,0] */
    impulse?: [number, number, number];
    /** Self-rotation speed in radians/s. Default: random ±3 */
    torque?: number;
}

export interface DEFLight {
    pos: [number, number, number];
    color?: string;
    glowColor?: string;
    radius?: number;
    glowRadius?: number;
    blinkHz?: number;
    phase?: number;
    dutyCycle?: number;
}

export interface DEF {
    id: string;
    /** Rotation pivot in local coords (default [0,0,0]) */
    pivot?: number[];
    faces: DEFFace[];
    lights?: DEFLight[];
    collisionBoxes?: DEFCollisionBox[];
    /** Legacy: runtime-animated sub-geometry — use parts instead */
    rotateNodes?: DEFRotateNode[];
    /** Named sub-geometry groups; call applyParts() before passing to SceneRenderer */
    parts?: DEFPart[];
    /** Declares render passes for multi-pass depth sorting; processed by renderPasses() */
    passes?: DEFPass[];
    /** Named color sets: variantName → { faceId → color }. Pass result of resolvePalette() as colors to SceneRenderer.add(). */
    palettes?: Record<string, Record<string, string>>;
    /** Destruction fragments: face groups that fly apart when the object is destroyed */
    fragments?: DEFFragment[];
}

export interface DEFPass {
    parts: string[];
}

// ─── ZDEF2 ────────────────────────────────────────────────────────────────────

export interface DEF2Face {
    type?: 'line';
    id?: string;
    verts: number[][];
    color: string;
    normal?: [number, number];
    lineWidth?: number;
    /** Brightness multiplier (1.0 = unchanged). Omit to use auto-shading from face normal. */
    shade?: number;
}

export interface DEF2Light {
    x: number;
    y: number;
    z: number;
    color: string;
    colorOff?: string;
    blink?: boolean;
    radius?: number;
    blinkHz?: number;
    phase?: number;
}

export interface DEF2Rotate {
    pivot: [number, number, number];
    axis: [number, number, number];
    param?: string;
    animate?: { type: 'spin' | 'oscillate'; speed: number; amplitude?: number };
}

export interface DEF2Node {
    faces?: DEF2Face[];
    lights?: DEF2Light[];
    rotate?: DEF2Rotate;
    depthAnchor?: [number, number];
    children?: DEF2Node[];
}

export interface DEF2 {
    version: 2;
    id: string;
    label?: string;
    static?: boolean;
    movementType?: string;
    collisionBoxes?: DEFCollisionBox[];
    landingZone?: { x: number; y: number; w: number; h: number; z: number };
    nodes: DEF2Node[];
    /** Named color sets: variantName → { faceId → color }. Pass result of resolvePalette() as colors to SceneRenderer.add(). */
    palettes?: Record<string, Record<string, string>>;
}

/** Returns the color override map for variantName, or undefined when variant is absent or undefined. */
export const resolvePalette = (
    def: { palettes?: Record<string, Record<string, string>> },
    variantName: string | undefined,
): Record<string, string> | undefined => {
    if (!variantName || !def.palettes) return undefined;
    return def.palettes[variantName];
};

// ─── Static model exports ─────────────────────────────────────────────────────

import HANGAR_RAW from './models/objects/hangar.zdef';
import LIGHTHOUSE_RAW from './models/objects/lighthouse.zdef';
export const HANGAR_DEF: DEF = HANGAR_RAW as unknown as DEF;
export const LIGHTHOUSE_DEF: DEF = LIGHTHOUSE_RAW as unknown as DEF;

// ─── Cylinder helpers ─────────────────────────────────────────────────────────

/** n evenly-spaced points on a circle of radius r at height z */
export const nGonRing = (r: number, z: number, n: number): number[][] =>
    Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return [Math.cos(a) * r, Math.sin(a) * r, z];
    });

/**
 * Cylinder face set: top cap + camera-facing side quads.
 * Backface culled: sides with nx+ny < -0.1 (camera at +X+Y) are omitted.
 */
export const cylFaces = (
    r: number, zB: number, zT: number,
    color: string, stroke: string | null, n = 16,
): DEFFace[] => {
    const faces: DEFFace[] = [];
    faces.push({ id: `cap_z${zT}`, verts: nGonRing(r, zT, n), color, stroke });
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const nx = Math.cos((a0 + a1) / 2);
        const ny = Math.sin((a0 + a1) / 2);
        if (nx + ny < -0.1) continue;
        faces.push({
            id: `side_${i}_z${zB}`,
            verts: [
                [Math.cos(a0) * r, Math.sin(a0) * r, zB],
                [Math.cos(a1) * r, Math.sin(a1) * r, zB],
                [Math.cos(a1) * r, Math.sin(a1) * r, zT],
                [Math.cos(a0) * r, Math.sin(a0) * r, zT],
            ],
            color,
            stroke,
        });
    }
    return faces;
};
