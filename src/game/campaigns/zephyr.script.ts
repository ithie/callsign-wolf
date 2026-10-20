import { defineCampaignScript } from '@/game/script';
import type { ZephyrObjects } from './zephyr.script-objects';

export default defineCampaignScript<ZephyrObjects>({
    // The supply vessel has lost propulsion and drifts sideways onto the burning turbine.
    ikarus: async ({ object, wait, mission }) => {
        const versorger = object('versorger');
        const wt2 = object('wt2');

        versorger.speed = 3;
        versorger.course = versorger.bearingTo(wt2);

        versorger.onTouch(wt2, () => {
            versorger.destroy();
            wt2.destroy();
            mission.fail({
                de: 'Der Versorger ist mit dem Windrad kollidiert.',
                en: 'The supply vessel collided with the wind turbine.',
                fr: 'Le navire de ravitaillement a heurté l’éolienne.',
                es: 'El buque de suministro chocó contra el aerogenerador.',
                pt: 'O navio de abastecimento colidiu com a turbina eólica.',
            });
        });

        await wait(5);
        versorger.radio({
            de: 'Mayday, Mayday! Antrieb ausgefallen, wir treiben auf die Windräder zu!',
            en: 'Mayday, mayday! Propulsion lost, we are drifting towards the turbines!',
            fr: 'Mayday, mayday ! Plus de propulsion, nous dérivons vers les éoliennes !',
            es: '¡Mayday, mayday! Sin propulsión, ¡vamos a la deriva hacia los aerogeneradores!',
            pt: 'Mayday, mayday! Sem propulsão, estamos à deriva em direção às turbinas!',
        });
    },
});
