import { campaignHandler } from './main';
import { G } from './state';
import { applyVesselOffset } from './sim/world-init';

export interface StartZone {
    getPos(): { x: number; y: number; z: number };
    getAngle(): number;
}

export const buildStartZone = (): StartZone =>
    campaignHandler.getCurrentMissionData().spawnObject === 'carrier'
        ? {
              getPos: () => ({
                  ...applyVesselOffset(G.CARRIER, -4, 0),
                  z: G.CARRIER.zDeck + 0.1,
              }),
              getAngle: () => G.CARRIER.angle,
          }
        : {
              getPos: () => ({ x: G.START_POS.x, y: G.START_POS.y, z: G.PAD?.z ?? 0.5 }),
              getAngle: () => 0,
          };
