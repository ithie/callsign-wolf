import './tutorial.css';
import { I18N } from '../../i18n';
import type { GameState } from '../../state';

type ControlHint = 'joystick-left' | 'joystick-right' | 'pitch-wheel' | 'deliver-toggle' | null;

interface TutorialStep {
    getText: (isTouch: boolean, mode: 'heading' | 'screen') => string;
    control: ControlHint;
    dimControls: NonNullable<ControlHint>[];
    condition: (g: GameState, mode: 'heading' | 'screen') => boolean;
}

let _startX = 0;
let _startY = 0;

const _STEPS: readonly TutorialStep[] = [
    // 1. Engine start
    {
        getText: (t) => t ? I18N.TUT_ENGINE_M : I18N.TUT_ENGINE_D,
        control: 'joystick-left',
        dimControls: ['joystick-right', 'pitch-wheel', 'deliver-toggle'],
        condition: g => g.heli.engineOn,
    },
    // 2. Climb
    {
        getText: (t) => t ? I18N.TUT_CLIMB_M : I18N.TUT_CLIMB_D,
        control: 'joystick-left',
        dimControls: ['joystick-right', 'pitch-wheel', 'deliver-toggle'],
        condition: g => g.heli.z >= 5,
    },
    // 3. Strafe
    {
        getText: (t) => t ? I18N.TUT_STRAFE_M : I18N.TUT_STRAFE_D,
        control: 'joystick-left',
        dimControls: ['joystick-right', 'pitch-wheel', 'deliver-toggle'],
        condition: g => Math.hypot(g.heli.x - _startX, g.heli.y - _startY) > 4,
    },
    // 4. Steer + accelerate (mode-dependent)
    {
        getText: (t, m) => m === 'heading'
            ? (t ? I18N.TUT_STEER_H_M : I18N.TUT_STEER_H_D)
            : (t ? I18N.TUT_STEER_S_M : I18N.TUT_STEER_S_D),
        control: 'joystick-right',
        dimControls: ['pitch-wheel', 'deliver-toggle'],
        condition: g => Math.hypot(g.heli.x - _startX, g.heli.y - _startY) > 12,
    },
    // 5. Land
    {
        getText: (t) => t ? I18N.TUT_LAND_M : I18N.TUT_LAND_D,
        control: 'joystick-left',
        dimControls: ['pitch-wheel', 'deliver-toggle'],
        condition: g => !g.heli.inAir && g.heli.z < 1.5,
    },
    // 6. Refuel
    {
        getText: () => I18N.TUT_REFUEL,
        control: null,
        dimControls: ['pitch-wheel', 'deliver-toggle'],
        condition: g => g.heli.fuel >= 90,
    },
    // 7. Locate person — approach within 5 tiles
    {
        getText: () => I18N.TUT_LOCATE_PERSON,
        control: 'joystick-right',
        dimControls: ['deliver-toggle'],
        condition: g => (g.payloads as any[]).some(
            (p: any) => p.type === 'person' && !p.rescued && !p.hanging &&
                Math.hypot(p.x - g.heli.x, p.y - g.heli.y) < 5
        ),
    },
    // 8. Lower winch over person
    {
        getText: (t) => t ? I18N.TUT_WINCH_DOWN_M : I18N.TUT_WINCH_DOWN_D,
        control: 'pitch-wheel',
        dimControls: ['deliver-toggle'],
        condition: g => (g.payloads as any[]).some((p: any) => p.type === 'person' && p.hanging),
    },
    // 9. Raise winch with person
    {
        getText: (t) => t ? I18N.TUT_WINCH_UP_M : I18N.TUT_WINCH_UP_D,
        control: 'pitch-wheel',
        dimControls: ['deliver-toggle'],
        condition: g => g.heli.onboard > 0,
    },
    // 10. Deliver person
    {
        getText: (t) => t ? I18N.TUT_DELIVER_PERSON_M : I18N.TUT_DELIVER_PERSON_D,
        control: 'deliver-toggle',
        dimControls: [],
        condition: g =>
            g.heli.onboard === 0 &&
            !(g.payloads as any[]).some((p: any) => p.type === 'person' && p.hanging),
    },
    // 11. Locate crate — approach within 5 tiles
    {
        getText: () => I18N.TUT_LOCATE_CRATE,
        control: 'joystick-right',
        dimControls: [],
        condition: g => (g.payloads as any[]).some(
            (p: any) => p.type === 'crate' && !p.rescued && !p.hanging &&
                Math.hypot(p.x - g.heli.x, p.y - g.heli.y) < 5
        ),
    },
    // 12. Lower winch over crate
    {
        getText: (t) => t ? I18N.TUT_WINCH_DOWN_M : I18N.TUT_WINCH_DOWN_D,
        control: 'pitch-wheel',
        dimControls: [],
        condition: g => (g.payloads as any[]).some((p: any) => p.type === 'crate' && p.hanging),
    },
    // 13. Raise winch with crate
    {
        getText: (t) => t ? I18N.TUT_WINCH_UP_M : I18N.TUT_WINCH_UP_D,
        control: 'pitch-wheel',
        dimControls: [],
        condition: g =>
            (g.activePayload as any)?.type === 'crate' && g.heli.winch < 0.5,
    },
    // 14. Deliver crate
    {
        getText: (t) => t ? I18N.TUT_DELIVER_CRATE_M : I18N.TUT_DELIVER_CRATE_D,
        control: 'deliver-toggle',
        dimControls: [],
        condition: g => !(g.payloads as any[]).some((p: any) => p.type === 'crate' && p.hanging),
    },
];

// ── Module state ──────────────────────────────────────────────────────────────

let _active = false;
let _stepIndex = 0;
let _isTouch = false;
let _controlMode: 'heading' | 'screen' = 'heading';
let _flashing = false;
let _flashTimeout = 0;
let _onComplete: (() => void) | null = null;

// ── Internal helpers ──────────────────────────────────────────────────────────

const _CONTROL_IDS: Record<NonNullable<ControlHint>, string> = {
    'joystick-left':  'joystick-left',
    'joystick-right': 'joystick-right',
    'pitch-wheel':    'touch-pitch-wheel',
    'deliver-toggle': 'touch-deliver-toggle',
};

const _ALL_HINTS: NonNullable<ControlHint>[] = ['joystick-left', 'joystick-right', 'pitch-wheel', 'deliver-toggle'];

const _setHighlight = (control: ControlHint): void => {
    _ALL_HINTS.forEach(id => {
        document.getElementById(_CONTROL_IDS[id])?.classList.remove('tutorial-highlight');
    });
    if (control) document.getElementById(_CONTROL_IDS[control])?.classList.add('tutorial-highlight');
};

const _setDim = (dimList: NonNullable<ControlHint>[]): void => {
    _ALL_HINTS.forEach(hint => {
        const el = document.getElementById(_CONTROL_IDS[hint]);
        if (!el) return;
        const dim = dimList.includes(hint);
        el.style.opacity = dim ? '0.1' : '';
        el.style.pointerEvents = dim ? 'none' : '';
    });
};

const _renderStep = (step: TutorialStep): void => {
    const el = document.getElementById('tutorial-step-text');
    if (el) el.textContent = step.getText(_isTouch, _controlMode);
    _setHighlight(step.control);
    _setDim(step.dimControls);
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
                el.textContent = I18N.TUT_DONE;
                _setHighlight(null);
                _setDim([]);
                const hud = document.getElementById('tutorial-hud');
                if (hud) hud.style.opacity = '0';
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

export const initTutorial = (
    isTouch: boolean,
    controlMode: 'heading' | 'screen',
    g: GameState,
    onComplete: () => void
): void => {
    destroyTutorial();

    _isTouch = isTouch;
    _controlMode = controlMode;
    _stepIndex = 0;
    _active = true;
    _onComplete = onComplete;
    _startX = g.START_POS?.x ?? g.heli.x;
    _startY = g.START_POS?.y ?? g.heli.y;

    g.heli.fuel = 15;

    if (!document.getElementById('tutorial-hud')) {
        const hud = document.createElement('div');
        hud.id = 'tutorial-hud';
        hud.innerHTML = '<div id="tutorial-step-text"></div>';
        document.body.appendChild(hud);
    }
    const hud = document.getElementById('tutorial-hud')!;
    hud.style.opacity = '1';

    _renderStep(_STEPS[0]);
};

export const tutorialTick = (g: GameState): void => {
    if (!_active || _flashing) return;
    if (_stepIndex >= _STEPS.length) return;

    const step = _STEPS[_stepIndex];
    if (!step.condition(g, _controlMode)) return;

    _stepIndex++;
    _flashOk(_STEPS[_stepIndex] ?? null);
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
    _setDim([]);
    document.getElementById('tutorial-hud')?.remove();
};
