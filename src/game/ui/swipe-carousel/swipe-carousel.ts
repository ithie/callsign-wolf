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
const DRAG_THRESHOLD = 20;
const AXIS_LOCK_THRESHOLD = 10;

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
        root.setPointerCapture(e.pointerId);
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

    root.addEventListener('pointerdown', _onPointerDown);
    root.addEventListener('pointermove', _onPointerMove);
    root.addEventListener('pointerup', _onPointerUp);
    root.addEventListener('pointercancel', () => {
        state.isDragging = false;
        track.classList.remove('dragging');
        _applyTransform();
    });

    // prevent context menu on long-press
    root.addEventListener('contextmenu', e => e.preventDefault());

    root.appendChild(track);
    root.appendChild(detailPanel);

    return root;
};
