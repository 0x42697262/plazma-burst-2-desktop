// "logic": how the map's regions, triggers, timers, doors and the rest are wired.
// "logic show" draws it over the level; "logic <uid>" prints one element as a tree.
import { print } from '../../../../src/console/kernel/ui/log.ts';
import { showPaged, takePage } from '../../../../src/console/kernel/ui/pager.ts';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { plural } from '../../../../src/console/kernel/core/words.ts';
import { requireLevel } from '../../../../src/console/kernel/game/level.ts';
import { LINK, logicGraph, findNode, placeOf, chatTriggerUid } from '../logic/graph.js';
import { showLogic, hideLogic, logicShown, isVisible } from '../logic/view.js';
import { REMOTE } from '../../../../src/console/kernel/core/mode.ts';

const KINDS = Object.values(LINK);
const DEFAULT_DEPTH = Object.freeze({ show: 1, tree: 3 });
const MAX_DEPTH = 10;
const INDENT = '   ';

function requireGraph() {
  requireLevel();
  const g = logicGraph();
  if (!g) throw new Error('the map text is not readable yet (it is unpacked when the level starts)');
  return g;
}

// "... depth <n>" anywhere in the arguments.
function takeDepth(args, fallback) {
  const at = args.findIndex((a) => a.toLowerCase() === 'depth');
  if (at === -1) return { args, depth: fallback };
  const depth = Number(args[at + 1]);
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) throw new Error(`depth expects 1-${MAX_DEPTH}`);
  return { args: [...args.slice(0, at), ...args.slice(at + 2)], depth };
}

function requireNode(g, q) {
  const node = findNode(g, q);
  if (!node) throw new Error(`nothing in this map is called "${q}". Uids look like #god_all; "triggers find" lists triggers.`);
  return node;
}

// The element types this map has (its tags: trigger, region, door...), most first.
function typesIn(g) {
  const counts = new Map();
  for (const n of g.nodes) counts.set(n.tag, (counts.get(n.tag) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}

const typeList = (g) => typesIn(g).map(([t, n]) => `${t} ${n}`).join(', ');

// "region", "regions", "boxes" -> the map's tag. Throws with the map's types otherwise.
function resolveType(g, word) {
  const w = word.toLowerCase();
  const tags = new Set(g.nodes.map((n) => n.tag));
  const tag = [w, w.replace(/s$/, ''), w.replace(/es$/, '')].find((t) => tags.has(t));
  if (!tag) throw new Error(`this map has no "${word}". Types: ${typeList(g)}`);
  return tag;
}

const SCREEN_WORDS = ['screen', 'visible', 'onscreen']; // only what the camera shows now
const TYPE_PREFIX = 'type:'; // only elements of these types
const NOT_PREFIX = 'not:'; // no elements of these types

// The filter words of "logic show" and the tree, taken out of the arguments:
//   start | control | act | attach | ref   only links of these kinds
//   type:<t>[,<t>...]                      only elements of these types
//   not:<t>[,<t>...]                       no elements of these types
//   screen                                 only elements inside the camera view
function takeFilters(g, args) {
  let screen = false;
  const kinds = new Set();
  let only = null;
  const without = new Set();
  const rest = [];
  for (const a of args) {
    const w = a.toLowerCase();
    if (KINDS.includes(w)) kinds.add(w);
    else if (SCREEN_WORDS.includes(w)) screen = true;
    else if (w.startsWith(TYPE_PREFIX)) {
      only = only || new Set();
      for (const t of w.slice(TYPE_PREFIX.length).split(',').filter(Boolean)) only.add(resolveType(g, t));
    } else if (w.startsWith(NOT_PREFIX)) {
      for (const t of w.slice(NOT_PREFIX.length).split(',').filter(Boolean)) without.add(resolveType(g, t));
    } else rest.push(a);
  }
  const typeOk = (node) => (!only || only.has(node.tag)) && !without.has(node.tag);
  const kindOk = (link) => !kinds.size || kinds.has(link.kind);
  const describe = [
    kinds.size ? [...kinds].join(', ') : 'every kind',
    only ? `only ${[...only].join(', ')}` : '',
    without.size ? `not ${[...without].join(', ')}` : '',
    screen ? 'on screen' : '',
  ].filter(Boolean).join(', ');
  return { args: rest, typeOk, kindOk, screen, describe, filtered: kinds.size > 0 || !!only || without.size > 0 || screen };
}

const name = (node) => `${node.uid}  ${node.tag} #${node.index}`;
const where = (node) => {
  const p = placeOf(node);
  return Number.isFinite(p.x) ? ` at ${Math.round(p.x)}, ${Math.round(p.y)}` : '';
};

// Links within `depth` steps of a node, either way, travelling only the kept ones.
function around(g, node, depth, keep) {
  const links = new Set();
  let ring = [node];
  const seen = new Set(ring);
  for (let d = 0; d < depth && ring.length; d++) {
    const next = [];
    for (const n of ring) {
      for (const l of [...(g.outOf.get(n.uid) || []), ...(g.into.get(n.uid) || [])]) {
        if (!keep(l)) continue;
        links.add(l);
        for (const other of [l.from, l.to]) if (!seen.has(other)) { seen.add(other); next.push(other); }
      }
    }
    ring = next;
  }
  return links;
}

function show(rawArgs) {
  const g = requireGraph();
  const { args: rest, depth } = takeDepth(rawArgs, DEFAULT_DEPTH.show);
  const { args, typeOk, kindOk, screen, describe } = takeFilters(g, rest);
  // A uid may hold spaces ("#activate commands"), so the other words are one uid.
  const target = args.join(' ');
  const node = target ? requireNode(g, target) : null;
  // Around an element, that element stays whatever its type, so its own links show.
  const ends = (n) => n === node || typeOk(n);
  const keep = (l) => kindOk(l) && ends(l.from) && ends(l.to);
  const near = node ? around(g, node, depth, keep) : null;
  const filter = (l) => keep(l) && (!near || near.has(l));
  const where = node ? `around ${node.uid} (depth ${depth})` : 'in the whole map';
  showLogic(filter, { screen, describe: `${screen ? 'on screen ' : ''}${where}: ${describe}` });
  if (screen) {
    const now = g.links.filter((l) => filter(l) && isVisible(l.from) && isVisible(l.to)).length;
    print(`Showing the links with both ends on screen ${where}: ${describe}. ${plural(now, 'link')} right now; it follows the camera. "logic hide" stops.`, COLOR.ok);
  } else {
    print(`Showing ${plural(g.links.filter(filter).length, 'link')} ${where}: ${describe}. Only the ones on screen are drawn; "logic hide" stops.`, COLOR.ok);
  }
  print('  green: starts a trigger   yellow: enables/disables   blue: acts on   white: attached   pink: other', COLOR.hint);
  print('  Aim the crosshair at a label to open its group ("+NAMES more", or hidden for lack of room).', COLOR.hint);
}

// The links from one element to another, as one row: "actions 5, 12: 20 enable trigger A"
// when they only differ in the action number.
const ACTION_LABEL = /^action (\d+): (.*)$/;
function mergedLabel(links) {
  const parts = links.map((l) => l.label.match(ACTION_LABEL));
  if (links.length > 1 && parts.every((m) => m && m[2] === parts[0][2])) return `actions ${parts.map((m) => m[1]).join(', ')}: ${parts[0][2]}`;
  return links.map((l) => l.label).join('; ');
}

// Links grouped by the element at their other end, in map order.
function groupBy(links, end) {
  const groups = new Map();
  for (const l of links) {
    if (!groups.has(l[end])) groups.set(l[end], []);
    groups.get(l[end]).push(l);
  }
  return [...groups];
}

const starts = (links) => links.some((l) => l.kind === LINK.START);

// One element: what leads to it (followed back along what starts it), and what it does.
function tree(rawArgs) {
  const g = requireGraph();
  const { args: rest, depth } = takeDepth(rawArgs, DEFAULT_DEPTH.tree);
  const { args: unpaged, page } = takePage(rest);
  const { args, typeOk, kindOk, screen, describe, filtered } = takeFilters(g, unpaged);
  if (!args.length) throw new Error('usage: logic <uid> [depth n] [type:<t>] [not:<t>] [start | control | act | attach | ref]');
  const node = requireNode(g, args.join(' '));
  // A row is kept when its link passes and the element at its other end does.
  const keepRow = (l, other) => kindOk(l) && typeOk(other) && (!screen || isVisible(other));
  const chat = chatTriggerUid();
  const rows = [];
  const back = (n, level, path) => {
    if (n.uid === chat) rows.push([`${INDENT.repeat(level)}<- chat message`, COLOR.title]);
    for (const [from, links] of groupBy((g.into.get(n.uid) || []).filter((l) => keepRow(l, l.from)), 'from')) {
      // Past the first step, follow only what starts things: that is how it got run.
      const shown = level > 1 ? links.filter((l) => l.kind === LINK.START) : links;
      if (!shown.length) continue;
      const loop = path.has(from);
      rows.push([`${INDENT.repeat(level)}<- ${name(from)}   ${mergedLabel(shown)}${loop ? '   (loop)' : ''}`, starts(shown) ? undefined : COLOR.hint]);
      if (!loop && level < depth && starts(shown)) back(from, level + 1, new Set(path).add(from));
    }
  };
  print(`${name(node)}${where(node)}`, COLOR.title);
  rows.push(['Reached from:', COLOR.title]);
  back(node, 1, new Set([node]));
  if (rows.length === 1) {
    rows.push([filtered ? `${INDENT}nothing that passes the filters (${describe})`
      : `${INDENT}nothing in the map (a shot at it, or a trigger run through a variable)`, COLOR.notice]);
  }
  const out = groupBy((g.outOf.get(node.uid) || []).filter((l) => keepRow(l, l.to)), 'to');
  rows.push([out.length ? 'Acts on:' : 'Acts on: nothing', COLOR.title]);
  for (const [to, links] of out) rows.push([`${INDENT}-> ${name(to)}   ${mergedLabel(links)}`, starts(links) ? undefined : COLOR.hint]);
  showPaged({ title: `  depth ${depth}, ${describe}; "logic show ${node.uid}" draws it`, color: COLOR.hint, rows, cmd: `logic ${node.uid}`, page });
}

function status() {
  const g = logicGraph();
  print(`Logic view ${logicShown() ? 'on' : 'off'}${g ? `. This map: ${plural(g.nodes.length, 'element')} with a uid, ${plural(g.links.length, 'link')}.` : '.'}`, COLOR.title);
  if (g) print(`  Types: ${typeList(g)}`, COLOR.hint);
  print('  "logic show" draws the links, "logic <uid>" prints one element as a tree. "help logic" for more.', COLOR.hint);
}

export const logicCommand = {
  name: 'logic',
  aliases: ['links'],
  usage: 'logic [show | hide | <uid>]',
  desc: 'How the map\'s regions, triggers, timers, doors... are wired: draw the links over the level, or print one as a tree',
  help: {
    about: [
      'Every element of the map with a uid (triggers, timers, regions, doors, decors,',
      'players, guns...) and every reference between them: what a region or timer',
      'starts, what a player\'s death runs, what each trigger action acts on, what is',
      'attached to a door. Read from the map itself, so it also knows what a trigger',
      'action targets, which the game only keeps as a number.',
    ],
    args: [
      ['(nothing)', 'how many elements and links the map has'],
      ['<uid>', 'that element as a tree (the same as "logic tree <uid>")'],
      ['show', 'draw the links over the level'],
      ['hide', 'stop drawing them'],
      ['type:<t>[,<t>]', 'only elements of these types; "logic" lists the map\'s types'],
      ['not:<t>[,<t>]', 'no elements of these types'],
      ['screen', 'only what is inside the camera view now'],
    ],
    examples: [
      ['logic #god_all', 'what reaches #god_all, and what it acts on'],
      ['logic show', 'every link, drawn where it is'],
      ['logic show #Commands_multiplex', 'only the links of one element'],
      ['logic show start', 'only what starts triggers'],
      ['logic show not:player', 'without the links to every player'],
      ['logic #god_all not:player', 'the tree, without its player rows'],
    ],
    notes: [
      'A uid used twice in a map means its first element, as the game resolves it.',
    ],
    see: ['logic show', 'logic tree', 'triggers find'],
  },
  run: (args) => (args.length ? tree(args) : status()),
  subcommands: [
    {
      name: 'show',
      aliases: ['draw', 'on'],
      usage: 'logic show [<uid>] [depth n] [start | control | act | attach | ref ...]',
      desc: 'Draw the map\'s links over the level, all of them or only around one element',
      help: {
        about: [
          'Draws a line from every element to each one it references, with an arrow at',
          'the end, a marker on each element and its uid in tiny text. Triggers and timers',
          'are invisible in the game: they are drawn where the map editor placed them.',
          'Regions are drawn as their rectangle, where they are now (they move with',
          'the doors they are attached to); players where they are now.',
          'Like the game\'s "debug 1", but on its own layer: it only reads the camera, so',
          'it works in multiplayer.',
          // How the anti-cheat works is not shown to remote testers (src/console/kernel/core/mode.ts).
          ...(REMOTE ? [] : ['(The game\'s debug switch is an anti-cheat checked value; changing it from',
            'outside its own code is reported.)']),
        ],
        args: [
          ['<uid>', 'only the links of this element, and of those it links to'],
          ['depth n', 'how many steps out from <uid> (1 by default)'],
          ['start', 'region, timer, death, "run trigger" and "continue in trigger"'],
          ['control', 'actions that enable or disable a trigger or a timer'],
          ['act', 'any other action on an element'],
          ['attach', 'what moves with a door'],
          ['ref', 'any other reference'],
          ['type:<t>[,<t>]', 'only links whose two ends are of these types (region, trigger, door...)'],
          ['not:<t>[,<t>]', 'no links touching an element of these types'],
          ['screen', 'only links with both ends in the camera view (also: visible)'],
        ],
        examples: [
          ['logic show', 'everything'],
          ['logic show not:player', 'without the links to every player (most of them, on many maps)'],
          ['logic show type:region,trigger start', 'what regions start, and nothing else'],
          ['logic show screen not:player', 'only the logic around you, as you move'],
          ['logic show #button depth 3', 'what the button starts, three steps deep'],
          ['logic show start control', 'the flow of the map, without the actions'],
        ],
        notes: [
          'Only links with an end on screen are drawn, so a big map stays usable.',
          'Types are the map\'s own element names; plurals work too (regions). Around a',
          '<uid>, that element is kept whatever its type, so "type:" picks its neighbours.',
          'Without "screen", a link with one end on screen is drawn too, running off the',
          'edge; with it, only links that start and end on screen, worked out every frame.',
          'A region or a door counts as on screen when any part of it is.',
          'Labels never overlap. Elements at the same spot share one, a big group shows',
          '"+NAMES more", and a label with no room left (zoomed far out) is hidden. Aim the',
          'crosshair at a group to open it in full.',
          'Colours: green starts a trigger, yellow enables or disables, blue acts on,',
          'white is attached, pink is any other reference.',
        ],
        see: ['logic', 'logic hide', 'logic tree'],
      },
      run: show,
    },
    {
      name: 'hide',
      aliases: ['off'],
      usage: 'logic hide',
      desc: 'Stop drawing the links',
      help: {
        about: ['Removes the drawing. It also goes when you reload the page.'],
        see: ['logic show'],
      },
      run: () => { hideLogic(); print('Logic view off', COLOR.ok); },
    },
    {
      name: 'tree',
      usage: 'logic tree <uid> [depth n]',
      desc: 'One element as a tree: what reaches it and what it acts on (the same as "logic <uid>")',
      help: {
        about: [
          'Prints one element: what reaches it, followed back along what starts things',
          '(a region runs a trigger that continues in this one), and what it acts on.',
          'The first step back lists every reference, also actions that only act on it;',
          'after that only what starts things is followed, which is how it got run.',
        ],
        args: [
          ['<uid>', 'the element, e.g. #god_all; a trigger index also works: 393'],
          ['depth n', 'how many steps back (3 by default)'],
          ['type:<t>[,<t>]', 'only rows whose element is of these types'],
          ['not:<t>[,<t>]', 'no rows whose element is of these types'],
          ['start | control | act ...', 'only rows of these kinds of link'],
          ['screen', 'only rows whose element is in the camera view now'],
        ],
        examples: [
          ['logic tree #kick', 'chat -> trigger -> ... -> #kick'],
          ['logic #god_all not:player', 'what #god_all touches, other than players'],
          ['logic #door*1 depth 1', 'what touches a door, one step'],
        ],
        see: ['logic', 'logic show', 'triggers find'],
      },
      run: tree,
    },
  ],
};
