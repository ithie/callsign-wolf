// Generated from demo.zcampaign by plugins/script-types.ts — do not edit.
import type { Payload, Vessel, WindTurbine } from '@/game/script';

export type DemoObjects = {
    "absetz_test": {
        "wt1": WindTurbine;
        "wt2": WindTurbine;
        "versorger": Vessel<'supply_vessel'>;
        "techniker": Payload<'person'>;
    };
};
