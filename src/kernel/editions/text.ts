export const TEXT = Object.freeze({
  unknownFeature: (id: string) => `no feature "${id}" (see "npm start -- --features")`,
  needsListed: (id: string, needs: string) => `${id} needs ${needs}: add "${needs}" to the edition`,
});
