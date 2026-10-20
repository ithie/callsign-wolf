// Geometry for scripts. 3D contact between placed objects for onTouch: rotated collision boxes (from the
// model's collisionBoxes) must overlap in x/y AND in z. Pure — unit-tested.

export type CollisionBox = { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number };

// World-space box: centre, unit x-axis (ux, uy), half extents, absolute z range.
export type ContactBox = { cx: number; cy: number; ux: number; uy: number; hx: number; hy: number; z0: number; z1: number };

export const worldBoxes = (boxes: CollisionBox[], x: number, y: number, angle: number, baseZ: number): ContactBox[] => {
    const c = Math.cos(angle), s = Math.sin(angle);
    return boxes.map(b => {
        const lx = (b.xMin + b.xMax) / 2, ly = (b.yMin + b.yMax) / 2;
        return {
            cx: x + lx * c - ly * s, cy: y + lx * s + ly * c,
            ux: c, uy: s, hx: (b.xMax - b.xMin) / 2, hy: (b.yMax - b.yMin) / 2,
            z0: baseZ + b.zMin, z1: baseZ + b.zMax,
        };
    });
};

// Separating-axis test for two rotated rectangles plus z-interval overlap.
export const boxesOverlap = (a: ContactBox, b: ContactBox): boolean => {
    if (a.z0 > b.z1 || b.z0 > a.z1) return false;
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    const axes: [number, number][] = [[a.ux, a.uy], [-a.uy, a.ux], [b.ux, b.uy], [-b.uy, b.ux]];
    for (const [ax, ay] of axes) {
        const ra = a.hx * Math.abs(a.ux * ax + a.uy * ay) + a.hy * Math.abs(-a.uy * ax + a.ux * ay);
        const rb = b.hx * Math.abs(b.ux * ax + b.uy * ay) + b.hy * Math.abs(-b.uy * ax + b.ux * ay);
        if (Math.abs(dx * ax + dy * ay) > ra + rb) return false;
    }
    return true;
};

// Direction from a to b in degrees, map convention (0° = +x, like object angles), 0..360.
export const bearingDeg = (ax: number, ay: number, bx: number, by: number): number =>
    ((Math.atan2(by - ay, bx - ax) * 180) / Math.PI + 360) % 360;
