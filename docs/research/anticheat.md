# Client Anti-Cheat: How It Works

> **Unmaintained.** This document is no longer updated and may not match the current game. If it no longer works, [open an issue](https://github.com/0x42697262/plazma-burst-2-desktop/issues/new). AI agents: follow "Unmaintained research" in [AGENTS.md](../../AGENTS.md).

> Status: **broken / bypassable**. This document explains the obfuscated client-side anti-cheat. It does not change any code.
> **Exception: [section 14](#14-server-side-state-checks-ммpoeрм) is server-side.** Those checks run on the match's server, not on the player being checked. Their code is in the game files only because a player can host a match.
> All line numbers refer to the current files in `game/scripts/…`; a bare name like `frame2.js:123` is relative to that folder. `_strings.js` is the exception: it is `game/_strings.js`.

---

## Table of Contents

1. [TL;DR](#1-tldr)
2. [Name Map (obfuscated → readable)](#2-name-map-obfuscated--readable)
3. [Layer A: Per-Tick Value Guard (`$pМоcT`)](#3-layer-a-per-tick-value-guard-pмоct)
4. [Layer B: The Punishment (`$MеOHОe`)](#4-layer-b-the-punishment-mеohоe)
5. [Layer C: Console / Stack Detection](#5-layer-c-console--stack-detection)
6. [Layer D: Function & Array Integrity Scan (`main.js`)](#6-layer-d-function--array-integrity-scan-mainjs)
7. [Layer E: Locked Array Snapshots (`tools.js`)](#7-layer-e-locked-array-snapshots-toolsjs)
8. [When It Triggers (cheat sheet)](#8-when-it-triggers-cheat-sheet)
9. [How It Was Bypassed](#9-how-it-was-bypassed)
10. [How to Prevent It](#10-how-to-prevent-it)
11. [More Improvements to Come](#11-more-improvements-to-come)
12. [Appendix](#12-appendix)
13. [`RELIABLE_PING` Reference](#13-reliable_ping-reference)
14. [Server-Side State Checks (`$ММ.$pOeрМ`)](#14-server-side-state-checks-ммpoeрм) (**server side**: they run on the match's server)
15. [Sad Burst 2](#15-sad-burst-2): see [anticheat-sadburst.md](anticheat-sadburst.md)

---

## 1. TL;DR

- In multiplayer, every **guarded entry point** (frame tick, input handler, network tick, timers) runs:
  1. `$pМоcT()` at the **start**: compare ~84 live values against a hidden copy.
  2. the game logic.
  3. `$oеeес()` at the **end**: save the new values as the hidden copy.
- Anything that changes a guarded value **between** two guarded blocks (DevTools console, userscript, injected listener) causes a mismatch at the next tick.
- A mismatch calls `$MеOHОe()`, which **turns off error reporting** and then **crashes the tab on purpose**. It does not report to the server.
- The check is **skipped entirely** if `$еHоНH` ("custom map session") is `true`. Nothing resets that flag when you join multiplayer. So playing a custom map first turns the guard off for the rest of the session.
- Every piece of the system (flags, the snapshot function, the encoder, the punishment function) is a **writable global**, so it can be reset, re-baselined, or replaced from outside.

---

## 2. Name Map (obfuscated → readable)

The obfuscator swaps Latin letters for look-alike Cyrillic ones (`М`, `О`, `А`, `с`, `е`, `р`, `Н`, `Т`, `I`/`l`/`1`, `O`/`0`). Copy names from the source; do not retype them.

String constants live in `_strings.js` as `globalThis.$xxx = "..."`. To resolve one:

```bash
node -e 'const vm=require("vm"),c={};c.globalThis=c;vm.createContext(c);vm.runInContext(require("fs").readFileSync("game/_strings.js","utf8"),c);console.log(c[process.argv[1]])' '$сpcрo'
# -> at <anonymous>:
```

### 2.1 Core guard (`game/scripts/frame2.js`)

| Obfuscated | Readable name | Line | What it is |
|---|---|---|---|
| `$pМоcT` | `verifyGuardedValues` | 38010 | The per-tick check |
| `$oеeес` | `snapshotGuardedValues` | 38142 | Saves the hidden copy |
| `$cАрlHc(v,i)` | `compareSlot` | 37968 | Compares one value with slot `i` |
| `$TIМope(v,i)` | `storeSlot` | 37996 | Writes one value into slot `i` |
| `$pcМТlс(v,i)` | `encode` | 37883 | Obfuscates a stored value |
| `$1МOpАс(v,i)` | `decode` | 37895 | Reverses `encode` |
| `$pс1oМ` | `shadowStore` | 8560 | Array of encoded copies |
| `$TolHМA` | `encodeSeed` | 8565 | Random 0–9, used for string encoding |
| `$рАIpН` | `vcFresh` (grace flag) | 8561 | `true` = skip the next check once |
| `$рeOTМ` | `getterTrap` | 8562 | Object whose `$рАIpН` getter runs a stack check (line 16722) |
| `$TpоМНp` | `markFresh` | 38255 | Sets `vcFresh = true`, logs `"vc_fresh = true"`. **No callers (dead code).** |
| `$O0рo1I(i)` | `gunChecksum` | 38124 | Adds 10 fields of gun `i` together |
| `$MеOHОe` | `punish` | 37959 | Disables error reporting, installs crash payload |
| `$eeОMеО` | `corruptAndCrash` | 37914 | The payload itself |
| `$OcelсO` | `corruptionRate` | 37913 | Grows ×1.1 every frame |
| `$0I1ОАО` | (unused) | 38009 | Declared, never read |

### 2.2 Session flags

| Obfuscated | Readable name | Set where | Meaning |
|---|---|---|---|
| `$pMМ1` | `isMultiplayer` | `libs/flash.js:3357` (true) | In an online match |
| `$еHоНH` | `isCustomMapSession` | see [§9.3](#93-the-sticky-custom-map-flag-iscustommapsession--еhонh) | Playing a custom/test map. **Disables the guard.** |
| `$IHТcc` | `isApprovedMatch` | `libs/flash.js:3358` | `match_details.approved > 0`. Enables the stricter checks. |
| `$НAlНc` | `localPlayerIndex` | many | Index of your character in `$0Ме1А` |
| `$0Ме1А` | `characters` | `frame2.js:4691` | All characters |
| `$ММ` | `MP` (manager) | `libs/flash.js` | Networking manager |
| `$ММ.$ceTOI` | `MP.serverConnection` | `libs/flash.js:154` | Connection used for reports |
| `$ММ.$T0еcр` | `MP.isServerSide` (likely) | `libs/flash.js:9` | When true, the network tick skips the guard |

### 2.3 Integrity scan (`game/scripts/main.js`, `game/scripts/libs/tools.js`)

| Obfuscated | Readable name | Location |
|---|---|---|
| `$HHOеоH` | `initIntegrityScan` (runs once on `window.onload`) | `main.js:902` |
| `$сMlcА1` | `integrityScanTick` (called every frame) | `main.js:938`, called at `main.js:165` |
| `$АТAopo` | `integrityTargets` | `main.js:914` |
| `$HpolеМ` | `registerArrayIdentity` | `main.js:1103` |
| `$МОеIe` | `stringTableCanary` (`"/PB2HTML5/"`) | `_strings.js` |
| `$IeTlO(arr, undefined)` | `registerSnapshotArray` | `tools.js:193` |
| `$oIeeol` | `lockArrays` (re-snapshot) | `tools.js:140` |
| `$oITOo` | `unlockArrays` | `tools.js:117` |
| `$T0OMое(arr,i)` | `acceptArrayIndex` | `tools.js:128` |
| `$ррОM1I` | `verifyNextArray` | `tools.js:160` |
| `$еl1НсI` | `disableErrorReporting` | `libs/errors.js:155` |

---

## 3. Layer A: Per-Tick Value Guard (`$pМоcT`)

### 3.1 The pattern: check → logic → snapshot

Every place where game code is allowed to change state is wrapped like this:

```js
$pМоcT();   // verifyGuardedValues(): values must match the last snapshot
/* ... game logic ... */
$oеeес();   // snapshotGuardedValues(): accept the new values
```

Wrapped entry points:

| Entry point | File:line |
|---|---|
| Main `ENTER_FRAME` tick | `frame2.js:42108` → `42140` |
| Keyboard/input handler `$cHIIH` | `frame2.js:38280` → `42103` |
| Network tick `$ММ.$AОAcc` (skipped when `$ММ.$T0еcр`) | `libs/flash.js:393` → `415` |
| Delayed tick | `frame2.js:23573` → `23577` |
| Other frames / UI clicks | `frame17.js:33`, `frame18.js:444`, `frame18.js:1006`, `frame2.js:26127`, `27627`, `27770`, `27846` |
| Quicksave | `quicksave.js:218`, `307` |
| Spritesheet callback | `spritesheets.js:969` → `992` |
| Name prompt | `screens/NamePrompt.js:40` → `44` |

**Idea:** legitimate changes always happen inside a wrapped block, so they are snapshotted. Outside changes happen between blocks, so the next `$pМоcT()` sees a value that differs from the snapshot.

### 3.2 Early exits in `$pМоcT` (`frame2.js:38010`)

```js
if (currentFrame !== 18 || characters.length === 0) return;   // not in gameplay

if ($рeOTМ.$рАIpН === $рАIpН || $рАIpН) {                       // (1) runs the getter trap
  $рАIpН = false;                                              // (2) grace flag: skip once
  return;
}

if (!isMultiplayer || isCustomMapSession) return;              // (3) THE BIG ONE
```

- `(1)` The getter on `$рeOTМ.$рАIpН` (`frame2.js:16722`) returns `0` or `undefined`, so the `===` is never true. It is there only for its **side effect**: a stack check (see [§5](#5-layer-c-console--stack-detection)).
- `(2)` `vcFresh`: when `true`, the check is skipped once and the flag is cleared. `$oеeес` also refuses to snapshot while it is `true`. So the cycle is: skip check → clear flag → next snapshot becomes the new baseline. Set at load (`frame2.js:8561`) and when entering the gameplay frame (`frame18.js:32`).
- `(3)` Not multiplayer, or custom-map session → **no check at all**.

### 3.3 What is checked (84 slots + guns)

Slot order matters: slot `i` is used as the encoding key. Readable ones:

| Slot(s) | Value |
|---|---|
| 6 | `me.team` |
| 7 | `me.hea` (HP) |
| 9 | `me.hmax` (max HP) |
| 19 | `gravity` |
| 22 | `$eсАeA` (character count, likely) |
| 24 | `$cс0Hс` (gun count, also the loop bound for gun checksums) |
| 28 | `me.scale` |
| 29–32 | `me.x`, `me.y`, `me.tox`, `me.toy` |
| 38 | `me.antigravity` |
| 40–41 | `me.tarx`, `me.tary` |
| 45, 77 | `$оМMОО` (game speed / time scale, from trigger action 51). Checked twice. |
| 46–51 | `game.scaleX/Y`, `game.parent.scaleX/Y/x/y` (camera zoom / position) |
| 53 | `$IHТcc` (approved match flag) |
| 57 | `me.stand` |
| 61–62 | `me.login`, `me.nickname` |
| 65 | `me.char` (skin) |
| 79 | `APRIL_2025` |
| 80 | `$Oeо0` (login from loader params) |
| 82 | `match_details.netcode` |
| 84+ | `gunChecksum(i)` for every gun `i < $cс0Hс` |

`me` = `$0Ме1А[$НAlНc]`. All other slots are obfuscated globals (physics/match settings). Full list: `frame2.js:38030–38124`.

`gunChecksum(i)` (`frame2.js:38124`) is the **sum** (`+`) of 10 gun fields, including `command`, `stat_power` and `picken_by`.

### 3.4 How values are stored (`encode` / `decode`)

```js
// numbers
encode(v, i) = v * (1.223 + sin(i * 0.775)) + i * 31.101
decode(v, i) = (v - i * 31.101) / (1.223 + sin(i * 0.775))

// strings: after each char, insert digit (i + f + encodeSeed) % 10
"abc" -> "a?b?c?"   (decode drops every second char)
```

This only stops someone from finding HP by searching memory for the plain number. It is fully reversible with globals that anyone can read.

### 3.5 Comparison rules in `compareSlot` (`frame2.js:37968`)

Evaluated in this order:

| # | Condition | Result |
|---|---|---|
| 1 | `isApprovedMatch && isMultiplayer` and `v` is NaN-ish and its type differs from the stored one | **punish** |
| 2 | stored is a string and `decode(stored) !== v` | **punish** |
| 3 | `decode(stored) === v`, or both NaN | OK |
| 4 | `abs(decode(stored) - v) < 0.01` | OK (**tolerance**) |
| 5 | stored `> 10000` and `v > 10000` | OK (**free zone**) |
| 6 | stored `< -10000` and `v < -10000` | OK (**free zone**) |
| 7 | anything else | **punish** |

---

## 4. Layer B: The Punishment (`$MеOHОe`)

`frame2.js:37959`:

1. `globalThis.$еl1НсI()`: sets the error-reporter flag to `false` (`libs/errors.js:155`). **Nothing gets reported to the server after this.**
2. Builds the string `"eval"` from base-36 pieces (`"2t","3a","2p","30"` → `e`,`v`,`a`,`l`).
3. `eval("globalThis.f=" + $eeОMеО.toString())`, then `stage.addEventListener(ENTER_FRAME, globalThis.f)`.

The payload `$eeОMеО` (`frame2.js:37914`) runs **every frame**:

- Walks every global array and its nested objects.
- With probability `0.001 × corruptionRate`: numbers → `NaN`, booleans → flipped, and once the rate is > 20, objects → `null`.
- `corruptionRate *= 1.1` each frame (exponential).
- After 100 ms: `[...Array(2**32 - 1)]` → out of memory / tab freeze.

Result: the game glitches for a moment and then the tab dies. The player sees **when** it happened, and the server sees **nothing**.

---

## 5. Layer C: Console / Stack Detection

Several places do:

```js
if (new Error().stack.indexOf("at <anonymous>:") !== -1) punish();   // or location.reload()
```

`"at <anonymous>:"` is how **Chrome/V8** labels code typed into the DevTools console.

| Where | Active when | Reaction |
|---|---|---|
| `$рeOTМ.$рАIpН` getter (`frame2.js:16722`), runs inside every `$pМоcT` | `isApprovedMatch && isMultiplayer && !isCustomMapSession` | punish |
| `$рOcT0o` game timer (`frame2.js:42144`) | `isApprovedMatch && isMultiplayer` | punish |
| `$ТMО1e` game timer (`frame2.js:42152`) | `isApprovedMatch && isMultiplayer` | punish |
| `$oITOo`, `$T0OMое`, `$oIeeol` (`tools.js:117–154`) | always | `location.reload()` |

The marker string is split into pieces across `_strings.js` (`$c1O0T+$1McMI+$1TеOМ` = `"at <ano"+"nym"+"ous>:"`) to make it harder to search for.

---

## 6. Layer D: Function & Array Integrity Scan (`main.js`)

### 6.1 Setup: `$HHOеоH()` on `window.onload` (`main.js:902`)

- Goes through every enumerable property of `globalThis` and `$ММ`.
- For each **function** whose source does **not** contain `"[native code]"`, it stores `{parent, prop, source: f.toString()}` in `$АТAopo`.
- Also registers array **identity** for skin/unlock arrays (`main.js:1112–1134`): it keeps the array reference and a getter that returns the current global.

### 6.2 Tick: `$сMlcА1()` (called every frame from `main.js:165`)

Runs only if:

```js
(isCompiled || (btoa(login) !== "RXJpYyBHdXJ0" /* "Eric Gurt" */ && href has "/h5/"))
&& (isCompiled || isMultiplayer)
```

`isCompiled` = the URL does **not** contain `/game/` (`errors.js:5`).

Every 300 ms it checks targets one by one, round robin, until the current millisecond is over (about 1 ms of work per 300 ms):

| Code | Check | Meaning |
|---|---|---|
| `1` | stored array ref `!==` current global | Array variable was replaced |
| `2` | `parent[prop].toString() !== stored source` | A function was replaced |
| `3` | `$ррОM1I()` returns `-1` | Locked array contents changed ([§7](#7-layer-e-locked-array-snapshots-toolsjs)) |
| canary | `$МОеIe !== "/PB2HTML5/"` | `_strings.js` was tampered → punish + reload |

On failure: send `RELIABLE_PING` with `[…, undefined, code, detail]` via `MP.serverConnection.$OMeTо` (a report disguised as a ping), stop scanning forever (`$1eoAНl = Infinity`), and reload after 300 ms.

This is the **only** layer that tells the server anything.

---

## 7. Layer E: Locked Array Snapshots (`tools.js`)

For arrays registered with `$IeTlO([], undefined)` (`tools.js:193`):

| Lines (`frame2.js`) | Arrays |
|---|---|
| `2475–2479` | per-character unlock counter (`$рHоеН`), skin colors (`skin_color_head`, `_body`, `_arms`, `_legs`) |
| `4499–4502` | **walls**: x, y, w, h (`$сАоОo`, `$o1О00`, `$с0МAр`, `$MМрTТ`). The material array `$I10Ор` (4503) is not registered |
| `4512–4522` | **pushers**: left, top, acceleration x/y, stability damage, damage, right (x + w), bottom (y + h) |
| `4528–4533` | **water**: area x, y, w, h (the loader widens them, `frame2.js:13054–13056`), damage, "acts as water" |
| `guns.js:6805–6809`, `6827` | gun class scripts: the table, each class and its frames, and (later, on first use) each class's cache |

They are compared in the order they were registered (`$pAТAMI`, `tools.js:112`), round robin, one per `$ррОM1I()` call. The order depends on when `guns.js` registers its entries, so an array's number in that list is not fixed.

Not registered (plain arrays or objects, never compared): backgrounds (`$0eM1p`…, set at `frame2.js:11063`), movables (`$АAHОе`), regions (`$HсTНe`), decorations (`$AAрlТ`), triggers, timers, the wall collision grid (`$АТHМрM`), and the water display objects (`$НсОТе`).

| Function | Does |
|---|---|
| `$oIeeol()` (lock) | If unlocked: stack check, set locked, **deep-clone every array as the new baseline** |
| `$oITOo()` (unlock) | If locked: stack check, set unlocked |
| `$T0OMое(arr, i)` | Copy `arr[i]` into the baseline (single legit write) |
| `$ррОM1I()` | Calls `lock` first, then deep-compares **one** array per call: `-1` = mismatch, `1` = full cycle done |

Legit use: `Campaign.js:386–390`, `Equipment.js:84–88` do `$oITOo(); arr[x]++;`.

### 7.1 When the baseline is taken again

`lock` only re-snapshots when the arrays are **unlocked**, and the game unlocks them far more often than the two screens above:

| Unlock | Where | Then locked by |
|---|---|---|
| **every trigger run** | the trigger runner `$pАTIТ` ends with `$oITOo()` (`actions.js:6501`) | the next `lock` |
| map load | `$ееААT` (`frame2.js:10517`) | end of map construction (`frame2.js:14562`) |
| quicksave restore | `frame2.js:3191` | the next `lock` |

The next `lock` comes from `snapshotGuardedValues` (`$oеeес` starts with `$oIeeol()`, `frame2.js:38149`) or from the scan itself (`$ррОM1I` calls `lock` first, `tools.js:162`). Whatever the arrays hold at that moment becomes the new baseline, without a check.

So a change to a registered array is only caught when the scan compares that array **before** the next unlock/lock pair. A change made just before any trigger runs (a timer, a region, a death) is taken into the baseline silently. On a map whose timers run triggers every frame, most changes are never reported; on a map with no trigger activity, the next scan tick (at most ~300 ms later) reports it.

### 7.2 Editing the level live (the dev console's map editor)

The dev console's in-game editor (`editor`) writes edits straight into the running level. What that does to the checks:

| Edit | Writes | Layer E |
|---|---|---|
| wall place or size | wall x/y/w/h arrays, the collision grid, the wall's body sprite, its trims | **compared** (`4499–4502`) |
| pusher place, size, push, damage | pusher arrays | **compared** (`4512–4522`) |
| water place, size, damage | water area arrays, the water display object | **compared** (`4528–4533`) |
| background place or size | background arrays, its drawn rectangle | not registered |
| movable, region, decoration, trigger, timer | their objects | not registered |

What follows a compared write is [§6.2](#62-tick-сmlcа1-called-every-frame-from-mainjs165) and [§7.1](#71-when-the-baseline-is-taken-again):

1. If no trigger runs before the next scan tick, `$ррОM1I` returns `-1`.
2. The scan sends `RELIABLE_PING` with code `3` and, as the detail, **the index of the array that failed** (`$eOMАер()`, `tools.js:156`, sent at `main.js:1036–1047`), when `MP.serverConnection` exists.
3. It stops scanning (`$1eoAНl = Infinity`) and reloads the page after 300 ms (`main.js:1053`). Everything in the tab is lost, including the editor's unsaved edits.
4. If a trigger ran first, nothing happens: the edit is now the baseline.

The scan runs in **every mode** here, single-player and campaign included: it needs `isCompiled` (`errors.js:5`: the URL has no `/game/`), and the desktop wrapper serves the game under its real `/h5/versions/…/` URL.

An edit can also make the game throw (for example a wall moved where other code does not expect one). `window.onerror` and `ReportCaughtError` (`errors.js:137–146`) then POST the error, with its stack, to `/h5/index.php?action=report_error`, unless error reporting was turned off ([§9.15](#915-the-error-reporting-kill-switch-еl1нсi)).

Moving a wall in single-player reloads the **whole page**, not the level: it is `location.reload()` (`main.js:1053`), so the game boots again from its first screen. A level restart instead goes through the level state and the fade ([§7.4](#74-leaving-to-the-campaign-screen-is-not-the-anti-cheat)) and keeps the page.

How long it takes: the scan works at most ~1 ms every 300 ms, alternating functions and arrays ([§6.2](#62-tick-сmlcа1-called-every-frame-from-mainjs165)). With the gun scripts in the list a full array cycle can span several ticks, so the reload comes a few hundred milliseconds to a few seconds after the edit, plus the 300 ms delay.

### 7.3 Telling which check reloaded the page

Three things call `location.reload()`:

| Reload | Report first | Where |
|---|---|---|
| scan failure: code `1` (array replaced), `2` (function changed), `3` (locked array changed) | `RELIABLE_PING` `[…, undefined, code, detail]` | `main.js:1047`, reload `main.js:1053` (300 ms later) |
| stack check in `lock` / `unlock` / `acceptArrayIndex` (an `at <anonymous>:` frame, e.g. calling them from the DevTools console) | none | `tools.js:117–154`, at once |
| canary changed | none (punish + reload) | `main.js:1057–1065` |

To see which one it was:

1. DevTools (Ctrl+Shift+I) → Console → ⚙ → **Preserve log**, and Network → **Preserve log**, so the reload does not clear them.
2. Network → filter **WS** → the game's socket → **Messages**. A scan failure leaves the `RELIABLE_PING` frame just before the reload, with the code and the detail. No such frame: it was a stack check (or the canary).
3. For code `3`, the detail is the index into `$pAТAMI`. In the Console, `$pAТAMI.indexOf(<array>)` gives an array's index, e.g. with the wall x array (`$сАоОo`, copied from `frame2.js:4499`; do not retype the look-alike letters). Only **read** there: calling `$oITOo`, `$oIeeol` or `$T0OMое` from the Console is itself a stack-check reload.

The desktop wrapper's `--verbose` log does not show the report: it goes over the game's socket connection, and once that is a WebSocket its messages do not pass through the wrapper's request handler (only the HTTP requests do). What the log shows is the page starting again: the game's files requested from the top, then `[window] page loaded`. The dev console's network log does show it: `netlog show type:ping` ([README.md §7](../../README.md#7-network-log)).

### 7.4 Leaving to the campaign screen is not the anti-cheat

No check above sends you to the campaign screen. Only the level state `$AAсAр` does, through the black fade (`frame2.js:42165–42250`: when the fade is shown and the state is not `""`, the fade rises; at full black the state is acted on):

| State | Single-player | Multiplayer | Set by |
|---|---|---|---|
| `"exit"` | campaign screen (`frame2.js:43027`) | lobby (`frame2.js:43015`) | the Esc menu's exit button (`frame18.js:442–462`); trigger actions 309 "end the level", 310 and 311 (for one player) (`actions.js:3990–4025`) |
| `"complete"` | campaign screen (`frame2.js:43061`) | channel | trigger action "mission complete" (`actions.js:373`) |
| `"restart"` | the level loads again (`frame2.js:43033`) | | the Esc menu's restart (`frame18.js:1037`), trigger action 307 (`actions.js:3980`), playing a map (`frame2.js:20079`), Space/R on the failed screen (`frame2.js:27209`) |
| `"failed"` | main menu (`frame2.js:43036–43044`) | | dying in single-player (`frame2.js:16635`, `35204`, `35228`) |

The state starts as `"exit"` (`frame2.js:2391`) and a level sets it to `""` when it starts (`frame18.js:362`). So a level that ends on the campaign screen during live editing was ended by one of these: usually an edit that made a map trigger with action 309–311 or "mission complete" run (a region moved onto a player, a wall or a pusher that moved a player into one), or the Esc menu. `triggers history` shows which trigger ran.

---

## 8. When It Triggers (cheat sheet)

The **value guard** (Layer A) crashes the tab when **all** of these are true:

- [x] `currentFrame === 18` (in a match) and characters exist
- [x] `isMultiplayer === true`
- [x] `isCustomMapSession === false`
- [x] `vcFresh === false` (no grace this tick)
- [x] a guarded value differs from the snapshot by ≥ 0.01, **and** it is not a case where both old and new values are above 10000 (or both below -10000)

It also crashes when, in an **approved** MP match:

- [x] the check or a game timer is called from code with `at <anonymous>:` in its stack (Chrome console)
- [x] a guarded value changes **type** to something NaN-like (for example, number → string or object)

**Reload + server report** (Layer D/E), when the scan is active:

- [x] any non-native global function's `toString()` changed
- [x] a registered array was replaced or its contents changed while locked
- [x] `$МОеIe` canary string changed (also crashes)

The **value guard** (Layer A) does **not** trigger in: singleplayer, campaign, custom maps, the editor test, or **any MP match after a custom map was played in the same tab**.

The **scan** (Layers D/E) has no such exceptions: when the game is served under its real URL it runs in every mode, single-player and campaign included ([§7.2](#72-editing-the-level-live-the-dev-consoles-map-editor)). Locked-array changes are only caught when no unlock re-baselines them first ([§7.1](#71-when-the-baseline-is-taken-again)).

---

## 9. How It Was Bypassed

This section explains **why** each check in [§8](#8-when-it-triggers-cheat-sheet) can be avoided. It describes the weaknesses and may include exploit code. How to fix them is decided separately (see [§10](#10-how-to-prevent-it) for options).

### 9.0 Map: §8 condition → bypass

| §8 condition | Bypass | Impact |
|---|---|---|
| `currentFrame === 18` and characters exist | [9.1 Gameplay-frame gate](#91-gameplay-frame-gate-currentframe--18) | High |
| `isMultiplayer === true` | [9.2 The multiplayer flag](#92-the-multiplayer-flag-ismultiplayer--pmм1) | High |
| `isCustomMapSession === false` | [9.3 The sticky custom-map flag](#93-the-sticky-custom-map-flag-iscustommapsession--еhонh) + [9.4 `postMessage`](#94-postmessage-sets-the-custom-map-flag-from-outside) | **Critical** (main bypass) |
| `vcFresh === false` | [9.5 The grace flag](#95-the-grace-flag-vcfresh--раipн) | High |
| value differs from the snapshot | [9.6 Re-baselining the snapshot](#96-re-baselining-the-snapshot-feeding-fake-values) | High |
| difference ≥ 0.01 | [9.7 The 0.01 tolerance](#97-the-001-tolerance-adds-up) | Medium |
| not both above 10000 / below -10000 | [9.8 The ±10000 free zone](#98-the-10000-free-zone) | Medium |
| approved: stack check | [9.9 The stack check](#99-the-stack-check-at-anonymous) | Low (easy to dodge) |
| approved: type change | [9.10 The type check](#910-the-type-check-only-in-approved-matches) | Low |
| function `toString()` changed | [9.11 The function scan](#911-the-function-integrity-scan) | High |
| registered array changed (caught only before the next unlock/lock pair) | [9.12 Locked arrays](#912-locked-arrays) | Medium |
| `$МОеIe` canary changed | [9.13 The string canary](#913-the-string-canary-моеie) | Low |
| (the punishment itself) | [9.14 Replacing the guard or punishment](#914-replacing-the-guard-or-the-punishment) | High |
| (reporting) | [9.15 The error-reporting kill switch](#915-the-error-reporting-kill-switch-еl1нсi) | High (no evidence) |
| (what is not checked) | [9.16 Coverage gaps](#916-coverage-gaps) | Medium |
| (how it reacts) | [9.17 The reaction teaches the cheater](#917-the-reaction-teaches-the-cheater) | High (speeds up all of the above) |
| (one gap, worked end to end) | [9.18 Proof of concept: a wall you can walk through, by difficulty to fix](#918-proof-of-concept-a-wall-you-can-walk-through-by-difficulty-to-fix) | — |

**One rule explains most of this section:** every flag, function and stored value is a **writable global**. The scripts are classic `<script>` files, not modules, so every top-level `var` and `function` becomes a property of `window`, and any code running in the tab can read or change it.

---

### 9.1 Gameplay-frame gate (`currentFrame === 18`)

**What it is:** both `$pМоcT` and `$oеeес` only run on the main timeline's gameplay frame (18), and only when the character list `$0Ме1А` is not empty.

**Where it is defined:**

| What | File:line |
|---|---|
| `globalThis.currentFrame` getter → `stage.currentFrame` | `game/scripts/flash.js:3564` |
| `setGetterSetter` uses `configurable: true` | `game/scripts/libs/tools.js` (`setGetterSetter`) |
| Read by the guard | `frame2.js:38017`, `frame2.js:38151` |

**How the guard uses it:**

```js
if (currentFrame !== 18 || $0Ме1А.length === 0) return;   // both $pМоcT and $oеeес
```

**Step by step:**

1. `currentFrame` is not a real variable. It is a getter on `globalThis` that forwards to `stage.currentFrame`.
2. The getter is defined with `configurable: true`, so other code can redefine it. `stage.currentFrame` is a plain writable property.
3. If `currentFrame` reports anything other than `18`, both functions return on their first line, so nothing is checked and nothing is snapshotted.
4. The guard trusts this value. It never checks it against anything else, such as the frame label or the live game state.

**Why nothing catches it:**

| Layer | Catches it? | Why |
|---|---|---|
| Value guard | No | It is the guard's own gate |
| Function scan | No | A getter on `globalThis` is not a function property that `for…in` can see; `stage` methods/fields are not scanned |
| Stack check | No | No guarded function is called |

**Notes:** a few other places read `currentFrame` (`frame1.js:627`, `frame2.js:3861`), so faking it can affect other game logic. This makes it unreliable as a cheat, but it still means the guard depends on a value anyone can change.

---

### 9.2 The multiplayer flag (`isMultiplayer` / `$pMМ1`)

**What it is:** `$pMМ1`, declared at `frame2.js:2177` as `var $pMМ1=false;`. `true` means "in an online match."

**Where it is set:**

| Sets it | Value | File:line |
|---|---|---|
| Joining a match (`match_details` received) | `true` | `libs/flash.js:3357` |
| Trigger actions that leave MP (each also calls `$ММ.$рОеAо()`) | `false` | `actions.js:403`, `1421`, `3999`, `4014`, `4030` |
| Campaign screen | `false` | `screens/Campaign.js:562` |

**How the guard uses it:**

```js
// frame2.js:38030, inside $pМоcT
if (!$pMМ1 || $еHоНH) return;        // not MP → skip the check

// frame2.js:38151, inside $oеeес: there is NO $pMМ1 test here
```

**Step by step:**

1. `$pMМ1` is a global `var`, and it is **not** one of the 84 guarded slots.
2. While it is `false`, `$pМоcT` returns early, so nothing is compared.
3. `$oеeес` does **not** check `$pMМ1`. It keeps saving snapshots while the flag is `false`.
4. So if the flag is `false` for even one tick, any value changed during that tick is snapshotted as the new normal.
5. After the flag goes back to `true`, the next `$pМоcT` compares against that new snapshot and finds no mismatch.

**Why nothing catches it:**

| Layer | Catches it? | Why |
|---|---|---|
| Value guard | No | The flag is the guard's own gate and is not a guarded slot |
| Function scan | No | It only looks at functions, not `var` values |
| Stack check | No | Writing a variable runs no stack check |
| Server | Not by this code | The server is not told about the local flag |

**Notes:** about 368 places read `$pMМ1`, so leaving it `false` for long changes a lot of MP behavior. A one-tick flip is the risky case.

---

### 9.3 The sticky custom-map flag (`isCustomMapSession` / `$еHоНH`)

**What it is:** `$еHоНH`, declared at `frame2.js:43781` as `var $еHоНH=false;`. It means "this session is playing a custom map, not the campaign."

**Why it exists:** custom maps use triggers to change HP, gravity, team and so on. The guard skips them so map scripting can't set it off by mistake. That makes sense for single-player custom maps. The problem is how long the flag stays on.

**Where it turns on:**

| Source | File:line | Notes |
|---|---|---|
| Opening the Custom Map screen | `screens/CustomMap.js:102` | |
| Loading the game with `#map=…` in the URL | `screens/Menu.js:427` | Hash parsed at `main.js:15–38` |
| Trigger action 50 (load another map) | `actions.js:1415` | Also leaves MP, so lower risk |
| `postMessage` listener | `libs/errors.js:191` | See [9.4](#94-postmessage-sets-the-custom-map-flag-from-outside) |
| `sendTextToFlash` callback | `frame1.js:1013` | **Dead in HTML5:** `ExternalInterface.addCallback` is an empty stub (`flash.js:4125`) |

**Where it turns off:**

| Source | File:line |
|---|---|
| Opening the **Campaign** screen, and nothing else | `screens/Campaign.js:560` |

**How the guard uses it:**

```js
// frame2.js:38030, inside $pМоcT
if (!$pMМ1 || $еHоНH) return;        // not MP, OR custom map → skip the whole check

// frame2.js:16723, the $рeOTМ getter trap (stack check)
if (!$pMМ1 || $еHоНH) return;        // stack check also off
```

**Step by step:**

1. You open the tab. The flag is `false`.
2. You open the Custom Map screen, or load the URL with `#map=…`. The flag becomes `true`.
3. You go to the multiplayer lobby and join a match. `libs/flash.js:3357` sets `$pMМ1=true` but leaves `$еHоНH` alone, so it stays `true`.
4. On every tick, `$pМоcT` evaluates `!true || true`, which is `true`, and returns. None of the 84 values are checked.
5. The getter trap returns on the same condition, so the console stack check is off too.
6. `$oеeес` keeps saving snapshots, so nothing looks wrong later either.
7. The check only comes back if you open the Campaign screen.

**Why nothing catches it:**

| Layer | Catches it? | Why |
|---|---|---|
| Value guard | No | It is the guard's own exit condition, and `$еHоНH` is not a guarded slot |
| Stack check | No | Turned off by the same flag |
| Function scan | No | No function changes. This is normal game flow. |
| Server | No | `match_details` never includes this flag |

**Notes:** this needs no tools at all. Normal menu use (custom map → back → multiplayer) is enough, so honest players hit it too. That is also why it spread.

---

### 9.4 `postMessage` sets the custom-map flag from outside

**What it is:** a `message` event listener in `libs/errors.js:168`, meant for the parent page (map editor / embed) to start a map.

**What it does:**

```js
// libs/errors.js:168–195 (readable)
window.addEventListener("message", function (event) {
  let parts = (event.data + "").split(":");
  if (parts[0] === "rt") {
    if (parts[2] === "sp") {
      $еHоНH = true;            // isCustomMapSession = true
      $рTТА  = parts[1];        // map to load
      gotoAndStop("difch");
    }
  }
});
```

**Step by step:**

1. The listener does **not** check `event.origin` or `event.source`. Any window that can get a reference to the game tab can send it a message: a page that embeds it in an `<iframe>`, a page that opened it with `window.open`, or the tab itself.
2. A message shaped like `"rt:<map>:sp"` sets `$еHоНH = true`.
3. From here on, it is the same as [9.3](#93-the-sticky-custom-map-flag-iscustommapsession--еhонh). The flag stays on and the guard stays off in every later MP match.
4. The reply helper `$1сl0МТ` (`errors.js:163`) posts to the parent with target `"*"`, so it also sends to any origin.

**Why nothing catches it:** it is a supported entry point, so every layer treats it as normal.

---

### 9.5 The grace flag (`vcFresh` / `$рАIpН`)

**What it is:** `$рАIpН`, declared at `frame2.js:8561` as `var $рАIpН=true;`. It means "values were just changed on purpose, skip the next check once." The name comes from its own log message `"vc_fresh = true"`.

**Where it is set / read:**

| What | Value | File:line |
|---|---|---|
| Declared | `true` | `frame2.js:8561` |
| Entering the gameplay frame | `true` | `frame18.js:32` |
| `$TpоМНp()` helper (**no callers**) | `true` + `console.warn("vc_fresh = true")` | `frame2.js:38255` |
| Read + cleared by `$pМоcT` | → `false` | `frame2.js:38022–38024` |
| Read by `$oеeес` (skips the snapshot while `true`) | | `frame2.js:38156` |

**How the guard uses it:**

```js
// $pМоcT
if ($рeOTМ.$рАIpН === $рАIpН || $рАIpН) {   // left side only runs the getter trap
  $рАIpН = false;
  return;                                   // skip this check
}

// $oеeес
if ($рАIpН) return;                         // no snapshot while fresh
```

**Step by step:**

1. Something sets `$рАIpН = true`.
2. The next `$pМоcT` sees it, sets it back to `false`, and returns without comparing anything.
3. The `$oеeес` at the end of that block sees `false` and saves a fresh snapshot of whatever the values are now.
4. So any change made right before step 1 becomes the new baseline.
5. `$TpоМНp()` does step 1 and is still shipped, even though no game code calls it.

**Why nothing catches it:**

| Layer | Catches it? | Why |
|---|---|---|
| Value guard | No | It is the guard's own grace mechanism; the flag is not a guarded slot |
| Function scan | No | Writing a `var` is not a function change, and calling `$TpоМНp()` does not change any function |
| Stack check | Partly | The getter trap in the same `if` runs a stack check, but only in approved matches and only for Chrome console frames ([9.9](#99-the-stack-check-at-anonymous)) |

---

### 9.6 Re-baselining the snapshot ("feeding fake values")

**What it is:** the snapshot function and its helpers are globals:

| Function | Readable | File:line |
|---|---|---|
| `$oеeес()` | `snapshotGuardedValues` | `frame2.js:38142` |
| `$TIМope(v,i)` | `storeSlot` | `frame2.js:37996` |
| `$pcМТlс(v,i)` | `encode` | `frame2.js:37883` |
| `$pс1oМ` | `shadowStore` (the stored copies) | `frame2.js:8560` |
| `$TolHМA` | `encodeSeed` | `frame2.js:8565` |

**Step by step:**

1. The guard assumes only game code calls `$oеeес()`, at the end of a guarded block.
2. Nothing enforces that. If anyone changes a guarded value and then calls `$oеeес()` themselves, the snapshot now holds the changed value.
3. The next `$pМоcT` compares the changed value with the changed snapshot. They match, so nothing happens.
4. The same works one slot at a time with `storeSlot`, or by writing `encode(value, slot)` straight into `shadowStore`. The encoding ([§3.4](#34-how-values-are-stored-encode--decode)) is fixed math plus one global seed, so anyone can reproduce it.
5. This is the "feeding the check fake values" route from the original report.

**Why nothing catches it:**

| Layer | Catches it? | Why |
|---|---|---|
| Value guard | No | It is the guard's own API |
| Function scan | No | Calling a function doesn't change it |
| Stack check | No | `$oеeес`, `$TIМope` and `$pcМТlс` have no stack check |

---

### 9.7 The 0.01 tolerance adds up

**What it is:** rule 4 in `compareSlot` (`frame2.js:37983`):

```js
if (Math.abs(decode(stored, i) - v) < 0.01) return;   // close enough → OK
```

**Step by step:**

1. A change smaller than `0.01` is accepted.
2. The snapshot is taken again at the end of **every** guarded block, so the next comparison starts from the new value.
3. So many changes below `0.01` add up with no limit. The guard only measures each step, never the total.
4. Rough rate: the main loop runs at 20, 30 or 60 ticks/s (`$e0cо0`, `main.js:140–142`). Input and network blocks add more re-baselines. That is about **0.18–0.54 units per second per slot**, at least.
5. For small-range values like `gravity`, `scale`, the time scale `$оМMОО` or camera zoom, that is enough to make a big change in seconds.

**Why nothing catches it:** each single step passes a check that is working as written.

---

### 9.8 The ±10000 free zone

**What it is:** rules 5 and 6 in `compareSlot` (`frame2.js:37986–37991`):

```js
if (decode(stored, i) > 10000)  if (v > 10000)  return;   // both big → OK
if (decode(stored, i) < -10000) if (v < -10000) return;   // both very negative → OK
```

**Step by step:**

1. If the stored value is above `10000` and the new value is also above `10000`, any change is accepted. The same goes for both below `-10000`.
2. This most likely exists to ignore "infinite" or sentinel values.
3. It also covers real values: positions (`me.x`, `me.y`, `tarx`, `tary`) on large maps, and HP or max HP on maps that give big HP pools.
4. Inside that range, a value can jump by any amount in one tick (for example, a big teleport or a big HP change) and the guard allows it.

**Why nothing catches it:** the guard's own rules allow it.

---

### 9.9 The stack check (`"at <anonymous>:"`)

**What it is:** `new Error().stack.indexOf("at <anonymous>:")`. That is how **Chrome/V8** labels code typed into the DevTools console.

**Where it runs:**

| Where | Active when | Reaction |
|---|---|---|
| `$рeOTМ.$рАIpН` getter, run by every `$pМоcT` | approved && MP && **not** custom map | punish |
| `$рOcT0o` game timer (`frame2.js:42144`) | approved && MP | punish |
| `$ТMО1e` game timer (`frame2.js:42152`) | approved && MP | punish |
| `$oITOo`, `$T0OMое`, `$oIeeol` (`tools.js:117–154`) | always | `location.reload()` |

**Step by step:**

1. The check only runs when console code **calls into** one of the functions above.
2. **Writing a variable runs no function**, so it never triggers this check. That covers most of 9.2–9.8.
3. It only matches Chrome's console label. Other contexts show different text and pass:
   - Firefox (`debugger eval code`) and Safari
   - userscripts (`userscript.html?…`) and extensions
   - DevTools Snippets
   - console code that ends with a `//# sourceURL=` comment
4. `Error.stackTraceLimit` is writable. If it is lowered, the stack text gets shorter or empty, so the marker is never found.
5. `Error` is native, so the function scan never checks it ([9.11](#911-the-function-integrity-scan)).
6. The getter trap is also off whenever the custom-map flag is on ([9.3](#93-the-sticky-custom-map-flag-iscustommapsession--еhонh)).

---

### 9.10 The type check (only in approved matches)

**What it is:** rule 1 in `compareSlot` (`frame2.js:37970`):

```js
if ($IHТcc && $pMМ1)                               // only in approved MP matches
  if (isNaN(v) && typeof stored !== typeof v) punish();
```

**Step by step:**

1. `$IHТcc` is `match_details.approved > 0` (`libs/flash.js:3358`). In unapproved matches this rule is skipped.
2. Without it, rule 3 (`both NaN → OK`) lets a slot whose stored copy is `NaN` accept any other NaN-like value (a string, an object, `undefined`).
3. Impact is low. Most slots hold real numbers, and a NaN-like value in a numeric slot usually breaks the game rather than helping.

---

### 9.11 The function integrity scan

**What it is:** `initIntegrityScan` (`$HHOеоH`, `main.js:902`) saves the source of every non-native function on `globalThis` and `$ММ` at `window.onload`. `integrityScanTick` (`$сMlcА1`, `main.js:938`, called from `main.js:165`) compares it again later. A failure sends `RELIABLE_PING` code `2` and reloads ([§6](#6-layer-d-function--array-integrity-scan-mainjs)).

**Step by step (weak points):**

1. **It trusts the function's own `toString`.** It calls `parent[prop].toString()` on the current function. A replacement can carry its own `toString` that returns the original text, so the check passes.
2. **Natives are skipped.** Anything whose source contains `"[native code]"` is never registered. Replacing `eval`, `setTimeout`, `Math.random`, `Error` or `requestAnimationFrame` is never detected.
3. **Object methods are skipped.** It only walks the own properties of `globalThis` and `$ММ`. Methods on other objects (`stage.addEventListener`, `$ММ.$ceTOI.$OMeTо`) are never checked.
4. **Static class methods are skipped.** `$ММ` is a `class` (`libs/flash.js:5`). `for…in` doesn't list static methods, so `$ММ.$AОAcc` (the network tick that runs the guard) and the other `$ММ` methods are not scanned.
5. **The checker checks itself.** `$сMlcА1` is in the list. If it is replaced, nothing is left to run the check.
6. **It is gated.** It only runs if `isCompiled` (URL has no `/game/`), or on the `/h5/` path for any login except `"Eric Gurt"`. It also needs `isCompiled || isMultiplayer`. So under the real `/h5/versions/…/` URL (the live site, and the desktop wrapper) it runs in every mode, single-player and campaign included; under a `/game/` URL it runs only in multiplayer, and only when the URL also has `/h5/` and the login is not `"Eric Gurt"` ([§7.2](#72-editing-the-level-live-the-dev-consoles-map-editor)).
7. **It is slow.** Every 300 ms it checks targets one by one for about 1 ms. With hundreds of targets, a change can go unseen for seconds.
8. **It only fires once.** After the first hit it sets `$1eoAНl = Infinity` and reloads after 300 ms.
9. **The report can be dropped.** It sends through `MP.serverConnection.$OMeTо`, a method that point 3 says is never checked.

---

### 9.12 Locked arrays

**What it is:** arrays registered with `$IeTlO([], undefined)` (unlocks, skin colors, and the wall, pusher and water geometry: `frame2.js:2475–2479`, `4499–4533`, listed in [§7](#7-layer-e-locked-array-snapshots-toolsjs)) are deep-compared with a saved copy. A mismatch sends code `3` with the index of the failing array, and reloads.

**Step by step:**

1. `$oITOo()` (unlock) and `$oIeeol()` (lock + re-snapshot) are globals. Their only protection is the Chrome-console stack check ([9.9](#99-the-stack-check-at-anonymous)).
2. Unlock, change the array, and the next `verifyNextArray` (`$ррОM1I`) calls `lock` first. Lock re-snapshots, so the change becomes the new baseline.
3. The game does that unlock itself, far more often than the two unlock screens: **every trigger run** ends with `$oITOo()` (`actions.js:6501`), and so do map load and quicksave restore ([§7.1](#71-when-the-baseline-is-taken-again)). The next `lock` (from `$oеeес` or from the scan) then takes whatever the arrays hold as the new baseline, without comparing. So no call is needed at all: a change made before the next trigger run, timer, region or death is accepted silently. On a map whose timers run triggers every frame, almost no change is ever compared.
4. The stack checks in `lock` / `unlock` only run when the lock state actually changes (`tools.js:119`, `142`). Calling `unlock` while already unlocked, or `lock` while already locked, does nothing and checks nothing. `$T0OMое` only checks for a registered array.
5. `$T0OMое(arr, i)` copies one index into the baseline **without** needing an unlock.
6. Only one array is compared per `$ррОM1I` call, round robin, at most ~1 ms of scan work every 300 ms ([§7.2](#72-editing-the-level-live-the-dev-consoles-map-editor)). With the gun scripts registered, a full cycle can take several seconds, which leaves that much time for a trigger to re-baseline the change first.
7. `$ррОM1I` is only called from `$сMlcА1`, so every gap in [9.11](#911-the-function-integrity-scan) (gating, replacing the checker) also turns this check off.
8. Array **identity** checks (code `1`, `main.js:1112–1134`) only catch a replaced array, not edited contents.
9. The report is only sent when `MP.serverConnection` (`$ММ.$ceTOI`) exists (`main.js:1046`). Outside multiplayer a hit is a reload and nothing else; the server never hears about it.

**Why nothing catches it:**

| Layer | Catches it? | Why |
|---|---|---|
| Locked arrays | Only if compared first | Any unlock/lock pair (every trigger run) re-baselines without a check |
| Stack check | No | It only runs on a lock state change, and only matches Chrome console frames ([9.9](#99-the-stack-check-at-anonymous)) |
| Function scan | No | Writing array contents changes no function |
| Server | Only in MP, only on a hit | The report needs `MP.serverConnection` and a mismatch the scan saw before any re-baseline |

---

### 9.13 The string canary (`$МОеIe`)

**What it is:** `$МОеIe = "/PB2HTML5/"` in `_strings.js`. `$сMlcА1` compares it with `"/" + "PB2" + "HT" + "ML5" + "/"`, built from four other `_strings.js` constants (`main.js:1047`). A mismatch punishes and reloads.

**Step by step:**

1. It only notices if **this one string** changes, or if one of the four pieces changes.
2. Someone who edits `_strings.js` just leaves those five strings alone.
3. It runs inside `$сMlcА1`, so it has the same gating and replacement gaps as [9.11](#911-the-function-integrity-scan).

---

### 9.14 Replacing the guard or the punishment

**What it is:** the guard is made of global function declarations:

| Function | Readable | If replaced with an empty function |
|---|---|---|
| `$pМоcT` | `verifyGuardedValues` | Nothing is checked |
| `$cАрlHc` | `compareSlot` | Every slot passes |
| `$MеOHОe` | `punish` | Mismatches are found but nothing happens |

**Step by step:**

1. Top-level `function` declarations are **writable** properties of `window`.
2. Every caller (`frame2.js:42108`, `libs/flash.js:393`, …) looks the name up when it runs, so a replacement takes effect right away.
3. The punishment depends on native functions that are never checked ([9.11](#911-the-function-integrity-scan) point 2):
   - `eval` (rebuilt from base-36 `"2t","3a","2p","30"`)
   - `stage.addEventListener`
   - `setTimeout` (the huge array allocation)

   If any one of them is replaced, the punishment quietly does nothing.
4. The only layer that would notice is the function scan, and [9.11](#911-the-function-integrity-scan) explains how it can be avoided.

---

### 9.15 The error-reporting kill switch (`$еl1НсI`)

**What it is:** `globalThis.$еl1НсI` (`libs/errors.js:155`) sets the private flag `$ОрAМр1` (`errors.js:135`) to `false`. After that, three things stop sending anything:

1. `window.onerror` (`errors.js:137`)
2. `ReportCaughtError` (`errors.js:143`)
3. `$lНеА1M` (`errors.js:149`)

**Where it is called:**

| Caller | File:line | Legit? |
|---|---|---|
| `$MеOHОe` (punish), before the crash | `frame2.js:37964` | Yes (by design) |
| Injected at the top of `main.js` in a modified copy | was `main.js:1` | **No**, removed from this copy |

**Where an attacker would run it:** outside the page, any time after `errors.js` (the 5th `<script>` in `index.html`) has loaded:

| Where | When it runs |
|---|---|
| DevTools console | Any time (this function has no stack check) |
| Userscript (Tampermonkey etc.) | Right after `errors.js` loads, or on `load` |
| Browser extension content script | `document_start` / `document_idle` |
| Modified local copy of the site | Anywhere, for example the top of `main.js` |
| Proxy / DevTools "Overrides" | Replaces `errors.js` itself; no call needed |

**Step by step:**

1. The flag `$ОрAМр1` is a private `let`, so outside code can't reach it. That makes the public `globalThis.$еl1НсI` the only way to flip it, and anyone can call it.
2. Once it is called, every later error, including errors caused by tampering, is silent.
3. The guard itself calls it **before** crashing, so the value guard never reports a hit, even with no tampering.

**Why nothing catches it:**

| Check | Catches it? | Why |
|---|---|---|
| Value guard | No | The reporting flag is not one of the 84 slots |
| Function scan | No | Calling a function doesn't change it. Top-level code in an edited `main.js` is not a function. |
| String canary | No | `_strings.js` is unchanged |
| Stack check | No | `$еl1НсI` has none |
| `RELIABLE_PING` report | Still works | It goes through the game connection, not the error reporter |

**Reporting was already weak:**
- **Max 3 reports per session.** `if(--$IрcOОМ<=0) return;` (`errors.js:77`, starts at `4`).
- **Off on `localhost`** (`errors.js:80`).
- Only the function scan's `RELIABLE_PING` carries a cheat signal, and [9.11](#911-the-function-integrity-scan) explains how to stop that too.

---

### 9.16 Coverage gaps

What the guard never looks at:

| Gap | Detail |
|---|---|
| Unlisted values | Only the 84 slots in [§3.3](#33-what-is-checked-84-slots--guns) are checked. Ammo, cooldowns, move speed and the other physics values are not. |
| Only the local player | Every character field is `$0Ме1А[$НAlНc]`. Other characters are never checked. |
| `localPlayerIndex` (`$НAlНc`) | Not a guarded slot. Changing it makes the guard read another character's values (low impact: those usually differ, which causes a mismatch). |
| `gunChecksum` is a plain sum | `$O0рo1I` (`frame2.js:38124`) adds 10 gun fields with `+`. Raising one field and lowering another by the same amount keeps the same checksum. |
| Guns past `$cс0Hс` | Only guns with index `< $cс0Hс` are summed. `$cс0Hс` is guarded (slot 24), so it can't change on its own, but it can change through [9.5](#95-the-grace-flag-vcfresh--раipн) / [9.6](#96-re-baselining-the-snapshot-feeding-fake-values). |
| Server-side host (`$ММ.$T0еcр`) | The network tick skips the guard when this is `true` (`libs/flash.js:392`). Normally `false`. |
| Unregistered level data | Only wall x/y/w/h, pusher and water arrays are locked ([§7](#7-layer-e-locked-array-snapshots-toolsjs)). The wall material (`$I10Ор`), the wall collision grid (`$АТHМрM`), backgrounds, movables, regions, decorations, triggers, timers and the water display objects are never compared, so they can be changed freely in every mode ([§7.2](#72-editing-the-level-live-the-dev-consoles-map-editor)). |
| Collision grid vs. wall arrays | The grid (`frame2.js:10342`, looked up at `10407`) lists, per cell, which wall indices to test; the locked arrays only hold each wall's rectangle. A wall missing from a cell's list is never tested there, so it stops blocking while its locked rectangle is unchanged. Nothing compares the grid with the arrays. |

---

### 9.17 The reaction teaches the cheater

**What happens on a hit:** `punish` crashes the tab on the **next tick**, in the **browser**, and **tells nobody** ([§4](#4-layer-b-the-punishment-mеohоe), [9.15](#915-the-error-reporting-kill-switch-еl1нсi)).

**Step by step:**

1. Someone testing changes sees the crash within one frame of the change that caused it.
2. So they can try one change at a time and quickly map out what is checked and what is not (this is how 9.5–9.8 are found).
3. The server has no record of the attempts: no logs, no counts, no patterns, no bans.
4. An honest player who hits a false positive ([§12.2](#122-known-false-positive-risk)) sees the same crash, so crashes on their own can't be used as evidence either.

The scan (Layers D/E) teaches the same way, and says more:

5. A hit reloads the page a few hundred milliseconds to a few seconds after the change ([§7.2](#72-editing-the-level-live-the-dev-consoles-map-editor)), and the three reload causes can be told apart ([§7.3](#73-telling-which-check-reloaded-the-page)): a `RELIABLE_PING` frame before the reload means the scan, none means a stack check or the canary.
6. That frame is readable in DevTools (Network → WS → Messages) and carries the failure **code** and, for code `3`, the **index of the array** that failed. `$pAТAMI.indexOf(arr)` maps it back to a named array. So each reload tells the tester exactly which check fired and on what.
7. A change that was *not* reloaded shows what the scan missed: an unregistered array ([9.16](#916-coverage-gaps)), or a change that a trigger run re-baselined first ([9.12](#912-locked-arrays)).

---

### 9.18 Proof of concept: a wall you can walk through, by difficulty to fix

| | |
|---|---|
| **Component** | Wall collision grid `$АТHМрM` (`frame2.js:10287`) and its lookup `$о001lO` (`frame2.js:10348`) |
| **Class** | Client-side integrity bypass: unprotected derived data ([§9.16](#916-coverage-gaps)) |
| **Modes** | Every mode. The scan runs everywhere under the real `/h5/versions/…/` URL ([§7.2](#72-editing-the-level-live-the-dev-consoles-map-editor)) and never looks at the grid |
| **Needs** | Script access to the page: DevTools console, userscript, extension, or an edited local copy ([§9.15](#915-the-error-reporting-kill-switch-еl1нсi)) |
| **Result** | A chosen wall stops blocking characters and bullets on this client. No reload, no `RELIABLE_PING`, no error report |

This takes one gap from [§9.16](#916-coverage-gaps), the **collision grid** that the locked arrays do not cover, and works it at four levels, from the one that is already caught to the one no client-side check can catch. Each level has a PoC, what each check sees, and the fix, so the list is also a fix order.

Names below are copied from the source. The obfuscator uses look-alike Cyrillic letters ([§2](#2-name-map-obfuscated--readable)): copy them, do not retype them.

#### Details: how a wall blocks

1. **Load.** The map loader fills the wall arrays x/y/w/h (`$сАоОo`, `$o1О00`, `$с0МAр`, `$MМрTТ`, `frame2.js:10739–10742`); `$T0МММ` (`frame2.js:4714`) is the wall count. These four arrays are locked ([§7](#7-layer-e-locked-array-snapshots-toolsjs)).
2. **Grid build.** After parsing, the loader makes a fresh grid (`$АТHМрM=[]`, `frame2.js:11470–11484`): `$1еНсН` columns × `$Ао1АlA` rows of cells, each cell `$оАlTeН` units wide (at least 100, sized so a side has at most 64 cells, `frame2.js:11446–11453`), offset by `$Hoс1M` / `$сlН1pe`. Then, for every wall, `$0cоAHo(i)` (`frame2.js:10299`, called at `11506`) pushes `i` into every cell within **100 units** of the wall (`frame2.js:10342`). Finally every cell is marked `.fixed=true` (`frame2.js:11596`).
3. **Never again.** `$0cоAHo` has no other caller, the wall arrays have no other writer, and `actions.js` touches neither. Walls do not move during play (doors are movables, `$АAHОе`, tested separately). The grid is static from map load to the next map load. The only other writer is this repo's dev editor (`src/console/kernel/game/walls.ts`, `moveWall`), which rewrites the cells and reloads by the scan anyway ([§7.2](#72-editing-the-level-live-the-dev-consoles-map-editor)).
4. **Every collision goes through the grid.** `$о001lO(x, y)` turns a point into a cell and returns that cell's list of wall indices (`frame2.js:10348–10407`; the shared empty `$ооlIOo` outside the grid). Callers then test only those walls' rectangles:

| Caller | `frame2.js` | Does |
|---|---|---|
| `$рeHТрT(x, y)` | `19604` | "is this point free": `false` inside a wall, then checks movables |
| character step | `25563` | ground/ceiling test for each character (`$Il[i]`, `$0OA[i]` = x, y) |
| bullets | `29124` | bullet segment against walls |
| effects | `33054–33198`, `36060` | particles, decals |

So a wall blocks at a point **only if its index is in that point's cell list**. The locked arrays prove the rectangle is unchanged; nothing proves the rectangle is still listed.

#### Shared setup

Run in the DevTools console while a level is playing (`currentFrame === 18`). Nothing here calls `lock`/`unlock`/`$T0OMое`, so the stack check ([§9.9](#99-the-stack-check-at-anonymous)) never runs; plain reads and writes of globals have no stack check.

```js
// Walls listed near the local player, nearest first.
const me = $НAlНc, px = $Il[me], py = $0OA[me];
const gap = (i) => Math.hypot(
  Math.max($сАоОo[i] - px, 0, px - ($сАоОo[i] + $с0МAр[i])),
  Math.max($o1О00[i] - py, 0, py - ($o1О00[i] + $MМрTТ[i])));
const near = [...$о001lO(px, py)].sort((a, b) => gap(a) - gap(b));
const W = near[0];                                   // the wall to remove
const cx = $сАоОo[W] + $с0МAр[W] / 2, cy = $o1О00[W] + $MМрTТ[W] / 2;
const geometry = () => JSON.stringify([$сАоОo, $o1О00, $с0МAр, $MМрTТ]);
const before = geometry();
$рeHТрT(cx, cy);                                     // false: the wall's center is solid
```

Pick a wall with no movable over its center, or `$рeHТрT` stays `false` because of the movable, not the wall.

#### L1: change the locked rectangle (easy to fix, mostly caught)

```js
$с0МAр[W] = 0;                                       // wall width → 0
```

**Expected:** within ~0.3 s to a few seconds the scan compares `$с0МAр`, sends `RELIABLE_PING` code `3` with its index in `$pAТAMI`, and reloads the page ([§7.2](#72-editing-the-level-live-the-dev-consoles-map-editor), [§7.3](#73-telling-which-check-reloaded-the-page)).

**Why it can still pass:** if any trigger runs before the scan reaches `$с0МAр`, the trigger runner's `$oITOo()` (`actions.js:6501`) and the next `lock` take the zero width as the new baseline ([§7.1](#71-when-the-baseline-is-taken-again)). On a map whose timers run a trigger every frame, the edit survives.

**Fix (easy):** stop re-baselining on every trigger run: the trigger runner has no reason to unlock arrays it never writes, so drop `$oITOo()` from `$pАTIТ` and keep unlock for the screens that write (`Campaign.js`, `Equipment.js`). Report instead of reload ([§10.4](#104-detection--response-fixes-days)). No new structure.

#### L2: change only the grid (moderate to fix, not caught)

```js
let removed = 0;
for (const col of $АТHМрM)
  for (const cell of col)
    for (let k = cell.indexOf(W); k !== -1; k = cell.indexOf(W)) { cell.splice(k, 1); removed++; }

$рeHТрT(cx, cy);                                     // true: the center is now free
geometry() === before;                               // true: every locked array is untouched
```

This is the same splice `moveWall` uses before re-listing a wall (`src/console/kernel/game/walls.ts`), without the re-listing and without touching the arrays.

**Expected:** the wall is still drawn, but characters fall through it, walk through it and shoot through it. Nothing reloads, no `RELIABLE_PING` is sent, and `$рeHТрT` agrees the wall is gone.

**What each check sees:**

| Check | Catches it? | Why |
|---|---|---|
| Value guard ([§3](#3-layer-a-per-tick-value-guard-pмоct)) | No | No guarded slot changed |
| Locked arrays (code `3`) | No | `$АТHМрM` is not registered; the four wall arrays are byte-for-byte the same |
| Array identity (code `1`) | No | Cell lists are edited in place, never replaced |
| Function scan (code `2`) | No | No function changed |
| Stack check | No | No lock/unlock call |
| Server | No | Collision is never sent or checked |

**Fix (moderate):** bind the grid to the locked arrays instead of trusting it.

- **Registering it is not enough as-is.** `$IeTlO` tracks arrays by identity and only ever appends to `$pAТAMI` (`tools.js:193`), while the loader makes a **new** grid object every map (`frame2.js:11470`). The registry would need a remove/replace on map load, and the inner cell lists would need to be part of the deep compare.
- **Derive and compare (better).** Since the grid is static after load and every cell is a pure function of the locked wall arrays (rule 2 above), the scan can rebuild one column at a time with the same arithmetic as `$0cоAHo` and compare it with the live column, round robin like `$ррОM1I`. At most 64 columns, so the cost is small. An attacker would then have to change the locked rectangle too, which falls back to L1.

#### L3: leave the data alone, filter the lookup (hard to fix, not caught)

```js
const lookup = $о001lO, src = lookup.toString();
const hidden = new Set([W]);
$о001lO = function (x, y) { return lookup(x, y).filter((i) => !hidden.has(i)); };
$о001lO.toString = () => src;                        // the function scan compares this text
```

Callers look `$о001lO` up by name each time ([§9.14](#914-replacing-the-guard-or-the-punishment) point 2), so the wrapper takes over at once. The wall arrays **and** the grid stay exactly as loaded, so the L2 fix (derive and compare) passes too. `filter` returns a new array, so the shared cells are never touched.

**What each check sees:** the function scan does read `$о001lO`, but through `toString()` on the current value ([§9.11](#911-the-function-integrity-scan) point 1), which now returns the original source. Everything else is as in L2.

**Fix (hard):** the scan has to stop asking the function what it is:

- Save the **references** at `window.onload` and compare with `!==`, not the source text. That closes this wrapper, but `$ММ` statics and object methods ([§9.11](#911-the-function-integrity-scan) points 3–4) are still outside the list, and a cheat that runs before `onload` (userscript at `document_start`, edited local copy) is saved as the "original".
- Make the collision path unreachable from outside: module-scoped functions instead of `window` properties. In a build where every function is a global declaration, that is a refactor of the whole engine, not a patch.

#### L4: the check itself runs in the tab (very hard to fix)

Every fix above is code in the same tab as the cheat. The scan is itself a global (`$сMlcА1`), it checks itself ([§9.11](#911-the-function-integrity-scan) point 5), and its one report goes through `$ММ.$ceTOI.$OMeTо`, which is never checked. So whatever L2/L3 add, the cheat adds one line first:

```js
$сMlcА1 = function () {};                            // no scan: no code 1/2/3, no canary, no reload
```

after which L1 needs no trigger timing and L2/L3 need no disguise.

**Fix (very hard):** move the decision off the client ([§10.5](#105-the-real-fix-serverhost-authority)). The server or the host peer holds the level's walls and rejects a position or a hit that passes through one. PB2's relay/P2P model has no such authority today, so this is the largest change in the list.

#### Impact

- **Single-player and campaign:** walk through any wall, skip level geometry, shoot through cover. The scan is the only check here and it never sees L2/L3.
- **Multiplayer:** the change is local, but your position and hits are sent as-is, so other players see you pass through walls and get hit through them. The per-tick value guard ([§3](#3-layer-a-per-tick-value-guard-pмоct)) covers 84 values; neither the grid nor `$о001lO` is one of them, and the custom-map flag ([§9.3](#93-the-sticky-custom-map-flag-iscustommapsession--еhонh)) is not needed.
- **Detection:** none at L2 and above. No reload, so [§9.17](#917-the-reaction-teaches-the-cheater)'s feedback loop tells the tester the edit is safe.

#### Summary

| Level | Changes | Caught today? | Fix | Difficulty |
|---|---|---|---|---|
| **L1** | locked wall width | Yes (code `3`), unless a trigger re-baselines first | Don't unlock in the trigger runner; report, don't reload | **Easy** |
| **L2** | grid cell lists only | No | Rebuild grid columns from the locked arrays and compare | **Moderate** |
| **L3** | the lookup function, `toString` spoofed | No | Compare references, not source; take the engine off `window` | **Hard** |
| **L4** | the scan itself | No | Server/host authority over collision | **Very hard** |

L1 is worth fixing because it is cheap and closes a real hole. L2 is the honest next step and binds the grid to data that is already locked. L3 and L4 show the ceiling: each client check becomes one more global to replace, and only server authority changes that ([§10.5](#105-the-real-fix-serverhost-authority)).

---

## 10. How to Prevent It

Ranked by impact per hour of work.

### 10.1 Quick fixes (hours)

1. **Reset the custom-map flag on MP join.** In `libs/flash.js` next to `$pMМ1=true;` (line 3357), also set `$еHоНH=false;`.
2. **Do not let the flag skip the check in MP.** In `$pМоcT` (`frame2.js:38030`), change `if(!$pMМ1||$еHоНH)` so that being in multiplayer always runs the check. If a custom map can legitimately run in MP, take its state from the server match details, not from a client global.
3. **Lock down `postMessage`.** In `libs/errors.js:155+`: check `event.origin` against an allow-list, check `event.source === window.parent`, and ignore the message while `$pMМ1` is true. Replace the `"*"` target in `$1сl0МТ` with the real parent origin.
4. **Delete `$TpоМНp`** (`frame2.js:38255`). It has no callers.
5. **Make critical functions read-only** right after load:
   ```js
   for (const k of ['$pМоcT','$oеeес','$cАрlHc','$TIМope','$MеOHОe','$сMlcА1'])
     Object.defineProperty(window, k, { writable: false, configurable: false });
   ```
   Top-level function declarations are non-configurable but writable; this removes the "writable" part. It does not protect `var` flags, so see 10.2.

### 10.2 Structural fixes (days)

1. **Move the guard into a closure.** Put `shadowStore`, `encodeSeed`, `vcFresh`, `snapshot`, `compare`, `punish` inside one IIFE (or an ES module). Export only an opaque `guard.begin()` / `guard.end()` pair. Outside code cannot reach the state it needs to forge.
2. **Replace `vcFresh` with a token.** Legit "teleport/respawn" code calls `guard.allowChange(slot)` from inside the closure, not a global boolean anyone can flip.
3. **Store function references, not source text.** In `initIntegrityScan`, save the function **object**, and compare with `parent[prop] !== savedRef`. This is faster than `toString()` and cannot be faked with a custom `toString`. If you keep the text comparison, use a **captured** `Function.prototype.toString.call(f)`.
4. **Capture natives at load.** Save `eval`, `setTimeout`, `addEventListener`, `Error`, `Math.random` into the closure before any other script runs, and check that they are still the same objects.
5. **Do not let the checker check itself.** Run `integrityScanTick` from two independent places (for example, the frame tick and the network tick), and have each one verify the other.
6. **Stop relying on `"at <anonymous>:"`.** Treat stack checks as a weak signal: report them, do not punish on them alone. Freeze `Error.stackTraceLimit` (`Object.defineProperty(Error,'stackTraceLimit',{writable:false})`) early.
7. **Remove the URL/login gating** of `$сMlcА1` for production builds. Strip the dev bypass at build time.

### 10.3 Comparison fixes (hours)

1. **Remove the 0.01 tolerance**, or compare against the value **before the block started** plus an expected delta, so small changes cannot add up. If float noise is the reason for the tolerance, store values with `Math.fround` or compare integers.
2. **Remove the ±10000 free zone.** If it exists for "infinite" sentinels, compare those sentinels exactly (`=== Infinity`, `=== 1e9`).
3. **Always do the type check**, not only in approved matches.
4. **Use a real hash for guns:** mix each field with its index (for example FNV-1a over `field|index`), not `a+b+c`.
5. **Guard `localPlayerIndex`**, and guard at least HP/team/position for **all** characters you simulate.

### 10.4 Detection & response fixes (days)

1. **Report first, punish later.** Send `{slot, old, new, matchId}` to the server through a channel that is captured at load. Do this **before** any crash or reload.
2. **Do not call `$еl1НсI()`** (disable reporting) as part of punishment.
3. **Delay and randomize the reaction** (for example, kick 5–60 s later, or at round end). Then cheaters cannot tell which change was caught.
4. **Prefer a server-side kick/flag** over crashing the tab. A crash is also what an honest player sees on a false positive.

### 10.5 The real fix: server/host authority

Every layer above runs on the cheater's machine, so they can all be bypassed with enough effort. The long-term fix is for the **server (or host peer)** to own HP, team, gravity, damage, speed and position limits, and to reject impossible updates. Then the client checks become an early warning, not the only defense.

---

## 11. More Improvements to Come

Planned / proposed. Not implemented yet.

### Short term
- [ ] Reset `$еHоНH` on MP join and remove the MP skip ([§10.1](#101-quick-fixes-hours))
- [ ] `postMessage` origin allow-list
- [ ] Delete dead helper `$TpоМНp` and unused `$0I1ОАО`
- [ ] Make guard functions non-writable
- [ ] Remove the `0.01` tolerance and `±10000` free zone

### Medium term
- [ ] Move the guard into a closure/module with an opaque `begin/end` API
- [ ] Integrity scan compares function **references** and captured natives
- [ ] Server telemetry for every guard hit (slot, values, match, build)
- [ ] Delayed, randomized enforcement instead of an instant crash
- [ ] Proper hash for gun state, and cover all characters

### Long term
- [ ] Server/host-authoritative HP, team, damage, gravity and movement validation
- [ ] Per-build randomized slot order and encoding constants (so offsets differ every release)
- [ ] Replay/stat anomaly detection on the server (impossible HP, speed, kill rate)
- [ ] Automated test: run each guarded entry point and make sure honest play never trips the guard (false-positive regression test)

---

## 12. Appendix

### 12.1 Not anti-cheat (debug helpers that look like it)

| Symbol | File | Purpose |
|---|---|---|
| `$oAOАO` + `$рTеТНс` proxy | `tools.js:3–40` | Throws on NaN/Infinity writes to some arrays (`frame2.js:4548–4551`) |
| `TrackNaNProperty` | `tools.js:331` | Throws when a property becomes NaN |
| `$Ор0TОр` / `$lT0clT` | `tools.js:300` | Logs property writes |
| `Object.prototype.toString` override | `tools.js:384` | Warns about slow object-to-string conversions |

### 12.2 Known false-positive risk

Any **legit** code path that changes a guarded value **outside** a `$pМоcT`/`$oеeес` pair (a raw `setTimeout`, a socket/peer callback, `requestAnimationFrame`, an async `await` continuation) will crash honest players in MP. When adding new async code that touches guarded values, wrap it with the same pair or route it through the network tick.

### 12.3 Useful searches

```bash
grep -n '\$pМоcT()\|\$oеeес()' game/scripts -r   # guarded entry points
grep -n '\$еHоНH=' game/scripts -r               # where the custom-map flag is set
grep -n 'stack.indexOf' game/scripts -r          # stack checks
grep -n '\$MеOHОe()' game/scripts -r             # every punishment call
```

---

## 13. `RELIABLE_PING` Reference

> **Line numbers:** `libs/flash.js`, `connection.js`, `screens/MPLogs.js` and `frame2.js` are the current files. **`main.js` lines refer to the original file of this game version (`v1769098419`).** The copy in `game/scripts/main.js` has been edited locally (see [13.9](#139-the-local-mainjs-is-modified)), and its scan code is gone. To read the original: `curl -o /tmp/main.orig.js https://www.plazmaburst2.com/h5/versions/v1769098419/scripts/main.js`.

### 13.1 What it is

`RELIABLE_PING` is one of the game's network message types: message type **26**, sent on the **reliable** channel (acknowledged and re-sent until it arrives). It has two jobs that have nothing to do with each other:

| Job | Direction | When | Payload (`parts`) | Answer |
|---|---|---|---|---|
| **Keep-alive** | server → client | the connection has been quiet for 3 s | `[26, <callback id>]` | client sends `RELIABLE_RESPONSE` |
| **Anti-cheat report** | client → server | once, when the integrity scan ([§6](#6-layer-d-function--array-integrity-scan-mainjs)) finds a change | `[26, "undefined", <code>, <detail>]` | none; the page reloads 300 ms later |

A client never sends `RELIABLE_PING` for any other reason. So to the server, **any** `RELIABLE_PING` from a client is a report, and the literal text `"undefined"` where a callback id belongs marks it.

"Server" here means whatever runs the match's server side of this same code. That's the official server, or **this game itself when it hosts a player-hosted (P2P) match**. The code tells the sides apart with `connection.$с0А0О`, which is true on the server side of a connection.

### 13.2 Where it is

The name never appears in the code as text. It is built from the string variable `$еIНpА` in `_strings.js`, so searching the scripts for `RELIABLE_PING` finds nothing. Search `\$еIНpА` instead, or the decoded files (`npm run find-names -- --decode scripts/libs/flash.js`).

| Place | Side | What |
|---|---|---|
| `_strings.js` | both | `$еIНpА = "RELIABLE_PING"` |
| `libs/flash.js:114` | both | `$ММ[$еIНpА] = $сеMlO();` gives the type id: a counter in declaration order (`RELIABLE_RESPONSE` 0, `RELIABLE_EXEC_TRIGGER` 1, …, `RELIABLE_PING` **26**). The reverse map `$ММ.$lНАMН[26] = "RELIABLE_PING"` is built right after the list |
| `libs/flash.js:857–863` | server | Sends the keep-alive ([13.4](#134-keep-alive-start-run-end)) |
| `libs/flash.js:3066–3077` | both | Receives it, inside `$ММ.$c0рlc` (the reliable message handler, `:1864`) |
| `main.js:1038` (original) | client | Sends the anti-cheat report ([13.5](#135-anti-cheat-report-start-run-end)) |
| `screens/MPLogs.js:232–234` | client | The game's **View logs** screen skips it (and `RELIABLE_RESPONSE`), so a report never shows there |

### 13.3 On the wire

Every reliable message goes through `connection.$OMeTо(channel, parts, callback)` (`connection.js:677`), with channel `$ММ.$МеoрО = 1` (reliable; `$ММ.$ОAA0р = 0` is unreliable):

1. If there is a callback, the part equal to `$ММ.$p1еeс` (the callback placeholder) is replaced by a new callback id (counter `$lсIсM`, encoded with `$ММ.$Oоolр`). The callback is kept in `connection.$pА1АН` until a `RELIABLE_RESPONSE` with that id comes back.
2. Every part is escaped with `$рсНAе.$eIеIс` (`connection.js:99`). Anything that isn't a string becomes text first (`value += ""`), so **`undefined` becomes `"undefined"`**. Then `\x01` → `$.1` and `\x02` → `$.2`.
3. Part 0, the type, is encoded with `$ММ.$Oоolр` (a compact number code). The parts are joined with `\x02`.
4. The message gets the next sequence number (`$eеcА1`) and the send time, and waits in `connection.$ОOe0A` until the other side acknowledges that number.
5. On a client (not a dedicated server), every reliable message sent is also logged in `$ММ.$НеAAO` as `{ type, parts, time }`. The View logs screen and the dev console's scan report (`src/features/scan_bypass/`) read this log.

On arrival, `$ММ.$pOeрМ` / `$ММ.$c0рlc` split the text at `\x02`, undo the escaping, and decode part 0 back to `26`.

**The packet around the messages** (`connection.js`, `$AОAcc` sends, `$AoH1e` receives): one text per network tick, fields split by `\x01` (escaped `$.1`): `ack`, the newest unreliable state, then `uid`, message, `uid`, message, ... for every reliable message not yet acknowledged. `ack` is the highest uid received in order. Unacknowledged messages are repeated in every packet until their ack arrives: each packet received sets the "sent up to" mark (`$IHОHp`) back to its ack (`connection.js:824`), so the next packet carries every unacknowledged message again. When nothing arrives, the same reset happens 2 s after the last new message (6 s when it was over 1000 characters). So a reliable message normally goes out once per tick for about one round trip; that repeating is not loss. Over a socket the packet goes out with `socket.volatile.emit("m", text)`, which socket.io drops when the socket is busy; peer to peer it goes over an unordered data channel with no retransmits.

The dev console's network log ([README.md §7](../../README.md#7-network-log), `src/features/netlog/`) decodes all of this into `data/netlogs/`: each reliable message with its type name and decoded numbers, and every resend, dropped packet, gap, late and duplicate message.

### 13.4 Keep-alive: start, run, end

**What drives it (every network tick):**

```
frame loop (main.js $T0MМAT)
  → $ММ.$AОAcc(t)                          libs/flash.js, the network tick
    → connection.$AОAcc(time)              each connection
      → every 16 ms (socket) / 4 ms (P2P)  connection.js:1061, $рсНAе.$НТIТc = 16, $HeоIе = 4
        → $ММ.$ТеeАp(connection)           connection.js:1080 → libs/flash.js:421
```

**Inside `$ТеeАp`, server side only** (`connection.$с0А0О`), after the match state for that client has been sent (`libs/flash.js:857–863`):

```js
if (now > connection.$ОcО1p + 3000) {                    // at most every ~3 s
  connection.$ОcО1p = now + Math.random() * 100;         // spread the clients apart
  if (connection.$cМOАA.length === 0 ||                  // no round-trip samples, or
      connection.$cМOАA.at(-1).time < now - 3000)        // the newest is over 3 s old
    connection.$OMeTо(RELIABLE, [RELIABLE_PING, CALLBACK_PLACEHOLDER], () => {});
}
```

- **Starts** when the connection is in a match (`connection.$eоIIH`); the block runs only then.
- **Runs** only while the connection is **quiet**. In a busy match, other reliable messages are acknowledged all the time and keep the samples fresh, so no ping is sent.
- **Ends** when the client leaves the match or disconnects.

**The client answers** (`libs/flash.js:3066–3077`, client side):

```js
let callbackId = parts[1];
respond(callbackId, []);   // $АpА1рO, :1868 → [RELIABLE_RESPONSE, callbackId]
```

`$АpА1рO` throws if called twice for one message, or with no id. **The server** gets the `RELIABLE_RESPONSE` (`libs/flash.js:1963`), finds the callback in `$pА1АН`, deletes it and calls it. It's the empty `() => {}`.

**Where the ping number comes from** (`connection.js:1020–1051`): not from the callback. Whenever the other side acknowledges reliable messages, every acknowledged message's round trip (`now − its send time`) is added to `connection.$cМOАA` (`:1026`). Samples older than 3 s are dropped. Then:

| Case | `connection.ping` |
|---|---|
| Dedicated server (`$ММ.$T0еcр`) | average of the last 3 s of samples (`:1046`) |
| Anyone else | the newest sample |
| No samples | `9999` |
| Before the first sample | `1000` (`connection.js:456`) |

So `RELIABLE_PING` exists to make sure there is **always something to acknowledge**. Without it, an idle connection would have no samples and its ping would read 9999.

**Timeout:** a dedicated server disconnects a client when its oldest unacknowledged reliable message is more than **30 s** old (`$рсНAе.$pIсpo`, `connection.js:15`, checked at `:888`). The match is told "User … has been disconnected due to either high ping or too many events happening in a match".

**Where the ping value goes:**
- The server puts every player's ping in the state it sends (`libs/flash.js:843`, as `ping~skill~reputation`), and clients store it (`libs/flash.js:1295`).
- The scoreboard shows it (`frame2.js:20728`).
- Lag compensation uses it (`frame2.js:21099`, `21161`, `32245`, `35602`).
- A match's ping limit (`ping_limit`, `ping_limit_action`) acts on it.

### 13.5 Anti-cheat report: start, run, end

**Setup:** `window.onload` (`main.js:1140`) calls `$HHOеоH` (`main.js:903`). It saves the source of every non-native function on `globalThis` and `$ММ`, registers the locked arrays, and defines the scan tick `$сMlcА1` (`main.js:939`). See [§6](#6-layer-d-function--array-integrity-scan-mainjs).

**Tick:** `$сMlcА1()` is called once per frame from the frame loop (`main.js:166`). It works only when:

- `isCompiled` (the URL has no `/game/`), **or** `btoa(login) !== "RXJpYyBHdXJ0"` (not "Eric Gurt") and the URL contains `/h5/` (`main.js:945`), **and**
- `isCompiled`, **or** in a match (`$pMМ1`) (`main.js:950–951`), **and**
- at least 300 ms since the last pass (`main.js:956`). Each pass does about 1 ms of work.

**Failure:** when a pass finds a change, it sets a code and a detail:

| Code | Found | Detail |
|---|---|---|
| `1` | a registered array was replaced | the target's index |
| `2` | a function's source changed | `index/old/new`: the target's index, then the first 50 characters of the old and the new source, separated by `/` |
| `3` | a locked array's contents changed ([§7](#7-layer-e-locked-array-snapshots-toolsjs)) | the array's index (`$eOMАер()`) |

**Send** (`main.js:1037–1038`):

```js
if ($ММ.$ceTOI)   // only with a server connection
  $ММ.$ceTOI.$OMeTо($ММ.$МеoрО, [$ММ[$еIНpА], undefined, code, detail]);
```

There's no callback and no placeholder: `undefined` sits where a callback id would be, and travels as `"undefined"` ([13.3](#133-on-the-wire)).

**End** (`main.js:1040–1044`): `$1eoAНl = Infinity`, so this page never scans again. 300 ms later the page reloads, through `location.reload` saved at setup (`r.call(l)`), so replacing `location.reload` afterwards doesn't stop it.

**The server side** (`libs/flash.js:3066–3072`):

```js
if (connection.$с0А0О) {                       // server side of the connection
  if (parts[1] === "undefined")
    $с0A.$Т0ОcpT(connection, undefined, parseInt(parts[2]), parts[3]);
  return;                                      // any other ping from a client: ignored
}
```

`$с0A` is the server's reporting module, and **its real code isn't in the client**:

- On the official server it is the server's own.
- In the shipped client, `$с0A` is a stub with three empty functions and **no `$Т0ОcpT`** (`libs/flash.js:345`). `$AOIе0o` installs it when this game starts hosting a P2P match (`libs/flash.js:3178`).
- On a P2P host, a report therefore **throws**. The reliable loop catches it (`connection.js:913–930`) and:
  - logs "Received reliable message resulted in an error" on the host's console,
  - sends an error report (`net_process_reliable`),
  - tells the match "Server: Reliable messsage error from <login>, user will be disconnected". On a P2P host they aren't actually disconnected, because `$ММ.$T0еcр` is false there.

The same `$с0A.$Т0ОcpT` also gets `"HealthAltering"` when a player's HP goes above the match's `hmax` (`libs/flash.js:942`).

**Visibility:**

| Where | Shows the report? |
|---|---|
| The game's View logs | No: skipped (`MPLogs.js:232–234`) |
| DevTools → Network → WS → the game's socket | Yes: the last frame before the reload |
| The dev console's terminal output (`net/scan-report.js`) | Yes: logged as a warning |
| The network log (`data/netlogs/`, `netlog show type:ping`) | Yes: `OUT REL #<uid> PING("undefined", "<code>", "<detail>")`, recorded as it is sent |

### 13.6 Traces

**Keep-alive, idle match, official server:**

```
t=0      server  $ТеeАp: no sample for 3 s → send [26, cb=17]        queued in $ОOe0A (uid 942, sent t=0)
t=45     client  $c0рlc: type 26, not server side → $АpА1рO("17", [])
                 send [0 RELIABLE_RESPONSE, "17"]                     also acknowledges uid 942
t=90     server  ack for uid 942 → sample 90 ms in $cМOАA → ping = avg(last 3 s)
         server  $c0рlc: type 0 → $pА1АН.get(17) → () => {} → deleted
t≈3000+  server  next check; sends again only if still quiet
```

**Report, client in an online match:**

```
t=0      client  frame loop → $сMlcА1(): 300 ms passed → compare targets
                 target 211 changed (a function) → code 2, detail "211/function a(){…/function a(){…"
         client  $ММ.$ceTOI.$OMeTо(1, [26, undefined, 2, "211/…/…"])     logged in $ММ.$НеAAO
                 $1eoAНl = Infinity; setTimeout(reload, 300)
t≈30     server  $c0рlc: type 26, server side, parts[1] === "undefined" → $с0A.$Т0ОcpT(conn, undefined, 2, "211/…")
t=300    client  location.reload()
```

### 13.7 When it happens

| Situation | Keep-alive | Report |
|---|---|---|
| Single-player, campaign, no server connection | No (no match connection) | The scan can still find a change and reload, but **nothing is sent** (no `$ММ.$ceTOI`) |
| Connected to the lobby, not in a match | No (needs a match) | Sent if the scan finds a change |
| Busy online match | Rarely: acknowledgements keep samples fresh | Sent on a change |
| Online match, quiet for 3 s | Every ~3–3.1 s | Sent on a change |
| This game hosts a P2P match | The host sends it to each player | A player's report reaches the host and throws (stub `$с0A`) |
| Logged in as "Eric Gurt" on `/h5/` | Unchanged | Never: the scan is skipped (`main.js:945`) |
| After one report | Unchanged | Never again on this page (`$1eoAНl = Infinity`), and the page reloads |

### 13.8 Names in this section

| Obfuscated | Meaning |
|---|---|
| `$еIНpА` | the string `"RELIABLE_PING"` (`_strings.js`) |
| `$ММ` | the network class |
| `$ММ.$МеoрО` / `$ММ.$ОAA0р` | reliable (1) / unreliable (0) channel |
| `$ММ.$p1еeс` | callback placeholder in `parts` |
| `$ММ.$ceTOI` | the client's server connection |
| `$ММ.$T0еcр` | true on a dedicated server |
| `$ММ.$НеAAO` | log of messages sent (client) |
| `$ММ.$c0рlc` / `$ММ.$pOeрМ` | handler for reliable / unreliable messages |
| `$ММ.$ТеeАp` | per-connection send step (state, keep-alive) |
| `$ММ.$AOIе0o` | starts hosting a P2P match (installs the `$с0A` stub) |
| `$рсНAе` | the connection class (`connection.js`) |
| `connection.$OMeTо` | send a message |
| `connection.$с0А0О` | this is the server side of the connection |
| `connection.$ОOe0A` | reliable messages waiting for acknowledgement |
| `connection.$cМOАA` | round-trip samples `{ value, time }` |
| `connection.$pА1АН` | callbacks waiting for a `RELIABLE_RESPONSE` |
| `connection.$ОcО1p` | when the next keep-alive check may run |
| `$АpА1рO` | answer a request (sends `RELIABLE_RESPONSE`) |
| `$с0A.$Т0ОcpT` | server: handle a cheat report |
| `$HHOеоH` / `$сMlcА1` | integrity scan setup / tick |
| `$1eoAНl` | time of the last scan pass (`Infinity` = stopped) |

### 13.9 The local `main.js` is modified

`game/scripts/main.js` in this checkout (changed 2026-10-30, after the download on 2026-10-26) differs from the original:

- Added at the top: `globalThis.$еl1НсI()` (turns off the error reporter, [9.15](#915-the-error-reporting-kill-switch-еl1нсi)), `$еHоНH = true` (forces `isCustomMapSession`, which skips the value guard, [§3.2](#32-early-exits-in-pмоct-frame2js38010)), and `console.log` lines.
- Removed: the scan's whole body (original lines 941–1059). `$сMlcА1` is an empty function.

So with this copy **no report is ever sent**, and the value guard never runs. Everything above describes the original. To get it back: `npm run fetch-game` (it re-downloads; the current copy moves to `game.previous/`).

---

## 14. Server-Side State Checks (`$ММ.$pOeрМ`)

> **Line numbers:** `libs/flash.js` and `connection.js` are the current files (`v1769098419`). `npm run find-names -- --decode scripts/libs/flash.js` prints the file with its string constants filled in, on the same line numbers.

> **These are server-side checks.** They run on the machine that is the server for the match, never in the game of the player being checked:
>
> | Match | Runs the checks |
> |---|---|
> | On the official server | The official server |
> | Player-hosted (P2P) | The host's game, for the players who joined it |
>
> Their code is in the game files (`libs/flash.js`) because any player can host a match, and the host's game then needs the server code. Reading it tells you the exact rules; it does not mean your own game checks you. Details: [14.1](#141-where-this-code-runs).

Everything in sections 3–7 runs on the cheater's own machine. This section covers the opposite side: what the **server** does with the state your game sends it ~60 times a second. Three checks look at that state:

| Check | Looks at | Effect in the shipped code | Seen by you? |
|---|---|---|---|
| [14.4 Health above the match maximum](#144-check-1-health-above-the-match-maximum-healthaltering) | your HP | `$с0A.$Т0ОcpT(connection, "HealthAltering")`, and the whole update is thrown away | No |
| [14.5 Respawn counter desync](#145-check-2-respawn-counter-desync) | your respawn count | Your state is ignored while it is wrong; a message to the whole match after 30 bad updates | Yes, a server chat line |
| [14.6 Aiming outside the view area](#146-check-3-aiming-outside-the-view-area-zoom-hack) | where your crosshair is | A logged report, and a chat line to the other players | No, only the others see it |

A fourth check in the same function is the only one that **disconnects** you itself: [14.7 the clock check](#147-related-the-clock-check-server-and-client-time-mismatch).

### 14.1 Where this code runs

The server's code is shipped inside the client. `libs/flash.js` is one file for both sides. Each branch is chosen at run time:

| Flag | Meaning | Where it is set |
|---|---|---|
| `connection.$с0А0О` | This end of the connection is the **server** side | `connection.js` constructor: `$ММ.$T0еcр` for socket connections; `params.$ОеТAН` for P2P (`true` when we host) |
| `$ММ.$T0еcр` | This process is a **dedicated** server (the official one) | `libs/flash.js:9` (`false` in the browser) |

So the same function runs in three places:

1. **The official server** (`$T0еcр` true). Its source is not public, but the client file carries the dedicated-server branches (`if ($ММ.$T0еcр)` with server-only logging through `$OcМср`, the 30 s timeout in `connection.js:888`). That is strong evidence that the official server runs this same file. One part is **not** shipped: the reporting module `$с0A` (14.3).
2. **A player-hosted (P2P) match**, on the host's machine (`$T0еcр` false, `$с0А0О` true on each guest's connection). Hosting installs a stub `$с0A` (`libs/flash.js:345`, by `$ММ.$AOIе0o`, `:3178`).
3. **Never on the client side of a connection.** `$pOeрМ` has a client branch too (from `:1200`), which applies the other players' states. None of the checks below run there.

### 14.2 The state update, part by part

**Sending (client):** `$ММ.$ТеeАp(connection)` (`libs/flash.js:421`) runs on every network tick, every 16 ms on a socket and 4 ms peer to peer (`connection.js:1061`). For your own character `$lНH10М = $0Ме1А[$НAlНc]` (`chars[me]`) it builds `parts` and queues it as the connection's **unreliable** message: `$НAAloМ.$OMeTо($ММ.$ОAA0р, parts)` (`:783`). Only the newest one is sent: `connection.$MТTМM` is overwritten each tick ([13.3](#133-on-the-wire)). Numbers are written with `$Oоolр` (base-N digits, [README §7](../../README.md#7-network-log)). With `true` as its second argument, `0` becomes `""`.

| Index | Constant | Built at | Value |
|---|---|---|---|
| 0 | | `:448–452` | Body control, percent (`Math.round(char.$eoОpА * 100)`). `""` when 100 (standing); it is 1 while the character is dead (`frame2.js:5311`) |
| 1 | `$ММ.$ТOlOep` = 1 | `:453` | `x` |
| 2 | `$ММ.$1ТIHТр` = 2 | `:454` | `y` |
| 3, 4 | | `:455–456` | Velocity `tox`, `toy`, times `$ММ.$MеМMА` = 5 |
| 5 | | `:458–478` | Only when part 0 is under 100: the limp body's points, 8 or 10 of them (10 when face HP ≤ 0), 4 numbers each relative to `x`/`y`, joined with `~` |
| 6 | `$ММ.$сoТрIН` = 6 | `:480` | **HP**: `Math.ceil(char.hea)` |
| 7 | `$ММ.$OlОplр` = 7 | `:482` | **Aim dx**: `tarx - x` (crosshair minus position, game units) |
| 8 | `$ММ.$рI1lрA` = 8 | `:483` | **Aim dy**: `tary - y` |
| 9 | | `:486–527` | Packed booleans (`$IooорO.$oеМ0рe`): per weapon slot "not ready", then 5 action flags |
| 10 | | `:529` | The held gun's network id, `""` for none |
| 11 | | `:530` | Vehicle index (`$ОMррe`), `""` when on foot |
| 12–15 | `$ММ.$НсеMep` = 12, `$ММ.$lIHрHТ` = 13 | `:532–535` | Body part HP: head, face, arms, legs (`ceil`) |
| 16 | `$ММ.$MHOeе0` = 16 | `:537–540` | Alive: crouch amount (`sit * 35`, `""` standing). Dead: **who killed you** (`$1МI0р`) |
| 17 | | `:542–555` | `"3"`, `"2"`, `"1"` or `""`: two flags, one of them "knocked down" (`$loАoM`) |
| 18 | | `:558–591` | Your projectiles in flight, 7 numbers each (id, x, y, speed x, speed y, rotation, one more), joined with `~` |
| 19 | `$ММ.$ОHIАAA` = 19 | `:593` | **Client clock**: `performance.now() - $ММ.$1МАTMH` |
| 20 | `$ММ.$TТoМоА` = 20 | `:595` | **Respawn count**: `char["respawns"]` |

The network log labels these values in its `STATE` lines (`net_log_state on`): `hp 150 | respawns 1 | aim +212,-40 | pos 1264,-520 | ...` (14.9, `src/features/netlog/`).

**Receiving (server):** packets arrive in `connection.$AoH1e` (`connection.js:763`), which keeps only the newest state in `connection.$eМОсM`. Once per tick `connection.$AОAcc` first runs every reliable message in order, then the state, through `$ММ.$pOeрМ(data, connection)` (`connection.js:982`, `libs/flash.js:869`). So a reliable message (like `RESPAWN`) and a state in the **same packet** are handled reliable first.

`$pOeрМ`, server side, step by step (`libs/flash.js:869–1199`):

```text
split at \x02, unescape                                  :873–875
if this is the server side ($с0А0О)
 and the player is in a match (connection.$eоIIH)
 and has sent CLIENT_READY_FOR_FIRST_SYNC ($HАНeT.$HеeТTA, set at :3402):
   if spectator ($HАНeT.$еТр1O): nothing is done at all            :891
   else
     CHECK 2: respawn count                                         :897
     if it does not match: count, maybe announce, and STOP here      :899–911
     if it matches:                                                 :912
       revivable = head HP > 0 and face HP > 0                     :924–926
       if the HP part is not empty:                                 :928
         if alive on the server, or revivable within 3 s of a revive:   :934–936
           CHECK 1: HP above match max -> report, return            :938–944
           if HP > 0 and approved map and round playing:
             CHECK 3: aim outside view                              :946–990
           store HP; death or revival when it crosses 0             :1059–1094
         else: server says dead, client says alive
               -> YOU_ARE_STILL_DEAD once a second                   :1096–1112
         blank the HP part before passing the state on             :1119
         note position changes (inactivity timer)                   :1121–1131
       CLOCK CHECK (14.7)                                           :1134–1189
       keep the state for the other players ($HАНeT.$OeeНl)         :1192
```

Two consequences of the order:

- **Check 2 gates everything.** While your respawn count is wrong, the server skips the rest of the function: the HP and aim checks, your HP and deaths, your position, the clock check, and storing your state for the other players. To them your character stops moving until the count matches again.
- **Check 1 returns early.** A flagged update never reaches the clock check, and is never stored in `$OeeНl`, so the other players stop getting your state for as long as your HP stays over the limit.

### 14.3 The reporting module `$с0A`

Two of the checks call into `globalThis.$с0A`, the server's reporting module:

| Call | Used for |
|---|---|
| `$с0A.$Т0ОcpT(connection, reason, code, detail)` | A cheat report: `"HealthAltering"` (check 1), or the anti-cheat scan's report ([13.5](#135-anti-cheat-report-start-run-end): `undefined`, code, detail) |
| `$с0A.$оlеоН(connection, kind, text, match)` | An event log: joins, leaves, and the aim report (check 3, kind `$с0A.$0ААр0c`) |

**On the official server** its real code is loaded, and the client has no copy of it. What `$Т0ОcpT` does there (log, flag the account, kick, ban) cannot be read from the client.

**On a P2P host** the stub (`libs/flash.js:345–352`) is:

```js
globalThis.$с0A = { $1OoOН: new WeakMap(), $оlеоН: () => {}, $lр1oМе: () => {}, $НАеоТc: () => {} };
```

`$оlеоН` exists and does nothing, so check 3's log line goes nowhere. `$Т0ОcpT` **does not exist**: check 1 throws `TypeError: $с0A.$Т0ОcpT is not a function` on a P2P host. What that leads to is in 14.4.

### 14.4 Check 1: health above the match maximum ("HealthAltering")

**Code** (`libs/flash.js:928–944`):

```js
if (parts[6].length > 0) {                                  // the HP part is there
  let wasAlive = connection.player.hea > 0;                  // $Нl0сco: the server's own idea
  let hp = decode(parts[6]);                                 // $cеMсAН
  if (wasAlive || (connection.player.revivable && now < connection.player.reviveUntil)) {
    if (match.hmax !== 0)
      if (hp > match.hmax)
        if (now > match.hmaxGraceUntil) {                     // $OННОeО
          $с0A.$Т0ОcpT(connection, "HealthAltering");
          return;                                             // the whole update is dropped
        }
    ...
```

**The limit, `match.hmax`**, is set when the match loads a map (`libs/flash.js:5660–5736`):

1. `match.hmax = 0`, which means no limit.
2. Only for an **approved** map (`match.approved`, from the map's listing; `0` also turns `ranked` off, `:5642–5645`).
3. If the match has `force_player_health` set, that is the limit.
4. Otherwise the server parses the map XML (`$сАеMО`, a cache of the last 100 maps in `$ММ.$НA0MОА`) and looks at every `<player>` object, which covers spawn points and preplaced characters (`:5689–5711`):
   - each one must have `hea === hmax`, otherwise: `Player objects do not have .hea and .hmax set to same value`
   - neither may be `NaN`
   - all of them must have the **same** `hmax`, otherwise: `Player objects have inconsistent .hmax (a and b)`
   - that common `hmax` is the limit.
5. If any rule fails, the limit stays 0 and every player gets `Map Verification Error: <reason>` (`:5731`) as a service message.
6. `match.$OННОeО = Date.now() + 10000` (`:5736`): **a 10 s grace period** after every map load, so the HP of the previous map does not trip the check.

**When it is checked:** only while the server thinks you are **alive** (`hea > 0` from your last accepted update), or during a **revive window**. The window opens when you are revivable (head and face HP above 0, parts 12 and 13) and the server has set `$МеeНMO = now + 3000` (`$ММ.$0AA1HO`):

- at round start / warmup, for every player (`:6402`)
- when a teammate's heal hit lands on you while you are dead (`:6950–6955`)

A dead player reporting HP is not checked here. It gets `RELIABLE_YOU_ARE_STILL_DEAD` once a second instead (`:1096–1112`), and the client sets its HP back to 0 when that arrives (`:3511–3523`).

**What compares:** your **reported** `Math.ceil(hea)` against `hmax`. The check uses the **current** HP (`hea`), not your character's maximum, so a raised maximum alone is not caught; filling HP above the limit is. The HP you send in `RESPAWN` (`x, y, hea`, `frame2.js:42923`, read at `libs/flash.js:3851`) is **not** checked here. Your next state update carries the same HP and is.

**What happens:**

| Where | Result |
|---|---|
| Official server | `$Т0ОcpT(connection, "HealthAltering")`; its effect is server-side and unknown. The update is dropped either way (`return`), so the server keeps your last accepted HP and position, and the other players stop seeing your updates |
| P2P host | `$Т0ОcpT` is missing, so it throws. The unreliable loop catches it (`connection.js:984–999`): `console.error("Received unreliable message resulted in an error")`, an error report `net_process_unreliable`, and the whole match gets `Server: Unreliable messsage error from <login>, user will be disconnected`. You are **not** disconnected (`$ММ.$T0еcр` is false), but every update throws, so the host never applies your state again while your HP stays over the limit |

**Dev console:** `god`, `max_hp`, `hp_bonus`, `hp_bonus_pct` and the game's own `game god` all push `hea` above the map's `hmax`. They trip this check on approved maps, from 10 s after the map loads.

**Trace** (approved map, `hmax` 130, `max_hp 500` set mid-round):

```text
t=0       client  hea 130 -> state part 6 = 130                      accepted, stored
t=16      client  dev console sets hmax/hea 500 -> part 6 = 500
t≈16+ping server  wasAlive, 500 > 130, past the 10 s grace -> $Т0ОcpT(conn, "HealthAltering"), return
t+16...   every update until HP <= 130 is dropped the same way
```

### 14.5 Check 2: respawn counter desync

**Why the counter exists.** Hits and explosions carry the target's respawn count (`RELIABLE_DAMAGE_PLAYERS_VIA_EXPLOSION` puts `obj["respawns"]` in every entry, `libs/flash.js:682`). The server drops a hit whose count does not match the target's current life (`$1eMМеТ`, `:6926–6931`: `if (target.respawns !== params.respawns) return false`). A late hit from your previous life can't kill you again.

**How it counts**, in both copies:

| Event | Client | Server |
|---|---|---|
| Joining | `0` (`frame2.js:7298`), or the value in `FIRST_SYNC_RESPONSE` | `0` (`libs/flash.js:6716`) |
| You respawn | sends `RELIABLE_RESPAWN(x, y, hea)` and does `respawns++` (`frame2.js:42923–42924`) | on `RESPAWN`: `respawns++`, then sends it to everyone with the new count in part 4 (`libs/flash.js:3852–3857`) |
| A teammate revives you | sends `RELIABLE_RESSURECT(x, y, hea)`, `respawns++` (`frame2.js:16070–16071`) | same handler as `RESPAWN` (`:3830`) |
| Another player's respawn arrives | sets their `respawns` from part 4 (`:4103`) | |

**Code** (`libs/flash.js:897–922`):

```js
let theirs = decode(parts[20]);
if (theirs !== connection.player.respawns) {
  connection.desyncCount++;                                   // $eMOоI
  if (connection.desyncCount >= 30)                           // $ММ.$eрIМIр
    if (!connection.desyncAnnounced) {                        // $AоIТМ
      connection.desyncAnnounced = true;
      match.broadcast("Server: Respawn counter desync happens for " + login + " (" + nickname + ")");
    }
} else {
  connection.desyncCount = 0;
  if (connection.desyncAnnounced) {
    connection.desyncAnnounced = false;
    match.broadcast("Server: Respawn counter desync has been resolved for " + login + " (" + nickname + ")");
  }
  ... checks 1 and 3, HP, death, position (14.2)
}
```

**Details:**

- **The counter only resets on a matching update.** The server handles at most one state per player per server tick (the newest that arrived), and a socket client sends 40 to 60 a second. So 30 mismatching updates take **about half a second or more**; peer to peer (4 ms ticks) it can be faster.
- **No kick.** The effect is two broadcasts (`$HАeHT` sends a `RELIABLE_SERVICE_MESSAGE` to every player in the match, yellow by default) and a frozen state.
- **While it is wrong, the server ignores your whole state** (14.2): no HP check, no aim check, no clock check, no deaths, and no state passed on, so you freeze on the other players' screens. A desynced player also escapes the HP check, but nobody sees them move.
- **A normal respawn does not trip it.** The client puts `RESPAWN` (reliable) and the next state with the new count into the same or a later packet, and the server runs reliable messages first (14.2). A desync means a `RESPAWN`/`RESSURECT` the server refused or never got, a count changed on the client, or a `FIRST_SYNC_RESPONSE` count that was not applied.
- **The `respawn_model` "v2" respawn queue** (`:3833–3848`) does not refuse the respawn. A respawn without permission or out of turn only gets a broadcast (`respawns without respawn permission or it has expired`, `respawns yet is not at the start of the respawn queue`), and the count is still increased, so it does not desync.

**In the network log:** `IN REL SERVICE_MESSAGE("<font color=\"#ffff00\">Server: Respawn counter desync happens for ...</font>")`. Compare `net_log_state` part 20 (the 21st value of an `OUT STATE` line) with the count in your last `IN REL RESPAWN(...)` line for your slot.

### 14.6 Check 3: aiming outside the view area ("zoom hack")

**Code** (`libs/flash.js:946–990`):

```js
if (hp > 0)
  if (match.approved)
    if (match.coop_state === 0) {                              // $ММ.$ОeрoT: the round is being played
      let dx = decode(parts[7]), dy = decode(parts[8]);        // tarx - x, tary - y
      if (dx !== connection.lastDx || dy !== connection.lastDy) {   // $HMc0o, $TТMТO
        connection.lastDx = dx; connection.lastDy = dy;
        if (dx > 800 + 200 || dy > 400 + 200) {
          connection.outsideScore += 1;                        // $Tе0MО
          if (connection.outsideScore > 25) {
            if (now > connection.nextAimLog) {                 // $pАAОо
              connection.nextAimLog = now + 60000;
              $с0A.$оlеоН(connection, $с0A.$0ААр0c, "zoom hack attempt detected " +
                JSON.stringify({ dx, dy, p: connection.outsideScore }), match);
            }
            let msg = "Server: " + login + " (" + nickname + ") aims outside of their view area";
            for (let other of match.players)
              if (other && other !== connection)
                if (other.account.is_staff || other.ip !== connection.ip)
                  match.sendTo(other, msg, "#ffffff");          // $cТTоМH -> RELIABLE_SERVICE_MESSAGE
            connection.outsideScore = 0;
          }
        } else if (connection.outsideScore > 0)
          connection.outsideScore -= 1;
      }
    }
```

**The numbers:** the game stage is 800 × 400 units (`<canvas width="800" height="400">`), and the camera is centered on you at zoom 1. A legitimate crosshair stays within about 400 units horizontally and 200 vertically of your character. The limit is the **full stage size plus 200**: `dx > 1000` or `dy > 600`.

**Exact behavior:**

- **Only right and down are checked.** The comparison is signed (`dx > 1000`, not `Math.abs(dx) > 1000`). Aiming 2000 units to the left (`dx = -2000`) or straight up never counts.
- **Only samples where the aim changed count.** Holding the crosshair still outside the limit adds nothing after the first sample. The score is a leaky counter: +1 per changed sample outside, −1 per changed sample inside, floored at 0.
- **More than 25 net outside samples** trigger it: 26 in a row at the least. While the mouse moves, every update the server handles is a new sample, so that is about half a second of moving the crosshair far right or down. Then the score goes back to 0, and it can trigger again.
- **Only when it matters:** you are alive by your own report (`hp > 0`), on an approved map, while the round is played (`coop_state` 0). Warmup (2) and round end (1) are not checked, nor are unapproved maps. It is also inside check 1's "alive or revive window" block, and behind check 2.
- **The log line** is rate-limited to once per 60 s per connection. **The chat line** goes out on every trigger.
- **Who sees the message:** every other player in the match who is staff (`$ppO0l.is_staff`) **or has a different IP** from you. Players on your own network (same public IP) do not, and **you never do**. Nothing else happens: no kick, no dropped update.

**Dev console:** the console's `zoom` (any camera zoom), and the game's own `zoom 25` / `zoom 50` chat commands, show more of the map. Aiming at what you now see to the right of or below the old view sends `dx > 1000` / `dy > 600`. The map's own zoom (the `gamescale` engine mark and the "set zoom" trigger action) does the same, so on a map that zooms out, legitimate players can trip it too.

**In the network log:** you never receive it. With `net_log_state on`, parts 7 and 8 of your `OUT STATE` lines are `dx` and `dy` (the 8th and 9th values in the parentheses).

### 14.7 Related: the clock check ("Server and client time mismatch")

The only check in this function that disconnects you directly. Your game's clock (part 19) must advance at the same speed as the server's, which catches speed hacks that change the page's clock (`libs/flash.js:1134–1186`):

```js
let clientTime = decode(parts[19]);                           // performance.now() - start
if (samples.length === 0 || now > samples.at(-1).server + 500) {   // one sample per ≥ 500 ms
  samples.push({ server: now, client: clientTime });  if (samples.length > 2) samples.shift();
  if (samples.length === 2) {
    serverSum = serverSum * 0.99 + (samples[1].server - samples[0].server);   // $lрТHе
    clientSum = clientSum * 0.99 + (samples[1].client - samples[0].client);   // $cHcTO
    let limit = $ММ.$T0еcр ? 600 : 1200;                      // dedicated : P2P host
    if (Math.abs(serverSum - clientSum) > limit) {
      if (++strikes > 6) {                                    // $0cНMТ
        connection.sendServiceMessage("Server and client time mismatch");
        strikes = -10000;                                     // once
        setTimeout(() => connection.Disconnect(), 500);
      }
    } else strikes = 0;
  }
}
```

- **Both sums decay by 1 % per sample**, so they remember about the last 100 samples, about 50 s. Each holds about 100 × 500 ms = 50 s of elapsed time. A clock running **1.2 % fast or slow** (600 / 50 000) builds a 600 ms difference and is caught: 7 bad samples in a row, so about 3.5 s after the gap passes the limit. A P2P host allows 2.4 %.
- **A lag spike counts once.** A packet that is late by more than 600 ms puts one sample out of line, and the next sample brings it back, because client time is read from the packet's contents, not from when it arrived. Seven bad samples in a row need a clock that really runs at a different speed, or a connection that stalls again and again for longer than the limit.
- **Why it can't be missed:** the server sends `RELIABLE_SERVICE_MESSAGE("Server and client time mismatch")`, then disconnects you 500 ms later. On the client, socket.io reports `io server disconnect`. In the network log that shows as an `IN REL SERVICE_MESSAGE(...)` line just before `CONN closed: io server disconnect`. **A disconnect without that line came from somewhere else.**

### 14.8 Summary for players

All four run on the match's server (14.1), on what your game reports.

| You did | Check | What happens |
|---|---|---|
| HP above the map's max (`god`, `max_hp`, `hp_bonus`, `game god`) on an approved map, from 10 s after it loaded | 1 | Official server: a "HealthAltering" report (outcome unknown), and your updates are dropped while it lasts. P2P host: an error message to the whole match, and the host ignores you |
| Respawn count out of step with the server for ~0.5 s | 2 | "Respawn counter desync" to the whole match; the server ignores your whole state (you freeze for the others) until it matches |
| Aimed more than 1000 units right or 600 down, moving, for ~0.5 s, on an approved map mid-round | 3 | "aims outside of their view area" to the other players (not you, not your IP); a logged report once a minute |
| Page clock running ≥ 1.2 % off the server's | clock | "Server and client time mismatch", then disconnected |

**The dev console holds these back in approved, ranked matches** (`src/console/kernel/overrides/server-checks.ts`; the match's `approved` above 0 and `ranked` true, from `MATCH_JOIN_RESPONSE`). It refuses raising your HP (`max_hp` above your normal max, `hp_bonus`, `hp_bonus_pct`, `hp +<n>`, `game god`, `game grow`) and zooming out (`zoom` below 100%, `game zoom 25` / `50`). A setting you already had is not applied there and your saved value is kept. Whole kinds are held back, not values tuned to stay under a limit. No console command changes the respawn count or the page clock, so check 2 and the clock check have nothing to hold back. Unranked matches, unapproved maps and single-player are left alone. The server still runs checks 1 and 3 on **every approved map**, ranked or not (14.4, 14.6), so an unranked match on an approved map is checked with no protection from the console.

`bypass checks` turns this off: a red warning, then the next line typed into the console must be exactly `ALLOW DANGEROUS COMMANDS` (case-sensitive); any other line turns it down and is not run. It is refused from binds, profiles and `;` chains, does not exist in remote play, and lasts until the page reloads or `bypass off`.

### 14.9 How HP travels

> **Line numbers:** `v1769098419`, as in the rest of section 14. The last part of this section, [Finding it in another game version](#finding-it-in-another-game-version), says how to find each piece again when the numbers move.

**Who owns HP.** There are three copies of a player's HP, and none of them is authoritative on its own:

| Copy | Where | Written by |
|---|---|---|
| Your own HP | `chars[me].hea` in your game (`$0Ме1А[$НAlНc]["hea"]`) | Your game only. The server's copy of you is never applied back to you, except as a forced 0 (below) |
| The server's copy | `connection.$HАНeT["hea"]` per player | Your state updates (overwrite it), and hits other players report (subtract from it) |
| Everyone else's view of you | `chars[slot].hea` in their game | The server's copy, from its snapshot, smoothed by their own hit predictions |

**Max HP is never sent.** `hmax` exists only in each game and in the map. The server compares your HP against the map's `hmax` (14.4); it never learns your character's own `hmax`.

#### Every message that carries HP

| # | Message | Direction | Where HP is | Encoding | Built at | Read at |
|---|---|---|---|---|---|---|
| 1 | State update (unreliable) | you → server | part `stateHp` (6) | `Math.ceil(hea)`, network number (`$Oоolр`, 0 sent as a digit, not `""`) | `libs/flash.js:480` (`$ТеeАp`) | `:928–1094` (checks, stores) |
| 2 | `RESPAWN(x, y, hp)` / `RESSURECT(x, y, hp)` (reliable) | you → server | part 3 | network number | `frame2.js:42923` / `:16070` | `libs/flash.js:3851` |
| 3 | `RESPAWN(slot, x, y, hp, respawns)` | server → everyone, you too | part 4 | as sent; the server adds the slot and the count | `:3857`, `:4056` | `:4095–4110` |
| 4 | `HIT_PLAYER(..., damage×100, target's respawns)` (reliable) | shooter → server | part 13: HP the shooter's game took off the target, × 100 | network number | `frame2.js:30493–30527` | `libs/flash.js:3866–3930` |
| 5 | `HIT_PLAYER(shooter slot, ..., damage×100, respawns, killed)` | server → everyone | part 14 (after the slot); the last part is `"1"` when the server's copy reached 0 | as sent, plus the kill flag | `:3929`, `:4056` | `:4314–4383` |
| 6 | `DAMAGE_PLAYERS_VIA_EXPLOSION` (reliable) | exploder → server → everyone | per target: `hea_damage` (× 1, not × 100) after 5 other numbers | network number; the server blanks it (`""`) for a target its copy says is dead | `libs/flash.js:650–688` | `:3934–3988`, `:4386` |
| 7 | The server's snapshot (unreliable) | server → each client | per changed player, right after the slot: **the server's copy** | network number | `:820–850` | `:1274–1360` |
| 8 | `YOU_ARE_STILL_DEAD()` (reliable) | server → you | no value: it means "your HP is 0" | none | `:1096–1112` | `:3511–3523` |

Heals do not carry HP. `HEAL_PLAYER(power×100, healer, target, respawns)` and a `HIT_PLAYER` with negative power (a heal hit) are relayed with damage 0. The healed player's own game applies the heal and reports the result in its next state update. On the server they only open the revive window (14.4).

#### The life of one value

```text
your game                         server                                  other games
---------                         ------                                  -----------
hea changes (damage, heal, cheat)
every tick: state part 6 = ceil(hea) ─────►  dropped if over hmax (14.4)
                                             else $HАНeT.hea = value       (:1059)
                                             blank part 6, keep the state  (:1119, :1192)
                                             snapshot to each client:
                                               slot, $HАНeT.hea, ping...  ─────► other players: chars[slot].hea
                                                                                  = $TlpНI(player, server value)
                                                                                  your own entry: ignored (:1339)
you shoot B: your game simulates the hit
HIT_PLAYER(... (before-after)×100 ...) ────► B.$HАНeT.hea -= damage       (:6979)
                                             <= 0: B dies on the server,
                                             kill flag "1"                 (:3929)
                                             relayed with your slot  ─────► B's game: its own hit simulation,
                                                                            then hea = min(hea, before - damage) (:4375)
                                                                            kill flag: hea = 0                    (:4380)
                                                                            B's next state reports the result
```

**Your own HP is never set from the network, except to 0.** It is set to 0 by a kill flag on a hit (`:4380–4383`) or by `YOU_ARE_STILL_DEAD` (`:3519–3522`). Otherwise the server's copy and the snapshot do not touch it (`:1339`: `if (slot !== me || spectating)`), and the server overwrites its copy with whatever you report next. The server's own subtraction (row 4) only matters until your next state update arrives, and for deciding kills.

**Other players' HP in your game** comes from the snapshot, through `$TlpНI(player, value)` (`frame2.js:2285`). If you hit that player in the last `150 + their ping × 3 + your ping × 3` ms, your game keeps the lower value it predicted (`$ррТcе`, `frame2.js:2256`), so a late snapshot does not refill a bar you just hit. A drop of more than 10 calls `$оo1pO(slot)` (`libs/flash.js:1350`).

**What this means for the checks:**

- The server's HP check (14.4) can only see row 1. Rows 2 and 3 carry HP at respawn without a limit check; the next state update repeats it and is checked.
- A game that ignores damage (the console's `god`) keeps reporting full HP. Row 4 lowers the server's copy, but your next state update, one tick later, writes your full HP back over it. Only damage that takes the server's copy to 0 between two of your updates (a burst, a one-shot) kills you there. Then the kill flag arrives, which the `god` accessor ignores, and the server treats your updates as "alive on the client, dead on the server": no HP check, no stored HP, `YOU_ARE_STILL_DEAD` every second (14.2), which `god` ignores as well.
- `max_hp` above the map's `hmax` shows up in row 1 the first time your HP is above it (14.4).
- Row 1 is the only place your HP goes to the server for checking. Damage reported by others (rows 4–6) never pushes it above `hmax`, and heals are applied by your own game.

#### In the network log

| Row | Shows as | Needs |
|---|---|---|
| 1 | `OUT STATE hp 150 \| respawns 1 \| aim ... \| ...` | `net_log_state on` or `netlog all on` |
| 2, 3 | `OUT REL RESPAWN(1264, -520, 150)`, `IN REL RESPAWN(0, 1264, -520, 150, 1)` | Always |
| 4, 5 | `OUT REL HIT_PLAYER(target, ..., 2500, 3)` (25 HP), `IN REL HIT_PLAYER(shooter, ..., 2500, 3, "1")` | Always |
| 6 | `DAMAGE_PLAYERS_VIA_EXPLOSION(...)`, one group of numbers per target | Always |
| 7 | `IN STATE #3 hp 80 ping 45 ms [...]` | `net_log_state on` or `netlog all on` |
| 8 | `IN REL YOU_ARE_STILL_DEAD()` | Always |

Numbers from 29 to 121 travel as one ordinary character. The log decodes rows 1–5 and 7 by position (`net/state.js`, and `NUMBER_PARTS` in `net/recorder.js`), so HP 100 shows as `100`, not `"h"`. Row 6 is decoded part by part, and a value in that range can still show as a letter there.

#### Finding it in another game version

The obfuscated names change with every version; the structure and the string constants have not so far. Decode a file first (`npm run find-names -- --decode scripts/libs/flash.js`), then search for the anchor:

| Piece | Anchor to search for | Tracked by `npm run find-names` |
|---|---|---|
| State update builder | `performance.now()-` in `libs/flash.js`; the HP line is the `Math.ceil(...["hea"])` push before the two `["tarx"]-` / `["tary"]-` pushes | |
| Index of each value | the server's `parts[<net>.<name>]` reads in the state handler | `stateHp`, `stateRespawns`, `stateAimX`, `stateAimY`, `stateHeadHp`, `stateFaceHp`, `stateX`, `stateY`, `stateKiller`, `stateClock`, `stateVelScale` |
| HP check | `"HealthAltering"` | |
| Server stores your HP | `["hea"]=` a few lines after `"HealthAltering"` | |
| HP blanked before relaying | `parts[<net>.<stateHp>]="";` | |
| Snapshot | `["skill"]*100` (builder), `["reputation"]=` (reader) | |
| Snapshot applied to others | the `["hea"]=` call right after `["reputation"]=` | |
| Respawn | `["RELIABLE_RESPAWN"]` (in `frame2.js`: sender; in `libs/flash.js`: server, then client) | |
| Hits | `["RELIABLE_HIT_PLAYER"],` in `frame2.js` (sender; the damage is the `[13]=` write a few lines later); `"provided_health_delta"` in `libs/flash.js` (receiver) | |
| Server-side damage | `["hea"]-=params["hea_damage"]` | |
| Kill flag | `parts[15]=(` near `RELIABLE_HIT_PLAYER` in the server branch | |
| Relay with the sender's slot | `parts.splice(1,0,` | |
| Forced 0 | `["RELIABLE_YOU_ARE_STILL_DEAD"]` | |
| Network numbers | `$ММ.$Oоolр` / `$ММ.$OНННО`: the functions called on every part above; the digits are built by `+=c` in a `for(let i=1;i<127;i++)` loop | `netDigits` |

When a `find-names` pattern stops matching, the run says which key (`problem: stateHp: pattern not found`). The network log keeps working: a missing position is simply not labeled, and a layout that no longer matches this version's (21 parts, the positions above) is shown with only the server's positions named (`net/state.js`).

### 14.10 Names in this section

| Obfuscated | Meaning |
|---|---|
| `$ММ.$pOeрМ` | Handles one unreliable state update (both sides; server branch `:884–1199`) |
| `$ММ.$ТеeАp` | Builds and queues your state update (client); sends match state and keep-alives (server) |
| `$ММ.$OНННО` / `$ММ.$Oоolр` | Decode / encode a network number |
| `connection.$HАНeT` | The server's record of the player on this connection (`hea`, `respawns`, `login`, `nickname`, `team` ...) |
| `$HАНeT.$HеeТTA` | Sent `CLIENT_READY_FOR_FIRST_SYNC`: checks are on |
| `$HАНeT.$еТр1O` | Spectator: no checks |
| `$HАНeT.$МоТeII` | Revivable: head and face HP above 0 in the last update |
| `$HАНeT.$МеeНMO` | Revive window end (`now + $ММ.$0AA1HO`, 3000 ms) |
| `$HАНeT.$оcIеMM` | Next `YOU_ARE_STILL_DEAD` time |
| `$HАНeT.$OeeНl` | Your last state, passed on to the other players |
| `match.hmax` | HP limit; 0 = none |
| `match.$OННОeО` | End of the 10 s HP grace after a map load |
| `match.$HАeHT(text, color)` | Service message to every player in the match |
| `match.$cТTоМH(conn, text, color)` | Service message to one player |
| `connection.$ТАMpо(text)` | Sends `RELIABLE_SERVICE_MESSAGE` |
| `connection.$eMOоI` / `$AоIТМ` | Respawn desync count / announced |
| `connection.$HMc0o`, `$TТMТO` | Last aim dx, dy |
| `connection.$Tе0MО` | Aim score |
| `connection.$pАAОо` | Next time the aim report may be logged |
| `connection.$НAТсО` | Clock samples `{ server, client }` |
| `connection.$lрТHе`, `$cHcTO`, `$0cНMТ` | Clock sums (server, client), strikes |
| `$ММ.$eрIМIр` | 30: desync updates before the message |
| `$ММ.$ОeрoT`, `$оорoсH`, `$ОоcОMH` | `coop_state`: 0 playing, 1 round ended, 2 warmup |
| `$с0A.$Т0ОcpT` / `$с0A.$оlеоН` | Cheat report / event log (14.3) |
| `$с0A.$0ААр0c` | Event kind of the aim report |
| `$TlpНI(player, hp)` | Applies the server's HP for another player, kept at or under your own recent hit prediction (14.9) |
| `$ррТcе(player)` | Your recent hit prediction for that player, if still fresh |
| `$1eMМеТ(params)` | Server: accept a hit or heal (respawn count must match), subtract the damage |
| `$cpТОpО(connection)` | Server: a player dies |

---

## 15. Sad Burst 2

Sad Burst 2, the community fork of this client, has its own document: [anticheat-sadburst.md](anticheat-sadburst.md). It follows the structure of this one, layer by layer, and covers what differs: how the loader brings the code into the page, what the integrity scan watches there, the build hash sent with every login, the network changes and the shipped server code.
