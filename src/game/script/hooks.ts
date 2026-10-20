// Game → script notifications. Dependency-free on purpose: simulation.ts calls these
// unconditionally, the script runtime swaps in real handlers while a script runs.

// `where` is the runtime entity the payload was set down on/in (G.PAD for the pad).
export type ScriptHooks = {
    onBoard: (payload: object) => void;
    rescued: (payload: object | undefined, where: object | null) => void;
};

const _noop: ScriptHooks = { onBoard: () => {}, rescued: () => {} };

export const scriptHooks: ScriptHooks = { ..._noop };

export const setScriptHooks = (h: ScriptHooks | null): void => {
    Object.assign(scriptHooks, h ?? _noop);
};
