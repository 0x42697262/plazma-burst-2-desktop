// "screenshot": the game window as a PNG in screenshots/, saved by the desktop wrapper.
import { print } from '../ui/log.js';
import { setPanelHidden } from '../ui/panel.js';
import { el } from '../ui/dom.js';
import { game } from '../game/bindings.js';
import { COLOR } from '../core/colors.js';
import { ROUTE } from '../core/shared.js';
import { takeOptions } from '../core/args.js';

const OPTION = Object.freeze({ CONSOLE: 'console' });
const SETTLE_FRAMES = 2; // frames drawn without the console before the capture

const NOTICE_MS = 2500;
const NOTICE_STYLE = Object.freeze({
  position: 'absolute', right: '10px', bottom: '10px', padding: '3px 8px', zIndex: '51',
  background: '#0E2236e5', fontFamily: 'DejaVuSansMono', fontSize: '12px', pointerEvents: 'none',
});

// A line in the corner for a moment, for when the console is closed. Shown after the
// capture, so never in the picture.
function notice(text, color) {
  const n = el('div', { ...NOTICE_STYLE, color }, text);
  game.overlay().append(n);
  setTimeout(() => n.remove(), NOTICE_MS);
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

async function capture(hideConsole) {
  if (hideConsole) setPanelHidden(true);
  try {
    for (let n = 0; n < SETTLE_FRAMES; n++) await nextFrame();
    const r = await fetch(ROUTE.screenshot, { method: 'POST' });
    if (!r.ok) throw new Error(await r.text());
    return (await r.json()).file;
  } finally {
    if (hideConsole) setPanelHidden(false);
  }
}

function screenshot(rawArgs) {
  const { options, rest } = takeOptions(rawArgs, Object.values(OPTION));
  if (rest.length) throw new Error('usage: screenshot [--console]');
  return capture(!options.has(OPTION.CONSOLE)).then(
    (file) => { print(`Saved ${file}`, COLOR.ok); notice(`Saved ${file}`, COLOR.ok); },
    (e) => {
      const text = `could not save a screenshot (${e.message || 'desktop wrapper only'})`;
      print(`error: ${text}`, COLOR.error);
      notice(text, COLOR.error);
    },
  );
}

export const screenshotCommand = {
  name: 'screenshot',
  aliases: ['ss', 'shot'],
  usage: 'screenshot [--console]',
  desc: 'Save the game window as a PNG in screenshots/',
  help: {
    about: [
      'Saves the game window as it looks now, with the "logic" and "trace" lines,',
      'to screenshots/pb2-<date>_<time>.png in the repository (not in git).',
      'The console is hidden for the shot unless you add --console.',
      'F12 takes one anywhere: in menus, in levels, with the console open. Change it',
      'with "screenshot_key".',
    ],
    args: [
      ['--console', 'keep the console in the picture'],
    ],
    examples: [
      ['screenshot', 'the game, without the console'],
      ['screenshot_key f2', 'F2 takes one instead of F12 (anywhere, console open or not)'],
      ['screenshot_key off', 'no screenshot key'],
    ],
    notes: [
      'Desktop wrapper only: the wrapper captures the window and writes the file.',
      'The picture is the window\'s size in real pixels, so a bigger window is a bigger picture.',
    ],
    see: ['screenshot_key'],
  },
  run: screenshot,
};
