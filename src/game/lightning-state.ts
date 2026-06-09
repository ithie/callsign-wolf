let _active = false;

export const setLightningActive = () => {
    _active = true;
    setTimeout(() => { _active = false; }, 150);
};

export const isLightningActive = () => _active;
