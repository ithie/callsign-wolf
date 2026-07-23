export interface PayloadDef {
    baseMass: number;
    /** Can be released onto terrain via R-key (not just on pads/carriers). */
    terrainDroppable?: boolean;
}

export const PAYLOAD_DEFS: Record<string, PayloadDef> = {
    person:     { baseMass: 0.2 },
    rescuer:    { baseMass: 0.2 },
    crate:      { baseMass: 0.8, terrainDroppable: true },
    orni_wreck: { baseMass: 3.5, terrainDroppable: true },
};
