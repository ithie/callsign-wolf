declare global {
    interface Window {
        launchEasterEgg:    () => void;
        toCampaignSelect:   () => void;
        toMainMenu:         () => void;
        toCredits:          () => void;
        backFromHeliSelect: () => void;
        returnToBase:       () => void;
        selectCampaign:     (index: string) => void;
        selectMission:      (index: number) => void;
        startGame:          (type: string) => void;
        toSettings:         () => void;
        approveCookies:     () => void;
        declineCookies:     () => void;
        confirmDeleteSession: () => void;
    }
}

export {};
