# Campaign Format

Campaigns are stored as JSON in `src/game/campaigns/`. Each file contains one campaign with one or more mission levels. New campaigns saved via the Mission Editor are automatically registered in `src/game/main.ts`.

---

## Localisation (i18n)

All display-string fields accept either a plain string or a localised object:

```json
"campaignTitle": "MY CAMPAIGN"
```

```json
"campaignTitle": { "de": "MEINE KAMPAGNE", "en": "MY CAMPAIGN" }
```

This applies to `campaignTitle`, `campaignSublines[]`, `headline`, `sublines[]`, and `briefing`.

---

## Top-level Structure

```json
{
  "type": "sar",
  "campaignTitle": { "de": "MEINE KAMPAGNE", "en": "MY CAMPAIGN" },
  "campaignSublines": [
    { "de": "Erste Zeile", "en": "First line" }
  ],
  "music": {
    "briefing": "main",
    "ingame": "tutorial"
  },
  "levels": [ "..." ]
}
```

| Field              | Type                 | Description                                                        |
| ------------------ | -------------------- | ------------------------------------------------------------------ |
| `type`             | string               | Internal identifier (e.g. `"tutorial"`, `"sar"`, `"free-flight"`) |
| `campaignTitle`    | string \| i18n       | Displayed title on the campaign select screen                      |
| `campaignSublines` | string[] \| i18n[]   | Subtitle lines shown below the title                               |
| `music`            | object               | Optional. Per-campaign music assignments (see below)               |
| `levels`           | array                | Ordered list of mission levels                                     |

---

## Music

Both sub-fields are optional; if omitted the current music continues playing.

```json
"music": {
  "briefing": "main",
  "ingame": "tutorial"
}
```

| Field      | Type   | Description                                                       |
| ---------- | ------ | ----------------------------------------------------------------- |
| `briefing` | string | Song key to play when the mission briefing screen is shown        |
| `ingame`   | string | Song key to play when the mission itself begins                   |

Song keys correspond to filenames (without `.json`) in `src/game/music/`.

---

## Level

Each entry in `levels` describes one playable mission.

```json
{
  "headline":    { "de": "Mission 1", "en": "Mission 1" },
  "sublines":    [{ "de": "Rette alle Überlebenden", "en": "Rescue all survivors" }],
  "briefing":    { "de": "Vollständiger Briefingtext.", "en": "Full briefing text." },
  "gridSize":    100,
  "terrain":     "...",
  "spawnObject": "pad",
  "objects":     [ "..." ],
  "payloads":    [ "..." ],
  "foliage":     "...",
  "objectives":  [ "..." ],
  "rain":        false,
  "night":       false,
  "windDir":     90,
  "windStr":     1.5,
  "windVar":     false,
  "waterLevel":  0
}
```

| Field         | Type            | Description                                                                 |
| ------------- | --------------- | --------------------------------------------------------------------------- |
| `headline`    | string \| i18n  | Mission title shown in briefing and mission select                          |
| `sublines`    | i18n[]          | Optional. Subtitle lines shown in the mission select screen                 |
| `briefing`    | string \| i18n  | Briefing text shown before the mission starts                               |
| `gridSize`    | number          | Width and height of the terrain grid in tiles                               |
| `terrain`     | string          | Run-length encoded elevation data (see below)                               |
| `spawnObject` | string          | Where the helicopter spawns: `"pad"` or `"carrier"`                         |
| `objects`     | array           | Placed scene objects (see below)                                            |
| `payloads`    | array           | Rescue targets (persons or crates, see below)                               |
| `foliage`     | string \| array | Decorative vegetation (see below)                                           |
| `objectives`  | array           | Optional. Win conditions (see below)                                        |
| `rain`        | boolean         | Rain effect active                                                          |
| `night`       | boolean         | Night mode active                                                           |
| `windDir`     | number          | Wind direction in degrees (0 = North, 90 = East)                            |
| `windStr`     | number          | Wind strength (0 = calm)                                                    |
| `windVar`     | boolean         | Randomly varying wind direction and strength                                |
| `waterLevel`  | number          | Optional (default `0`). Tiles at or below this elevation render as water.  |

---

## Terrain Encoding

The `terrain` field is a run-length encoded string of elevation values, row by row (left to right, top to bottom). The full array has `(gridSize + 1) × (gridSize + 1)` entries.

**Rules:**

- A plain number (`97`) represents a single tile at that elevation.
- `3x97` means value `97` repeated 3 times.
- Negative values mark water tiles at default water level (e.g. `-10`).
- Values are divided by 10 internally: JSON value `80` → game elevation `8.0`.

**Example:** `3x97,-10x4` → `[9.7, 9.7, 9.7, -1.0, -1.0, -1.0, -1.0]`

All-water map for gridSize 100: `"-10x10201"`

---

## Objects

### Rescue Pad

```json
{ "type": "pad", "x": 15, "y": 20 }
```

Landing and spawn point for the helicopter on land.

### Carrier

```json
{
  "type": "carrier",
  "x": 40,
  "y": 60,
  "angle": 0,
  "path": "circle",
  "speed": 10,
  "radius": 45
}
```

Large moving vessel. Can be used as spawn point (`spawnObject: "carrier"`).

| Field    | Type   | Description                                                       |
| -------- | ------ | ----------------------------------------------------------------- |
| `x`, `y` | number | Starting grid position                                            |
| `angle`  | number | Initial heading in degrees (0 = East, 90 = South)                 |
| `path`   | string | Movement pattern: `"static"` · `"circle"` · `"straight"`          |
| `speed`  | number | Speed in knots                                                    |
| `radius` | number | Circle radius in tiles (only used when `path` is `"circle"`)      |

**Path behaviour:**

- `"static"` — does not move.
- `"circle"` — orbits an elliptical path. The initial position and heading define the starting point on the orbit. `radius` is the semi-major axis; the semi-minor axis is `radius × 0.8`.
- `"straight"` — moves indefinitely in the direction of `angle`, eventually leaving the map.

### Boat

Same fields as Carrier. Boats are smaller vessels; they cannot serve as spawn points but can carry payloads via `attachTo` and define `rescueZones`.

```json
{
  "type": "boat",
  "x": 113,
  "y": 110,
  "angle": 0,
  "path": "straight",
  "speed": 3,
  "radius": 0
}
```

### Submarine

Same fields as Boat. Submarines travel on the water surface and can carry payloads. They also support `rescueZones`.

```json
{
  "type": "submarine",
  "x": 70,
  "y": 45,
  "angle": 135,
  "path": "static",
  "speed": 0,
  "radius": 0,
  "rescueZones": [{ "x": 0, "y": 0, "w": 4.5, "h": 0.6, "role": "dropoff" }]
}
```

### Lighthouse

```json
{ "type": "lighthouse", "x": 10, "y": 25 }
```

Static decorative and navigational landmark. Not interactable.

---

## Rescue Zones

Carrier, Boat, and Submarine objects can define `rescueZones` — regions in vessel-local coordinates where the player can pick up or deliver payloads.

```json
"rescueZones": [
  { "x": 0, "y": 0, "w": 4.5, "h": 0.6, "role": "dropoff" }
]
```

| Field    | Type   | Description                                                            |
| -------- | ------ | ---------------------------------------------------------------------- |
| `x`, `y` | number | Centre of the zone in vessel-local coordinates (longitudinal/lateral)  |
| `w`, `h` | number | Width and height of the zone                                           |
| `role`   | string | `"pickup"` · `"dropoff"` · `"both"`                                    |

If no `rescueZones` are defined, the entire vessel surface allows both pickup and dropoff.

The carrier's default rescue zones are defined in its `.zdef` file, not in the mission JSON.

---

## Payloads

Rescue targets the player must winch up and deliver.

```json
{ "type": "person", "x": 27, "y": 30 }
```

```json
{
  "type": "crate",
  "x": 70,
  "y": 45,
  "attachTo": {
    "objectType": "submarine",
    "objectIdx": 1,
    "localX": -3,
    "localY": 0.3
  }
}
```

| Field       | Type    | Description                                                         |
| ----------- | ------- | ------------------------------------------------------------------- |
| `type`      | string  | `"person"` · `"rescuer"` · `"crate"` · `"orni_wreck"` (see below) |
| `x`, `y`    | number  | World grid position (used as fallback if `attachTo` is absent)     |
| `attachTo`  | object  | Optional. Attach payload to a moving vessel (see below)            |
| `npcTarget` | boolean | Optional. If `true`, payload is not counted toward the mission goal |

### Payload types & physics

Each payload type has a `baseMass` defined in `payload-defs.ts`. Effective horizontal drag on the carrying helicopter = `baseMass × heli.cargoResist`.

| Type         | baseMass | Notes                                                                                                                                  |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `person`     | 0.2      | Rescued survivor, winched aboard                                                                                                       |
| `rescuer`    | 0.2      | NPC rescuer lowered from heli                                                                                                          |
| `crate`      | 0.8      | Cargo box, delivered to a dropzone                                                                                                     |
| `orni_wreck` | 3.5      | Crashed ornithopter (easter egg). Too heavy for Dolphin (cargoResist 0.5 → drag 1.75), manageable for Coast-Hawk (cargoResist 0.1 → drag 0.35) |

`orni_wreck` must be delivered to the pad. On delivery the active mission is aborted and the player is immediately promoted to Major.

### attachTo

Attaches the payload to a vessel so it moves with it until picked up.

| Field        | Type   | Description                                                                 |
| ------------ | ------ | --------------------------------------------------------------------------- |
| `objectType` | string | `"carrier"` · `"boat"` · `"submarine"`                                      |
| `objectIdx`  | number | Index of the object in the `objects` array (0-based)                        |
| `localX`     | number | Optional. Longitudinal offset in vessel-local space (positive = toward bow) |
| `localY`     | number | Optional. Lateral offset in vessel-local space (positive = starboard)       |

The offset is rotated with the vessel's heading each frame so the payload stays in the correct deck position.

---

## Objectives

The `objectives` array defines the win conditions for the mission. If omitted or empty, the mission cannot be won (useful for free-flight levels).

```json
"objectives": [
  { "type": "rescue_all" }
]
```

```json
"objectives": [
  { "type": "land_at", "target": "carrier" }
]
```

| Objective type | Fields           | Description                                                                                                             |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `rescue_all`   | —                | Complete when all non-`npcTarget` payloads have been rescued and delivered                                              |
| `land_at`      | `target: string` | Complete when the player shuts down the engine while on the target. `target` is `"pad"`, `"carrier"`, or `"boat"` |

Multiple objectives in the array are AND-linked: all must be fulfilled before the mission completes. Order does not matter.

---

## Foliage

Decorative vegetation. Not interactable, does not block movement.

### Compressed string format (editor output)

The Mission Editor writes foliage as a compact `|`-delimited string. Each token is:

```text
<type_char><x*10>,<y*10>,<s*10>
```

| Type char | Foliage type             |
| --------- | ------------------------ |
| `p`       | pine                     |
| `o`       | oak                      |
| `b`       | bush                     |
| `d`       | dead                     |
| `u`       | beach_umbrella           |
| `v`       | beach_umbrella_tilted    |
| `l`       | beach_lounger            |
| `c`       | beach_cooler             |
| `g`       | beach_person / swimmer   |

Beach items (`u`, `v`, `l`, `c`, `g`) are placed by the foliage brush just like trees. A `beach_person` placed on a water tile automatically renders as a swimmer. These are purely decorative NPC figures — not rescue targets.

**Example:** `"p542,238,10|o438,517,10|u1938,1214,10|g2019,843,7"`

Decoded: a pine at (54.2, 23.8) scale 1.0, an oak at (43.8, 51.7) scale 1.0, a beach umbrella at (193.8, 121.4) scale 1.0, a beach person at (201.9, 84.3) scale 0.7.

### Expanded JSON array format

Foliage can also be written as a plain JSON array (useful when authoring by hand):

```json
"foliage": [
  { "type": "pine", "x": 12, "y": 18, "s": 1.2 },
  { "type": "oak",  "x": 20, "y": 10, "s": 0.9 },
  { "type": "bush", "x": 30, "y": 25, "s": 1.0 },
  { "type": "dead", "x": 40, "y": 15, "s": 1.1 }
]
```

| Field    | Type   | Description                               |
| -------- | ------ | ----------------------------------------- |
| `type`   | string | `"pine"` · `"oak"` · `"bush"` · `"dead"` |
| `x`, `y` | number | Grid position                             |
| `s`      | number | Scale factor (1.0 = normal size)          |

Use `""` or `[]` for levels with no vegetation.
