import { mount, show } from './mission-success-screen';
import { I18N } from '../../i18n';

// Case 1: Story mission with a next mission available
export const MissionSuccessWithNext = () => {
    mount(() => {}, () => {});
    show();
};

// Case 2: Last mission (or already-completed campaign) — only back button
export const MissionSuccessLastMission = () => {
    mount(null, () => {});
    show();
};

// Case 3: Tutorial completed — back goes to campaign select
export const MissionSuccessTutorial = () => {
    mount(null, () => {}, I18N.TO_CAMPAIGN_SELECT);
    show();
};
