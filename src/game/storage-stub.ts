export const initAppStorage = async (_keys: string[]): Promise<void> => {};

export const storageGet = (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
};

export const storageSet = (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch (_) {}
};

export const storageRemove = (key: string): void => {
    try { localStorage.removeItem(key); } catch (_) {}
};
