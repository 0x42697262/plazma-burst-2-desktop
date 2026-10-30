// "keyname": press a key, see its name for "bind" and what it does now. Like xev / wev:
// the physical key (KeyboardEvent.code) is the name, the character it types is shown too.
import { print } from '../ui/log.js';
import { catchNextKey } from '../ui/panel.js';
import { COLOR } from '../core/colors.js';
import { eventKeyName, parseKeyName, showKey, baseKey, GAME_KEYS, TOGGLE_KEY } from '../state/keys.js';
import { hotkeyOf } from '../state/hotkeys.js';
import { binds } from '../state/store.js';

let stopWaiting = null;

// What the key does now: the console key, a hotkey, a bind, a game key.
function uses(name) {
  if (name === TOGGLE_KEY) return [`opens and closes the console`];
  const out = [];
  const hot = hotkeyOf(name);
  if (hot) out.push(`${hot.what} ("${hot.key}")`);
  const bound = binds.active(name);
  if (bound && bound.profile) out.push(`bound to (profile ${bound.profile}, this map): ${bound.command}`);
  if (binds.get(name)) out.push(`bound to${bound && bound.profile ? ' (yours, other maps)' : ''}: ${binds.get(name)}`);
  const base = baseKey(name);
  if (GAME_KEYS[base] !== undefined) out.push(`game key${base === name ? '' : ` (${showKey(base)})`}: ${GAME_KEYS[base]}`);
  return out;
}

function report(e) {
  stopWaiting = null;
  if (!e) { print('keyname: cancelled', COLOR.notice); return; }
  const name = eventKeyName(e);
  const typed = e.key && e.key.length === 1 ? `types "${e.key}"` : `key "${e.key}"`;
  print(`${showKey(name)}`, COLOR.title);
  print(`  ${typed}, code ${e.code || '(none)'}`, COLOR.hint);
  let bindable = true;
  try { parseKeyName(name); } catch (err) { bindable = false; print(`  cannot be bound: ${err.message}`, COLOR.warn); }
  for (const line of uses(name)) print(`  ${line}`);
  if (bindable) print(`  bind ${showKey(name)} <command>`, COLOR.ok);
}

function keyname(args) {
  if (args.length) throw new Error('usage: keyname   (then press a key)');
  if (stopWaiting) stopWaiting();
  stopWaiting = catchNextKey(report);
  print('Press a key (with Ctrl, Alt or Shift if you like); Esc cancels.', COLOR.notice);
}

export const keynameCommand = {
  name: 'keyname',
  aliases: ['whichkey', 'keytest'],
  usage: 'keyname',
  desc: 'Press a key and see its name for "bind", what it types, and what it does now',
  help: {
    about: [
      'Like xev / wev: the next key you press is not typed or sent to the game. The',
      'console shows its name as "bind" and "screenshot_key" take it, the character',
      'it types, and what it does now (a bind, the screenshot key, a game key).',
      'Names are the physical key, the same on every layout: Shift+. on a US keyboard',
      'is "shift+period", typed as ">".',
    ],
    examples: [
      ['keyname', 'then press Shift+/  ->  shift+slash, types "?"'],
    ],
    notes: [
      'In "bind" you can also type the character itself: ";", ".", and shifted ones like',
      '">" or "?" (read as Shift and the key under it in the US layout).',
    ],
    see: ['bind', 'screenshot_key'],
  },
  run: keyname,
};
