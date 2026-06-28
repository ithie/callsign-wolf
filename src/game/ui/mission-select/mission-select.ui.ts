import { mount, show } from './mission-select';
import type { PlayerSession } from '../../session';
import type { CampaignExport } from '../../../shared/types';

const _session = (overrides: Partial<PlayerSession> = {}): PlayerSession => ({
    playerName: 'WOLF',
    highestUnlockedCampaignIndex: 1,
    campaignProgress: {},
    rankOverride: 0,
    ...overrides,
});

const _campaign: CampaignExport = {
    type: 'standard',
    campaignTitle: { de: 'Operation Nordsee', en: 'Operation North Sea' },
    campaignSublines: [{ de: '5 Rettungsmissionen', en: '5 rescue missions' }],
    levels: [
        { name: 'mission-1' } as any,
        { name: 'mission-2' } as any,
        { name: 'mission-3' } as any,
        { name: 'mission-4' } as any,
        { name: 'mission-5' } as any,
    ],
};

export const FrischerStart = () => {
    mount();
    show({ campaign: _campaign, campaignIndex: 1, session: _session(), onSelect: () => {}, onBack: () => {} });
};

export const TeilweiseFertig = () => {
    mount();
    show({
        campaign: _campaign,
        campaignIndex: 1,
        session: _session({
            campaignProgress: {
                '1': {
                    completed: false,
                    missions: [
                        { completed: true, bestTimeMs: 243000, count: 1 },
                        { completed: true, bestTimeMs: 318000, count: 1 },
                        null as any, null as any, null as any,
                    ],
                },
            },
        }),
        onSelect: () => {},
        onBack: () => {},
    });
};

export const AlleGeschafft = () => {
    mount();
    show({
        campaign: _campaign,
        campaignIndex: 1,
        session: _session({
            campaignProgress: {
                '1': {
                    completed: true,
                    missions: [
                        { completed: true, bestTimeMs: 243000, count: 1 },
                        { completed: true, bestTimeMs: 318000, count: 1 },
                        { completed: true, bestTimeMs: 195000, count: 1 },
                        { completed: true, bestTimeMs: 402000, count: 1 },
                        { completed: true, bestTimeMs: 287000, count: 1 },
                    ],
                },
            },
        }),
        onSelect: () => {},
        onBack: () => {},
    });
};
