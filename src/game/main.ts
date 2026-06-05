import { CampaignExport, MissionData } from '@/shared/types';
import Tutorial from './campaigns/tutorial.zcampaign';
import FreeFlight from './campaigns/freeFlight.zcampaign';
import CallsignWolf from './campaigns/callsignwolf.zcampaign';
import { decompressTerrain } from '../shared/utils';
import ZsynthPlayer from '../shared/ZsynthPlayer';
import SoundSuccess from './music/success.zsong';
import SoundClike from './music/clike.zsong';
import SoundDestroid from './music/destroid.zsong';
import SoundFinal from './music/final.zsong';
import SoundMaintheme from './music/maintheme.zsong';
import SlowWay from './music/slowway.zsong';
import SoundSpocktribute from './music/spocktribute.zsong';
import ThunderScene from './music/thunderscene.zsong';
import PartyTime from './music/partytime.zsong';
import CarrierOps from './music/carrierops.zsong';
import Coastal from './music/coastal.zsong';
import Ignition from './music/ignition.zsong';
import Offshore from './music/offshore.zsong';
import Vigil from './music/vigil.zsong';
import { SongData } from '@/shared/tracker-types';

const soundHandler = (() => {
    const songList: Record<string, SongData> = {
        success: SoundSuccess,
        carrierops: CarrierOps,
        clike: SoundClike,
        coastal: Coastal,
        ignition: Ignition,
        offshore: Offshore,
        vigil: Vigil,
        destroid: SoundDestroid,
        final: SoundFinal,
        maintheme: SoundMaintheme,
        partytime: PartyTime,
        slowway: SlowWay,
        spocktribute: SoundSpocktribute,
        thunderscene: ThunderScene,
    };

    const state: { activeTheme: string; isMuted: boolean } = {
        activeTheme: '',
        isMuted: false,
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
            if (state.activeTheme) ZsynthPlayer.play(state.activeTheme);
        },
        play: (theme: string, volume: number = 1.0) => {
            if (!songList[theme]) return;
            const alreadyPlaying = state.activeTheme === theme && ZsynthPlayer.currentTrack?.isPlaying;
            state.activeTheme = theme;
            if (state.isMuted) return;
            if (alreadyPlaying) return;

            try {
            ZsynthPlayer.play(theme, volume);
            } catch {
                // nothing to do here
            }
        },
        stop: () => {
            ZsynthPlayer.stop();
        },
    };
})();

const createCampaignHandler = () => {
    let cachedTerrain: { terrain: number[][]; gridSize: number; sand?: number[][] } | null = null;

    const campaigns: CampaignExport[] = [
        Tutorial as unknown as CampaignExport,
        FreeFlight as unknown as CampaignExport,
        CallsignWolf as unknown as CampaignExport,
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
        cachedTerrain = null;
    };

    const getCurrentMissionData = (): MissionData => {
        const missionData = campaigns[campaignState.activeCampaign].levels[campaignState.activeMission];
        return { ...missionData, campaignType: campaigns[campaignState.activeCampaign].type };
    };

    const getTerrain = () => {
        if (!cachedTerrain) {
            const level = campaigns[campaignState.activeCampaign].levels[campaignState.activeMission];
            const { terrain, gridSize } = level;
            cachedTerrain = {
                terrain: decompressTerrain(terrain, gridSize),
                gridSize,
                sand: (level as any).sand ? decompressTerrain((level as any).sand, gridSize) : undefined,
            };
        }

        return cachedTerrain;
    };

    return {
        getCampaigns,
        campaign: {
            getNextMission,
            setActiveCampaign,
            setActiveMission,
        },
        getCurrentMissionData,
        getTerrain,
    };
};

export const campaignHandler = createCampaignHandler();

// ─── Preview mode — DEV only, stripped from production bundle ─────────────────
if (import.meta.env.DEV) {
    let _previewLevel: MissionData | null = null;
    let _previewTerrain: { terrain: number[][]; gridSize: number; sand?: number[][] } | null = null;

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
                    sand: _previewLevel.sand ? decompressTerrain(_previewLevel.sand, _previewLevel.gridSize) : undefined,
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
