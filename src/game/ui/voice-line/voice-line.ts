import './voice-line.css';
import { playSfx } from '../../heli-sound';
import { voiceEvents, type VoiceEvent } from '../../voice-events';

const VOICE_LINES: Record<VoiceEvent, string> = {
    'liftoff':          'CABIN CLEAR. LIFTOFF!',
    'winch-down':       'WINCH DOWN.',
    'haul-up':          'HAULING UP.',
    'package-secured':  'PACKAGE SECURED.',
    'delivered':        'DELIVERED.',
    'no-zone':          'NO DROP ZONE.',
    'drop-at-pad':      'DROP AT LANDING PAD.',
    'touchdown':        'TOUCHDOWN.',
    'on-the-deck':      "YOU'RE ON THE DECK.",
    'fuel-maxed':       'FUEL MAXED.',
    'bingo-fuel':       "WE'RE BINGO FUEL!",
    'mayday':           'HELI 1, DO YOU COPY? HELI 1?',
    'deck-cleared':     'DECK CLEARED.',
};

let _el: HTMLElement | null = null;
let _hideTimer: ReturnType<typeof setTimeout> | null = null;

const _onVoiceEvent = (event: VoiceEvent): void => {
    if (!_el) return;
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    _el.textContent = VOICE_LINES[event];
    _el.style.display = 'block';
    playSfx(520, 0.04, 0.05, 'square');
    _hideTimer = setTimeout(() => {
        if (_el) _el.style.display = 'none';
        _hideTimer = null;
    }, 3000);
};

export const mountVoiceLine = (): void => {
    if (_el) return;
    _el = document.createElement('div');
    _el.id = 'voice-line';
    document.body.appendChild(_el);
    voiceEvents.on(_onVoiceEvent);
};

export const hideVoiceLine = (): void => {
    if (_hideTimer) { clearTimeout(_hideTimer); _hideTimer = null; }
    if (_el) _el.style.display = 'none';
};
