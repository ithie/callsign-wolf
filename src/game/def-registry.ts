const _reg = new Map<string, unknown>();

export const registerObjectDef = (type: string, def: unknown): void => { _reg.set(type, def); };
export const getObjectDef = (type: string): unknown => _reg.get(type);
