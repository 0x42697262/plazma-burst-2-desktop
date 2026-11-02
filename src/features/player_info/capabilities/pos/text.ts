export const TEXT = Object.freeze({
  position: (positionX: number, positionY: number, crosshairX: number, crosshairY: number) => `you: ${positionX}, ${positionY}   crosshair: ${crosshairX}, ${crosshairY}`,
  pos: { usage: 'pos', desc: 'Show your position and the crosshair position', about: ['Your coordinates and your crosshair\'s, both rounded. Feed them to "tp x y".'], see: ['tp'] },
});
