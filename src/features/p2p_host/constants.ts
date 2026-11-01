export const MAX_PLAYERS: readonly number[] = Object.freeze([2, 3, 4, 5, 6, 8, 16, 32, 64]);
export const MIN_REPUTATION: readonly number[] = Object.freeze([0, 1, 5, 10, 20, 40]);
export const MAX_TITLE_LENGTH = 100;
export const MAX_REGION_LENGTH = 40;
export const FPS_RANGE = Object.freeze({ min: 10, max: 120 });
export const PORT_RANGE = Object.freeze({ min: 1024, max: 65535 });
export const VPN_GUESTS = Object.freeze({ allowed: 1, refused: 0 });
export const RELOAD_AFTER_CRASH_MS = 5000;
export const QUIT_AFTER_STOP_MS = 1500;
export const MILLISECONDS_PER_SECOND = 1000;
export const HOST_WINDOW = Object.freeze({ width: 800, height: 400 });

export const FORCED_MATCH_VALUES = Object.freeze({ p2p: true, ranked: false, accept_connections_manually: false });

export const TICK_MS = 500;
export const SLOW_MS = 30000;
export const AWAY_MS = 8000;
export const SPECTATE_RETRY_MS = 10000;
export const KICK_AGAIN_MS = 30000;
export const RESTART_PAUSE_MS = 3000;
