// Pure track geometry for the gamescom test-train prototype — no imports, no
// game/campaign state. Kept separate from test-train.ts (which drives this
// with campaignHandler/getGround) so the VS Code campaign editor's static
// preview can reuse the exact same math without pulling in the whole game
// runtime (main.ts: all music tracks, all campaigns, audio setup — heavy and
// DOM/AudioContext-coupled, exactly the kind of import that broke the
// minimap earlier when a different stale dependency threw at load time).
//
// Scale: 1 world unit ≈ 3.8m (derived from freight_locomotive.zdef's 5.0-unit
// length vs. a real ~19m diesel/electric loco, cross-checked against
// fuel_truck.zdef's 2.2 units vs. ~8m). GAUGE and SLEEPER_SPACING below are
// sized from that, not guessed — see feedback_winding_verification's broader
// lesson of verifying rather than eyeballing.
//
// Track shape is a "stadium": two straight segments at y = Y0∓R joined by two
// semicircular turns of radius R, parametrized by arc length `s` directly (no
// angle-to-arc-length correction needed, unlike the earlier ellipse version —
// straight segments and circular arcs are both unit-speed in arc length by
// construction). Runs through the corridor flattened into gamescom's mountain
// terrain on the west end and crosses the river/lake on the east side — left
// as real water on purpose, the rail "floats" over it (WATER_FLOAT_Z) rather
// than requiring actual bridge geometry.

export const X0 = 6, Y0 = 60; // left turn's center
export const STRAIGHT_LEN = 34;
export const TURN_RADIUS = 6;
export const PERIMETER = 2 * STRAIGHT_LEN + 2 * Math.PI * TURN_RADIUS;

export const LOCO_SPEED = 0.006; // world units of arc length per ms (≈ 82 km/h at the 1 unit ≈ 3.8m scale)
export const GAUGE = 0.19; // half the real 1.435m standard gauge, in world units
export const SLEEPER_SPACING = 0.16; // ≈0.6m real sleeper spacing
export const WATER_FLOAT_Z = 0.3; // matches the flattened corridor's land height — keeps the rail level over the water

export interface TrackPoint {
    x: number;
    y: number;
    angle: number; // direction of travel (increasing s) at this point
}

// s is arc length along the loop, wrapped to [0, PERIMETER).
export const pointAt = (s: number): TrackPoint => {
    let s1 = ((s % PERIMETER) + PERIMETER) % PERIMETER;

    if (s1 < STRAIGHT_LEN) {
        return { x: X0 + s1, y: Y0 - TURN_RADIUS, angle: 0 };
    }
    s1 -= STRAIGHT_LEN;

    if (s1 < Math.PI * TURN_RADIUS) {
        const a = -Math.PI / 2 + s1 / TURN_RADIUS;
        return { x: X0 + STRAIGHT_LEN + TURN_RADIUS * Math.cos(a), y: Y0 + TURN_RADIUS * Math.sin(a), angle: a + Math.PI / 2 };
    }
    s1 -= Math.PI * TURN_RADIUS;

    if (s1 < STRAIGHT_LEN) {
        return { x: X0 + STRAIGHT_LEN - s1, y: Y0 + TURN_RADIUS, angle: Math.PI };
    }
    s1 -= STRAIGHT_LEN;

    const a = Math.PI / 2 + s1 / TURN_RADIUS;
    return { x: X0 + TURN_RADIUS * Math.cos(a), y: Y0 + TURN_RADIUS * Math.sin(a), angle: a + Math.PI / 2 };
};

export interface BogiePose {
    x: number;
    y: number;
    angle: number;
}

export interface VehiclePose {
    bodyX: number;
    bodyY: number;
    bodyAngle: number;
    frontBogie: BogiePose;
    rearBogie: BogiePose;
}

// Pose for one car (locomotive or wagon): the body's position/angle is
// derived from its two bogies' own track points at arc-length s ±
// bogieSeparation/2 (so the body "overhangs" through curves like a real
// railcar instead of exactly tracking the rail centerline), while each
// bogie gets its own independent pose — the body and bogie.zdef are rendered
// as two fully separate objects (bogie underneath, body on top), not a
// parent/rotate-child pair, so there's no pivot-in-parent's-local-frame
// bookkeeping to get wrong.
export const poseAt = (s: number, bogieSeparation: number): VehiclePose => {
    const half = bogieSeparation / 2;
    const pFront = pointAt(s + half);
    const pRear = pointAt(s - half);

    const bodyX = (pFront.x + pRear.x) / 2;
    const bodyY = (pFront.y + pRear.y) / 2;
    const bodyAngle = Math.atan2(pFront.y - pRear.y, pFront.x - pRear.x);

    return {
        bodyX, bodyY, bodyAngle,
        frontBogie: { x: pFront.x, y: pFront.y, angle: pFront.angle },
        rearBogie: { x: pRear.x, y: pRear.y, angle: pRear.angle },
    };
};

// ── Consist layout ──────────────────────────────────────────────────────────
// Locomotive + wagons, each centered on its own bogie-pair midpoint (matching
// freight_locomotive.zdef / freight_wagon.zdef, both recentered so local
// x=0 is that midpoint, not the body's rear edge — renderNodes() places a
// def's local origin at the computed world pose, so origin and pose basis
// must agree or the body renders offset from its own wheels).
export const LOCO_BOGIE_SEP = 2.6; // freight_locomotive.zdef: bogie pivots at ∓1.3
export const WAGON_BOGIE_SEP = 2.2; // freight_wagon.zdef: bogie pivots at ∓1.1
export const LOCO_HALF_LEN = 2.5, WAGON_HALF_LEN = 2.0;
export const COUPLER_GAP = 0.3;
export const WAGON_COUNT = 3;
export const CONTAINER_COLORS = ['#2d6b35', '#2a4f8f', '#8f2d2d']; // green, blue, red — cycled per wagon
export const WAGON_DECK_Z = 0.3; // freight_wagon.zdef body height — container sits on top of it

export interface ConsistCar {
    kind: 'locomotive' | 'wagon';
    pose: VehiclePose;
    containerColor?: string;
}

// s0 = locomotive's arc-length position; wagons trail behind at fixed offsets.
export const getConsist = (s0: number): ConsistCar[] => {
    const cars: ConsistCar[] = [{ kind: 'locomotive', pose: poseAt(s0, LOCO_BOGIE_SEP) }];
    let s = s0 - LOCO_HALF_LEN - COUPLER_GAP - WAGON_HALF_LEN;
    for (let i = 0; i < WAGON_COUNT; i++) {
        cars.push({ kind: 'wagon', pose: poseAt(s, WAGON_BOGIE_SEP), containerColor: CONTAINER_COLORS[i % CONTAINER_COLORS.length] });
        s -= WAGON_HALF_LEN * 2 + COUPLER_GAP;
    }
    return cars;
};

export interface RailSamples {
    left: { x: number; y: number }[];
    right: { x: number; y: number }[];
}

// Both rails as point arrays, offset perpendicular to the track direction by
// ±GAUGE, sampled at SLEEPER_SPACING resolution (real-world sleeper density —
// also dense enough for smooth-looking turns). Shared by the game's track
// renderer and the editor's static preview so they draw literally the same line.
export const getRailSamples = (): RailSamples => {
    const steps = Math.round(PERIMETER / SLEEPER_SPACING);
    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
        const p = pointAt((i / steps) * PERIMETER);
        const perpX = -Math.sin(p.angle), perpY = Math.cos(p.angle);
        left.push({ x: p.x + perpX * GAUGE, y: p.y + perpY * GAUGE });
        right.push({ x: p.x - perpX * GAUGE, y: p.y - perpY * GAUGE });
    }
    return { left, right };
};
