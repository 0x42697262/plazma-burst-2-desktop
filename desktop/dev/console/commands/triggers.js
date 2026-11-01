// "triggers": list the map's triggers, show one, search them, run one, and the run log.
import { print } from '../ui/log.js';
import { showPaged, takePage } from '../ui/pager.js';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { plural, pluralSuffix, agoText, parseIndex } from '../../../../src/console/kernel/core/words.ts';
import { game } from '../../../../src/console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';
import { ACTION_NAMES } from '../../../../src/console/kernel/game/actions.ts';
import { requireLevel, charLabel } from '../../../../src/console/kernel/game/level.ts';
import { KEY } from '../../../../src/console/kernel/state/schema.ts';
import { settings } from '../../../../src/console/kernel/state/store.ts';
import {
  triggerList, actionsOf, showTarget, callsText, triggerLabel, findTrigger, triggerSources, sourcesOf, SOURCE,
} from '../triggers/model.js';
import { triggerRuns, clearTriggerRuns, TRIG_HISTORY_MAX } from '../triggers/log.js';
import { takeRunOptions, runTriggerAs, reportRun, SHOT_POWER, resolveActions, runScript } from '../triggers/run.js';
import { parseScript, actionInfo, opcodeName, opcodesLoaded, searchActions } from '../triggers/script.js';
import { takeOptions } from '../../../../src/console/kernel/core/args.ts';

const UID_WIDTH = 20; // the uid column of the trigger list
const FIND_UID_WIDTH = 16; // the uid column of search results
const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;

// What an action does: the console's own name for it, else the editor's description.
const actionName = (type) => {
  const what = ACTION_NAMES[type] || actionInfo(type)?.desc;
  return what ? `  (${what})` : '';
};
const disabledColor = (t) => (t[GAME_FIELDS.T_ENABLED] ? undefined : COLOR.muted);
const actionWord = (n) => `action${pluralSuffix(n)}`;

// The map's triggers, or null after saying there are none.
function triggersOrNone() {
  requireLevel();
  const list = triggerList();
  if (!list.length) { print('This map has no triggers', COLOR.notice); return null; }
  return list;
}

// ----- triggers [# | uid | text | on | off] -----

function showOne(list, idx, page) {
  const t = list[idx];
  if (!t) throw new Error(`no trigger #${idx}. This map has ${list.length} (0-${list.length - 1}).`);
  const by = triggerSources().get(idx);
  const n = t[GAME_FIELDS.T_ACTIONS] || 0;
  const rows = [...actionsOf(t)].map(({ n: a, type, A, B }) => [
    `    ${String(a).padStart(3)}. type ${String(type).padEnd(4)} A = ${showTarget(A)}   B = ${showTarget(B)}${actionName(type)}`]);
  print(`Trigger ${triggerLabel(idx, t)}`, COLOR.title);
  print(`  ${t[GAME_FIELDS.T_ENABLED] ? 'enabled' : 'disabled'}, calls ${callsText(t)}${t[GAME_FIELDS.T_AT_START] ? ', runs at map start' : ''}`);
  print(`  started by: ${by ? by.map((src) => src.text).join('; ') : 'nothing found (maybe a shot at an object, or another trigger through a variable)'}`);
  showPaged({ title: `  ${plural(n, 'action')} (type = the map editor's action number):`, color: COLOR.plain, rows, cmd: `triggers ${idx}`, page });
}

function listTriggers(rawArgs) {
  const list = triggersOrNone();
  if (!list) return;
  const { args, page } = takePage(rawArgs);
  const q = args.join(' ').trim();
  const lc = q.toLowerCase();
  const idx = findTrigger(list, q);
  if (idx >= 0) { showOne(list, idx, page); return; }

  const sources = triggerSources();
  const on = list.filter((t) => t && t[GAME_FIELDS.T_ENABLED]).length;
  const rows = [];
  list.forEach((t, i) => {
    if (!t) return;
    const enabled = !!t[GAME_FIELDS.T_ENABLED];
    if (lc === 'on' && !enabled) return;
    if (lc === 'off' && enabled) return;
    if (lc && lc !== 'on' && lc !== 'off' && !String(t.uid).toLowerCase().includes(lc)) return;
    const by = sources.get(i);
    const flags = [t[GAME_FIELDS.T_AT_START] ? 'at start' : '', by ? `by ${by[0].text}${by.length > 1 ? ` +${by.length - 1}` : ''}` : ''].filter(Boolean).join(', ');
    const n = t[GAME_FIELDS.T_ACTIONS] || 0;
    rows.push([`  #${String(i).padEnd(4)} ${String(t.uid || '-').padEnd(UID_WIDTH)} ${enabled ? 'on ' : 'off'}  ${callsText(t).padEnd(12)} ${String(n).padStart(3)} ${n === 1 ? 'action ' : 'actions'}  ${flags}`,
      disabledColor(t)]);
  });
  showPaged({
    title: `Triggers: ${list.length} (${on} enabled, ${list.length - on} disabled).${q ? ` Filter "${q}": ${rows.length} shown.` : ''} "triggers <#>" shows one in detail.`,
    rows,
    cmd: q ? `triggers ${q}` : 'triggers',
    empty: lc === 'on' ? '  no enabled triggers' : lc === 'off' ? '  no disabled triggers' : `  no trigger matches "${q}"`,
    page,
  });
}

// ----- triggers history -----

function showHistory(rawArgs) {
  if (!triggersOrNone()) return;
  const { args, page } = takePage(rawArgs);
  const q = args.join(' ').trim().toLowerCase();
  const runs = triggerRuns();
  if (q === 'clear') { clearTriggerRuns(); print('Trigger history cleared', COLOR.ok); return; }
  if (!settings.effective(KEY.TRIGGER_HISTORY)) print(`Trigger history is off ("${KEY.TRIGGER_HISTORY} on" to record).`, COLOR.notice);
  const all = q === 'all';
  const byIdx = parseIndex(q) ?? -1;
  const now = performance.now();
  const me = game.me();
  const rows = [];
  let refused = 0;
  for (let k = runs.length - 1; k >= 0; k--) {
    const h = runs[k];
    if (!h.ok) refused++;
    if (!h.ok && !all && byIdx < 0) continue;
    if (byIdx >= 0 && h.idx !== byIdx) continue;
    if (q && !all && byIdx < 0 && !String(h.uid || '').toLowerCase().includes(q)) continue;
    const who = typeof h.by !== 'number' || h.by < 0 ? '-' : h.by === me ? 'you' : charLabel(h.by);
    const result = h.ok ? 'ran' : `refused (${h.why})`;
    rows.push([`  ${agoText(now - h.last).padEnd(10)} #${String(h.idx).padEnd(5)} ${String(h.uid || '-').padEnd(UID_WIDTH)} by ${who.padEnd(16)} ${result}${h.count > 1 ? ` x${h.count}` : ''}`,
      h.ok ? undefined : COLOR.muted]);
  }
  const hidden = !all && byIdx < 0 && refused ? ` ${plural(refused, 'refused attempt')} hidden ("triggers history all").` : '';
  showPaged({
    title: `Trigger history, newest first (${runs.length} recorded, max ${TRIG_HISTORY_MAX}).${hidden}`,
    rows,
    cmd: `triggers history${q ? ' ' + q : ''}`,
    empty: q && q !== 'all' ? `  no recorded run matches "${q}"` : '  no trigger has run since the map loaded (or since "triggers history clear")',
    hint: 'Triggers that run while the map loads ("at start") are not recorded. "triggers <#>" shows one trigger.',
    page,
  });
}

// ----- triggers find -----

// Each term is "text" (uid, A or B), "uid:text", "a:text", "b:text", "type:n" or
// "by:how"; all terms must match. Text matches anywhere, ignoring case; a number
// matches number values exactly (5 does not match 15).
const FIELD = Object.freeze({
  any: 'ab', uid: 'uid', a: 'a', b: 'b', type: 'type', by: 'by', calls: 'calls', maxcalls: 'maxcalls',
});
// Terms about the trigger itself rather than its actions.
const TRIGGER_FIELDS = new Set([FIELD.uid, FIELD.by, FIELD.calls, FIELD.maxcalls]);

// "calls:" and "maxcalls:": a number, optionally after a comparison. Unlimited (-1 in the
// game) counts as more than any number, so "calls:>5" includes it; "unlimited" alone
// picks only those.
const UNLIMITED = -1;
const UNLIMITED_WORDS = ['unlimited', 'inf', 'infinite', '-1'];
const COMPARE = Object.freeze({
  '=': (a, b) => a === b, '!=': (a, b) => a !== b, '>': (a, b) => a > b,
  '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b,
});
const asCount = (n) => (n === UNLIMITED ? Infinity : n);
const countOf = (t, field) => asCount(t[field === FIELD.calls ? GAME_FIELDS.T_CALLS : GAME_FIELDS.T_MAX_CALLS]);

function parseCount(field, text) {
  const m = text.match(/^(<=|>=|!=|<|>|=)?(.+)$/);
  const op = m[1] || '=';
  const word = m[2];
  const value = UNLIMITED_WORDS.includes(word) ? Infinity : /^\d+$/.test(word) ? Number(word) : null;
  if (value === null) throw new Error(`${field}: expects a number or "unlimited", with < > <= >= != if you like: ${field}:>3`);
  return { compare: COMPARE[op], value };
}

// "by:" words: what runs a trigger. "none" finds triggers nothing in the map starts
// (a shot at an object, or a trigger run through a variable).
const NO_SOURCE = 'none';
const BY_WORDS = Object.freeze({
  region: SOURCE.REGION, timer: SOURCE.TIMER, chat: SOURCE.CHAT, death: SOURCE.DEATH, player: SOURCE.DEATH,
  trigger: SOURCE.TRIGGER, start: SOURCE.START, none: NO_SOURCE,
});
// These name one thing that runs triggers, so "by:timer#3" can pick it.
const NUMBERED = new Set([SOURCE.REGION, SOURCE.TIMER, SOURCE.DEATH, SOURCE.TRIGGER]);
const SOURCES_SHOWN = 3; // per row; "triggers <#>" lists them all
const byWords = Object.keys(BY_WORDS).join(', ');

// "by:region", "by:timer#3" (index), or "by:#timer*37" (the uid, as in the map).
function parseBy(text) {
  if (text.startsWith('#')) return { uid: text };
  const m = text.match(/^([a-z]+)(?:#?(\d+))?$/);
  const kind = m && BY_WORDS[m[1]];
  if (!kind) throw new Error(`by: expects one of ${byWords}, or a uid; e.g. by:timer, by:region#3, by:#timer*37`);
  const index = m[2] === undefined ? null : Number(m[2]);
  if (index !== null && !NUMBERED.has(kind)) throw new Error(`by:${m[1]} takes no number`);
  return { kind, index };
}

function parseTerms(args, usage) {
  return args.map((raw) => {
    const m = raw.match(/^(uid|a|b|type|by|calls|maxcalls):(.*)$/i);
    const field = m ? m[1].toLowerCase() : FIELD.any;
    const text = (m ? m[2] : raw).toLowerCase();
    if (!text) throw new Error(usage);
    if (field === FIELD.type && !/^\d+$/.test(text)) throw new Error('type: expects a number, e.g. type:99');
    const extra = field === FIELD.by ? parseBy(text)
      : field === FIELD.calls || field === FIELD.maxcalls ? parseCount(field, text) : {};
    return { field, text, num: NUMBER_TEXT.test(text) ? Number(text) : null, ...extra };
  });
}

function valueMatches(v, term) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'number') return term.num !== null && v === term.num;
  const t = String(v).toLowerCase();
  return term.num !== null && NUMBER_TEXT.test(t) ? Number(t) === term.num : t.includes(term.text);
}

const uidMatches = (t, term) => String(t.uid || '').toLowerCase().includes(term.text);

// The sources of a trigger that a "by:" term matches ([] for "by:none" when nothing
// runs it), or null when it does not match.
function bySources(srcs, term) {
  if (term.kind === NO_SOURCE) return srcs.length ? null : [];
  const hit = term.uid
    ? srcs.filter((src) => src.uid && src.uid.toLowerCase() === term.uid)
    : srcs.filter((src) => src.kind === term.kind && (term.index === null || src.index === term.index));
  return hit.length ? hit : null;
}

function actionMatches({ type, A, B }, term) {
  switch (term.field) {
    case FIELD.type: return type === term.num;
    case FIELD.a: return valueMatches(A, term);
    case FIELD.b: return valueMatches(B, term);
    default: return valueMatches(A, term) || valueMatches(B, term);
  }
}

function find(rawArgs) {
  const list = triggersOrNone();
  if (!list) return;
  const { args, page } = takePage(rawArgs);
  const usage = 'usage: triggers find <text>  |  uid:<text>  by:<how>  calls:<n>  maxcalls:<n>  a:<text>  b:<text>  type:<n>  (combine terms, e.g. "type:41 a:sound", "by:timer", "calls:>3")';
  if (!args.length) throw new Error(usage);
  const terms = parseTerms(args, usage);
  // "uid:", "by:", "calls:" and "maxcalls:" pick which triggers to look at at all; the others match
  // actions. A bare term may match the uid instead of an action, so "find god_all"
  // lists the #god_all trigger itself as well as the actions pointing at it.
  const uidTerms = terms.filter((term) => term.field === FIELD.uid);
  const byTerms = terms.filter((term) => term.field === FIELD.by);
  const countTerms = terms.filter((term) => term.field === FIELD.calls || term.field === FIELD.maxcalls);
  const actionTerms = terms.filter((term) => !TRIGGER_FIELDS.has(term.field));
  const sources = byTerms.length ? triggerSources() : null;
  const trigRows = [];
  const actRows = [];
  const triggersHit = new Set();
  list.forEach((t, i) => {
    if (!t) return;
    if (!uidTerms.every((term) => uidMatches(t, term))) return;
    if (!countTerms.every((term) => term.compare(countOf(t, term.field), term.value))) return;
    const srcs = sources && sourcesOf(sources, i, t);
    const byHits = byTerms.map((term) => bySources(srcs, term));
    if (byHits.includes(null)) return;
    // Nothing left to match in the actions: one row for the trigger, not for actions.
    if (actionTerms.every((term) => term.field === FIELD.any && uidMatches(t, term))) {
      const n = t[GAME_FIELDS.T_ACTIONS] || 0;
      const how = [...new Set(byHits.flat().map((src) => src.text))];
      const shown = how.slice(0, SOURCES_SHOWN).join('; ') + (how.length > SOURCES_SHOWN ? ` +${how.length - SOURCES_SHOWN} more` : '');
      trigRows.push([`  #${String(i).padEnd(4)} ${String(t.uid || '-').padEnd(FIND_UID_WIDTH)} trigger   ${t[GAME_FIELDS.T_ENABLED] ? 'on ' : 'off'}  ${callsText(t).padEnd(12)} ${String(n).padStart(3)} ${actionWord(n)}${how.length ? `  by ${shown}` : ''}`,
        disabledColor(t)]);
    }
    if (!actionTerms.length) return; // only trigger terms: the trigger row is the whole answer
    for (const action of actionsOf(t)) {
      if (!actionTerms.every((term) => actionMatches(action, term))) continue;
      triggersHit.add(i);
      const { n, type, A, B } = action;
      actRows.push([`  #${String(i).padEnd(4)} ${String(t.uid || '-').padEnd(FIND_UID_WIDTH)} action ${String(n).padEnd(3)} type ${String(type).padEnd(4)} A = ${showTarget(A)}   B = ${showTarget(B)}${actionName(type)}`,
        disabledColor(t)]);
    }
  });
  const rows = trigRows.concat(actRows);
  const q = args.join(' ');
  const bits = [];
  if (trigRows.length) bits.push(`${plural(trigRows.length, 'trigger')}${byTerms.length || countTerms.length ? '' : ' by uid'}`);
  if (actRows.length) bits.push(`${plural(actRows.length, 'action')} in ${plural(triggersHit.size, 'trigger')}`);
  showPaged({
    title: rows.length ? `${bits.join(', ')} ${rows.length === 1 ? 'matches' : 'match'} "${q}". "triggers <#>" shows one in full.` : `No trigger or action matches "${q}"`,
    color: rows.length ? COLOR.title : COLOR.notice,
    rows,
    cmd: `triggers find ${q}`,
    page,
  });
}

// ----- triggers run -----

function runOne(args) {
  const list = triggersOrNone();
  if (!list) return;
  const usage = 'usage: triggers run <# | uid> [force] [as <char#>]';
  const { rest, force, activator } = takeRunOptions(args, usage);
  if (rest.length !== 1) throw new Error(usage);
  const idx = findTrigger(list, rest[0]);
  const t = list[idx];
  if (idx < 0 || !t) throw new Error(`no trigger "${rest[0]}". Type "triggers" or "triggers find <text>".`);
  const outcome = runTriggerAs(idx, t, { force, activator, power: SHOT_POWER, forceHint: `triggers run ${idx} force` });
  reportRun(`trigger ${outcome.label}`, t, activator, outcome);
}

// ----- triggers exec -----

const EXEC_OPTIONS = ['check', 'force'];
const EXEC_USAGE = 'usage: triggers exec [--check] [--force] <script>  (paste a trigger from the map editor\'s text view)';

// The script is the rest of the line as typed (it is never split at ";"), after the
// options in front of it.
function scriptText(rest) {
  const text = rest.replace(/^\S+\s*/, ''); // the subcommand word
  const words = text.match(/^(?:--\S*\s*)*/)[0];
  const { options } = takeOptions(words.split(/\s+/).filter(Boolean), EXEC_OPTIONS);
  return { options, script: text.slice(words.length) };
}

// The headers say whether the trigger would run at all; like "triggers run", --force
// runs it anyway.
function headerRefusal(headers) {
  if (headers.enabled !== undefined && headers.enabled !== 'true') return `it says "enabled: ${headers.enabled}"`;
  if (headers.maxcalls !== undefined && Number(headers.maxcalls) === 0) return 'it says "maxcalls: 0"';
  return '';
}

function execScript(_args, { rest }) {
  const { options, script } = scriptText(rest);
  if (!script.trim()) throw new Error(EXEC_USAGE);
  // "exec" used to run a map trigger.
  if (/^#?\S+$/.test(script.trim()) && findTrigger(triggerList(), script.trim()) >= 0) {
    throw new Error(`"triggers exec" runs a pasted script; "triggers run ${script.trim()}" runs that map trigger.`);
  }
  const { headers, actions } = parseScript(script);
  requireLevel();
  const resolved = resolveActions(actions);
  const label = headers.uid ? `"${headers.uid}"` : 'script';
  if (options.has('check')) {
    print(`Pasted trigger ${label}: ${plural(actions.length, 'action')}, not run (--check)`, COLOR.title);
    for (const a of resolved) {
      print(`  ${String(a.line).padStart(3)}. ${opcodeName(a.type)} (type ${a.type})  A = ${showTarget(a.A)}   B = ${showTarget(a.B)}${actionName(a.type)}`);
    }
    return;
  }
  const refusal = headerRefusal(headers);
  if (refusal && !options.has('force')) throw new Error(`not run: ${refusal}. "triggers exec --force ..." runs it anyway.`);
  runScript(resolved, { activator: game.me(), uid: headers.uid });
  print(`Ran pasted trigger ${label} (${plural(actions.length, 'action')})`, COLOR.ok);
  if (game.isMP()) print('Note: ran in your game only: the other players do not have this trigger. What its actions send themselves (vars sync, ...) still reaches them.', COLOR.warn);
}

// ----- triggers actions -----

function listActions(rawArgs) {
  if (!opcodesLoaded()) throw new Error('the editor\'s action list is not loaded. Run "npm run fetch-opcodes" and restart.');
  const { args, page } = takePage(rawArgs);
  const q = args.join(' ').trim();
  const hits = searchActions(q);
  const rows = hits.map((a) => [`  ${String(a.type).padStart(4)}  ${(a.alias || `op${a.type}`).padEnd(28)} ${a.desc}  [A: ${a.a}, B: ${a.b}]`]);
  showPaged({
    title: `${q ? `Trigger actions matching "${q}"` : 'Trigger actions'}: ${hits.length}. Write them as Name( "A", "B" ); in "triggers exec".`,
    rows,
    cmd: `triggers actions${q ? ' ' + q : ''}`,
    empty: `  no action matches "${q}"`,
    page,
  });
}

export const triggersCommand = {
  name: 'triggers',
  aliases: ['trigger', 'trig'],
  usage: 'triggers [# | uid | on | off] [page n]',
  desc: 'List map triggers (enabled, calls left, what starts them), or one trigger\'s actions. Long lists are paged (page_size)',
  help: {
    about: [
      'A read-only view of the map\'s triggers.',
      'No argument: all of them, with what starts each one (region, timer, map start,',
      'chat). A number or uid: that trigger in full, action by action. Text: only the',
      'triggers whose uid contains it.',
    ],
    args: [
      ['[#]', 'trigger index, e.g. 12 or #12'],
      ['[uid]', 'exact uid, e.g. #god_all'],
      ['[text]', 'every uid containing it'],
      ['on | off', 'only enabled, or only disabled'],
      ['page n', 'jump to page n of a long list'],
    ],
    examples: [
      ['triggers', 'all of them'],
      ['triggers off', 'only the disabled ones'],
      ['triggers 12', 'trigger #12 in full'],
      ['triggers #god_all', 'the same, by uid'],
      ['triggers god', 'every uid containing "god"'],
    ],
    notes: [
      'Long lists are paged: "more" is the next page, page_size sets the length.',
    ],
    see: ['triggers find', 'triggers run', 'triggers exec', 'triggers history', 'more'],
  },
  run: listTriggers,
  subcommands: [
    {
      name: 'history',
      aliases: ['hist', 'log'],
      usage: 'triggers history [all | clear | # | uid] [page n]',
      desc: 'Recent trigger runs, newest first: when, which, by whom. "all" adds refused attempts (disabled / no calls left)',
      help: {
        about: [
          'Every trigger run since the map loaded, newest first: how long ago, which',
          'trigger, who started it, and whether it ran. Attempts the game refused',
          '(disabled, or no calls left) are hidden until you ask for "all".',
        ],
        args: [
          ['(nothing)', 'runs that succeeded'],
          ['all', 'refused attempts as well'],
          ['clear', 'empty the list'],
          ['<#>', 'one trigger index, refusals included'],
          ['[text]', 'only uids containing it'],
          ['page n', 'jump to page n'],
        ],
        examples: [
          ['triggers history', 'the recent runs'],
          ['triggers history all', 'refusals too'],
          ['triggers history god', 'only uids containing "god"'],
          ['triggers history clear', 'start over'],
        ],
        notes: [
          `Recording is the trigger_history key (on by default), and the last ${TRIG_HISTORY_MAX} runs are kept.`,
          'Triggers that run while the map loads ("at start") are not recorded.',
        ],
        see: ['triggers', 'triggers run', 'trigger_history'],
      },
      run: showHistory,
    },
    {
      name: 'find',
      aliases: ['search'],
      usage: 'triggers find [uid:|by:|calls:|maxcalls:|a:|b:|type:]<text> [page n]',
      desc: 'Search trigger uids and every trigger action\'s A/B values (text or number), by action type, or by what runs a trigger',
      help: {
        about: [
          'Searches trigger uids and every action\'s A and B value, or finds triggers by',
          'what runs them: a region, a timer, chat, a character\'s death, another trigger,',
          'or map start.',
          'All terms must match. A bare term matches a uid, an A or a B; the prefixes',
          'narrow it. Text matches anywhere and ignores case; a number matches number',
          'values exactly, so 5 does not match 15.',
        ],
        args: [
          ['<text>', 'uid, A or B'],
          ['uid:<text>', 'the trigger uid only'],
          ['by:<how>', `what runs it: ${byWords}`],
          ['by:<how>#<n>', 'one region, timer, character or trigger, by index: by:timer#3'],
          ['by:#<uid>', 'the same by its uid, as the map names it: by:#timer*37'],
          ['calls:<n>', 'calls left; with < > <= >= !=, e.g. calls:>3, calls:0 (used up)'],
          ['maxcalls:<n>', 'the most calls the map allows; maxcalls:1 is a one-shot'],
          ['a:<text>', 'A values only'],
          ['b:<text>', 'B values only'],
          ['type:<n>', 'the map editor\'s action number'],
          ['page n', 'jump to page n'],
        ],
        examples: [
          ['triggers find god_all', 'the #god_all trigger and the actions pointing at it'],
          ['triggers find uid:god', 'every trigger whose uid contains "god"'],
          ['triggers find type:59', 'every action of type 59'],
          ['triggers find type:41 a:sound', 'type 41 whose A mentions a sound'],
          ['triggers find by:timer', 'every trigger a timer runs, and which timer'],
          ['triggers find by:region#3', 'what region #3 runs'],
          ['triggers find by:#timer*37', 'what the timer the map calls #timer*37 runs'],
          ['triggers find by:trigger uid:kick', 'which trigger runs #kick, or continues in it'],
          ['triggers find by:none', 'triggers nothing in the map starts'],
          ['triggers find calls:0', 'used up: they will not run again'],
          ['triggers find maxcalls:1 calls:1', 'one-shots that have not run yet'],
          ['triggers find calls:unlimited by:region', 'region triggers that never run out'],
        ],
        notes: [
          'A uid hit prints one row for the trigger, not one per action.',
          '"uid:" and "by:" on their own list triggers only; add a:, b: or type: to get',
          'actions too. A "by:" row says what runs the trigger.',
          'Indexes and uids differ: #36 is the 37th timer in the map, whatever its uid. The',
          'rows show both, e.g. "timer #36 #timer*37".',
          '"by:" is what runs a trigger directly. For a chain (chat runs a trigger that',
          'continues in another), follow it: "by:trigger" names the one that runs it.',
          '"calls:" and "maxcalls:" count unlimited as more than any number, so',
          '"calls:>5" includes unlimited triggers; "calls:unlimited" lists only those.',
          '"by:none" also lists triggers run by a shot at an object or through a variable:',
          'those leave nothing in the map to find.',
        ],
        see: ['triggers', 'triggers run'],
      },
      run: find,
    },
    {
      name: 'run',
      aliases: ['activate', 'fire'],
      usage: 'triggers run <# | uid> [force] [as #]',
      desc: 'Run a trigger now, with you (or character #) as the activator. "force" also runs a disabled/used-up one. Multiplayer: other players see it too (not with "as", or forced on a disabled/used-up one)',
      reportsReach: true,
      help: {
        about: [
          'Runs a trigger through the game\'s own function, the way a shot or a region',
          'does: the activator ("the player who started it", which many actions use) is',
          'set first.',
          'Without "force" the game\'s rules apply: the trigger must be enabled with calls',
          'left, and running uses one up. With "force" it runs anyway, and its enabled',
          'state and calls left are put back afterwards.',
        ],
        args: [
          ['<# | uid>', 'which trigger'],
          ['force', 'ignore enabled and calls left, then restore them'],
          ['as <char#>', 'run it as that character (see "chars")'],
        ],
        examples: [
          ['triggers run 12', 'by index'],
          ['triggers run #god_all', 'by uid'],
          ['triggers run 12 force', 'even when disabled or used up'],
          ['triggers run 12 as 3', 'as character #3'],
        ],
        notes: [
          'Multiplayer: the run is sent to the server, so other players run it too.',
          'Not sent when the other clients would refuse it or run it differently: forced',
          'on a disabled or used-up trigger, "as" someone else (the server always makes',
          'the sender the activator), or while spectating. Then it runs in your game only',
          'and the console says which of those it was.',
        ],
        see: ['triggers', 'triggers history', 'chars'],
      },
      run: runOne,
    },
    {
      name: 'exec',
      aliases: ['paste', 'script'],
      usage: 'triggers exec [--check] [--force] <script>',
      desc: 'Run a trigger pasted from the map editor\'s text view (uid:/enabled:/maxcalls: lines optional). --check shows what it would do. Multiplayer: your game only',
      rawLine: true, // the script has its own ";"
      reportsReach: true,
      help: {
        about: [
          'Runs trigger actions written the way the map editor\'s "edit triggers as text"',
          'view shows them, once, as a trigger of its own, through the game\'s runner:',
          '  uid: #trigger*1016',
          '  enabled: true',
          '  maxcalls: -1',
          '  next if VarA == ValueB( "var_suddendeath", "1" );',
          '  MovableTo( "#door*13", "#region*306" );',
          'Paste a script with several lines into the console input: it becomes one line,',
          'with "triggers exec" in front when the input was empty. Then press Enter.',
          'Targets are read like the map loader reads them: "#door*13" is that object of',
          'this map, a whole number is a number, anything else is text. You are the',
          'activator ("the player who started it").',
        ],
        args: [
          ['<script>', 'the actions: Name( "A", "B" ); each, or op<number>( "A", "B" );'],
          ['--check', 'show the actions and their targets in this map, do not run'],
          ['--force', 'run even when the headers say "enabled: false" or "maxcalls: 0"'],
        ],
        examples: [
          ['triggers exec MovableTo( "#door*13", "#region*306" );', 'move a door'],
          ['triggers exec --check TimerDisable( "#timer*631", "0" );', 'see what it would do'],
          ['triggers exec op100( "my_var", "5" );', 'an action by number (set variable)'],
        ],
        notes: [
          'The headers are optional. uid only names the run; actions cannot refer to the',
          'pasted trigger by it.',
          'A "#uid" this map does not have is refused where the action expects an object:',
          'the game would read it as object #0.',
          'Nothing is escaped, like in the editor: ""1"" is the text "1" with its quotes.',
          'The whole rest of the line is the script, so ";" cannot chain another command.',
          'Multiplayer: it runs in your game only (the other players do not have this',
          'trigger). Actions that send something themselves, like a var sync, still do.',
          'Action names come from the map editor ("npm run fetch-opcodes"); without them',
          'only op<number> works. "triggers actions" lists them.',
        ],
        see: ['triggers actions', 'triggers run', 'triggers'],
      },
      run: execScript,
    },
    {
      name: 'actions',
      aliases: ['ops', 'opcodes'],
      usage: 'triggers actions [text | number] [page n]',
      desc: 'The map editor\'s trigger actions: number, name for "triggers exec", what it does',
      help: {
        about: [
          'Every trigger action the map editor knows: its number, the name its text view',
          'uses (op<number> when it has none), what it does, and what A and B are.',
          'Words filter it: all must appear in the name or the description.',
        ],
        args: [
          ['[text]', 'words in the name or description'],
          ['[number]', 'one action number'],
          ['page n', 'jump to page n'],
        ],
        examples: [
          ['triggers actions', 'all of them'],
          ['triggers actions timer', 'everything about timers'],
          ['triggers actions 123', 'action 123'],
        ],
        see: ['triggers exec'],
      },
      run: listActions,
    },
  ],
};
