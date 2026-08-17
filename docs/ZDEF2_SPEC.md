# ZDEF2 — Isometric Model Format Specification

Version 2 of the `.zdef` format. Backwards-incompatible with v1; detected via `"version": 2`.

---

## Philosophy

The format is fully self-describing. No render logic lives in draw code.
A model declares its own passes, animations, lights, and line elements.
The renderer (`renderNodes`) reads the format and produces all draw calls.

**Out of scope (stays in code):** procedural particles (wake, spray), angle-correct
depth overrides for off-center sub-objects.

---

## Top-Level Structure

```json
{
  "version": 2,
  "id": "frigate",

  // ── Game metadata (editor / physics, ignored by renderer) ─────────────────
  "label": "Fregatte",
  "static": false,
  "movementType": "ship",
  "collisionBoxes": [ ... ],
  "landingZone": { "x": -8.0, "y": 0, "w": 4.5, "h": 4.5, "z": 2.0 },

  // ── Visual definition ─────────────────────────────────────────────────────
  "nodes": [ <Node>, <Node>, ... ],

  // ── Destruction (optional) ────────────────────────────────────────────────
  "fragments": [ <Fragment>, ... ]   // see DEF_SPEC § Destruction Fragments
}
```

---

## Node

A node is a renderable group. Top-level nodes define **render passes** —
the renderer calls `flush()` after each one. Children share their parent's pass.

```json
{
  "faces":    [ <Face>, ... ],       // geometry in this node
  "lights":   [ <Light>, ... ],      // point lights attached to this node
  "rotate":   <Rotate>,              // optional: animates this node
  "depthAnchor": [dx, dy],           // optional: model-local point used for angle-correct depth
  "children": [ <Node>, ... ]        // optional: child nodes (inherit parent rotation)
}
```

- Children are rendered **within** their parent's pass (no intermediate flush).
- Rotation is applied **after** the parent's rotation (Rodrigues chain).
- A node with neither faces, lights, nor children is valid (pure rotation pivot).

---

## Face

### Polygon face (default)

```json
{
  "id":     "hull_port",         // optional; used for per-instance color overrides
  "verts":  [[x,y,z], ...],      // 3+ points, model-local coords
  "color":  "#5a6673",
  "normal": [nx, ny]             // optional: XY-plane normal for backface culling
                                 // [1,0]=bow  [-1,0]=stern  [0,1]=stbd  [0,-1]=port
}
```

### Line face

Exactly two verts. Rendered as a canvas stroke, depth-sorted with other faces.

```json
{
  "type":      "line",
  "verts":     [[x1,y1,z1], [x2,y2,z2]],
  "color":     "#aabbcc",
  "lineWidth": 1.5               // canvas pixels (default: 1)
}
```

---

## Light

Point light attached to a node. Coordinates are **model-local** (rotated with the instance).

```json
{
  "x": -8.7, "y": -4.2, "z": 0.05,
  "color":    "#ff0000",         // on-color
  "colorOff": "#550000",         // optional: off-color when blinking (default: omit = no blink)
  "blink":    true,              // 500ms period; editor always renders as "on"
  "radius":   1.5                // canvas pixels (default: 2)
}
```

---

## Rotate

Applies a rotation to the node and all its children.

```json
{
  "pivot": [x, y, z],            // rotation origin, model-local
  "axis":  [ax, ay, az],         // unit vector

  // Option A: driven by external param (passed to renderNodes at runtime)
  "param": "steerAngle",

  // Option B: self-animating (ignores external params for this node)
  "animate": {
    "type":      "spin",         // continuous: angle = Date.now() * speed
    "speed":     0.002
  }
}
```

```json
{
  "pivot": [x, y, z],
  "axis":  [0, 0, 1],
  "animate": {
    "type":      "oscillate",    // sinusoidal: angle = amplitude * sin(Date.now() * speed)
    "speed":     8.0,
    "amplitude": 0.4
  }
}
```

`param` and `animate` are mutually exclusive. If both are present, `animate` wins.

---

## Rendering Behaviour

```
for each top-level node in "nodes":
    applyNode(node, instanceTransform, parentRotation=identity)
    SceneRenderer.flush(cx, cy)          // each node is its own render pass

applyNode(node, transform, parentRot):
    rotFn  = compose(parentRot, node.rotate)   // identity if no rotate
    faces  = node.faces  → rotFn applied to verts → one SceneRenderer.add() per face
    lights = node.lights → rotFn applied to position → queued via SceneRenderer.add(null, {drawFn})
    for each child: applyNode(child, transform, rotFn)
```

**Depth of each face:**

Every face is queued individually. Its sort depth is:

```
depth = baseDepth + faceIndex * 1e-7
```

Where `baseDepth` is the node's world-space sort origin:
- Without `depthAnchor`: `instanceX + instanceY`
- With `depthAnchor: [dx, dy]`:
  `(instanceX + dx·cosA − dy·sinA) + (instanceY + dx·sinA + dy·cosA)`

The `faceIndex * 1e-7` tiebreaker preserves face array order within a node when depths are
otherwise equal — so face ordering in the `.zdef` is meaningful and intentional.

**When to use `depthAnchor`:**

Set it when a node's geometric centre differs significantly from the instance origin AND that
node needs to sort correctly against external objects (e.g. other vessels, deck vehicles) in the
same flush. Without it, all faces in the node use `instanceX + instanceY` as their depth origin —
which is wrong if the node is geometrically offset.

Example: a ship's tower sits at stern-starboard. Without `depthAnchor`, the tower faces claim the
ship's centre as their depth origin and sort incorrectly against nearby objects at certain angles.
With `depthAnchor` set to the tower's local centre, depth is computed from the tower's actual
world position — angle-correct at all orientations.

**Node order matters:**

Nodes are rendered in declaration order, each in its own flush. A node declared later always
renders on top of nodes declared earlier, regardless of depth values. Use this to establish
coarse layering (e.g. hull → deck objects → superstructure).

---

## Migration from ZDEF v1

| v1                        | v2                                      |
|---------------------------|-----------------------------------------|
| `"faces": [...]`          | Top-level faces → first node's `faces`  |
| `"parts": [{id, faces, rotate, parent}]` | `"nodes"` with `"children"` nesting |
| `"passes": [{parts:[...]}]` | Implicit: top-level node order          |
| `rotateNodes`             | Node with `"rotate"` + `"children"`     |
| External `radarAngle` param | `"animate": {"type":"spin","speed":...}` |
| `applyParts(def, params, {only})` | `renderNodes(def, params, instanceProps, ctx)` |
| `applyRotateNodes`        | Removed                                  |

---

## Palettes

A model can declare named color sets in the optional `palettes` top-level field:

```json
{
  "version": 2,
  "id": "festival_car",
  "palettes": {
    "red":    { "hood_top": "#c02020", "body_side_l": "#a81c1c", ... },
    "blue":   { "hood_top": "#1a4a8a", "body_side_l": "#153d78", ... }
  },
  "nodes": [ ... ]
}
```

Keys are variant names (e.g. `"red"`, `"blue"`). Values are face-id → color maps that override the base face colors when this variant is active.

**Campaign objects** reference a palette by name via the `colorVariant` field:

```json
{ "type": "festival_car", "colorVariant": "red", "x": 6, "y": 9, "angle": 180 }
```

**Runtime resolution**: call `resolvePalette(def, colorVariant)` from `src/game/defs.ts` to get the color override map, then pass it as `colors` to `SceneRenderer.add()`. The renderer applies overrides per face ID; faces without an entry keep their declared color.

When `colorVariant` is absent or undefined, `resolvePalette` returns `undefined` and the model renders with its base face colors.

The special variant name `"disco"` is **not** declared in the palette map — it is recognized by the renderer and triggers animated color cycling.

---

## Known Limitations

- **Particles** (wake, spray): procedural and physics-driven — not in format.
- **`colors` override** (per-face color keyed by `face.id`): still supported at
  the instance level; face `id` fields remain meaningful.
