import { init, mount, show } from './rankup';
import { RANKS } from '../rank-badge/rank-badge';

const _setup = () => {
    init(() => 'WOLF');
    mount();
};

export const ZumOberleutnant = () => { _setup(); show(RANKS[1]); };
export const ZumHauptmannMitHeli = () => { _setup(); show(RANKS[2], 'chinook'); };
export const ZumMajor = () => { _setup(); show(RANKS[3]); };
