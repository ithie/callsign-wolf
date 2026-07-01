export interface PhysicsCtx {
    windStr: number;
    windDir: number;
    windVar: boolean;
    hasPad: boolean;
    hasCarrier: boolean;
    snow?: boolean;
    padPayloadRefill?: boolean;
    isTutorialMode?: boolean;
    isTutorialFuelLocked?: boolean;
    missionComplete: () => void;
    triggerCrash: () => void;
    orniWreckDelivered: () => void;
    onBoatTurbineCollision?: (boatIdx: number, wtIdx: number) => void;
}
