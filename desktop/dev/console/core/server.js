// The dedicated host ("npm run p2p-host", desktop/p2p-host/): this game window runs offscreen
// with nobody at it, hosts one player-hosted match and is driven from the terminal. The
// wrapper sets PB2_SERVER (not enumerable) before any script, for that window only: the
// checked settings of desktop/p2p-host.json, { match, server }. The console then registers
// the commands marked `server: true` and starts server/host.js.
export const SERVER = globalThis.PB2_SERVER || null;
