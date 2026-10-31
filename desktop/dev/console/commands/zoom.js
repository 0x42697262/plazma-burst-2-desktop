// "zoom": the camera zoom, any amount (the game's own chat command offers 25, 50, 100
// and 200), once or held there. A held zoom lasts until "zoom --unlock" or the app
// closes; it is the command's own, not a setting.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { takeOptions, oneOf } from '../core/args.js';
import { game } from '../game/bindings.js';
import { requireLevel, isActive } from '../game/level.js';
import { zoomHeldBack, refusal, BYPASS_HINT } from '../overrides/server-checks.js';

const PERCENT = 100;
const MIN = 1; // the game's own limits: its "set zoom" trigger clamps to 1-1500%
const MAX = 1500;
const DEFAULT = 100;

let locked = null; // percent, or null
let setOnce = null; // percent last set without --lock, while the game still has it

// For "list": what "zoom" changed, as rows, or null when nothing.
export function zoomChanges() {
  if (locked !== null) return [`  locked at ${locked}%  ("zoom --unlock" lets go)`];
  if (setOnce !== null && isActive() && game.zoom() === setOnce / PERCENT) return [`  ${setOnce}%  (once: the map can change it)`];
  setOnce = null;
  return null;
}

// Once per frame: a held zoom puts back whatever else set it (a map trigger, a vehicle,
// the map's gamescale mark). In multiplayer a zoom out of yours is held back
// (overrides/server-checks.js): the lock stays, but is not applied, and the zoom it set
// goes back to 100%.
let heldNoted = false;
export function zoomTick() {
  if (!isActive()) return;
  const mine = locked !== null ? locked : setOnce;
  const why = mine !== null && zoomHeldBack(mine);
  if (why) {
    if (game.zoom() === mine / PERCENT) game.setZoom(DEFAULT / PERCENT);
    if (locked === null) setOnce = null;
    if (!heldNoted) print(`Multiplayer: not applying your zoom ${mine}%: ${why}. ${BYPASS_HINT}.`, COLOR.warn);
    heldNoted = true;
    return;
  }
  heldNoted = false;
  if (locked !== null && game.zoom() !== locked / PERCENT) game.setZoom(locked / PERCENT);
}

const shown = (z) => `${Math.round(z * PERCENT * 100) / 100}%`;

const lockText = () => (locked !== null ? `locked at ${locked}%` : 'not locked');

function zoom(args) {
  const usage = `usage: zoom [<percent ${MIN}-${MAX}> | default] [--lock] | zoom --unlock`;
  const { options, rest } = takeOptions(args, ['lock', 'unlock']);
  const how = oneOf(options, ['lock', 'unlock']);
  if (rest.length > 1) throw new Error(usage);
  if (!rest.length) {
    if (how === 'unlock') {
      locked = null;
      setOnce = null;
      print('Zoom unlocked: the game and the map can change it again', COLOR.ok);
      return;
    }
    if (how === 'lock') throw new Error(usage);
    requireLevel();
    print(`Zoom: ${shown(game.zoom())}, ${lockText()}`);
    return;
  }
  if (how === 'unlock') throw new Error(usage);
  const word = rest[0].replace(/%$/, '');
  const pct = word === 'default' ? DEFAULT : Number(word);
  if (!Number.isFinite(pct) || pct < MIN || pct > MAX) throw new Error(usage);
  const why = zoomHeldBack(pct);
  if (why) throw refusal(`zoom ${pct}%`, why);
  if (how === 'lock') {
    locked = pct;
    setOnce = null;
    if (game.inLevelFrame()) game.setZoom(pct / PERCENT);
    print(`Zoom ${pct}%, locked: map triggers, vehicles and engine marks cannot change it ("zoom --unlock")`, COLOR.ok);
    return;
  }
  requireLevel();
  const wasLocked = locked !== null;
  locked = null; // a held zoom would take it back
  game.setZoom(pct / PERCENT);
  setOnce = pct === DEFAULT ? null : pct;
  print(`Zoom ${pct}%${wasLocked ? ' (unlocked)' : ''}`, COLOR.ok);
}

export const zoomCommand = {
  name: 'zoom',
  usage: 'zoom [percent | default] [--lock] | zoom --unlock',
  desc: 'Camera zoom in percent, any amount; --lock holds it there',
  clientOnly: 'only your camera changes',
  help: {
    about: [
      'Sets the camera zoom the way the map\'s "set zoom" trigger does: 100 is normal,',
      'lower sees more, higher sees less. The game\'s own "game zoom" only takes 25,',
      '50, 100 and 200. Without --lock, a map trigger, a vehicle or the map\'s',
      'gamescale mark can change it again; with --lock it is put back every frame,',
      'in this level and the next ones, until "zoom --unlock" or the app closes.',
    ],
    args: [
      [`<percent>`, `${MIN}-${MAX}; "default" is ${DEFAULT}`],
      ['--lock', 'hold it there until "zoom --unlock"'],
      ['--unlock', 'let the game and the map change it again'],
    ],
    examples: [
      ['zoom', 'the zoom now, and whether it is locked'],
      ['zoom 35', 'once'],
      ['zoom 50 --lock', 'held at 50%'],
      ['zoom --unlock', 'let go'],
    ],
    see: ['game'],
  },
  run: zoom,
};
