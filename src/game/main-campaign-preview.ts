import { campaignHandler } from './main';
import type { CampaignExport } from '@/shared/types';
import './game';

// Dev-only entry point used by the VS Code Campaign Preview.
// Fetches the currently open .zcampaign file from the Vite dev server by key,
// then replaces the static campaign list before window.onload fires.
// Top-level await defers window.onload until the fetch completes.
const _key = new URLSearchParams(location.search).get('preview') ?? '';
if (_key) {
    const { default: data } = await import(`/src/game/campaigns/${_key}.zcampaign`);
    (campaignHandler as any)._replaceCampaigns([data as CampaignExport]);
}
