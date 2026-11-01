// Logs the anti-cheat scan's report (docs/research/anticheat.md §6.2, §7.3) as the game sends it, so the
// wrapper's terminal shows it: the page's console.warn reaches the terminal at the default
// log level. The page reloads 300 ms after the report, so the overlay would not keep it.
// How: the game's send method adds every message it sends to the network class's message
// log; this reads that log every frame. No game function is replaced.
// Limit: the report is only sent when there is a server connection. In single-player the
// scan reloads the page without sending anything, so there is nothing to log.
import { game, NET } from '../game/bindings.js';

// The report: [RELIABLE_PING, undefined, code, detail]. The game's own ping has 2 parts.
const REPORT_PARTS = 4;
const CODE = Object.freeze({
  1: 'a registered array was replaced',
  2: 'a function changed',
  3: 'a locked array changed',
});

const seen = new WeakSet();

function describe(code, detail) {
  const what = CODE[code] || 'unknown code';
  if (code === '3') {
    const name = game.lockedArrayName(Number(detail));
    return `code 3 (${what}): locked array ${detail} of ${game.lockedArrayCount()}${name ? ` (${name})` : ''}`;
  }
  // Code 2: "target/old source/new source", each source cut to 50 characters.
  return `code ${code} (${what}): ${detail}`;
}

export function scanReportTick() {
  const log = game.netLog();
  if (!log.length) return;
  const ping = game.messageType(NET.PING);
  // Newest first, up to the first message already looked at.
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (seen.has(e)) break;
    seen.add(e);
    if (e.type !== ping || !e.parts || e.parts.length !== REPORT_PARTS) continue;
    console.warn(`[anti-cheat] scan report sent, the page reloads in 300 ms: ${describe(e.parts[2], e.parts[3])}`);
  }
}
