// ── Input Handlers ────────────────────────────────────────────────────────────
// Sets up all window-level input: keyboard, native touch controls, Mac bridge.
// Deps are injected via initInputHandlers() to avoid circular imports.
import { CANVAS_SCALE } from './render-config';

export interface InputDeps {
    keys: Record<string, boolean>;
    isKeyAllowed: (code: string) => boolean;
    isTutorialRunning: () => boolean;
    notifyTutorialInput: () => void;
    canvas: HTMLCanvasElement;
}

export const initInputHandlers = (deps: InputDeps): void => {
    const { keys, isKeyAllowed, isTutorialRunning, notifyTutorialInput, canvas } = deps;

    const _resizeCanvas = () => {
        canvas.width = Math.round(window.innerWidth * CANVAS_SCALE);
        canvas.height = Math.round(window.innerHeight * CANVAS_SCALE);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
    };
    window.addEventListener('resize', _resizeCanvas);
    _resizeCanvas();

    if (typeof (window as any).__nativeStorage === 'undefined') {
        window.onkeydown = e => {
            if (isKeyAllowed(e.code)) keys[e.code] = true;
            if ((document.activeElement as HTMLElement)?.tagName === 'INPUT') return;
        };
        window.onkeyup = e => { keys[e.code] = false; };
    }

    document.addEventListener('selectstart', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });

    const _LEFT_KEYS = ['KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight'] as const;
    const _RIGHT_KEYS = ['ArrowUp', 'ArrowDown', 'KeyA', 'KeyD'] as const;

    (window as any).__nativeControls = (input: {
        leftKey: string | null;
        rightKey: string | null;
        pitchWheel: { dy: number; active: boolean };
        deliverBtn: boolean;
    }) => {
        for (const k of _LEFT_KEYS) keys[k] = false;
        for (const k of _RIGHT_KEYS) keys[k] = false;
        if (input.leftKey && isKeyAllowed(input.leftKey)) keys[input.leftKey] = true;
        if (input.rightKey && isKeyAllowed(input.rightKey)) keys[input.rightKey] = true;
        keys['KeyQ'] = input.pitchWheel.active && input.pitchWheel.dy < -6;
        keys['KeyE'] = input.pitchWheel.active && input.pitchWheel.dy > 6;
        keys['KeyR'] = input.deliverBtn;
        if (isTutorialRunning() && (input.leftKey || input.rightKey || input.pitchWheel.active || input.deliverBtn))
            notifyTutorialInput();
    };

    const _MAC_KEYS = new Set([
        'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyR',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    ]);

    (window as any).__setKey = (code: string, down: boolean) => {
        if (!_MAC_KEYS.has(code)) return;
        if (down) {
            if (isKeyAllowed(code)) keys[code] = true;
        } else {
            keys[code] = false;
        }
        if (isTutorialRunning() && down) notifyTutorialInput();
    };

    (window as any).__clearAllKeys = () => {
        _MAC_KEYS.forEach(k => { keys[k] = false; });
    };
};
