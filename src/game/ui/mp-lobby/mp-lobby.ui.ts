import { mount, show } from './mp-lobby';

export const Default = () => {
    mount();
    show({
        onConnected: (isHost, peerCallsign, _channels, heliType) =>
            console.log('connected', { isHost, peerCallsign, heliType }),
        onBack: () => console.log('back'),
    });
};
