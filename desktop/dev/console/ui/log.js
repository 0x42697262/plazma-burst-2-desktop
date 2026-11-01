// The console's output. Everything printed also goes to the terminal running
// "npm start": desktop/main.js forwards the page's console there. Colours and the
// small-text flag are for the log pane only, so the terminal gets the plain text.
import { el } from './dom.js';
import { LOG_MAX } from '../../../../src/console/kernel/core/constants.ts';
import { redact } from '../core/remote.js';

export const TAG = '[pb2dev]'; // marks the console's own lines in the terminal

let logEl = null;

export const attachLog = (element) => { logEl = element; };
export const clearLog = () => { if (logEl) logEl.textContent = ''; };

// text: a string, or segments [text, color?, small?] that make up one line.
export function print(text, color) {
  const segs = Array.isArray(text) ? text : [[text, color]];
  console.log(`${TAG} ${segs.map((seg) => seg[0]).join('')}`);
  if (!logEl) return;
  const line = el('div', color ? { color } : {});
  for (const [t, c, small] of segs) {
    const style = {};
    if (c) style.color = c;
    if (small) style.fontSize = '0.8em';
    // Remote play: the pane is streamed to a tester, so host paths and game names are hidden.
    line.append(el('span', style, redact(t)));
  }
  logEl.append(line);
  while (logEl.childNodes.length > LOG_MAX) logEl.firstChild.remove();
  logEl.scrollTop = logEl.scrollHeight;
}
