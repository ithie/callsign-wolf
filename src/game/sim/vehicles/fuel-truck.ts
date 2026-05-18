import { G } from '../../state';
import { PhysicsCtx } from '../ctx';
import { FuelVehicle, runFuelVehicle } from './fuel-vehicle-base';

export const fuelTruck: FuelVehicle = {
    init() {
        if (!G.PAD) return;
        const ft = G.fuelTruck;
        ft.localParkX = G.PAD.xMax - 6.2;
        ft.localParkY = G.PAD.yMin - 1;
        ft.localParkAngle = Math.PI * 0.5;
        ft.x = ft.localParkX;
        ft.y = ft.localParkY;
        ft.angle = ft.localParkAngle;
        ft.arm = 0;
        ft.state = 'PARKED'; ft.t = 0; ft.wps = null; ft.wpI = 0;
    },

    update(dt: number, ctx: PhysicsCtx) {
        if (!G.PAD) return;
        const ft = G.fuelTruck;
        runFuelVehicle(ft, dt, ctx, {
            localToWorld: (lx, ly) => ({ x: lx, y: ly }),
            worldToLocal: (wx, wy) => ({ lx: wx, ly: wy }),
            SPEED: 0.045, SPEED_REV: 0.028, MAX_STEER: 0.025, STOP_DIST: 3.5, FUEL_RATE: 0.25,
            hasArm: true,
        });
    },
};
