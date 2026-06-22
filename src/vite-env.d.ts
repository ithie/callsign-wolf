/// <reference types="vite/client" />

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
