import './touch-controls.css';

let _toggleEl: HTMLElement | null = null;

export const setDeliverToggle = (on: boolean): void => {
    _toggleEl?.classList.toggle('on', on);
};

export const mount = (): void => {
    if (document.getElementById('touch-controls')) return;
    const el = document.createElement('div');
    el.id = 'touch-controls';
    el.innerHTML = `
        <div id="touch-pad-left">
            <div id="touch-top-row">
                <div id="touch-pitch-wheel" title="Winschen">
                    <div id="touch-pitch-drum"></div>
                    <div id="touch-pitch-indicator"></div>
                    <span class="pitch-label pitch-up">↑</span>
                    <span class="pitch-label pitch-dn">↓</span>
                </div>
                <div id="touch-deliver-toggle" class="touch-btn" data-key="KeyR" title="Absetz-Modus">
                    <div class="toggle-housing">
                        <div class="toggle-rocker"></div>
                    </div>
                </div>
            </div>
            <div class="joystick" id="joystick-left">
                <span class="js-n">W</span><span class="js-s">S</span>
                <span class="js-w">A</span><span class="js-e">D</span>
                <div class="joystick-knob"></div>
            </div>
        </div>
        <div class="joystick" id="joystick-right">
            <div class="js-safe-zone"></div>
            <span class="js-n">▲</span><span class="js-s">▼</span>
            <span class="js-w">◀</span><span class="js-e">▶</span>
            <div class="joystick-knob"></div>
        </div>`;
    document.body.appendChild(el);

    _toggleEl = el.querySelector('#touch-deliver-toggle');
};

export const setRightStickProfi = (profi: boolean): void => {
    document.getElementById('joystick-right')?.classList.toggle('profi', profi);
};

export const initPitchWheel = (setKey: (key: string, val: boolean) => void): void => {
    const wheel = document.querySelector<HTMLElement>('#touch-pitch-wheel');
    if (!wheel) return;
    const drum = wheel.querySelector<HTMLElement>('#touch-pitch-drum')!;
    const ind  = wheel.querySelector<HTMLElement>('#touch-pitch-indicator')!;
    const DEAD = 6, MAX = 48;
    let startY = 0, active = false;

    const release = () => {
        setKey('KeyQ', false); setKey('KeyE', false);
        drum.style.transition = 'transform 0.2s ease-out';
        drum.style.transform  = 'translateY(0)';
        ind.style.transition  = 'top 0.2s ease-out';
        ind.style.top         = '50%';
        ind.classList.remove('active');
        wheel.classList.remove('active-up', 'active-dn');
    };

    wheel.addEventListener('pointerdown', e => {
        e.preventDefault();
        wheel.setPointerCapture(e.pointerId);
        startY = e.clientY; active = true;
        drum.style.transition = 'none';
        ind.style.transition  = 'none';
        ind.classList.add('active');
    });
    wheel.addEventListener('pointermove', e => {
        if (!active) return;
        const dy = Math.max(-MAX, Math.min(MAX, e.clientY - startY));
        drum.style.transform = `translateY(${dy * 0.6}px)`;
        ind.style.top = `${wheel.offsetHeight / 2 + dy}px`;
        setKey('KeyQ', dy < -DEAD);
        setKey('KeyE', dy >  DEAD);
        wheel.classList.toggle('active-up', dy < -DEAD);
        wheel.classList.toggle('active-dn', dy >  DEAD);
    });
    wheel.addEventListener('pointerup',     () => { active = false; release(); });
    wheel.addEventListener('pointercancel', () => { active = false; release(); });
};
