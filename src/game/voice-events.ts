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
    | 'deck-cleared'
    | 'vessel-leaving-60'
    | 'vessel-leaving-30';

type VoiceListener = (event: VoiceEvent, name?: string) => void;

const _listeners = new Set<VoiceListener>();

export const voiceEvents = {
    emit:     (event: VoiceEvent, name?: string): void => { _listeners.forEach(fn => fn(event, name)); },
    on:       (fn: VoiceListener): void  => { _listeners.add(fn); },
    off:      (fn: VoiceListener): void  => { _listeners.delete(fn); },
};
