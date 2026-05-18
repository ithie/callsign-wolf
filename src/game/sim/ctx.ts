export interface PhysicsCtx {
    windStr: number;
    windDir: number;
    windVar: boolean;
    hasPad: boolean;
    hasCarrier: boolean;
    isTutorialMode?: boolean;
    partyMode?: boolean;
    partyPalette?: readonly string[];
    showMsg: (txt: string) => void;
    missionComplete: () => void;
    triggerCrash: (reason: string) => void;
    orniWreckDelivered: () => void;
}
