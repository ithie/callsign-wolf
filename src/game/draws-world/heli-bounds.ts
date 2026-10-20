import type { Box3 } from '../scene-renderer';
import { getHeliType } from '../heli-types';

// World bounding box of a helicopter for the renderer's box sort: its collision box,
// rotated with the heli and taken from z (skids) up to its top.
export const heliBounds = (type: string, x: number, y: number, z: number, angle: number): Box3 => {
    const cb = getHeliType(type).collisionBox;
    const c = Math.cos(angle), s = Math.sin(angle);
    const xs: number[] = [], ys: number[] = [];
    for (const [lx, ly] of [[cb.xMin, cb.yMin], [cb.xMax, cb.yMin], [cb.xMax, cb.yMax], [cb.xMin, cb.yMax]]) {
        xs.push(x + lx * c - ly * s);
        ys.push(y + lx * s + ly * c);
    }
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: z, z1: z + cb.zMax };
};

// The same footprint, flat at ground height — for a heli's shadow.
export const heliShadowBounds = (type: string, x: number, y: number, groundZ: number, angle: number): Box3 => ({
    ...heliBounds(type, x, y, groundZ, angle), z0: groundZ, z1: groundZ,
});
