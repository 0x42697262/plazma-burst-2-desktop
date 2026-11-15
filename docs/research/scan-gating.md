# The anti-tamper scan's gate

Which condition decides whether the game installs its tamper scan, how often that is
evaluated, and why one literal login is exempt. Verified against game build v1769098419
(`game/pb2-version.json`). Line numbers are the decoded ones (`npm run find-names --
--decode <file>`), which are the same numbers in the file under `game/`.

This is the gate only. What the scan looks for, and what the lobby does with what it sends,
are elsewhere: [anticheat.md](anticheat.md) (unmaintained) and
[scan_bypass](../features/scan-bypass.md) for this repo's own switch.

## The condition

```
run = (isCompiled || (href.includes("/h5/") && btoa(login) !== "RXJpYyBHdXJ0"))
      && (isCompiled || isMultiplayer)
```

`"RXJpYyBHdXJ0"` is `"Eric Gurt"` in base64, and the test is `!==`, so the second term is
"this is not the author's own login".

| Input | Read where | Value |
|---|---|---|
| `isCompiled` | `scripts/libs/errors.js:5` | `document.location.href.indexOf("/game/") === -1` |
| `login` | `scripts/flash.js:10-14` → `scripts/frame2.js:304` | `Cookies.get('login') \|\| ''`, captured once at load |
| `href` | `window.location.href` | |
| `isMultiplayer` | `scripts/frame2.js:2177` (`var $pMМ1=false`), `true` at `scripts/libs/flash.js:3357` | set when a match's first sync is accepted |

`isMultiplayer` is a plain page global: it is per page load, and it goes back to `false` when
the player returns to the lobby (`frame2.js:20074`, `:43004`).

## Where it is evaluated

`globalThis.$сMlcА1` is a no-op until `scripts/main.js:939` replaces it. The main loop calls
it once per iteration (`main.js:166`), right after the frame update, so the condition is
re-tested on every game tick — but its first half is memoized:

```
941  if($оcНсеl===undefined)          // once per page load
943    $оcНсеl=false;
945    if(btoa($Oeо0)!=="RXJpYyBHdXJ0")
946      if(window.location.href.indexOf("/h5/")!==-1)
947        $оcНсеl=true;
950  if(globalThis.$ОТ0lАl||$оcНсеl)   // $ОТ0lАl is isCompiled, copied at :925
951    if(globalThis.$ОТ0lАl||$pMМ1)   // isCompiled or isMultiplayer
```

Nested `if`s, no `else`: two ANDs. `$ОТ0lАl` is a copy of `isCompiled` taken inside
`$HHOеоH` (`main.js:925`), the setup function that also fills the watch list.

## What the exemption can and cannot reach

`isCompiled` dominates the first half, so on the live URL the login is never looked at:

| Page URL | `isCompiled` | Scan runs |
|---|---|---|
| `/h5/versions/<v>/` — the site, and this app (`src/shared/clients/keys.ts:25`) | `true` | always, in every mode, for every login |
| `/game/h5/…` as `"Eric Gurt"` | `false` | never |
| `/game/h5/…` as anyone else | `false` | only while in a multiplayer match |
| `/game/…` with no `/h5/` | `false` | never |

So the `"Eric Gurt"` comparison only decides anything when the page is served from a
`/game/` path that also contains `/h5/` — the author's own development layout. There it buys
"no scan, single-player included"; on the live `/h5/versions/…` layout it changes nothing,
because the scan is already on for everybody.

## What the gate installs when it opens

Three families of checks, all built inside `$HHOеоH`:

1. **Function sources** (`main.js:1062-1102`): every property of `globalThis` and of the game's
   `Multiplayer` object whose value is a function is recorded as `{parent, prop, source}`
   unless its `toString()` contains `"[native code]"`.
2. **Fixed references** (`main.js:1104-1138`): a fixed list of globals — the wall arrays
   (`$сАоОo`, `$o1О00`, `$с0МAр`, `$MМрTТ`) and the skin colour globals among them — is
   recorded twice, itself and a getter (`$HpolеМ`, `main.js:1104`).
3. **Locked array contents** (`scripts/libs/tools.js:193`, `$ррОM1I` at `:160`): arrays
   registered for change callbacks are deep-cloned at registration and compared one per tick.

A tick has a 300 ms budget (`main.js:956`) and stops at the first mismatch. The mode number
that goes out says which family fired: `1` a fixed reference no longer is what it was, `2` a
function's source text changed (the detail is `<index>/<old 50 chars>/<new 50 chars>`), `3` a
locked array's contents changed (the detail is that array's index).

Separately, when the gate opens, `frame2.js` installs its own layer: 30 `eval`'d copies of one
`ENTER_FRAME` listener (`frame2.js:27722-27760`), each checking, only while `isMultiplayer`,
that `Date.now` was not swapped and that no frame took longer than 1000 ms — a debugger
breakpoint. Either one reloads the page.

## What a mismatch does

- `main.js:1037-1045`: if a lobby connection exists, it sends
  `RELIABLE_PING` with `[undefined, <mode>, <detail>]` — the ping message with its value slot
  emptied. Without a connection (single-player) nothing is sent.
- The tick timer is then set to `Infinity`, so no further check runs, and 300 ms later the
  page reloads (`r.call(l)`, `main.js:1041-1045`).
- `main.js:1048-1057` is a decoy that only runs if the literal `"/PB2HTML5/"` in the file no
  longer equals `"/"+"PB2"+"HT"+"ML5"+"/"` — i.e. it runs only after a tool has rewritten one
  of them. As shipped it is dead code.

## Details that matter for reproducing it

- **The login is a cookie, read once.** `flash.js:10-14` builds the Flash shim as
  `loaderInfo.parameters = { l: Cookies.get('login') || '', p: Cookies.get('password') || '' }`
  and `frame2.js:304` copies `l` into the global the gate reads. Changing the cookie later
  changes nothing until the page is reloaded; `main.js:941` memoizes the answer as well.
- **Both hidden.** `btoa` is spelled `"b"+"to"+"a"` (`main.js:910`) and the expected value is
  base64, so neither the word `btoa` nor `Eric Gurt` appears in the served text.
- **Exact string.** Case, spaces and punctuation count: `eric gurt` and `Eric Gurt ` are not
  exempt. The `login` cookie is written by whoever logs in, and in this app by its own login
  feature (`src/wrapper/platform/site-cookies.ts`, [login](../features/login.md)).
- **No cookie, no account.** `btoa('')` is `''`, which is not the base64 constant, so a guest
  page is scanned like any other login.
- **A login outside Latin-1 throws.** `btoa` rejects characters above `U+00FF` with an
  `InvalidCharacterError`, and the call at `main.js:945` is not wrapped in `try`. Whether the
  site can hand out such a login is not stated anywhere in `game/`; not verified in play.

## Checking it

```
npm run find-names -- --decode scripts/main.js   | sed -n '939,960p'
npm run find-names -- --decode scripts/frame2.js | sed -n '302,306p;27722,27760p'
npm run find-names -- --decode scripts/libs/errors.js | sed -n 5,5p
npm run find-names -- --decode scripts/libs/tools.js  | sed -n '156,215p'
```

In a page, `globalThis.$ОТ0lАl` is `isCompiled`, `globalThis.$Оeо0` the login the gate sees,
and `globalThis.$сMlcА1` the scheduler; under this app's `/h5/versions/…` URL the first is
`true`, which is why the scan cannot be turned off by the login here.
