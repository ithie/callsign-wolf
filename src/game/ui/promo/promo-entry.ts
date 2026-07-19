import { mount as promoMount, show as promoShow } from './promo';
import { mount as imprintMount, show as imprintShow } from '../imprint-page/imprint-page';

if (new URLSearchParams(location.search).has('imprint')) {
    const _imprintParams = new URLSearchParams(location.search);
    const _imprintLang: 'de' | 'en' = _imprintParams.get('lang') === 'en' ? 'en' : 'de';
    imprintMount();
    imprintShow(window.location.href.split('?')[0], _imprintLang);
} else {
    promoMount();
    promoShow();
}
