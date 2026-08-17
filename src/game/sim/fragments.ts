import type { DEF, DEFFace } from '../defs';
import { G } from '../state';

export interface RuntimeFragment {
    /** Pivot-relative, world-rotated face geometry (ready for SceneRenderer) */
    faces: DEFFace[];
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    /** Self-rotation angle in radians, incremented per tick */
    selfAngle: number;
    rotSpeed: number;
    age: number;
    maxAge: number;
}

const GRAVITY = 0.018;
const MAX_AGE  = 120; // ticks ≈ 4 s at 30 fps

// Search faces in top-level faces, ZDEF1 parts, and ZDEF2 nodes (including children)
const _findFace = (def: DEF, faceId: string): DEFFace | undefined => {
    let f = (def.faces ?? []).find((x: DEFFace) => x.id === faceId);
    if (f) return f;
    for (const part of def.parts ?? []) {
        f = part.faces.find((x: DEFFace) => x.id === faceId);
        if (f) return f;
    }
    const nodes = (def as any).nodes as Array<{ faces?: DEFFace[]; children?: Array<{ faces?: DEFFace[] }> }> | undefined;
    if (nodes) {
        for (const node of nodes) {
            f = node.faces?.find((x: DEFFace) => x.id === faceId);
            if (f) return f;
            for (const child of node.children ?? []) {
                f = child.faces?.find((x: DEFFace) => x.id === faceId);
                if (f) return f;
            }
        }
    }
    return undefined;
};

export const spawnFragments = (
    def: DEF,
    worldX: number,
    worldY: number,
    worldZ: number,
    worldAngle: number,
): void => {
    if (!def.fragments?.length) return;

    const cosA = Math.cos(worldAngle);
    const sinA = Math.sin(worldAngle);

    const localToWorld = (lx: number, ly: number, lz: number): [number, number, number] => [
        worldX + lx * cosA - ly * sinA,
        worldY + lx * sinA + ly * cosA,
        worldZ + lz,
    ];

    for (const frag of def.fragments) {
        const [px, py, pz] = frag.pivot;
        const [wpx, wpy, wpz] = localToWorld(px, py, pz);

        // Bake faces: rotate by worldAngle, translate to pivot-relative world space
        const bakedFaces: DEFFace[] = [];
        for (const faceId of frag.faceIds) {
            const src = _findFace(def, faceId);
            if (!src) continue;
            const verts: number[][] = src.verts.map((v: number[]) => {
                const [wx, wy, wz] = localToWorld(v[0], v[1], v[2]);
                return [wx - wpx, wy - wpy, wz - wpz];
            });
            bakedFaces.push({ ...src, verts });
        }
        if (!bakedFaces.length) continue;

        // World-rotate the impulse vector
        const [ix, iy, iz] = frag.impulse ?? [0, 0, 0];
        const vx = ix * cosA - iy * sinA;
        const vy = ix * sinA + iy * cosA;
        const vz = iz + 0.04 + Math.random() * 0.06; // slight upward pop

        const torque = frag.torque ?? ((Math.random() - 0.5) * 6);
        const rotSpeed = torque / (MAX_AGE * 0.5); // convert rad/s to rad/tick

        G.FRAGMENTS.push({
            faces: bakedFaces,
            x: wpx, y: wpy, z: wpz,
            vx, vy, vz,
            selfAngle: 0,
            rotSpeed,
            age: 0,
            maxAge: MAX_AGE,
        });
    }
};

export const updateFragments = (): void => {
    for (let i = G.FRAGMENTS.length - 1; i >= 0; i--) {
        const f = G.FRAGMENTS[i];
        f.vz -= GRAVITY;
        f.x += f.vx;
        f.y += f.vy;
        f.z += f.vz;
        f.selfAngle += f.rotSpeed;
        f.age++;
        if (f.age >= f.maxAge) G.FRAGMENTS.splice(i, 1);
    }
};
