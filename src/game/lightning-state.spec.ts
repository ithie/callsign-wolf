import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setLightningActive, isLightningActive } from './lightning-state';

describe('lightning-state', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.runAllTimers(); vi.useRealTimers(); });

    it('is inactive by default', () => {
        expect(isLightningActive()).toBe(false);
    });

    it('becomes active immediately after setLightningActive()', () => {
        setLightningActive();
        expect(isLightningActive()).toBe(true);
    });

    it('is still active at 149ms', () => {
        setLightningActive();
        vi.advanceTimersByTime(149);
        expect(isLightningActive()).toBe(true);
    });

    it('deactivates at exactly 150ms', () => {
        setLightningActive();
        vi.advanceTimersByTime(150);
        expect(isLightningActive()).toBe(false);
    });

    it('second call re-arms the flag but first timeout wins', () => {
        setLightningActive();
        vi.advanceTimersByTime(100);
        setLightningActive();
        // First timeout fires at 150ms from start (50ms from here) → deactivates
        vi.advanceTimersByTime(50);
        expect(isLightningActive()).toBe(false);
    });

    it('back-to-back calls leave _active true until the first timeout fires', () => {
        setLightningActive();
        setLightningActive();
        vi.advanceTimersByTime(149);
        expect(isLightningActive()).toBe(true);
        vi.advanceTimersByTime(1);
        expect(isLightningActive()).toBe(false);
    });
});
