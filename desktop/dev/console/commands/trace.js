// "trace": white lines from you to the characters you pick, with their distance.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural } from '../core/text.js';
import { game } from '../game/bindings.js';
import { requireLevel, resolveChar, charLabel } from '../game/level.js';
import { tracedNow, tracingAll, distanceTo, traceAdd, traceAll, traceRemove, traceOff } from '../ui/trace.js';

const ALL_WORD = 'all';
const OFF_WORDS = ['off', 'stop', 'clear'];

// "1, bob" or "1 bob": characters by # or part of a nickname. Commas let a name hold
// spaces. Never you: a trace starts from you.
function targets(args) {
  const text = args.join(' ');
  const words = (text.includes(',') ? text.split(',') : args).map((w) => w.trim()).filter(Boolean);
  return words.map((w) => {
    const i = resolveChar(w);
    if (i === game.me()) throw new Error('that is you: traces start from you');
    return i;
  });
}

function status() {
  const now = tracedNow();
  if (!now.length) {
    print(tracingAll() ? 'Tracing everyone, but nobody else is here yet' : 'Not tracing anyone. "trace all" or "trace <# | name>".', COLOR.notice);
    return;
  }
  print(`Tracing ${tracingAll() ? 'everyone (also who joins later)' : plural(now.length, 'character')}:`, COLOR.title);
  for (const i of now) print(`  ${charLabel(i).padEnd(20)} ${distanceTo(i)}px`);
}

function trace(args) {
  if (!args.length) { requireLevel(); status(); return; }
  const first = args[0].toLowerCase();
  if (OFF_WORDS.includes(first)) {
    if (args.length === 1) { traceOff(); print('Traces off', COLOR.ok); return; }
    requireLevel();
    for (const i of targets(args.slice(1))) {
      traceRemove(i);
      print(`Stopped tracing ${charLabel(i)}`, COLOR.ok);
    }
    return;
  }
  requireLevel();
  if (first === ALL_WORD && args.length === 1) {
    traceAll();
    print(`Tracing everyone else (${plural(tracedNow().length, 'character')} now, and who joins later)`, COLOR.ok);
    return;
  }
  const picked = targets(args);
  traceAdd(picked);
  print(`Tracing ${picked.map((i) => `${charLabel(i)} (${distanceTo(i)}px)`).join(', ')}${tracingAll() ? ': already tracing everyone' : ''}`, COLOR.ok);
}

export const traceCommand = {
  name: 'trace',
  aliases: ['tracer', 'track'],
  usage: 'trace [all | <# | name>... | off [<# | name>]]',
  desc: 'Draw a white line from you to other characters, with their distance',
  help: {
    about: [
      'A white line from you to each character you trace, and a small label with',
      'their name and distance (in the same units as "chars"). A character off',
      'screen gets its label where the line leaves the screen, so you still see which',
      'way and how far. A dead or downed character\'s line fades.',
      'Drawn on its own layer over the game, like "logic show"; both can be on.',
    ],
    args: [
      ['(nothing)', 'who is traced, and how far away'],
      ['<# | name>...', 'trace these too: # from "chars", or part of a nickname'],
      ['all', 'everyone but you, also characters who join later'],
      ['off', 'stop tracing'],
      ['off <# | name>', 'stop tracing one (from "all", the others stay)'],
    ],
    examples: [
      ['trace 2', 'character #2'],
      ['trace bob, 4', 'bob and #4 (commas let a name hold spaces)'],
      ['trace all', 'everyone else'],
      ['trace off 3', 'everyone traced but #3'],
      ['trace off', 'no more lines'],
    ],
    notes: ['Only drawn in your game: nothing is sent, and nobody else sees it.'],
    see: ['chars', 'tp', 'logic show'],
  },
  run: trace,
};
