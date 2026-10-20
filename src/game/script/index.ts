// Public API for campaign scripts (src/game/campaigns/<key>.script.ts).
// Scripts import ONLY from here — never from game internals (enforced by the
// script-types Vite plugin and a unit test). See docs/SCRIPTING.md.

import type { VESSEL, PAYLOAD } from '../../shared/types';

// ─── Texts ────────────────────────────────────────────────────────────────────

export type Lang = 'de' | 'en' | 'fr' | 'es' | 'pt';
/** Every player-facing script text needs all five languages. */
export type Text = { readonly [L in Lang]: string };

// ─── Object types ─────────────────────────────────────────────────────────────

export type ObjectType = (typeof VESSEL)[keyof typeof VESSEL];
export type PayloadType = (typeof PAYLOAD)[keyof typeof PAYLOAD];

export type VesselType =
    | 'carrier' | 'boat' | 'pilot_boat' | 'sar_boat' | 'salvage_tug' | 'supply_vessel' | 'frigate' | 'submarine';
/** Placed objects without a collision box — they can't be touched. */
export type PropType = 'buoy' | 'reindeer' | 'sleigh' | 'volleyball_court' | 'xmas_candy_cane' | 'xmas_tree';
/** Not addressable from scripts (no runtime object behind them). */
export type UnscriptedType = 'pad' | 'lighthouse' | 'ornithopter_wreck';
export type StructureType = Exclude<ObjectType, VesselType | PropType | UnscriptedType | 'wind_turbine'>;

export type Positioned = { readonly x: number; readonly y: number };

export interface MapObject<T extends string = string> extends Positioned {
    readonly type: T;
    readonly name: string | undefined;
    readonly z: number;
    readonly destroyed: boolean;
    /** Hides/shows this object's dot on the minimap (objects without a dot ignore it). */
    readonly minimap: { hidden: boolean };
    distanceTo(other: Positioned): number;
    /** Direction to another object in degrees (map convention like object angles: 0° = +x). */
    bearingTo(other: Positioned): number;
    /** Fires once when the heli comes within `distance` (horizontal) of this object. */
    onHeliNear(distance: number, action: () => void): void;
}

/** Placed object with a model: collapses on destroy(). */
export interface Destructible<T extends string = string> extends MapObject<T> {
    /** Animated collapse with explosion and dust/spray; owned fire/smoke stays on the rubble. */
    destroy(): void;
}

/** Has a collision box: can be tested for 3D contact with another solid object. */
export interface Solid<T extends string = string> extends Destructible<T> {
    /** Fires once when both collision boxes overlap in x, y AND z. */
    onTouch(other: Solid, action: () => void): void;
}

/**
 * Start values come from the .zcampaign (object angle, speed, route). Setting any of
 * them hands the vessel over to the script — a route from the editor ends then.
 */
export interface Vessel<T extends VesselType = VesselType> extends Solid<T> {
    /** Where the bow points, degrees (map convention: 0° = +x). */
    heading: number;
    /** Direction the vessel actually moves, degrees. Follows `heading` until set — differing = drifting sideways. */
    course: number;
    /** Knots; 0 = stopped. */
    speed: number;
    radio(text: Text): void;
}

export interface WindTurbine extends Solid<'wind_turbine'> {
    setOnFire(on?: boolean): void;
    setOnSmoke(on?: boolean): void;
    spin(on: boolean): void;
}

export type Structure<T extends StructureType = StructureType> = Solid<T>;
export type Prop<T extends PropType = PropType> = Destructible<T>;

export type PayloadState = 'waiting' | 'hanging' | 'onBoard' | 'rescued';

/** Where a payload was set down: a placed object, or the helipad. */
export type RescueTarget = Solid | { readonly type: 'pad' };

export interface Payload<T extends PayloadType = PayloadType> extends MapObject<T> {
    readonly state: PayloadState;
    onBoard(action: () => void): void;
    /** Rescued and delivered are the same event; `where` is the drop-off target. */
    onRescued(action: (where: RescueTarget) => void): void;
    radio(text: Text): void;
}

export type ScriptObject = Vessel | WindTurbine | Structure | Prop | Payload;

export type ObjectFor<T extends string> =
    T extends VesselType ? Vessel<T>
    : T extends 'wind_turbine' ? WindTurbine
    : T extends PropType ? (T extends PayloadType ? Prop<T> | Payload<T> : Prop<T>)
    : T extends StructureType ? Structure<T>
    : T extends PayloadType ? Payload<T>
    : never;

export interface Heli extends Positioned {
    readonly z: number;
    readonly speedKmh: number;
    readonly onBoard: number;
    distanceTo(other: Positioned): number;
    bearingTo(other: Positioned): number;
}

// ─── Mission context ──────────────────────────────────────────────────────────

export interface Mission {
    win(): void;
    fail(reason?: Text): void;
    readonly rescued: number;
    readonly onBoard: number;
    readonly remaining: number;
    readonly endless: boolean;
    message(text: Text): void;
    /** Wind strength in Beaufort. */
    setWind(bft: number): void;
}

/** Names → object types of one mission (generated into <key>.script-objects.ts). */
export type MissionObjects = Record<string, ScriptObject>;

export interface MissionContext<M extends MissionObjects> {
    object<N extends keyof M & string>(name: N): M[N];
    all<T extends Exclude<ObjectType | PayloadType, UnscriptedType>>(type: T): ObjectFor<T>[];
    heli: Heli;
    mission: Mission;
    /** Game time — pauses with the game, discarded when the mission ends. */
    wait(seconds: number): Promise<void>;
    /** Checked every physics tick, fires once. */
    when(condition: () => boolean, action: () => void): void;
    every(seconds: number, action: () => void): void;
    onTick(action: (dtSeconds: number) => void): void;
}

export type MissionScript<M extends MissionObjects> = (ctx: MissionContext<M>) => void | Promise<void>;

export type CampaignScript<O extends Record<string, MissionObjects>> = {
    [K in keyof O]?: MissionScript<O[K]>;
};

/** Missions are keyed by their level `id` from the .zcampaign. */
export const defineCampaignScript = <O extends Record<string, MissionObjects>>(
    missions: CampaignScript<O>,
): CampaignScript<O> => missions;
