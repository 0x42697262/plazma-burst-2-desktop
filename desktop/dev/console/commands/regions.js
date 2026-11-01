// "regions": the map's regions, and firing one without being in it.
import { showPaged, takePage } from '../../../../src/console/kernel/ui/pager.ts';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { requireLevel } from '../../../../src/console/kernel/game/level.ts';
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';
import { regionList, triggerList, regionModeName, regionUid, timerUid, findRegion, REGION_MODE } from '../triggers/model.js';
import { fireRegion } from '../triggers/regions.js';
import { takeRunOptions } from '../triggers/run.js';

const UID_WIDTH = 18;
const MODE_WIDTH = 22;
const NO_TARGET = -1;

// What a region fires, as text: "trigger #3 #open_door", "timer #2 #clock", or "nothing".
function firesText(r) {
  const target = r[GAME_FIELDS.R_TRIGGER];
  if (typeof target !== 'number' || target === NO_TARGET) return 'nothing';
  if (r[GAME_FIELDS.R_USES_TIMER]) return `timer #${target}${timerUid(target) ? ' ' + timerUid(target) : ''}`;
  const t = triggerList()[target];
  return `trigger #${target}${t && t.uid ? ' ' + t.uid : ''}`;
}

function regionsOrNone() {
  requireLevel();
  const list = regionList();
  if (!list.length) throw new Error('this map has no regions');
  return list;
}

function listRegions(rawArgs) {
  const list = regionsOrNone();
  const { args, page } = takePage(rawArgs);
  const q = args.join(' ').trim().toLowerCase();
  const rows = [];
  list.forEach((r, i) => {
    if (!r) return;
    const uid = regionUid(i) || '-';
    if (q && !uid.toLowerCase().includes(q)) return;
    const mode = r[GAME_FIELDS.R_USE_ON];
    rows.push([`  #${String(i).padEnd(4)} ${uid.padEnd(UID_WIDTH)} ${regionModeName(mode).padEnd(MODE_WIDTH)} -> ${firesText(r)}   at ${Math.round(r.x)}, ${Math.round(r.y)}`,
      mode === REGION_MODE.NEVER ? COLOR.muted : undefined]);
  });
  showPaged({
    title: `Regions: ${list.length}.${q ? ` Filter "${q}": ${rows.length} shown.` : ''} "regions run <#>" fires one.`,
    rows,
    cmd: q ? `regions ${q}` : 'regions',
    empty: `  no region uid contains "${q}"`,
    page,
  });
}

function run(args) {
  const list = regionsOrNone();
  const usage = 'usage: regions run <# | uid> [force] [as <char#>]';
  const { rest, force, activator } = takeRunOptions(args, usage);
  if (!rest.length) throw new Error(usage);
  const q = rest.join(' '); // a uid may hold spaces
  const i = findRegion(q);
  if (i < 0 || !list[i]) throw new Error(`no region "${q}". Type "regions" to list them.`);
  fireRegion(i, { force, activator });
}

export const regionsCommand = {
  name: 'regions',
  aliases: ['region'],
  usage: 'regions [filter] [page n]',
  desc: 'List the map\'s regions: how each is activated and what it fires',
  help: {
    about: [
      'Every region: its index and uid, its activation mode (use key, character enters,',
      'red player enters...), and what it fires: a trigger, or a timer when the region',
      'has "uses timer". Regions with mode "never" fire nothing themselves; they are',
      'targets for other actions, such as "move character to region".',
    ],
    args: [
      ['[filter]', 'only uids containing this text'],
      ['page n', 'jump to page n'],
    ],
    examples: [
      ['regions', 'all of them'],
      ['regions door', 'uids containing "door"'],
      ['regions run 3', 'fire region #3 as if you had used it'],
    ],
    see: ['regions run', 'logic', 'triggers'],
  },
  run: listRegions,
  subcommands: [
    {
      name: 'run',
      aliases: ['fire', 'use', 'activate'],
      usage: 'regions run <# | uid> [force] [as #]',
      desc: 'Fire a region as if its condition were met: run its trigger (or start its timer), with you (or character #) as the activator',
      reportsReach: true,
      help: {
        about: [
          'Does what the game does when a region\'s condition is met, without walking into it',
          'or pressing anything: the activator is set, then the region runs its trigger, or',
          'starts its timer when it has "uses timer".',
          'The region\'s mode is checked first, as the game would for that character, apart',
          'from where they stand: a red-team use key refuses a blue player, "bot enters"',
          'refuses players, "door/elevator arrives" refuses characters. "force" fires it',
          'anyway, and also runs a disabled or used-up trigger, putting it back after.',
        ],
        args: [
          ['<# | uid>', 'the region, e.g. 3 or #button (see "regions")'],
          ['force', 'past the mode\'s condition and the trigger\'s own rules'],
          ['as <char#>', 'fire it for that character (see "chars")'],
        ],
        examples: [
          ['regions run 3', 'as if you had used region #3'],
          ['regions run #button', 'the same, by uid'],
          ['regions run 7 as 2', 'as if character #2 had walked in'],
          ['regions run 9 force', 'even when its mode would not fire for you'],
        ],
        notes: [
          'Multiplayer: sent to the server like the game\'s own region use (with the',
          'region\'s number), so other players run the trigger too. Not sent when forced',
          'past the mode or the trigger\'s rules, "as" another character, or while',
          'spectating. A timer region is never sent: for those the game sends the',
          'timer\'s number as a trigger, which would run the wrong trigger elsewhere.',
          'Not done: the button animation and the use sound of use-key regions.',
        ],
        see: ['regions', 'triggers run', 'logic'],
      },
      run,
    },
  ],
};
