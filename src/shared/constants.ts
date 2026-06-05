export const COLORS = {
    water: '#004488',
    waterNight: '#001433',
    bgNight: '#000408',
    bgRain: '#001122',
    padStroke: '#5f5',
    padFill: 'rgba(0, 255, 0, 0.4)',
    padNight: '#2a2',
    carrierBase: '#888',
    carrierNight: '#333',
    carrierAccent: 'red',
    carrierPath: 'orange',
    lighthouseBase: '#d22',
    lighthouseLight: '#fff',
    uiHighlight: '#ffcc00',
    windActive: 'cyan',
    textLight: '#fff',
    textDark: '#000',
    shadow: 'rgba(0, 0, 0, 0.5)',
};

export const getSandColor = (height: number): string => {
    const c = 35 + height * 15;
    return `rgb(${Math.min(240, c + 160)},${Math.min(215, c + 135)},${Math.min(140, c + 55)})`;
};

export const getLandColor = (height: number, isNight: boolean): string => {
    let r = 50 + height * 20;
    let g = 150 + height * 10;
    let b = 50;

    if (isNight) {
        r = Math.floor(r * 0.3);
        g = Math.floor(g * 0.4);
        b = Math.floor(b * 0.6);
    }

    return `rgb(${r}, ${g}, ${b})`;
};
