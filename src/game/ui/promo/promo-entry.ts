import { mount as promoMount, show as promoShow } from './promo';
import { mount as imprintMount, show as imprintShow } from '../imprint-page/imprint-page';
import { mount as faqMount, show as faqShow } from '../faq-page/faq-page';

const _params = new URLSearchParams(location.search);
const _lang: 'de' | 'en' = _params.get('lang') === 'en' ? 'en' : 'de';
const _back = window.location.href.split('?')[0];

if (_params.has('faq')) {
    faqMount();
    faqShow(_back);
} else if (_params.has('imprint')) {
    imprintMount();
    imprintShow(_back, _lang);
} else {
    promoMount();
    promoShow();
}
