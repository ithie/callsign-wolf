import { init, mount, show } from './rankup';
import { createDrawObjects } from '../../draw-objects';
import { iso } from '../../render';
import { tileW, tileH, stepH } from '../../render-config';
import { RANKS } from '../../session';

const _setup = () => {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const cx = c.getContext('2d')!;
    const isoFn = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
    const sr = { add: () => {}, flush: () => {}, debugAltitude: false };
    const { drawHeli } = createDrawObjects(cx, isoFn, tileW, tileH, sr as any);
    init(drawHeli);
    mount();
};

export const ZumOberleutnant = () => { _setup(); show(RANKS[1]); };
export const ZumHauptmannMitHeli = () => { _setup(); show(RANKS[2], 'chinook'); };
export const ZumMajor = () => { _setup(); show(RANKS[3]); };
