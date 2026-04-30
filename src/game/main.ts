import { CampaignExport, MissionData } from '@/shared/types';
import Tutorial from './campaigns/tutorial.json';
import FreeFlight from './campaigns/freeFlight.json';
import ArchipelDemo from './campaigns/archipeldemo.json';
import TransferDemo from './campaigns/transferdemo.json';
import { MP_DEMO_CAMPAIGN } from './multiplayer/mp-mission';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';
import { decompressTerrain } from '../shared/utils';
import ZsynthPlayer from '../shared/ZsynthPlayer';
import SoundAnothermenu from './music/anothermenu.zsong';
import SoundAnothersound from './music/anothersound.zsong';
import SoundBriefing from './music/briefing.zsong';
import SoundClike from './music/clike.zsong';
import SoundDestroid from './music/destroid.zsong';
import SoundFinal from './music/final.zsong';
import SoundMaintheme from './music/maintheme.zsong';
import SoundMenusound from './music/menusound.zsong';
import SoundSpocktribute from './music/spocktribute.zsong';
import SoundPartytime from './music/partytime.zsong';
import { SongData } from '@/shared/tracker-types';
import MusicConfigJson from './music-config.json';

export const musicConfig: { mainMenu: string; credits: string; success: string; defeat: string } = MusicConfigJson;

const soundHandler = (() => {
    const songList: Record<string, SongData> = {
        anothermenu: SoundAnothermenu,
        anothersound: SoundAnothersound,
        briefing: SoundBriefing,
        clike: SoundClike,
        destroid: SoundDestroid,
        final: SoundFinal,
        maintheme: SoundMaintheme,
        menusound: SoundMenusound,
        spocktribute: SoundSpocktribute,
        ...(!_IS_APP ? { partytime: SoundPartytime } : {}),
    };

    const state: { activeTheme: string; isMuted: boolean } = {
        activeTheme: '',
        isMuted: true, // WORKBENCH_MUTE — replaced with false at build time
    };

    ZsynthPlayer.init(songList);
    return {
        state,
        mute: () => {
            state.isMuted = true;
            ZsynthPlayer.stop();
        },
        unmute: () => {
            state.isMuted = false;
            ZsynthPlayer.play(state.activeTheme);
        },
        play: (theme: string, fade: boolean) => {
            if (!songList[theme]) {
                return;
            }
            state.activeTheme = theme;
            if (state.isMuted) {
                return;
            }
            ZsynthPlayer.play(theme, fade ? 0.25 : 0);
        },
        stop: () => {
            ZsynthPlayer.stop();
        },
    };
})();

const createCampaignHandler = () => {
    let cachedTerrain: { terrain: number[][]; gridSize: number } | null = null;

    const campaigns: CampaignExport[] = [
        Tutorial as unknown as CampaignExport,
        ArchipelDemo as unknown as CampaignExport,
        FreeFlight as unknown as CampaignExport,
        ...(!_IS_APP ? [MP_DEMO_CAMPAIGN] : []), // index 4 (web) / 4 (app) – matches MP_CAMPAIGN_INDEX in mp-mission.ts
        TransferDemo as unknown as CampaignExport,
    ];

    const campaignState = {
        activeCampaign: 0,
        activeMission: 0,
        maximumMissions: 0,
    };

    const getCampaigns = () => {
        return campaigns;
    };

    const getNextMission = () => {
        cachedTerrain = null;
        if (campaignState.activeMission + 1 >= campaignState.maximumMissions) {
            return 'DONE';
        }

        campaignState.activeMission = campaignState.activeMission + 1;

        const missionData = campaigns[campaignState.activeCampaign].levels[campaignState.activeMission];
        return { ...missionData };
    };

    const setActiveCampaign = (index: number) => {
        campaignState.activeCampaign = index;
        campaignState.activeMission = 0;
        campaignState.maximumMissions = campaigns[index].levels.length;
        cachedTerrain = null;
    };

    const setActiveMission = (index: number) => {
        campaignState.activeMission = index;
    };

    const getCurrentMissionData = (): MissionData => {
        const missionData = campaigns[campaignState.activeCampaign].levels[campaignState.activeMission];
        return { ...missionData, campaignType: campaigns[campaignState.activeCampaign].type };
    };

    const getTerrain = () => {
        if (!cachedTerrain) {
            const { terrain, gridSize } = campaigns[campaignState.activeCampaign].levels[campaignState.activeMission];
            cachedTerrain = {
                terrain: decompressTerrain(terrain, gridSize),
                gridSize,
            };
        }

        return cachedTerrain;
    };

    const getActiveCampaignMusic = (): { briefing?: string; ingame?: string } =>
        campaigns[campaignState.activeCampaign]?.music ?? {};

    return {
        getCampaigns,
        campaign: {
            getNextMission,
            setActiveCampaign,
            setActiveMission,
        },
        getCurrentMissionData,
        getActiveCampaignMusic,
        getTerrain,
    };
};

export const campaignHandler = createCampaignHandler();

// ─── Preview mode — DEV only, stripped from production bundle ─────────────────
if (import.meta.env.DEV) {
    let _previewLevel: MissionData | null = null;
    let _previewTerrain: { terrain: number[][]; gridSize: number } | null = null;

    const _origGetMission = campaignHandler.getCurrentMissionData.bind(campaignHandler);
    const _origGetTerrain = campaignHandler.getTerrain.bind(campaignHandler);

    (campaignHandler as any).setPreviewMission = (levelData: MissionData) => {
        _previewLevel = levelData;
        _previewTerrain = null;
        campaignHandler.getCurrentMissionData = () => _previewLevel ?? _origGetMission();
        campaignHandler.getTerrain = () => {
            if (!_previewLevel) return _origGetTerrain();
            if (!_previewTerrain)
                _previewTerrain = {
                    terrain: decompressTerrain(_previewLevel.terrain as string, _previewLevel.gridSize),
                    gridSize: _previewLevel.gridSize,
                };
            return _previewTerrain;
        };
    };

    (campaignHandler as any).getPreviewMissionData = (): MissionData | null => _previewLevel;
}

export { soundHandler };
export const zinit = () => {
    /* wired via mountMuteButton in game.ts */
};
