# Hooks

Hooks are small scripts in this folder that change or watch what the game does,
**without editing the game's files**. The API copies [Frida](https://frida.re)'s:
`Interceptor.attach`, `onEnter` / `onLeave`, `retval.replace`, `Interceptor.replace`, `send`.

- Your hooks: `hooks/<name>.js`. Not in git (only this guide and `*.example.js` are).
- Templates: `hooks/*.example.js`. Never loaded. Copy one to `<name>.js` to use it.
- Turn all hooks off: `PB2_HOOKS=0 npm start`.
- Sad Burst 2 (`npm run sadburst`) has no hooks: its loader sends a hash of its scripts with the login, so a patched script would show its server a changed client ([README.md §9](../../README.md#9-sad-burst-2-community-client)).
- Every call, rule, order and message in detail: [REFERENCE.md](hooks-reference.md).

## Quick start (2 minutes)

1. `cp hooks/log-player.example.js hooks/log-player.js`
2. `npm start` (or press **Ctrl+R** if the game is already open)
3. Start any level. The terminal prints:
   ```
   Hook log-player: loaded (1 function)
   [hook log-player] {"login":"...","nickname":"...","slot":0,"multiplayer":false}
   ```
4. In the dev console (Shift+\`), type `hooks` to see every hook and its state.

After editing a hook, press **Ctrl+R**. Hooks load when the page loads.

## A hook file

```js
module.exports.description = 'What this hook does';   // shown by "hooks"
module.exports.multiplayer = false;                     // optional: off in online matches (default: on)
module.exports.enabled = false;                         // optional: keep the file, do not load it

Interceptor.attach(Game.levelStart, {
  onEnter(args) { this.started = Date.now(); },         // before the game's function
  onLeave(retval) {                                     // after it
    send(`level built in ${Date.now() - this.started} ms`);
  },
});
```

Inside a hook file you have these, and nothing else from Node (no `require`):

| Name | What |
|---|---|
| `Interceptor` | Hook game functions (below) |
| `Script` | Change code inside a function (below) |
| `Game` | Game functions and values by their readable names |
| `send(message)` | Print to the terminal running `npm start`. A string, or anything JSON can hold |
| `module.exports` | Options: `description`, `multiplayer`, `enabled` |
| `console` | The page's console. Also printed in the terminal |

## Interceptor

### `Interceptor.attach(target, { onEnter(args), onLeave(retval) })`

Runs your code before and/or after a game function. Both callbacks are optional.

- `args`: the call's arguments as an array. Assign to change them: `args[1] = 7`.
- `retval.value`: what the function returned. `retval.replace(v)` makes it return `v`.
- `this`: a fresh object for each call. Keep values on it between `onEnter` and `onLeave`.
  `this.thisArg` is the function's own `this`.
- Returns a listener; `listener.detach()` stops it.
- Recursive calls are hooked at every level, like in Frida.

### `Interceptor.replace(target, function (...args) { ... })`

Your function runs **instead** of the game's. Call the original with `this.original(...args)`:

```js
Interceptor.replace(Game.healChar, function (target, healer, power, force) {
  return this.original(target, healer, power * 2, force);   // heal twice as much
});
```

`Interceptor.revert(target)` puts the original back. If your replacement throws, the
original runs and the error goes to the terminal.

### Targets

| Write | Means |
|---|---|
| `Game.levelStart` | The game function with that readable name in `desktop/dev/names.js` |
| `Game.fn('$ееААT')` | A game function by its obfuscated name (breaks when the game updates) |
| `Game.method(object, 'name')` | A function on a game object, made while the game runs. Only inside callbacks; see below |

**`Game.<name>` and `Game.fn(...)` must be fixed in the code**, like the lines above.
The loader reads your file **before the game loads**, to know which functions to prepare.
So `Game[someVariable]` decided while the game runs does not work.

Those two work on functions declared as `function name(...) { ... }`. For class methods
and arrow functions in the game's files, use `Script.patch`.

### Functions made while the game runs: `Game.method(object, 'name')`

Some functions don't exist when the game loads. Gun scripts, for example, are stored as
text and turned into functions later. The loader never sees them. Wait until the game has
made the function, then hook it on the object that holds it:

```js
Interceptor.attach(Game.levelStart, {
  onLeave() {                                   // the level, and its objects, exist now
    const gun = Game.read('guns')[0];           // the object that holds the function
    Interceptor.attach(Game.method(gun, 'someMethod'), {
      onEnter(args) { send(`someMethod(${args[0]})`); },
    });
  },
});
```

- Same `onEnter` / `onLeave` / `retval.replace` / `Interceptor.replace` / `revert` as above.
- It changes `object[name]` right away. Undo with `listener.detach()` or
  `Interceptor.revert(...)`.
- One object at a time. To hook every object of a kind, use the prototype they share:
  `Game.method(Object.getPrototypeOf(gun), 'someMethod')`.
- **It runs on every level start.** Attach once (keep the listener and check it), or
  attach again when the game makes new objects.
- **Game code that kept a reference to the function earlier still calls the original.**
  Hook as early as possible after the function is made.
- **Not on `globalThis` or the network class.** The anti-tamper scan compares the source
  of the functions there (`docs/research/anticheat.md` §6), so swapping one while the game runs gets
  reported. Those are refused with an error; hook them by name (`Game.<name>`) instead.
- `Game.method` only works inside callbacks. At the top level of a hook file the game
  doesn't exist yet.

Readable names for the game's functions and values are found by `npm run find-names` and
listed in `desktop/dev/names.js`. To add one, add a rule to `tools/find-names.js`.

## Script.patch: change code inside a function

```js
Script.patch('scripts/main.js', 'text to find', 'replacement text');
Script.patch('scripts/frame2.js', /a (regex)/, (match, group1) => `new ${group1}`);
Script.patch('scripts/frame2.js', 'x', 'y', { count: 3 });    // must match exactly 3 times
Script.patch('scripts/frame2.js', 'x', 'y', { count: 'all' }); // every match, at least one
```

- The first argument is a game script, as listed in `game/index.html` (`scripts/...`).
- `find` must match exactly once (or `count` times). Otherwise the whole hook is left
  out, with the reason. That way a game update never patches the wrong code.
- `⟨name⟩` in `find` or `replace` becomes the obfuscated name from `names.js`, e.g.
  `'⟨levelStart⟩('`.
- A replacement string is used as is: `$1` stays `$1`, because the game's names start
  with `$`. For regex groups, use a function.
- Patches are applied as the script loads. They cannot be undone without a reload, and
  `module.exports.multiplayer = false` does not stop them. To make patched code obey that
  setting, check it in the code you insert: `PB2Hooks.active("my-hook") ? newCode : oldCode`.

## Game

Inside callbacks (in the game), not at the top level of the file:

| Call | What |
|---|---|
| `Game.read('me')` | A game value by its readable name (here: your character's index) |
| `Game.write('name', value)` | Set one |
| `Game.isMP()` | `true` in an online match |
| `Game.names` | Every readable name and its obfuscated name |

## When something is wrong

- **The hook is not loaded:** the terminal prints `Hook <name>: not loaded: <why>` when the
  page loads, and `hooks` in the dev console shows the same. The other hooks still load.
- **A callback throws:** the error and stack go to the terminal. The game call still
  works, and `hooks` counts the errors.
- **Two hooks patch the same code:** the one loaded later (by file name) is left out.

## How it works, and why it is safe for the game

1. When the page loads, the wrapper (`desktop/main.js`, through `desktop/hooks.js`) runs
   every hook file once in a dry run. `Interceptor.attach` and `Script.patch` only
   **record** what they target there; your callbacks do not run.
2. Each hook is checked against the game's scripts: every target must exist exactly once,
   and every patch must match as often as it says.
3. The scripts are served with the patches, plus one line at the start of each hooked
   function: `if(PB2Hooks.t(id))return PB2Hooks.c(id,this,arguments,fn);`. The files in
   `game/` never change.
4. Before the game's first script, the page gets the hooks runtime
   (`desktop/hooks-runtime.js`) and your hook files. There they run again, and now
   `attach` registers your callbacks.

**Why not change functions while the game runs, like Frida does?** The game's anti-tamper
check saves the source of every global function when the page loads, and compares it later
(`docs/research/anticheat.md` §6). Replacing a function afterwards gets reported and reloads the page.
Changing code **as it is served** happens before that snapshot, so the snapshot already
includes the change. It also reaches code that is unreachable at run time: local
variables, inner functions, and constants inside a function.

**Why not real Frida?** Frida hooks native code (C/C++, Objective-C, Java). It has no way
to hook JavaScript functions inside a browser page.

## Multiplayer

Hooks run in online matches too, unless the file says `module.exports.multiplayer = false`.
A hook only changes your own game client; the server and other players see only what your
client sends. Hooks that change gameplay can make you desync, and are unfair to others.
