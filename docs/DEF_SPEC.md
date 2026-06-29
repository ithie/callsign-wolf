# DEF — Decoupled Element Facets

A declarative, renderer-agnostic way to describe 3D isometric objects as ordered sets of flat polygon faces.

---

## File Locations

- **Interfaces & helpers** (`DEF`, `DEFFace`, `DEFCollisionBox`, `nGonRing`, `cylFaces`): `src/game/defs.ts`
- **Model definitions** (one `.zdef` file per object): `src/game/models/`
- **SceneRenderer**: `src/game/scene-renderer.ts`

### `.zdef` File Format

Model definitions are stored as `.zdef` files — JSON with a `.zdef` extension that supports `//` single-line comments.

```json
{
  "id": "my_vessel",
  "faces": [
    // --- HULL ---
    { "id": "hull_bottom", "verts": [[...]], "color": "#5a6673" }
  ]
}
```

Comments are stripped before parsing. Both the Vite build plugin (`plugins/zdef.ts`) and the SAR Tools VS Code extension strip `//` comments via `/\/\/[^\n]*/g` before calling `JSON.parse()`.

The Vite plugin transforms `.zdef` files at build time into ES modules (`export default <json>`), so they can be imported directly:

```typescript
import HANGAR_DEF from './models/hangar.zdef';
```

TypeScript types are provided by `src/zdef.d.ts` (ambient wildcard declaration). No runtime parser is needed.

---

## Motivation

The traditional approach in this codebase used imperative `draw*()` functions that mixed geometry, color, and rendering logic. DEF separates **what an object looks like** (geometry + colors) from **how it is rendered** (projection, depth sorting, camera).

---

## Face Schema

```typescript
interface DEFFace {
    id: string; // unique within the DEF
    verts: [number, number, number][]; // local [x, y, z] coords
    color: string; // CSS color, including rgba()
    stroke?: string; // optional outline color
    strokeWidth?: number; // default: 1
    normal?: [number, number]; // [nx, ny] for backface culling
}
```

### Coordinate System

- `+X` = object's nose / forward direction
- `+Y` = object's left side
- `+Z` = up
- Origin = object center at ground level (z=0)

### Backface Culling via `normal`

If a face has a `normal: [nx, ny]`, it is skipped when that normal points away from the isometric camera. The camera looks from the `+X+Y` direction, so faces with `nx + ny > 0` **face the camera and are visible**; faces with `nx + ny ≤ 0` face away and are culled.

For rotating objects the normal is rotated with the instance angle before the test, so culling is always relative to the object's current orientation.

Omit `normal` on top/bottom faces and faces that should always be visible.

### Hollow Objects and Double-Sided Walls

A wall that can be seen from **both sides** — for example, the interior of a building visible through an opening — requires **two faces with opposite normals**:

```javascript
// Exterior face — visible when camera is outside
{ id: 'wall_ext', normal: [-1, 0], verts: [...], color: '#ccc' },
// Interior face — visible when camera looks through the opening
{ id: 'wall_int', normal: [ 1, 0], verts: [...], color: '#aaa' },
```

At any camera angle exactly one of the pair passes the culling test. Closed objects (no openings) do not need interior faces because the interior is never visible.

---

## Collision Box Schema

```typescript
interface DEFCollisionBox {
    id: string;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
    zMin: number;
    zMax: number; // local z coords (world z offset added at render time)
}
```

---

## Gameplay Zones

### `rescueZones`

Defines regions in **vessel-local coordinates** where payloads can be picked up or delivered. Supported on: Carrier, Boat, Submarine, Research Platform.

```typescript
interface DEFRescueZone {
    x: number;                         // local center X
    y: number;                         // local center Y
    w: number;                         // half-extent in X (full width = 2w)
    h: number;                         // half-extent in Y (full depth = 2h)
    z: number;                         // local Z offset (used for debug visualisation)
    role: 'pickup' | 'dropoff' | 'both';
}
```

Containment test (vessel-angle-aware):

```text
local_x = (wx − vessel.x) · cos(angle) − (wy − vessel.y) · sin(angle)
local_y = (wx − vessel.x) · sin(angle) + (wy − vessel.y) · cos(angle)
inside  = |local_x − zone.x| ≤ zone.w  &&  |local_y − zone.y| ≤ zone.h
```

If `rescueZones` is absent or empty, the entire vessel surface allows both pickup and dropoff. If zones are defined but none has `role: 'pickup'` or `role: 'both'`, pickup is still allowed everywhere.

### `landingZone`

Defines the landing pad rectangle where the helicopter can touch down (fuel replenishment, deposit). Used on `research_platform.zdef` (deck at z=6.65) and `wind_turbine.zdef` (gondola top at z=12.3).

```typescript
interface DEFLandingZone {
    x: number;   // local center X
    y: number;   // local center Y
    w: number;   // half-extent in X
    h: number;   // half-extent in Y
    z: number;   // height above terrain (world z = obj.gz + z for static structures)
}
```

At runtime `game.ts` converts this into a world-space axis-aligned box pushed into `G.LANDING_ZONES`:

```text
// Research Platform (waterLevel-based):
xMin = obj.x + lz.x − lz.w,  xMax = obj.x + lz.x + lz.w
yMin = obj.y + lz.y − lz.h,  yMax = obj.y + lz.y + lz.h
z    = waterLevel + lz.z

// Wind Turbine (terrain-gz-based):
z    = obj.gz + lz.z          // gz = terrain height at turbine position
```

### `lights`

Defines point lights that blink and glow at a fixed local position. Rendered as screen-space circles via `drawFn` after the geometry, depth-sorted alongside the object. Supported on any DEF; currently used on `wind_turbine.zdef`.

```typescript
interface DEFLight {
    id: string;
    pos: [number, number, number]; // local X, Y, Z position
    color: string;                 // core dot colour (e.g. "#ff2200")
    glowColor?: string;            // outer glow fill (default: "rgba(255,60,0,0.35)")
    radius?: number;               // core dot radius in screen pixels (default: 4)
    glowRadius?: number;           // glow circle radius in screen pixels (default: 13)
    blinkHz?: number;              // blink frequency in Hz (default: 1.0)
}
```

Lights are rendered via `_drawDefLights(x, y, def)` in `structures.ts` — a generic helper that works with any DEF. Unlike geometry, lights are **always visible** within the night cone regardless of `isVisible` culling. This means a wind turbine beacon can be seen even when the turbine itself is scrolled off-screen. The blink period is `500 / blinkHz` ms on / off.

---

## DEF Schema

```typescript
interface DEF {
    id: string;
    pivot: [number, number, number]; // local origin offset (usually [0,0,0])
    faces: DEFFace[];
    collisionBoxes?: DEFCollisionBox[];
    lights?: DEFLight[];             // blinking point lights (screen-space overlay)
    rescueZones?: DEFRescueZone[];   // gameplay pickup/dropoff regions
    landingZone?: DEFLandingZone;    // helicopter landing pad
}
```

### Face Ordering

Faces are drawn in **definition order** within an instance. Order them **back-to-front** for a fixed isometric camera (lower `local_x + local_y` first). For objects that rotate, order for the most common viewing angle.

There is **no per-face sort within an instance** — this is intentional to preserve manually tuned face order and avoid intra-object painter's algorithm failures at certain rotation angles.

**Recommended painter order for a typical fuselage/box shape:**

1. Bottom face
2. Side faces (lower panels first, upper panels after)
3. Tail / rear side faces
4. Nose / front face
5. Detail faces (windows, recessed dark areas)
6. Vertical pylons / nacelles
7. Rear roof / tail cap
8. **Top (lid) face — always last**

**Two key rules that eliminate bleed-through artefacts:**

- **Uniform colour within a colour family.** When adjacent faces share a colour family (e.g. all body panels are orange), use the exact same hex value for all of them. Different shades produce visible seams where faces overlap in screen space; identical colours make those overlaps invisible.
- **Top face last.** The upward-facing lid is the most visible surface in an isometric top-down view. Placing it last in the array ensures it always paints over any side or detail face that bleeds into the same screen pixels — no per-face depth sort needed.

---

## Animated Parts (`parts` + `applyParts`)

For runtime-animated sub-geometry, add a `parts` array to the DEF. Each part is a named group of faces with an optional rotation that is driven by a runtime parameter.

```typescript
interface DEFPart {
    id: string;
    faces: DEFFace[];
    rotate?: {
        pivot: [number, number, number]; // rotation origin in local object space
        axis:  [number, number, number]; // unit rotation axis, e.g. [0, 0, 1] for Z
        param: string;                   // key into the params map (value in radians)
    };
    parent?: string; // id of another part — see Chained Rotations below
}
```

Call `applyParts` each frame before passing the DEF to `SceneRenderer`:

```typescript
import { applyParts } from 'src/game/def-utils';

const renderedDef = applyParts(def, { wingAngle: Math.sin(t) * 0.4 });
SceneRenderer.add(renderedDef, instance);
```

`applyParts` bakes all parts into `def.faces` using Rodrigues' rotation formula and returns a new DEF object. The original is not mutated.

An optional `opts.only` array limits which part IDs are included in the output (useful for previewing a single part in the model editor).

### Chained Rotations (`parent`)

When a part has a `parent` field, its rotation is applied **in the already-transformed space of the parent part**:

1. The parent's rotation is applied to the child's vertices first.
2. The child's own `pivot` is also transformed by the parent's rotation.
3. The child then rotates around that transformed pivot by its own angle.

This lets outer segments of a wing, arm, or antenna follow their inner segment's movement and additionally rotate relative to it.

**Rules:**

- `parent` must be the `id` of another part in the same DEF.
- Chains can be arbitrarily deep, but cycles are undefined behaviour.
- Parts without `parent` behave exactly as before (backward compatible).
- `opts.only` only controls which parts contribute faces to the output; parent rotation transforms are always computed for the dependency chain.

**Example — ornithopter wing:**

```json
{ "id": "wing_L_inner", "rotate": { "pivot": [-0.2, 0.25, 0.48], "axis": [1,0,0], "param": "wingAngle" }, "faces": [...] },
{ "id": "wing_L_outer", "parent": "wing_L_inner",
  "rotate": { "pivot": [-0.25, 2.5, 1.4], "axis": [1,0,0], "param": "wingTipAngle" }, "faces": [...] }
```

`wing_L_outer` moves with `wing_L_inner` and folds additionally around the (now-moved) tip pivot.

---

## Instance Schema

```typescript
interface DEFInstance {
    x: number; // world position
    y: number;
    z: number; // world height offset (added to all face z coords)
    angle: number; // rotation in radians around Z axis
    colors?: Record<string, string>; // face id → color override (see Palette System)
    drawFn?: (camX: number, camY: number) => void; // optional draw callback (see below)
}
```

---

## SceneRenderer API

```javascript
// Queue one instance for rendering.
// def may be null for drawFn-only entries (no geometry, just a depth-sorted callback).
SceneRenderer.add(def, { x, y, z, angle, colors?, drawFn? });

// Draw all queued instances (sorted back-to-front by instance centroid depth).
// Call once per frame, after all SceneRenderer.add() calls.
SceneRenderer.flush(camX, camY);

// Enable debug collision box outlines
SceneRenderer.debugCollision = true;
```

### Depth Sorting

Instances are sorted by their **centroid depth** (`world_x + world_y`). Faces within an instance maintain definition order. This works correctly for a fixed isometric camera.

---

## Color Override (Palette System)

To share a single DEF across objects that differ only in color, pass a `colors` map:

```javascript
SceneRenderer.add(PERSON_DEF, {
    x,
    y,
    z,
    angle,
    colors: { suit: '#ff6600', pants: '#ff6600' }, // face id → color override
});
```

Overrides only replace `color`, not `stroke`.

---

## Draw Callbacks (`drawFn`)

For elements that cannot be expressed as static geometry — animated parts, sprites, procedural shapes — attach a `drawFn` to the instance. It is called **after the instance's own faces**, depth-sorted alongside them in the same flush pass.

```javascript
SceneRenderer.add(HELI_DEF, {
    x,
    y,
    z,
    angle,
    drawFn: (cx, cy) => drawRotors(x, y, z, angle, rotorAngle, cx, cy),
});
SceneRenderer.flush(camX, camY);
```

`def` may be `null` when only the callback is needed (no geometry):

```javascript
SceneRenderer.add(null, {
    x,
    y,
    z: 0,
    angle: 0,
    drawFn: (cx, cy) => drawTree(x, y, cx, cy, scale, wind, type),
});
```

This keeps animated and sprite-based elements in the same depth-sorted pipeline as DEF geometry, without hard-coding draw order in the render loop.

---

## Cylinder Approximation

Circles and cylinders are approximated as n-sided polygons. Use `cylFaces(radius, zBottom, zTop, color, stroke, n?)` from `src/game/defs.ts` to generate side faces + top cap. **Use n ≥ 16** for objects where the circular shape is prominent. n=8 produces visibly angular results at large radii.

---

## Special Objects

Some elements are not expressed as static DEF geometry and use `drawFn` callbacks instead:

| Object                    | Reason                                                            |
| ------------------------- | ----------------------------------------------------------------- |
| Person (Survivor/Rescuer) | 2D screen-space sprite (`ctx.fillRect`, `ctx.arc`, pixel offsets) |
| Trees                     | Wind animation, procedural/organic shapes                         |
| Fuel Truck                | Tank uses a hybrid screen-space cylinder approximation            |
| Rotor blades              | Per-frame animated lines, not static geometry                     |

All of the above are attached as `drawFn` on their parent instance (or a null-DEF instance) so they participate in depth sorting.

---

## Example

```javascript
const EXAMPLE_DEF = {
    id: 'crate',
    pivot: [0, 0, 0],
    collisionBoxes: [{ id: 'body', xMin: -0.5, xMax: 0.5, yMin: -0.5, yMax: 0.5, zMin: 0, zMax: 1.0 }],
    faces: [
        // back faces first (lower x+y)
        {
            id: 'back',
            normal: [0, -1],
            verts: [
                [-0.5, -0.5, 0],
                [0.5, -0.5, 0],
                [0.5, -0.5, 1],
                [-0.5, -0.5, 1],
            ],
            color: '#8B6914',
        },
        {
            id: 'right',
            normal: [1, 0],
            verts: [
                [0.5, -0.5, 0],
                [0.5, 0.5, 0],
                [0.5, 0.5, 1],
                [0.5, -0.5, 1],
            ],
            color: '#A07820',
        },
        {
            id: 'left',
            normal: [-1, 0],
            verts: [
                [-0.5, 0.5, 0],
                [-0.5, -0.5, 0],
                [-0.5, -0.5, 1],
                [-0.5, 0.5, 1],
            ],
            color: '#7A5C10',
        },
        {
            id: 'front',
            normal: [0, 1],
            verts: [
                [0.5, 0.5, 0],
                [-0.5, 0.5, 0],
                [-0.5, 0.5, 1],
                [0.5, 0.5, 1],
            ],
            color: '#8B6914',
        },
        {
            id: 'top',
            verts: [
                [-0.5, -0.5, 1],
                [0.5, -0.5, 1],
                [0.5, 0.5, 1],
                [-0.5, 0.5, 1],
            ],
            color: '#C49A28',
        },
    ],
};

SceneRenderer.add(EXAMPLE_DEF, { x: 10, y: 5, z: 0, angle: 0 });
SceneRenderer.flush(camX, camY);
```
