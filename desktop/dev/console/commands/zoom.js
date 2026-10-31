// "zoom": the camera zoom, any amount (the game's own chat command offers 25, 50, 100
// and 200), once or held there.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { takeOptions, oneOf } from '../core/args.js';
import { game } from '../game/bindings.js';
import { requireLevel } from '../game/level.js';
import { KEY, SCHEMA } from '../state/schema.js';
import { settings } from '../state/store.js';

const PERCENT = 100;
const { min: MIN, max: MAX } = SCHEMA[KEY.ZOOM_LOCK]; // the game's own limits: "set zoom" clamps to 1-1500%
const DEFAULT = 100;

const shown = (z) => `${Math.round(z * PERCENT * 100) / 100}%`;

function lockText() {
  return settings.has(KEY.ZOOM_LOCK) ? `locked at ${settings.get(KEY.ZOOM_LOCK)}%` : 'not locked';
}

function zoom(args) {
  const usage = `usage: zoom [<percent ${MIN}-${MAX}> | default] [--lock] | zoom --unlock`;
  const { options, rest } = takeOptions(args, ['lock', 'unlock']);
  const how = oneOf(options, ['lock', 'unlock']);
  if (rest.length > 1) throw new Error(usage);
  if (!rest.length) {
    if (how === 'unlock') {
      settings.unset(KEY.ZOOM_LOCK);
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
    settings.set(KEY.ZOOM_LOCK, pct);
    if (game.inLevelFrame()) game.setZoom(pct / PERCENT);
    print(`Zoom ${pct}%, locked: map triggers, vehicles and engine marks cannot change it ("zoom --unlock")`, COLOR.ok);
    return;
  }
  requireLevel();
  const wasLocked = settings.has(KEY.ZOOM_LOCK);
  if (wasLocked) settings.unset(KEY.ZOOM_LOCK); // a held zoom would take it back
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
      'gamescale mark can change it again; with --lock it is put back every frame',
      '(the zoom_lock setting, kept like the other settings).',
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
    see: ['game', 'set'],
  },
  run: zoom,
};
