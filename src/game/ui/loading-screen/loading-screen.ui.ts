import { show } from './loading-screen';

export const LadeKampagne = () => {
    const h = show('Mission wird geladen…');
    h.step('Terrain', 0.3);
    setTimeout(() => h.step('Objekte', 0.6), 600);
    setTimeout(() => h.step('Fertig', 1.0), 1200);
};

