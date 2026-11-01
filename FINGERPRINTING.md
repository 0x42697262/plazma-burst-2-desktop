# Server-Pushed Browser Fingerprinting in the Plazma Burst 2 HTML5 Client

**Scope:** `game/` only (client build `v1769098419`, build tag `mkpnduz2`)
**Date:** 2026-11-01

---

## Abstract

The PB2 HTML5 client has no fingerprinting code of its own. It has a general
**remote-code-execution primitive**: the `RELIABLE_TASK` and
`RELIABLE_TASK_ASNYC` [sic] messages. The main (lobby) server sends a
JavaScript function as source text, the client runs it with direct `eval`,
and whatever it returns goes back to the server as an ordinary
`RELIABLE_RESPONSE`. The fingerprinter is one such pushed function. It
contains a class `FP`, which looks like a refactor of the open-source
`get-browser-fingerprint` routine. It collects about 20 navigator, screen,
locale and canvas attributes and returns them as **raw JSON**, not hashed,
together with the client build tag, the page origin, the client's public IP
and a few short tokens. This document covers where the mechanism lives in the
client, the wire format that carries it, the full lifecycle of one
fingerprint exchange, and a field-by-field breakdown of the observed request
and response.

---

## 1. Method and Sources

### 1.1 Material examined

| Source | Use |
|---|---|
| `game/scripts/libs/flash.js` | Multiplayer core (`$ММ`): message enum, dispatcher, task handlers, reply function, number codec |
| `game/scripts/connection.js` | Connection class (`$рсНAе`): socket.io / WebRTC transport, reliable framing, escaping |
| `game/scripts/screens/MPLobby.js` | Opening the main-server connection |
| `game/scripts/frame2.js` | Build tag `$ерОр0`, `CONNECTION_SERVER_ID` |
| `game/_strings.js` | Global string table used by the obfuscator |
| Sample request / response (from the user) | The pushed function's source (first ~3 KB of 7370 chars) and the reply it produced |

Nothing outside `game/` was read. Any claim about server behaviour, or about
the program that captured the samples, is **inferred** and marked as such.

### 1.2 Deobfuscation

The client is obfuscated two ways:

1. **Identifier mangling.** Names are 5–7 characters long and mix Latin with
   Cyrillic homoglyphs (`А` U+0410, `О` U+041E, `р` U+0440, `с` U+0441,
   `Т` U+0422, …). Two names that look the same can be different
   identifiers. Search for them by copy-paste, never by retyping.
2. **String hoisting.** Almost every string literal is replaced by a global
   such as `$HТесO`. All of these are defined in `game/_strings.js` as
   `globalThis.$HТесO='RELIABLE_TASK'` and so on (4,944 entries).

To read the code, `_strings.js` was evaluated in a `vm` sandbox, and every
bare `$…` token whose name is a string-table key was replaced with its
JSON-quoted value. This changes no line breaks, so **every line number in
this document is valid against the original, unmodified files.** The code
excerpts below have the strings substituted back in but otherwise keep the
original identifiers.

---

## 2. Architecture Background

### 2.1 Connections

`$ММ` (in `flash.js`) is the multiplayer singleton. It holds several
connection objects, all instances of `$рсНAе` (`connection.js`):

| Field | Role |
|---|---|
| `$ММ.$ceTOI` | **Main server** connection (lobby, chat, auth, match list). Opened in `MPLobby.js:101-121`. |
| `$ММ.$eA0рc` | Connection to the current match host (P2P or relay). |
| `$ММ.connections[]` | Every live connection. |

The main server URL is built in `MPLobby.js:101`:

```js
let $eр10Мe = ($IеeToс ? "localhost" : $ММ.$А1HoНМ[CONNECTION_SERVER_ID] + "plazmaburst2.com") + ":" + $ММ.$Т1Aoо1;
```

- `$ММ.$А1HoНМ = ["", "https://vvvv.", "https://www."]` (`flash.js:301`)
- `CONNECTION_SERVER_ID = 1` by default (`frame2.js:2428`). The Settings
  screen labels this "CONNECTION METHOD: MAIN / ALT".
- `$ММ.$Т1Aoо1 = 2053` (`flash.js:25`)

With default settings the result is `https://www.plazmaburst2.com:2053`.
The transport is socket.io (`connection.js:281-292`):

```js
this.socket = io(params.url, {
    $pОMol: true,
    withCredentials: true,
    transports: ["websocket", "polling", "webtransport"]
});
```

`withCredentials: true` means cookies for `plazmaburst2.com` go along with
the polling / handshake requests.

### 2.2 The host flag `$с0А0О`

Each connection has a boolean `$с0А0О`, which is true when **this end acts as
the server/host** of that connection (`connection.js:248`, `:259`). It is
true when the code runs as a dedicated server (`$ММ.$T0еcр`) or as the
initiator of a SimplePeer WebRTC link. On a normal player's main-server
connection it is **false**. The task handlers check this flag (§4.2).

---

## 3. Wire Protocol

Running the task and returning its result both use the client's ordinary
reliable-message layer. The fingerprint traffic is just two messages within it.

### 3.1 Message enumeration

Message types are consecutive integers handed out by a counter
(`flash.js:81-82`):

```js
let $ТсoAрc = 0;
let $сеMlO = () => { return $ТсoAрc++; };
$ММ["RELIABLE_RESPONSE"]   = $сеMlO();   // 0   (flash.js:86)
...
$ММ["RELIABLE_TASK"]       = $сеMlO();   // 46  (flash.js:136)
$ММ["RELIABLE_TASK_ASNYC"] = $сеMlO();   // 47  (flash.js:137)
```

### 3.2 Integer codec

Integers (message types, callback IDs) are sent in a custom positional base,
using `$ММ.$Oоolр` to encode and `$ММ.$OНННО` to decode
(`flash.js:5249-5305`). The alphabet `$ММ.$ocMТр1` is built at
`flash.js:7476-7493`. It holds every code unit from U+0001 to U+007E except
`-` (the sign), `~` (a field separator elsewhere) and the two framing
characters U+0001 and U+0002. That leaves **base 122**, with digit 0 =
U+0003.

| Value | Encoded |
|---|---|
| `RELIABLE_RESPONSE` = 0 | `"\x03"` |
| `RELIABLE_TASK` = 46 | `"2"` |
| `RELIABLE_TASK_ASNYC` = 47 | `"3"` |
| callback ID 110 | `"r"` |

The `"r"` in the sample request (`TASK("…", "r")`) is therefore a callback ID
of **110** in the server's numbering.

### 3.3 Framing and escaping

Separators are defined at `connection.js:12-13`, and the escape tables at
`connection.js:41-47`:

```js
$рсНAе.$pIМo1 = String.fromCharCode(1);   // frame-level separator
$рсНAе.$MоMcM = String.fromCharCode(2);   // part separator inside one message
$рсНAе.$еТ0Ae = [ "\x01", "$.1" ];                    // frame escape
$рсНAе.$1ITeI = [ "\x01", "$.1", "\x02", "$.2" ];     // part escape
```

The escape and unescape helpers are `$eIеIс` and `$МIеAА`
(`connection.js:99-114`). They are plain `split/join` substitution. `$` itself
is not escaped, so a payload containing the literal text `$.1` or `$.2` comes
out corrupted after decoding. This is a latent bug and does not affect the
fingerprint.

**One message** (`connection.js:677-760`, the `$OMeTо` send function):

```
data = enc(type) \x02 esc(part1) \x02 esc(part2) \x02 …
```

**One frame** (`connection.js:1080-1230`, the flush loop):

```
frame = esc(ackUid) \x01 esc(unreliable) \x01 esc(uid₁) \x01 esc(data₁) \x01 esc(uid₂) \x01 esc(data₂) …
```

The frame is sent with `socket.volatile.emit("m", frame)`, or with
`SimplePeer.send(frame)` on WebRTC links. Volatile emits can be dropped.
Delivery is guaranteed one layer up: each message has a monotonically
increasing `uid` and stays in `$ОOe0A` until the peer's ack (`$ТТрсН`)
passes it (`connection.js:1021-1030`). The receiver (`connection.js:790-840`)
deduplicates by uid, sorts, and hands messages one at a time, in order, to
`$ММ.$c0рlc` (`connection.js:915`).

Obfuscation filler is mixed in. For example, `connection.js:1200-1204` (and
again at `:776-780` with a different split point) does `s.substring(0,k)+s.substring(k)`, which
returns `s` unchanged.

### 3.4 Dispatcher entry

`$ММ.$c0рlc(msg, connection)` (`flash.js:1864`) splits `msg.data` on U+0002,
unescapes each part, decodes `parts[0]` into the numeric type
(`flash.js:1901-1910`), then walks a long `if (type === …)` chain.

---

## 4. The Task Primitive

### 4.1 Reply function

Inside `$c0рlc`, before dispatching, a per-message closure is defined
(`flash.js:1866-1889`):

```js
let $oНрAoA = false;                       // "already replied"
function $АpА1рO($0НAlAp, args) {          // (callbackId, argsArray)
    if ($oНрAoA) { /* warn in debug, else */ throw new Error(); }
    $oНрAoA = true;
    if ($0НAlAp === undefined) throw new Error();
    connection.$OMeTо($ММ.$МеoрО,           // channel 1 = reliable
        [$ММ["RELIABLE_RESPONSE"], $0НAlAp, ...args]);
}
```

Each incoming message can be answered **at most once**. The reply always
goes back over the same connection it arrived on.

### 4.2 `RELIABLE_TASK` (synchronous), `flash.js:3730-3749`

```js
if (type === $ММ["RELIABLE_TASK"]) {
    if ($с0А0О) return;                       // never run tasks when we are the host side
    if (connection !== $ММ.$ceTOI) return;    // only the main server may send tasks

    let $0OeсА = parts[1];                    // JS source of a function expression
    let $lIcoН1 = undefined;
    try { eval(`$lIcoН1=(` + $0OeсА + `)(\`${$ерОр0}\`)`); } catch (e) {}

    let $0НAlAp = parts[2];                   // callback id
    if (typeof $lIcoН1 === "string" || typeof $lIcoН1 === "number" || typeof $lIcoН1 === "boolean")
        $АpА1рO($0НAlAp, [$lIcoН1]);
    else if ($lIcoН1 instanceof Array)
        $АpА1рO($0НAlAp, $lIcoН1);
}
```

### 4.3 `RELIABLE_TASK_ASNYC` (asynchronous), `flash.js:3751-3773`

The guards are the same. The function is called with a second argument, a
continuation:

```js
let $lIcoН1 = (v) => { /* same type switch, then */ $АpА1рO($0НAlAp, …) };
try { eval(`(` + $0OeсА + `)(\`${$ерОр0}\`,$lIcoН1)`); } catch (e) {}
```

The server uses this variant whenever the result requires waiting, for
example on `fetch` or `OffscreenCanvas.convertToBlob`.

### 4.4 Semantics worth noting

1. **Direct eval in the handler's scope.** The pushed code is compiled
   inside `$c0рlc`'s lexical environment. It can read and close over
   `connection`, `parts`, `match`, `$АpА1рO`, `$ММ` and every other local and
   global. It is not sandboxed in any way.
2. **The argument `v` is the build tag.** `$ерОр0` is the constant
   `"mkpnduz2"` (`frame2.js:5413`), spliced into a template literal. The
   pushed function therefore always receives the client build identifier as
   its first argument.
3. **Errors are swallowed.** `catch(e){}` drops all exceptions. A sync task
   that throws, returns `undefined`, a `Promise`, or a plain object produces
   **no reply at all**. What the server then does (timeout, retry, kick) is
   not visible from the client.
4. **Arrays are spread into the reply.** Returning `[a, b, c]` sends
   `RESPONSE ‖ cb ‖ a ‖ b ‖ c`. Each element is turned into a string by
   `$eIеIс` (`value += ""`).
5. **Trust boundary.** Only `$ММ.$ceTOI`, the main server, can push tasks.
   A match host or P2P peer cannot. The client trusts the main server
   completely.
6. **Not logged in production.** `$рсНAе.$oоpOО` (the "trace sent reliable"
   switch) is `false` (`connection.js:22`), so the client prints nothing
   when a task runs.

---

## 5. Lifecycle of One Fingerprint Exchange

```
 client (game/)                                               main server
 ──────────────                                               ───────────
 [1] MPLobby.js:101-121
     open socket.io → https://www.plazmaburst2.com:2053  ───►
     authenticate (login/password or .guest)              ───►
                                                         ◄───  [2] RELIABLE_TASK
                                                                parts = ["2", <fn src>, "r"]
 [3] connection.js:790-915  reassemble, ack, order
 [4] flash.js:1901          decode type 46 → RELIABLE_TASK
 [5] flash.js:3730-3735     guards: !$с0А0О, conn === $ceTOI
 [6] flash.js:3741          eval("(<fn src>)(`mkpnduz2`)")
        └─ FP.getBrowserFingerprint() → reads navigator/screen/Intl,
           draws on a canvas, assembles hash1/hash2, returns array
 [7] flash.js:3743-3748     array → $АpА1рO("r", array)
 [8] flash.js:1888          $OMeTо(1, [RESPONSE, "r", …8 fields])
 [9] connection.js:1080+    frame, socket.volatile.emit("m", …)   ───►
                                                         ◄───  [10] ack uid
 [11] connection.js:1021    drop from retransmit queue
```

### 5.1 Start

**The client never starts fingerprinting.** Nothing in `game/` calls a
fingerprint routine, references `navigator.deviceMemory`, or draws a
fingerprint canvas. (`grep` for `getBrowserFingerprint`, `getCanvasID`,
`hash1` and `fingerprint` over `game/` finds nothing.) The whole collector
arrives as data in step [2].

What triggers step [2] is decided on the server. The client only fixes the
precondition: a main-server connection must exist (`$ММ.$ceTOI !== null`).
That happens when the player enters the multiplayer lobby. It is *inferred*,
not proven, that the server sends the task soon after authentication on that
connection.

### 5.2 End

The exchange ends at step [8], when the reply has been queued. Steps [9]–[11]
are ordinary reliable delivery. The reply is retransmitted until acknowledged
or until the connection drops; `$рсНAе.$pIсpo = 30 s` is the stale-message
timeout checked at `connection.js:888`.

**On the client, nothing persists.** `let FP = class FP {…}` is
block-scoped inside the evaluated arrow function, so the class, its statics
`FP.hash1` / `FP.hash2`, and the canvas element become unreachable once the
function returns. No cookie, `localStorage`, or IndexedDB write is visible
in the part of the payload that was captured. The tail is not visible (§8).

---

## 6. The Pushed Payload

### 6.1 Shape

```js
( v )=>{
    try {
        let FP = class FP {
            static getBrowserFingerprint({ hardwareOnly = false, enableWebgl = false, debug = false } = {}) { … }
            static getCanvasID(debug)  { … }   // referenced, body not in sample
            static getWebglID(debug)   { … }   // referenced, body not in sample
            static getWebglInfo(debug) { … }   // referenced, body not in sample
        };
        …                                       // not in sample
        return [ … ];                           // inferred from response shape
    } catch (…) { … }                          // not in sample
}
```

The function has a single parameter, so this is the **synchronous**
`RELIABLE_TASK` form. The `catch` inside the payload hides failures from the
server on top of the client's own `catch(e){}`. The total source length is
7,370 characters, and the sample shows roughly the first 3,000.

### 6.2 `getBrowserFingerprint`: what is read

```js
const { cookieEnabled, deviceMemory, doNotTrack, hardwareConcurrency,
        language, languages, maxTouchPoints, platform, userAgent, vendor } = window.navigator;
const { width, height, colorDepth, pixelDepth } = window.screen;
const timezoneOffset   = new Date().getTimezoneOffset();
const timezone         = Intl.DateTimeFormat().resolvedOptions().timeZone;
const touchSupport     = 'ontouchstart' in window;
const devicePixelRatio = window.devicePixelRatio;
const canvas    = FP.getCanvasID(debug);
const webgl     = enableWebgl ? FP.getWebglID(debug)   : undefined;
const webglInfo = enableWebgl ? FP.getWebglInfo(debug) : undefined;
```

Then two objects are built:

- **`FP.hash1`, "hardware-only".** The fields are `canvas, colorDepth,
  deviceMemory, devicePixelRatio, hardwareConcurrency, height,
  maxTouchPoints, pixelDepth, platform, touchSupport, webgl, webglInfo,
  width`. It leaves out everything a user can change without changing
  machines (language, timezone, UA, DNT, cookies).
- **`FP.hash2`, "full".** It contains all of `hash1` plus `cookieEnabled,
  doNotTrack, language, languages, timezone, timezoneOffset, userAgent,
  vendor`.

Keys are listed alphabetically, so `JSON.stringify` output is deterministic.
`webgl` and `webglInfo` are `undefined` in the default
`enableWebgl = false` configuration, and `JSON.stringify` drops them. That
is why they are missing from the observed output.

Despite their names, **`hash1` and `hash2` are not hashes.** They hold the
raw `JSON.stringify` output. The server receives every component value, not a
digest.

The function also builds `data` (the same object as hash1 or hash2,
depending on `hardwareOnly`) and `datastring = JSON.stringify(data, null, 4)`.
Because `data` is already a string, this second stringify just wraps it in
quotes and escapes them. `datastring` is used only for the `debug` log in the
visible part. In the upstream library it is the input to the final hash; see
§6.4.

### 6.3 `getCanvasID`

Its body is not in the sample. The observed value `280615347` is a 32-bit
unsigned integer (< 2³²). That fits the upstream routine: render fixed text
and shapes onto a 2D canvas, call `toDataURL()`, and hash the PNG data URL
with MurmurHash3 x86-32. This value varies with GPU, driver, font
rasteriser, installed fonts and anti-aliasing settings. It is the
highest-entropy hardware signal in the set.

### 6.4 Provenance

The signature `getBrowserFingerprint({ hardwareOnly, enableWebgl, debug })`,
the destructuring list, the alphabetical key order, the
`// undefined will remove this from the stringify down here` comments, and
the `'fingerprint data'` debug label all match the public npm package
**`get-browser-fingerprint`**. The PB2 version turns the module functions
into static methods of a local class and adds the `FP.hash1` / `FP.hash2`
side outputs, so the raw component JSON can be returned instead of only the
upstream library's single MurmurHash3 value. This attribution rests on
textual similarity only. It was not checked against a specific package
version.

---

## 7. The Response

### 7.1 Decoded wire form

```
"\x03" \x02 "r" \x02 F0 \x02 F1 \x02 F2 \x02 F3 \x02 F4 \x02 F5 \x02 F6 \x02 F7
  │         │
  │         └ callback id 110
  └ RELIABLE_RESPONSE (0)
```

The sample output shows `У` between fields. On the wire those positions hold
U+0002 (`$MоMcM`), so `У` comes from the program that printed the sample,
which is outside `game/`. The sample also starts at F0, so that program
dropped the type and callback ID, and it JSON-escaped the inner quotes
(`\"`).

### 7.2 Fields

| # | Observed value | Identification | Confidence |
|---|---|---|---|
| F0 | `{"canvas":280615347,…,"width":1920}` (21 keys) | `FP.hash2`, the full fingerprint JSON | **Certain.** The keys match the `hash2` literal exactly. |
| F1 | `{"canvas":280615347,…,"width":1920}` (11 keys) | `FP.hash1`, the hardware-only JSON | **Certain.** The keys match the `hash1` literal exactly. |
| F2 | `mkpnduz2` | `v`, the client build tag `$ерОр0` (`frame2.js:5413`) | **Certain.** Value and mechanism both match. |
| F3 | `https://www.plazmaburst2.com` | Page origin (`location.origin` or similar) | High. The source line is not visible. |
| F4 | `180.190.136.53` | Client's public IPv4 | High as to meaning. The client cannot learn this locally, so it is either interpolated into the task source by the server (as seen by the socket) or fetched. The task is synchronous, which argues for interpolation. |
| F5 | `s27zkf` | Unidentified 6-char `[0-9a-z]` token | Unknown. See §7.3. |
| F6 | `Asia/Tokyo` | `Intl…resolvedOptions().timeZone`, repeated outside the JSON | High. |
| F7 | `5fbd58` | Unidentified 6-char token, valid hex | Unknown. See §7.3. |

### 7.3 Negative results for F5 and F7

Both tokens were tested as digests of the other fields: hash1, hash2, their
`stringify(…,null,4)` forms, the UA, the timezone, the build tag and the IP.
The candidates were MurmurHash3-32 (seed 0), Java `String.hashCode`
(signed/unsigned), MD5, SHA-1 and SHA-256. Each digest was rendered in
decimal, base-36 and hex, and checked for substring matches. **None
matched.** Plausible remaining explanations, none verified:

- Server-generated nonces or session IDs interpolated into the source (as
  with F4), echoed back to bind the reply to a session.
- Values from code in the unseen tail (§6.1), such as a persistent ID read
  from storage or a WebGL / audio hash.
- Truncated digests (`.slice(0,6)`) of material not listed above.

As decimals, `parseInt("s27zkf",36)` = 1,696,784,847 (fits in 32 bits) and
`parseInt("5fbd58",16)` = 6,274,392 (24 bits).

### 7.4 Observed component values and what they reveal

| Component | Value | Notes |
|---|---|---|
| `userAgent` | `… plazma-burst-2-desktop/1.0.0 Chrome/156.0.8078.48 Electron/45.0.0 …` | Electron adds the app name and version plus `Electron/x`. This **identifies the desktop wrapper uniquely** among PB2 players. |
| `platform` | `Linux x86_64` | |
| `languages` | `["en-US","en","en"]` | The duplicated `en` is a Chromium/Electron quirk. Rare in normal browsers, so it adds distinguishing power. |
| `deviceMemory` | `32` | Reported in GiB, rounded by the browser. |
| `hardwareConcurrency` | `12` | Logical CPUs. |
| `width`×`height`, `devicePixelRatio`, `colorDepth`/`pixelDepth` | 1920×1080, 1, 24/24 | |
| `timezone` / `timezoneOffset` | `Asia/Tokyo` / `-540` | Compare with F4: the IP's geolocation can be checked against the reported timezone. |
| `doNotTrack` | `null` | The property is missing. Electron does not expose it. |
| `vendor` | `Google Inc.` | |
| `touchSupport`, `maxTouchPoints` | `false`, `0` | |
| `cookieEnabled` | `true` | |

---

## 8. Limitations

1. **The payload is partly unseen.** About 4,300 of its 7,370 characters
   were not available: the bodies of `getCanvasID`, `getWebglID` and
   `getWebglInfo`, the code after `hash2` is built, and the `return`. So
   F3–F7 are identified from their values, not from code. Persistence,
   storage reads and extra probes in the tail cannot be ruled out.
2. **Server behaviour is not observable.** When the task is sent, how often,
   whether the content changes per session or per player, and what happens
   on no reply all live on the server.
3. **The payload can change at any time.** The collector is data, not code
   shipped in `game/`. The server can change what is collected without a
   client update. Any analysis of one captured payload, this one included,
   describes only that payload.

---

## 9. Implications for Developers

- **`RELIABLE_TASK` is arbitrary code execution by design.** Whoever controls
  the main-server connection can run any JS in the game page with full
  access to the multiplayer singleton, the active connection, and the page's
  DOM and storage. In this client the sole guard is the
  `connection === $ММ.$ceTOI` check. Anything that can stand in as the main
  server, such as a private server or a man-in-the-middle on a downgraded
  transport, inherits this capability.
- **Blocking or altering the task changes what the server sees.** If a task
  throws or returns a non-array, the client sends **no** reply, and the server
  can detect that. If a task returns different values, the server receives
  them as-is. This client has no integrity check on task results.
- **Fingerprint stability.** `hash1` survives changes to browser, language,
  VPN and timezone. It is tied to the hardware, display and rendering stack,
  so it changes with a monitor, DPI or GPU-driver change. `hash2` additionally
  breaks on any UA bump, which happens with every Electron upgrade of the
  desktop wrapper. Having both lets the server match a player at two levels
  of granularity.
- **Correlation surface.** The server can join F0/F1 with F4 (IP), F6
  (timezone) and the authenticated account on the same socket. That links
  accounts sharing a machine (`hash1` equal), accounts sharing a browser
  profile (`hash2` equal), and timezone/IP inconsistencies, which suggest a
  VPN or proxy.

---

## Appendix A. Reference Index

| What | Location |
|---|---|
| Frame / part separators | `game/scripts/connection.js:12-13` |
| Escape tables | `game/scripts/connection.js:41-47` |
| Escape / unescape helpers | `game/scripts/connection.js:99-114` |
| socket.io construction | `game/scripts/connection.js:281-292` |
| Send (`$OMeTо`) | `game/scripts/connection.js:677-760` |
| Receive / reassemble | `game/scripts/connection.js:790-840` |
| Ordered dispatch | `game/scripts/connection.js:905-920` |
| Retransmit / ack | `game/scripts/connection.js:1021-1030` |
| Flush / emit `"m"` | `game/scripts/connection.js:1080-1230` |
| Message-type enum | `game/scripts/libs/flash.js:81-137` |
| Reply closure `$АpА1рO` | `game/scripts/libs/flash.js:1866-1889` |
| Dispatcher `$c0рlc` | `game/scripts/libs/flash.js:1864`, `:1901-1910` |
| Server URL prefixes | `game/scripts/libs/flash.js:301` |
| `RELIABLE_TASK` handler | `game/scripts/libs/flash.js:3730-3749` |
| `RELIABLE_TASK_ASNYC` handler | `game/scripts/libs/flash.js:3751-3773` |
| Integer codec | `game/scripts/libs/flash.js:5249-5305` |
| Codec alphabet | `game/scripts/libs/flash.js:7476-7493` |
| Main-server connect | `game/scripts/screens/MPLobby.js:101-121` |
| `CONNECTION_SERVER_ID` | `game/scripts/frame2.js:2428` |
| Build tag `$ерОр0` | `game/scripts/frame2.js:5413` |
| String table | `game/_strings.js` |

## Appendix B. Identifier Glossary

| Identifier | Meaning |
|---|---|
| `$ММ` | Multiplayer singleton |
| `$рсНAе` | Connection class |
| `$ММ.$ceTOI` | Main-server connection |
| `$ММ.$eA0рc` | Current match-host connection |
| `$с0А0О` | "This end is host/server" flag |
| `$c0рlc` | Reliable-message dispatcher |
| `$АpА1рO` | Reply-once closure (callbackId, args) |
| `$OMeTо` | Enqueue outbound message |
| `$Oоolр` / `$OНННО` | Integer encode / decode (base 122) |
| `$ocMТр1` | Codec alphabet |
| `$pIМo1` / `$MоMcM` | U+0001 frame separator / U+0002 part separator |
| `$еТ0Ae` / `$1ITeI` | Frame / part escape tables |
| `$eIеIс` / `$МIеAА` | Escape / unescape |
| `$ерОр0` | Build tag `"mkpnduz2"`, passed as `v` |
| `$ММ.$МеoрО` | Reliable channel (1) |
| `$ММ.$ОAA0р` | Unreliable channel (0) |
