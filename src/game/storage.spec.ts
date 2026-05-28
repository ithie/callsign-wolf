// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { storageGet, storageSet, storageRemove, initAppStorage } from './storage';

describe('storageGet / storageSet / storageRemove', () => {
    it('returns null for unknown key', () => {
        expect(storageGet('unknown-xyz')).toBeNull();
    });

    it('storageSet stores value in cache, get returns it immediately', () => {
        storageSet('my-key', 'hello');
        expect(storageGet('my-key')).toBe('hello');
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

    it('multiple keys are independent', () => {
        storageSet('a', '1');
        storageSet('b', '2');
        expect(storageGet('a')).toBe('1');
        expect(storageGet('b')).toBe('2');
        storageRemove('a');
        expect(storageGet('a')).toBeNull();
        expect(storageGet('b')).toBe('2');
    });

    it('storageSet posts to webkit storage handler', () => {
        const postMessage = vi.fn();
        (window as any).webkit = { messageHandlers: { storage: { postMessage } } };
        storageSet('x', '42');
        expect(postMessage).toHaveBeenCalledWith({ action: 'set', key: 'x', value: '42' });
        delete (window as any).webkit;
    });

    it('storageRemove posts to webkit storage handler', () => {
        const postMessage = vi.fn();
        (window as any).webkit = { messageHandlers: { storage: { postMessage } } };
        storageRemove('x');
        expect(postMessage).toHaveBeenCalledWith({ action: 'remove', key: 'x' });
        delete (window as any).webkit;
    });
});

describe('initAppStorage', () => {
    beforeEach(() => { delete (window as any).__nativeStorage; });

    it('populates cache from __nativeStorage', async () => {
        (window as any).__nativeStorage = { session: '{"name":"WOLF"}' };
        await initAppStorage(['session', 'settings']);
        expect(storageGet('session')).toBe('{"name":"WOLF"}');
        expect(storageGet('settings')).toBeNull();
    });

    it('empty key list does nothing', async () => {
        (window as any).__nativeStorage = {};
        await initAppStorage([]);
        expect(storageGet('nonexistent')).toBeNull();
    });

    it('missing __nativeStorage falls back to null for all keys', async () => {
        await initAppStorage(['a', 'b']);
        expect(storageGet('a')).toBeNull();
        expect(storageGet('b')).toBeNull();
    });
});
