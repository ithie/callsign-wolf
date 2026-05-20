import { mount, show } from './briefing';

export const RettungseinsatzVoll = () => {
    mount();
    show({
        headline: { de: 'Mission 1: Nordsee-Alarm', en: 'Mission 1: North Sea Alert' },
        sublines: [
            { de: '3 Personen in Seenot', en: '3 persons in distress' },
            { de: 'Zeitlimit: 8 Minuten', en: 'Time limit: 8 minutes' },
        ],
        briefing: {
            de: 'Ein Fischerboot kenterte 12 sm nordwestlich des Hafens. Drei Besatzungsmitglieder treiben im Wasser. Wetterbedingungen: Windstärke 6, aufkommender Seegang. Handeln Sie sofort.',
            en: 'A fishing vessel capsized 12 nm north-west of port. Three crew members are adrift. Conditions: force 6 winds, building swell. Act immediately.',
        },
        address: 'alpha',
    }, () => {});
};

export const NurHeadline = () => {
    mount();
    show({ headline: { de: 'Freier Flug', en: 'Free Flight' }, sublines: [], briefing: undefined, address: '' }, () => {});
};

export const MitSublines = () => {
    mount();
    show({
        headline: { de: 'Mission 3: Arktis-Bergung', en: 'Mission 3: Arctic Recovery' },
        sublines: [
            { de: '5 Verwundete am Eisrand', en: '5 wounded at the ice edge' },
            { de: 'Crate-Lieferung erforderlich', en: 'Crate delivery required' },
            { de: 'Treibstoff knapp – sofort starten', en: 'Fuel low – launch immediately' },
        ],
        briefing: undefined,
        address: 'bravo',
    }, () => {});
};
