import { Preferences } from '@capacitor/preferences';

const _cache = new Map<string, string | null>();

export const initAppStorage = async (keys: string[]): Promise<void> => {
    await Promise.all(keys.map(async key => {
        const { value } = await Preferences.get({ key });
        _cache.set(key, value);
    }));
};

export const storageGet = (key: string): string | null =>
    _cache.has(key) ? (_cache.get(key) ?? null) : null;

export const storageSet = (key: string, value: string): void => {
    _cache.set(key, value);
    void Preferences.set({ key, value });
};

export const storageRemove = (key: string): void => {
    _cache.delete(key);
    void Preferences.remove({ key });
};
