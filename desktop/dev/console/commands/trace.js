// "trace": white lines from you to the characters you pick, with their distance.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural } from '../core/text.js';
import { takeOptions, oneOf } from '../core/args.js';
import { game } from '../game/bindings.js';
import { requireLevel, resolveChar, charLabel } from '../game/level.js';
import { parseIndex } from '../core/text.js';
import { tracedNow, pickedBySlot, tracingGroup, distanceTo, traceAdd, traceGroup, traceRemove, traceOff, TRACE_KIND, TRACE_SIDE } from '../ui/trace.js';

const OPTION = Object.freeze({
  ALL: 'all', PLAYERS: 'players', NPC: 'npc', TEAM: 'team', ENEMIES: 'enemies', OFF: 'off',
});
// --all is everyone; the others narrow it down, one of each pair.
const KINDS = [OPTION.PLAYERS, OPTION.NPC];
const SIDES = [OPTION.TEAM, OPTION.ENEMIES];
const GROUP_OPTIONS = [OPTION.ALL, ...KINDS, ...SIDES];
const KIND_OF = Object.freeze({ [OPTION.PLAYERS]: TRACE_KIND.PLAYERS, [OPTION.NPC]: TRACE_KIND.NPC });
const SIDE_OF = Object.freeze({ [OPTION.TEAM]: TRACE_SIDE.TEAM, [OPTION.ENEMIES]: TRACE_SIDE.ENEMIES });
const KIND_TEXT = Object.freeze({ [TRACE_KIND.PLAYERS]: 'every other player', [TRACE_KIND.NPC]: 'every NPC' });
const SIDE_TEXT = Object.freeze({ [TRACE_SIDE.TEAM]: 'on your team', [TRACE_SIDE.ENEMIES]: 'on the other teams' });

// The options that make a group: "--players --enemies", or "--all".
export const groupOptions = ({ kind, side }) => [kind, side].filter(Boolean).map((o) => `--${o}`).join(' ') || `--${OPTION.ALL}`;

// "every other player on the other teams", "everyone else".
function groupText({ kind, side }) {
  if (!kind && !side) return 'everyone else';
  return `${kind ? KIND_TEXT[kind] : 'everyone'}${side ? ` ${SIDE_TEXT[side]}` : ''}`;
}

// Words that used to be keywords: now names, but a miss says what was meant.
const OLD_WORDS = Object.freeze({
  all: '--all', off: '--off', stop: '--off', clear: '--off',
  players: '--players', npc: '--npc', bots: '--npc', team: '--team', enemies: '--enemies',
});

// "1, bob" or "1 bob": characters by # or part of a nickname, as [index, bySlot]. Commas
// let a name hold spaces. Never you: a trace starts from you.
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
    return [i, parseIndex(w) !== null];
  });
}

function status() {
  const now = tracedNow();
  if (!now.length) {
    print(tracingGroup() ? `Tracing ${groupText(tracingGroup())}, but nobody is here yet`
      : 'Not tracing anyone. "trace --all", "trace --enemies" or "trace <# | name>" ("help trace" for more).', COLOR.notice);
    return;
  }
  print(`Tracing ${plural(now.length, 'character')}${tracingGroup() ? ` (${groupText(tracingGroup())}, also who joins later)` : ''}:`, COLOR.title);
  for (const i of now) print(`  ${charLabel(i).padEnd(20)} ${`${distanceTo(i)}px`.padEnd(8)}${pickedBySlot(i) ? ' slot: whoever is in it' : ''}`.trimEnd());
}

function trace(rawArgs) {
  const { options, rest } = takeOptions(rawArgs, Object.values(OPTION));
  const kind = oneOf(options, KINDS);
  const side = oneOf(options, SIDES);
  const grouped = GROUP_OPTIONS.some((o) => options.has(o));
  if (options.has(OPTION.OFF)) {
    const also = GROUP_OPTIONS.find((o) => options.has(o));
    if (also) throw new Error(`--off and --${also} do not go together: "trace --off" stops all, "trace --off <# | name>" stops one`);
    if (!rest.length) { traceOff(); print('Traces off', COLOR.ok); return; }
    requireLevel();
    for (const [i, bySlot] of targets(rest)) {
      traceRemove(i, bySlot);
      print(`Stopped tracing ${charLabel(i)}`, COLOR.ok);
    }
    return;
  }
  if (!grouped && !rest.length) { requireLevel(); status(); return; }
  requireLevel();
  const picked = rest.length ? targets(rest) : [];
  if (grouped) traceGroup({ kind: KIND_OF[kind] ?? null, side: SIDE_OF[side] ?? null });
  if (picked.length) traceAdd(picked);
  const named = picked.map(([i, bySlot]) => `${bySlot ? 'slot ' : ''}${charLabel(i)} (${distanceTo(i)}px)`).join(', ');
  if (!grouped) { print(`Tracing ${named}`, COLOR.ok); return; }
  print(`Tracing ${groupText(tracingGroup())}${named ? `, and ${named}` : ''}: ${plural(tracedNow().length, 'character')} now, and who joins later`, COLOR.ok);
}

export const traceCommand = {
  name: 'trace',
  aliases: ['tracer', 'track'],
  usage: 'trace [--all] [--players | --npc] [--team | --enemies] [<# | name>...]  |  trace --off [<# | name>...]',
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
      ['<# | name>...', 'trace these too: # from "chars" (that slot, whoever is in it), or part of a nickname (that player, until they leave)'],
      ['--all', 'everyone but you, NPCs too, also characters who join later'],
      ['--players', 'only real players (no NPCs), also who joins later'],
      ['--npc', 'only NPCs (bots)'],
      ['--team', 'only characters on your team'],
      ['--enemies', 'only characters on the other teams'],
      ['--off', 'stop tracing'],
      ['--off <# | name>...', 'stop tracing these (from a group, the others stay)'],
    ],
    examples: [
      ['trace 2', 'slot #2: whoever is in it, also after a player leaves and another joins'],
      ['trace bob', 'bob: stops when bob leaves'],
      ['trace bob, 4', 'bob and slot #4 (commas let a name hold spaces)'],
      ['trace --players', 'every other player, no NPCs'],
      ['trace --enemies', 'everyone on the other teams'],
      ['trace --players --enemies', 'enemy players, no NPCs'],
      ['trace --npc --team', 'the NPCs on your team'],
      ['trace --players bluebot', 'the players, and that one bot'],
      ['trace --all', 'everyone else'],
      ['trace --off 3', 'everyone traced but #3'],
      ['trace --off', 'no more lines'],
    ],
    notes: [
      'A kind (--players or --npc) and a side (--team or --enemies) go together; --all',
      'with them changes nothing. A new group replaces the old one; picked names stay.',
      'Teams are checked every frame, so after a team switch the lines follow.',
      'A player picked by name is known by their account (NPCs and guests, which have',
      'none, by slot and nickname): leaving ends their trace, even if they come back.',
      'Your team is the same team number, as in "chars" (ally / enemy).',
      'Only drawn in your game: nothing is sent, and nobody else sees it.',
    ],
    see: ['chars', 'tp', 'logic show'],
  },
  run: trace,
};
