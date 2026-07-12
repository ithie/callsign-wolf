import { HELI_TYPES } from './heli-types';
import { VEHICLE_STATE, VehicleState, NpcHeliState } from '../shared/types';
import type { Particle, DebrisPiece, Flock, ParticleEmitter, WindState } from './sim/particles/ctx';

// ─── NPC heli ─────────────────────────────────────────────────────────────────
export interface NpcHeli {
    type: string;
    x: number; y: number; z: number;
    angle: number;
    tilt: number; roll: number;
    rotorRPM: number;
    rotationPos: number;
    state: NpcHeliState;
    autoTakeoff: boolean;
    parkXRel: number; parkYRel: number; parkAngle: number;
    waypoints: { x: number; y: number }[];
    wpI: number;
    cruiseZ: number;
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
    completedObjectives: new Set<string>(),
    menuHover: Object.fromEntries(HELI_TYPES.map(h => [h.id, false])),
    menuAngles: Object.fromEntries(HELI_TYPES.map(h => [h.id, -0.5])),
    points: [] as any[],
    sandPoints: [] as number[][],
    pavementPoints: [] as number[][],
    particles: [] as Particle[],
    debris: [] as DebrisPiece[],
    CARRIER: {} as any,
    BOATS: [] as any[],
    SUBMARINES: [] as any[],
    RESEARCH_PLATFORMS: [] as any[],
    WIND_TURBINES: [] as any[],
    PARTICLE_EMITTERS: [] as ParticleEmitter[],
    LANDING_ZONES: [] as { xMin: number; xMax: number; yMin: number; yMax: number; z: number }[],
    PLANE_WRECKS: [] as any[],
    BOAT_WRECKS: [] as { x: number; y: number; angle: number }[],
    ORNI_RESIDUES: [] as { x: number; y: number; angle: number }[],
    BROKEN_SAILBOATS: [] as any[],
    BAYWATCH_CARS: [] as any[],
    BAYWATCH_BUILDINGS: [] as any[],
    BUOYS: [] as any[],
    CONCERT_STAGES: [] as any[],
    FESTIVAL_TENTS: [] as any[],
    FESTIVAL_CARS: [] as any[],
    XMAS_HOUSES: [] as any[],
    XMAS_LANTERNS: [] as any[],
    SLEIGHS: [] as any[],
    REINDEER_OBJECTS: [] as any[],
    RINGS: [] as { x: number; y: number; z: number; radius: number; angle: number; flown: boolean; _lastD: number }[],
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
        vAngle: 0,
        tilt: 0,
        roll: 0,
        winch: 0,
        fuel: 100,
        engineOn: false,
        rotorRPM: 0,
        rotationPos: 0,
        onboard: 0,
        onboardDeliverQueue: [] as (string | undefined)[],
        maxLoad: 5,
        accel: 0.0025,
        friction: 0.99,
        tiltSpeed: 0.02,
        fuelRate: 0.012,
        liftPower: 0.003,
        inAir: false,
        cargoResist: 1.0,
    },
    wind: { x: 0, y: 0, phase: 0, angle: Math.random() * Math.PI * 2, varOffset: 0, rawStr: 0 } satisfies WindState,
    keys: {} as Record<string, boolean>,
    flocks: [] as Flock[],
    TREES_MAP: null as any,
    PAD: null as any,
    START_POS: null as any,
    fuelTruck: {
        state: VEHICLE_STATE.PARKED as VehicleState,
        x: 0,
        y: 0,
        angle: 0,
        arm: 0,
        steerAngle: 0,
        localParkX: 0,
        localParkY: 0,
        localParkAngle: 0,
        t: 0,
        wps: null as { lx: number; ly: number }[] | null,
    },
    carrierFuelCar: {
        state: VEHICLE_STATE.PARKED as VehicleState,
        x: 0,
        y: 0,
        angle: Math.PI / 2 + 0.25 + Math.PI,
        // fixed local position on carrier deck (white tractor slot)
        localParkX: 2.8,
        localParkY: 2.7,
        // car.angle = front/drive direction (like ft.angle); body = car.angle + PI
        localParkAngle: Math.PI / 2 + 0.25 + Math.PI,
        t: 0,
        steerAngle: 0,
        wps: null as { lx: number; ly: number }[] | null,
    },

};

export type GameState = typeof G;
