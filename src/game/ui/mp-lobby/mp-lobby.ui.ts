import './mp-lobby.css';
import { I18N } from '../../i18n';
import { createBackButton } from '../back-button/back-button';
import { createRTCPeer } from '../../multiplayer/rtc';
import { HELI_TYPES } from '../../heli-types';
import type { MpChannels } from '../../multiplayer/rtc';
import type { MpEvent } from '../../multiplayer/sync';

export type MpLobbyCallbacks = {
    onConnected: (isHost: boolean, peerCallsign: string, channels: MpChannels, heliType: string) => void;
    onBack: () => void;
};

// ─── DOM helpers ──────────────────────────────────────────────────────────────

import { ensureEl as _ensureEl } from '../dom-helpers';

const screen = () => document.getElementById('mp-lobby-screen')!;
const el = (id: string) => document.getElementById(id)!;
const setStatus = (id: string, txt: string, cls?: 'ok' | 'error') => {
    const e = el(id);
    e.textContent = txt;
    e.className = 'mp-status' + (cls ? ` ${cls}` : '');
};
const _showEl = (id: string) => { el(id).style.display = 'flex'; };
const _hideEl = (id: string) => { el(id).style.display = 'none'; };

let _initialBackBtn: HTMLElement;
let _hostBackBtn: HTMLElement;
let _guestBackBtn: HTMLElement;

// ─── mount (called once at startup) ──────────────────────────────────────────

export const mount = (): void => {
    _ensureEl('mp-lobby-screen').classList.add('ui-screen');
    const heliCards = HELI_TYPES
        .map(h => `
            <div class="mp-heli-card" data-id="${h.id}">
                <div class="mp-heli-card-label">${h.selectLabel}</div>
                <div class="mp-heli-card-sub">${h.selectSub}</div>
            </div>`)
        .join('');

    screen().innerHTML = `
        <div class="title">${I18N.MENU_MULTIPLAYER}</div>
        <div class="subtitle" style="margin-bottom:8px">${I18N.MP_SUBTITLE}</div>

        <div id="mp-lobby-initial">
            <button class="mp-btn" id="mp-create-btn">${I18N.MP_CREATE}</button>
            <button class="mp-btn" id="mp-join-btn">${I18N.MP_JOIN}</button>
        </div>

        <!-- Host flow -->
        <div id="mp-host-flow" class="mp-flow" style="display:none">
            <div class="mp-status" id="mp-host-status">${I18N.MP_GENERATING}</div>
            <div class="mp-label">${I18N.MP_STEP1_HOST}</div>
            <textarea id="mp-offer-txt" class="mp-textarea" readonly></textarea>
            <div class="mp-row">
                <button class="mp-btn mp-btn-small" id="mp-copy-offer-btn">${I18N.MP_COPY}</button>
            </div>
            <div class="mp-label">${I18N.MP_STEP2_HOST}</div>
            <textarea id="mp-answer-input" class="mp-textarea" placeholder="${I18N.MP_PASTE_HINT}"></textarea>
            <button class="mp-btn" id="mp-connect-btn" disabled>${I18N.MP_CONNECT}</button>
        </div>

        <!-- Guest flow -->
        <div id="mp-guest-flow" class="mp-flow" style="display:none">
            <div class="mp-label">${I18N.MP_STEP1_GUEST}</div>
            <textarea id="mp-offer-input" class="mp-textarea" placeholder="${I18N.MP_PASTE_HINT}"></textarea>
            <button class="mp-btn" id="mp-gen-answer-btn">${I18N.MP_GEN_ANSWER}</button>
            <div class="mp-status" id="mp-guest-status"></div>
            <div class="mp-label" id="mp-guest-step2-label" style="display:none">${I18N.MP_STEP2_GUEST}</div>
            <textarea id="mp-answer-txt" class="mp-textarea" readonly style="display:none"></textarea>
            <div class="mp-row" id="mp-guest-copy-row" style="display:none">
                <button class="mp-btn mp-btn-small" id="mp-copy-answer-btn">${I18N.MP_COPY}</button>
            </div>
        </div>

        <!-- Heli select + ready phase (shared by host and guest) -->
        <div id="mp-heli-flow" class="mp-flow" style="display:none">
            <div class="mp-status ok" id="mp-ready-peer-label"></div>
            <div class="mp-label">${I18N.HELI_SELECT_SUB}</div>
            <div class="mp-heli-cards" id="mp-heli-cards">${heliCards}</div>
            <div class="mp-status" id="mp-ready-status">${I18N.MP_READY_PROMPT}</div>
            <button class="mp-btn" id="mp-ready-btn" disabled>${I18N.MP_READY_BTN}</button>
            <div id="mp-countdown-display" class="mp-countdown" style="display:none"></div>
        </div>`;

    _initialBackBtn = createBackButton(() => {});
    el('mp-lobby-initial').appendChild(_initialBackBtn);
    _hostBackBtn = createBackButton(() => {});
    el('mp-host-flow').appendChild(_hostBackBtn);
    _guestBackBtn = createBackButton(() => {});
    el('mp-guest-flow').appendChild(_guestBackBtn);
};

// ─── Heli select + Ready phase ────────────────────────────────────────────────

const _showHeliAndReadyPhase = (
    channels: MpChannels,
    isHost: boolean,
    peerCallsign: string,
    cb: MpLobbyCallbacks,
): void => {
    _hideEl('mp-host-flow');
    _hideEl('mp-guest-flow');
    _hideEl('mp-lobby-initial');
    _showEl('mp-heli-flow');

    el('mp-ready-peer-label').textContent =
        (peerCallsign || 'WOLF') + ' ' + I18N.MP_CONNECTED;

    let selectedHeli = '';
    let localReady = false;
    let peerReady = false;

    const readyBtn = el('mp-ready-btn') as HTMLButtonElement;

    // Heli card selection
    const cards = screen().querySelectorAll<HTMLElement>('.mp-heli-card');
    cards.forEach(card => {
        card.onclick = () => {
            if (localReady) return;
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedHeli = card.dataset.id!;
            readyBtn.disabled = false;
        };
    });

    const runCountdown = () => {
        _hideEl('mp-ready-btn');
        screen().querySelectorAll<HTMLElement>('.mp-heli-card').forEach(c => { c.style.pointerEvents = 'none'; });
        setStatus('mp-ready-status', '');
        const cdEl = el('mp-countdown-display');
        cdEl.style.display = 'block';
        const steps = ['3', '2', '1', 'LOS!'];
        let i = 0;
        const tick = () => {
            cdEl.textContent = steps[i++];
            if (i < steps.length) {
                setTimeout(tick, 1000);
            } else {
                setTimeout(() => {
                    hide();
                    cb.onConnected(isHost, peerCallsign, channels, selectedHeli);
                }, 700);
            }
        };
        tick();
    };

    const bothReady = () => {
        if (isHost) {
            channels.sendEvent({ t: 'start' });
        }
        runCountdown();
    };

    // Override event handler for ready/start phase
    channels.onEvent((evt: MpEvent) => {
        if (evt.t === 'ready') {
            peerReady = true;
            if (localReady) bothReady();
        } else if (evt.t === 'start') {
            // Guest receives start from host
            runCountdown();
        }
    });

    readyBtn.onclick = () => {
        localReady = true;
        readyBtn.disabled = true;
        setStatus('mp-ready-status', I18N.MP_WAIT_READY!);
        channels.sendEvent({ t: 'ready' });
        if (peerReady) bothReady();
    };
};

// ─── show / hide ──────────────────────────────────────────────────────────────

export const show = (cb: MpLobbyCallbacks): void => {
    // Reset to initial view
    _showEl('mp-lobby-initial');
    _hideEl('mp-host-flow');
    _hideEl('mp-guest-flow');
    _hideEl('mp-heli-flow');
    screen().style.display = 'flex';

    _initialBackBtn.onclick = cb.onBack;

    // ── Host flow ─────────────────────────────────────────────────────────────
    el('mp-create-btn').onclick = async () => {
        _hideEl('mp-lobby-initial');
        _showEl('mp-host-flow');
        setStatus('mp-host-status', I18N.MP_GENERATING!);

        const peer = createRTCPeer();

        peer.onConnect((channels: MpChannels) => {
            channels.sendEvent({ t: 'hello', callsign: _localCallsign });
            let peerCallsign = '';
            channels.onEvent((evt: MpEvent) => {
                if (evt.t === 'hello') {
                    peerCallsign = evt.callsign;
                    _showHeliAndReadyPhase(channels, true, peerCallsign, cb);
                }
            });
        });

        try {
            const offerB64 = await peer.createOffer();
            (el('mp-offer-txt') as HTMLTextAreaElement).value = offerB64;
            setStatus('mp-host-status', I18N.MP_WAIT_ANSWER!);

            el('mp-copy-offer-btn').onclick = () => {
                navigator.clipboard.writeText(offerB64).catch(() => {});
            };

            const answerInput = el('mp-answer-input') as HTMLTextAreaElement;
            const connectBtn = el('mp-connect-btn') as HTMLButtonElement;
            answerInput.oninput = () => {
                connectBtn.disabled = answerInput.value.trim().length < 10;
            };
            connectBtn.onclick = async () => {
                try {
                    connectBtn.disabled = true;
                    setStatus('mp-host-status', I18N.MP_CONNECTING!);
                    await peer.applyAnswer(answerInput.value.trim());
                } catch {
                    setStatus('mp-host-status', I18N.MP_ERROR!, 'error');
                    connectBtn.disabled = false;
                }
            };
        } catch {
            setStatus('mp-host-status', I18N.MP_ERROR!, 'error');
        }

        _hostBackBtn.onclick = () => {
            peer.close();
            _hideEl('mp-host-flow');
            _showEl('mp-lobby-initial');
        };
    };

    // ── Guest flow ────────────────────────────────────────────────────────────
    el('mp-join-btn').onclick = () => {
        _hideEl('mp-lobby-initial');
        _showEl('mp-guest-flow');

        const peer = createRTCPeer();

        peer.onConnect((channels: MpChannels) => {
            channels.sendEvent({ t: 'hello', callsign: _localCallsign });
            let peerCallsign = '';
            channels.onEvent((evt: MpEvent) => {
                if (evt.t === 'hello') {
                    peerCallsign = evt.callsign;
                    _showHeliAndReadyPhase(channels, false, peerCallsign, cb);
                }
            });
        });

        el('mp-gen-answer-btn').onclick = async () => {
            const offerTxt = (el('mp-offer-input') as HTMLTextAreaElement).value.trim();
            if (!offerTxt) return;
            setStatus('mp-guest-status', I18N.MP_GENERATING!);
            (el('mp-gen-answer-btn') as HTMLButtonElement).disabled = true;
            try {
                const answerB64 = await peer.createAnswer(offerTxt);
                (el('mp-answer-txt') as HTMLTextAreaElement).value = answerB64;
                el('mp-answer-txt').style.display = 'block';
                el('mp-guest-step2-label').style.display = 'block';
                el('mp-guest-copy-row').style.display = 'flex';
                setStatus('mp-guest-status', I18N.MP_WAIT_CONNECT!);

                el('mp-copy-answer-btn').onclick = () => {
                    navigator.clipboard.writeText(answerB64).catch(() => {});
                };
            } catch {
                setStatus('mp-guest-status', I18N.MP_ERROR!, 'error');
                (el('mp-gen-answer-btn') as HTMLButtonElement).disabled = false;
            }
        };

        _guestBackBtn.onclick = () => {
            peer.close();
            _hideEl('mp-guest-flow');
            _showEl('mp-lobby-initial');
        };
    };
};

export const hide = (): void => {
    screen().style.display = 'none';
};

// ─── local callsign (set before showing the lobby) ────────────────────────────

let _localCallsign = '';
export const setLobbyCallsign = (cs: string): void => { _localCallsign = cs; };
