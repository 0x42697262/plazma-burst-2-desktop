# Server-Pushed Browser Fingerprinting in the Plazma Burst 2 HTML5 Client

**Scope:** `game/` (client build `v1769098419`, build tag `mkpnduz2`) and one complete
fingerprinter payload, version `b8354ed91036` (7,371 characters, captured 2026-11-01)
**Date:** 2026-11-01

---

## Abstract

The PB2 HTML5 client has no fingerprinting code of its own. It has a general
**remote-code-execution primitive**: the `RELIABLE_TASK` and `RELIABLE_TASK_ASNYC` [sic]
messages. The main (lobby) server sends a JavaScript function as source text, the client
runs it with direct `eval`, and whatever it returns goes back to the server as an ordinary
`RELIABLE_RESPONSE`. The fingerprinter is one such pushed function. It contains a class `FP`,
an adapted copy of the open-source `get-browser-fingerprint` routine. It collects 21
navigator, screen, locale and canvas attributes and returns **one string** of eight values
joined by a separator character. The values are the full and the hardware-only attribute
sets as **raw JSON**, a MurmurHash3 of the full set, the client build tag, the page origin,
and two values the server wrote into the source for that session: the client's IP address
as the server saw it, and a token. The separator also changes per session. This document
covers where the mechanism lives in the client, the wire format that carries it, the full
lifecycle of one exchange, the payload's code, and every field of the reply.

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
| `fingerprint/2026-11-01_10-57-35_b8354ed91036.js` | The complete payload, exactly as received |
| A reply captured on 2026-11-01 (from an earlier session) | The values the payload produced in that session |

The payload was captured by the dev console. `desktop/dev/console/net/fingerprint.js`
listens on the lobby connection and `desktop/fingerprint.js` stores each version once. The
console's `fingerprint` command runs the latest version locally and prints the reply
(§10). Any claim about server behaviour is **inferred** and marked as such.

### 1.2 Deobfuscation

The client is obfuscated two ways:

1. **Identifier mangling.** Names are 5–7 characters long and mix Latin with Cyrillic
   homoglyphs (`А` U+0410, `О` U+041E, `р` U+0440, `с` U+0441, `Т` U+0422, …). Two names
   that look the same can be different identifiers. Search for them by copy-paste, never by
   retyping.
2. **String hoisting.** Almost every string literal is replaced by a global such as
   `$HТесO`. All of these are defined in `game/_strings.js` as
   `globalThis.$HТесO='RELIABLE_TASK'` and so on (4,944 entries).

To read the code, `_strings.js` was evaluated in a `vm` sandbox, and every bare `$…` token
whose name is a string-table key was replaced with its JSON-quoted value. This changes no
line breaks, so **every line number in this document is valid against the original,
unmodified files.** The code excerpts below have the strings substituted back in but
otherwise keep the original identifiers. The payload itself is not obfuscated.

---

## 2. Architecture Background

### 2.1 Connections

`$ММ` (in `flash.js`) is the multiplayer singleton. It holds several connection objects,
all instances of `$рсНAе` (`connection.js`):

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
- `CONNECTION_SERVER_ID = 1` by default (`frame2.js:2428`). The Settings screen labels
  this "CONNECTION METHOD: MAIN / ALT".
- `$ММ.$Т1Aoо1 = 2053` (`flash.js:25`)

With default settings the result is `https://www.plazmaburst2.com:2053`. The transport is
socket.io (`connection.js:281-292`):

```js
this.socket = io(params.url, {
    $pОMol: true,
    withCredentials: true,
    transports: ["websocket", "polling", "webtransport"]
});
```

`withCredentials: true` means cookies for `plazmaburst2.com` go along with the polling /
handshake requests.

### 2.2 The host flag `$с0А0О`

Each connection has a boolean `$с0А0О`, which is true when **this end acts as the
server/host** of that connection (`connection.js:248`, `:259`). It is true when the code
runs as a dedicated server (`$ММ.$T0еcр`) or as the initiator of a SimplePeer WebRTC link.
On a normal player's main-server connection it is **false**. The task handlers check this
flag (§4.2).

---

## 3. Wire Protocol

Running the task and returning its result both use the client's ordinary reliable-message
layer. The fingerprint traffic is just two messages within it.

### 3.1 Message enumeration

Message types are consecutive integers handed out by a counter (`flash.js:81-82`):

```js
let $ТсoAрc = 0;
let $сеMlO = () => { return $ТсoAрc++; };
$ММ["RELIABLE_RESPONSE"]   = $сеMlO();   // 0   (flash.js:86)
...
$ММ["RELIABLE_TASK"]       = $сеMlO();   // 46  (flash.js:136)
$ММ["RELIABLE_TASK_ASNYC"] = $сеMlO();   // 47  (flash.js:137)
```

### 3.2 Integer codec

Integers (message types, callback IDs) are sent in a custom positional base, using
`$ММ.$Oоolр` to encode and `$ММ.$OНННО` to decode (`flash.js:5249-5305`). The alphabet
`$ММ.$ocMТр1` is built at `flash.js:7476-7493`. It holds every code unit from U+0001 to
U+007E except `-` (the sign), `~` (a field separator elsewhere) and the two framing
characters U+0001 and U+0002. That leaves **base 122**, with digit 0 = U+0003.

| Value | Encoded |
|---|---|
| `RELIABLE_RESPONSE` = 0 | `"\x03"` |
| `RELIABLE_TASK` = 46 | `"2"` |
| `RELIABLE_TASK_ASNYC` = 47 | `"3"` |
| callback ID 110 | `"r"` |

In the observed request, as the dev console's network log prints it
(`TASK("( v )=>{…", "r")`), the `"r"` is a callback ID of **110** in the server's
numbering.

### 3.3 Framing and escaping

Separators are defined at `connection.js:12-13`, and the escape tables at
`connection.js:41-47`:

```js
$рсНAе.$pIМo1 = String.fromCharCode(1);   // frame-level separator
$рсНAе.$MоMcM = String.fromCharCode(2);   // part separator inside one message
$рсНAе.$еТ0Ae = [ "\x01", "$.1" ];                    // frame escape
$рсНAе.$1ITeI = [ "\x01", "$.1", "\x02", "$.2" ];     // part escape
```

The escape and unescape helpers are `$eIеIс` and `$МIеAА` (`connection.js:99-114`). They
are plain `split/join` substitution. `$` itself is not escaped, so a payload containing the
literal text `$.1` or `$.2` comes out corrupted after decoding. This is a latent bug and does
not affect the fingerprint.

**One message** (`connection.js:677-760`, the `$OMeTо` send function):

```
data = enc(type) \x02 esc(part1) \x02 esc(part2) \x02 …
```

**One frame** (`connection.js:1080-1230`, the flush loop):

```
frame = esc(ackUid) \x01 esc(unreliable) \x01 esc(uid₁) \x01 esc(data₁) \x01 esc(uid₂) \x01 esc(data₂) …
```

The frame is sent with `socket.volatile.emit("m", frame)`, or with `SimplePeer.send(frame)`
on WebRTC links. Volatile emits can be dropped. Delivery is guaranteed one layer up: each
message has a monotonically increasing `uid` and stays in `$ОOe0A` until the peer's ack
(`$ТТрсН`) passes it (`connection.js:1021-1030`). Until then, every frame sent repeats it.
The receiver (`connection.js:790-840`) deduplicates by uid, sorts, and hands messages one
at a time, in order, to `$ММ.$c0рlc` (`connection.js:915`).

Obfuscation filler is mixed in. For example, `connection.js:1200-1204` (and again at
`:776-780`, with a different split point) does `s.substring(0,k)+s.substring(k)`, which
returns `s` unchanged.

### 3.4 Dispatcher entry

`$ММ.$c0рlc(msg, connection)` (`flash.js:1864`) splits `msg.data` on U+0002, unescapes each
part, decodes `parts[0]` into the numeric type (`flash.js:1901-1910`), then walks a long
`if (type === …)` chain.

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

Each incoming message can be answered **at most once**. The reply always goes back over the
same connection it arrived on.

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

The guards are the same. The function is called with a second argument, a continuation:

```js
let $lIcoН1 = (v) => { /* same type switch, then */ $АpА1рO($0НAlAp, …) };
try { eval(`(` + $0OeсА + `)(\`${$ерОр0}\`,$lIcoН1)`); } catch (e) {}
```

The fingerprinter uses the synchronous form.

### 4.4 Semantics worth noting

1. **Direct eval in the handler's scope.** The pushed code is compiled inside `$c0рlc`'s
   lexical environment. It can read and close over `connection`, `parts`, `match`,
   `$АpА1рO`, `$ММ` and every other local and global. It is not sandboxed in any way.
2. **The argument `v` is the build tag.** `$ерОр0` is the constant `"mkpnduz2"`
   (`frame2.js:5413`), spliced into a template literal. The pushed function therefore always
   receives the client build identifier as its first argument.
3. **The client swallows errors; the fingerprinter reports them.** The client's
   `catch(e){}` drops exceptions. A sync task that throws, returns `undefined`, a `Promise`
   or a plain object produces **no reply**. The fingerprinter, however, wraps all of its
   work in `try … catch(e){ return e.toString(); }`, and each risky step in its own
   `try/catch` that pushes `e.toString()` (§6.5). So a failure inside it still produces a
   reply, with the error text in it.
4. **Arrays would be spread into the reply.** Returning `[a, b, c]` sends
   `RESPONSE ‖ cb ‖ a ‖ b ‖ c`. The fingerprinter does not use this: it returns a single
   string (§6.5), which becomes one part.
5. **Trust boundary.** Only `$ММ.$ceTOI`, the main server, can push tasks. A match host or
   P2P peer cannot. The client trusts the main server completely.
6. **Not logged in production.** `$рсНAе.$oоpOО` (the "trace sent reliable" switch) is
   `false` (`connection.js:22`), so the client prints nothing when a task runs.

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
                                                                (src has this session's IP,
                                                                 token and separator in it)
 [3] connection.js:790-915  reassemble, ack, order
 [4] flash.js:1901          decode type 46 → RELIABLE_TASK
 [5] flash.js:3730-3735     guards: !$с0А0О, conn === $ceTOI
 [6] flash.js:3741          eval("(<fn src>)(`mkpnduz2`)")
        └─ FP.getBrowserFingerprint(false, true): reads navigator/screen/Intl,
           hashes a 2D canvas, builds FP.hash1 / FP.hash2, returns a MurmurHash3
        └─ 8 values pushed, reversed, joined by the separator → one string
 [7] flash.js:3743-3744     string → $АpА1рO("r", [string])
 [8] flash.js:1888          $OMeTо(1, [RESPONSE, "r", string])
 [9] connection.js:1080+    frame, socket.volatile.emit("m", …)   ───►
                                                         ◄───  [10] ack uid
 [11] connection.js:1021    drop from retransmit queue
```

### 5.1 Start

**The client never starts fingerprinting.** Nothing in `game/` calls a fingerprint routine,
references `navigator.deviceMemory`, or draws a fingerprint canvas. (`grep` for
`getBrowserFingerprint`, `getCanvasID`, `hash1` and `fingerprint` over `game/` finds
nothing.) The whole collector arrives as data in step [2].

What triggers step [2] is decided on the server. The client only fixes the precondition: a
main-server connection must exist (`$ММ.$ceTOI !== null`). That happens when the player
enters the multiplayer lobby. It is *inferred*, not proven, that the server sends the task
soon after authentication on that connection. It must at least be generated per session,
since the source contains the session's IP address, token and separator (§6.6).

### 5.2 End

The exchange ends at step [8], when the reply has been queued. Steps [9]–[11] are ordinary
reliable delivery. The reply is retransmitted until acknowledged or until the connection
drops; `$рсНAе.$pIсpo = 30 s` is the stale-message timeout checked at `connection.js:888`.

**On the client, nothing persists.** `let FP = class FP {…}` is block-scoped inside the
evaluated arrow function, so the class, its statics `FP.hash1` / `FP.hash2`, and the
canvases become unreachable once the function returns. The payload writes no cookie,
`localStorage` or IndexedDB entry, and makes no network request of its own. Its only output
is the return value.

---

## 6. The Pushed Payload

The payload is 7,371 characters long. Version `b8354ed91036` is quoted here in full, broken
into the pieces discussed.

### 6.1 Shape

```js
( v )=>{
    try {
        let FP = class FP {
            static getBrowserFingerprint({ hardwareOnly = false, enableWebgl = false, debug = false } = {}) { … }  // §6.2
            static getCanvasID(debug)  { … }    // §6.3
            static getWebglID(debug)   { … }    // §6.4, never called
            static getWebglInfo()      { … }    // §6.4, never called
            static murmurhash3_32_gc(key) { … } // §6.7
        };
        let arr = [];
        …                                        // §6.5
        return arr.reverse().join( 'с' );
    }
    catch(e){ return e.toString(); }
}
```

The function has a single parameter, so this is the **synchronous** `RELIABLE_TASK` form.

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

Three serializations follow:

- **`data`.** If `hardwareOnly`, this is the hardware set below; otherwise it is the full
  set. It is serialized as `JSON.stringify(...)`.
- **`FP.hash1`, "hardware-only".** The fields are `canvas, colorDepth, deviceMemory,
  devicePixelRatio, hardwareConcurrency, height, maxTouchPoints, pixelDepth, platform,
  touchSupport, webgl, webglInfo, width`. It leaves out everything a user can change
  without changing machines (language, timezone, UA, DNT, cookies).
- **`FP.hash2`, "full".** It contains all of `hash1` plus `cookieEnabled, doNotTrack,
  language, languages, timezone, timezoneOffset, userAgent, vendor`.

Then it hashes and returns:

```js
const datastring = JSON.stringify(data, null, 4);
if (debug) console.log('fingerprint data', datastring);
FP.hash1 = JSON.stringify({ … });
FP.hash2 = JSON.stringify({ … });
const result = FP.murmurhash3_32_gc(datastring);
return result;
```

Keys are listed alphabetically, so the output is deterministic. `webgl` and `webglInfo` are
`undefined` (§6.4), and `JSON.stringify` drops them. That is why they are missing from the
observed values.

Despite their names, **`hash1` and `hash2` are not hashes.** They hold the raw
`JSON.stringify` output, so the server receives every component value. `data` is already a
string, so `datastring` is that string stringified again: wrapped in quotes, with its inner
quotes escaped. The returned hash is computed over this doubly encoded text.

### 6.3 `getCanvasID`

```js
const text = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`~1!2@3#4$5%6^7&8*9(0)-_=+[{]}|;:',<.>/?";
ctx.textBaseline = 'top';
ctx.font = "14px 'Arial'";
ctx.textBaseline = 'alphabetic';
ctx.fillStyle = '#f60';
ctx.fillRect(125, 1, 62, 20);
ctx.fillStyle = '#069';
ctx.fillText(text, 2, 15);
ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
ctx.fillText(text, 4, 17);
const result = canvas.toDataURL();
…
return FP.murmurhash3_32_gc(result);
```

It renders on a default 300×150 2D canvas: an orange box, then the printable-ASCII line
twice, the second copy in translucent green and offset by (2, 2) so the two overlap and
blend. It then hashes the PNG data URL. The result changes with the GPU, driver, font
rasteriser, installed fonts (`'Arial'` falls back on Linux) and anti-aliasing. It is the
highest-entropy hardware signal in the set. Any exception returns `null`.

### 6.4 `getWebglID` and `getWebglInfo`, present but never run

`getWebglID` draws a triangle strip with a fixed shader pair on a 256×128 WebGL canvas,
reads the pixels back with `readPixels`, and hashes their JSON. `getWebglInfo` returns
`VERSION`, `SHADING_LANGUAGE_VERSION`, `VENDOR` and the supported-extension list.

Neither runs. The payload calls `FP.getBrowserFingerprint( false, true )`, passing two
booleans positionally, but the method takes one options object:
`({ hardwareOnly = false, enableWebgl = false, debug = false } = {})`. Destructuring the
primitive `false` boxes it to a `Boolean`, which has none of those properties, so all three
take their defaults and `enableWebgl` stays `false`. (Verified: `const {a = 1} = false`
gives `a === 1`.) The `true` is ignored. If the call had been written
`{ enableWebgl: true }`, the reply would also carry a WebGL render hash and the GPU
driver's identity strings.

`getWebglID` has a bug of its own as well: it enables `j.vertexPosArray`, a property that
was never set, rather than `j.vertexPosAttrib`.

### 6.5 Assembling the reply

```js
let arr = [];
try { arr.push( FP.getBrowserFingerprint( false, true ).toString( 36 ) ); } catch(e) { arr.push( e.toString() ); }
try { arr.push( Intl.DateTimeFormat().resolvedOptions().timeZone ); }       catch(e) { arr.push( e.toString() ); }
arr.push( '117x9h5' );          // written by the server, per session
arr.push( '180.190.127.30' );   // written by the server, per session
arr.push( location.origin );
arr.push( v );
arr.push( FP.hash1 );
arr.push( FP.hash2 );
return arr.reverse().join( 'с' );   // separator written by the server, per session
```

Two things to note:

- `getBrowserFingerprint` must run first, because it is what sets `FP.hash1` and
  `FP.hash2`. The `reverse()` then puts them first in the output.
- If `getBrowserFingerprint` throws, its slot holds the error text, and `FP.hash1` /
  `FP.hash2` are pushed as `undefined`, which `join` writes as empty strings.

### 6.6 What the server writes into the source

Three literals differ between sessions. The server must therefore generate the source for
each connection.

| Literal | Session A (earlier capture) | Session B (saved payload) |
|---|---|---|
| IP address | `180.190.136.53` | `180.190.127.30` |
| Token | `s27zkf` | `117x9h5` |
| Separator | `У` (U+0423 CYRILLIC CAPITAL U) | `с` (U+0441 CYRILLIC SMALL ES) |

- **IP address.** The client cannot learn its own public address without a request, and
  this payload makes none. So this is the address the server saw the socket connect from,
  sent back to it. One plausible use (*inferred*): to catch a reply relayed from a
  different machine, or to tie it to a connection behind a proxy.
- **Token.** It looks like base 36 and is 6–7 characters long. Nothing on the client
  derives it. The likeliest use (*inferred*) is a per-session nonce, so that the server
  can match the reply to its request and reject a replayed one.
- **Separator.** A different Cyrillic letter each session. A fixed parser cannot split
  the reply unless it knows the session's separator. The letters are also the kind of
  look-alike characters the client's obfuscator uses.

The source of the wrapper around `FP` (`let arr = []` onward) is indented with tabs, which
suggests it is a template on the server. The `FP` class is pasted in unindented.

### 6.7 `murmurhash3_32_gc`: a defective MurmurHash3

The hash is Gary Court's JavaScript MurmurHash3 (x86, 32-bit), as shipped in
`get-browser-fingerprint`, with no seed (`h1` starts as `undefined`, which acts as 0). It
deviates from the reference algorithm in three ways:

1. **Every fifth character is skipped.** The main loop is
   `for (let i = 0; i < bytes; i++) { …charCodeAt(i), (++i), (++i), (++i)…; ++i; }`. The
   original is a `while` loop with only the inner `++i`. The extra `i++` of the `for`
   advances 5 per block of 4, so characters at index 4, 9, 14, … never reach the hash.
   (Verified: `"abcdXfghij"` and `"abcdYfghij"` hash the same.)
2. **The tail mixes in only one character.** Each `case` of the remainder switch ends with
   `break`, where the reference falls through. The index is also off by one
   (`const i = bytes - 1`). The only character mixed in is the one at
   `bytes + remainder - 2`.
3. **Only the low 8 bits of each UTF-16 code unit count** (`& 0xff`), as in the original.
   For the ASCII-only inputs here (JSON and a base-64 data URL) this loses nothing.

So the hash is weaker than MurmurHash3 and cannot be checked with a standard
implementation. It is still deterministic, which is all an identifier needs. Running the
payload's own function on Session A's `datastring` gives 328055372 (0x138dba4c), in base 36 **`5fbd58`**,
exactly the value observed.

### 6.8 Provenance

The method signature, the destructuring list, the alphabetical key order, the
`// undefined will remove this from the stringify down here` comments, the
`'fingerprint data'` debug label, and the `getCanvasID` / `getWebglID` / `getWebglInfo` /
`murmurhash3_32_gc` functions with their drawing code all match the npm package
**`get-browser-fingerprint`**. The PB2 version makes them static methods of a local
class, adds the `FP.hash1` / `FP.hash2` side outputs (the raw JSON), and wraps the call in
the reply-building template. This attribution rests on textual identity with the package;
it was not checked against a specific package version.

---

## 7. The Response

### 7.1 Decoded wire form

```
"\x03" \x02 "r" \x02 "<F0> SEP <F1> SEP <F2> SEP <F3> SEP <F4> SEP <F5> SEP <F6> SEP <F7>"
  │         │        └ one part: the returned string
  │         └ callback id 110
  └ RELIABLE_RESPONSE (0)
```

The string is a **single** message part. `SEP` is the session's separator from §6.6. It is
an ordinary letter, so the framing does not escape it.

### 7.2 Fields (Session A)

| # | Value | Source in the payload | What it is |
|---|---|---|---|
| F0 | `{"canvas":280615347,…,"width":1920}` (21 keys) | `FP.hash2` | Full fingerprint, raw JSON |
| F1 | `{"canvas":280615347,…,"width":1920}` (11 keys) | `FP.hash1` | Hardware-only fingerprint, raw JSON |
| F2 | `mkpnduz2` | `v` | Client build tag `$ерОр0` (`frame2.js:5413`) |
| F3 | `https://www.plazmaburst2.com` | `location.origin` | Page origin (where the client is served from) |
| F4 | `180.190.136.53` | server literal | The client's IP address as the server saw it, echoed back |
| F5 | `s27zkf` | server literal | Per-session token |
| F6 | `Asia/Tokyo` | `Intl…resolvedOptions().timeZone` | Time zone, again, outside the JSON |
| F7 | `5fbd58` | `getBrowserFingerprint(…).toString(36)` | Defective MurmurHash3 (§6.7) of F0 stringified a second time, in base 36 |

Every field is now accounted for in the code. F7 is redundant for the server: it can
compute it from F0. It is the compact identifier the upstream library would have returned
on its own.

### 7.3 Observed component values and what they reveal

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
| `canvas` | `280615347` | The canvas hash of §6.3, a 32-bit unsigned value. |

---

## 8. Limitations

1. **One version.** Everything about the payload describes version `b8354ed91036`. The
   collector is data, not code shipped in `game/`, so the server can change it at any time
   without a client update. The dev console keeps every version it sees (§10).
2. **Server behaviour is not observable.** When the task is sent, how often, how the
   token and separator are generated, how F4 and F5 are checked, and what happens when no
   reply comes all live on the server. The roles in §6.6 are inferred.
3. **Two sessions.** The per-session literals were identified by comparing two sessions.
   Another literal that happened to be equal in both would not stand out.

---

## 9. Implications for Developers

- **`RELIABLE_TASK` is arbitrary code execution by design.** Whoever controls the
  main-server connection can run any JS in the game page with full access to the
  multiplayer singleton, the active connection, and the page's DOM and storage. In this
  client the sole guard is the `connection === $ММ.$ceTOI` check. Anything that can stand
  in as the main server, such as a private server or a man-in-the-middle on a downgraded
  transport, inherits this capability.
- **Tampering is detectable.** The reply echoes the session's IP address and token, and is
  split on a separator only the server knows in advance. A reply built without running
  this session's source, for example one replayed or generated by a fixed script, would
  likely fail the server's checks (*inferred*). A reply with different component values
  would pass as long as F7 is recomputed with the defective hash.
- **Fingerprint stability.** `hash1` survives changes to browser, language, VPN and
  timezone. It is tied to the hardware, display and rendering stack, so it changes with a
  monitor, DPI or GPU-driver change. `hash2` (and F7, which is derived from it)
  additionally breaks on any UA bump, which happens with every Electron upgrade of the
  desktop wrapper. Having both lets the server match a player at two levels of
  granularity.
- **Correlation surface.** The server can join F0/F1 with F4 (IP), F6 (timezone) and the
  authenticated account on the same socket. That links accounts sharing a machine (`hash1`
  equal), accounts sharing a browser profile (`hash2` equal), and timezone/IP
  inconsistencies, which suggest a VPN or proxy.

---

## 10. Reproducing This

- **Capture.** `desktop/dev/console/net/fingerprint.js` listens on the lobby connection's
  receive method (through `net/tap.js`) and spots a `RELIABLE_TASK` whose source contains
  `getBrowserFingerprint`. It sends that source to the wrapper.
- **Storage.** `desktop/fingerprint.js` stores each version once in `fingerprint/` (not in
  git). A version is the code with its string and number contents, comments and spacing
  removed, so the per-session literals of §6.6 are not a new version. A known version that
  arrives with new literals rewrites its file. `fingerprint/index.json` records first and
  last seen, how often, and which version is the latest.
- **Running it.** The console command `fingerprint` runs the latest version the way the
  game does, `(source)(\`<build tag>\`)`, without sending anything. It splits the
  returned string on the separator found in the source and labels each value.
  `fingerprint --raw` prints the single part as the game would send it, and
  `fingerprint list` lists every saved version.

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
| Payload, version `b8354ed91036` | `fingerprint/2026-11-01_10-57-35_b8354ed91036.js` (local, not in git) |

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
