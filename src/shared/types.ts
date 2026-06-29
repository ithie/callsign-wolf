/** Text field that can be a plain string (legacy) or a { de, en } object. */
export type LocalizedString = string | { de: string; en?: string };

export const VESSEL = {
    CARRIER:            'carrier',
    BOAT:               'boat',
    SUBMARINE:          'submarine',
    PAD:                'pad',
    LIGHTHOUSE:         'lighthouse',
    PILOT_BOAT:         'pilot_boat',
    SAR_BOAT:           'sar_boat',
    SALVAGE_TUG:        'salvage_tug',
    RESEARCH_PLATFORM:  'research_platform',
    WIND_TURBINE:       'wind_turbine',
    PLANE_WRECK:        'plane_wreck',
    ORNITHOPTER_WRECK:  'ornithopter_wreck',
    SAILBOAT_BROKEN:    'sailboat_broken',
    BAYWATCH_CAR:       'baywatch_car',
    BAYWATCH_HQ:        'baywatch_hq',
    BAYWATCH_TOWER:     'baywatch_tower',
    BUOY:               'buoy',
    FRIGATE:            'frigate',
    SUPPLY_VESSEL:      'supply_vessel',
    CONCERT_STAGE:             'concert_stage',
    FESTIVAL_TENT:             'festival_tent',
    FESTIVAL_TENT_RED:         'festival_tent_red',
    FESTIVAL_TENT_GREEN:       'festival_tent_green',
    FESTIVAL_TENT_BROKEN:      'festival_tent_broken',
    FESTIVAL_TENT_BROKEN_RED:  'festival_tent_broken_red',
    FESTIVAL_TENT_BROKEN_GREEN:'festival_tent_broken_green',
    FESTIVAL_CAR_RED:   'festival_car_red',
    FESTIVAL_CAR_BLUE:  'festival_car_blue',
    FESTIVAL_CAR_SILVER:'festival_car_silver',
    FESTIVAL_CAR_BLACK: 'festival_car_black',
    FESTIVAL_CAR_YELLOW:'festival_car_yellow',
} as const;

export const PAYLOAD = {
    PERSON:     'person',
    CRATE:      'crate',
    RESCUER:    'rescuer',
    ORNI_WRECK: 'orni_wreck',
} as const;

export const VEHICLE_STATE = {
    PARKED:    'PARKED',
    DRIVING:   'DRIVING',
    RETURNING: 'RETURNING',
    ARM_OUT:   'ARM_OUT',
    ARM_IN:    'ARM_IN',
    FUELING:   'FUELING',
} as const;
export type VehicleState = typeof VEHICLE_STATE[keyof typeof VEHICLE_STATE];

export const NPC_HELI_STATE = {
    PARKED:  'PARKED',
    TAKEOFF: 'TAKEOFF',
    PATROL:  'PATROL',
} as const;
export type NpcHeliState = typeof NPC_HELI_STATE[keyof typeof NPC_HELI_STATE];

export const VESSEL_PATH = {
    STATIC:   'static',
    STRAIGHT: 'straight',
    CIRCLE:   'circle',
} as const;
export type VesselPath = typeof VESSEL_PATH[keyof typeof VESSEL_PATH];

export const CAMPAIGN_TYPE = {
    TUTORIAL:    'tutorial',
    FREE_FLIGHT: 'free-flight',
} as const;
export type CampaignType = typeof CAMPAIGN_TYPE[keyof typeof CAMPAIGN_TYPE];

export const RESCUE_ZONE_ROLE = {
    PICKUP:  'pickup',
    DROPOFF: 'dropoff',
    BOTH:    'both',
} as const;
export type RescueZoneRole = typeof RESCUE_ZONE_ROLE[keyof typeof RESCUE_ZONE_ROLE];
export type RescueZone = { x: number; y: number; w: number; h: number; role: RescueZoneRole; z?: number; dz?: number };

export const OBJECTIVE_TYPE = {
    RESCUE_ALL: 'rescue_all',
    LAND_AT:    'land_at',
} as const;
export type ObjectiveType = typeof OBJECTIVE_TYPE[keyof typeof OBJECTIVE_TYPE];

export const PARTICLE_EMITTER_TYPE = {
    SMOKE: 'smoke',
    FIRE:  'fire',
} as const;
export type ParticleEmitterType = typeof PARTICLE_EMITTER_TYPE[keyof typeof PARTICLE_EMITTER_TYPE];
export type ParticleEmitter = { type: ParticleEmitterType; x: number; y: number };

type PadObject = { type: 'pad'; x: number; y: number };
type CarrierObject = {
    type: 'carrier';
    x: number;
    y: number;
    angle: number;
    path: VesselPath;
    speed: number;
    radius: number;
    coordinatorHeli?: boolean;
    radioSilent?: boolean;
};
type BoatObject = {
    type: 'boat';
    x: number;
    y: number;
    angle: number;
    path: VesselPath;
    speed: number;
    radius: number;
};
type SubmarineObject = {
    type: 'submarine';
    x: number;
    y: number;
    angle: number;
    path: VesselPath;
    speed: number;
    radius: number;
    rescueZones?: RescueZone[];
};
type LighthouseObject = { type: 'lighthouse'; x: number; y: number };
type PilotBoatObject = {
    type: 'pilot_boat';
    x: number;
    y: number;
    angle: number;
    path: VesselPath;
    speed: number;
    radius: number;
};
type SalvageTugObject = {
    type: 'salvage_tug';
    x: number;
    y: number;
    angle: number;
    path: VesselPath;
    speed: number;
    radius: number;
};
type ResearchPlatformObject = { type: 'research_platform'; x: number; y: number };
type WindTurbineObject = { type: 'wind_turbine'; x: number; y: number; spinning?: boolean; onFire?: boolean; onSmoke?: boolean; rescueZones?: RescueZone[] };
type SupplyVesselObject = {
    type: 'supply_vessel';
    x: number;
    y: number;
    angle: number;
    path: VesselPath;
    speed: number;
    radius: number;
};
type PlaneWreckObject = { type: 'plane_wreck'; x: number; y: number; angle?: number };
type SailboatBrokenObject = { type: 'sailboat_broken'; x: number; y: number; angle?: number };
type OrnithopterWreckObject = { type: 'ornithopter_wreck'; x: number; y: number; angle?: number };
type FrigateObject = {
    type: 'frigate';
    x: number;
    y: number;
    angle: number;
    path: VesselPath;
    speed: number;
    radius: number;
    radioSilent?: boolean;
};

type MissionObject = PadObject | CarrierObject | BoatObject | SubmarineObject | LighthouseObject | PilotBoatObject | SalvageTugObject | ResearchPlatformObject | WindTurbineObject | SupplyVesselObject | PlaneWreckObject | SailboatBrokenObject | OrnithopterWreckObject | FrigateObject;

export type Objective =
    | { type: 'rescue_all' }
    | { type: 'land_at'; target: 'pad' | 'carrier' | 'frigate' };

export type MissionPayload = {
    type: 'person' | 'crate' | 'rescuer' | 'orni_wreck';
    x: number;
    y: number;
    attachTo?: { objectType: 'carrier' | 'boat' | 'submarine' | 'sailboat_broken' | 'wind_turbine' | 'supply_vessel'; objectIdx: number; localX?: number; localY?: number };
    npcTarget?: boolean;
    /** Crates only: restrict delivery to this vessel type. Omit = any dropzone. */
    deliverTo?: 'pad' | 'carrier' | 'submarine' | 'wind_turbine';
    /** Persons only: true = beach outfit (Badehose/Badeanzug), false = always normal clothes, omit = auto. */
    swimwear?: boolean;
};

export interface Mission {
    headline: LocalizedString;
    sublines?: LocalizedString[];
    briefing: LocalizedString;
    gridSize: number;
    terrain: number[][];

    spawnObject: 'pad' | 'carrier';
    objectives: Objective[];
    objects: MissionObject[];
    payloads: MissionPayload[];
    foliage: { x: number; y: number; s: number; type: string }[];

    rain: boolean;
    night: boolean;
    windDir: number;
    windStr: number;
    windVar: boolean;
    waterLevel?: number;
    music?: string;
    sand?: number[][];
    particleEmitters?: ParticleEmitter[];
}

export type MissionData = Omit<Mission, 'terrain' | 'foliage'> & {
    terrain: string;
    gridSize: number;
    foliage: string | { x: number; y: number; s: number; type: string }[];
    campaignType: string;
    sand?: string;
    particleEmitters?: ParticleEmitter[];
};

export interface CampaignExport {
    type: string;
    campaignTitle: LocalizedString;
    campaignSublines: LocalizedString[];
    music?: { briefing?: string; ingame?: string };
    levels: (Omit<Mission, 'terrain' | 'foliage'> & {
        terrain: string;
        gridSize: number;
        foliage: string | { x: number; y: number; s: number; type: string }[];
        sand?: string;
    })[];
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}
