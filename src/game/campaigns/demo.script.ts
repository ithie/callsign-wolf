import { defineCampaignScript } from '@/game/script';
import type { DemoObjects } from './demo.script-objects';

export default defineCampaignScript<DemoObjects>({
    // Test map for drift, contact and collapse: the vessel drifts sideways into the
    // smoking turbine, both collapse and the smoke keeps rising from the rubble.
    absetz_test: async ({ object, wait, mission }) => {
        const versorger = object('versorger');
        const wt2 = object('wt2');

        versorger.speed = 3;
        versorger.course = versorger.bearingTo(wt2);

        versorger.onTouch(wt2, () => {
            versorger.destroy();
            wt2.destroy();
            mission.message({
                de: 'Kollision! Windrad 2 ist eingestürzt.',
                en: 'Collision! Turbine 2 has collapsed.',
                fr: 'Collision ! L’éolienne 2 s’est effondrée.',
                es: '¡Colisión! El aerogenerador 2 se ha derrumbado.',
                pt: 'Colisão! A turbina 2 desabou.',
            });
        });

        await wait(3);
        versorger.radio({
            de: 'Mayday! Wir treiben manövrierunfähig auf Windrad 2 zu!',
            en: 'Mayday! We are adrift and heading for turbine 2!',
            fr: 'Mayday ! Nous dérivons sans contrôle vers l’éolienne 2 !',
            es: '¡Mayday! ¡Vamos a la deriva sin control hacia el aerogenerador 2!',
            pt: 'Mayday! Estamos à deriva, sem controle, rumo à turbina 2!',
        });
    },
});
