import { campaignHandler } from './main';
import { G } from './state';

export interface StartZone {
    getPos(): { x: number; y: number; z: number };
    getAngle(): number;
}

export const buildStartZone = (): StartZone =>
    campaignHandler.getCurrentMissionData().spawnObject === 'carrier'
        ? {
              getPos: () => ({
                  x: G.CARRIER.x - 4.0 * Math.cos(G.CARRIER.angle),
                  y: G.CARRIER.y - 4.0 * Math.sin(G.CARRIER.angle),
                  z: G.CARRIER.zDeck + 0.1,
              }),
              getAngle: () => G.CARRIER.angle,
          }
        : {
              getPos: () => ({ x: G.START_POS.x, y: G.START_POS.y, z: G.PAD?.z ?? 0.5 }),
              getAngle: () => 0,
          };
