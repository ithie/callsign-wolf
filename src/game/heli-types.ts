// ─── Heli Type Definitions ────────────────────────────────────────────────────
// Single source of truth for all helicopter variants.
// The game logic must not contain any `if (type === 'coasthawk')` etc.
// Import HELI_TYPES and use getHeliType(id) instead.

import type { DEF } from './defs';
import COASTHAWK_DEF from './models/coasthawk.zdef';
import DOLPHIN_DEF from './models/dolphin.zdef';
import ATLAS_DEF from './models/atlas.zdef';
import ORNITHOPTER_RAW from './models/ornithopter.zdef';

export interface HeliType {
    id: string;
    label: string;
    def: DEF;
    // Physics
    maxLoad: number;
    accel: number;
    friction: number;
    tiltSpeed: number;
    fuelRate: number;
    liftPower: number;
    cargoResist: number;
    // Rendering
    scale: number; // drawHeli geometry scale
    previewScale: number; // scale for menu icon canvas
    // Collision box (local coords, zMax relative to heli.z)
    collisionBox: { xMin: number; xMax: number; yMin: number; yMax: number; zMax: number };
    // Local-x offsets of rotor hubs (for particles/sound). Single-rotor helis: [0].
    rotorOffsets: number[];
    // Extra rotor debris piece on crash (atlas)
    extraRotorDebris: boolean;
    // Whether this heli can carry cargo crates
    canCarryCargo: boolean;
    // Select screen display
    selectLabel: string; // e.g. "DOLPHIN"
    selectSub: string; // e.g. "Agile / Fast"
    selectCap: string; // e.g. "Cap: 3 (Lightweight)"
    description?: string;
    // Minimum rank index required to fly this type (0=Leutnant, 1=Oberleutnant, 2=Hauptmann)
    minRankIndex: number;
    /** If true, this type is completely hidden in the selection screen when locked (instead of greyed out) */
    hideWhenLocked?: boolean;
}

export const HELI_TYPES: HeliType[] = [
    {
        id: 'dolphin',
        label: 'Dolphin',
        def: DOLPHIN_DEF,
        maxLoad: 3,
        accel: 0.00117,
        friction: 0.995,
        tiltSpeed: 0.05,
        fuelRate: 0.012,
        liftPower: 0.0009,
        cargoResist: 0.5,
        scale: 0.7,
        previewScale: 1.43,
        collisionBox: { xMin: -1.26, xMax: 1.26, yMin: -0.28, yMax: 0.28, zMax: 0.56 },
        rotorOffsets: [0],
        extraRotorDebris: false,
        canCarryCargo: false,
        selectLabel: 'DOLPHIN',
        selectSub: 'Wendig / Schnell',
        selectCap: 'Kap.: 3 (Leichtgewicht)',
        description:
            'Ein wendiger Küstenwachthubschrauber — ideal für schnelle Einsätze in schwierigem Gelände. Leicht, präzise, reaktionsschnell. Das bevorzugte Werkzeug erfahrener Piloten.',
        minRankIndex: 1,
    },
    {
        id: 'coasthawk',
        label: 'Coast-Hawk',
        def: COASTHAWK_DEF,
        maxLoad: 10,
        accel: 0.000502,
        friction: 0.998,
        tiltSpeed: 0.015,
        fuelRate: 0.007,
        liftPower: 0.0005,
        cargoResist: 0.1,
        scale: 1.0,
        previewScale: 1.0,
        collisionBox: { xMin: -3.0, xMax: 1.3, yMin: -0.5, yMax: 0.5, zMax: 1.3 },
        rotorOffsets: [0],
        extraRotorDebris: false,
        canCarryCargo: true,
        selectLabel: 'Coast-Hawk',
        selectSub: 'Schwer / Stabil',
        selectCap: 'Kap.: 10 (Schwerlast)',
        description:
            'Das Arbeitstier der Seenotrettung. Trägt schwere Lasten über weite Strecken, auch bei rauem Wetter. Einmal in Fahrt gebracht, ist er schwer aufzuhalten.',
        minRankIndex: 0,
    },
    {
        id: 'atlas',
        label: 'Atlas',
        def: ATLAS_DEF,
        maxLoad: 20,
        accel: 0.000212,
        friction: 0.9992,
        tiltSpeed: 0.01,
        fuelRate: 0.005,
        liftPower: 0.0004,
        cargoResist: 0.05,
        scale: 1.0,
        previewScale: 1.0,
        collisionBox: { xMin: -2.6, xMax: 2.8, yMin: -0.6, yMax: 0.6, zMax: 1.8 },
        rotorOffsets: [1.5, -2.3],
        extraRotorDebris: true,
        canCarryCargo: true,
        selectLabel: 'Atlas',
        selectSub: 'Tandem / Extraschwer',
        selectCap: 'Kap.: 20 (Schwerlast)',
        description:
            'Zwei Rotoren, keine Ausrede. Der Atlas ist für den Masseneinsatz gebaut — wenn normale Helikopter kapitulieren, fliegt der Atlas.',
        minRankIndex: 2,
    },
    {
        id: 'ornithopter',
        label: 'Ornithopter',
        def: ORNITHOPTER_RAW as unknown as DEF,
        maxLoad: 2,
        accel: 0.00145,
        friction: 0.993,
        tiltSpeed: 0.045,
        fuelRate: 0.009,
        liftPower: 0.00082,
        cargoResist: 0.25,
        scale: 0.7,
        previewScale: 1.43,
        collisionBox: { xMin: -1.6, xMax: 0.9, yMin: -0.35, yMax: 0.35, zMax: 0.55 },
        rotorOffsets: [0],
        extraRotorDebris: false,
        canCarryCargo: true,
        selectLabel: 'ORNITHOPTER',
        selectSub: 'Schläger / Wendig',
        selectCap: 'Kap.: 2 (Schnelleinsatz)',
        description:
            'Ein Flügelschläger der nächsten Generation. Zwei Mann, maximale Wendigkeit. Mit Fracht überraschend schnell — kein Helikopter, kein Flugzeug, etwas dazwischen.',
        minRankIndex: 3,
        hideWhenLocked: true,
    },
];

export function getHeliType(id: string): HeliType {
    const ht = HELI_TYPES.find(h => h.id === id);
    if (!ht) throw new Error(`Unknown heli type: ${id}`);
    return ht;
}
