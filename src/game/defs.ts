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
    /**
     * D3F only: full 3D backface cull, computed automatically from vertex winding
     * (see def-utils.ts computeFaceNormal). Rotated by instance angle around Z at
     * render time and tested against the fixed camera view direction (1,1,1).
     * Never hand-authored — set by the renderer, ignored if `normal` is also present.
     */
    normal3d?: [number, number, number];
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
    /** Named color sets: variantName → { faceId → color }. Pass result of resolvePalette() as colors to SceneRenderer.add(). */
    palettes?: Record<string, Record<string, string>>;
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
    /** Model-local point for this node's fallback depth key — only used where its
     *  bounding box intersects another item's (normally the box sort decides).
     *  Optional 3rd element (dz) is NOT rotated by instance angle. */
    depthAnchor?: [number, number] | [number, number, number];
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

// ─── D3F ────────────────────────────────────────────────────────────────────
// Identical wire shape to ZDEF2 (same DEF2Node/DEF2Face/DEF2Light/DEF2Rotate) —
// only the render behaviour differs: `normal` is never hand-authored. See
// docs/D3F_SPEC.md. Detected via "version": 3.

export interface DEF3 {
    version: 3;
    id: string;
    label?: string;
    static?: boolean;
    movementType?: string;
    collisionBoxes?: DEFCollisionBox[];
    landingZone?: { x: number; y: number; w: number; h: number; z: number };
    nodes: DEF2Node[];
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
