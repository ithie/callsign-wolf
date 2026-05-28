export const ImpactStyle = { Heavy: 'Heavy', Medium: 'Medium', Light: 'Light' } as const;
export const NotificationType = { Success: 'Success', Warning: 'Warning', Error: 'Error' } as const;
export type ImpactStyle = typeof ImpactStyle[keyof typeof ImpactStyle];
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

export const hapticImpact = (style: ImpactStyle = ImpactStyle.Medium): void => {
    window.webkit?.messageHandlers?.haptics?.postMessage({ type: 'impact', style });
};

export const hapticNotification = (type: NotificationType = NotificationType.Success): void => {
    window.webkit?.messageHandlers?.haptics?.postMessage({ type: 'notification', notificationType: type });
};
