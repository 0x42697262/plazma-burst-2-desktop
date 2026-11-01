// "vars": the map's trigger variables. List, read, change, remove, and sync to the match.
import { print } from '../ui/log.js';
import { showPaged, takePage } from '../ui/pager.js';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { plural } from '../../../../src/console/kernel/core/words.ts';
import { game } from '../game/bindings.js';
import { showTarget } from '../triggers/model.js';
import {
  requireVars, showVar, parseVarValue, SYNC_MODES, RECOMMENDED_MODE, VAR_MAX_LEN, fights, modeName,
  syncMarkOn, mapHasSyncMark, syncActionsFor, seedersFor, modeVerdict, NO, YES, noteVarEdit,
} from '../triggers/vars.js';

const NAME_WIDTH = 28;
const SHOWN = Object.freeze({ syncers: 6, seeders: 4 });
const WRITE_VERBS = Object.freeze({ set: 'set', get: 'get', del: 'del', unset: 'del', rm: 'del' });

// ----- vars [filter] -----

function listVars(rawArgs) {
  const vars = requireVars();
  const { args, page } = takePage(rawArgs);
  const names = Object.keys(vars).sort();
  const q = args.join(' ').trim();
  const lc = q.toLowerCase();
  const rows = names.filter((n) => !lc || n.toLowerCase().includes(lc)).map((n) => [`  ${n.padEnd(NAME_WIDTH)} ${showTarget(vars[n])}`]);
  showPaged({
    title: `Map variables: ${names.length}.${q ? ` Filter "${q}": ${rows.length} shown.` : ''} "vars set <name> <value>" changes one.`,
    rows,
    cmd: q ? `vars ${q}` : 'vars',
    empty: names.length ? `  no variable name contains "${q}"` : '  no trigger has set a variable yet',
    hint: 'Numbers print bare and text in quotes; "vars get <name>" shows a long value in full. "triggers find <name>" lists the actions that use one.',
    page,
  });
}

// ----- vars set | get | del -----

function writeVar(args, { verb }) {
  const vars = requireVars();
  const usage = 'usage: vars set <name> <value>  |  vars get <name>  |  vars del <name>';
  const name = args[0];
  if (!name) throw new Error(usage);
  const had = Object.hasOwn(vars, name);
  const before = vars[name];
  switch (WRITE_VERBS[verb]) {
    case WRITE_VERBS.get:
      if (args.length !== 1) throw new Error(usage);
      if (!had) throw new Error(`no variable "${name}". Type "vars" to list them, or "vars ${name}" to search.`);
      print(`${name} = ${showVar(before)}`);
      return;
    case WRITE_VERBS.del:
      if (args.length !== 1) throw new Error(usage);
      if (!had) { print(`${name} is not set`, COLOR.notice); return; }
      delete vars[name];
      noteVarEdit(vars, name, before);
      print(`Removed ${name} (was ${showVar(before)})`, COLOR.ok);
      return;
    default: {
      if (args.length < 2) throw new Error(usage);
      const value = parseVarValue(args.slice(1).join(' '));
      vars[name] = value;
      noteVarEdit(vars, name, before);
      print(`${name} = ${showVar(value)}${had ? `  (was ${showVar(before)})` : '  (new)'}`, COLOR.ok);
      if (!had) print('  No trigger had set it yet, so nothing may read it. "vars" lists the ones in use.', COLOR.hint);
    }
  }
}

// ----- vars sync -----

const fightName = (mode) => SYNC_MODES[mode].what;

// "vars sync <name>": what a sync of this variable would do, and the mode to use.
function explainSync(name, vars) {
  const has = Object.hasOwn(vars, name);
  const value = vars[name];
  print(`Syncing ${name} to every player in the match`, COLOR.title);
  print(`  value to send: ${has ? showVar(value) : '(not set here: "vars set" it first)'}`, has ? undefined : COLOR.notice);

  const local = syncMarkOn();
  const inMap = mapHasSyncMark();
  const inMapText = inMap === null ? ', this map unreadable' : inMap ? ', and this map sets it' : ', and this map does NOT set it';
  print(`  engine mark:   ${local ? 'on for you' : 'OFF for you'}${inMapText}`, local && inMap !== false ? COLOR.ok : COLOR.warn);
  if (!local) print('  Without the mark nothing is sent and nothing would be applied.', COLOR.warn);
  else if (inMap === false) print('  Your mark is left over from an earlier map (the game never clears it). Players who did not load such a map will drop the message.', COLOR.warn);
  if (!game.isMP()) print('  Single-player: there is nobody to send to.', COLOR.warn);

  const synced = syncActionsFor(name);
  const fighting = synced.filter((sa) => fights(sa.mode));
  if (!synced.length) {
    print('  no trigger syncs this variable, so nothing re-sends it after you', COLOR.ok);
  } else {
    print(`  ${plural(synced.length, 'trigger action')} already sync it, and re-send each client's own value:`, COLOR.warn);
    for (const sa of synced.slice(0, SHOWN.syncers)) {
      print(`    #${String(sa.idx).padEnd(4)} ${String(sa.uid || '-').padEnd(18)} action ${String(sa.action).padEnd(3)} mode ${modeName(sa.mode)}`);
    }
    if (synced.length > SHOWN.syncers) print(`    ... ${synced.length - SHOWN.syncers} more`);
    if (fighting.length) print(`    With ${fightName(fighting[0].mode)} they can undo your value: see what starts them with "triggers ${fighting[0].idx}".`, COLOR.warn);
  }

  const seeders = seedersFor(name);
  if (seeders.length) {
    print(`  ${plural(seeders.length, 'trigger')} set this variable from the map, so any client that reloads`, COLOR.warn);
    print('  the map writes the map\'s own value back over what you synced:', COLOR.warn);
    for (const sd of seeders.slice(0, SHOWN.seeders)) {
      print(`    #${String(sd.idx).padEnd(4)} ${String(sd.uid || '-').padEnd(18)} action ${String(sd.action).padEnd(3)} ${sd.atStart ? 'runs at map start' : 'one call only'}`);
    }
    if (seeders.length > SHOWN.seeders) print(`    ... ${seeders.length - SHOWN.seeders} more`);
    print('  So it holds for players already in the match, but not for you after a', COLOR.warn);
    print('  rejoin, and not for anyone who joins later. Test it on another client.', COLOR.warn);
  }

  if (has) {
    print('  What each mode would do with this value:', COLOR.title);
    for (const [m, info] of Object.entries(SYNC_MODES)) {
      const [verdict, why] = modeVerdict(m, value);
      print([[`    ${m}  ${info.what.padEnd(8)} ${verdict.padEnd(12)}`, verdict === NO ? COLOR.muted : COLOR.bright], [why, COLOR.hint]]);
    }
    print(`  Recommended: vars sync ${name} ${RECOMMENDED_MODE}${fighting.length ? '   (then watch for the map re-sending it)' : ''}`, COLOR.ok);
    if (seeders.length || synced.length) {
      print(`  Set and send on one line so nothing writes it in between: "vars set ${name} <value> ; vars sync ${name} ${RECOMMENDED_MODE}"`, COLOR.hint);
    }
  }
  if (String(name).includes('#') || (has && String(value).includes('#'))) {
    print('  Careful: a "#" is fine on the live message but the server\'s event-list replay splits on it, so a late joiner may get a cut value.', COLOR.warn);
  }
}

function syncVar(args) {
  const vars = requireVars();
  const modes = Object.keys(SYNC_MODES);
  const usage = `usage: vars sync <name> [${modes.join(' | ')}]  (no mode = explain only)`;
  const name = args[0];
  if (!name || args.length > 2) throw new Error(usage);
  if (args.length === 1) { explainSync(name, vars); return; }
  const mode = args[1].toLowerCase();
  if (!SYNC_MODES[mode]) throw new Error(`no sync mode "${args[1]}". One of: ${modes.map(modeName).join(', ')}.`);
  if (!Object.hasOwn(vars, name)) throw new Error(`no variable "${name}" here: a sync sends your own value, so "vars set ${name} <value>" first.`);
  const value = vars[name];
  if (!syncMarkOn()) throw new Error('this map has no "var_sync" engine mark, so the game sends nothing and no client would apply it');
  if (!game.isMP()) throw new Error('single-player: there is nobody to send to');
  if (String(name).length > VAR_MAX_LEN || String(value).length > VAR_MAX_LEN) throw new Error(`the game refuses a name or value over ${VAR_MAX_LEN} characters`);
  const [verdict, why] = modeVerdict(mode, value);
  if (verdict === NO) {
    throw new Error(`mode ${modeName(mode)} cannot deliver ${showVar(value)}: ${why}. Use "vars sync ${name} ${RECOMMENDED_MODE}", or "vars sync ${name}" to see every mode.`);
  }
  game.sendVarSync(mode, name, value);
  print(`Sent ${name} = ${showVar(value)} to the match, mode ${modeName(mode)}: ${SYNC_MODES[mode].how}.`, COLOR.ok);
  const fighting = syncActionsFor(name).filter((sa) => fights(sa.mode));
  if (fighting.length) print(`  ${plural(fighting.length, 'trigger action')} re-send this variable with ${fightName(fighting[0].mode)} and may undo it ("triggers ${fighting[0].idx}").`, COLOR.warn);
  if (verdict !== YES) print(`  Mode ${mode} is conditional (${verdict}): ${why}.`, COLOR.hint);
  const seeders = seedersFor(name);
  if (seeders.length) {
    print(`  Note: #${seeders[0].idx} ${seeders[0].uid || ''} sets this variable from the map (${seeders[0].atStart ? 'at map start' : 'one call only'}), so a client that reloads the map loses your value. Rejoining is not a test: check it on another client.`, COLOR.warn);
  }
}

// The modes come from SYNC_MODES, so the help cannot drift from what is sent.
const SYNC_HELP_ARGS = [
  ['<name>', 'the variable; "vars set" it to the value you want first'],
  ...Object.entries(SYNC_MODES).map(([m, d]) => [m, `${d.what}: ${d.how}`]),
];

export const varsCommand = {
  name: 'vars',
  aliases: ['var', 'variables'],
  usage: 'vars [filter] [page n]',
  desc: 'List the map\'s trigger variables and their values; a filter matches part of a name',
  clientOnly: 'the value changes in your game only; the server and the other players keep theirs',
  help: {
    about: [
      'The variables the map\'s triggers keep their state in: one name-value store,',
      'emptied whenever a map loads, so it only has the variables a trigger has',
      'touched so far. Numbers print bare and text in quotes, because the "variable',
      'equals" actions tell the two apart.',
    ],
    args: [
      ['[filter]', 'only names containing this text, ignoring case'],
      ['page n', 'jump to page n of a long list'],
    ],
    examples: [
      ['vars', 'every variable with its value'],
      ['vars god', 'only names containing "god"'],
      ['vars get var_text', 'one value, never shortened'],
      ['triggers find var_text', 'the trigger actions that read or write it'],
    ],
    notes: [
      'A long value is shortened in the list; "vars get <name>" prints it in full.',
    ],
    see: ['vars set', 'triggers find', 'triggers'],
  },
  run: listVars,
  subcommands: [
    {
      name: 'set',
      aliases: ['get', 'del', 'unset', 'rm'],
      usage: 'vars set|get|del <name> [value]',
      desc: 'Change, read in full, or remove one trigger variable',
      help: {
        about: [
          'set writes a value, get prints one in full, del removes one.',
          'Typing follows the map loader: a whole number is stored as a number, and',
          'anything else as text, so 5 is a number while 3.5, 01 and -0 stay text.',
          'Wrap it in double quotes to force text, because the "variable equals" actions',
          'compare types: 5 and "5" are not the same value to them.',
          'A value may contain spaces; everything after the name is taken as the value.',
        ],
        args: [
          ['set <name> <value>', 'write it, creating the variable when it is new'],
          ['get <name>', 'print one value, never shortened'],
          ['del <name>', 'remove it (also unset, rm)'],
        ],
        examples: [
          ['vars set var_godhuman 1', 'the number 1'],
          ['vars set var_text "1"', 'the text "1"'],
          ['vars set scale 1.5', 'text, because 1.5 is not a whole number'],
          ['vars set var_nickname some player', 'a value with spaces'],
          ['vars del var_godhuman', 'remove it again'],
        ],
        notes: [
          'Setting a variable does not run anything: a trigger has to read it before',
          'it changes the level. "triggers find <name>" shows which ones do, and',
          '"triggers run <#>" runs one now.',
        ],
        see: ['vars', 'triggers find', 'triggers run'],
      },
      run: writeVar,
    },
    {
      name: 'sync',
      usage: 'vars sync <name> [mode]',
      desc: 'Send one trigger variable to every player in the match; without a mode it explains what would happen and which to use',
      // The one vars command that reaches the other players; it says so itself.
      reportsReach: true,
      help: {
        args: SYNC_HELP_ARGS,
        about: [
          'Sends one variable to every player in the match, the same call the map\'s own',
          'sync actions (types 223-227) make: your current value, plus a merge mode the',
          'receivers apply. It works for any variable, including ones no trigger syncs.',
          'With no mode it only explains: what would be sent, whether the engine mark is',
          'on, which triggers already sync it, what each mode would do to your value, and',
          'which mode to use. Nothing leaves your client until you name a mode.',
        ],
        examples: [
          ['vars sync door_1', 'explain, recommend a mode, send nothing'],
          ['vars set var_presmall "CTHC Lenaa"', 'first set the value you want'],
          ['vars sync var_presmall r', 'then push it to everyone'],
        ],
        notes: [
          'The map must carry the "var_sync" engine mark (an <inf mark="var_sync">',
          'element): without it the game sends nothing and receivers drop the message.',
          'The game never clears that mark on a map change, so your own client can still',
          'have it from an earlier map while other players do not. "vars sync <name>" says',
          'so when it sees that.',
          'A variable the map syncs with max or min fights back: those actions re-send each',
          'client\'s own value, so max can never lower a value and min can never raise one.',
          'Loading a map empties the variable store, and a trigger that runs at map start or',
          'has one call left then writes the map\'s own value in. So a synced value holds for',
          'the players already in the match, but not for anyone who reloads or joins later,',
          'and your own rejoin shows the map value whether the sync worked or not.',
          `Multiplayer only, and the game refuses a name or value over ${VAR_MAX_LEN} characters.`,
        ],
        see: ['vars', 'vars set', 'triggers find', 'triggers run'],
      },
      run: syncVar,
    },
  ],
};
