import { registerPlugin } from '@capacitor/core';

interface AppReviewPlugin {
    requestReview(): Promise<void>;
}

const AppReview = registerPlugin<AppReviewPlugin>('AppReview');

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

export const requestReview = (): void => {
    if (!_IS_APP) return;
    AppReview.requestReview().catch(() => {});
};
