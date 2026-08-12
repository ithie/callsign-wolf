import { mount, show } from './paywall';

const _noop = () => {};

const _withPrice = (price: string) => {
    const orig = window.__iapPrice;
    requestAnimationFrame(() => {
        window.__iapPrice?.(price);
        window.__iapPrice = orig;
    });
};

/** Standard-Ansicht — Preis wird per Swift-Bridge geliefert, hier mit "2,99 €" simuliert. */
export const Default = () => {
    mount();
    show(_noop);
    _withPrice('2,99 €');
};

/** Ladeanimation während Kauf läuft. */
export const Pending = () => {
    mount();
    show(_noop);
    _withPrice('2,99 €');
    requestAnimationFrame(() => {
        (document.getElementById('paywall-buy-btn') as HTMLButtonElement).disabled = true;
        (document.getElementById('paywall-restore-btn') as HTMLButtonElement).disabled = true;
        const s = document.getElementById('paywall-status')!;
        s.textContent = 'BITTE WARTEN…';
        s.className = 'status pending';
    });
};

/** Kauf erfolgreich. */
export const Success = () => {
    mount();
    show(_noop);
    _withPrice('2,99 €');
    requestAnimationFrame(() => {
        const s = document.getElementById('paywall-status')!;
        s.textContent = 'VOLLVERSION AKTIV!';
        s.className = 'status success';
    });
};

/** Kauf fehlgeschlagen. */
export const Error = () => {
    mount();
    show(_noop);
    _withPrice('2,99 €');
    requestAnimationFrame(() => {
        const s = document.getElementById('paywall-status')!;
        s.textContent = 'FEHLER BEIM KAUF';
        s.className = 'status error';
    });
};
