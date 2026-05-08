/** Text field that can be a plain string (legacy) or a { de, en } object. */
export type LocalizedString = string | { de: string; en?: string };

type PadObject = { type: 'pad'; x: number; y: number };
type CarrierObject = {
    type: 'carrier';
    x: number;
    y: number;
    angle: number;
    path: 'circle' | 'straight' | 'static';
    speed: number;
    radius: number;
};
type BoatObject = {
    type: 'boat';
    x: number;
    y: number;
    angle: number;
    path: 'circle' | 'straight' | 'static';
    speed: number;
    radius: number;
};
type SubmarineObject = {
    type: 'submarine';
    x: number;
    y: number;
    angle: number;
    path: 'circle' | 'straight' | 'static';
    speed: number;
    radius: number;
};
type LighthouseObject = { type: 'lighthouse'; x: number; y: number };
type PilotBoatObject = {
    type: 'pilot_boat';
    x: number;
    y: number;
    angle: number;
    path: 'circle' | 'straight' | 'static';
    speed: number;
    radius: number;
};
type SalvageTugObject = {
    type: 'salvage_tug';
    x: number;
    y: number;
    angle: number;
    path: 'circle' | 'straight' | 'static';
    speed: number;
    radius: number;
};
type ResearchPlatformObject = { type: 'research_platform'; x: number; y: number };
type WindTurbineObject = { type: 'wind_turbine'; x: number; y: number; rescueZones?: Array<{ x: number; y: number; w: number; h: number; role: 'pickup' | 'dropoff' | 'both' }> };

type MissionObject = PadObject | CarrierObject | BoatObject | SubmarineObject | LighthouseObject | PilotBoatObject | SalvageTugObject | ResearchPlatformObject | WindTurbineObject;

export type Objective =
    | { type: 'rescue_all' }
    | { type: 'land_at'; target: 'pad' | 'carrier' | 'boat' };

export type MissionPayload = {
    type: 'person' | 'crate';
    x: number;
    y: number;
    attachTo?: { objectType: 'carrier' | 'boat' | 'submarine'; objectIdx: number; localX?: number; localY?: number };
    npcTarget?: boolean;
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
}

export type MissionData = Omit<Mission, 'terrain' | 'foliage'> & {
    terrain: string;
    gridSize: number;
    foliage: string | { x: number; y: number; s: number; type: string }[];
    campaignType: string;
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
    })[];
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}
