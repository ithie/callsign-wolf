import { G } from '../../state';
import { PhysicsCtx } from '../ctx';
import { FuelVehicle, runFuelVehicle } from './fuel-vehicle-base';
import { VEHICLE_STATE } from '../../../shared/types';

export const carrierCar: FuelVehicle = {
    init() {
        if (!G.CARRIER || G.CARRIER.x === undefined) return;
        const car = G.carrierFuelCar;
        const cosA = Math.cos(G.CARRIER.angle),
            sinA = Math.sin(G.CARRIER.angle);
        car.x = G.CARRIER.x + car.localParkX * cosA - car.localParkY * sinA;
        car.y = G.CARRIER.y + car.localParkX * sinA + car.localParkY * cosA;
        car.angle = car.localParkAngle + G.CARRIER.angle;
        car.state = VEHICLE_STATE.PARKED;
        car.t = 0;
        car.wps = null;
    },

    update(dt: number, ctx: PhysicsCtx) {
        if (!G.CARRIER || G.CARRIER.x === undefined) return;
        const car = G.carrierFuelCar;
        const cosC = Math.cos(G.CARRIER.angle),
            sinC = Math.sin(G.CARRIER.angle);

        runFuelVehicle(car, dt, ctx, {
            localToWorld: (lx, ly) => ({
                x: G.CARRIER.x + lx * cosC - ly * sinC,
                y: G.CARRIER.y + lx * sinC + ly * cosC,
            }),
            worldToLocal: (wx, wy) => {
                const dx = wx - G.CARRIER.x,
                    dy = wy - G.CARRIER.y;
                return { lx: dx * cosC + dy * sinC, ly: -dx * sinC + dy * cosC };
            },
            parkSnapFn: () => {
                const cosC2 = Math.cos(G.CARRIER.angle),
                    sinC2 = Math.sin(G.CARRIER.angle);
                car.x = G.CARRIER.x + car.localParkX * cosC2 - car.localParkY * sinC2;
                car.y = G.CARRIER.y + car.localParkX * sinC2 + car.localParkY * cosC2;
                car.angle = car.localParkAngle + G.CARRIER.angle;
            },
            getParentAngle: () => G.CARRIER.angle,
            SPEED: 0.042,
            SPEED_REV: 0.026,
            STOP_DIST: 3.2,
            FUEL_RATE: 0.3,
            hasArm: false,
        });
    },
};
