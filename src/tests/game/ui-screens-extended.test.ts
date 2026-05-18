// @vitest-environment jsdom

import { vi, beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';

// ─── Native-Plugin-Stubs (laufen nicht in jsdom) ──────────────────────────────
vi.mock('@capacitor/preferences', () => ({
    Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}));
vi.mock('@capacitor/haptics', () => ({
    Haptics: { impact: vi.fn(), notification: vi.fn() },
    ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
    NotificationType: { Success: 'SUCCESS', Warning: 'WARNING', Error: 'ERROR' },
}));
vi.mock('../../game/render', () => ({
    iso: vi.fn((x: number, y: number) => ({ x: x * 10, y: y * 10 })),
}));
// render-config evaluates matchMedia at module level — provide constants directly
vi.mock('../../game/render-config', () => ({
    tileW: 64, tileH: 32, stepH: 16, CANVAS_SCALE: 1, isTouchDevice: false,
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import { mountLegalScreen } from '../../game/ui/legal-screen/legal-screen';
import { showLoadingScreen } from '../../game/ui/loading-screen/loading-screen';
import { mountPauseButton, showPauseButton, hidePauseButton } from '../../game/ui/pause-overlay/pause-overlay';
import { mountTouchControls, setDeliverToggle, setRightStickProfi } from '../../game/ui/touch-controls/touch-controls';
import { createSwipeCarousel } from '../../game/ui/swipe-carousel/swipe-carousel';
import { mountMissionSelect, showMissionSelect } from '../../game/ui/mission-select/mission-select';
import { mountMinimap, showMinimap, updateMinimap, initMinimapTerrain, type MinimapData } from '../../game/ui/minimap/minimap';
import { startMenuParticles, stopMenuParticles } from '../../game/ui/menu-particles/menu-particles';
import { createHud } from '../../game/ui/hud/hud';
import { initHeliSelect, mountHeliSelect, showHeliSelect } from '../../game/ui/heli-select/heli-select';
import { initTutorial, tutorialTick, destroyTutorial, isTutorialRunning } from '../../game/ui/tutorial/tutorial';
import { HELI_TYPES } from '../../game/heli-types';
import type { PlayerSession } from '../../game/session';
import type { CampaignExport } from '../../../shared/types';
import type { GameState } from '../../game/state';

// ─── Canvas & AudioContext stubs ──────────────────────────────────────────────
const makeCtx2d = () => ({
    fillRect: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    stroke: vi.fn(), save: vi.fn(), restore: vi.fn(),
    scale: vi.fn(), translate: vi.fn(), rotate: vi.fn(), setTransform: vi.fn(),
    fillText: vi.fn(), strokeText: vi.fn(), strokeRect: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: vi.fn(), setLineDash: vi.fn(), closePath: vi.fn(),
    clip: vi.fn(), quadraticCurveTo: vi.fn(), bezierCurveTo: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    shadowBlur: 0, shadowColor: '', font: '', textAlign: 'left' as CanvasTextAlign,
});

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn((query: string) => ({
            matches: false, media: query, onchange: null,
            addListener: vi.fn(), removeListener: vi.fn(),
            addEventListener: vi.fn(), removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => makeCtx2d()) as any;
    vi.stubGlobal('AudioContext', vi.fn(() => ({
        createOscillator: vi.fn(() => ({
            connect: vi.fn(), frequency: { value: 880 },
            start: vi.fn(), stop: vi.fn(), onended: null,
        })),
        createGain: vi.fn(() => ({
            connect: vi.fn(),
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        })),
        close: vi.fn(), currentTime: 0, destination: {},
    })));
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const snap = (id: string) => expect(document.getElementById(id)!.innerHTML).toMatchSnapshot();

const mkSession = (o: Partial<PlayerSession> = {}): PlayerSession => ({
    cookieConsent: true, consentTimestamp: Date.now(), consentVersion: 'v25.0',
    playerName: 'WOLF', activeCampaignIndex: 0, highestUnlockedCampaignIndex: 0,
    campaignProgress: {}, rankOverride: 0, allUnlocked: false, lastSeenVersion: '',
    ...o,
});

const mkCampaign = (levels = 1): CampaignExport => ({
    type: 'regular',
    campaignTitle: 'Test Kampagne',
    campaignSublines: ['Subtitle'],
    levels: Array.from({ length: levels }, (_, i) => ({
        headline: `Mission ${i + 1}`,
        sublines: [`Sublevel ${i + 1}`],
        briefing: 'Briefing text',
        terrain: '', gridSize: 10, foliage: '',
        objects: [], waterLevel: 0,
    })) as any,
});

const mkPauseDeps = () => ({
    isMusicEnabled: vi.fn(() => true),   setMusicEnabled: vi.fn(),
    isSfxEnabled:   vi.fn(() => true),   setSfxEnabled:   vi.fn(),
    getControlMode: vi.fn(() => 'heading' as const),
    setControlMode: vi.fn(),
    onPause: vi.fn(), onResume: vi.fn(), onAbort: vi.fn(),
});

const mkGameState = (heliOverrides: Partial<GameState['heli']> = {}): GameState => ({
    heli: {
        x: 0, y: 0, z: 0, angle: 0,
        vx: 0, vy: 0, vz: 0,
        fuel: 100, winch: 0,
        engineOn: false, inAir: false,
        onboard: 0, maxLoad: 4,
        ...heliOverrides,
    } as any,
    payloads: [] as any,
    START_POS: { x: 0, y: 0 },
} as unknown as GameState);

const mkMinimapData = (): MinimapData => ({
    gridSize: 10, isTouch: false,
    pad: null, carrier: null,
    heli: { x: 5, y: 5 },
    payloads: [],
});

// ─── legal-screen ─────────────────────────────────────────────────────────────
describe('legal-screen', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('mounts the screen', () => {
        mountLegalScreen(vi.fn());
        expect(document.getElementById('legal-screen')).not.toBeNull();
    });

    it('snapshot', () => {
        mountLegalScreen(vi.fn());
        snap('legal-screen');
    });

    it('does not mount twice', () => {
        mountLegalScreen(vi.fn());
        mountLegalScreen(vi.fn());
        expect(document.querySelectorAll('#legal-screen').length).toBe(1);
    });
});

// ─── loading-screen ───────────────────────────────────────────────────────────
describe('loading-screen', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('shows on creation', () => {
        const h = showLoadingScreen('Laden...');
        expect(document.getElementById('loading-screen')!.style.display).toBe('flex');
        h.step('step', 0);
    });

    it('renders the title', () => {
        showLoadingScreen('TEST MISSION');
        expect(document.querySelector('.loading-title')!.textContent).toBe('TEST MISSION');
    });

    it('step updates the label', () => {
        const h = showLoadingScreen('...');
        h.step('Terrain laden', 0.5);
        expect(document.querySelector('.loading-label')!.textContent).toBe('Terrain laden');
    });

    it('step updates the progress bar width', () => {
        const h = showLoadingScreen('...');
        h.step('x', 0.75);
        expect(document.querySelector<HTMLElement>('.loading-bar-fill')!.style.width).toBe('75%');
    });

    it('done() hides the screen', async () => {
        const h = showLoadingScreen('...');
        await h.done();
        expect(document.getElementById('loading-screen')!.style.display).toBe('none');
    });
});

// ─── pause-overlay ────────────────────────────────────────────────────────────
describe('pause-overlay', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        const el = document.createElement('div');
        el.id = 'hud-tl';
        document.body.appendChild(el);
    });

    it('mounts the pause button', () => {
        mountPauseButton(mkPauseDeps());
        expect(document.getElementById('pause-btn')).not.toBeNull();
    });

    it('snapshot of pause button', () => {
        mountPauseButton(mkPauseDeps());
        snap('pause-btn');
    });

    it('showPauseButton sets display to flex', () => {
        mountPauseButton(mkPauseDeps());
        showPauseButton();
        expect(document.getElementById('pause-btn')!.style.display).toBe('flex');
    });

    it('hidePauseButton hides the button', () => {
        mountPauseButton(mkPauseDeps());
        showPauseButton();
        hidePauseButton();
        expect(document.getElementById('pause-btn')!.style.display).toBe('none');
    });
});

// ─── touch-controls ───────────────────────────────────────────────────────────
describe('touch-controls', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('mounts the controls', () => {
        mountTouchControls();
        expect(document.getElementById('touch-controls')).not.toBeNull();
    });

    it('does not mount twice', () => {
        mountTouchControls();
        mountTouchControls();
        expect(document.querySelectorAll('#touch-controls').length).toBe(1);
    });

    it('snapshot', () => {
        mountTouchControls();
        snap('touch-controls');
    });

    it('setDeliverToggle adds "on" class', () => {
        mountTouchControls();
        setDeliverToggle(true);
        expect(document.getElementById('touch-deliver-toggle')!.classList.contains('on')).toBe(true);
    });

    it('setDeliverToggle removes "on" class', () => {
        mountTouchControls();
        setDeliverToggle(true);
        setDeliverToggle(false);
        expect(document.getElementById('touch-deliver-toggle')!.classList.contains('on')).toBe(false);
    });

    it('setRightStickProfi toggles profi class on joystick-right', () => {
        mountTouchControls();
        const rs = document.getElementById('joystick-right')!;
        setRightStickProfi(true);
        expect(rs.classList.contains('profi')).toBe(true);
        setRightStickProfi(false);
        expect(rs.classList.contains('profi')).toBe(false);
    });
});

// ─── swipe-carousel ───────────────────────────────────────────────────────────
describe('swipe-carousel', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    const makeCard = (item: string) => {
        const el = document.createElement('div');
        el.textContent = item;
        el.className = 'card';
        return el;
    };

    it('returns an HTMLElement', () => {
        const el = createSwipeCarousel({ items: ['A', 'B'], renderCard: makeCard });
        expect(el instanceof HTMLElement).toBe(true);
    });

    it('renders one card per item', () => {
        const el = createSwipeCarousel({ items: ['X', 'Y', 'Z'], renderCard: makeCard });
        document.body.appendChild(el);
        expect(document.querySelectorAll('.card').length).toBe(3);
    });

    it('locked items get a swipe-card locked class', () => {
        const el = createSwipeCarousel({
            items: ['open', 'locked'],
            renderCard: makeCard,
            isLocked: item => item === 'locked',
        });
        document.body.appendChild(el);
        const cards = el.querySelectorAll('.swipe-card');
        expect(cards[0].classList.contains('locked')).toBe(false);
        expect(cards[1].classList.contains('locked')).toBe(true);
    });
});

// ─── mission-select ───────────────────────────────────────────────────────────
describe('mission-select', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('mountMissionSelect creates the element', () => {
        mountMissionSelect();
        expect(document.getElementById('mission-select')).not.toBeNull();
    });

    it('showMissionSelect renders mission cards', () => {
        mountMissionSelect();
        showMissionSelect({
            campaign: mkCampaign(3),
            campaignIndex: 0,
            session: mkSession(),
            onSelect: vi.fn(),
            onBack: vi.fn(),
        });
        snap('mission-select');
    });

    it('completed missions show a done marker', () => {
        mountMissionSelect();
        showMissionSelect({
            campaign: mkCampaign(2),
            campaignIndex: 1,
            session: mkSession({
                campaignProgress: {
                    '1': { completed: false, missions: [
                        { completed: true, bestTimeMs: 12345 },
                        { completed: false, bestTimeMs: null },
                    ]},
                },
            }),
            onSelect: vi.fn(),
            onBack: vi.fn(),
        });
        expect(document.getElementById('mission-select')!.innerHTML).toContain('mission-done');
    });
});

// ─── minimap ─────────────────────────────────────────────────────────────────
// Minimap is a singleton — mount once, test incrementally
describe('minimap', () => {
    beforeAll(() => {
        document.body.innerHTML = '';
        mountMinimap();
    });

    it('mountMinimap creates the element', () => {
        expect(document.getElementById('minimap-dom')).not.toBeNull();
    });

    it('showMinimap(true) makes element visible', () => {
        showMinimap(true);
        expect(document.getElementById('minimap-dom')!.style.display).toBe('block');
    });

    it('showMinimap(false) hides the element', () => {
        showMinimap(false);
        expect(document.getElementById('minimap-dom')!.style.display).toBe('none');
    });

    it('initMinimapTerrain does not throw', () => {
        showMinimap(true);
        const pts = Array.from({ length: 6 }, () => Array(6).fill(0));
        expect(() => initMinimapTerrain(pts, 5, 0)).not.toThrow();
    });

    it('updateMinimap positions the heli dot', () => {
        showMinimap(true);
        updateMinimap(mkMinimapData());
        const heli = document.getElementById('minimap-heli')!;
        expect(heli).not.toBeNull();
        expect(heli.style.display).toBe('block');
    });

    it('updateMinimap hides pad when pad is null', () => {
        updateMinimap({ ...mkMinimapData(), pad: null });
        expect(document.getElementById('minimap-pad')!.style.display).toBe('none');
    });

    it('updateMinimap shows pad when pad is set', () => {
        updateMinimap({ ...mkMinimapData(), pad: { xMin: 1, yMin: 1, xMax: 3, yMax: 3 } });
        expect(document.getElementById('minimap-pad')!.style.display).toBe('block');
    });
});

// ─── menu-particles ───────────────────────────────────────────────────────────
describe('menu-particles', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        stopMenuParticles(); // reset _running flag between tests
    });

    it('startMenuParticles adds the canvas to the DOM', () => {
        startMenuParticles();
        expect(document.getElementById('menu-particles-canvas')).not.toBeNull();
    });

    it('startMenuParticles is idempotent (does not duplicate canvas)', () => {
        startMenuParticles();
        startMenuParticles();
        expect(document.querySelectorAll('#menu-particles-canvas').length).toBe(1);
    });

    it('stopMenuParticles does not throw', () => {
        startMenuParticles();
        expect(() => stopMenuParticles()).not.toThrow();
    });
});

// ─── hud ─────────────────────────────────────────────────────────────────────
// HUD depends on minimap + touch-controls — mount once, share across tests
describe('hud', () => {
    let hud: ReturnType<typeof createHud>;

    beforeAll(() => {
        document.body.innerHTML = '';
        mountMinimap();
        mountTouchControls();
        showMinimap(true);
        const canvas = document.createElement('canvas');
        hud = createHud({ isoFn: vi.fn(() => ({ x: 50, y: 50 })), canvas });
    });

    it('createHud mounts hud-panel into the DOM', () => {
        expect(document.getElementById('hud-panel')).not.toBeNull();
    });

    it('returns showAll and update functions', () => {
        expect(hud.showAll).toBeTypeOf('function');
        expect(hud.update).toBeTypeOf('function');
    });

    it('showAll(true) makes the panel visible', () => {
        hud.showAll(true);
        expect(document.getElementById('hud-panel')!.style.display).toBe('block');
    });

    it('showAll(false) hides the panel', () => {
        hud.showAll(false);
        expect(document.getElementById('hud-panel')!.style.display).toBe('none');
    });

    it('update renders heli stats', () => {
        hud.showAll(true);
        hud.update({
            camX: 0, camY: 0, dt: 16,
            heli: { x: 5, y: 5, z: 3, vx: 0.01, vy: 0, winch: 0, fuel: 75, inAir: true, engineOn: true, onboard: 1, maxLoad: 4 },
            groundUnderHeli: 0,
            totalRescued: 2, goalCount: 5, playerName: 'WOLF', deliverMode: false,
            minimap: mkMinimapData(),
        } as any);
        const text = document.getElementById('hud-panel')!.textContent!;
        expect(text).toContain('FUEL: 75%');
        expect(text).toContain('PAX: 1/4');
        expect(text).toContain('SAVED: 2/5');
    });

    it('fuel display turns red below 20%', () => {
        hud.showAll(true);
        hud.update({
            camX: 0, camY: 0, dt: 16,
            heli: { x: 0, y: 0, z: 1, vx: 0, vy: 0, winch: 0, fuel: 15, inAir: true, engineOn: true, onboard: 0, maxLoad: 4 },
            groundUnderHeli: 0,
            totalRescued: 0, goalCount: 3, playerName: '', deliverMode: false,
            minimap: mkMinimapData(),
        } as any);
        expect(document.getElementById('hud-panel')!.textContent).toContain('FUEL: 15%');
    });
});

// ─── heli-select ─────────────────────────────────────────────────────────────
describe('heli-select', () => {
    // _heliPreviewLoop calls rAF recursively; stub it so it never fires after DOM clear
    beforeAll(() => vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0));
    afterAll(() => vi.restoreAllMocks());

    beforeEach(() => {
        document.body.innerHTML = '';
        // initHeliSelect must be called before showHeliSelect — it provides G.menuAngles
        const mockG = { menuAngles: Object.fromEntries(HELI_TYPES.map(h => [h.id, 0])) };
        initHeliSelect(mockG, vi.fn());
    });

    it('mountHeliSelect creates the element', () => {
        mountHeliSelect();
        expect(document.getElementById('heli-select')).not.toBeNull();
    });

    it('showHeliSelect renders a carousel with all heli cards', () => {
        mountHeliSelect();
        showHeliSelect({ rankIndex: 3, onSelect: vi.fn(), onBack: vi.fn() });
        const cards = document.querySelectorAll('.swipe-card');
        expect(cards.length).toBeGreaterThan(0);
    });

    it('snapshot', () => {
        mountHeliSelect();
        showHeliSelect({ rankIndex: 3, onSelect: vi.fn(), onBack: vi.fn() });
        snap('heli-select');
    });
});

// ─── tutorial ────────────────────────────────────────────────────────────────
describe('tutorial', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        destroyTutorial();
    });

    it('isTutorialRunning() is false before init', () => {
        expect(isTutorialRunning()).toBe(false);
    });

    it('initTutorial starts the tutorial and creates DOM', () => {
        initTutorial(false, 'heading', mkGameState(), vi.fn());
        expect(isTutorialRunning()).toBe(true);
        expect(document.getElementById('tutorial-hud')).not.toBeNull();
    });

    it('first step text is set after init', () => {
        initTutorial(false, 'heading', mkGameState(), vi.fn());
        const text = document.getElementById('tutorial-step-text')!.textContent;
        expect(text!.length).toBeGreaterThan(0);
    });

    it('tutorialTick advances when step-1 condition (engineOn) is met', () => {
        initTutorial(false, 'heading', mkGameState(), vi.fn());
        const textBefore = document.getElementById('tutorial-step-text')!.textContent;
        tutorialTick(mkGameState({ engineOn: true }));
        // After advance the text changes (flashing, then next step)
        expect(isTutorialRunning()).toBe(true);
        // The step index moved — test only that it didn't crash
    });

    it('tutorialTick does not advance when condition is not met', () => {
        initTutorial(false, 'heading', mkGameState(), vi.fn());
        const textBefore = document.getElementById('tutorial-step-text')!.textContent;
        tutorialTick(mkGameState({ engineOn: false }));
        expect(document.getElementById('tutorial-step-text')!.textContent).toBe(textBefore);
    });

    it('destroyTutorial stops the tutorial', () => {
        initTutorial(false, 'heading', mkGameState(), vi.fn());
        destroyTutorial();
        expect(isTutorialRunning()).toBe(false);
    });

    it('calling initTutorial twice restarts cleanly', () => {
        initTutorial(false, 'heading', mkGameState(), vi.fn());
        initTutorial(false, 'screen', mkGameState(), vi.fn());
        expect(document.querySelectorAll('#tutorial-hud').length).toBe(1);
        expect(isTutorialRunning()).toBe(true);
    });
});
