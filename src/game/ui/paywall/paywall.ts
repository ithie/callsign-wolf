import './paywall.css';
import { I18N } from '../../i18n';
import { mountScreenShell } from '@/ui/screen-shell/screen-shell';
import { createSettingsBtn } from '../settings-btn/settings-btn';
import { showScreenCrtEnter } from '../nav';
import { storageSet, storageGet } from '../../storage';
import { UNLOCK_KEY } from '../../session';

declare global {
    interface Window {
        __iapResult?: (result: string) => void;
        __iapPrice?: (price: string) => void;
    }
}

const _post = (msg: Record<string, string>): void => {
    (window as any).webkit?.messageHandlers?.iap?.postMessage(msg);
};

export const mount = (): void => {
    mountScreenShell('paywall', '', undefined);
};

export const show = (onBack: () => void): void => {

    const body = mountScreenShell('paywall', I18N.PAYWALL_TITLE, () => {
        _cleanup();
        onBack();
    });

    const desc = document.createElement('p');
    desc.id = 'paywall-description';
    desc.textContent = I18N.PAYWALL_DESCRIPTION;

    const price = document.createElement('div');
    price.id = 'paywall-price';
    price.textContent = '…';

    const buyBtn = createSettingsBtn(I18N.PAYWALL_BUY, { id: 'paywall-buy-btn' });
    const restoreBtn = createSettingsBtn(I18N.PAYWALL_RESTORE, { id: 'paywall-restore-btn' });

    const hr = document.createElement('hr');
    hr.className = 'paywall-divider';

    const status = document.createElement('div');
    status.id = 'paywall-status';

    body.append(desc, price, buyBtn, hr, restoreBtn, status);

    const _setStatus = (msg: string, cls: 'success' | 'error' | 'pending' | '') => {
        status.textContent = msg;
        status.className = cls ? `status ${cls}` : '';
    };

    const _setPending = () => {
        buyBtn.disabled = true;
        restoreBtn.disabled = true;
        _setStatus(I18N.PAYWALL_PENDING, 'pending');
    };

    buyBtn.addEventListener('click', () => {
        _setPending();
        _post({ action: 'purchase' });
    });

    restoreBtn.addEventListener('click', () => {
        _setPending();
        _post({ action: 'restore' });
    });

    window.__iapResult = (result: string) => {
        buyBtn.disabled = false;
        restoreBtn.disabled = false;
        if (result === 'success' || result === 'already') {
            storageSet(UNLOCK_KEY, '1');
            _setStatus(I18N.PAYWALL_SUCCESS, 'success');
            setTimeout(() => {
                _cleanup();
                onBack();
            }, 1800);
        } else if (result === 'cancelled') {
            _setStatus('', '');
        } else {
            _setStatus(I18N.PAYWALL_ERROR, 'error');
        }
    };

    window.__iapPrice = (p: string) => {
        price.textContent = p;
    };

    _post({ action: 'loadPrice' });

    showScreenCrtEnter('paywall');
};

const _cleanup = (): void => {
    window.__iapResult = undefined;
    window.__iapPrice = undefined;
};

export const isFullVersionActive = (): boolean => storageGet(UNLOCK_KEY) === '1';
