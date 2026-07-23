// ── Physics Context ───────────────────────────────────────────────────────────
// Factory for the PhysicsCtx bridge consumed by updatePhysics() in simulation.ts.
// All game-flow callbacks are injected so this file stays free of circular deps.

import { isTutorialRunning, isTutorialFuelLocked } from './ui/tutorial/tutorial';
import type { PhysicsCtx } from './sim/ctx';

export interface PhysicsCtxDeps {
    getMissionState: () => {
        windStr: number;
        windDir: number;
        windVar: boolean;
        hasPad: boolean;
        hasCarrier: boolean;
        snow: boolean;
        padPayloadRefill: boolean;
    };
    isTutorialMode: () => boolean;
    getMissionComplete: () => () => void;
    getTriggerCrash: () => () => void;
    orniWreckDelivered: () => void;
    onBoatTurbineCollision: (boatIdx: number, wtIdx: number) => void;
}

export const createPhysicsCtx = (deps: PhysicsCtxDeps): PhysicsCtx => ({
    get windStr()          { return deps.getMissionState().windStr; },
    get windDir()          { return deps.getMissionState().windDir; },
    get windVar()          { return deps.getMissionState().windVar; },
    get hasPad()           { return deps.getMissionState().hasPad; },
    get hasCarrier()       { return deps.getMissionState().hasCarrier; },
    get snow()             { return deps.getMissionState().snow; },
    get padPayloadRefill() { return deps.getMissionState().padPayloadRefill; },
    get isTutorialMode()   { return deps.isTutorialMode(); },
    get isTutorialFuelLocked() { return isTutorialFuelLocked(); },
    get missionComplete() {
        if (isTutorialRunning()) return () => {};
        return deps.getMissionComplete();
    },
    get triggerCrash() {
        return deps.getTriggerCrash();
    },
    orniWreckDelivered:       deps.orniWreckDelivered,
    onBoatTurbineCollision:   deps.onBoatTurbineCollision,
} as PhysicsCtx);
