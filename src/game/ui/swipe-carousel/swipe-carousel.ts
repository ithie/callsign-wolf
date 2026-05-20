import './swipe-carousel.css';
import { hapticImpact, ImpactStyle } from '../../haptics';

export type SwipeCarouselOpts<T> = {
    items: T[];
    renderCard: (item: T, locked: boolean) => HTMLElement;
    renderStamp?: (item: T, locked: boolean) => HTMLElement | null;
    renderDetail?: (item: T, close: () => void) => HTMLElement | null;
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
    const { items, renderCard, renderStamp, renderDetail, isLocked, onTap, onDetailClose } = opts;

    const root = document.createElement('div');
    root.className = 'swipe-carousel';

    const track = document.createElement('div');
    track.className = 'swipe-track';

    const overlay = document.createElement('div');
    overlay.className = 'swipe-right-overlay';

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

        const slot = document.createElement('div');
        slot.className = 'swipe-slot';

        const card = renderCard(item, locked);
        card.classList.add('swipe-card');
        if (locked) card.classList.add('locked');
        card.dataset.index = String(i);
        slot.appendChild(card);

        const stamp = renderStamp?.(item, locked);
        if (stamp) slot.appendChild(stamp);

        track.appendChild(slot);
        return card;
    });

    const _cardStep = () => CARD_WIDTH + CARD_GAP;

    const _clampIndex = (i: number) => Math.max(0, Math.min(items.length - 1, i));

    const _totalTrackWidth = () =>
        items.length * CARD_WIDTH + Math.max(0, items.length - 1) * CARD_GAP;

    const _applyTransform = (extraDx = 0) => {
        const visibleWidth = root.offsetWidth;
        if (!visibleWidth) return;
        const totalW = _totalTrackWidth();

        let x: number;
        if (totalW <= visibleWidth) {
            // All cards fit — center the group, drags have no effect
            x = Math.round((visibleWidth - totalW) / 2);
        } else {
            // Left-aligned scroll — no per-card centering
            const idealX = -(state.index * _cardStep()) + extraDx;
            // Clamp: first card at left edge (≤ 0), last card at right edge (≥ visibleWidth-totalW)
            x = Math.max(visibleWidth - totalW, Math.min(0, idealX));
        }
        track.style.transform = `translateX(${x}px)`;
    };

    const _closeDetail = () => {
        if (state.openIndex === null) return;
        overlay.style.transformOrigin = 'center'; // symmetrical CRT collapse
        overlay.classList.add('crt-closing');
        cardEls.forEach(c => c.classList.remove('active'));
        onDetailClose?.();
        setTimeout(() => {
            state.openIndex = null;
            overlay.classList.remove('open', 'crt-closing');
            overlay.innerHTML = '';
        }, 385);
    };

    const _openDetail = (i: number) => {
        if (!renderDetail || overlay.classList.contains('crt-closing')) return;
        const content = renderDetail(items[i], _closeDetail);
        if (!content) return;

        // Morph origin: card's center in viewport coords
        const rect = cardEls[i].getBoundingClientRect();
        overlay.style.transformOrigin =
            `${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`;

        state.openIndex = i;
        overlay.innerHTML = '';
        overlay.appendChild(content);
        overlay.classList.remove('open'); // force animation restart if re-opened
        requestAnimationFrame(() => overlay.classList.add('open'));

        cardEls.forEach((c, ci) => c.classList.toggle('active', ci === i));
    };

    overlay.addEventListener('click', _closeDetail);

    const _goTo = (i: number) => {
        const next = _clampIndex(i);
        if (next !== state.index) hapticImpact(ImpactStyle.Light);
        state.index = next;
        _applyTransform();
    };

    const _onCardTap = (i: number) => {
        const locked = isLocked?.(items[i]) ?? false;
        if (locked) return;

        if (renderDetail) {
            _openDetail(i); // overlay covers screen — no need to scroll first
        } else {
            if (state.index !== i) _goTo(i);
            onTap?.(items[i]);
        }
    };

    // ── pointer handling ──────────────────────────────────────────────────────

    const _onPointerDown = (e: PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, .swipe-nav-btn')) return;
        if (state.openIndex !== null) return;

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

    root.addEventListener('contextmenu', e => e.preventDefault());

    root.appendChild(track);
    root.appendChild(overlay);

    // Apply initial centering without transition (suppress the slide-in animation)
    requestAnimationFrame(() => {
        track.classList.add('dragging');
        _applyTransform();
        requestAnimationFrame(() => track.classList.remove('dragging'));
    });

    return root;
};
