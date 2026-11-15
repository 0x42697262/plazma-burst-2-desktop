export const toWire = (value: number, scale?: number): number => Math.round(scale === undefined ? value : value * scale);

export const fromWire = (value: number, scale?: number): number => (scale === undefined ? value : value / scale);
