import { DEFAULT_PERCENT, MAX_PERCENT, MIN_PERCENT } from './constants.ts';

export const TEXT = Object.freeze({
  usageError: `usage: zoom [<percent ${MIN_PERCENT}-${MAX_PERCENT}> | default] [--lock] | zoom --unlock`,
  usage: 'zoom [percent | default] [--lock] | zoom --unlock',
  description: 'Camera zoom in percent, any amount; --lock holds it there',
  clientOnly: 'only your camera changes',
  about: [
    'Sets the camera zoom the way the map\'s "set zoom" trigger does: 100 is normal,',
    'lower sees more, higher sees less. The game\'s own "game zoom" only takes 25,',
    '50, 100 and 200. Without --lock, a map trigger, a vehicle or the map\'s',
    'gamescale mark can change it again; with --lock it is put back every frame,',
    'in this level and the next ones, until "zoom --unlock" or the app closes.',
  ],
  args: [
    ['<percent>', `${MIN_PERCENT}-${MAX_PERCENT}; "default" is ${DEFAULT_PERCENT}`],
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
  unlocked: 'Zoom unlocked: the game and the map can change it again',
  now: (shown: string, lock: string) => `Zoom: ${shown}, ${lock}`,
  lockedAt: (percent: number) => `locked at ${percent}%`,
  notLocked: 'not locked',
  shown: (percent: number) => `${percent}%`,
  locked: (percent: number) => `Zoom ${percent}%, locked: map triggers, vehicles and engine marks cannot change it ("zoom --unlock")`,
  set: (percent: number, wasLocked: boolean) => `Zoom ${percent}%${wasLocked ? ' (unlocked)' : ''}`,
  heldBack: (percent: number, why: string, hint: string) => `Ranked match: not applying your zoom ${percent}%: ${why}. ${hint}.`,
  refusedSubject: (percent: number) => `zoom ${percent}%`,
  listLocked: (percent: number) => `  locked at ${percent}%  ("zoom --unlock" lets go)`,
  listOnce: (percent: number) => `  ${percent}%  (once: the map can change it)`,
});
