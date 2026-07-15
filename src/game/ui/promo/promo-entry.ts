import { mount as promoMount, show as promoShow } from './promo';
import { mount as imprintMount, show as imprintShow } from '../imprint-page/imprint-page';

if (new URLSearchParams(location.search).has('imprint')) {
    imprintMount();
    imprintShow(window.location.href.split('?')[0]);
} else {
    promoMount();
    promoShow();
}
