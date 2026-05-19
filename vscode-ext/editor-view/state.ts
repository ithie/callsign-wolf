import { Mission } from '@/shared/types';

export const createEmptyMission = (name = 'Mission Alpha'): Mission => {
    const gs = 100;
    const grid: number[][] = [];
    for (let x = 0; x <= gs; x++) {
        grid[x] = [];
        for (let y = 0; y <= gs; y++) grid[x][y] = -1;
    }
    return {
        headline: name,
        briefing: 'Befehle für diese Mission hier eintragen...',
        gridSize: gs,
        terrain: grid,
        objects: [{ type: 'pad', x: 10, y: 10 }],
        spawnObject: 'pad',
        objectives: [],
        payloads: [],
        foliage: [],
        rain: false,
        night: false,
        windDir: 45,
        windStr: 1.0,
        windVar: false,
    };
};

// ── Editor state ──────────────────────────────────────────────────────────────
export const state = {
    type: '',
    campaign: [createEmptyMission()] as Mission[],
    curIdx: 0,

    zoom: 1.0,
    panX: 0,
    panY: 0,

    prevZoom: 1.0,
    prevPanX: 0,
    prevPanY: 0,

    currentTool: 'terrain',
    brushRadius: 1.5,
    isCustomBrush: false,
    selectedUI: null as string | null,
    selectedObjectIdx: null as number | null, // index in m.objects for focused object
    selectedPayloadIdx: null as number | null, // index in m.payloads for focused payload
    moveMode: false, // M-Taste: nächster Klick verschiebt selektiertes Objekt

    payloadBrushType: null as 'person' | 'crate' | null,
    foliageBrushType: 'pine' as 'pine' | 'oak' | 'bush' | 'dead',

    isDrawing: false,
    isEditorDragging: false,
    isPrevDragging: false,
    lastMX: 0,
    lastMY: 0,
};

export const getCurrentMission = (): Mission | undefined => state.campaign[state.curIdx];
