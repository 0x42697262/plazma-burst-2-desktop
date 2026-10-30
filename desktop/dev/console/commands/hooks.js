// "hooks": what the hooks in hooks/ did on this page load (desktop/hooks.js loads them,
// the runtime in the page reports through PB2Hooks.status()).
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural } from '../core/text.js';

const STATE_COLOR = Object.freeze({ loaded: COLOR.ok, disabled: COLOR.muted, error: COLOR.error });

function listHooks(args) {
  if (args.length) throw new Error('usage: hooks');
  const api = globalThis.PB2Hooks;
  if (!api) {
    print('No hooks on this page load. Put a hook in hooks/ (see hooks/README.md) and reload with Ctrl+R.', COLOR.notice);
    return;
  }
  const list = api.status();
  print(`Hooks (${list.length}), from hooks/*.js. Edit one and press Ctrl+R to reload.`, COLOR.title);
  for (const h of list) {
    const what = [];
    if (h.functions.length) what.push(`hooks ${h.functions.join(', ')}`);
    if (h.patches) what.push(`${h.patches} patch${h.patches === 1 ? '' : 'es'}`);
    if (!h.multiplayer) what.push('off in multiplayer');
    if (h.status === 'loaded' && !h.activeNow) what.push('paused now (multiplayer)');
    if (h.errors) what.push(`${plural(h.errors, 'error')} in handlers (see the terminal)`);
    print(`  ${h.name.padEnd(20)} ${h.status.padEnd(9)} ${what.join('; ')}`, STATE_COLOR[h.status]);
    if (h.description) print(`    ${h.description}`, COLOR.hint);
    if (h.error) print(`    ${h.error}`, COLOR.error);
  }
}

export const hooksCommand = {
  name: 'hooks',
  aliases: ['hook'],
  usage: 'hooks',
  desc: 'List the hooks from hooks/ (loaded, disabled, failed and why)',
  help: {
    about: [
      'Hooks are small scripts in hooks/ that change how the game behaves without editing',
      'its files, with a Frida-style API: Interceptor.attach(Game.levelStart, { onEnter,',
      'onLeave }), Interceptor.replace, Script.patch and send() to the terminal.',
      'The guide is hooks/README.md; hooks/*.example.js are templates (copy one to <name>.js).',
    ],
    examples: [
      ['hooks', 'which hooks loaded on this page load, and why the others did not'],
    ],
    notes: [
      'Hooks load when the page loads: after editing one, press Ctrl+R.',
      'PB2_HOOKS=0 npm start turns all hooks off.',
    ],
  },
  run: listHooks,
};
