// "editor": the in-game map editor, on and off (also its hotkey, editor_key).
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { showKey } from '../state/keys.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { takeOptions } from '../core/args.js';
import { game } from '../game/bindings.js';
import { editorOn, setEditorOn } from '../editor/index.js';
import { editorDoc, editorShown, selected, pendingCount, setTool, showLayer, TOOL } from '../editor/session.js';
import {
  setAttr, reloadLevel, saveMap, addElement, deleteElement, duplicateElement, undo, redo,
} from '../editor/edit.js';
import { nameOf, kindOf, KINDS, KIND_TAGS, SHAPE } from '../editor/kinds.js';
import { player } from '../game/level.js';
import { inputStatus } from '../editor/input.js';
import { panelsOnPage } from '../editor/panels.js';
import { hasLayer } from '../ui/overlay.js';

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
  const { changed, live } = setAttr(sel, attr, value);
  const name = nameOf(editorDoc(), sel);
  if (!changed) { print(`${name}: ${attr} is already "${value}"`, COLOR.notice); return; }
  const where = live ? 'live now' : game.isMP() ? 'not live in multiplayer (kept for "editor save")' : 'shows after "editor reload"';
  print(`${name}: ${attr} = "${value}", ${where}`, live ? COLOR.ok : COLOR.notice);
}

// ----- editor reload -----

function reload() {
  requireShown();
  const n = pendingCount();
  reloadLevel();
  print(`Reloading the level from the edited map${n ? ` (${n} object${n === 1 ? '' : 's'} not live until now)` : ''}`, COLOR.ok);
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
  print(`Added ${nameOf(editorDoc(), e)} at ${x}, ${y}${kindOf(tag).shape === SHAPE.RECT ? ` (${e.attrs.w} x ${e.attrs.h})` : ''}${game.isMP() ? '' : '; in the game after "editor reload"'}`, COLOR.ok);
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
  print(`Deleted ${name}${game.isMP() ? '' : '; gone from the game after "editor reload"'}`, COLOR.ok);
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
  print(`  outlines layer: ${hasLayer('editor') ? 'drawing' : 'off'}; panels: ${panelsOnPage()}; click layer: ${input.layer}${input.layerRect ? ` at ${input.layerRect}` : ''}`);
  print(`  pointer locked: ${input.pointerLocked ? 'yes (clicks go to the game, not the editor)' : 'no'}`);
  print(`  last press the window saw: ${w ? `at ${w.x}, ${w.y} on ${w.target}${w.onLayer ? ' (the click layer)' : ''}` : 'none since the editor came on'}`);
  print(`  last press the editor handled: ${l ? `world ${l.world ? `${l.world.x}, ${l.world.y}` : '(no camera)'}, picked ${l.picked ?? '(not released yet)'}` : 'none'}`);
  print(`  selected: ${sel ? nameOf(doc, sel) : 'nothing'}`);
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
      'Live edits: a region\'s place, size and activation; trigger and timer settings',
      'and trigger actions; a decoration\'s place, rotation and scale. Everything else',
      '(walls, movables, ...) moves in the editor at once and in the game after',
      '"editor reload" (single-player), which puts you back where you stood. Walls are',
      'never written live: the game\'s integrity check watches them.',
      'Single-player: the game plays the edited map from then on, so dying or',
      'restarting keeps the edits. Multiplayer: only live edits reach your game (not',
      'the other players\'), and the next round starts from the server\'s map.',
      'It needs a level, hides while none runs and comes back with the next one.',
      'Esc clears the selection. Regions and characters are drawn where they are now.',
    ],
    see: ['editor set', 'editor add', 'editor tool', 'editor undo', 'editor reload', 'editor save', 'editor_key', 'logic'],
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
      name: 'set',
      usage: 'editor set <attribute> <value>',
      desc: 'Change an attribute of the selected object (as clicking it in Params does)',
      help: {
        about: [
          'Changes one attribute of the selected object, the way editing it in Params',
          'does. What the running game can take is live at once (a region\'s place and',
          'size, its activation, trigger and timer settings and actions); the rest shows',
          'after "editor reload" in single-player.',
        ],
        args: [['<attribute>', 'as Params lists it, e.g. x, use_on, actions_2_targetA'], ['<value>', 'the new value; "" for empty']],
        examples: [['editor set w 200', 'make it 200 wide'], ['editor set enabled false', 'a disabled trigger']],
        see: ['editor', 'editor reload'],
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
        notes: ['New objects are in the game after "editor reload" (single-player).'],
        see: ['editor tool', 'editor reload'],
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
        see: ['editor undo', 'editor reload'],
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
      name: 'reload',
      aliases: ['apply', 'restart'],
      usage: 'editor reload',
      desc: 'Single-player: play the level again from the edited map, so every edit is in it',
      help: {
        about: [
          'Restarts the level the way the game does, from the edited map: walls, lights,',
          'everything is built again. Everything in the level starts over (enemies,',
          'variables, your HP); you are put back where you stood. The editor stays on.',
        ],
        notes: [
          'In single-player the game always plays the edited map: dying or restarting',
          'loads it too. Multiplayer cannot reload: the server decides that.',
        ],
        see: ['editor', 'editor save'],
      },
      run: reload,
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
