export interface PhysicsCtx {
    windStr: number;
    windDir: number;
    windVar: boolean;
    hasPad: boolean;
    hasCarrier: boolean;
    isTutorialMode?: boolean;
    isTutorialFuelLocked?: boolean;
    missionComplete: () => void;
    triggerCrash: () => void;
    orniWreckDelivered: () => void;
}
