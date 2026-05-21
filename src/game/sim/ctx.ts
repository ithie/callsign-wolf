export interface PhysicsCtx {
    windStr: number;
    windDir: number;
    windVar: boolean;
    hasPad: boolean;
    hasCarrier: boolean;
    isTutorialMode?: boolean;
    isTutorialFuelLocked?: boolean;
    partyMode?: boolean;
    partyPalette?: readonly string[];
    showMsg: (txt: string) => void;
    missionComplete: () => void;
    triggerCrash: () => void;
    orniWreckDelivered: () => void;
}
