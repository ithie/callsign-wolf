declare module '*.zdef' {
    const def: {
        id: string;
        pivot?: number[];
        faces: Array<{
            id: string;
            verts: number[][];
            color: string;
            stroke?: string | null;
            strokeWidth?: number;
            normal?: [number, number];
        }>;
        collisionBoxes?: Array<{
            id: string;
            xMin: number; xMax: number;
            yMin: number; yMax: number;
            zMin: number; zMax: number;
        }>;
        rotateNodes?: Array<{
            pivot: [number, number, number];
            axis: [number, number, number];
            param: string;
            faces: Array<{
                id: string;
                verts: number[][];
                color: string;
                stroke?: string | null;
                strokeWidth?: number;
                normal?: [number, number];
            }>;
        }>;
        lights?: Array<{
            id: string;
            pos: [number, number, number];
            color: string;
            glowColor?: string;
            radius?: number;
            glowRadius?: number;
            blinkHz?: number;
        }>;
        rescueZones?: Array<{
            x: number;
            y: number;
            w: number;
            h: number;
            role: 'pickup' | 'dropoff' | 'both';
            z?: number;
            dz?: number;
        }>;
        parts?: Array<{
            id: string;
            faces: Array<{
                id: string;
                verts: number[][];
                color: string;
                stroke?: string | null;
                strokeWidth?: number;
                normal?: [number, number];
            }>;
            rotate?: {
                pivot: [number, number, number];
                axis: [number, number, number];
                param: string;
            };
        }>;
    };
    export default def;
}
