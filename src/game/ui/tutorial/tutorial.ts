import './tutorial.css';
import { I18N } from '../../i18n';
import type { GameState } from '../../state';

// ── Types ──────────────────────────────────────────────────────────────────────

type ControlHint = 'joystick-left' | 'joystick-right' | 'pitch-wheel' | 'deliver-toggle' | null;

interface TutorialStep {
    getText: (isTouch: boolean) => string;
    control: ControlHint;
    dimControls: NonNullable<ControlHint>[];
    allowedKeys: Set<string> | null;
    condition: (g: GameState) => boolean;
    onComplete?: (g: GameState) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const _CLIMB_METERS  = 10;              // (z - groundZ) * 10 = 100m HUD
const _STEP_DIST     = 5;              // ≈50m horizontal
const _TURN_ANGLE    = Math.PI / 2;   // 90°
const _FUEL_LOCK_LAST = 8;            // steps 0–8: no fuel consumption

const _KEYS_CLIMB    = new Set(['KeyW']);
const _KEYS_TURN_L   = new Set(['ArrowLeft']);
const _KEYS_TURN_R   = new Set(['ArrowRight']);
const _KEYS_LEFT     = new Set(['KeyA']);
const _KEYS_RIGHT    = new Set(['KeyD']);
const _KEYS_FORWARD  = new Set(['ArrowUp']);
const _KEYS_BACKWARD = new Set(['ArrowDown']);
const _KEYS_LAND     = new Set(['KeyS']);
const _KEYS_NONE     = new Set<string>();

// ── Module state ───────────────────────────────────────────────────────────────

let _active         = false;
let _stepIndex      = 0;
let _prevStepIndex  = -1;
let _stepStartX     = 0;
let _stepStartY     = 0;
let _stepStartAngle = 0;
let _padGroundZ     = 0;
let _isTouch        = false;
let _flashing       = false;
let _flashTimeout   = 0;
let _lockX: number | null = null;
let _lockY: number | null = null;
let _lockZ: number | null = null;
let _lockAngle: number | null = null;
let _stepStartRescued = 0;
let _onComplete:    (() => void) | null = null;
let _onSpawnPerson: (() => void) | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────────

const _angleDiff = (a: number, b: number): number => {
    let d = a - b;
    while (d >  Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
};

// ── Steps ──────────────────────────────────────────────────────────────────────

const _STEPS: readonly TutorialStep[] = [
    // 0: Climb to 100m
    {
        getText: t => t ? I18N.TUT_TAKEOFF_M : I18N.TUT_TAKEOFF_D,
        control: 'joystick-left',
        dimControls: ['joystick-right', 'pitch-wheel', 'deliver-toggle'],
        allowedKeys: _KEYS_CLIMB,
        condition: g => g.heli.z >= _padGroundZ + _CLIMB_METERS,
    },
    // 1: Turn Left 90°
    {
        getText: t => t ? I18N.TUT_TURN_L_M : I18N.TUT_TURN_L_D,
        control: 'joystick-right',
        dimControls: ['joystick-left', 'pitch-wheel', 'deliver-toggle'],
        allowedKeys: _KEYS_TURN_L,
        condition: g => _angleDiff(g.heli.angle, _stepStartAngle) <= -_TURN_ANGLE,
    },
    // 2: Turn Right 90° — back to original heading
    {
        getText: t => t ? I18N.TUT_TURN_R_M : I18N.TUT_TURN_R_D,
        control: 'joystick-right',
        dimControls: ['joystick-left', 'pitch-wheel', 'deliver-toggle'],
        allowedKeys: _KEYS_TURN_R,
        condition: g => _angleDiff(g.heli.angle, _stepStartAngle) >= _TURN_ANGLE,
    },
    // 3: Strafe Left
    {
        getText: t => t ? I18N.TUT_STRAFE_L_M : I18N.TUT_STRAFE_L_D,
        control: 'joystick-left',
        dimControls: ['joystick-right', 'pitch-wheel', 'deliver-toggle'],
        allowedKeys: _KEYS_LEFT,
        condition: g => Math.hypot(g.heli.x - _stepStartX, g.heli.y - _stepStartY) >= _STEP_DIST,
    },
    // 4: Strafe Right — back over pad
    {
        getText: t => t ? I18N.TUT_STRAFE_R_M : I18N.TUT_STRAFE_R_D,
        control: 'joystick-left',
        dimControls: ['joystick-right', 'pitch-wheel', 'deliver-toggle'],
        allowedKeys: _KEYS_RIGHT,
        condition: g => Math.hypot(g.heli.x - _stepStartX, g.heli.y - _stepStartY) >= _STEP_DIST,
    },
    // 5: Forward
    {
        getText: t => t ? I18N.TUT_FORWARD_M : I18N.TUT_FORWARD_D,
        control: 'joystick-right',
        dimControls: ['joystick-left', 'pitch-wheel', 'deliver-toggle'],
        allowedKeys: _KEYS_FORWARD,
        condition: g => Math.hypot(g.heli.x - _stepStartX, g.heli.y - _stepStartY) >= _STEP_DIST,
    },
    // 6: Backward — back over pad; drops fuel to 15% on complete
    {
        getText: t => t ? I18N.TUT_BACKWARD_M : I18N.TUT_BACKWARD_D,
        control: 'joystick-right',
        dimControls: ['joystick-left', 'pitch-wheel', 'deliver-toggle'],
        allowedKeys: _KEYS_BACKWARD,
        condition: g => Math.hypot(g.heli.x - _stepStartX, g.heli.y - _stepStartY) >= _STEP_DIST,
        onComplete: g => { g.heli.fuel = 15; },
    },
    // 7: Land — S only; x/y stays locked over pad from step 6
    {
        getText: t => t ? I18N.TUT_LAND_M : I18N.TUT_LAND_D,
        control: 'joystick-left',
        dimControls: ['joystick-right', 'pitch-wheel', 'deliver-toggle'],
        allowedKeys: _KEYS_LAND,
        condition: g => !g.heli.inAir && g.heli.z < 1.5,
    },
    // 8: Refuel
    {
        getText: () => I18N.TUT_REFUEL,
        control: null,
        dimControls: ['pitch-wheel', 'deliver-toggle'],
        allowedKeys: null,
        condition: g => g.heli.fuel >= 90,
    },
    // 9: Locate crate
    {
        getText: () => I18N.TUT_LOCATE_CRATE,
        control: 'joystick-right',
        dimControls: ['deliver-toggle'],
        allowedKeys: null,
        condition: g => (g.payloads as any[]).some(
            p => p.type === 'crate' && !p.rescued && !p.hanging &&
                 Math.hypot(p.x - g.heli.x, p.y - g.heli.y) < 5
        ),
    },
    // 10: Pick up crate
    {
        getText: t => t ? I18N.TUT_CRATE_PICKUP_M : I18N.TUT_CRATE_PICKUP_D,
        control: 'pitch-wheel',
        dimControls: ['deliver-toggle'],
        allowedKeys: null,
        condition: g => (g.payloads as any[]).some(p => p.type === 'crate' && p.hanging),
    },
    // 11: Deliver crate → spawn person on complete
    {
        getText: t => t ? I18N.TUT_CRATE_TO_PAD_M : I18N.TUT_CRATE_TO_PAD_D,
        control: null,
        dimControls: [],
        allowedKeys: null,
        condition: g => (g.payloads as any[]).some(p => p.type === 'crate' && p.rescued),
        onComplete: () => { _onSpawnPerson?.(); },
    },
    // 12: Locate person
    {
        getText: () => I18N.TUT_LOCATE_PERSON,
        control: 'joystick-right',
        dimControls: [],
        allowedKeys: null,
        condition: g => (g.payloads as any[]).some(
            p => p.type === 'person' && !p.rescued && !p.hanging && !p.isDelivery &&
                 Math.hypot(p.x - g.heli.x, p.y - g.heli.y) < 5
        ),
    },
    // 13: Pick up person
    {
        getText: t => t ? I18N.TUT_PERSON_PICKUP_M : I18N.TUT_PERSON_PICKUP_D,
        control: 'pitch-wheel',
        dimControls: [],
        allowedKeys: null,
        condition: g => g.heli.onboard > 0,
    },
    // 14: Deliver person to pad — fires when totalRescued increases (simulation handles delivery)
    {
        getText: t => t ? I18N.TUT_PERSON_TO_PAD_M : I18N.TUT_PERSON_TO_PAD_D,
        control: null,
        dimControls: [],
        allowedKeys: null,
        condition: g => g.totalRescued > _stepStartRescued,
    },
];

// ── DOM helpers ────────────────────────────────────────────────────────────────

const _CONTROL_IDS: Record<NonNullable<ControlHint>, string> = {
    'joystick-left':  'joystick-left',
    'joystick-right': 'joystick-right',
    'pitch-wheel':    'touch-pitch-wheel',
    'deliver-toggle': 'touch-deliver-toggle',
};
const _ALL_HINTS: NonNullable<ControlHint>[] =
    ['joystick-left', 'joystick-right', 'pitch-wheel', 'deliver-toggle'];

const _setHighlight = (control: ControlHint): void => {
    _ALL_HINTS.forEach(id =>
        document.getElementById(_CONTROL_IDS[id])?.classList.remove('tutorial-highlight')
    );
    if (control) document.getElementById(_CONTROL_IDS[control])?.classList.add('tutorial-highlight');
};

const _setDim = (dimList: NonNullable<ControlHint>[]): void => {
    _ALL_HINTS.forEach(hint => {
        const el = document.getElementById(_CONTROL_IDS[hint]);
        if (!el) return;
        const dim = dimList.includes(hint);
        el.style.opacity      = dim ? '0.1' : '';
        el.style.pointerEvents = dim ? 'none' : '';
    });
};

const _renderStep = (step: TutorialStep): void => {
    const el = document.getElementById('tutorial-step-text');
    if (el) el.textContent = step.getText(_isTouch);
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

// ── Lock management ────────────────────────────────────────────────────────────

const _clearLocksForStep = (idx: number): void => {
    if (idx === 0) {
        _lockX = _lockY = _lockZ = _lockAngle = null;
    } else if (idx === 2) {
        // Turn Right: release angle lock so player can turn
        _lockAngle = null;
    } else if (idx >= 3 && idx <= 6) {
        // Position steps: release previous position lock; altitude stays locked
        _lockX = _lockY = null;
        _lockAngle = null;
    } else if (idx === 7) {
        // Landing: release altitude so heli can descend; keep x/y over pad
        _lockZ = null;
    } else if (idx >= 8) {
        _lockX = _lockY = _lockZ = _lockAngle = null;
    }
    // Step 1 (Turn Left): keep _lockZ from step 0, no angle lock yet
};

// ── Public API ─────────────────────────────────────────────────────────────────

export const isTutorialRunning = (): boolean => _active;

export const getAllowedKeys = (): Set<string> | null => {
    if (!_active) return null;
    if (_flashing) return _KEYS_NONE;
    return _STEPS[_stepIndex]?.allowedKeys ?? null;
};

export const isTutorialFuelLocked = (): boolean =>
    _active && _stepIndex <= _FUEL_LOCK_LAST;

export const initTutorial = (
    isTouch: boolean,
    g: GameState,
    padGroundZ: number,
    onComplete: () => void,
    onSpawnPerson: () => void,
): void => {
    destroyTutorial();
    _isTouch        = isTouch;
    _padGroundZ     = padGroundZ;
    _stepIndex      = 0;
    _prevStepIndex  = -1;
    _active         = true;
    _lockX = _lockY = _lockZ = _lockAngle = null;
    _onComplete     = onComplete;
    _onSpawnPerson  = onSpawnPerson;

    // Person payloads spawn later via onSpawnPerson (step 11 onComplete)
    (g as any).payloads = (g.payloads as any[]).filter((p: any) => p.type !== 'person');

    if (!document.getElementById('tutorial-hud')) {
        const hud = document.createElement('div');
        hud.id = 'tutorial-hud';
        hud.innerHTML = '<div id="tutorial-step-text"></div>';
        document.body.appendChild(hud);
    }
    document.getElementById('tutorial-hud')!.style.opacity = '1';
    _renderStep(_STEPS[0]);
};

export const tutorialTick = (g: GameState): void => {
    if (!_active) return;

    // Always apply locks — runs even during flash to keep heli frozen
    if (_lockZ     !== null) { g.heli.z     = _lockZ;     g.heli.vz   = 0; }
    if (_lockAngle !== null) { g.heli.angle = _lockAngle; g.heli.roll = 0; }
    if (_lockX     !== null) { g.heli.x     = _lockX; g.heli.y = _lockY!; g.heli.vx = 0; g.heli.vy = 0; }

    if (_flashing) return;
    if (_stepIndex >= _STEPS.length) return;

    // Update step-start state on transition
    if (_stepIndex !== _prevStepIndex) {
        _stepStartX       = g.heli.x;
        _stepStartY       = g.heli.y;
        _stepStartAngle   = g.heli.angle;
        _stepStartRescued = g.totalRescued;
        _clearLocksForStep(_stepIndex);
        _prevStepIndex    = _stepIndex;
    }

    // Cap + completion check
    let completed = false;

    if (_stepIndex === 0) {
        const target = _padGroundZ + _CLIMB_METERS;
        if (g.heli.z >= target) {
            g.heli.z = target; g.heli.vz = 0;
            _lockZ = target;
            completed = true;
        }
    } else if (_stepIndex === 1) {
        if (_angleDiff(g.heli.angle, _stepStartAngle) <= -_TURN_ANGLE) {
            g.heli.angle = _stepStartAngle - _TURN_ANGLE; g.heli.roll = 0;
            _lockAngle = g.heli.angle;
            completed = true;
        }
    } else if (_stepIndex === 2) {
        if (_angleDiff(g.heli.angle, _stepStartAngle) >= _TURN_ANGLE) {
            g.heli.angle = _stepStartAngle + _TURN_ANGLE; g.heli.roll = 0;
            _lockAngle = g.heli.angle;
            completed = true;
        }
    } else if (_stepIndex >= 3 && _stepIndex <= 6) {
        const dx   = g.heli.x - _stepStartX;
        const dy   = g.heli.y - _stepStartY;
        const dist = Math.hypot(dx, dy);
        if (dist >= _STEP_DIST) {
            const ratio = _STEP_DIST / dist;
            g.heli.x = _stepStartX + dx * ratio;
            g.heli.y = _stepStartY + dy * ratio;
            g.heli.vx = 0; g.heli.vy = 0;
            _lockX = g.heli.x; _lockY = g.heli.y;
            completed = true;
        }
    } else {
        completed = _STEPS[_stepIndex].condition(g);
    }

    if (!completed) return;

    _STEPS[_stepIndex].onComplete?.(g);
    _stepIndex++;
    _flashOk(_STEPS[_stepIndex] ?? null);
};

export const destroyTutorial = (): void => {
    _active        = false;
    _flashing      = false;
    _onComplete    = null;
    _onSpawnPerson = null;
    _lockX = _lockY = _lockZ = _lockAngle = null;
    if (_flashTimeout) { clearTimeout(_flashTimeout); _flashTimeout = 0; }
    _setHighlight(null);
    _setDim([]);
    document.getElementById('tutorial-hud')?.remove();
};
