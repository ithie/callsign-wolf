import { vi } from 'vitest';

vi.mock('@capacitor/preferences', () => ({
    Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import { storageGet, storageSet, storageRemove, initAppStorage } from './storage';

// ─── Cache-Verhalten (in-memory, kein echtes Capacitor) ───────────────────────

describe('storageGet / storageSet / storageRemove', () => {
    beforeEach(() => {
        vi.mocked(Preferences.get).mockResolvedValue({ value: null });
        vi.mocked(Preferences.set).mockResolvedValue();
        vi.mocked(Preferences.remove).mockResolvedValue();
    });

    it('returns null for unknown key', () => {
        expect(storageGet('unknown-key-xyz')).toBeNull();
    });

    it('storageSet stores value in cache, get returns it immediately', () => {
        storageSet('my-key', 'hello');
        expect(storageGet('my-key')).toBe('hello');
    });

    it('storageSet also calls Preferences.set', () => {
        storageSet('my-key', 'hello');
        expect(Preferences.set).toHaveBeenCalledWith({ key: 'my-key', value: 'hello' });
    });

    it('storageSet overwrites previous value', () => {
        storageSet('k', 'first');
        storageSet('k', 'second');
        expect(storageGet('k')).toBe('second');
    });

    it('storageRemove deletes key from cache', () => {
        storageSet('rem-key', 'value');
        storageRemove('rem-key');
        expect(storageGet('rem-key')).toBeNull();
    });

    it('storageRemove calls Preferences.remove', () => {
        storageRemove('rem-key');
        expect(Preferences.remove).toHaveBeenCalledWith({ key: 'rem-key' });
    });

    it('multiple keys are independent', () => {
        storageSet('a', '1');
        storageSet('b', '2');
        expect(storageGet('a')).toBe('1');
        expect(storageGet('b')).toBe('2');
        storageRemove('a');
        expect(storageGet('a')).toBeNull();
        expect(storageGet('b')).toBe('2');
    });
});

// ─── initAppStorage ───────────────────────────────────────────────────────────

describe('initAppStorage', () => {
    beforeEach(() => {
        vi.mocked(Preferences.get).mockReset();
        vi.mocked(Preferences.set).mockResolvedValue();
        vi.mocked(Preferences.remove).mockResolvedValue();
    });

    it('populates cache from Preferences.get for each key', async () => {
        vi.mocked(Preferences.get).mockImplementation(async ({ key }) => ({
            value: key === 'session' ? '{"name":"WOLF"}' : null,
        }));
        await initAppStorage(['session', 'settings']);
        expect(storageGet('session')).toBe('{"name":"WOLF"}');
        expect(storageGet('settings')).toBeNull();
    });

    it('calls Preferences.get for every requested key', async () => {
        vi.mocked(Preferences.get).mockResolvedValue({ value: null });
        await initAppStorage(['a', 'b', 'c']);
        expect(Preferences.get).toHaveBeenCalledTimes(3);
    });

    it('empty key list does nothing', async () => {
        vi.mocked(Preferences.get).mockResolvedValue({ value: null });
        await initAppStorage([]);
        expect(Preferences.get).not.toHaveBeenCalled();
    });
});
