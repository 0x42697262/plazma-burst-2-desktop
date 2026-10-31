// The dedicated host ("npm run server", desktop/server/): this game window runs offscreen
// with nobody at it, hosts one player-hosted match and is driven from the terminal. The
// wrapper sets PB2_SERVER (not enumerable) before any script, for that window only: the
// checked settings of desktop/server.json, { match, server }. The console then registers
// the commands marked `server: true` and starts server/host.js.
export const SERVER = globalThis.PB2_SERVER || null;
