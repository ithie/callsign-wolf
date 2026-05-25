import { init, mount, show } from './heli-select';
import { createDrawObjects } from '../../draw-objects';
import { iso } from '../../render';
import { tileW, tileH, stepH } from '../../render-config';
import { HELI_TYPES } from '../../heli-types';

const _setup = () => {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const cx = c.getContext('2d')!;
    const isoFn = (wx: number, wy: number, wz: number, camX: number, camY: number) =>
        iso(wx, wy, wz, camX, camY, { canvas: c, tileW, tileH, stepH });
    const sr = { add: () => {}, flush: () => {} };
    const { drawHeli } = createDrawObjects(cx, isoFn, tileW, tileH, sr as any);
    const G = { menuAngles: Object.fromEntries(HELI_TYPES.map(ht => [ht.id, -0.075])) };
    init(G, drawHeli);
    mount();
};

export const RangLeutnant = () => { _setup(); show({ rankIndex: 0, onSelect: () => {}, onBack: () => {} }); };
export const RangHauptmann = () => { _setup(); show({ rankIndex: 2, onSelect: () => {}, onBack: () => {} }); };
export const RangMajor = () => { _setup(); show({ rankIndex: 3, onSelect: () => {}, onBack: () => {} }); };
