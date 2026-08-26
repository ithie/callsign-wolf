// ─── Heli Type Definitions ────────────────────────────────────────────────────
// Single source of truth for all helicopter variants.
// The game logic must not contain any `if (type === 'coasthawk')` etc.
// Import HELI_TYPES and use getHeliType(id) instead.

import type { DEF } from './defs';
import COASTHAWK_DEF from './models/coasthawk.zdef';
import DOLPHIN_DEF from './models/dolphin.zdef';
import ATLAS_DEF from './models/atlas.zdef';
import ORNITHOPTER_RAW from './models/ornithopter.zdef';
import SPINNER_RAW from './models/spinner.zdef';

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
    selectSub: string | { de: string; en: string; fr?: string; es?: string; pt?: string };
    selectCap: string | { de: string; en: string; fr?: string; es?: string; pt?: string };
    description?: string | { de: string; en?: string; fr?: string; es?: string; pt?: string };
    // Minimum rank index required to fly this type (0=Leutnant, 1=Oberleutnant, 2=Hauptmann)
    minRankIndex: number;
    /** If true, player must also complete the type-rating parkour before flying this heli */
    typeRatingRequired?: boolean;
    /** If true, this type is completely hidden in the selection screen when locked (instead of greyed out) */
    hideWhenLocked?: boolean;
    /** Sound synthesis profile: rotor-oscillator or ornithopter wing-flap. */
    soundProfile: 'rotor' | 'ornithopter';
    /** Number of rotor blades (used for blade-pass frequency). 0 for non-rotor types. */
    bladeCount: number;
    /** Rotor sound preset: [clipAmount, filterCutHz, filterQ]. Unused for non-rotor types. */
    audioPreset: [number, number, number];
    /** If true, heli can land on any terrain without crashing and picks up persons on ground contact */
    canGroundDrive?: boolean;
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
        cargoResist: 0.35,
        scale: 0.7,
        previewScale: 1.43,
        collisionBox: { xMin: -1.26, xMax: 1.26, yMin: -0.28, yMax: 0.28, zMax: 0.56 },
        rotorOffsets: [0],
        extraRotorDebris: false,
        canCarryCargo: false,
        selectLabel: 'DOLPHIN',
        selectSub: { de: 'Wendig / Schnell', en: 'Agile / Fast', fr: 'Agile / Rapide', es: 'Ágil / Rápido', pt: 'Ágil / Rápido' },
        selectCap: { de: 'Kap.: 3 (Leichtgewicht)', en: 'Cap.: 3 (Lightweight)', fr: 'Cap. : 3 (Légèreté)', es: 'Cap.: 3 (Peso ligero)', pt: 'Cap.: 3 (Leve)' },
        description: {
            de: 'Ein wendiger Küstenwachthubschrauber — ideal für schnelle Einsätze in schwierigem Gelände. Leicht, präzise, reaktionsschnell. Das bevorzugte Werkzeug erfahrener Piloten.',
            en: 'An agile coast guard helicopter — ideal for rapid deployment in difficult terrain. Light, precise, responsive. The preferred tool of experienced pilots.',
            fr: 'Un hélicoptère de garde-côtes agile — idéal pour les interventions rapides en terrain difficile. Léger, précis, réactif. L\'outil préféré des pilotes expérimentés.',
            es: 'Un helicóptero de guardacostas ágil — ideal para despliegues rápidos en terreno difícil. Ligero, preciso, reactivo. La herramienta preferida de los pilotos experimentados.',
            pt: 'Um helicóptero ágil da guarda costeira — ideal para missões rápidas em terreno difícil. Leve, preciso, responsivo. A ferramenta preferida dos pilotos experientes.',
        },
        minRankIndex: 1,
        typeRatingRequired: true,
        soundProfile: 'rotor',
        bladeCount: 4,
        audioPreset: [3.0, 120, 2.5],
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
        selectSub: { de: 'Schwer / Stabil', en: 'Heavy / Stable', fr: 'Lourd / Stable', es: 'Pesado / Estable', pt: 'Pesado / Estável' },
        selectCap: { de: 'Kap.: 10 (Schwerlast)', en: 'Cap.: 10 (Heavy lift)', fr: 'Cap. : 10 (Charges lourdes)', es: 'Cap.: 10 (Carga pesada)', pt: 'Cap.: 10 (Carga pesada)' },
        description: {
            de: 'Das Arbeitstier der Seenotrettung. Trägt schwere Lasten über weite Strecken, auch bei rauem Wetter. Einmal in Fahrt gebracht, ist er schwer aufzuhalten.',
            en: 'The workhorse of maritime rescue. Carries heavy loads over long distances, even in rough weather. Once up to speed, it is hard to stop.',
            fr: 'Le cheval de bataille du sauvetage maritime. Transporte de lourdes charges sur de longues distances, même par mauvais temps. Une fois lancé, rien ne l\'arrête.',
            es: 'El caballo de batalla del rescate marítimo. Transporta cargas pesadas a largas distancias, incluso con mal tiempo. Una vez en marcha, es difícil de parar.',
            pt: 'O cavalo de trabalho do resgate marítimo. Transporta cargas pesadas em longas distâncias, mesmo com mau tempo. Uma vez em movimento, é difícil de parar.',
        },
        minRankIndex: 0,
        soundProfile: 'rotor',
        bladeCount: 4,
        audioPreset: [3.0, 110, 2.5],
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
        selectSub: { de: 'Tandem / Extraschwer', en: 'Tandem / Extra-heavy', fr: 'Tandem / Extra-lourd', es: 'Tándem / Superpesado', pt: 'Tândem / Extra-pesado' },
        selectCap: { de: 'Kap.: 20 (Schwerlast)', en: 'Cap.: 20 (Heavy lift)', fr: 'Cap. : 20 (Charges lourdes)', es: 'Cap.: 20 (Carga pesada)', pt: 'Cap.: 20 (Carga pesada)' },
        description: {
            de: 'Zwei Rotoren, keine Ausrede. Der Atlas ist für den Masseneinsatz gebaut — wenn normale Helikopter kapitulieren, fliegt der Atlas.',
            en: 'Two rotors, no excuses. The Atlas is built for mass operations — when ordinary helicopters give up, the Atlas flies on.',
            fr: 'Deux rotors, pas d\'excuses. L\'Atlas est conçu pour les opérations massives — quand les hélicoptères ordinaires abandonnent, l\'Atlas continue de voler.',
            es: 'Dos rotores, sin excusas. El Atlas está construido para operaciones masivas — cuando los helicópteros ordinarios se rinden, el Atlas sigue volando.',
            pt: 'Dois rotores, sem desculpas. O Atlas foi construído para operações em massa — quando os helicópteros comuns desistem, o Atlas continua voando.',
        },
        minRankIndex: 2,
        typeRatingRequired: true,
        soundProfile: 'rotor',
        bladeCount: 3,
        audioPreset: [4.0, 90, 3.0],
    },
    {
        id: 'spinner',
        label: 'Spinner',
        def: SPINNER_RAW as unknown as DEF,
        maxLoad: 3,
        accel: 0.00130,
        friction: 0.994,
        tiltSpeed: 0.048,
        fuelRate: 0.010,
        liftPower: 0.00085,
        cargoResist: 0.28,
        scale: 0.75,
        previewScale: 1.4,
        collisionBox: { xMin: -0.68, xMax: 1.35, yMin: -0.68, yMax: 0.68, zMax: 0.64 },
        rotorOffsets: [0],
        extraRotorDebris: false,
        canCarryCargo: false,
        selectLabel: 'SPINNER',
        selectSub: { de: 'Fliegend / Fahrend', en: 'Flying / Driving', fr: 'Vol / Conduite', es: 'Volando / Conduciendo', pt: 'Voando / Dirigindo' },
        selectCap: { de: 'Kap.: 3 (Hybrid)', en: 'Cap.: 3 (Hybrid)', fr: 'Cap. : 3 (Hybride)', es: 'Cap.: 3 (Híbrido)', pt: 'Cap.: 3 (Híbrido)' },
        description: {
            de: 'Der Polizei-Spinner hat schon Deckhard und McCoy gute Dienste geleistet.',
            en: 'This police spinner has served Deckhard and McCoy well.',
            fr: 'Ce spinner de police a bien servi Deckhard et McCoy.',
            es: 'Este spinner policial le ha servido bien a Deckhard y McCoy.',
            pt: 'Este spinner policial prestou bons serviços a Deckhard e McCoy.',
        },
        minRankIndex: 3,
        hideWhenLocked: true,
        soundProfile: 'rotor',
        bladeCount: 6,
        audioPreset: [1.0, 300, 1.6],
        canGroundDrive: true,
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
        selectSub: { de: 'Schläger / Wendig', en: 'Flapper / Agile', fr: 'Batteur / Agile', es: 'Batidor / Ágil', pt: 'Batedor / Ágil' },
        selectCap: { de: 'Kap.: 2 (Schnelleinsatz)', en: 'Cap.: 2 (Quick deploy)', fr: 'Cap. : 2 (Déploiement rapide)', es: 'Cap.: 2 (Despliegue rápido)', pt: 'Cap.: 2 (Implantação rápida)' },
        description: {
            de: 'Ein Flügelschläger der nächsten Generation. Zwei Mann, maximale Wendigkeit. Mit Fracht überraschend schnell — kein Helikopter, kein Flugzeug, etwas dazwischen.',
            en: 'A next-generation ornithopter. Two crew, maximum agility. Surprisingly fast with cargo — not a helicopter, not a plane, something in between.',
            fr: 'Un ornithoptère de nouvelle génération. Deux membres d\'équipage, agilité maximale. Étonnamment rapide avec du fret — ni hélicoptère, ni avion, quelque chose entre les deux.',
            es: 'Un ornitóptero de nueva generación. Dos tripulantes, agilidad máxima. Sorprendentemente rápido con carga — ni helicóptero, ni avión, algo entre los dos.',
            pt: 'Um ornitóptero de nova geração. Dois tripulantes, agilidade máxima. Surpreendentemente rápido com carga — nem helicóptero, nem avião, algo entre os dois.',
        },
        minRankIndex: 3,
        typeRatingRequired: true,
        hideWhenLocked: true,
        soundProfile: 'ornithopter',
        bladeCount: 0,
        audioPreset: [0, 0, 0],
    },
];

export const getHeliType = (id: string): HeliType => {
    const ht = HELI_TYPES.find(h => h.id === id);
    if (!ht) throw new Error(`Unknown heli type: ${id}`);
    return ht;
}
