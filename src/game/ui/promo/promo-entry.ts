import { mount as promoMount, show as promoShow } from './promo';
import { mount as imprintMount, show as imprintShow } from '../imprint-page/imprint-page';

if (new URLSearchParams(location.search).has('imprint')) {
    imprintMount();
    imprintShow('https://ithie.github.io/callsign-wolf');
} else {
    promoMount();
    promoShow();
}
