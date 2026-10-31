// A private server, chosen in the server list (desktop/launcher/): the wrapper sets PB2_JOIN (not
// enumerable) before any script, { address, nickname, password }, and join/client.js
// sends the game's lobby connection there.
export const JOIN = globalThis.PB2_JOIN || null;
