// "editor": the in-game map editor, on and off (also its hotkey, editor_key).
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { showKey } from '../state/keys.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { takeOptions } from '../core/args.js';
import { game } from '../game/bindings.js';
import { editorOn, setEditorOn } from '../editor/index.js';
import {
  editorDoc, editorShown, selected, pendingCount, isPending, setTool, showLayer, TOOL,
  selectableLayers, setSelectable, LAYER_GROUPS,
} from '../editor/session.js';
import {
  setAttr, saveMap, addElement, deleteElement, duplicateElement, undo, redo, notLiveReason,
} from '../editor/edit.js';
import { nameOf, kindOf, KINDS, KIND_TAGS, SHAPE } from '../editor/kinds.js';
import { player } from '../game/level.js';
import { inputStatus } from '../editor/input.js';
import { panelsOnPage } from '../editor/panels.js';
import { hasLayer } from '../ui/overlay.js';
import { REMOTE } from '../core/remote.js';

const ON_WORDS = ['on', '1', 'true', 'yes'];
const OFF_WORDS = ['off', '0', 'false', 'no'];

function editor(args) {
  const usage = 'usage: editor [on | off]';
  if (args.length > 1) throw new Error(usage);
  const word = (args[0] || '').toLowerCase();
  const want = !word ? !editorOn() : ON_WORDS.includes(word) ? true : OFF_WORDS.includes(word) ? false : null;
  if (want === null) throw new Error(usage);
  if (!setEditorOn(want)) { print(`Editor already ${want ? 'on' : 'off'}`, COLOR.notice); return; }
  const key = settings.effective(KEY.EDITOR_KEY);
  const again = key ? `${showKey(key)} or "editor"` : '"editor"';
  print(want ? `Editor on: click an object to select it. ${again} turns it off.` : 'Editor off', COLOR.ok);
}

function requireShown() {
  if (!editorShown()) throw new Error('the editor is not on in a level ("editor")');
}

// ----- editor set -----

function setOne(args, { rest }) {
  requireShown();
  const usage = 'usage: editor set <attribute> <value>  (on the selected object; "" for empty)';
  if (args.length < 2) throw new Error(usage);
  const sel = selected();
  if (!sel) throw new Error('select an object first (click it, or pick it in Objects)');
  const attr = args[0];
  const value = rest.replace(/^\S+\s+\S+\s*/, '').replace(/^"(.*)"$/, '$1');
  const { changed, live, why } = setAttr(sel, attr, value);
  const name = nameOf(editorDoc(), sel);
  if (!changed) { print(`${name}: ${attr} is already "${value}"`, COLOR.notice); return; }
  const where = live ? 'live now' : `not in the running level: ${why} (kept for "editor save")`;
  print(`${name}: ${attr} = "${value}", ${where}`, live ? COLOR.ok : COLOR.notice);
}

// ----- editor save -----

function save(rawArgs) {
  requireShown();
  const { options, rest } = takeOptions(rawArgs, ['force']);
  const name = rest.join(' ').trim();
  if (!name) throw new Error('usage: editor save <name> [--force]  (desktop/maps/<name>.xml, played as local-<name>)');
  return saveMap(name, { overwrite: options.has('force') }).then(
    ({ file, id }) => print(`Saved ${file}: play it as "${id}" in Campaign > Custom Map`, COLOR.ok),
    (e) => print(`error: ${/exists/.test(e.message) ? `${e.message}; "editor save ${name} --force" replaces it` : `could not save (${e.message || 'desktop wrapper only'})`}`, COLOR.error),
  );
}

// ----- editor add / delete / copy / undo / redo / tool -----

// A kind by its tag or its title: "box", "wall", "region", "movable", ...
function kindWord(word) {
  const w = String(word || '').toLowerCase();
  return KIND_TAGS.find((t) => t === w || KINDS[t].title === w) || null;
}
const kindWords = KIND_TAGS.map((t) => KINDS[t].title).join(', ');

function add(args) {
  requireShown();
  const usage = `usage: editor add <kind> [x y [w h]]  (kinds: ${kindWords}; default place: your crosshair)`;
  const tag = kindWord(args[0]);
  if (!tag || ![1, 3, 5].includes(args.length)) throw new Error(usage);
  const nums = args.slice(1).map(Number);
  if (!nums.every(Number.isFinite)) throw new Error(usage);
  const p = player();
  const [x, y, w, h] = nums.length ? nums : [Math.round(p.tarx), Math.round(p.tary)];
  const e = addElement(tag, { x, y, ...(w !== undefined ? { w, h } : {}) });
  showLayer(tag);
  const why = notLiveReason();
  const where = isPending(e) ? `not in the running level: ${why || 'it was not made'} (kept for "editor save")`
    : why ? `in the running level, but ${why}` : 'in the running level';
  print(`Added ${nameOf(editorDoc(), e)} at ${x}, ${y}${kindOf(tag).shape === SHAPE.RECT ? ` (${e.attrs.w} x ${e.attrs.h})` : ''}; ${where}`, COLOR.ok);
}

function needSelection() {
  const sel = selected();
  if (!sel) throw new Error('select an object first (click it, or pick it in Objects)');
  return sel;
}

function del() {
  requireShown();
  const sel = needSelection();
  const name = nameOf(editorDoc(), sel);
  deleteElement(sel);
  print(`Deleted ${name} from the map; still in the running level (kept for "editor save")`, COLOR.ok);
}

function copy() {
  requireShown();
  const e = duplicateElement(needSelection());
  print(`Copied to ${nameOf(editorDoc(), e)}`, COLOR.ok);
}

const undoRedo = (fn, verb) => () => {
  requireShown();
  if (fn()) print(`${verb === 'undo' ? 'Undone' : 'Redone'}`, COLOR.ok);
  else print(`Nothing to ${verb}`, COLOR.notice);
};

function tool(args) {
  requireShown();
  const usage = `usage: editor tool select  |  editor tool place [kind]  (kinds: ${kindWords})`;
  const word = (args[0] || '').toLowerCase();
  if (word === 'select' && args.length === 1) { setTool(TOOL.SELECT); print('Tool: select', COLOR.ok); return; }
  if (word !== 'place' || args.length > 2) throw new Error(usage);
  if (args[1]) {
    const tag = kindWord(args[1]);
    if (!tag) throw new Error(usage);
    showLayer(tag);
  }
  setTool(TOOL.PLACE);
  print('Tool: place (click in the world; Esc goes back to select)', COLOR.ok);
}

// ----- editor status -----

function status() {
  const doc = editorDoc();
  const sel = selected();
  const input = inputStatus();
  const { window: w, layer: l } = input.lastPress;
  print('Editor status', COLOR.title);
  print(`  on: ${editorOn() ? 'yes' : 'no'}, shown: ${editorShown() ? 'yes' : 'no (no level running)'}`);
  print(`  map: ${doc ? `${doc.elements.length} elements, ${doc.elements.filter((e) => e.attrs.uid).length} with a uid` : 'none'}`);
  print(`  outlines layer: ${hasLayer('editor') ? 'drawing' : 'off'}; panels: ${panelsOnPage()}; listening for presses: ${input.listening ? 'yes' : 'no'}`);
  print(`  pointer locked: ${input.pointerLocked ? 'yes (clicks go to the game, not the editor)' : 'no'}`);
  print(`  last press the window saw: ${w ? `at ${w.x}, ${w.y} on ${w.target}, ${w.taken ? 'taken by the editor' : 'left alone (a panel, the console, or outside the game)'}` : 'none since the app started'}`);
  print(`  last press the editor handled: ${l ? `world ${l.world ? `${l.world.x}, ${l.world.y}` : '(no camera)'}, picked ${l.picked ?? '(not released yet)'}` : 'none'}`);
  print(`  selected: ${sel ? nameOf(doc, sel) : 'nothing'}`);
}

// ----- editor layers -----

// What can be selected, as the map editor's Layers: a group, kinds, or +kind / -kind
// (its Ctrl+click and Alt+click).
function layers(args) {
  requireShown();
  const usage = `usage: editor layers all | nothing | statics | logics | entities | <kind>[,<kind>...] | +<kind> | -<kind>  (kinds: ${kindWords})`;
  const word = args.join(',').toLowerCase();
  if (!word) throw new Error(usage);
  let tags;
  if (word === 'all') tags = [...KIND_TAGS];
  else if (word === 'nothing' || word === 'none') tags = [];
  else if (LAYER_GROUPS[word]) tags = [...LAYER_GROUPS[word]];
  else if (/^[+-]/.test(word)) {
    const tag = kindWord(word.slice(1));
    if (!tag) throw new Error(usage);
    tags = word[0] === '+' ? [...new Set([...selectableLayers(), tag])] : selectableLayers().filter((t) => t !== tag);
  } else {
    tags = word.split(',').filter(Boolean).map(kindWord);
    if (!tags.length || tags.includes(null)) throw new Error(usage);
  }
  setSelectable(tags);
  const now = selectableLayers();
  print(`Layers: ${now.length ? now.map((t) => KINDS[t].title).join(', ') : 'nothing'} (the rest cannot be selected)`, COLOR.ok);
}

export const editorCommand = {
  name: 'editor',
  aliases: ['edit', 'mapedit'],
  usage: 'editor [on | off]',
  desc: 'The in-game map editor: select, move, resize and edit the map\'s objects while you play',
  help: {
    about: [
      'Draws every object of the map over the game in its layer\'s colour, and takes the',
      'mouse: click an object to select it, click the same spot again for the one',
      'below it. The game keeps running and the keyboard is still yours: walk around',
      'while you look.',
      'Drag the selection to move it, its edge or corner to resize it (snaps to 10;',
      'hold Alt for no snap). Tools (left): select or place new objects, copy,',
      'delete, undo, redo; keys Del, Ctrl+D, Ctrl+Z, Ctrl+Y.',
      'Layers (left): click a name to list that layer in Objects, its colour square to',
      'hide or show it. Objects (right): click one to select it. Params: the selected',
      'object\'s attributes; click a value to change it. Its logic links are drawn like',
      '"logic show" draws them.',
    ],
    args: [
      ['(nothing)', 'turn it on or off'],
      ['on | off', 'turn it on, or off'],
    ],
    examples: [
      ['editor', 'on, or off again'],
      ['editor_key f7', 'F7 turns it on and off (F8 is the default)'],
    ],
    notes: [
      'Edits go into the running level: walls (with their trims), backgrounds\' places,',
      'water, pushers, movables, regions, decorations, lamps, guns, triggers and timers.',
      // How the anti-cheat works is not shown to remote testers (core/remote.js).
      ...(REMOTE ? [] : ['Walls, water and pushers live in arrays the game\'s integrity check watches: it',
        'reports the client and reloads the page when it sees them change.']),
      'Edits nothing finer takes (a movable\'s settings, water\'s damage, what an object',
      'is attached to, a decoration\'s model, ...) build the object again with the',
      'game\'s own map loader code, and run its later steps for it (textures, the water',
      'shown, attachments). Added objects are made the same way, deleted ones taken out',
      'of play. Not in the running level (kept for "editor save"): players, enemies,',
      'vehicles, barrels, engine marks, songs and custom images, wall materials and how',
      'a background looks, and later edits of added barrels and vehicles. The top line',
      'says why an edit was not live.',
      'The params panel also lists what the game reads that the map editor does not show',
      '(water attach, movable mute, region uses_timer, trigger execute, decoration text).',
      'The same in every mode. When the level starts again on the same map (dying, a',
      'restart), the edits are put into it again. A new round of a match puts movables,',
      'triggers and timers back as edited; guns and barrels go back to the map\'s.',
      'It needs a level, hides while none runs and comes back with the next one.',
      'Esc clears the selection. Regions and characters are drawn where they are now.',
    ],
    see: ['editor set', 'editor add', 'editor tool', 'editor undo', 'editor save', 'editor_key', 'logic'],
  },
  run: editor,
  subcommands: [
    {
      name: 'status',
      aliases: ['info', 'debug'],
      usage: 'editor status',
      desc: 'What the editor sees: its panels and click layer, and where your last click landed',
      help: {
        about: [
          'For when clicks do nothing: whether the outlines, panels and click layer are on',
          'the page, whether the pointer is locked, what element the last press landed on,',
          'and what the editor picked with it. Click in the world, then run this.',
        ],
        see: ['editor'],
      },
      run: status,
    },
    {
      name: 'layers',
      aliases: ['layer', 'filter'],
      usage: 'editor layers all | nothing | statics | logics | entities | <kinds> | +<kind> | -<kind>',
      desc: 'What can be selected, as the map editor\'s Layers; the rest is drawn faint',
      help: {
        about: [
          'Only objects on an active layer can be selected (clicked, dragged, listed in the',
          'object box); the others are drawn faint. The same as the Layers buttons.',
        ],
        args: [
          ['all | nothing', 'every kind, or none'],
          ['statics', 'backgrounds, walls, lamps, water, pushers'],
          ['logics', 'triggers, timers, engine marks, regions, movables, pushers'],
          ['entities', 'players, enemies, vehicles, decorations, guns, barrels, engine marks'],
          ['<kind>,<kind>', 'only these'],
          ['+<kind> | -<kind>', 'add one, or take one away (Ctrl / Alt + click in Layers)'],
        ],
        examples: [['editor layers statics', 'walls and the like only'], ['editor layers +region', 'regions too']],
        see: ['editor'],
      },
      run: layers,
    },
    {
      name: 'set',
      usage: 'editor set <attribute> <value>',
      desc: 'Change an attribute of the selected object (as clicking it in Params does)',
      help: {
        about: [
          'Changes one attribute of the selected object, the way editing it in Params',
          'does, and puts it into the running level. When it cannot, it says why.',
        ],
        args: [['<attribute>', 'as Params lists it, e.g. x, use_on, actions_2_targetA'], ['<value>', 'the new value; "" for empty']],
        examples: [['editor set w 200', 'make it 200 wide'], ['editor set enabled false', 'a disabled trigger']],
        see: ['editor'],
      },
      run: setOne,
    },
    {
      name: 'add',
      aliases: ['new', 'place'],
      usage: 'editor add <kind> [x y [w h]]',
      desc: 'Add an object (wall, region, movable, trigger, ...) at your crosshair or at x y',
      help: {
        about: [
          'Adds an object with the map editor\'s defaults and a new uid, and selects it.',
          'Without a place it goes where your crosshair is. A rectangle (wall, region,',
          'movable, background, water, pusher) is 100 x 100 unless you give w h.',
          'The "place" tool does the same with the mouse.',
        ],
        args: [['<kind>', kindWords], ['x y', 'its place'], ['w h', 'a rectangle\'s size']],
        examples: [['editor add wall', 'a wall at your crosshair'], ['editor add region 100 200 50 50', 'a region there']],
        notes: ['The game\'s own loader code makes it in the running level too (not players, enemies, engine marks or songs).'],
        see: ['editor tool', 'editor save'],
      },
      run: add,
    },
    {
      name: 'delete',
      aliases: ['del', 'remove', 'rm'],
      usage: 'editor delete',
      desc: 'Delete the selected object (Del)',
      help: {
        about: ['Takes the selected object out of the map. Other objects that refer to it keep', 'the reference, as in the map editor.'],
        see: ['editor undo', 'editor save'],
      },
      run: del,
    },
    {
      name: 'copy',
      aliases: ['duplicate', 'dup'],
      usage: 'editor copy',
      desc: 'Copy the selected object, a little to the side, with a new uid (Ctrl+D)',
      help: { about: ['A copy of the selected object, 20 right and 20 down, with a uid of its own.'], see: ['editor delete'] },
      run: copy,
    },
    {
      name: 'undo',
      usage: 'editor undo',
      desc: 'Undo the last edit (Ctrl+Z): a drag, a value, an add or a delete',
      help: { about: ['Undoes the last edit: one drag, one value, one add or delete.'], see: ['editor redo'] },
      run: undoRedo(undo, 'undo'),
    },
    {
      name: 'redo',
      usage: 'editor redo',
      desc: 'Redo what was undone (Ctrl+Y)',
      help: { about: ['Does again what "editor undo" undid.'], see: ['editor undo'] },
      run: undoRedo(redo, 'redo'),
    },
    {
      name: 'tool',
      usage: 'editor tool select | place [kind]',
      desc: 'What a click in the world does: select (and drag), or place a new object',
      help: {
        about: [
          'select: a click selects, a drag moves or resizes the selection.',
          'place: a click adds an object of the layer Objects shows (give a kind to',
          'switch layer); a rectangle can be dragged out. Esc goes back to select.',
        ],
        examples: [['editor tool place wall', 'click or drag to add walls'], ['editor tool select', 'back to selecting']],
        see: ['editor add'],
      },
      run: tool,
    },
    {
      name: 'save',
      usage: 'editor save <name> [--force]',
      desc: 'Save the edited map to desktop/maps/<name>.xml (play it as local-<name>)',
      help: {
        about: [
          'Writes the map with every edit to desktop/maps/<name>.xml, one tag per line.',
          'Play it from Campaign > Custom Map as local-<name>, or open it in the map',
          'editor on the website.',
        ],
        args: [['<name>', 'letters, digits, spaces, _ . -'], ['--force', 'replace the file if it exists']],
        examples: [['editor save my_base', 'desktop/maps/my_base.xml']],
        notes: ['Desktop wrapper only: the wrapper writes the file.'],
        see: ['editor', 'maps'],
      },
      run: save,
    },
  ],
};
