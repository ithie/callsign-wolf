import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const _IS_APP = import.meta.env.VITE_TARGET === 'app';

export const hapticImpact = (style: ImpactStyle = ImpactStyle.Medium): void => {
    if (!_IS_APP) return;
    Haptics.impact({ style }).catch(() => {});
};

export const hapticNotification = (type: NotificationType = NotificationType.Success): void => {
    if (!_IS_APP) return;
    Haptics.notification({ type }).catch(() => {});
};

export { ImpactStyle, NotificationType };
