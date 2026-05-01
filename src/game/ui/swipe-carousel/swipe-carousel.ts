import './swipe-carousel.css';

export type SwipeCarouselOpts<T> = {
    items: T[];
    renderCard: (item: T, locked: boolean) => HTMLElement;
    renderDetail?: (item: T) => HTMLElement | null;
    isLocked?: (item: T) => boolean;
    onTap?: (item: T) => void;
    onDetailClose?: () => void;
};

type CarouselState = {
    index: number;
    openIndex: number | null;
    pointerStartX: number;
    pointerStartY: number;
    pointerCurrentX: number;
    isDragging: boolean;
    hasMoved: boolean;
};

const CARD_WIDTH = 280;
const CARD_GAP = 16;
const DRAG_THRESHOLD = 30;
const AXIS_LOCK_THRESHOLD = 8;

export const createSwipeCarousel = <T>(opts: SwipeCarouselOpts<T>): HTMLElement => {
    const { items, renderCard, renderDetail, isLocked, onTap, onDetailClose } = opts;

    const root = document.createElement('div');
    root.className = 'swipe-carousel';

    const track = document.createElement('div');
    track.className = 'swipe-track';

    const detailPanel = document.createElement('div');
    detailPanel.className = 'swipe-detail-panel';

    const detailInner = document.createElement('div');
    detailInner.className = 'swipe-detail-inner';
    detailPanel.appendChild(detailInner);

    const state: CarouselState = {
        index: 0,
        openIndex: null,
        pointerStartX: 0,
        pointerStartY: 0,
        pointerCurrentX: 0,
        isDragging: false,
        hasMoved: false,
    };

    const cardEls: HTMLElement[] = items.map((item, i) => {
        const locked = isLocked?.(item) ?? false;
        const card = renderCard(item, locked);
        card.classList.add('swipe-card');
        if (locked) card.classList.add('locked');
        card.dataset.index = String(i);
        track.appendChild(card);
        return card;
    });

    const _cardStep = () => CARD_WIDTH + CARD_GAP;

    const _clampIndex = (i: number) => Math.max(0, Math.min(items.length - 1, i));

    const _applyTransform = (extraDx = 0) => {
        const x = -(state.index * _cardStep()) + extraDx;
        track.style.transform = `translateX(${x}px)`;
    };

    const _updateDots = () => {
        root.querySelectorAll('.swipe-dot').forEach((d, i) => {
            d.classList.toggle('active', i === state.index);
        });
        root.querySelector('.swipe-nav-btn.prev')?.classList.toggle('disabled', state.index === 0);
        root.querySelector('.swipe-nav-btn.next')?.classList.toggle('disabled', state.index >= items.length - 1);
    };

    const _openDetail = (i: number) => {
        if (!renderDetail) return;
        const item = items[i];
        const content = renderDetail(item);
        if (!content) return;

        state.openIndex = i;
        detailInner.innerHTML = '';
        detailInner.appendChild(content);
        detailPanel.classList.add('open');

        cardEls.forEach((c, ci) => c.classList.toggle('active', ci === i));
    };

    const _closeDetail = () => {
        state.openIndex = null;
        detailPanel.classList.remove('open');
        cardEls.forEach(c => c.classList.remove('active'));
        onDetailClose?.();
    };

    const _goTo = (i: number) => {
        state.index = _clampIndex(i);
        _applyTransform();
        _updateDots();
    };

    const _onCardTap = (i: number) => {
        const locked = isLocked?.(items[i]) ?? false;
        if (locked) return;

        if (renderDetail) {
            if (state.openIndex === i) {
                _closeDetail();
            } else {
                if (state.index !== i) _goTo(i);
                _openDetail(i);
            }
        } else {
            onTap?.(items[i]);
        }
    };

    // ── pointer handling ──────────────────────────────────────────────────────

    const _onPointerDown = (e: PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, .swipe-nav-btn')) return;
        state.pointerStartX = e.clientX;
        state.pointerStartY = e.clientY;
        state.pointerCurrentX = e.clientX;
        state.isDragging = true;
        state.hasMoved = false;
        track.classList.add('dragging');
        track.setPointerCapture(e.pointerId);
    };

    const _onPointerMove = (e: PointerEvent) => {
        if (!state.isDragging) return;
        const dx = e.clientX - state.pointerStartX;
        const dy = e.clientY - state.pointerStartY;

        // axis-lock: if moving more vertically, cancel horizontal drag
        if (!state.hasMoved && Math.abs(dy) > AXIS_LOCK_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
            state.isDragging = false;
            track.classList.remove('dragging');
            return;
        }

        if (Math.abs(dx) > AXIS_LOCK_THRESHOLD) state.hasMoved = true;
        state.pointerCurrentX = e.clientX;
        _applyTransform(dx);
    };

    const _onPointerUp = (e: PointerEvent) => {
        if (!state.isDragging) return;
        state.isDragging = false;
        track.classList.remove('dragging');

        const dx = e.clientX - state.pointerStartX;
        if (Math.abs(dx) >= DRAG_THRESHOLD) {
            const direction = dx < 0 ? 1 : -1;
            _goTo(state.index + direction);
            _closeDetail();
        } else if (!state.hasMoved) {
            // treat as tap: find which card was under pointer
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const cardEl = el?.closest('[data-index]') as HTMLElement | null;
            if (cardEl && cardEl.dataset.index !== undefined) {
                _onCardTap(Number(cardEl.dataset.index));
            }
        } else {
            _applyTransform();
        }
    };

    track.addEventListener('pointerdown', _onPointerDown);
    track.addEventListener('pointermove', _onPointerMove);
    track.addEventListener('pointerup', _onPointerUp);
    track.addEventListener('pointercancel', () => {
        state.isDragging = false;
        track.classList.remove('dragging');
        _applyTransform();
    });

    // prevent context menu on long-press
    track.addEventListener('contextmenu', e => e.preventDefault());

    // ── nav buttons + dots ────────────────────────────────────────────────────

    const nav = document.createElement('div');
    nav.className = 'swipe-nav';

    const prevBtn = document.createElement('div');
    prevBtn.className = 'swipe-nav-btn prev disabled';
    prevBtn.textContent = '◀';
    prevBtn.addEventListener('click', () => { _goTo(state.index - 1); _closeDetail(); });

    const dots = document.createElement('div');
    dots.className = 'swipe-dots';
    items.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'swipe-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => { _goTo(i); _closeDetail(); });
        dots.appendChild(dot);
    });

    const nextBtn = document.createElement('div');
    nextBtn.className = 'swipe-nav-btn next' + (items.length <= 1 ? ' disabled' : '');
    nextBtn.textContent = '▶';
    nextBtn.addEventListener('click', () => { _goTo(state.index + 1); _closeDetail(); });

    nav.appendChild(prevBtn);
    nav.appendChild(dots);
    nav.appendChild(nextBtn);

    root.appendChild(track);
    root.appendChild(detailPanel);
    root.appendChild(nav);

    return root;
};
