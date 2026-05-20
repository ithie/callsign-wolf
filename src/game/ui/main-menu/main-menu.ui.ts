import { mount } from './main-menu';
import { showScreenCrtEnter } from '../nav';

export const Default = () => {
    mount({ onSplashClick: () => {}, onStart: () => {}, onSettings: () => {}, onCredits: () => {}, onLegal: () => {} });
    showScreenCrtEnter('main-menu');
};
