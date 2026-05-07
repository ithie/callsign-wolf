import './mute-button.css';

const HTML = `
<svg xmlns="http://www.w3.org/2000/svg" id="audio-mute-inactive" viewBox="0 0 32 32" width="32" height="32">
  <defs><filter id="glow"><feGaussianBlur stdDeviation="1.5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter></defs>
  <g filter="url(#glow)">
    <polygon points="4,11 4,21 9,21 16,27 16,5 9,11" fill="#ff6600" stroke="#ff8800" stroke-width="0.5"/>
    <path d="M19,11 Q23,16 19,21" fill="none" stroke="#ff6600" stroke-width="2" stroke-linecap="round"/>
    <path d="M22,8 Q28,16 22,24" fill="none" stroke="#ff6600" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  </g>
</svg>
<svg xmlns="http://www.w3.org/2000/svg" id="audio-mute-active" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <filter id="glow-red"><feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-grey"><feGaussianBlur stdDeviation="0.8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <polygon points="4,11 4,21 9,21 16,27 16,5 9,11" fill="#444" stroke="#555" stroke-width="0.5" filter="url(#glow-grey)"/>
  <g filter="url(#glow-red)">
    <line x1="20" y1="11" x2="28" y2="21" stroke="#ff2200" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="28" y1="11" x2="20" y2="21" stroke="#ff2200" stroke-width="2.5" stroke-linecap="round"/>
  </g>
</svg>`;

type MuteButtonDeps = {
    isMuted: () => boolean;
    onToggle: () => void;
};

import { ensureEl as _ensureEl } from '../dom-helpers';

export const mountMuteButton = (deps: MuteButtonDeps) => {
    const container = _ensureEl('hud-tl');
    let el = document.getElementById('audio-mute');
    if (!el) { el = document.createElement('div'); el.id = 'audio-mute'; container.appendChild(el); }
    el.innerHTML = HTML;
    el.onclick = (evt) => { evt.preventDefault(); deps.onToggle(); };
};

export const refreshMuteButton = (isMuted: boolean) => {
    const active   = document.getElementById('audio-mute-active');
    const inactive = document.getElementById('audio-mute-inactive');
    if (!active || !inactive) return;
    active.style.display   = isMuted ? 'flex' : 'none';
    inactive.style.display = isMuted ? 'none' : 'flex';
};
