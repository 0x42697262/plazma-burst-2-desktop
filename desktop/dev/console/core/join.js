// A private server ("npm run join", desktop/join.js): the wrapper sets PB2_JOIN (not
// enumerable) before any script, { address, nickname, password }, and join/client.js
// sends the game's lobby connection there.
export const JOIN = globalThis.PB2_JOIN || null;
