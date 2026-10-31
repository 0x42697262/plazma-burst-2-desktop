// Remote play (desktop/remote/): this game window is streamed to a tester's browser as
// video. The tester sees only its pixels, so what the console shows is all they can
// learn. In remote mode the console:
//   - leaves out commands marked `remote: false` ("js" runs any code; "hooks" lists the
//     host's hooks), as if they did not exist;
//   - hides, in everything it prints, the host's file paths and file names and the
//     game's obfuscated names (they map the game's internals).
// The wrapper sets PB2_REMOTE (not enumerable) before any script, for remote windows only.
export const REMOTE = globalThis.PB2_REMOTE === true;

export const HIDDEN = '‹hidden›';

// Folders of the project and of the game, with whatever path follows.
// The path never ends in "." or ":", so a sentence's full stop stays.
const PATH = /(?:\.{0,2}\/)?\b(?:desktop|hooks|tools|test|game|game\.previous|scripts|screenshots|node_modules|__dev|__hooks)\/(?:[^\s"'`)\],;]*[^\s"'`)\],;.:])?/g;
// Source and config files by name: names.js, ANTICHEAT.md, dev-overrides.json, ...
const FILE = /\b[\w.*-]+\.(?:md|js|mjs|cjs|json)\b/g;
const ID = '0-9A-Za-z_$\\u0400-\\u04FF';
// An obfuscated game name: "$" and letters, at least one of them Cyrillic.
const OBFUSCATED = new RegExp(`\\$[${ID}]*[\\u0400-\\u04FF][${ID}]*`, 'g');
// The same, typed with \u escapes ("$\u041cM..."), as the console shows them for typing.
const ESCAPED = /\$?(?:[0-9A-Za-z_$]|\\u[0-9a-fA-F]{4})*\\u04[0-9a-fA-F]{2}(?:[0-9A-Za-z_$]|\\u[0-9a-fA-F]{4})*/g;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A function that hides the above in a text. `names`: names.js ({ key: obfuscated }), so
// obfuscated names made of Latin letters only are hidden too.
export function makeRedactor(names = {}) {
  const exact = Object.values(names)
    .filter((v) => typeof v === 'string' && v.startsWith('$') && v.length > 1)
    .sort((a, b) => b.length - a.length);
  const EXACT = exact.length ? new RegExp(`${exact.map(escapeRe).join('|')}(?![${ID}])`, 'g') : null;
  return (text) => {
    let out = String(text);
    if (EXACT) out = out.replace(EXACT, HIDDEN);
    return out.replace(ESCAPED, HIDDEN).replace(OBFUSCATED, HIDDEN).replace(PATH, HIDDEN).replace(FILE, HIDDEN);
  };
}

// For this page: the identity outside remote mode.
export const redact = REMOTE ? makeRedactor(globalThis.PB2_NAMES || {}) : (text) => text;

// Whether a command (or subcommand) definition exists in this mode.
export const allowedHere = (def) => !(REMOTE && def.remote === false);
