// ─── Particle types ────────────────────────────────────────────────────────────
export type Particle = {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    gravity?: number;
    life: number;
    maxLife?: number;
    size?: number;
    color: string;
    isSmoke?: boolean;
    isFire?: boolean;
    isMetal?: boolean;
    isConfetti?: boolean;
};

export type DebrisPiece = {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    gravity?: number;
    angle: number;
    av: number;
    w: number; h: number;
    color: string; stroke: string;
    life: number;
    bounced: boolean;
};

export type Bird = {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    wingPhase: number;
};

export type Flock = {
    birds: Bird[];
    fleeing: boolean;
    fleeTimer: number;
};

export type EmitterParticle = {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
    isSmoke: boolean;
    isFire?: boolean;
};

export type ParticleEmitter = {
    x: number; y: number; gz: number;
    type: 'fire' | 'smoke' | 'chimney' | 'wreck_smoke';
    radius?: number;
    particles: EmitterParticle[];
    spawnTimer: number;
};

// ─── Minimal structural refs (no import from state.ts → no circular dep) ───────
export type HeliRef = {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    type: string; angle: number; rotorRPM: number;
};

export type WindState = {
    x: number; y: number;
    angle: number;
    phase: number;
    varOffset: number;
    rawStr: number;
};

// ─── Context + interface ───────────────────────────────────────────────────────
export type ParticlesCtx = {
    particles: Particle[];
    debris: DebrisPiece[];
    flocks: Flock[];
    emitters: ParticleEmitter[];
    heli: HeliRef;
    wind: WindState;
    waterLevel: number;
    gridSize: number;
    getGround: (x: number, y: number) => number;
    getHeliType: (type: string) => any;
};

export type ParticleSystemArgs = { ctx: ParticlesCtx; dt: number };

export type ParticleSystem = {
    init?: (args: ParticleSystemArgs) => void;
    update: (args: ParticleSystemArgs) => void;
};
