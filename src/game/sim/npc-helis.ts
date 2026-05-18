import { G, type NpcHeli } from '../state';
import { campaignHandler } from '../main';
import { getGround } from './terrain';

const PATROL_ALT = 9;
const PATROL_R   = 11;
const PATROL_PTS = 7;
const VARIANCE   = 3.5;
const SPEED      = 0.055;
const TURN_RATE  = 0.022;

const CARRIER_SLOTS: { type: string; xRel: number; yRel: number; angle: number }[] = [
    { type: 'coasthawk', xRel: 7.0, yRel: -2.5, angle: Math.PI * 0.19 },
    { type: 'coasthawk', xRel: 1.5, yRel: -2.7, angle: Math.PI * 0.15 },
    { type: 'dolphin',   xRel: 7.0, yRel:  2.5, angle: Math.PI * 0.55 },
];

const COORDINATOR_SLOT = CARRIER_SLOTS[2]; // the dolphin

const genWaypoints = (): { x: number; y: number }[] => {
    const spots = G.payloads.filter((p: any) => !p.rescued);
    if (spots.length === 0) return [];
    const cx = spots.reduce((s: number, p: any) => s + p.x, 0) / spots.length;
    const cy = spots.reduce((s: number, p: any) => s + p.y, 0) / spots.length;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < PATROL_PTS; i++) {
        const a = (i / PATROL_PTS) * Math.PI * 2;
        pts.push({
            x: cx + Math.cos(a) * PATROL_R + (Math.random() - 0.5) * VARIANCE * 2,
            y: cy + Math.sin(a) * PATROL_R + (Math.random() - 0.5) * VARIANCE * 2,
        });
    }
    return pts;
};

const snapToCarrier = (npc: NpcHeli) => {
    if (!G.CARRIER?.x) return;
    const cosA = Math.cos(G.CARRIER.angle), sinA = Math.sin(G.CARRIER.angle);
    npc.x = G.CARRIER.x + npc.parkXRel * cosA - npc.parkYRel * sinA;
    npc.y = G.CARRIER.y + npc.parkXRel * sinA + npc.parkYRel * cosA;
    npc.z = G.CARRIER.zDeck + 0.1;
    npc.angle = npc.parkAngle + G.CARRIER.angle;
};

const makeNpc = (slot: typeof CARRIER_SLOTS[0], autoTakeoff: boolean, cruiseZ: number, waypoints: { x: number; y: number }[]): NpcHeli => {
    const npc: NpcHeli = {
        type: slot.type,
        x: 0, y: 0, z: 0,
        angle: slot.angle,
        tilt: 0, roll: 0, rotorRPM: 0, rotationPos: 0,
        state: 'PARKED',
        autoTakeoff,
        parkXRel: slot.xRel, parkYRel: slot.yRel, parkAngle: slot.angle,
        waypoints,
        wpI: 0,
        cruiseZ,
    };
    snapToCarrier(npc);
    return npc;
};

export const initNpcHelisFromMission = () => {
    G.npcHelis = [];
    if (!G.CARRIER?.x) return;

    const md = campaignHandler.getCurrentMissionData();
    const carrierObj = (md.objects || []).find((o: any) => o.type === 'carrier') as any;
    const hasCoordinator = carrierObj?.coordinatorHeli === true;

    const wps = hasCoordinator ? genWaypoints() : [];
    const firstWp = wps[0];
    const cruiseZ = firstWp ? Math.max(G.waterLevel, getGround(firstWp.x, firstWp.y)) + PATROL_ALT : G.CARRIER.zDeck + PATROL_ALT;

    for (const slot of CARRIER_SLOTS) {
        const isCoordSlot = slot === COORDINATOR_SLOT && hasCoordinator;
        const npc = makeNpc(slot, isCoordSlot, cruiseZ, isCoordSlot ? wps : []);
        if (isCoordSlot) npc.state = 'TAKEOFF'; // already departed before player arrives
        G.npcHelis.push(npc);
    }
};

export const updateNpcHelis = (dt: number) => {
    for (const npc of G.npcHelis) {
        if (npc.state === 'PARKED') {
            snapToCarrier(npc);
            npc.tilt = 0; npc.roll = 0; npc.rotorRPM = 0;
            if (npc.autoTakeoff) npc.state = 'TAKEOFF';
            continue;
        }

        if (npc.state === 'TAKEOFF') {
            npc.tilt = 0; npc.roll = 0;
            npc.rotorRPM = Math.min(1, npc.rotorRPM + 0.008 * dt);
            npc.rotationPos += npc.rotorRPM * 0.75 * dt;
            npc.z += 0.05 * dt;
            if (npc.z >= npc.cruiseZ) {
                npc.z = npc.cruiseZ;
                npc.state = 'PATROL';
            }
            continue;
        }

        // PATROL
        if (npc.waypoints.length === 0) {
            npc.waypoints = genWaypoints();
            npc.wpI = 0;
            if (npc.waypoints.length === 0) continue;
        }

        const wp = npc.waypoints[npc.wpI];
        const dx = wp.x - npc.x, dy = wp.y - npc.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 2.5) {
            npc.wpI++;
            if (npc.wpI >= npc.waypoints.length) {
                npc.wpI = 0;
                npc.waypoints = genWaypoints();
            }
            continue;
        }

        const desired = Math.atan2(dy, dx);
        const diff = ((desired - npc.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const prevAngle = npc.angle;
        npc.angle += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));

        const step = Math.min(SPEED * dt, dist);
        npc.x += Math.cos(npc.angle) * step;
        npc.y += Math.sin(npc.angle) * step;
        npc.z += (npc.cruiseZ - npc.z) * 0.02 * dt;

        const speed = step / dt;
        npc.tilt = -speed * 4.5;
        npc.roll = Math.max(-0.3, Math.min(0.3, (npc.angle - prevAngle) / dt * 8));
        npc.rotorRPM = 0.9 + Math.sin(Date.now() * 0.0008) * 0.04;
        npc.rotationPos += npc.rotorRPM * 0.75 * dt;
    }
};
