# Sad Burst 2 Anti-Cheat: How It Differs From the Official Client

> Status: **broken / bypassable**, as the official client. This document explains the client-side anti-cheat of Sad Burst 2, a community fork of Plazma Burst 2, as it compares with the official client described in [anticheat.md](anticheat.md). It does not change any code.
> **Scope:** Sad Burst 2 build `20261030020533` (client version `1.23`), fetched with `npm run fetch-game -- --sadburst` into `game.sadburst/`, compared with the official client `v1769098419` in `game/`. Paths such as `gamelogic/8c699c159547a19b.js` are relative to `game.sadburst/`.
> Everything here is read from the code. Server behavior is never visible from the client and is marked as such.

---

## Table of Contents

1. [TL;DR](#1-tldr)
2. [Reading the code](#2-reading-the-code)
3. [How the code gets into the page](#3-how-the-code-gets-into-the-page)
4. [Layer A: Per-Tick Value Guard (`$pМоcT`)](#4-layer-a-per-tick-value-guard-pмоct)
5. [Layer B: The Punishment (`$MеOHОe`)](#5-layer-b-the-punishment-mеohоe)
6. [Layer C: Console / Stack Detection](#6-layer-c-console--stack-detection)
7. [Layer D: Function & Array Integrity Scan](#7-layer-d-function--array-integrity-scan)
8. [Layer E: Locked Array Snapshots](#8-layer-e-locked-array-snapshots)
9. [Error Reporting Is Removed](#9-error-reporting-is-removed)
10. [When It Triggers (cheat sheet)](#10-when-it-triggers-cheat-sheet)
11. [Bypasses: What Still Applies](#11-bypasses-what-still-applies)
12. [The Client Build Hash](#12-the-client-build-hash)
13. [Network: Wire Format, Pings and Connections](#13-network-wire-format-pings-and-connections)
14. [Server-Side Checks (the shipped server code)](#14-server-side-checks-the-shipped-server-code)
15. [What This Means for This Repository](#15-what-this-means-for-this-repository)
16. [How to Prevent It](#16-how-to-prevent-it)
17. [Appendix](#17-appendix)

---

## 1. TL;DR

Sad Burst 2 keeps the official game code, obfuscated names included, and puts a new loader, new servers and new site code around it. The anti-cheat code itself is nearly untouched. What changed around it decides what still works:

| Layer | Official ([anticheat.md](anticheat.md)) | Sad Burst 2 |
|---|---|---|
| A. Value guard | Crashes the tab on an outside change in multiplayer | **Same code, same 15 entry points.** Works as in the official client |
| B. Punishment | Turns off error reporting, then crashes the tab | **Same code.** Turning off error reporting no longer matters (row 9) |
| C. Stack checks | `"at <anonymous>:"` in the stack → crash or reload | **Same code.** Scripts run under random `sourceURL`s |
| D. Integrity scan | Reports changed functions and arrays with `RELIABLE_PING`, then reloads | **Same code.** Its baseline includes Sad Burst's own globals, and its report goes to the region server during a match ([§7](#7-layer-d-function--array-integrity-scan)) |
| E. Locked arrays | Compared by the scan | **Same code, same 23 arrays.** Block-scoped in both clients. One new Sad Burst function writes a locked array without unlocking it ([§8](#8-layer-e-locked-array-snapshots)) |
| Error reporter | POSTs errors to the site | **Sends nothing.** The `fetch` call is gone and the URL is `""` ([§9](#9-error-reporting-is-removed)) |
| Build hash | None (`"version_h5"`) | **New.** SHA-256 of every game script, sent with every login ([§12](#12-the-client-build-hash)) |
| Network | `\x01`/`\x02` separators, one server connection, P2P possible | **Different.** Printable separators, constant client pings, separate lobby and region servers, P2P disabled ([§13](#13-network-wire-format-pings-and-connections)) |
| Server checks | Shipped in the client for P2P hosts | **Same code and constants.** They never run in a client, since there is no P2P ([§14](#14-server-side-checks-the-shipped-server-code)) |

In short:
- Every layer runs as in the official client. The scan's `RELIABLE_PING` report is the only thing the client's anti-cheat tells a server; the error reporter no longer sends anything.
- Every bypass in [anticheat.md §9](anticheat.md#9-how-it-was-bypassed) still works, and Sad Burst adds one more way to set the custom-map flag ([§11](#11-bypasses-what-still-applies)).
- The one new signal a server receives is the build hash. It says what was downloaded, not what runs, and the client computes and reports it itself ([§12.9](#129-properties-for-whoever-relies-on-it)).

---

## 2. Reading the code

### 2.1 Files

Every Sad Burst script is minified onto one line and named by a content hash, so file names change with every build. Each row also gives a text to search for, which survives a rebuild better than the name: either an **anchor** (a text that occurs exactly once in that file) or a name. Every text this document calls an anchor was checked to occur once in its file.

| Official file | Sad Burst file (build `20261030020533`) | Anchor or name |
|---|---|---|
| `index.html` script tags | `assets/index-Bq64YSI5.js` (the loader) + `gamelogic/scripts-manifest.json` | `scripts-manifest.json`, `PB2_CLIENT_BUILD` |
| `_strings.js` | `gamelogic/09094c58e1872195.js` (en), `gamelogic/c787a2f8549ff2b2.js` (zh) | `{let e=globalThis;e.$` |
| `scripts/libs/errors.js` | `gamelogic/1c875a40b1fa8ffe.js` | `isCompiled=document.location.href.indexOf($о1OMc)===-1` |
| `scripts/flash.js` (loaderInfo, trace) | `gamelogic/1378664311d41f5c.js` | `globalThis.loaderInfo={parameters:{l:"",p:""},url:location.href}` |
| `scripts/libs/tools.js` | `gamelogic/b55097df4cefc728.js` | `globalThis.$oITOo=()=>{i\|\|(new Error().stack` |
| `scripts/quicksave.js` | `gamelogic/f560a5ecb7aea6ec.js` | |
| `scripts/guns.js` | `gamelogic/f6e6b47a3f981d15.js` | `function $eМlee(){new Error().stack` |
| `scripts/spritesheets.js` | `gamelogic/19e847576880ee8f.js` | |
| `scripts/screens/NamePrompt.js` | `gamelogic/41749539d442b628.js` | |
| `scripts/screens/Campaign.js` | `gamelogic/57e424f84d4acd5d.js` | |
| `scripts/screens/CustomMap.js` | `gamelogic/c3e04cabf7feef99.js` | `globalThis.pb2LaunchPlaytestWire(e)` |
| `scripts/screens/Menu.js` | `gamelogic/8b10fb1963eaebeb.js` | `$lоНеel.playtest&&setTimeout` |
| `scripts/screens/MPLobby.js` | `gamelogic/71c7e8f360dea371.js` | `PB2ConnectLobbyAuth` |
| `scripts/screens/MPCreateMatch.js` | `gamelogic/cf16016767e6b8be.js` | `$lАМ0ОА(),globalThis.$НеooI[$ееIoA]=!1` |
| `scripts/screens/MPLogs.js` | `gamelogic/a13095f99d266567.js` | |
| `scripts/connection.js` | `gamelogic/782347948dd26491.js` | `$рсНAе.$pIМo1="\|"` |
| `scripts/libs/flash.js` | `gamelogic/57221ca6425ecb64.js` | `class $ММ{` |
| `scripts/frame1.js` | `gamelogic/1d5f065218b58cde.js` | |
| `scripts/actions.js` | `gamelogic/a92ae60cb705333a.js` | |
| `scripts/frame2.js` | `gamelogic/8c699c159547a19b.js` | `function $pМоcT(){` |
| `scripts/frame17.js` | `gamelogic/fcfc2a6ca3b15e1b.js` | |
| `scripts/frame18.js` | `gamelogic/1a7b3df3b30f7591.js` | `function StartGame(){for($рАIpН=!0` |
| `scripts/main.js` | `gamelogic/21894acaaf879a10.js` | `window.onload=()=>{window.onload=null,$HHOеоH()}` |
| (Sad Burst only) | `gamelogic/2bec0e3852dc7aa6.js` | `PB2ClientVersionField`: lobby nodes, regions, login |
| (Sad Burst only) | `gamelogic/c7e7645bbc5ff924.js` | `globalThis.pb2LaunchPlaytestWire=r`: playtest maps |
| (Sad Burst only) | `gamelogic/c48968230fd70750.js` | `sanitizeCampaignSkinVarsOutsideCampaign` |
| (Sad Burst only) | `gamelogic/68206bdf3a0fbb29.js`, `gamelogic/74cb81bee9b225d7.js` | `__pb2DevProxyInstalled`, `__pb2FlashExportCdnInstalled`: `fetch` and `<img src>` rewriters |

### 2.2 Names

The obfuscated names are the official ones, so the name map of [anticheat.md §2](anticheat.md#2-name-map-obfuscated--readable) applies name for name. So do the string constants, with four exceptions, which are emptied in both Sad Burst strings files: `$МНрОH` (the error report URL, [§9](#9-error-reporting-is-removed)), `$0o1О` (`mrate.php`), `$HТoM` (`mscreenshot.php`) and `$o0о0` (`exp.php`).

Scoping is the same as well. A parser walk over every script of both clients finds the same kinds of top-level declarations (`var`, `function`, `let`, `const`, `class`) for every shared name, and the same block-scoped state. The loader runs each file as a classic inline `<script>` ([§3](#3-how-the-code-gets-into-the-page)), so a top-level `var` or `function` is a property of `window` here too. Every flag that [anticheat.md §9](anticheat.md#9-how-it-was-bypassed) relies on is a writable global in both clients.

### 2.3 Names only Sad Burst has

| Name | File | What |
|---|---|---|
| `globalThis.PB2_CLIENT_BUILD` | loader | `{ version, hash, bytes }`: the build hash ([§12](#12-the-client-build-hash)) |
| `globalThis.PB2ClientVersionField`, `PB2ConnectLobbyAuth`, `PB2HandleMatchRedirect`, `PB2AuthFailMessage`, `PB2LeaveMultiplayer`, `PB2ActivateLobbyConnection` | `2bec0e3852dc7aa6.js`, `782347948dd26491.js` | Lobby and region connections ([§13.3](#133-connections-lobby-nodes-and-region-servers)) |
| `globalThis.PB2_LOBBY_CONN`, `PB2_REGION_CONN` | `2bec0e3852dc7aa6.js` | The logged-in connections |
| `globalThis.pb2LaunchPlaytestWire`, `pb2TryPlaytestFromHash` | `c7e7645bbc5ff924.js` | Plays a map from text or from `#playtest=<id>`; sets the custom-map flag ([§11.2](#112-a-new-way-to-set-the-custom-map-flag)) |
| `globalThis.$хATTAMM` | `8c699c159547a19b.js` | The ping limit, enforced on the client ([§13.5](#135-the-ping-limit-is-enforced-on-the-client)) |
| `window.fetch` (wrapper), `pb2RewriteOfficialApi`, `HTMLImageElement.prototype.src` setter | `68206bdf3a0fbb29.js`, `74cb81bee9b225d7.js` | Rewrite official-site URLs to `PB2_API_PROXY_ORIGIN` (default `https://sadburst2.com`) and `flash_export/` to `PB2_FLASH_EXPORT_CDN` |
| `$ММ.$рОеAо.__pb2LobbyPatched` | `2bec0e3852dc7aa6.js` | Leaving a match returns to the lobby instead of closing the connection |
| `JSON.strіngіfy`, `JSON.pаrsе` (Cyrillic `і`, `а`, `е`) | `57221ca6425ecb64.js` | Not new: the official `libs/flash.js:7520`, `7534` has them too. The first returns the saved device id (`first_uid`), whatever it is given; the second records `first_login` / `first_login_proof` |

### 2.4 Making the code readable

```bash
# string constants filled in (prints to stdout)
npm run find-names -- --sadburst --decode gamelogic/8c699c159547a19b.js
# indented: esbuild re-prints minified code; --charset=utf8 keeps the look-alike letters
node_modules/.bin/esbuild --loader=js --charset=utf8 < game.sadburst/gamelogic/8c699c159547a19b.js > /tmp/frame2.js
```

The decoder prints string values in place, which can break the syntax inside template literals, so for an indented copy format the raw file and look the strings up separately ([anticheat.md §2](anticheat.md#2-name-map-obfuscated--readable) shows how; use `gamelogic/09094c58e1872195.js` as the strings file).

---

## 3. How the code gets into the page

The official `index.html` lists the scripts as `<script src>` tags, so the browser loads them before the page's `load` event. Sad Burst's game page (`sadburst2.com/gameplay/`) has one module script, `assets/index-<hash>.js` (Vite + Vue), which:

1. shows its entry screen (log in with a Sad Burst account, play as a guest, or a remembered session),
2. fetches `asset-version.txt` and `gamelogic/scripts-manifest.json` (`no-store`),
3. fetches the strings file of the chosen language and every script of the manifest's `order`, in parallel, each with `?v=<build>` appended,
4. hashes them ([§12](#12-the-client-build-hash)), **before any of them runs**,
5. runs them in manifest order (`Pc`, `Nc` in the loader):

```js
function runScript(index, code) {                           // Pc
  const s = document.createElement('script');
  s.textContent = `${code}\n//# sourceURL=${randomName(index)}`;   // Nc: 9 random, index, 11 random, ".js"
  document.body.appendChild(s);
}
```

Consequences:

- **Script identity is the manifest, not the URL.** DevTools shows the scripts under random names, new on every page load, so a breakpoint set by file name does not survive a reload. Map them back by content (the anchors in [§2.1](#21-files)) or by the number between the two random parts of the name: `0` is the strings file, `1` the first file of `order`, and so on.
- **The code that runs is the code that was hashed**, at the moment it is injected. Nothing checks it afterwards ([§12.5](#125-phase-4-running-the-scripts-pc-nc)).
- **`loaderInfo` comes from the loader**, not from cookies: `globalThis.loaderInfo = { parameters: { l: "", p: "" }, url: location.href }` (`1378664311d41f5c.js`), filled with the login and password or session token from the entry screen. The official `flash.js:10–16` reads the `login` and `password` cookies.

---

## 4. Layer A: Per-Tick Value Guard (`$pМоcT`)

**Same as [anticheat.md §3](anticheat.md#3-layer-a-per-tick-value-guard-pмоct).** In `gamelogic/8c699c159547a19b.js` (official `frame2.js`), the bodies of `$pМоcT`, `$oеeес`, `$cАрlHc`, `$TIМope`, `$pcМТlс`, `$1МOpАс` and `$O0рo1I` are the official ones, minified:

- the same 84 slots in the same order, then one gun checksum per gun (`$cАрlHc(<value>, $++)`, diffed slot by slot),
- the same early exits: `currentFrame !== 18 || $0Ме1А.length === 0`, then the grace flag `$рАIpН` (read through the `$рeOTМ` getter), then `!$pMМ1 || $еHоНH`,
- the same encoding (`v * (1.223 + sin(i * 0.775)) + i * 31.101`; strings interleaved with digits from `$TolHМA`),
- the same comparison rules, including the 0.01 tolerance and the ±10000 free zone.

```js
function $pМоcT() {                                                        // anchor: function $pМоcT(){
  if (!(currentFrame !== 18 || $0Ме1А.length === 0)) {
    if ($рeOTМ.$рАIpН === $рАIpН || $рАIpН) { $рАIpН = false; return; }
    if (!(!$pMМ1 || $еHоНH)) {
      var i = 0;
      $cАрlHc($OН1оc, i++), /* … 84 slots … */
      $cАрlHc($ММ.match_details ? $ММ.match_details.netcode : 0, i++);
      for (let g = 0; g < $cс0Hс; g++) $cАрlHc($O0рo1I(g), i++);
    }
  }
}
```

### 4.1 Entry points

Both clients call `$pМоcT` 15 times and `$oеeес` 16 times, in the same functions. Nothing is missing and nothing is new. The official column gives each check with its matching snapshot.

| Entry point | Official (check → snapshot) | Sad Burst file | Anchor at the check |
|---|---|---|---|
| Timer runner (`stage.addEventListener(ENTER_FRAME)`) | `frame2.js:42108` → `42140` | `8c699c159547a19b.js` | `AME,()=>{$pМоcT` |
| Input / game tick `$cHIIH` | `frame2.js:38280` → `42103` | `8c699c159547a19b.js` | `cHIIH($){$pМоcT` |
| Network tick `$ММ.$AОAcc` (skipped when `$ММ.$T0еcр`) | `libs/flash.js:393` → `415` | `57221ca6425ecb64.js` | `.$T0еcр\|\|$pМоcT` |
| Delayed tick `$МOpТI1` | `frame2.js:23573` → `23577` | `8c699c159547a19b.js` | `nction(){$pМоcT` |
| `$M10eAо` | `frame2.js:26127` → `27614`, `27619` | `8c699c159547a19b.js` | `OPEN){if($pМоcT` |
| `$ТeMeI` | `frame2.js:27627` → `27715` | `8c699c159547a19b.js` | `eI($){if($pМоcT` |
| `$АННMОo` | `frame2.js:27770` → `27836` | `8c699c159547a19b.js` | `R_OPEN\|\|($pМоcT` |
| `$1ТoОH` | `frame2.js:27846` → `28104` | `8c699c159547a19b.js` | `ble)){if($pМоcT` |
| Loading screen | `frame17.js:33` → `37` | `fcfc2a6ca3b15e1b.js` | `out(()=>{$pМоcT` |
| Esc menu exit click | `frame18.js:444` → `482` | `1a7b3df3b30f7591.js` | `$pМоcT(),$Аоео0($АААеI),$pMМ1&` |
| Esc menu restart click | `frame18.js:1006` → `1044` | `1a7b3df3b30f7591.js` | `$pМоcT(),$Аоео0($АААеI),$pMМ1?` |
| Quicksave | `quicksave.js:218` → `273` | `f560a5ecb7aea6ec.js` | `out(()=>{$pМоcT` |
| Quickload | `quicksave.js:307` → `512` | `f560a5ecb7aea6ec.js` | `t e=null;$pМоcT` |
| Spritesheet callback | `spritesheets.js:969` → `992` | `19e847576880ee8f.js` | `TA>=60&&($pМоcT` |
| Name prompt | `screens/NamePrompt.js:40` → `44` | `41749539d442b628.js` | `out(()=>{$pМоcT` |

### 4.2 What is different around it

- **The network tick can run twice per frame.** Sad Burst's main loop (`21894acaaf879a10.js`) calls `$ММ.$AОAcc` from its own network timer and again from the logic step (anchor `$ММ.$AОAcc($),$сMlcА1()`). Both go through the same check/snapshot pair, so the guard only runs more often.
- **The spectator free camera** (key `0` while spectating, anchor `$specFreeCam=!$specFreeCam`) moves the camera (`game.x` / `game.y`) from inside `$cHIIH`, between its check and its snapshot, so it never trips the guard.
- **Campaign skins are cleaned outside the guard.** `sanitizeCampaignSkinVarsOutsideCampaign()` (`c48968230fd70750.js`, anchor `($рHоеН[0]=40)`) runs on joining a match and at `StartGame` when `$pMМ1`. It writes `$рHоеН[0]` and `[1]`, a locked array ([§8](#8-layer-e-locked-array-snapshots)), not a guarded slot.
- **One join-time value differs.** On `MATCH_JOIN_RESPONSE` the official client sets `$АoМHl = match_details.netcode > 1`; Sad Burst sets `$АoМHl = false`. `$АoМHl` is one of the guarded slots and is snapshotted after the join, so this changes behavior, not detection.

---

## 5. Layer B: The Punishment (`$MеOHОe`)

**Same as [anticheat.md §4](anticheat.md#4-layer-b-the-punishment-mеohоe).**

```js
function $MеOHОe() {                                             // anchor: function $MеOHОe(){
  let parts = ["2t", "3a", "2p", "30"], name = "";
  globalThis.$еl1НсI();                                          // turn off error reporting
  for (let i = 0; i < parts.length; i++) name += String.fromCharCode(parseInt(parts[i], 36));   // "eval"
  globalThis[name](`globalThis.f=${$eeОMеО.toString()}`), stage.addEventListener(Event.ENTER_FRAME, globalThis.f);
}
```

The payload `$eeОMеО` is unchanged: random corruption of every global array at a rate that grows ×1.1 per frame, then `[...Array(2 ** 32 - 1)]` after 100 ms.

The only difference is in step 1: `$еl1НсI()` turns off an error reporter that, in Sad Burst, sends nothing anyway ([§9](#9-error-reporting-is-removed)). In both clients the server learns nothing from a punishment.

---

## 6. Layer C: Console / Stack Detection

**Same as [anticheat.md §5](anticheat.md#5-layer-c-console--stack-detection).** Every marker piece (`"at <ano"+"nym"+"ous>:"` and the other splits) has the same value in the official `_strings.js` and both Sad Burst strings files.

| Where | Condition | Reaction | Sad Burst anchor |
|---|---|---|---|
| `$рeOTМ.$рАIpН` getter (read in every `$pМоcT`) | `$IHТcc && $pMМ1 && !$еHоНH` | punish | `setGetterSetter($рeOTМ,"$рАIpН",()=>{if(!(!$pMМ1\|\|$еHоНH))` (`8c699c159547a19b.js`) |
| Game timer `$рOcT0o` | `$IHТcc && $pMМ1` | punish | `function $рOcT0o($,l){$IHТcc&&$pMМ1&&` (same file) |
| Game timer `$ТMО1e` | `$IHТcc && $pMМ1` | punish | `function $ТMО1e($,l){$IHТcc&&$pMМ1&&` (same file) |
| `$oITOo`, `$T0OMое`, `$oIeeol` (array lock) | always | `location.reload()` | `globalThis.$oITOo=()=>{i\|\|(new Error().stack` (`b55097df4cefc728.js`) |
| `$eМlee` | never called | (reload) | `function $eМlee(){new Error().stack` (`f6e6b47a3f981d15.js`) |

`$eМlee` exists in both clients and is not in the official document's table: it has a stack check, but nothing calls it. It is only passed as a marker to `$IeTlO(array, $eМlee)` ([§8](#8-layer-e-locked-array-snapshots)).

**The random `sourceURL`s do not change what is caught.** The game's own frames carry their random file name, never `<anonymous>`. Only code typed in the DevTools console or run through `eval` without a `sourceURL` produces an `at <anonymous>:` frame, as in the official client.

---

## 7. Layer D: Function & Array Integrity Scan

**Same code as [anticheat.md §6](anticheat.md#6-layer-d-function--array-integrity-scan-mainjs)**, in `gamelogic/21894acaaf879a10.js` (official `main.js:902–1142`):

- the same setup `$HHOеоH` on `window.onload` (anchor `window.onload=()=>{window.onload=null,$HHOеоH()}`): every non-native function on `globalThis` and `$ММ`, plus the same 23 array identities registered with `$HpolеМ`, in the same order;
- the same tick `$сMlcА1`, called once per logic step (anchor `$ММ.$AОAcc($),$сMlcА1()`): 300 ms slices, round robin, at most about 1 ms of work;
- the same failures: code 1 (array variable replaced), code 2 (a function's `toString()` changed; detail `index/old 50 chars/new 50 chars`), code 3 (locked array changed; detail `$eOMАер()`);
- the same report and reaction (anchor `$ММ.$ceTOI.$OMeTо($ММ.$МеoрО,[$ММ[$еIНpА],void 0,$еМ0MOО,$еeМoel])`), then `$1eoAНl = Infinity` and `location.reload()` 300 ms later;
- the same canary: `$МОеIe !== "/PB2HTML5/"` → punish and reload.

### 7.1 Run condition

```js
let encoded = "";
try { encoded = btoa(login); } catch { encoded = ""; }          // anchor: try{o=globalThis[$oО0HНН]($Oeо0)}catch($){o=$0OрТ}
if (encoded !== "RXJpYyBHdXJ0" /* "Eric Gurt" */ && location.href.indexOf("/h5/") !== -1) devBypass = true;
if ((isCompiled || devBypass) && (isCompiled || isMultiplayer)) { /* scan */ }
```

- `isCompiled` is true on `sadburst2.com/gameplay/` (the URL has no `/game/`), so **the scan runs in every mode**, single-player and campaign included, as in the official client under its real URL.
- **Difference:** the official `main.js:945` calls `btoa(login)` bare. A login with a character above U+00FF makes it throw there, and the scan tick ends for that frame. Sad Burst catches it and compares `""`, which turns the `/h5/` branch on. Sad Burst ships a Chinese locale, so such logins are plausible. On `sadburst2.com` the branch does not matter, since `isCompiled` alone runs the scan.

### 7.2 What the baseline contains

Setup saves the source of every non-native function on `globalThis` and `$ММ`. Sad Burst adds globals the official client does not have ([§2.3](#23-names-only-sad-burst-has)), and they enter that baseline:

| Global | Effect |
|---|---|
| `window.fetch` | A wrapper (`68206bdf3a0fbb29.js`, then `74cb81bee9b225d7.js`). In the official client `fetch` is native and skipped (`[native code]`). Here **replacing `window.fetch` after load is a code 2 failure** |
| `PB2ConnectLobbyAuth`, `PB2ClientVersionField`, `PB2AuthFailMessage`, `PB2HandleMatchRedirect`, `PB2LeaveMultiplayer`, `pb2RewriteOfficialApi`, `pb2LaunchPlaytestWire`, `$хATTAMM`, … | Watched the same way: replacing one is a code 2 failure |
| `PB2_CLIENT_BUILD`, `PB2_LOBBY_CONN`, `PB2_REGION_CONN` | Objects, not functions: not watched. So the build hash can be rewritten without tripping the scan |
| `HTMLImageElement.prototype.src` setter, `$ММ.$рОеAо` (replaced, [§13.3](#133-connections-lobby-nodes-and-region-servers)) | On a prototype, or a non-enumerable static method: not walked |

### 7.3 Where the report goes

To `$ММ.$ceTOI`, which in Sad Burst is the **region server** during a match and the lobby node otherwise ([§13.3](#133-connections-lobby-nodes-and-region-servers)). In single-player, before any connection, nothing is sent and the page only reloads, as in the official client.

### 7.4 The start-up re-eval

The same file evaluates `"//# sourceURL=" + script.src` for every `document.scripts[i]` unless the URL contains `:8383/PB2HTML5/game/` (official `main.js:1144–1177`). In the official client it creates a fake source entry per real file name in the debugger. Here every game script is inline (`src` is `""`), so it evaluates empty `sourceURL` comments, and one for the loader. It has no effect on play.

---

## 8. Layer E: Locked Array Snapshots

**Same code as [anticheat.md §7](anticheat.md#7-layer-e-locked-array-snapshots-toolsjs)**, in `gamelogic/b55097df4cefc728.js`:

- The same 23 arrays are registered with `$IeTlO(array, $eМlee)` in `8c699c159547a19b.js`, in the same order: the unlock counter `$рHоеН`, the four `skin_color_*`, the wall, pusher and water arrays. `f6e6b47a3f981d15.js` adds the same four gun-script registrations.
- Lock, unlock, accept-one-index and compare-next (`$oIeeol`, `$oITOo`, `$T0OMое`, `$ррОM1I`) have the same logic, with the same stack checks.
- The list itself is block-scoped in **both** clients: a `{ … }` block holds `let $pAТAMI = []` in the official `tools.js:41–244`; Sad Burst holds `n = []` (anchor `n=[],o=new Map,i=!0,c=0;`). Indirect `eval` cannot reach it in either. `data/names.sadburst.js` leaves `lockedArrays` out for this reason. The official `data/names.js` names `$pAТAMI`, but at run time the global reader finds nothing under that name.

**When a change is caught** is the same as [anticheat.md §7.1](anticheat.md#71-when-the-baseline-is-taken-again): only when the scan compares that array before the next unlock/lock pair. Every trigger run still ends with `$oITOo()`, and `$oеeес` still starts with `$oIeeol()`.

**New: a write without unlocking.** `sanitizeCampaignSkinVarsOutsideCampaign()` (`c48968230fd70750.js`) sets `$рHоеН[0] = 40` and `$рHоеН[1] = 60` when they point at a local campaign skin, on joining a match and at `StartGame` in multiplayer. It does not call `$oITOo()` or `$T0OMое()` first, so when the scan compares `$рHоеН` before the next unlock, it is a code 3 failure for an honest player. Read from the code; how often it happens depends on the map's trigger activity ([anticheat.md §7.1](anticheat.md#71-when-the-baseline-is-taken-again)).

**One small difference in the same file.** The `Object.prototype.toString` debug override (official `tools.js:384–404`, not anti-cheat) reads `$ММ.$T0еcр`. The official code throws a `ReferenceError` when an object is turned into a string before `$ММ` exists; Sad Burst checks `typeof $ММ != "undefined"` first (anchor `if(typeof $ММ!="undefined"&&$ММ.$T0еcр)`).

---

## 9. Error Reporting Is Removed

The official reporter (`libs/errors.js:77–132`) builds a report and POSTs it to `/h5/index.php?action=report_error`. Sad Burst's `gamelogic/1c875a40b1fa8ffe.js` keeps the same file, in the same manifest position, with the same wiring:

- `window.onerror`, `ReportCaughtError` and the performance report `$lНеА1M` still call the reporter,
- the reporter still counts down from 4, skips `localhost`, and builds the payload,
- the kill switch `$еl1НсI` still sets its flag to `false` (anchor `globalThis.$еl1НсI=()=>{i=!1}`).

But the reporter ends after building the payload (anchor `s&&(t.message+=$ОMpTо+s)},i=!0;`). The file contains no `fetch`, and the URL constant is empty in both strings files (anchor `e.$МНрОH=""`). **No error, crash or performance report leaves the client.**

Effects:
- The kill switch [anticheat.md §9.15](anticheat.md#915-the-error-reporting-kill-switch-еl1нсi) has nothing left to turn off.
- An edit that makes the game throw leaves no trace on any server.
- Of the official client's two channels to a server (error reports, scan reports), Sad Burst keeps only the scan report ([§7.3](#73-where-the-report-goes)).

The `postMessage` listener in the same file is unchanged ([§11.1](#111-the-official-bypasses)).

---

## 10. When It Triggers (cheat sheet)

The **value guard** (layer A) crashes the tab when **all** of these are true. Identical to the official client:

- [x] `currentFrame === 18` (in a match) and characters exist
- [x] `isMultiplayer` (`$pMМ1`) is true
- [x] `isCustomMapSession` (`$еHоНH`) is false
- [x] the grace flag `$рАIpН` is false
- [x] a guarded value differs from the snapshot by ≥ 0.01, and it is not a case where both old and new values are above 10000 (or both below -10000)

It also crashes when, in an **approved** multiplayer match:

- [x] the check or a game timer is called from code with `at <anonymous>:` in its stack
- [x] a guarded value changes **type** to something NaN-like

**Reload + report** (layers D/E), in every mode, since `isCompiled` is true on `sadburst2.com`:

- [x] any non-native global function's `toString()` changed, including Sad Burst's own (`window.fetch`, the `PB2*` functions)
- [x] a registered array was replaced, or its contents changed while locked (including by `sanitizeCampaignSkinVarsOutsideCampaign`, [§8](#8-layer-e-locked-array-snapshots))
- [x] the `$МОеIe` canary changed (also crashes)

**Reload, no report:**

- [x] `$oITOo`, `$T0OMое` or `$oIeeol` called from code with `at <anonymous>:` in its stack (for example, typed in the DevTools console)

**Never, in Sad Burst:**

- [ ] an error report (the reporter sends nothing, [§9](#9-error-reporting-is-removed))

**What a server can see:** the build hash at each login ([§12](#12-the-client-build-hash)), and whatever its own checks find in the state the client sends ([§14](#14-server-side-checks-the-shipped-server-code)).

---

## 11. Bypasses: What Still Applies

### 11.1 The official bypasses

| [anticheat.md §9](anticheat.md#9-how-it-was-bypassed) | In Sad Burst | Why |
|---|---|---|
| 9.1 Gameplay-frame gate | Applies | Same early exit |
| 9.2 The multiplayer flag | Applies | `$pMМ1` is a writable `var`, written in the same places (`libs/flash.js:3357` → anchor `$00pеH=t[$OlHМН],$pMМ1=!0,` in `57221ca6425ecb64.js`) |
| 9.3 The sticky custom-map flag | Applies | Joining a match still does not reset `$еHоНH`. The only reset is still the campaign screen (anchor `stage.focus=stage,$еHоНH=!1,$pMМ1=!1`) |
| 9.4 `postMessage` sets the custom-map flag | Applies | Same listener, still no `event.origin` or `event.source` check (anchor `o[0]===$pсеТ&&(o[2]===$Н1pо?($еHоНH=!0` in `1c875a40b1fa8ffe.js`) |
| 9.5 The grace flag | Applies | Same `var $рАIpН`; `StartGame` still sets it (anchor `function StartGame(){for($рАIpН=!0`) |
| 9.6 Re-baselining the snapshot | Applies | `$oеeес` is a global function |
| 9.7 The 0.01 tolerance | Applies | Same comparison |
| 9.8 The ±10000 free zone | Applies | Same comparison |
| 9.9 The stack check | Applies | Same marker |
| 9.10 The type check | Applies | Same comparison |
| 9.11 The function integrity scan | Applies | Same `toString()` comparison; Sad Burst's own function globals are in the baseline too ([§7.2](#72-what-the-baseline-contains)) |
| 9.12 Locked arrays | Applies | Same lock/unlock cycle |
| 9.13 The string canary | Applies | Same canary |
| 9.14 Replacing the guard or the punishment | Applies | Same globals; replacing them is what code 2 watches, as in the official client |
| 9.15 The error-reporting kill switch | **Not needed** | Nothing is reported ([§9](#9-error-reporting-is-removed)) |
| 9.16 Coverage gaps | Applies | Same 84 slots |
| 9.17 The reaction teaches the cheater | Applies | Same instant crash |
| 9.18 Proof of concept: a wall you can walk through | Applies | Same arrays, same timing |

### 11.2 A new way to set the custom-map flag

`gamelogic/c7e7645bbc5ff924.js` adds playtest maps:

```js
const launch = (text) => {                                       // anchor: globalThis.pb2LaunchPlaytestWire=r
  const map = normalize(text.trim());
  if (!map.length) return false;
  $poToНA["Map Import"] = map; $рTТА = "Map Import";
  $еHоНH = true;                                                 // isCustomMapSession
  gotoAndStop("difch");
  return true;
};
globalThis.pb2LaunchPlaytestWire = launch;
globalThis.pb2TryPlaytestFromHash = async () => { /* fetch("api/playtest-map/" + id) → launch(text) */ };
```

It is called from the new "Import" button of the Custom Map screen and from the main menu on `#playtest=<id>`. Like `#map=`, it sets the sticky custom-map flag, and nothing resets it when joining a match. It is also a public global, so `pb2LaunchPlaytestWire("<map>")` turns the value guard off for the rest of the tab, as [anticheat.md §9.3](anticheat.md#93-the-sticky-custom-map-flag-iscustommapsession--еhонh) describes for `#map=`.

---

## 12. The Client Build Hash

> The official client has nothing like this: its `AUTHENTICATE` carries the literal `"version_h5"`.
>
> **Names:** the loader (`assets/index-Bq64YSI5.js`) is Vite output, so its functions are minified to two letters (`Tc`, `zc`, `Ac`, ...). Those letters change on every rebuild. The anchors in the right-hand column of 12.1 survive a rebuild. The code below is de-minified by hand: identifiers renamed, behavior unchanged, with the minified name in a comment.

### 12.1 Summary

Once per page load, after the player picks "log in" or "guest" on the entry screen, the page's loader downloads every game script listed in `gamelogic/scripts-manifest.json`, concatenates their raw bytes in a fixed order, and computes a **SHA-256** over them with WebCrypto. It stores `{ version, hash, bytes }` in `globalThis.PB2_CLIENT_BUILD`, **then** runs the scripts. Every later login, to a lobby node or to a region node, sends that triple in the version field of `RELIABLE_AUTHENTICATE`:

```
version_h5/<client version>/<sha256, 64 hex chars>/<total bytes hashed>
version_h5/1.23/d43a92d54cdedf74941d422410256cc95177020f5ae03c50391e5252966871c9/1866990
```

The server answers `["ok", <user JSON>, <extra>]` or `["fail", <reason>]`. A reason of `"badversion"` is shown as `GAME VERSION MISMATCH. RESTART GAME OR DOWNLOAD NEW GAME VERSION FROM WEBSITE`. What the server does with the hash beyond that is server-side and not in the client.

| Step | Where (build `20261030020533`) | Minified name | Anchor |
|---|---|---|---|
| Entry screen → load | `assets/index-Bq64YSI5.js` | `Uc(login, password)` | `await Tc(),await Promise.all([` |
| Build id and client version | same | `Tc()`, globals `bc`, `xc` | `` `asset-version.txt`,{cache:`no-store`} `` |
| Cache-busting URL | same | `wc(url)`, `Cc(url)` | `` ?v=${encodeURIComponent( `` |
| Manifest | same | `Dc()`, `Ec()` | `` `scripts manifest` `` |
| Download | same | `zc(lang, login, password)`, `kc(url)` | `` {cache:`default`} `` |
| Hash input order | same | `_c(manifest)` | `e.strings.zh\|\|t` |
| Hash | same | `Ac(manifest, bytesByPath)`, `yc(buffers)`, `vc(digest)` | `` crypto.subtle.digest(`SHA-256` `` |
| Run the scripts | same | `Pc(index, code)`, `Nc(index)` | `` //# sourceURL= `` |
| Version field | `gamelogic/2bec0e3852dc7aa6.js` | `D()` = `globalThis.PB2ClientVersionField` | `PB2ClientVersionField` |
| Login message | same | `H(connection, done, kind)` | `RELIABLE_AUTHENTICATE` |
| Lobby node loop | same | `y(done)`, `ee(url, generation, done)` | `Connecting to lobby node ` |
| Region login | same | `ie(url, done)` | `Connecting to region ` |
| Failure text | same | `m(reason)` = `globalThis.PB2AuthFailMessage` | `badversion` |
| Fallback login path | `gamelogic/71c7e8f360dea371.js` (`MPLobby`) | — | `PB2ClientVersionField=="function"` |
| Server-side handler (shipped) | `gamelogic/57221ca6425ecb64.js` (`$ММ.$c0рlc`) | `$с0A.$ITTНрl(...)` (`authLogin`) | `Refresh page to get new version of the game` |

### 12.2 Phase 1: build id and client version (`Tc`)

```js
let assetBuild = '';          // bc: build id, used for ?v= cache busting
let clientVersion = '';       // xc: the version reported to the lobby

async function loadAssetVersion() {                       // Tc
  if (assetBuild) return assetBuild;
  try {
    const res = await fetch('asset-version.txt', { cache: 'no-store' });
    if (res.ok) {
      const lines = String(await res.text() || '').trim().split(/\r?\n/);
      if (lines[0]?.trim()) assetBuild = lines[0].trim();  // "20261030020533"
      clientVersion = lines[1]?.trim() || '';               // "1.23"
    }
  } catch {}
  assetBuild ||= String(Date.now());                       // no file: a fresh value per load
  globalThis.PB2_ASSET_VERSION = assetBuild;
  return assetBuild;
}
const stripQuery = (u) => String(u || '').split('?')[0] || '';                       // Cc
const withBuild = (u) => stripQuery(u) && `${stripQuery(u)}?v=${encodeURIComponent(assetBuild || '0')}`;  // wc
```

- `asset-version.txt` is two lines: the build id (`20261030020533`) and the client version (`1.23`). Only line 2 goes into the version field. Line 1 only busts caches.
- If the file cannot be read, `clientVersion` stays `""` and the field becomes `version_h5//<hash>/<bytes>`.
- `Uc` (the entry point) calls `Tc` first, then loads `loading_screen.css` and `mobileControls.css` and the fonts, then calls `zc(lang, login, password)`. `Uc` has a re-entry guard (`Bc`): one load per page.

### 12.3 Phase 2: download (`Dc`, `zc`, `kc`)

```js
async function loadManifest() {                                                      // Dc
  const res = await fetch(withBuild('gamelogic/scripts-manifest.json'), { cache: 'no-store' });
  if (!res.ok) throw Error('Failed to load gamelogic/scripts-manifest.json');
  const m = await res.json();
  if (!m || !Array.isArray(m.order) || !m.strings?.en) throw Error('Invalid scripts manifest');   // Ec
  return m;
}

async function fetchScript(url) {                                                    // kc
  const res = await fetch(url, { cache: 'default' });
  if (!res.ok) throw Error(`Failed to load ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { url, code: new TextDecoder('utf-8').decode(bytes), bytes };
}

async function loadGame(lang, login, password) {                                     // zc
  const info = loaderInfo();                                                         // Fc
  info.parameters.l = login || ''; info.parameters.p = password || '';
  globalThis.PB2_CAMPAIGN_MAP_BASE = 'gamelogic/campaign/';
  const manifest = await loadManifest();
  const strings = manifest.strings[lang] || manifest.strings.en;
  if (!strings) throw Error('Missing strings entry');
  const urls = [strings, ...manifest.order].map(withBuild);
  const flash = manifest.flash ? stripQuery(manifest.flash) : '';
  const fetched = await Promise.all(urls.map((u) => fetchScript(u)));   // parallel, progress bar per file
  const bytesByPath = new Map(fetched.map((f) => [stripQuery(f.url), f.bytes]));
  await hashBuild(manifest, bytesByPath);                               // Ac: BEFORE any script runs
  for (let i = 0; i < fetched.length; i++) {
    runScript(i, fetched[i].code);                                      // Pc
    if (sameFile(fetched[i].url, flash)) { /* re-apply loaderInfo l/p after flash.js reset it */ }
  }
  return manifest;
}
```

- `login` / `password` come from the entry screen. Account login: the site's login form (`ol(login, password)` → session token), then `T(login, password)`. Remembered session: `T(login, game_token)`. Guest: `T('', '')`. They reach the lobby through `loaderInfo.parameters.l` / `.p` (12.6).
- Scripts are fetched with `cache: 'default'`, so the browser HTTP cache serves repeats. The `?v=<build>` suffix makes a new build a new URL. The manifest itself is `no-store`.
- `bytes` are the response body **after** HTTP content decoding (gzip/brotli removed), so the hash is over the files as stored, not over the wire encoding.

### 12.4 Phase 3: the hash (`_c`, `Ac`, `yc`, `vc`)

```js
const hashOrder = (m) => {                                                           // _c
  const en = m.strings.en;
  return [en, m.strings.zh || en, ...m.order];
};
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');  // vc

async function sha256Concat(parts) {                                                 // yc
  if (!globalThis.crypto?.subtle) return null;          // not a secure context: no hash at all
  let total = 0;
  for (const p of parts) total += p.length;
  const all = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.length; }
  return { hash: toHex(await crypto.subtle.digest('SHA-256', all)), bytes: total };
}

async function hashBuild(manifest, bytesByPath) {                                    // Ac
  globalThis.PB2_CLIENT_BUILD = undefined;
  const parts = [];
  for (const path of hashOrder(manifest)) {
    let b = bytesByPath.get(path);
    if (!b) b = (await fetchScript(withBuild(path))).bytes;   // e.g. the other language's strings
    parts.push(b);
  }
  const r = await sha256Concat(parts);
  if (r) globalThis.PB2_CLIENT_BUILD = { version: clientVersion, ...r };
}
```

**The input, exactly:**

```
SHA-256( bytes(strings.en) ‖ bytes(strings.zh ?? strings.en) ‖ bytes(order[0]) ‖ … ‖ bytes(order[n-1]) )
```

- **Concatenation without separators or lengths**, in that fixed order. The order is the manifest's, so a manifest that lists the same files in another order is another hash.
- **Both languages, always.** Only the chosen language's strings file is fetched for running. `Ac` fetches the other one now (`bytesByPath` misses it), so the hash is the same whatever the language. A build without `zh` hashes `en` twice.
- **`bytes`** is the total length hashed (`1866990` for this build: 54 files, `en` + `zh` + 52 in `order`). It is reported next to the hash, so the server can tell a truncated download from a modified one before comparing digests.
- **Not covered:** `index.html`, `assets/*` (the loader itself, the Vue shell), `asset-version.txt`, the manifest, CSS, fonts, and everything under `flash_export/` (images, sounds, and the sprite sheet `.js` files, which are fetched and parsed as data, not run). So a change to the loader, or to anything it runs that is not in the manifest, does not change the hash.
- **No hash at all** when `crypto.subtle` is missing (an insecure context: `http:` other than `localhost`). `PB2_CLIENT_BUILD` then stays `undefined` and the field falls back to the plain `"version_h5"` (12.6).
- **Computed before the code runs.** `Ac` finishes before the first `Pc`, so no game code can influence the computation.

**Reproducing it** for a copy on disk (`game.sadburst/`):

```bash
node -e '
const fs = require("fs"), crypto = require("crypto");
const m = JSON.parse(fs.readFileSync("game.sadburst/gamelogic/scripts-manifest.json"));
const files = [m.strings.en, m.strings.zh || m.strings.en, ...m.order];
const all = Buffer.concat(files.map((f) => fs.readFileSync("game.sadburst/" + f)));
const version = fs.readFileSync("game.sadburst/asset-version.txt", "utf8").trim().split(/\r?\n/)[1] || "";
console.log(`version_h5/${version}/${crypto.createHash("sha256").update(all).digest("hex")}/${all.length}`);'
```

`npm run sadburst` serves these files byte for byte, so this is the value its logins carry. If it differs from what the site's own page computes, the copy is out of date: at start the app reads the site's `asset-version.txt` and warns when its build id differs from `game.sadburst/` (`checkSadburstBuild`, `src/wrapper/platform/game-files.ts`).

### 12.5 Phase 4: running the scripts (`Pc`, `Nc`)

```js
const names = new Map();
function randomName(index) {                                                         // Nc
  if (names.has(index)) return names.get(index);
  const pick = () => ALPHANUM[Math.random() * 62 | 0];
  const name = `${Array.from({ length: 9 }, pick).join('')}${index}${Array.from({ length: 11 }, pick).join('')}.js`;
  names.set(index, name);
  return name;
}
function runScript(index, code) {                                                    // Pc
  const s = document.createElement('script');
  s.textContent = `${code}\n//# sourceURL=${randomName(index)}`;
  document.body.appendChild(s);
}
```

- What runs is the decoded text of the same bytes that were hashed (`code` and `bytes` come from the same response). Index `0` is the strings file, `1` the first file of `order`.
- Hashing and running are separate steps on the same data. **The hash says what was downloaded, not what is running.** Anything that changes the code after this point leaves the hash as it was: an extension, DevTools, a `RELIABLE_TASK` from the server ([docs/research/fingerprinting.md](fingerprinting.md)), or the game's own runtime state.

### 12.6 Phase 5: the login message (`D`, `H`)

```js
function versionField() {                                                            // D, globalThis.PB2ClientVersionField
  const b = globalThis.PB2_CLIENT_BUILD;
  return !b || !b.hash ? 'version_h5' : `version_h5/${String(b.version || '')}/${b.hash}/${String(b.bytes || 0)}`;
}

function authenticate(connection, done, kind) {                                      // H
  let login = '.guest', password = '.guest';
  const p = globalThis.loaderInfo?.parameters;
  if (p && p.l !== '') { login = p.l; password = p.p; }
  const r36 = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);
  connection.send(RELIABLE, [                                                        // $OMeTо($ММ.$МеoрО, ...)
    $ММ.RELIABLE_AUTHENTICATE,
    login,
    password,
    versionField(),                  // read now, at send time, from the global
    'hash_h5',                       // legacy field, constant
    $ММ.CALLBACK_PLACEHOLDER,        // $ММ.$p1еeс -> callback id (13.3)
    nickname,                        // $1еT1Н: the name typed on the name prompt
    JSON.strіngіfy(r36() + '.' + r36() + '.' + r36() + '.' + r36()),  // Cyrillic і: returns the saved device id
    '1769098189070',                 // constant: the official client build timestamp
  ], (reply) => {
    if (reply[0] === 'ok') {
      $ММ.user = JSON.pаrsе(reply[1]);          // Cyrillic а/е: also saves first_login / first_login_proof
      applyRegions(reply);                       // Y: reply[2] = { regions: [...] }
      $ММ.$1МАTMH = performance.now();           // the clock zero of state part 19 (14.7)
      /* kind 'lobby':  PB2_LOBBY_CONN = $ММ.$00е0T = $ММ.$ceTOI = connection
         kind 'region': PB2_REGION_CONN = $ММ.$ceTOI = connection */
      done(null, connection);
    } else done(authFailMessage(reply[1]) || 'auth failed');                         // m
  });
}
```

**On the wire** (one reliable message, framed as in [anticheat §13.3](anticheat.md#133-on-the-wire), with Sad Burst's separators ([§13.1](#131-wire-format)); part 0 is the type, then):

| Part | Value | Notes |
|---|---|---|
| 1 | login, or `.guest` | From the entry screen |
| 2 | password, the site's game token, or `.guest` | Sent as text inside the TLS connection |
| 3 | **`version_h5/1.23/<sha256>/<bytes>`** | `"version_h5"` when there is no hash |
| 4 | `hash_h5` | Constant; despite its name, not the hash |
| 5 | callback id | Encoded number (13.3); the reply's `RESPONSE` names it |
| 6 | nickname | |
| 7 | `"<device id>"` | JSON-quoted. The look-alike `JSON.strіngіfy` ignores its argument and returns the `first_uid` kept in the save data ([§2.3](#23-names-only-sad-burst-has)) |
| 8 | `1769098189070` | Constant. The shipped server code refuses a login without part 8: `Server: Refresh page to get new version of the game` |

In the network log (`npm run sadburst`, [README §7](../../README.md#7-network-log)) it is the first reliable message of each connection:

```
OUT  REL    #0 AUTHENTICATE(".guest", ".guest", "version_h5/1.23/d43a92d5…71c9/1866990", "hash_h5", "h", "Player", "\"k2…\"", "1769098189070")
IN   REL    #0 RESPONSE(100, "ok", {"nickname":…}, {"regions":[…]})  <- answers #0 AUTHENTICATE (its part 5, "h", was callback ID 100), … ms later
```

**Where it is sent.** Every connection that logs in sends it, and the hash is the same each time:

1. **Lobby.** `globalThis.PB2ConnectLobbyAuth` (`y`) marks a multiplayer session, then tries the lobby nodes in order: `ca.sadburst2.com:2053` (US), `helper.sytes.net:2053` (EU-DE), `106.14.73.83:2053` (CN-SH), `cn.sadburst2.com:2053` (CN-HK), with the last node that worked moved first (kept in memory; the old `localStorage` key `pb2_lobby_last_ok_url` is deleted at start). Each try is `ee`: a new socket.io connection (`$ММ.$OeАоoI(url)`), `H(..., 'lobby')`, and a 7 s timeout (`x = 7e3`). A timeout or connection error goes on to the next node. An authentication **failure** (`"fail"`) stops the loop: the reason goes to chat (`Unable to authenticate as <login>: <reason>`).
2. **Regions.** Creating or joining a match can be answered with a redirect (`PB2HandleMatchRedirect`, `oe`): `{ ws_url, region_id, action: "create" | "join", ... }`. The client opens a second connection to `ws_url` and logs in there with `H(..., 'region')`, the same message. Only then does it send the `CREATE_MATCH` / `JOIN_MATCH`.
3. **Fallback.** If `PB2ConnectLobbyAuth` is missing, the official `MPLobby` code logs in itself, and still asks `PB2ClientVersionField()` when it exists.

### 12.7 Phase 6: the answer

| Reply | Client |
|---|---|
| `["ok", user, extra]` | Logged in. `extra.regions` fills the region list (`PB2ApplyRegionList`). |
| `["fail", "badversion"]` | `GAME VERSION MISMATCH. RESTART GAME OR DOWNLOAD NEW GAME VERSION FROM WEBSITE` (`PB2AuthFailMessage`). The name prompt shows the same text for this reason (`8c699c159547a19b.js`, anchor `t[0]=="badversion"`). |
| `["fail", "badlogin" \| "badpassword" \| "banaccount" \| …]` | Shown as text; the strings file maps the codes to messages (`LOGIN IS INCORRECT`, `WRONG PASSWORD`, `YOUR ACCOUNT DISABLED FOR SOME REASON. ...`). |
| `["fail", <anything else>]` | Shown as is. |
| no reply in 7 s (lobby) | Next node; after the last one: `Could not reach any lobby server`. |

**The server side.** The shipped server code (the code a player-hosted host would run, and in all likelihood the server's own, [§14](#14-server-side-checks-the-shipped-server-code)) reads the parts and hands them over:

```js
else if (type === $ММ.RELIABLE_AUTHENTICATE) {
  const [, login, password, version, hash, callbackId] = parts;
  const nickname = parts[6] || '';
  let firstUid = parts[7] || '"0hash"'; firstUid = firstUid.substring(1, firstUid.length - 1);
  const build = parts[8];
  if (build === undefined) respond(callbackId, ['fail', 'Server: Refresh page to get new version of the game']);
  if (now > connection.lastAuth + 3000) {
    connection.lastAuth = now;
    $с0A.$ITTНрl(connection, version, hash, login, password, nickname, firstUid, build,   // authLogin
      (error = null) => respond(callbackId, error === null ? ['ok', JSON.stringify(connection.user)] : ['fail', error]));
  } else respond(callbackId, ['fail', 'Server: Too frequently']);
}
```

`$с0A.$ITTНрl` is the server's account module. Its code is not in the client: Sad Burst's lobby has its own (the same holds for the official server, [anticheat §14.3](anticheat.md#143-the-reporting-module-с0a)). So the client shows only that `version` arrives at the account module as one string. The comparison itself, and the policy behind it, are on the server. The policy could be an exact allow-list, the latest build only, or log-and-accept. The client side proves only that `badversion` is an expected answer.

### 12.8 Lifecycle

```text
page load (sadburst2.com/gameplay/)
  entry screen: log in | remembered session | guest           assets/index-*.js
  Uc(login, password)                                          once per page (Bc)
    Tc   asset-version.txt  -> build id, client version         no-store
    zc   manifest (no-store), strings[lang] + order (?v=build, cache default), in parallel
    Ac   + the other language's strings; SHA-256 over en ‖ zh ‖ order
         PB2_CLIENT_BUILD = { version: "1.23", hash, bytes }    <- START: the value exists
    Pc   run every script, in order (random sourceURL)
  ... single-player: nothing is sent ...
  Multiplayer
    PB2ConnectLobbyAuth -> node 1..4: AUTHENTICATE(..., versionField(), ...)   <- sent
      ok   -> lobby connection; regions
      fail -> chat message, no other node
    create / join -> redirect -> region node: AUTHENTICATE(..., versionField(), ...)   <- sent again
  Leaving multiplayer (PB2LeaveMultiplayer): connections closed; PB2_CLIENT_BUILD kept
  Next multiplayer session: the same value is sent again
page reload                                                    <- END: the next load computes it anew
```

- **Computed once per page load**, and never refreshed while the page lives.
- **Read at send time.** `versionField()` reads `globalThis.PB2_CLIENT_BUILD` when each login is sent, not when the hash is made.
- **Single-player sends nothing.** The hash only leaves the page in a login.

### 12.9 Properties, for whoever relies on it

| Property | Holds? | Why |
|---|---|---|
| Same files → same value | Yes | Deterministic: fixed order, raw bytes, both languages, independent of the chosen language |
| A stale copy is noticed | Yes, if the server compares against the current build | The value changes with any byte of any manifest script |
| A careless modification is noticed | Yes | Editing a game script on disk, or patching it as it is served (this repository's hooks), changes the bytes that are hashed |
| The code that runs is the code that was hashed | **No** | Hashing ends before the scripts run. Nothing ties the running code to the digest afterwards (12.5) |
| The value is authentic | **No** | It is computed and reported by the client, in a writable global, with no key, nonce or server challenge. A modified client can report whatever value it likes. So this is a version and integrity *signal*, not an attestation |
| The loader is covered | **No** | `assets/*` and `index.html` are outside the hash, and the loader is the code that computes it |
| Replay of a known-good value | Not prevented | The value is static per build and the same for every user and every login |

For a server operator this means: the hash reliably separates current, stale and naively patched clients. As proof that a client is unmodified it is worth nothing on its own. It needs server-side authority ([anticheat §10.5](anticheat.md#105-the-real-fix-serverhost-authority), [§16](#16-how-to-prevent-it)) to be meaningful.

### 12.10 Names in this section

| Name | Where | Meaning |
|---|---|---|
| `globalThis.PB2_CLIENT_BUILD` | loader | `{ version, hash, bytes }`, or `undefined` before hashing / without WebCrypto |
| `globalThis.PB2_ASSET_VERSION` | loader | The build id (line 1 of `asset-version.txt`) |
| `globalThis.PB2ClientVersionField` | `2bec0e3852dc7aa6.js` | Builds the version field from `PB2_CLIENT_BUILD` |
| `globalThis.PB2AuthFailMessage` | same | Turns `badversion` into its message |
| `globalThis.PB2ConnectLobbyAuth` | same | Lobby node loop and login |
| `globalThis.PB2HandleMatchRedirect` | same | Region redirect, second login |
| `globalThis.PB2_LOBBY_CONN`, `PB2_REGION_CONN` | same | The logged-in connections |
| `$ММ.$OeАоoI(url)` | `57221ca6425ecb64.js` | New socket.io connection to a lobby or region node |
| `$ММ.$p1еeс` | same | Callback placeholder (13.3) |
| `$ММ.$1МАTMH` | same | `performance.now()` at login: the zero of the clock in state part 19 (14.7) |
| `$1еT1Н` | name prompt (`41749539d442b628.js`) | The nickname |
| `$с0A.$ITTНрl` | server only (`names.js`: `authLogin`) | The account module's login handler |

---

## 13. Network: Wire Format, Pings and Connections

> Compared with [anticheat.md §13](anticheat.md#13-reliable_ping-reference). Message type numbers are the same: the 50 `RELIABLE_*` types are declared in the same order (`RELIABLE_PING` 26, `RELIABLE_TASK` 46, `RELIABLE_TASK_ASNYC` 47). No message type is new.

### 13.1 Wire format

| | Official (`connection.js:12–13`, `libs/flash.js:7469`) | Sad Burst (`782347948dd26491.js`, `57221ca6425ecb64.js`) |
|---|---|---|
| Field separator | `\x01` | `"\|"` (anchor `$рсНAе.$pIМo1="\|",$рсНAе.$MоMcM="`"`) |
| Part separator | `\x02` | `` "`" `` |
| Escapes inside text | `$.1`, `$.2` | the same |
| Number alphabet | base 122: characters 1–126 without `-`, `~`, `\x01`, `\x02` | base 91: characters 32–126 without `-`, `~`, `\|`, `` ` `` (anchor `for(let e=32;e<127;e++)`) |
| Type 26 (`RELIABLE_PING`) as sent | `"\x1d"` | `";"` |
| Sending | always `socket.volatile.emit("m", …)` | `socket.emit` while playing a match (`$pMМ1 && $1IHOН`), volatile otherwise (anchor `let s=$pMМ1&&$1IHOН&&!!this.socket`) |
| State flow control | none | at most `max(1, min(16, ceil(ping / 16)))` states in flight, 4 when spectating (anchor `Math.min(16,Math.ceil(r/$рсНAе.$НТIТc))`) |
| Receiving states | only the newest is kept (`connection.js:822`) | non-empty states are queued and handled one per tick (anchor `this.$хT10MMe.push(n)`) |

The message layout ([anticheat.md §13.3](anticheat.md#133-on-the-wire)) is otherwise the same. Timers and limits are the same: 30 s dedicated timeout, 16 ms tick, resends at 2 s and 6 s.

### 13.2 `RELIABLE_PING` is now sent constantly

**Official:** a client sends `RELIABLE_PING` only as the scan's report `[PING, undefined, code, detail]`. Keep-alive pings go the other way, from the server ([anticheat.md §13.4](anticheat.md#134-keep-alive-start-run-end)).

**Sad Burst** adds a client keep-alive after each state it sends (anchor `c>e.$ОcО1p+50&&(e.$ОcО1p=c+Math.random()*40` in `57221ca6425ecb64.js`):

```js
{ const now = Date.now();
  if (now > conn.lastPing + 50) {
    conn.lastPing = now + Math.random() * 40;
    conn.send(RELIABLE, [$ММ.RELIABLE_PING, $ММ.CALLBACK_PLACEHOLDER], () => {});
  } }
```

- **Where:** on the match connection, only while playing (not spectating, your character exists, the in-flight window allows a state).
- **Rate:** one every 50–90 ms, 11–20 per second.
- **Why:** the acknowledgement gives a round-trip sample. Sad Burst measures the ping from the moment a message is actually emitted (`sentAt`) to its acknowledgement (anchors `u.sentAt==null&&(u.sentAt=I)`, `f._rtt=Math.max(1,s-M)`). The official client measures from the moment it was queued.
- **The server keep-alive** (every 3 s plus up to 100 ms, when no recent sample exists) is unchanged.
- **The receiving side** (the shipped server code) is unchanged: a ping whose part 1 is `"undefined"` is passed to `$с0A.$Т0ОcpT` as a report; any other ping is acknowledged (anchor `$с0А0О){parts[1]===$АMAр&&$с0A.$Т0ОcpT(connection,void 0,parseInt(parts[2]),parts[3]);`).

So [anticheat.md §13](anticheat.md#13-reliable_ping-reference)'s rule "a `RELIABLE_PING` from a client is a report" does not hold here. Only a ping with four parts and `undefined` in part 1 is one ([§7](#7-layer-d-function--array-integrity-scan)); the keep-alive has two.

### 13.3 Connections: lobby nodes and region servers

The official client has one server connection. `$ММ.$ceTOI` is set at login (`MPLobby.js:121`) and becomes the match connection on joining (`libs/flash.js:3383`), so reports, `RELIABLE_TASK`s and match traffic share one socket.

Sad Burst (`2bec0e3852dc7aa6.js`) has two kinds of server:

1. **Lobby nodes:** `ca.sadburst2.com:2053` (US), `helper.sytes.net:2053` (EU-DE), `106.14.73.83:2053` (CN-SH), `cn.sadburst2.com:2053` (CN-HK), overridable with `PB2_LOBBY_CANDIDATES`. They are tried in order with a 7 s timeout each, the last one that worked first (kept in memory; the old `localStorage` key `pb2_lobby_last_ok_url` is deleted). The login answer lists the regions: `{ regions: [{ region_id, label, public_ws_url | ws_url, port }] }`.
2. **Region servers:** creating or joining a match through the lobby can be answered with `["redirect", { ws_url, region_id, action: "create" | "join", … }]`. The client opens a socket to `ws_url` (or reuses a live one to the same URL), logs in there with the same `AUTHENTICATE` ([§12.6](#126-phase-5-the-login-message-d-h)), and sends `CREATE_MATCH` or `JOIN_MATCH` there. The lobby socket stays open.

Which connection `$ММ.$ceTOI` is:

| Situation | `$ММ.$ceTOI` | Set by (anchor in `2bec0e3852dc7aa6.js` unless noted) |
|---|---|---|
| In the lobby | the lobby node | `globalThis.PB2_LOBBY_CONN=e,$ММ.$00е0T=e,$ММ.$ceTOI=e` |
| In a region match | the region server | `o==="region"?(globalThis.PB2_REGION_CONN=e,$ММ.$ceTOI=e)`, before the login is sent |
| Back from a match | the lobby node; the region socket stays open in `PB2_REGION_CONN` | `$ММ.$ceTOI=e,$ММ.$00е0T=e,$ММ.$eA0рc=null` |
| Region socket lost | the lobby node, instead of "Connection with main server was lost" | `globalThis.PB2ActivateLobbyConnection()` (`782347948dd26491.js`) |
| Single-player, never connected | `null` | |

This matters for everything addressed to `$ММ.$ceTOI`: a scan report goes to the **region** server during a match; and only `$ММ.$ceTOI` may send `RELIABLE_TASK`s (next section).

Leaving a match goes through a replaced `$ММ.$рОеAо` (anchor `$ММ.$рОеAо.__pb2LobbyPatched=!0`): it sends `JOIN_MATCH -1` to the region and returns to the lobby. Trigger actions 9, 50, 309, 310 and 311 call it, as in the official client. It does not write `$pMМ1` or `$еHоНH` itself; the official writes around it are unchanged ([§11.1](#111-the-official-bypasses)).

### 13.4 `RELIABLE_TASK`: the server can still run code in the page

The handlers are the official ones ([fingerprinting.md](fingerprinting.md)): ignored on the server side or when the message did not come on `$ММ.$ceTOI`, otherwise ``eval(`$lIcoН1=(` + src + `)(\`mkpnduz2\`)`)`` and the answer sent back (anchors `eval("$lIcoН1=("` for the sync handler, `eval("("+` for the async one, `57221ca6425ecb64.js`).

Because `$ММ.$ceTOI` follows the player ([§13.3](#133-connections-lobby-nodes-and-region-servers)), **the region server can run code in the page during a match**, and the lobby node while in the lobby. A task from the connection that is not `$ММ.$ceTOI` (for example the lobby during a match) is ignored.

### 13.5 The ping limit is enforced on the client

A match can set `ping_limit`. On `MATCH_JOIN_RESPONSE` Sad Burst stores it (`$1АeTе`, anchor `$1АeTе=Number.isFinite(`), and `globalThis.$хATTAMM(rtt)` (`8c699c159547a19b.js`, anchor `globalThis.$хATTAMM=function`) runs on every round-trip sample while playing:

- above the limit, `excess += min(rtt − limit, 100)`; below, `excess -= limit − rtt` (not below 0);
- checked when dead, when `$АTТМc == -1`, or more than 7 s after `$Т10е1`: `excess > 350` shows "Your connection speed is too low…"; `excess > 450` shows "Disconnected…", sets `$IНIеТ = true` and leaves the match (`$ММ.$рОеAо()`, anchor `try{$ММ.$рОеAо()}catch`).

The official `frame2.js:20213–20248` has the same thresholds, but nothing assigns `$1АeTе`, so it never fires, and it only sets `$IНIеТ`. Sad Burst's check is on the client, so it is a courtesy, not an enforcement: the client can skip it.

### 13.6 Peer-to-peer is disabled

The connection constructor refuses both sides of a peer-to-peer connection (anchor `P2P / SimplePeer is not available on this client` in `782347948dd26491.js`):

```js
if (opts.host || opts.join) {
  this.isServer = !!opts.host; this.peer = null; this.error = "P2P disabled";
  console.warn("P2P / SimplePeer is not available on this client");
  setTimeout(() => { if (!this.closed) { ChatNewMsg("Peer-to-peer: Connection has been terminated without close event"); this.Disconnect(); } }, 0);
}
```

Create Match forces `p2p = false` before and after building the preset (anchor `$lАМ0ОА(),globalThis.$НеooI[$ееIoA]=!1` in `cf16016767e6b8be.js`); the official screen has a "MATCH LOCATION" toggle (`MPCreateMatch.js:313`). So:

- [anticheat.md §13.5](anticheat.md#135-anti-cheat-report-start-run-end)'s "a report throws on a P2P host" cannot happen,
- the server branches of `$ММ.$pOeрМ` and `$ММ.$c0рlc` never run inside a Sad Burst client ([§14](#14-server-side-checks-the-shipped-server-code)).

---

## 14. Server-Side Checks (the shipped server code)

> **Server side.** As in [anticheat.md §14](anticheat.md#14-server-side-state-checks-ммpoeрм), this is the code a match's server runs, shipped in the client for player hosts. Sad Burst has no player hosts ([§13.6](#136-peer-to-peer-is-disabled)), so this code never runs in a client. Whether Sad Burst's region servers run it cannot be seen from the client.

### 14.1 The checks are unchanged

The server branch of `$ММ.$pOeрМ` in `57221ca6425ecb64.js` matches the official `libs/flash.js:869–1199` statement by statement, with the same constants:

| Check ([anticheat.md](anticheat.md)) | Official | Sad Burst anchor (`57221ca6425ecb64.js`) |
|---|---|---|
| Respawn desync (§14.5): limit 30 | `$eрIМIр = 30` | `$ММ.$eрIМIр=30` |
| Revive window: 3000 ms | `$0AA1HO = 3000` | `$ММ.$0AA1HO=3e3` |
| HealthAltering (§14.4): HP above `hmax`, grace 10 s | `libs/flash.js:938–944`, `:5736` | `o.hmax!==0&&T>o.hmax&&i>o.$OННОeО` |
| Aim (§14.6): `dx > 800+200 \|\| dy > 400+200`, score `> 25`, logged once a minute | `libs/flash.js:960` | `M>1e3\|\|r>600` |
| Clock (§14.7): limit 600 ms, doubled when not dedicated, more than 6 strikes | `libs/flash.js:1134–1186` | `let M=600;$ММ.$T0еcр\|\|(M*=2)` |
| Still dead: every 1000 ms | `libs/flash.js:1109` | `[$ММ[$Н1сHО]]),$.$HАНeT.$оcIеMM=i+1e3` |

### 14.2 What changed in the server code

- **Reputation is off.** `REPORT_USER` and `ENDORSE_USER` answer `"Server: Reputation system is disabled"` instead of calling `$с0A.$HpААоe` / `$с0A.$peеHeН` (official `libs/flash.js:2878`; anchor `type===$ММ[$lO0OМ])l="Server: Reputation system is disabled"`). The `-min_reputation` chat command answers the same.
- `KICK_USER` and `BAN_USER` are unchanged.

These edits matter only on a server, which suggests that Sad Burst's servers run this same file. That is an inference: nothing in the client proves it.

### 14.3 What the client sends

The state update ([anticheat.md §14.2](anticheat.md#142-the-state-update-part-by-part)) has 21 parts (0–20) in the official client. Sad Burst sends 25:

| Part | Value | Read by |
|---|---|---|
| 0–20 | as in the official client | the checks above |
| HP | sent as `0` while `$lMH0М` is set (anchor `$lMH0М!="undefined"&&$lMH0М&&(I=0)`) | the HP check |
| 21 | your ping, `max(1, round(conn.ping \|\| 1))` (anchor `p.push($(Math.max(1,Math.round(e.ping\|\|1))))`) | no shipped code: the server's own |
| 22 | custom events (`MP_custom_events`) | other clients |
| 23 | a counter, incremented when part 22 is not empty | other clients |
| 24 | flags: 1 = `$оlсTН`, 2 = tab hidden | other clients |

None of the new parts is checked by the shipped server code.

---

## 15. What This Means for This Repository

`npm run sadburst` (`electron . --sadburst`) serves the files of `game.sadburst/` byte for byte, at the site's URL, in its own browser session (`persist:sadburst`). Only `index.html` changes: the page core (`__dev/page/page.js`), the names file (`__dev/names.js`, from `data/names.sadburst.js`) and, with `dev_console` on, the console (`__dev/opcodes.js`, `__dev/page/console.js`) are added as `<script>` tags before `</body>` (`prepareIndex`, `src/wrapper/platform/index-page.ts`). They are outside the manifest, so they do not change the build hash. Hooks would change the bytes of a manifest script, and so the hash: they are off for Sad Burst, and the terminal says so at start.

| Feature | Official client | Sad Burst 2 |
|---|---|---|
| Integrity scan | Runs from `window.onload` when `game/scripts/main.js` has it | Runs: `game.sadburst/` is the site's code, unmodified. Its baseline includes Sad Burst's globals ([§7.2](#72-what-the-baseline-contains)) |
| Map editor (walls, water, pushers; [map_editor](../features/map-editor.md), [anticheat.md §7.2](anticheat.md#72-editing-the-level-live-the-dev-consoles-map-editor)) | A locked-array edit can be reported (code 3) and reloads the page | The same, in every mode. The report goes to the region server during a match ([§7.3](#73-where-the-report-goes)) |
| Console overrides (`god`, `speed`, …) | Forced from `ENTER_FRAME`, no global replaced | The same. The value guard (layer A) still applies in multiplayer |
| Scan report in the terminal (`scan_bypass`, `src/features/scan_bypass/services/scan-report.ts`) | Decodes a four-part `RELIABLE_PING` and names the locked array when it can | The same. It is not confused by Sad Burst's keep-alive pings, which have two parts. It gives the array's index only: the list is block-scoped ([§8](#8-layer-e-locked-array-snapshots)) |
| Ranked-match protection (`bypass checks`, [scan_bypass](../features/scan-bypass.md), [anticheat.md §14.8](anticheat.md#148-summary-for-players)) | Uses the match's `approved` / `ranked` | The same fields, from Sad Burst's `MATCH_JOIN_RESPONSE`. The checks it protects against are server-side ([§14](#14-server-side-checks-the-shipped-server-code)) |
| Network recorder (`netlog`) | Wraps methods on connection objects | The same, logged apart (instance `sadburst`). The raw packet codec (`src/console/kernel/net/codec.ts`) assumes the official `\x01`/`\x02` separators and base-122 numbers, so anything that decodes raw Sad Burst packets splits them wrongly ([§13.1](#131-wire-format)). Not tested |
| `RELIABLE_TASK` guard ([lobby_task_guard](../features/lobby-task-guard.md)) | Acts only when the page joins a private server | Never acts. Sad Burst's lobby and region servers can run code in the page ([§13.4](#134-reliable_task-the-server-can-still-run-code-in-the-page)), which is why Sad Burst has its own session, settings file and names ([client_sadburst](../features/client-sadburst.md)) |
| Remote play, player-hosted host | Available | Refused at start: official client only. Sad Burst has no P2P either ([§13.6](#136-peer-to-peer-is-disabled)) |
| Build check | | At start the app reads the site's `asset-version.txt` and warns when its build id differs from `game.sadburst/` (`checkSadburstBuild`, `src/wrapper/platform/game-files.ts`) |

---

## 16. How to Prevent It

The official recommendations ([anticheat.md §10](anticheat.md#10-how-to-prevent-it)) apply unchanged to layers A–C. These are the ones specific to Sad Burst, by impact per hour of work.

### 16.1 Quick fixes (hours)

1. **Unlock before writing a locked array.** `sanitizeCampaignSkinVarsOutsideCampaign()` writes `$рHоеН` without `$oITOo()` or `$T0OMое()` ([§8](#8-layer-e-locked-array-snapshots)). Call `$oITOo()` first, as `Campaign.js` does, so honest players are not reported.
2. **Reset the custom-map flag when joining a match**, and do not let `pb2LaunchPlaytestWire` stay a public global ([§11.2](#112-a-new-way-to-set-the-custom-map-flag)).
3. **Restore error reporting**, or remove the dead reporter and the kill switch, so the code says what it does ([§9](#9-error-reporting-is-removed)).

### 16.2 The build hash

The hash ([§12.9](#129-properties-for-whoever-relies-on-it)) separates current, stale and carelessly patched clients. It cannot prove that a client is unmodified, because the client computes and reports it. To make it worth more:

1. **Make it a challenge.** Have the server send a nonce at login and hash `nonce ‖ scripts`. A replayed value then fails. A modified client can still compute the right answer from an unmodified copy, so this raises the cost, nothing more.
2. **Do not keep it in a writable global.** `PB2_CLIENT_BUILD` and `PB2ClientVersionField` can be replaced by any code in the page.
3. **Cover the loader.** `index.html` and `assets/*` are outside the hash, and the loader computes it.

### 16.3 The real fix

As in the official client ([anticheat.md §10.5](anticheat.md#105-the-real-fix-serverhost-authority)): the region server should own HP, damage, speed and position limits. Sad Burst is in a better position for this than the official game: there are no player hosts, so every match runs on a server it controls ([§13.6](#136-peer-to-peer-is-disabled)). The shipped checks of [§14](#14-server-side-checks-the-shipped-server-code), if the region servers run them, are the start of that.

---

## 17. Appendix

### 17.1 Useful searches

```bash
G=game.sadburst/gamelogic
grep -lF '$pМоcT()' $G/*.js                          # files with guarded entry points
grep -oF '$еHоНH=!0' $G/*.js                          # where the custom-map flag is set
grep -lF 'new Error().stack' $G/*.js                  # stack checks
grep -oF 'window.onload=' $G/*.js                     # the scan's only trigger
grep -c 'fetch' $G/1c875a40b1fa8ffe.js                # 0: the error reporter sends nothing
```

### 17.2 Telling the clients apart at run time

| Probe | Official | Sad Burst |
|---|---|---|
| `typeof PB2_CLIENT_BUILD` | `"undefined"` | `"object"` (after the loader hashed the scripts) |
| `typeof pb2LaunchPlaytestWire` | `"undefined"` | `"function"` |
| `$рсНAе.$pIМo1` | `"\x01"` | `"\|"` |
