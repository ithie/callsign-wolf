import { mount, show } from './briefing';

export const RettungseinsatzVoll = () => {
    mount();
    show({
        headline: { de: 'Mission 1: Nordsee-Alarm', en: 'Mission 1: North Sea Alert', fr: 'Mission 1 : Alerte Mer du Nord', es: 'Misión 1: Alerta Mar del Norte', pt: 'Missão 1: Alerta Mar do Norte' },
        sublines: [
            { de: '3 Personen in Seenot', en: '3 persons in distress', fr: '3 personnes en détresse', es: '3 personas en peligro', pt: '3 pessoas em perigo' },
            { de: 'Zeitlimit: 8 Minuten', en: 'Time limit: 8 minutes', fr: 'Limite de temps : 8 minutes', es: 'Límite de tiempo: 8 minutos', pt: 'Limite de tempo: 8 minutos' },
        ],
        briefing: {
            de: 'Ein Fischerboot kenterte 12 sm nordwestlich des Hafens. Drei Besatzungsmitglieder treiben im Wasser. Wetterbedingungen: Windstärke 6, aufkommender Seegang. Handeln Sie sofort.',
            en: 'A fishing vessel capsized 12 nm north-west of port. Three crew members are adrift. Conditions: force 6 winds, building swell. Act immediately.',
            fr: 'Un bateau de pêche a chaviré à 12 nm au nord-ouest du port. Trois membres d\'équipage dérivent. Conditions : vent force 6, mer agitée. Agissez immédiatement.',
            es: 'Un barco pesquero volcó a 12 nm al noroeste del puerto. Tres tripulantes están a la deriva. Condiciones: viento fuerza 6, marejada creciente. Actúe de inmediato.',
            pt: 'Um barco de pesca naufragou a 12 nm a noroeste do porto. Três tripulantes estão à deriva. Condições: vento força 6, ondulação crescente. Aja imediatamente.',
        },
        address: 'alpha',
    }, () => {});
};

export const NurHeadline = () => {
    mount();
    show({ headline: { de: 'Freier Flug', en: 'Free Flight', fr: 'Vol libre', es: 'Vuelo libre', pt: 'Voo livre' }, sublines: [], briefing: undefined, address: '' }, () => {});
};

export const MitSublines = () => {
    mount();
    show({
        headline: { de: 'Mission 3: Arktis-Bergung', en: 'Mission 3: Arctic Recovery', fr: 'Mission 3 : Récupération Arctique', es: 'Misión 3: Rescate Ártico', pt: 'Missão 3: Resgate Ártico' },
        sublines: [
            { de: '5 Verwundete am Eisrand', en: '5 wounded at the ice edge', fr: '5 blessés au bord de la glace', es: '5 heridos en el borde del hielo', pt: '5 feridos na beira do gelo' },
            { de: 'Crate-Lieferung erforderlich', en: 'Crate delivery required', fr: 'Livraison de cargaison requise', es: 'Entrega de carga requerida', pt: 'Entrega de carga necessária' },
            { de: 'Treibstoff knapp – sofort starten', en: 'Fuel low – launch immediately', fr: 'Carburant faible – décollez immédiatement', es: 'Combustible bajo – despegue inmediatamente', pt: 'Combustível baixo – parta imediatamente' },
        ],
        briefing: undefined,
        address: 'bravo',
    }, () => {});
};
