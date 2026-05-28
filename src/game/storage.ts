const _cache = new Map<string, string | null>();

export const initAppStorage = (_keys: string[]): Promise<void> => {
    const native = window.__nativeStorage ?? {};
    for (const key of _keys) {
        _cache.set(key, native[key] ?? null);
    }
    return Promise.resolve();
};

export const storageGet = (key: string): string | null =>
    _cache.has(key) ? (_cache.get(key) ?? null) : null;

export const storageSet = (key: string, value: string): void => {
    _cache.set(key, value);
    window.webkit?.messageHandlers?.storage?.postMessage({ action: 'set', key, value });
};

export const storageRemove = (key: string): void => {
    _cache.delete(key);
    window.webkit?.messageHandlers?.storage?.postMessage({ action: 'remove', key });
};
