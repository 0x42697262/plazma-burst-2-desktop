// "npm run join": the game's lobby connection goes to a private server (server/) instead
// of the official one. The lobby address is the game's own list of address starts, put
// together as <start> + "plazmaburst2.com:" + port (screens/MPLobby.js); every start
// becomes "https://<address>/?", so what follows is only a query the server ignores.
// The game logs in with loaderInfo.parameters l and p (its login cookies; none here). The
// lobby reads them the moment its screen opens, so they are the nickname and server
// password from the menu on. Only the start-up screens (scripts/frame1.js, frame2.js)
// send them to the official site, and those have run by then: they sent nothing.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { JOIN } from '../core/join.js';
import { game } from '../game/bindings.js';

const TICK_MS = 100;
const STARTUP = Object.freeze(['startup', 'loading', 'name_prompt', 'ads', 'null', undefined, null]);

let said = false;
let loginSet = false;

function tick() {
  game.setLobbyAddress(`https://${JOIN.address}/?`);
  if (!loginSet && !STARTUP.includes(game.frameLabel())) {
    game.setLoginParams(JOIN.nickname, JOIN.password);
    loginSet = true;
  }
}

const guardedTick = () => {
  try { tick(); } catch (e) { if (!said) { said = true; print(`Private server: ${e.message}`, COLOR.error); } }
};

export function startJoin() {
  if (!JOIN) return;
  guardedTick();
  setInterval(guardedTick, TICK_MS);
  print(`Private server ${JOIN.address}: Multiplayer connects there, as ${JOIN.nickname}.`, COLOR.title);
}
