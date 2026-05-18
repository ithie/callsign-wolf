import { HELI_TYPES } from './heli-types';

// ─── NPC heli ─────────────────────────────────────────────────────────────────
export interface NpcHeli {
    type: string;
    x: number; y: number; z: number;
    angle: number;
    tilt: number; roll: number;
    rotorRPM: number;
    rotationPos: number;
    state: 'PARKED' | 'TAKEOFF' | 'PATROL';
    autoTakeoff: boolean;
    parkXRel: number; parkYRel: number; parkAngle: number;
    waypoints: { x: number; y: number }[];
    wpI: number;
    cruiseZ: number;
}

// ─── Remote heli (Multiplayer) ────────────────────────────────────────────────
export interface RemoteHeli {
    type: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    angle: number;
    tilt: number;
    roll: number;
    rotorRPM: number;
    rotationPos: number;
    inAir: boolean;
}

const createZstate = () => {
    const state = {
        gameStarted: false,
        crashed: false,
        missionType: '',
        goalCount: 0,
        totalRescued: 0,
        totalSpawned: 0,
        cam: { x: 0, y: 0 },
    };

    return state;
};

export const zstate = createZstate();

export const G = {
    goalCount: 0,
    totalRescued: 0,
    waterLevel: 0,
    objectives: [] as any[],
    menuHover: Object.fromEntries(HELI_TYPES.map(h => [h.id, false])),
    menuAngles: Object.fromEntries(HELI_TYPES.map(h => [h.id, -0.5])),
    points: [] as any[],
    particles: [] as any[],
    debris: [] as any[],
    CARRIER: {} as any,
    BOATS: [] as any[],
    SUBMARINES: [] as any[],
    RESEARCH_PLATFORMS: [] as any[],
    WIND_TURBINES: [] as any[],
    PLANE_WRECKS: [] as any[],
    BROKEN_SAILBOATS: [] as any[],
    seaTime: 0,
    payloads: [] as any[],
    activePayload: null as any,
    rescuerSwing: { x: 0, y: 0, vx: 0, vy: 0 },
    npcHelis: [] as NpcHeli[],
    deliverMode: false,
    heli: {
        type: 'dolphin',
        x: 0,
        y: 0,
        z: 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        angle: 0,
        tilt: 0,
        roll: 0,
        winch: 0,
        fuel: 100,
        engineOn: false,
        rotorRPM: 0,
        rotationPos: 0,
        onboard: 0,
        maxLoad: 5,
        accel: 0.0025,
        friction: 0.99,
        tiltSpeed: 0.02,
        fuelRate: 0.012,
        liftPower: 0.003,
        inAir: false,
        cargoResist: 1.0,
    },
    wind: { x: 0, y: 0, phase: 0, angle: Math.random() * Math.PI * 2, varOffset: 0 } as any,
    keys: {} as Record<string, boolean>,
    flocks: [] as any[],
    TREES_MAP: null as any,
    PAD: null as any,
    START_POS: null as any,
    fuelTruck: {
        state: 'PARKED',
        x: 0,
        y: 0,
        angle: 0,
        arm: 0,
        localParkX: 0,
        localParkY: 0,
        localParkAngle: 0,
        t: 0,
        wps: null as { lx: number; ly: number }[] | null,
        wpI: 0,
    },
    carrierFuelCar: {
        state: 'PARKED' as 'PARKED' | 'DRIVING' | 'FUELING' | 'RETURNING',
        x: 0,
        y: 0,
        angle: Math.PI / 2 + 0.25 + Math.PI,
        // fixed local position on carrier deck (white tractor slot)
        localParkX: 2.8,
        localParkY: 2.7,
        // car.angle = front/drive direction (like ft.angle); body = car.angle + PI
        localParkAngle: Math.PI / 2 + 0.25 + Math.PI,
        t: 0,
        wps: null as { lx: number; ly: number }[] | null,
        wpI: 0,
    },
    /** Remote player's heli – set when multiplayer is active, null otherwise */
    remoteHeli: null as RemoteHeli | null,
};

export type GameState = typeof G;
