# D3F — Isometric Model Format Specification

Version 3 of the `.zdef` format. Same wire shape as ZDEF2 — same `nodes`, `faces`,
`lights`, `rotate`, `children`, `depthAnchor`, `palettes`. Detected via
`"version": 3`. The only thing that changes is **`normal` is never hand-authored**.

---

## The problem this solves

ZDEF2 (and v1 before it) requires every face that should be hidden from some
angle to carry a manually written `normal: [nx, ny]`. That's a second,
independent statement of intent that has to agree with the vertex geometry —
and nothing checks that it does. Two failure modes follow from that:

1. **Missing mirror faces.** A left-side wall gets authored, the right-side
   counterpart is forgotten — not a wrong `normal`, a face that was never
   written at all. (`festival_car.zdef`: `trunk_r` exists, `trunk_l` doesn't —
   the trunk has no left wall.) D3F does not fix this class by itself — a
   missing face is missing geometry, not a culling bug — but it removes the
   *other*, more common failure next to it:
2. **Wrong/mismatched `normal`.** The face exists, but its `normal` doesn't
   match its actual winding, or was never updated after the geometry changed.
   This is silent — nothing points it out until someone looks from the wrong
   angle in the editor.

D3F removes (2) entirely by never letting an author write `normal` in the
first place: it's computed from the face's own vertex winding, every frame,
for every face that doesn't set one explicitly.

---

## How it works

`normal` is computed as the cross product of the face's first two edges
(right-hand rule: `(v1−v0) × (v2−v0)`, normalized) — **full 3D**, not the 2D
XY approximation ZDEF2 uses. It's computed once per node-local rotation state
(`def-utils.ts: computeFaceNormal`), then rotated around Z by the instance's
`angle` at render time, exactly like ZDEF2's `normal` rotation already works —
just extended by a Z component instead of being XY-only.

Cull test: the camera view direction is the fixed constant `(1, 1, 1)`
(un-normalized — only the sign of the dot product matters, so this is
equivalent to `[nx*cosA - ny*sinA + nx*sinA + ny*cosA] + nz <= 0` → cull. Same
cost as the existing 2D test, one extra term.

**This automatically extends culling to the Z axis.** Under ZDEF2, a face
without `normal` is always drawn — that's how top faces stay visible and
bottom faces get manually omitted by convention. Under D3F, a computed
`(0,0,1)` top face and `(0,0,-1)` bottom face both cull correctly on their
own; nothing needs to be omitted by convention anymore.

## Author-facing rule

**Faces don't need `normal`, ever.** Whether that produces a *correct* normal
depends entirely on vertex winding — and getting winding right on the first
try does not come naturally, to humans or to LLMs. The intuitive way to list
a quad's four corners is reading order (top-left, top-right, bottom-right,
bottom-left) — a 2D habit that has nothing to do with which side of a 3D solid
you're looking from. Two migrations in this codebase (`supply_vessel.zdef`,
eight faces backwards) confirm this isn't a one-off slip; it's the default
failure mode for this kind of authoring. Treat every new face's winding as
unverified until checked — never as "probably fine because it was written
carefully."

### The rule

Winding is **counter-clockwise as seen from outside the solid** (right-hand
rule: curl the fingers of your right hand along `v0 → v1 → v2`, thumb points
along the outward normal). Two ways to apply this without re-deriving it from
scratch every time:

- **Walking an edge.** For a vertical wall built from two ground points `p0`,
  `p1` extruded up (`[p0,z0]`, `[p1,z0]`, `[p1,z1]`, `[p0,z1]` — the pattern
  every wall/rail/post face in this codebase uses): the outward normal is
  `p1 − p0` rotated **−90° (clockwise)** in the XY plane. So to face `+X`,
  walk `p0 → p1` in `+Y`; to face `+Y`, walk in `−X`; to face `−X`, walk in
  `−Y`; to face `−Y`, walk in `+X`. This covers the large majority of hand-
  authored geometry (walls, rails, posts, panels) without touching a cross
  product at all.
- **Top/bottom caps.** A flat top face (visible from the default elevated
  camera) winds counter-clockwise when plotted with `+X` right and `+Y` up —
  same convention as the edge rule, just closed into a loop instead of
  extruded.

### The check — run this after writing every new face, not just when auditing

```python
def face_normal(verts):
    v0, v1, v2 = verts[0], verts[1], verts[2]
    ax, ay, az = v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]
    bx, by, bz = v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]
    nx, ny, nz = ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx
    return nx, ny, nz  # sign only — no need to normalize for this check
```

Then confirm the face points *away from* the object, not into it:
`(face_centroid − object_centroid) · normal > 0`. For simple axis-aligned
walls this collapses further: a face sitting on the object's `y_max`
boundary must compute `+Y`; on `y_min`, `−Y`; and so on per axis. This is
exactly the check that caught all nine winding bugs found while migrating
`baywatch_car`/`baywatch_tower`/`baywatch_hq`/`supply_vessel` — none of them
were visible in ZDEF2 (no declared `normal` to contradict), so nothing but
this check would have caught them before D3F made them culling-relevant.

`normal` remains a legal, optional override for the rare genuinely
single-sided case — a decal, a flat sign, glass that's meant to render from
one side only regardless of what winding-derived culling would say. When
present, it behaves exactly as in ZDEF2 (2D, XY-only) and takes priority over
the computed value. Absence of `normal` is now a meaningful signal
("cull me correctly, automatically") instead of "always visible."

---

## Migration from ZDEF2

No structural change. Existing `nodes`/`faces`/`rotate`/`depthAnchor` all work
unchanged. To move a model to D3F:

1. Set `"version": 3`.
2. Delete `normal` from faces where it was only there to hide/show a
   side-facing wall (keep it on genuinely single-sided decorative faces).
3. Rotate the model through 360° in the editor's free-rotate view and look for
   gaps — those are missing faces (class 1 above), not something the format
   change fixes. Add the missing geometry.

Nothing else needs to change — `renderNodes`/`applyNodes` dispatch on
`def.version` automatically (`autoNormal = def.version === 3`).

---

## What this does *not* do

- Does not invent missing geometry. A never-authored mirror face stays
  missing until someone adds it.
- Does not validate manifold-closedness (no linter, by design — the existing
  free-rotate + fixed-ISO editor preview is the intended verification path).
- Does not touch ZDEF2 or DEF v1 semantics or rendering at all — this is a
  strictly additive new code path (`normal3d` field, new `else if` branch in
  `SceneRenderer.flush()`), gated entirely behind `version === 3`. Zero risk
  to any of the existing 52 `.zdef` files.

See `ZDEF2_SPEC.md` for everything else (nodes, rotate, lights, depthAnchor,
palettes, compact wire format) — unchanged and shared with D3F.
