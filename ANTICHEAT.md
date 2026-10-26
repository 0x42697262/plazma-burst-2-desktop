# Client Anti-Cheat: How It Works

> Status: **broken / bypassable**. This document explains the obfuscated client-side anti-cheat. It does not change any code.
> All line numbers refer to the current files in this folder (`scripts/…`).

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
node -e 'const vm=require("vm"),c={};c.globalThis=c;vm.createContext(c);vm.runInContext(require("fs").readFileSync("_strings.js","utf8"),c);console.log(c[process.argv[1]])' '$сpcрo'
# -> at <anonymous>:
```

### 2.1 Core guard (`scripts/frame2.js`)

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

### 2.3 Integrity scan (`scripts/main.js`, `scripts/libs/tools.js`)

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

For arrays registered with `$IeTlO([], undefined)` (skin colors, unlocks, attachments: `frame2.js:2475–2479`, `4499–4517`):

| Function | Does |
|---|---|
| `$oIeeol()` (lock) | If unlocked: stack check, set locked, **deep-clone every array as the new baseline** |
| `$oITOo()` (unlock) | If locked: stack check, set unlocked |
| `$T0OMое(arr, i)` | Copy `arr[i]` into the baseline (single legit write) |
| `$ррОM1I()` | Calls `lock` first, then deep-compares **one** array per call: `-1` = mismatch, `1` = full cycle done |

Legit use: `Campaign.js:386–390`, `Equipment.js:84–88` do `$oITOo(); arr[x]++;`.

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

**Does not trigger** in: singleplayer, campaign, custom maps, the editor test, or **any MP match after a custom map was played in the same tab**.

---

## 9. How It Was Bypassed

This section explains **why** each check in [§8](#8-when-it-triggers-cheat-sheet) can be avoided. It describes the weaknesses and does not include exploit code. How to fix them is decided separately (see [§10](#10-how-to-prevent-it) for options).

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
| registered array changed | [9.12 Locked arrays](#912-locked-arrays) | Medium |
| `$МОеIe` canary changed | [9.13 The string canary](#913-the-string-canary-моеie) | Low |
| (the punishment itself) | [9.14 Replacing the guard or punishment](#914-replacing-the-guard-or-the-punishment) | High |
| (reporting) | [9.15 The error-reporting kill switch](#915-the-error-reporting-kill-switch-еl1нсi) | High (no evidence) |
| (what is not checked) | [9.16 Coverage gaps](#916-coverage-gaps) | Medium |
| (how it reacts) | [9.17 The reaction teaches the cheater](#917-the-reaction-teaches-the-cheater) | High (speeds up all of the above) |

**One rule explains most of this section:** every flag, function and stored value is a **writable global**. The scripts are classic `<script>` files, not modules, so every top-level `var` and `function` becomes a property of `window`, and any code running in the tab can read or change it.

---

### 9.1 Gameplay-frame gate (`currentFrame === 18`)

**What it is:** both `$pМоcT` and `$oеeес` only run on the main timeline's gameplay frame (18), and only when the character list `$0Ме1А` is not empty.

**Where it is defined:**

| What | File:line |
|---|---|
| `globalThis.currentFrame` getter → `stage.currentFrame` | `scripts/flash.js:3564` |
| `setGetterSetter` uses `configurable: true` | `scripts/libs/tools.js` (`setGetterSetter`) |
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
6. **It is gated.** It only runs if `isCompiled` (URL has no `/game/`), or on the `/h5/` path for any login except `"Eric Gurt"`. It also needs `isCompiled || isMultiplayer`.
7. **It is slow.** Every 300 ms it checks targets one by one for about 1 ms. With hundreds of targets, a change can go unseen for seconds.
8. **It only fires once.** After the first hit it sets `$1eoAНl = Infinity` and reloads after 300 ms.
9. **The report can be dropped.** It sends through `MP.serverConnection.$OMeTо`, a method that point 3 says is never checked.

---

### 9.12 Locked arrays

**What it is:** arrays registered with `$IeTlO([], undefined)` (skin colors, unlocks, attachments: `frame2.js:2475–2479`, `4499–4517`) are deep-compared with a saved copy ([§7](#7-layer-e-locked-array-snapshots-toolsjs)). A mismatch sends code `3` and reloads.

**Step by step:**

1. `$oITOo()` (unlock) and `$oIeeol()` (lock + re-snapshot) are globals. Their only protection is the Chrome-console stack check ([9.9](#99-the-stack-check-at-anonymous)).
2. Unlock, change the array, and the next `verifyNextArray` (`$ррОM1I`) calls `lock` first. Lock re-snapshots, so the change becomes the new baseline.
3. `$T0OMое(arr, i)` copies one index into the baseline **without** needing an unlock.
4. `$ррОM1I` is only called from `$сMlcА1`, so every gap in [9.11](#911-the-function-integrity-scan) (gating, replacing the checker) also turns this check off.
5. Array **identity** checks (code `1`, `main.js:1112–1134`) only catch a replaced array, not edited contents.

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

---

### 9.17 The reaction teaches the cheater

**What happens on a hit:** `punish` crashes the tab on the **next tick**, in the **browser**, and **tells nobody** ([§4](#4-layer-b-the-punishment-mеohоe), [9.15](#915-the-error-reporting-kill-switch-еl1нсi)).

**Step by step:**

1. Someone testing changes sees the crash within one frame of the change that caused it.
2. So they can try one change at a time and quickly map out what is checked and what is not (this is how 9.5–9.8 are found).
3. The server has no record of the attempts: no logs, no counts, no patterns, no bans.
4. An honest player who hits a false positive ([§12.2](#122-known-false-positive-risk)) sees the same crash, so crashes on their own can't be used as evidence either.

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
grep -n '\$pМоcT()\|\$oеeес()' scripts -r   # guarded entry points
grep -n '\$еHоНH=' scripts -r               # where the custom-map flag is set
grep -n 'stack.indexOf' scripts -r          # stack checks
grep -n '\$MеOHОe()' scripts -r             # every punishment call
```
