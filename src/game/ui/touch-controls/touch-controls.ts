export const setDeliverToggle = (on: boolean): void => {
    window.webkit?.messageHandlers?.controls?.postMessage({ type: 'deliverToggle', on });
};

export const setRightStickProfi = (profi: boolean): void => {
    window.webkit?.messageHandlers?.controls?.postMessage({ type: 'controlMode', mode: profi ? 'screen' : 'heading' });
};
