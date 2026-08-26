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
        campaignTitle: { de: 'Tutorial', en: 'Tutorial', fr: 'Tutoriel', es: 'Tutorial', pt: 'Tutorial' },
        campaignSublines: [{ de: 'Grundlagen lernen', en: 'Learn the basics', fr: 'Apprendre les bases', es: 'Aprender lo básico', pt: 'Aprender o básico' }],
        levels: [{ name: 'tut-1' } as any],
    },
    {
        type: 'standard',
        campaignTitle: { de: 'Operation Nordsee', en: 'Operation North Sea', fr: 'Opération Mer du Nord', es: 'Operación Mar del Norte', pt: 'Operação Mar do Norte' },
        campaignSublines: [{ de: '5 Missionen', en: '5 Missions', fr: '5 missions', es: '5 misiones', pt: '5 missões' }],
        levels: Array.from({ length: 5 }, (_, i) => ({ name: `m${i}` }) as any),
    },
    {
        type: 'standard',
        campaignTitle: { de: 'Operation Atlantik', en: 'Operation Atlantic', fr: 'Opération Atlantique', es: 'Operación Atlántico', pt: 'Operação Atlântico' },
        campaignSublines: [{ de: '4 Missionen', en: '4 Missions', fr: '4 missions', es: '4 misiones', pt: '4 missões' }],
        levels: Array.from({ length: 4 }, (_, i) => ({ name: `a${i}` }) as any),
    },
    {
        type: 'free-flight',
        campaignTitle: { de: 'Freier Flug', en: 'Free Flight', fr: 'Vol libre', es: 'Vuelo libre', pt: 'Voo livre' },
        campaignSublines: [{ de: 'Kein Ziel, freie Erkundung', en: 'No goal, free exploration', fr: 'Sans objectif, exploration libre', es: 'Sin objetivo, exploración libre', pt: 'Sem objetivo, exploração livre' }],
        levels: [{ name: 'ff' } as any],
    },
];

/** Frischer Start: Tutorial verfügbar, alle regulären Kampagnen gesperrt. */
export const FreshStart = () => {
    mount();
    show({ session: _baseSession(), campaigns: _campaigns, onSelect: _noop, onBack: _noop, onShowPaywall: _noop });
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
        onShowPaywall: _noop,
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
        onShowPaywall: _noop,
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
        onShowPaywall: _noop,
    });
};
