// "editor": the in-game map editor, on and off (also its hotkey, editor_key).
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { showKey } from '../state/keys.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { editorOn, setEditorOn } from '../editor/index.js';

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

export const editorCommand = {
  name: 'editor',
  aliases: ['edit', 'mapedit'],
  usage: 'editor [on | off]',
  desc: 'The in-game map editor: see every object of the map, its params and logic links, while you play',
  help: {
    about: [
      'Draws every object of the map over the game in its layer\'s colour, and takes the',
      'mouse: click an object to select it, click the same spot again for the one',
      'below it. The game keeps running and the keyboard is still yours: walk around',
      'while you look.',
      'Layers (left): click a name to list that layer in Objects, its colour square to',
      'hide or show it. Objects (right): click one to select it. Params: the selected',
      'object\'s attributes. Its logic links are drawn like "logic show" draws them.',
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
      'It needs a level. It turns off by itself when the level ends.',
      'Esc clears the selection. Objects are where the map puts them; regions and',
      'characters are drawn where they are now.',
    ],
    see: ['editor_key', 'logic'],
  },
  run: editor,
};
