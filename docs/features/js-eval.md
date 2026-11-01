# js_eval: running JavaScript in the page

Feature flag `js_eval` (on by default; local and server modes, never in remote play,
because it runs any code). Code: `src/features/js_eval/`.

- `js <code>` evaluates the rest of the line with indirect `eval`, in the page's global
  scope, and prints the value of the last expression. The line is never split at `;`
  (`rawLine`), because JavaScript uses `;` itself.
- The code is named `pb2dev-eval.js` (`sourceURL`), so stack traces point at it rather
  than at an anonymous script.
- `js help` (or `help js`) prints a guide: examples, how to type the game's obfuscated
  names with `\u` escapes, and `PB2_NAMES`.
- A bind or a profile's start-up commands can run `js`, so the flag also turns off
  stored `js` lines.
