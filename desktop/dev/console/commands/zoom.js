// "zoom": the camera zoom, any amount (the game's own chat command offers 25, 50, 100
// and 200), once or held there. A held zoom lasts until "zoom --unlock" or the app
// closes; it is the command's own, not a setting.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { takeOptions, oneOf } from '../core/args.js';
import { game } from '../game/bindings.js';
import { requireLevel, isActive } from '../game/level.js';

const PERCENT = 100;
const MIN = 1; // the game's own limits: its "set zoom" trigger clamps to 1-1500%
const MAX = 1500;
const DEFAULT = 100;

let locked = null; // percent, or null

// Once per frame: a held zoom puts back whatever else set it (a map trigger, a vehicle,
// the map's gamescale mark).
export function zoomTick() {
  if (locked !== null && isActive() && game.zoom() !== locked / PERCENT) game.setZoom(locked / PERCENT);
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
  if (how === 'lock') {
    locked = pct;
    if (game.inLevelFrame()) game.setZoom(pct / PERCENT);
    print(`Zoom ${pct}%, locked: map triggers, vehicles and engine marks cannot change it ("zoom --unlock")`, COLOR.ok);
    return;
  }
  requireLevel();
  const wasLocked = locked !== null;
  locked = null; // a held zoom would take it back
  game.setZoom(pct / PERCENT);
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
