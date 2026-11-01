# remote_play

Feature flag `remote_play` (on by default; remote mode only, `npm run host`; not for Sad
Burst 2). Code: `src/features/remote_play/`. How to run it:
[remote-play](../operations/remote-play.md).

With the flag off, `npm run host` logs that remote play is off and quits.

## What a tester gets
- Testers open a link in any browser. They receive only JPEG frames of an offscreen game
  window on this machine and send only keys and mouse, so no file of the project leaves
  it. The server sends three files, the built client (`dist/remote-client/`): the page, its
  script and its style, with a strict Content-Security-Policy. Everything else is 404.
- A link is `<address>/#t=<token>`. The token stays after `#`, so it is never part of a
  request URL (or a tunnel's log); the page sends it once, over the WebSocket, as
  `hello`.

## Testers file
- `data/remote-testers.json`, versioned (`schemaVersion` 1), written with mode 0600.
  A file without a version is read as v0 and written back as v1. A broken file counts
  as no testers.
- A token is 24 random bytes (192 bits) in base64url. Adding an existing name gives it a
  new token; the old link stops working.
- The host reads the file on every connect, so no restart is needed. Tokens are compared
  through their SHA-256 hashes with `timingSafeEqual`, every one of them.

## The host
- One game per tester, made on their first connect, kept 2 minutes after they leave so a
  reconnect continues it, then closed. A connect while the game is starting waits for the
  same start. The newest tab wins; the older one is told and closed (code 4002).
- The page must say `hello` within 5 s (else 4005). Dead connections are dropped after one
  missed ping (20 s). Input messages are at most 4096 bytes; a bigger one closes that
  connection (1009), never the host: every socket error is handled, because an unhandled
  one in Electron is a dialog on the host's screen.
- At most 600 input messages a second; more are dropped. Frames are skipped while more
  than 1.5 MB waits to go out, and sent at most at the stream's fps.
- Wrong links are counted per address: the first and the tenth are logged, and after ten
  in a minute that address waits a minute (even with a right link). Tokens cannot be
  guessed; this keeps anyone from trying fast, and shows the host that someone tries.
- Through a tunnel on this machine every connection comes from 127.0.0.1, so then the
  tunnel's `cf-connecting-ip` or first `x-forwarded-for` address counts. From anywhere
  else those headers are ignored: anyone could send one.
- Keys still down when a tester leaves are released, so the game does not keep running
  left.

## Input
- Messages carry modifier bits (1 shift, 2 ctrl, 4 alt, 8 meta): `kd`/`ku` (key down/up
  with `code`, `key` and repeat), `mm` (mouse move), `md`/`mu` (button 0 left, 1 middle,
  2 right), `wh` (wheel). Mouse positions are clamped to the stream.
- Keys map by `KeyboardEvent.code` (the key's place, not the layout) to Electron's
  accelerator names. A printable character without ctrl or meta also sends a `char`
  event, so typing works in the console and the game's chat.
- Chromium counts wheel deltas up as positive; the DOM counts down: the sign is flipped.
- Blocked keys become no event at all: ctrl/meta+V and shift+Insert (paste reads the
  host's clipboard), ctrl/meta+shift+I/J/C (DevTools), ctrl/meta+U/P/S/O (source, print,
  save, open).

## Lockdown of a tester's window
- Its own session (`persist:remote-<name>`, so saves and settings survive) and its own
  console settings in `data/remote-data/<name>/`. It is logged in like the local
  window.
- No DevTools (off at creation, closed if opened), no menu, no new windows, no
  `<webview>`, every permission refused, downloads canceled, muted.
- It may load only the game's start page (any query or `#`). A page load
  (`sec-fetch-dest` document, iframe, frame, embed or object) of any other file is
  refused with 403 even before the lockdown sees it, so the window can never show the
  console's or hooks' files.
- The page gets `PB2_REMOTE` before any script, not enumerable, so the game's for...in
  walks over `globalThis` (quicksave, the anti-tamper scan) do not see it. The clipboard
  is shut both ways: paste would show the host's clipboard, copy and cut would let a
  tester plant text in it. If the page has no `<script>` tag to put it before, the page
  is not served at all.
- Frames are exactly the window's size: the device scale factor is forced to 1.

## The console in remote mode
- Commands marked `remote: false` (`js`, `hooks`) do not exist.
- Everything printed passes the redactor (`domain/redactor.ts`): project paths (`src/`,
  `dist/`, `data/`, `docs/`, ...), source and config file names (`.ts`, `.js`, `.json`,
  `.md`, ...), and the game's obfuscated names (with a Cyrillic letter, typed with `\u`
  escapes, or listed in `names.js`) become `‹hidden›`. A path never ends in `.` or `:`, so
  a sentence's full stop stays. Since the move to `src/`, `src/` and `dist/` paths and
  `.ts` files are hidden too, and a name from `names.js` is hidden only as a whole word.
