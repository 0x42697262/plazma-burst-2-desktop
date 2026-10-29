// "trace": white lines from you to the characters you pick, with their distance.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural } from '../core/text.js';
import { takeOptions, oneOf } from '../core/args.js';
import { game } from '../game/bindings.js';
import { requireLevel, resolveChar, charLabel } from '../game/level.js';
import { tracedNow, tracingGroup, distanceTo, traceAdd, traceGroup, traceRemove, traceOff, TRACE_GROUP } from '../ui/trace.js';

const OPTION = Object.freeze({ ALL: 'all', PLAYERS: 'players', OFF: 'off' });
const GROUP_OF = Object.freeze({ [OPTION.ALL]: TRACE_GROUP.ALL, [OPTION.PLAYERS]: TRACE_GROUP.PLAYERS });
const GROUP_TEXT = Object.freeze({
  [TRACE_GROUP.ALL]: 'everyone else',
  [TRACE_GROUP.PLAYERS]: 'every other player, no bots',
});
// Words that used to be keywords: now names, but a miss says what was meant.
const OLD_WORDS = Object.freeze({ all: '--all', off: '--off', stop: '--off', clear: '--off', players: '--players' });

// "1, bob" or "1 bob": characters by # or part of a nickname. Commas let a name hold
// spaces. Never you: a trace starts from you.
function targets(args) {
  const text = args.join(' ');
  const words = (text.includes(',') ? text.split(',') : args).map((w) => w.trim()).filter(Boolean);
  return words.map((w) => {
    let i;
    try {
      i = resolveChar(w);
    } catch (e) {
      const meant = OLD_WORDS[w.toLowerCase()];
      throw meant ? new Error(`${e.message.replace(/ Type "chars"\.$/, '')} For the option, type "trace ${meant}".`) : e;
    }
    if (i === game.me()) throw new Error('that is you: traces start from you');
    return i;
  });
}

function status() {
  const now = tracedNow();
  if (!now.length) {
    print(tracingGroup() ? `Tracing ${GROUP_TEXT[tracingGroup()]}, but nobody is here yet`
      : 'Not tracing anyone. "trace --all", "trace --players" or "trace <# | name>".', COLOR.notice);
    return;
  }
  print(`Tracing ${plural(now.length, 'character')}${tracingGroup() ? ` (${GROUP_TEXT[tracingGroup()]}, also who joins later)` : ''}:`, COLOR.title);
  for (const i of now) print(`  ${charLabel(i).padEnd(20)} ${distanceTo(i)}px`);
}

function trace(rawArgs) {
  const { options, rest } = takeOptions(rawArgs, Object.values(OPTION));
  const group = oneOf(options, [OPTION.ALL, OPTION.PLAYERS]);
  if (options.has(OPTION.OFF)) {
    if (group) throw new Error(`--off and --${group} do not go together`);
    if (!rest.length) { traceOff(); print('Traces off', COLOR.ok); return; }
    requireLevel();
    for (const i of targets(rest)) {
      traceRemove(i);
      print(`Stopped tracing ${charLabel(i)}`, COLOR.ok);
    }
    return;
  }
  if (!group && !rest.length) { requireLevel(); status(); return; }
  requireLevel();
  const picked = rest.length ? targets(rest) : [];
  if (group) traceGroup(GROUP_OF[group]);
  if (picked.length) traceAdd(picked);
  const named = picked.map((i) => `${charLabel(i)} (${distanceTo(i)}px)`).join(', ');
  if (!group) { print(`Tracing ${named}`, COLOR.ok); return; }
  print(`Tracing ${GROUP_TEXT[tracingGroup()]}${named ? `, and ${named}` : ''}: ${plural(tracedNow().length, 'character')} now, and who joins later`, COLOR.ok);
}

export const traceCommand = {
  name: 'trace',
  aliases: ['tracer', 'track'],
  usage: 'trace [--all | --players] [<# | name>...]  |  trace --off [<# | name>...]',
  desc: 'Draw a white line from you to other characters, with their distance',
  help: {
    about: [
      'A white line from you to each character you trace, and a small label with',
      'their name and distance (in the same units as "chars"). A character off',
      'screen gets its label where the line leaves the screen, so you still see which',
      'way and how far. A dead or downed character\'s line fades.',
      'Drawn on its own layer over the game, like "logic show"; both can be on.',
      'Every word that is not an option is a character, so a player named "all" is',
      '"trace all"; "--" ends the options ("trace -- --odd--").',
    ],
    args: [
      ['(nothing)', 'who is traced, and how far away'],
      ['<# | name>...', 'trace these too: # from "chars", or part of a nickname'],
      ['--all', 'everyone but you, bots too, also characters who join later'],
      ['--players', 'only real players, no bots, also players who join later'],
      ['--off', 'stop tracing'],
      ['--off <# | name>...', 'stop tracing these (from --all or --players, the others stay)'],
    ],
    examples: [
      ['trace 2', 'character #2'],
      ['trace bob, 4', 'bob and #4 (commas let a name hold spaces)'],
      ['trace --players', 'every other player, no bots'],
      ['trace --players bluebot', 'the players, and that one bot'],
      ['trace --all', 'everyone else'],
      ['trace --off 3', 'everyone traced but #3'],
      ['trace --off', 'no more lines'],
    ],
    notes: ['Only drawn in your game: nothing is sent, and nobody else sees it.'],
    see: ['chars', 'tp', 'logic show'],
  },
  run: trace,
};
