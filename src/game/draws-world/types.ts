import type { IsoFn, SceneRenderer as SceneRendererType } from '../scene-renderer';
import type { createDrawObjects } from '../draw-objects';

export interface DrawWorldCtx {
    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    isoFn: IsoFn;
    SceneRenderer: SceneRendererType;
    tileW: number;
    tileH: number;
    stepH: number;
    drawFns: ReturnType<typeof createDrawObjects>;
    hasCarrier: () => boolean;
    hasPad: () => boolean;
    isVisible: (x: number, y: number, margin?: number) => boolean;
    getLighthouse: () => { x: number; y: number } | null;
    getWindStr: () => number;
    isNight: () => boolean;
    isMissionRain: () => boolean;
    getShowCollisionBoxes: () => boolean;
    triggerCrash: () => void;
}
