import { CampaignExport, MissionData } from '@/shared/types';
import Tutorial from './campaigns/tutorial.zcampaign';
import FreeFlight from './campaigns/freeFlight.zcampaign';
import CallsignWolf from './campaigns/callsignwolf.zcampaign';
import { decompressTerrain } from '../shared/utils';
import ZsynthPlayer from '../shared/ZsynthPlayer';
import { songToZsong } from '../shared/zsong';
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
import Baywatch from './music/baywatch.zsong';
import Fanfare from './music/fanfare.zsong';
import Metalstorm from './music/metalstorm.zsong';
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
        baywatch: Baywatch,
        destroid: SoundDestroid,
        final: SoundFinal,
        maintheme: SoundMaintheme,
        partytime: PartyTime,
        slowway: SlowWay,
        spocktribute: SoundSpocktribute,
        thunderscene: ThunderScene,
        fanfare: Fanfare,
        metalstorm: Metalstorm,
    };

    const state: { activeTheme: string; isMuted: boolean } = {
        activeTheme: '',
        isMuted: false,
    };

    const _native: { postMessage: (m: object) => void } | null =
        (window as any).webkit?.messageHandlers?.zsynthPlayer ?? null;

    if (_native) {
        const raw: Record<string, string> = {};
        for (const [k, v] of Object.entries(songList)) raw[k] = songToZsong(v);
        _native.postMessage({ action: 'preload', songs: raw });
    } else {
        ZsynthPlayer.init(songList);
    }

    const CTX_VOL: Record<string, number> = { menu: 0.65, game: 0.35 };
    let _nativeKey = '';
    let _nativeCtx = 'menu';

    return {
        state,
        mute: () => {
            state.isMuted = true;
            if (_native) _native.postMessage({ action: 'stop' });
            else ZsynthPlayer.stop();
        },
        unmute: () => {
            state.isMuted = false;
            if (state.activeTheme) {
                if (_native) _native.postMessage({ action: 'play', key: state.activeTheme, context: _nativeCtx });
                else ZsynthPlayer.play(state.activeTheme, CTX_VOL[_nativeCtx] ?? 0.65);
            }
        },
        play: (theme: string, context: string = 'menu') => {
            if (!songList[theme]) return;
            if (_native) {
                const alreadyPlaying = _nativeKey === theme;
                state.activeTheme = theme;
                if (state.isMuted || alreadyPlaying) return;
                _nativeKey = theme;
                _nativeCtx = context;
                _native.postMessage({ action: 'play', key: theme, context });
                return;
            }
            const alreadyPlaying = state.activeTheme === theme && ZsynthPlayer.currentTrack?.isPlaying;
            state.activeTheme = theme;
            if (state.isMuted) return;
            if (alreadyPlaying) return;
            try {
                ZsynthPlayer.play(theme, CTX_VOL[context] ?? 0.65);
            } catch {
                /* ignore */
            }
        },
        stop: () => {
            if (_native) {
                _nativeKey = '';
                _native.postMessage({ action: 'stop' });
                return;
            }
            ZsynthPlayer.stop();
        },
    };
})();

const createCampaignHandler = () => {
    let cachedTerrain: { terrain: number[][]; gridSize: number; sand?: number[][]; pavement?: number[][] } | null =
        null;

    const campaigns: CampaignExport[] = [
        Tutorial as unknown as CampaignExport,
        FreeFlight as unknown as CampaignExport,
        CallsignWolf as unknown as CampaignExport,
    ];

    const campaignMap = new Map<string, CampaignExport>(campaigns.map(c => [(c as any)._key as string, c]));

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

    const _isCompressed = (s: string) => s.charCodeAt(0) === 0;

    const _decompressStr = async (s: string): Promise<string> => {
        const compressed = Uint8Array.from(atob(s.slice(1)), c => c.charCodeAt(0));
        const ds = new DecompressionStream('deflate-raw');
        return new Response(new Blob([compressed]).stream().pipeThrough(ds)).text();
    };

    const getTerrain = () => {
        if (!cachedTerrain) {
            // prewarmTerrain() must be awaited before getTerrain() is called when terrain is compressed
            const level = campaigns[campaignState.activeCampaign].levels[campaignState.activeMission];
            const { terrain, gridSize } = level;
            cachedTerrain = {
                terrain: decompressTerrain(terrain as string, gridSize),
                gridSize,
                sand: (level as any).sand ? decompressTerrain((level as any).sand, gridSize) : undefined,
                pavement: (level as any).pavement ? decompressTerrain((level as any).pavement, gridSize) : undefined,
            };
        }

        return cachedTerrain;
    };

    const prewarmTerrain = async (): Promise<void> => {
        if (cachedTerrain) return;
        const level = campaigns[campaignState.activeCampaign].levels[campaignState.activeMission];
        const { gridSize } = level;
        const terrainStr = _isCompressed(level.terrain as string)
            ? await _decompressStr(level.terrain as string)
            : (level.terrain as string);
        const sandRaw = (level as any).sand as string | undefined;
        const sandStr = sandRaw
            ? (_isCompressed(sandRaw) ? await _decompressStr(sandRaw) : sandRaw)
            : undefined;
        const pavRaw = (level as any).pavement as string | undefined;
        const pavStr = pavRaw
            ? (_isCompressed(pavRaw) ? await _decompressStr(pavRaw) : pavRaw)
            : undefined;
        cachedTerrain = {
            terrain: decompressTerrain(terrainStr, gridSize),
            gridSize,
            sand: sandStr ? decompressTerrain(sandStr, gridSize) : undefined,
            pavement: pavStr ? decompressTerrain(pavStr, gridSize) : undefined,
        };
    };

    const getCampaignByKey = (key: string): CampaignExport | undefined => campaignMap.get(key);

    return {
        getCampaigns,
        getCampaignByKey,
        campaign: {
            getNextMission,
            setActiveCampaign,
            setActiveMission,
        },
        getCurrentMissionData,
        getTerrain,
        prewarmTerrain,
    };
};

export const campaignHandler = createCampaignHandler();

// ─── Preview mode — DEV only, stripped from production bundle ─────────────────
if (import.meta.env.DEV) {
    let _previewLevel: MissionData | null = null;
    let _previewTerrain: { terrain: number[][]; gridSize: number; sand?: number[][]; pavement?: number[][] } | null =
        null;

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
                    sand: _previewLevel.sand
                        ? decompressTerrain(_previewLevel.sand, _previewLevel.gridSize)
                        : undefined,
                    pavement: (_previewLevel as any).pavement
                        ? decompressTerrain((_previewLevel as any).pavement, _previewLevel.gridSize)
                        : undefined,
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
