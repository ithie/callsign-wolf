import { mount, show } from './campaign-select';
import type { PlayerSession } from '../../session';
import type { CampaignExport } from '../../../shared/types';

const _noop = () => {};

const _baseSession = (): PlayerSession => ({
    playerName: 'WOLF',
    highestUnlockedCampaignIndex: 0,
    campaignProgress: {},
    rankOverride: 0,
});

const _campaigns: CampaignExport[] = [
    {
        type: 'tutorial',
        campaignTitle: { de: 'Tutorial', en: 'Tutorial' },
        campaignSublines: [{ de: 'Grundlagen lernen', en: 'Learn the basics' }],
        levels: [{ name: 'tut-1' } as any],
    },
    {
        type: 'standard',
        campaignTitle: { de: 'Operation Nordsee', en: 'Operation North Sea' },
        campaignSublines: [{ de: '5 Missionen', en: '5 Missions' }],
        levels: Array.from({ length: 5 }, (_, i) => ({ name: `m${i}` }) as any),
    },
    {
        type: 'standard',
        campaignTitle: { de: 'Operation Atlantik', en: 'Operation Atlantic' },
        campaignSublines: [{ de: '4 Missionen', en: '4 Missions' }],
        levels: Array.from({ length: 4 }, (_, i) => ({ name: `a${i}` }) as any),
    },
    {
        type: 'free-flight',
        campaignTitle: { de: 'Freier Flug', en: 'Free Flight' },
        campaignSublines: [{ de: 'Kein Ziel, freie Erkundung', en: 'No goal, free exploration' }],
        levels: [{ name: 'ff' } as any],
    },
];

/** Frischer Start: Tutorial verfügbar, alle regulären Kampagnen gesperrt. */
export const FreshStart = () => {
    mount();
    show({ session: _baseSession(), campaigns: _campaigns, onSelect: _noop, onBack: _noop });
};

/** Tutorial abgeschlossen, erste reguläre Kampagne freigeschaltet. */
export const TutorialDone = () => {
    mount();
    show({
        session: {
            ..._baseSession(),
            campaignProgress: {
                '0': { completed: true, missions: [{ completed: true, bestTimeMs: 180000, count: 1 }] },
            },
            highestUnlockedCampaignIndex: 1,
        },
        campaigns: _campaigns,
        onSelect: _noop,
        onBack: _noop,
    });
};

/** Erste Kampagne halb durch, zweite noch gesperrt. */
export const InProgress = () => {
    mount();
    show({
        session: {
            ..._baseSession(),
            campaignProgress: {
                '0': { completed: true, missions: [{ completed: true, bestTimeMs: 180000, count: 1 }] },
                '1': {
                    completed: false,
                    missions: [
                        { completed: true, bestTimeMs: 240000, count: 1 },
                        { completed: true, bestTimeMs: 310000, count: 1 },
                        null as any, null as any, null as any,
                    ],
                },
            },
            highestUnlockedCampaignIndex: 1,
        },
        campaigns: _campaigns,
        onSelect: _noop,
        onBack: _noop,
    });
};

/** Alles freigeschaltet (alle Kampagnen completed). */
export const AllUnlocked = () => {
    mount();
    show({
        session: {
            ..._baseSession(),
            highestUnlockedCampaignIndex: 3,
            campaignProgress: Object.fromEntries(
                _campaigns.map((c, i) => [String(i), { completed: true, missions: c.levels.map(() => ({ completed: true, bestTimeMs: null, count: 1 })) }])
            ),
        },
        campaigns: _campaigns,
        onSelect: _noop,
        onBack: _noop,
    });
};
