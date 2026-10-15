import { campaignHandler } from '../main';
import { getGround } from './terrain';
import { getConsist, WATER_FLOAT_Z, LOCO_SPEED, type ConsistCar } from './test-train-path';

// Hardcoded prototype: a freight train (locomotive + wagons) looping a flat
// "stadium" track (two straights + two semicircular turns — see
// test-train-path.ts), used to test decoupling each car's bogies (which track
// the rail's tangent 1:1) from its body (whose position/angle is derived from
// the two bogie points, so it "overhangs" through curves like a real
// railcar). Gated on the gamescom test map's `testTrain` flag — not an
// editor-exposed object by design.
//
// The track runs through a corridor flattened into the map's mountain
// terrain (gamescom.zcampaign) and crosses the river/lake — left as real
// water on purpose, since the rail "floats" over it for now (WATER_FLOAT_Z)
// rather than requiring actual bridge geometry.
//
// Consist layout (car count, spacing, colors) lives in test-train-path.ts
// (pure, no campaign state) so the VS Code campaign editor's static preview
// can build the exact same consist without pulling in this file's
// campaignHandler/getGround dependencies.

export interface TrainCar extends ConsistCar {
    z: number; // body's ground height
    frontBogieZ: number;
    rearBogieZ: number;
}

export const testTrainState: { active: boolean; cars: TrainCar[] } = {
    active: false,
    cars: [],
};

let _s0 = 0; // locomotive's arc-length position

export const initTestTrain = (): void => {
    testTrainState.active = campaignHandler.getCurrentMissionData().testTrain === true;
    _s0 = 0;
};

const _zAt = (x: number, y: number): number => Math.max(getGround(x, y), WATER_FLOAT_Z);

export const updateTestTrain = (dt: number): void => {
    if (!testTrainState.active) return;

    _s0 += LOCO_SPEED * dt;

    testTrainState.cars = getConsist(_s0).map(car => ({
        ...car,
        z: _zAt(car.pose.bodyX, car.pose.bodyY),
        frontBogieZ: _zAt(car.pose.frontBogie.x, car.pose.frontBogie.y),
        rearBogieZ: _zAt(car.pose.rearBogie.x, car.pose.rearBogie.y),
    }));
};
