export const TEXT = Object.freeze({
  unknownFeature: (id: string) => `no feature "${id}" (see "npm start -- --features")`,
  required: (id: string, by: string) => `${id}: ${by} needs it`,
  alwaysWith: (id: string, by: string) => `${id}: always comes with ${by}`,
  lockedWith: (id: string, by: readonly string[]) => `${id}: always on where ${by.join(', ')} is`,
});
