// "js <code>": evaluate JavaScript in the game page.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { printPair } from './help.js';

const EVAL_SOURCE = 'pb2dev-eval.js'; // names the code in stack traces, so they are not anonymous
const EXAMPLE_WIDTH = 45;

const ex = (code, what) => printPair(`js ${code}`, what, EXAMPLE_WIDTH);

function printJsGuide() {
  const me = game.typedName('me');
  const chars = game.typedName('chars');
  print('js <code> runs JavaScript inside the game page, like the DevTools console.', COLOR.title);
  print('The value of the last expression is printed. Errors are printed in red.');
  print('Objects print as [object Object]; wrap them in JSON.stringify(...) to see them.');
  print('Examples:', COLOR.title);
  ex('1 + 2', 'prints 3');
  ex('stage.currentFrameLabel', '"gaming" while in a level');
  ex('gravity', 'current world gravity');
  ex('gravity = 0.3', 'change it (the world_gravity key does this too)');
  ex('JSON.stringify(pb2dev.kv)', 'your saved overrides');
  ex('pb2dev.run("god on")', 'run a console command from code');
  ex('let n = 0; for (let i = 0; i < 5; i++) n += i; n', 'several statements; prints 10');
  print('Game variables are obfuscated with Cyrillic look-alike letters. Type them', COLOR.title);
  print('with \\u escapes, which JavaScript accepts in names:');
  ex(me, 'your character index');
  ex(`${chars}[${me}].${F.HP}`, 'your HP');
  ex(`${chars}[${me}].${F.MAX_HP} = 500`, 'set your max HP');
  print(`Names for this game version (${game.namesVersion() || 'unknown'}) are in desktop/dev/names.js, e.g. PB2_NAMES.chars.`);
  ex('PB2_NAMES.chars', 'the name itself, as a string');
  ex('eval(PB2_NAMES.chars).length', 'use a name without typing it');
  print('console.log(...) goes to the terminal running "npm start" and to DevTools (Ctrl+Shift+I).');
  print('pb2dev API: pb2dev.run(line), pb2dev.kv, pb2dev.open(), pb2dev.close().');
  print([['client-only: changes game values in your own game client, not on the server.', COLOR.warn, true]]);
}

export const jsCommand = {
  remote: false, // runs any code in the page: never in remote play (core/remote.js)
  name: 'js',
  usage: 'js <code>',
  desc: 'Evaluate JavaScript in the page. "js help" explains it with examples',
  handlesHelp: true,
  rawLine: true, // JavaScript uses ";" itself
  renderHelp: printJsGuide,
  run: (args, { rest }) => {
    if (!rest || rest.toLowerCase() === 'help') { printJsGuide(); return; }
    print(String((0, eval)(`${rest}\n//# sourceURL=${EVAL_SOURCE}`)));
  },
};
