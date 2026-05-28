export const requestReview = (): void => {
    window.webkit?.messageHandlers?.appReview?.postMessage(null);
};
