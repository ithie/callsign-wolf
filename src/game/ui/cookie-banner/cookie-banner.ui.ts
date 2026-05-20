import { mount } from './cookie-banner';

export const Default = () => {
    mount();
    const el = document.getElementById('cookie-banner');
    if (el) el.style.display = 'flex';
};
