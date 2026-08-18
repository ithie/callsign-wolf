/// <reference types="vite/client" />

declare module '*.zsong' {
    const value: string;
    export default value;
}

declare module 'virtual:model-loader' {
    /** Called by plugin-generated stub code — not for direct use. */
    export function _r(stub: Record<string, unknown>, data: string, isHeli: boolean): void;
    /** Decompress heli models (atlas/dolphin/ornithopter/coasthawk). Fire-and-forget at app start. */
    export function decompressHelis(): Promise<void>;
    /** Decompress all non-heli ZDEF models. Must be awaited at mission loading screen. */
    export function decompressMissionAssets(): Promise<void>;
}

declare const __APP_VERSION__: string;
declare const __ORNI_SPAWN_RATE__: number;

interface ImportMetaEnv {
    readonly VITE_TARGET?: string;
}
interface ImportMeta {
    readonly env: ImportMetaEnv;
}

interface Window {
    __nativeStorage?: Record<string, string>;
    webkit?: {
        messageHandlers?: {
            storage?: { postMessage(data: unknown): void };
            haptics?: { postMessage(data: unknown): void };
            appReview?: { postMessage(data: unknown): void };
            controls?: { postMessage(data: unknown): void };
        };
    };
}
