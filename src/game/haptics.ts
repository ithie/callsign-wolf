import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const hapticImpact = (style: ImpactStyle = ImpactStyle.Medium): void => {
    Haptics.impact({ style }).catch(() => {});
};

export const hapticNotification = (type: NotificationType = NotificationType.Success): void => {
    Haptics.notification({ type }).catch(() => {});
};

export { ImpactStyle, NotificationType };
