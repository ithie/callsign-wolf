export type VoiceEvent =
    | 'winch-down'
    | 'haul-up'
    | 'package-secured'
    | 'delivered'
    | 'no-zone'
    | 'drop-at-pad'
    | 'touchdown'
    | 'on-the-deck'
    | 'fuel-maxed'
    | 'liftoff'
    | 'bingo-fuel'
    | 'mayday'
    | 'deck-cleared';

type VoiceListener = (event: VoiceEvent) => void;

const _listeners = new Set<VoiceListener>();

export const voiceEvents = {
    emit: (event: VoiceEvent): void => { _listeners.forEach(fn => fn(event)); },
    on:   (fn: VoiceListener): void  => { _listeners.add(fn); },
    off:  (fn: VoiceListener): void  => { _listeners.delete(fn); },
};
