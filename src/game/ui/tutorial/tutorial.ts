import './tutorial.css';
import { LANG } from '../../i18n';
import type { GameState } from '../../state';

type ControlHint = 'joystick-left' | 'joystick-right' | 'pitch-wheel' | 'deliver-toggle' | null;

interface TutorialStep {
    text: { de: { desktop: string; mobile: string }; en: { desktop: string; mobile: string } };
    control: ControlHint;
    condition: (g: GameState) => boolean;
}

// Start position captured at initTutorial time — used by "has the player moved?" condition
let _startX = 0;
let _startY = 0;

const _MISSIONS: readonly (readonly TutorialStep[])[] = [
    // ── Mission 0: Starten & Landen ──────────────────────────────────────────
    [
        {
            text: {
                de: { desktop: 'MOTOR STARTEN — DRÜCKE [W]', mobile: 'MOTOR STARTEN — LINKEN STICK NACH OBEN' },
                en: { desktop: 'START ENGINE — PRESS [W]', mobile: 'START ENGINE — PUSH LEFT STICK UP' },
            },
            control: 'joystick-left',
            condition: g => g.heli.engineOn,
        },
        {
            text: {
                de: { desktop: 'STEIGEN — MINDESTENS 5 METER HÖHE', mobile: 'STEIGEN — LINKEN STICK HOCHHALTEN' },
                en: { desktop: 'CLIMB — REACH AT LEAST 5 METRES', mobile: 'CLIMB — HOLD LEFT STICK UP' },
            },
            control: 'joystick-left',
            condition: g => g.heli.z >= 5,
        },
        {
            text: {
                de: { desktop: 'MANÖVRIEREN — BEWEGE MIT [A][D][W][S]', mobile: 'MANÖVRIEREN — RECHTEN STICK BEWEGEN' },
                en: { desktop: 'MANOEUVRE — MOVE WITH [A][D][W][S]', mobile: 'MANOEUVRE — MOVE THE RIGHT STICK' },
            },
            control: 'joystick-right',
            condition: g => Math.hypot(g.heli.x - _startX, g.heli.y - _startY) > 5,
        },
        {
            text: {
                de: { desktop: 'LANDEN — MOTOR DROSSELN MIT [S]', mobile: 'LANDEN — LINKEN STICK NACH UNTEN' },
                en: { desktop: 'LAND — REDUCE THROTTLE WITH [S]', mobile: 'LAND — PUSH LEFT STICK DOWN' },
            },
            control: 'joystick-left',
            condition: g => !g.heli.inAir && g.heli.z < 1.5,
        },
    ],

    // ── Mission 1: Nachtanken ─────────────────────────────────────────────────
    // Heli starts airborne with low fuel — no engine-start step needed
    [
        {
            text: {
                de: { desktop: 'ZUM LANDEPLATZ FLIEGEN — MINIMAP NUTZEN', mobile: 'ZUM LANDEPLATZ FLIEGEN — MINIMAP NUTZEN' },
                en: { desktop: 'FLY TO LANDING PAD — USE MINIMAP', mobile: 'FLY TO LANDING PAD — USE MINIMAP' },
            },
            control: 'joystick-right',
            condition: g =>
                g.PAD !== null &&
                Math.hypot(g.heli.x - (g.PAD.xMin + 3.5), g.heli.y - (g.PAD.yMin + 3.5)) < 8,
        },
        {
            text: {
                de: { desktop: 'LANDEN UND WARTEN — TANKWAGEN KOMMT', mobile: 'LANDEN UND WARTEN — TANKWAGEN KOMMT' },
                en: { desktop: 'LAND AND WAIT — FUEL TRUCK IS COMING', mobile: 'LAND AND WAIT — FUEL TRUCK IS COMING' },
            },
            control: 'joystick-left',
            condition: g => g.heli.fuel >= 90,
        },
    ],

    // ── Mission 2: Personenrettung ────────────────────────────────────────────
    [
        {
            text: {
                de: { desktop: 'MOTOR STARTEN — DRÜCKE [W]', mobile: 'MOTOR STARTEN — LINKEN STICK NACH OBEN' },
                en: { desktop: 'START ENGINE — PRESS [W]', mobile: 'START ENGINE — PUSH LEFT STICK UP' },
            },
            control: 'joystick-left',
            condition: g => g.heli.engineOn,
        },
        {
            text: {
                de: { desktop: 'PERSON SUCHEN — MINIMAP NUTZEN', mobile: 'PERSON SUCHEN — MINIMAP NUTZEN' },
                en: { desktop: 'LOCATE SURVIVOR — USE MINIMAP', mobile: 'LOCATE SURVIVOR — USE MINIMAP' },
            },
            control: 'joystick-right',
            condition: g => (g.payloads as any[]).some((p: any) => p.type === 'person' && p.hanging),
        },
        {
            text: {
                de: { desktop: 'WINSCHEN — [E] LASSEN, [Q] EINHOLEN', mobile: 'WINSCHEN — PITCH-RAD NACH UNTEN DREHEN' },
                en: { desktop: 'WINCH — [E] TO LOWER, [Q] TO RAISE', mobile: 'WINCH — ROLL PITCH WHEEL DOWNWARD' },
            },
            control: 'pitch-wheel',
            condition: g => g.heli.onboard > 0,
        },
        {
            text: {
                de: { desktop: 'ZUR BASIS ZURÜCK UND LANDEN', mobile: 'ZUR BASIS ZURÜCK UND LANDEN' },
                en: { desktop: 'RETURN TO BASE AND LAND', mobile: 'RETURN TO BASE AND LAND' },
            },
            control: 'joystick-right',
            condition: g =>
                (g.payloads as any[]).filter((p: any) => p.type === 'person').every((p: any) => p.rescued),
        },
    ],

    // ── Mission 3: Kisten bergen ──────────────────────────────────────────────
    [
        {
            text: {
                de: { desktop: 'MOTOR STARTEN — DRÜCKE [W]', mobile: 'MOTOR STARTEN — LINKEN STICK NACH OBEN' },
                en: { desktop: 'START ENGINE — PRESS [W]', mobile: 'START ENGINE — PUSH LEFT STICK UP' },
            },
            control: 'joystick-left',
            condition: g => g.heli.engineOn,
        },
        {
            text: {
                de: { desktop: 'KISTE SUCHEN — MINIMAP NUTZEN', mobile: 'KISTE SUCHEN — MINIMAP NUTZEN' },
                en: { desktop: 'FIND CRATE — USE MINIMAP', mobile: 'FIND CRATE — USE MINIMAP' },
            },
            control: 'joystick-right',
            condition: g => g.activePayload !== null && (g.activePayload as any)?.type === 'crate',
        },
        {
            text: {
                de: { desktop: 'KISTE ZUR BASIS FLIEGEN UND ABLIEFERN', mobile: 'KISTE ZUR BASIS FLIEGEN UND ABLIEFERN' },
                en: { desktop: 'FLY CRATE TO BASE AND DELIVER', mobile: 'FLY CRATE TO BASE AND DELIVER' },
            },
            control: 'joystick-right',
            condition: g => (g.payloads as any[]).some((p: any) => p.type === 'crate' && p.rescued),
        },
    ],
];

// ── Module state ──────────────────────────────────────────────────────────────

let _active = false;
let _missionIndex = -1;
let _stepIndex = 0;
let _isTouch = false;
let _flashing = false;
let _flashTimeout = 0;
let _onComplete: (() => void) | null = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

const _CONTROL_IDS: Record<NonNullable<ControlHint>, string> = {
    'joystick-left': 'joystick-left',
    'joystick-right': 'joystick-right',
    'pitch-wheel': 'touch-pitch-wheel',
    'deliver-toggle': 'touch-deliver-toggle',
};

const _setHighlight = (control: ControlHint): void => {
    Object.values(_CONTROL_IDS).forEach(id => {
        document.getElementById(id)?.classList.remove('tutorial-highlight');
    });
    if (control) {
        document.getElementById(_CONTROL_IDS[control])?.classList.add('tutorial-highlight');
    }
};

const _stepText = (step: TutorialStep): string => {
    const lang = LANG;
    const platform = _isTouch ? 'mobile' : 'desktop';
    return (step.text[lang] ?? step.text.de)[platform];
};

const _renderStep = (step: TutorialStep): void => {
    const el = document.getElementById('tutorial-step-text');
    if (el) el.textContent = _stepText(step);
    _setHighlight(step.control);
};

const _flashOk = (next: TutorialStep | null): void => {
    _flashing = true;
    const el = document.getElementById('tutorial-step-text');
    if (el) {
        el.classList.add('flash-ok');
        _flashTimeout = window.setTimeout(() => {
            el.classList.remove('flash-ok');
            _flashing = false;
            if (next) {
                _renderStep(next);
            } else {
                const hud = document.getElementById('tutorial-hud');
                if (hud) hud.style.opacity = '0';
                _setHighlight(null);
                if (_active) _onComplete?.();
            }
        }, 700);
    } else {
        _flashing = false;
        if (!next && _active) _onComplete?.();
    }
};

// ── Public API ────────────────────────────────────────────────────────────────

export const isTutorialRunning = (): boolean => _active;

export const initTutorial = (missionIndex: number, isTouch: boolean, g: GameState, onComplete: () => void): void => {
    destroyTutorial();
    if (missionIndex < 0 || missionIndex >= _MISSIONS.length) return;

    _missionIndex = missionIndex;
    _stepIndex = 0;
    _isTouch = isTouch;
    _active = true;
    _onComplete = onComplete;
    _startX = g.START_POS?.x ?? g.heli.x;
    _startY = g.START_POS?.y ?? g.heli.y;

    // Mission 1 (Nachtanken): start with low fuel so the player has to refuel
    if (missionIndex === 1) g.heli.fuel = 20;

    if (!document.getElementById('tutorial-hud')) {
        const hud = document.createElement('div');
        hud.id = 'tutorial-hud';
        hud.innerHTML = '<div id="tutorial-step-text"></div>';
        document.body.appendChild(hud);
    }
    const hud = document.getElementById('tutorial-hud')!;
    hud.style.opacity = '1';

    const steps = _MISSIONS[missionIndex];
    if (steps.length > 0) _renderStep(steps[0]);
};

export const tutorialTick = (g: GameState): void => {
    if (!_active || _flashing) return;
    const steps = _MISSIONS[_missionIndex];
    if (!steps || _stepIndex >= steps.length) return;

    const step = steps[_stepIndex];
    if (!step.condition(g)) return;

    _stepIndex++;
    _flashOk(steps[_stepIndex] ?? null);
};

export const destroyTutorial = (): void => {
    _active = false;
    _flashing = false;
    _onComplete = null;
    if (_flashTimeout) {
        clearTimeout(_flashTimeout);
        _flashTimeout = 0;
    }
    _setHighlight(null);
    document.getElementById('tutorial-hud')?.remove();
};
