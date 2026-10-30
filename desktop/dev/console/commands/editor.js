// "editor": the in-game map editor, on and off (also its hotkey, editor_key).
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { showKey } from '../state/keys.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { takeOptions } from '../core/args.js';
import { game } from '../game/bindings.js';
import { editorOn, setEditorOn } from '../editor/index.js';
import { editorDoc, editorShown, selected, pendingCount } from '../editor/session.js';
import { setAttr, reloadLevel, saveMap } from '../editor/edit.js';
import { nameOf } from '../editor/kinds.js';

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
      'hold Alt for no snap).',
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
    see: ['editor set', 'editor reload', 'editor save', 'editor_key', 'logic'],
  },
  run: editor,
  subcommands: [
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
