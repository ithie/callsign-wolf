export const setDeliverToggle = (on: boolean): void => {
    window.webkit?.messageHandlers?.controls?.postMessage({ type: 'deliverToggle', on });
};
