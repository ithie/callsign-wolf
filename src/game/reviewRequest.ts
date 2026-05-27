import { registerPlugin } from '@capacitor/core';

interface AppReviewPlugin {
    requestReview(): Promise<void>;
}

const AppReview = registerPlugin<AppReviewPlugin>('AppReview');

export const requestReview = (): void => {
    AppReview.requestReview().catch(() => {});
};
