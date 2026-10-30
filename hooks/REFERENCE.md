# Hooks reference

Every part of the hooks system: what each call does, in what order things happen, and what
each message means. For a first hook, read [README.md](README.md) instead.

Source: `desktop/hooks.js` (loader, runs in the wrapper), `desktop/hooks-runtime.js`
(runtime, runs in the game page), tests in `test/hooks.test.mjs`.

## Contents

1. [Lifecycle](#1-lifecycle)
2. [Hook files](#2-hook-files)
3. [What a hook file can use](#3-what-a-hook-file-can-use)
4. [Interceptor](#4-interceptor)
5. [How a hooked call runs](#5-how-a-hooked-call-runs)
6. [Targets](#6-targets)
7. [Game](#7-game)
8. [Script.patch](#8-scriptpatch)
9. [send](#9-send)
10. [module.exports options](#10-moduleexports-options)
11. [Multiplayer](#11-multiplayer)
12. [PB2Hooks (the page global)](#12-pb2hooks-the-page-global)
13. [What the page receives](#13-what-the-page-receives)
14. [Messages](#14-messages)
15. [Limits](#15-limits)
16. [Switches and commands](#16-switches-and-commands)

---

## 1. Lifecycle

Each page load (start, or Ctrl+R) runs these steps in order:

| # | Where | Step |
|---|---|---|
| 1 | Wrapper | The page asks for `index.html`. The wrapper builds a new **plan** from `hooks/*.js`. |
| 2 | Wrapper | **Dry run:** each hook file runs in a Node sandbox. `Interceptor.attach/replace` and `Script.patch` only **record** their targets. Callbacks never run. |
| 3 | Wrapper | **Check:** each hook is checked alone against the game's original scripts. A hook with any problem gets status `error` and is left out entirely. |
| 4 | Wrapper | **Apply:** the remaining hooks' patches are applied in file order, then one trampoline line is inserted per target function. If a hook no longer fits after the ones before it, it is dropped and the step reruns without it. |
| 5 | Wrapper | Prints one line per hook to the terminal (§14). |
| 6 | Page | `index.html` arrives with the runtime and the loaded hooks before the game's first `<script>`. |
| 7 | Page | The runtime defines `PB2Hooks`. Each hook file runs **again**, and now `attach` registers the real callbacks. |
| 8 | Page | The game's scripts load. The changed ones come from the plan, the rest from `game/` as is. |
| 9 | Page | The game runs. A hooked function's trampoline sends each call through `PB2Hooks.c` (§5). |

The files in `game/` are never written. The plan exists only in memory until the next page load.

**Why changes happen as files are served:** the game's anti-tamper scan stores the source of
every global function when the page loads and compares it later (`ANTICHEAT.md` §6). Code
changed while it is served is already in that stored source, so the comparison always matches.

## 2. Hook files

| Rule | Detail |
|---|---|
| Location | `hooks/` at the repository root |
| Loaded | `*.js` |
| Skipped | `*.example.js` (templates), names starting with `.` or `_`, anything not ending in `.js` |
| Name | The file name without `.js`. It appears in messages, `hooks`, `send` output and `PB2Hooks.active(name)` |
| Order | Sorted by file name (plain string order: `10-x.js` comes before `2-y.js`). Applies to patches, trampolines, handlers and replacements |
| Git | Untracked, except `README.md`, `REFERENCE.md` and `*.example.js` |
| Encoding | UTF-8 (the game's names contain Cyrillic letters) |

**A hook file runs twice:** once in Node (the dry run), once in the page. So:
- Top-level code should only register hooks and set `module.exports` options.
- `console.log` at the top level prints twice: once from Node, once from the page (forwarded to the terminal).
- `send` at the top level does nothing in the dry run, and sends from the page.
- Options (§10) are read from the dry run only. Set them unconditionally at the top level.

## 3. What a hook file can use

The file body is wrapped in `function (Interceptor, Script, Game, send, module, exports) { ... }`.

| Name | Dry run (Node) | Page |
|---|---|---|
| `Interceptor` | Records targets | Registers callbacks (§4) |
| `Script` | Records patches | `patch()` does nothing (already applied) |
| `Game` | Names → targets. `read` / `write` / `isMP` / `method` throw | Full (§7) |
| `send(msg)` | Does nothing | Sends to the terminal (§9) |
| `module`, `exports` | Options (§10) | Ignored |
| `console` | Node's console | The page's console (forwarded to the terminal) |
| Anything else | Not defined: no `require`, `process`, `window`, `document` | The page's globals (`globalThis`, `document`, the game's globals) |

## 4. Interceptor

### `Interceptor.attach(target, callbacks) → listener`

| | |
|---|---|
| `target` | `Game.<name>`, `Game.fn(name)` or `Game.method(object, name)` (§6) |
| `callbacks.onEnter(args)` | Optional. Before the original. `args` is a real array of the call's arguments |
| `callbacks.onLeave(retval)` | Optional. After the original returned |
| Returns | `listener` with `detach()` |

Several listeners on one target all run (§5 has the order). Attaching the same callbacks twice
runs them twice.

### `listener.detach()`

Removes that one listener. Calls already in progress finish normally. For `Game.method`
targets, the object's function is put back once nothing else uses it (§6.3).

### `Interceptor.replace(target, impl)`

`impl` runs instead of the original. Inside `impl`:

| `this.` | Is |
|---|---|
| `original(...args)` | Calls the original function with these arguments and the original `this` |
| `thisArg` | The original `this` |
| `hook` | Your hook's name |

`impl`'s return value is what the caller gets (after any `onLeave`). One replacement per
target: the last `replace` wins. If a different hook replaces it, the terminal gets the
warning `[hooks] <hook>: replaces <target>, which <other hook> had replaced`.

If `impl` throws, the error goes to the terminal and **the original runs instead**, with the
same arguments.

### `Interceptor.revert(target)`

Removes **your hook's** replacement on that target. A replacement made by another hook is left alone.

### `Interceptor.detachAll()`

Removes every listener **this hook** attached. Replacements stay (use `revert`).

## 5. How a hooked call runs

For a call to a target that has at least one listener or a replacement:

1. `args` = a copy of the arguments as an array.
2. **Filter:** only listeners and the replacement whose hook is `loaded` and allowed right now (§11).
3. **onEnter**, in attach order (hook file order, then call order). Each listener gets its own
   `this` (the context, see below). Changes to `args` are seen by later listeners and by the original.
4. **Body:** the replacement's `impl` if there is one, otherwise the original, called with
   `args` and the original `this`.
5. **onLeave**, in **reverse** attach order (last attached runs first, like nested wrappers),
   with one shared `retval`.
6. The caller gets `retval.value`.

**The context (`this` in onEnter/onLeave):** a new object per listener per call, the same
object in that listener's `onEnter` and `onLeave`. It has `thisArg` (the original `this`) and
`hook` (the hook's name). Add your own fields freely: `this.start = performance.now()`.

**`retval`:** `retval.value` is the return value, `retval.replace(v)` changes it, and
`String(retval)` is `String(retval.value)`.

**Errors**

| Throws | Result |
|---|---|
| `onEnter` / `onLeave` | Reported (§14). The call continues, and the hook's error count goes up |
| `impl` (replace) | Reported. The original runs instead |
| The original game function | The error goes to the game's caller as usual. `onLeave` does not run |

**Recursion:** a hooked function that calls itself is intercepted at every level. A callback
that calls its own target directly recurses forever, as in Frida. Guard it with a flag on
the context or in the hook.

**Cost when nothing is attached:** one `PB2Hooks.t(id)` check per call, and it returns `false`.

## 6. Targets

### 6.1 `Game.<name>`

A readable name from `desktop/dev/names.js` (made by `npm run find-names`). It survives game
updates for as long as the `find-names` rule still matches.

### 6.2 `Game.fn('<obfuscated name>')`

The function by its obfuscated name, as written in the game's code. It breaks when a game
update renames it.

**Rules for both:**
- They must appear in a **top-level** `attach` / `replace` call in some loaded hook, so the
  dry run sees them. Attaching to one only inside a callback works only if a top-level call
  (in any hook) already targets it. Otherwise you get `is not instrumented` (§14).
- The game's scripts must contain **exactly one** `function <name>(` for it: a function
  declaration, or a named function expression. Class methods, arrow functions, and
  `var x = function (` (an unnamed function) cannot be targets. Use `Script.patch` (§8) for those.
- "The game's scripts" means every local `<script src="...">` in `game/index.html`.

### 6.3 `Game.method(object, name)`

A function stored on a game object, hooked **while the game runs**. It's for functions the
loader cannot see: ones created later from text (gun scripts), or assigned to objects.

| | |
|---|---|
| Where | Inside callbacks only. At the top level the game does not exist yet, and it throws |
| `object` | The object that holds the function (an instance, or a prototype to cover every instance) |
| `name` | Property name, string or symbol |
| Effect | `object[name]` is replaced by a wrapper right away. The same §5 rules apply |
| Same target twice | Reuses the wrapper while `object[name]` is still it |
| Undo | When no listener and no replacement uses it any more: if the function was the object's own property, it is set back; if it came from the prototype, the own property is deleted |
| Refused | `globalThis` and the network class: the anti-tamper scan checks functions there |
| Not covered | References the game kept before you hooked. They still call the original |

## 7. Game

| Member | Dry run | Page | What |
|---|---|---|---|
| `Game.<name>` | ✔ | ✔ | Target (§6.1). Throws if `<name>` is not in `names.js` |
| `Game.fn(name)` | ✔ | ✔ | Target (§6.2) |
| `Game.method(obj, name)` | throws | ✔ | Target (§6.3) |
| `Game.names` | ✔ | ✔ | A copy of `names.js`: `{ readable: obfuscated }` |
| `Game.read(name)` | throws | ✔ | Value of the game variable with that readable name. `undefined` if the game has not defined it yet. Throws if the name is unknown |
| `Game.write(name, value)` | throws | ✔ | Sets it |
| `Game.isMP()` | throws | ✔ | `true` in an online match. `false` if that cannot be read |

`read` and `write` reach the game's top-level `let` / `const` / `var` / functions (indirect
`eval` in global scope). Writing a value the anti-cheat guards in an online match
(`ANTICHEAT.md` §3.3) gets reported, the same as any other change.

## 8. Script.patch

```js
Script.patch(file, find, replace, { count })
```

| Argument | Meaning |
|---|---|
| `file` | A game script as listed in `game/index.html`, e.g. `'scripts/frame2.js'` |
| `find` | A string (exact text) or a RegExp. Must not be empty |
| `replace` | A string, used as is, or a function `(match, ...groups) => string` |
| `count` | Optional. Default `1`. A whole number (exact match count), or `'all'` (at least one) |

- **Names:** `⟨name⟩` (U+27E8 and U+27E9) in `find`, `replace` or a RegExp's source becomes
  the obfuscated name from `names.js`. In a RegExp it is escaped. An unknown name is an error.
- **`$` is literal** in a replacement string. The game's names start with `$`, so `$1` is not a
  group reference. Use a function to get groups.
- **Replacement functions run in the loader (Node)** while the plan is built: once per match,
  and again if a clash makes the loader retry. They cannot use `Game.read` or page globals.
- **Order:** patches of all loaded hooks are applied in hook order, then the trampolines are
  added. A patch sees the earlier hooks' patches.
- **Clashes:** each hook is first checked alone against the original files. If its `find`
  count no longer matches after the earlier hooks' changes, the later hook is dropped
  (`after the hooks loaded before it: ...`) and the rest are applied again.
- **Permanent for the page load.** Patches don't depend on multiplayer (§11) and can't be
  undone without a reload.

## 9. send

```js
send(message)
```

- `message`: any value JSON can hold. Anything else is sent as `String(message)`.
- Messages are batched for 50 ms, then POSTed to the wrapper in order.
- The terminal prints, at log level `info`:
  - a string: `[hook <name>] <text>`
  - anything else: `[hook <name>] <JSON>`
- A failed request is dropped silently. The game is never blocked by `send`.

## 10. module.exports options

| Option | Default | Effect |
|---|---|---|
| `description` | `''` | Shown under the hook in the console's `hooks` list |
| `multiplayer` | `true` | `false`: callbacks and replacements pause during online matches (§11) |
| `enabled` | `true` | `false`: the hook is not loaded (status `disabled`); the file stays |

Only the values set during the dry run count. `exports.x = ...` works too (same object).

## 11. Multiplayer

The check happens **on every call**, not at load time. With `multiplayer = false`:
- In an online match, the hook's `onEnter`, `onLeave` and replacement are skipped, and the
  original runs untouched. They resume automatically outside matches.
- `PB2Hooks.active(name)` returns `false`, and the console's `hooks` shows "paused now (multiplayer)".
- Its `Script.patch` changes stay, because they are part of the served code. To make patched
  code follow the setting, insert a check:
  `PB2Hooks.active("my-hook") ? newCode : oldCode`.
- Its `Game.method` wrappers stay in place, but don't run its callbacks.

"Online match" means `Game.isMP()` is true (the game's own multiplayer flag).

## 12. PB2Hooks (the page global)

Defined by the runtime before the game's scripts load. It is non-enumerable, frozen, and not
writable, so `for...in` over `globalThis` (quicksave, the anti-tamper scan) never sees it. It
only exists on page loads where `hooks/` has at least one hook file.

| Member | For | What |
|---|---|---|
| `PB2Hooks.active(name)` | You | `true` if the hook is loaded, didn't fail in the page, and is allowed right now (§11) |
| `PB2Hooks.status()` | You, the console | Array of `{ name, status, error, multiplayer, description, functions, patches, errors, activeNow }` |
| `PB2Hooks.t(id)` | Trampolines | Should this call go through `c`? |
| `PB2Hooks.c(id, this, arguments, fn)` | Trampolines | Runs §5 |
| `PB2Hooks.define(name, body)` | Hook scripts | Runs a hook file in the page with its own API |

`status` values: `loaded`, `disabled` (`enabled = false`), and `error` (failed in the loader,
or threw at its top level in the page).

## 13. What the page receives

**`index.html`:** before the first `<script`:
```html
<script src="__hooks/runtime.js"></script>
<script src="__hooks/hook/<name>.js"></script>   <!-- one per loaded hook, in order -->
```
Hooks that are disabled or failed get no tag, but the runtime still lists them. Nothing is
added when `hooks/` has no hook files.

**A target function:** one line right after its opening `{`:
```js
function $ееААT(){if(PB2Hooks.t(0))return PB2Hooks.c(0,this,arguments,$ееААT);
  ...the original body, unchanged...
```
Ids `0, 1, 2, ...` are given in the order targets first appear (by hook order). `Game.method`
wrappers use ids from `1000000` up.

**Routes** (under the game's URL, e.g. `/h5/versions/<version>/`):

| Route | What |
|---|---|
| `__hooks/runtime.js` | `desktop/hooks-runtime.js` plus the plan's config (names, target ids, every hook's status) |
| `__hooks/hook/<name>.js` | The hook file inside `PB2Hooks.define(...)`. Its line 1 is line 2 there; the `sourceURL` is `hooks/<name>.js` |
| `__hooks/send` | `POST`: a JSON array of `{ hook, msg }` |
| Changed game scripts | Same URL as the original, served from the plan with `Cache-Control: no-store` |

## 14. Messages

### When the page loads (terminal, and `hooks` in the console)

| Message | Meaning / fix |
|---|---|
| `Hook <name>: loaded (N functions, N patches, off in multiplayer)` | Fine |
| `Hook <name>: disabled (module.exports.enabled = false)` | Fine |
| `Hook <name>: not loaded: <reason>` | Left out; the reason is one of the rows below |
| `Game.<x>: no such name in desktop/dev/names.js ...` | Typo, or the name is new. Run `npm run find-names`, or add a rule to `tools/find-names.js` |
| `no "function <x>(" in the game's scripts ...` | Wrong or outdated obfuscated name, or not a function declaration (§6.2) |
| `"function <x>(" is declared N times (...)` | Ambiguous. Use `Script.patch` with surrounding text |
| `Script.patch(...): found N times, expected M` | `find` doesn't match as often as `count` says. After a game update, fix the text |
| `Script.patch: "<file>" is not one of the game's scripts ...` | Use the path from `game/index.html` |
| `⟨x⟩ is not in desktop/dev/names.js` | Unknown name in patch text |
| `Script.patch: find is empty` / `find must be a string or a RegExp` / `replace must be ...` / `count must be ...` | Wrong arguments |
| `after the hooks loaded before it: ...` | Clash with an earlier hook (§8). Rename files to change the order, or merge the hooks |
| `Game.read() only works inside handlers ...` (also `write`, `isMP`, `method`) | Called at the top level; move it into a callback |
| `Interceptor.attach: the target must be Game.<name> or Game.fn(...)` | A target that isn't one of those |
| Any other message | The hook file threw at its top level, or has a syntax error (the message says which) |
| `Hooks: not loaded: ...` | The loader itself failed (e.g. no `game/index.html`). No hooks this load |
| `Hooks: could not inject into index.html (no <script> tag); no hooks this load` | `index.html` changed shape. The original scripts are served, without patches |

### While the game runs (terminal, from the page console)

| Message | Meaning / fix |
|---|---|
| `[hooks] <name>: error in onEnter: <stack>` (also `onLeave`, `replacement`) | Your callback threw. The game call went on (§5) |
| `[hooks] <name>: error in its top level (hook turned off): <stack>` | The file threw in the page. Its listeners are removed and its status becomes `error` |
| `... is not instrumented. Targets must be fixed ...` | §6.2: attach to it at the top level |
| `... method "<x>" is not a function on that object (not made yet? ...)` | `Game.method` too early, or the wrong object or name |
| `... method "<x>" is read-only on that object` | The property can't be assigned. Hook the prototype or the code that creates it |
| `Game.method: functions on globalThis ...` / `the network class ...` | Refused (§6.3). Use `Game.<name>` |
| `Game: no name "<x>" in desktop/dev/names.js` | `Game.read` / `write` / `<name>` with an unknown name |
| `[hooks] <name>: replaces <target>, which <other> had replaced` | Warning: two hooks replace the same function. The later one wins |

## 15. Limits

- Changes need a page reload (Ctrl+R). There is no live reload of hook files.
- `Game.<name>` and `Game.fn` work only on `function name(` declarations and named function
  expressions. Use `Script.patch` for anything else, or `Game.method` once the function sits on an object.
- Code the game creates from text at run time (`eval`, `new Function`, gun class scripts) is
  invisible to the loader: neither `Script.patch` nor name targets reach it. Use `Game.method`.
- `Game.method` cannot hook functions on `globalThis` or the network class.
- Default parameter expressions of a hooked function are evaluated twice per call: once for
  the trampoline call, once for the real one. Harmless unless they have side effects.
- Hooks only change your own game client. The server and other players see what your client
  sends, nothing more.

## 16. Switches and commands

| | |
|---|---|
| `PB2_HOOKS=0 npm start` | No hooks: nothing is dry-run, patched or injected |
| `hooks` (dev console) | Every hook: status, functions, patch count, multiplayer, errors, description |
| `npm run find-names` | Refreshes `desktop/dev/names.js` after a game update (§6.1) |
| `npm start -- --verbose` | Also logs every request, including `__hooks/...` and the changed scripts |
| `npm test` | Includes `test/hooks.test.mjs` |
