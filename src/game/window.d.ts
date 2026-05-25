declare global {
    interface Window {
        toCampaignSelect:   () => void;
        toMainMenu:         () => void;
        toCredits:          () => void;
        backFromHeliSelect: () => void;
        returnToBase:       () => void;
        selectCampaign:     (index: string) => void;
        selectMission:      (index: number) => void;
        startGame:          (type: string) => void;
        toSettings:         () => void;
        confirmDeleteSession: () => void;
    }
}

export {};
