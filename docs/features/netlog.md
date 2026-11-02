# netlog: the network recorder

Feature flag `netlog` (on by default; local and server modes, and remote play).
Recording itself also follows the console setting `net_log`, which is on by default.
Code: `src/features/netlog/`. The protocol codec and the method tap live in the console
kernel (`src/console/kernel/net/`), because the fingerprint capture uses them too.

Capabilities: `netlog.status` (`netlog`), `netlog.show`, `netlog.runs`, `netlog.record`
(recording itself, the `net_log` key, `netlog on` and `off`), and on top of recording
`netlog.all` (`netlog all`, `net_log_all`) and `netlog.state` (`net_log_state`). Without
`netlog.record` nothing is recorded; `show` and `runs` still read earlier logs. Each
capability has its folder under `capabilities/`. The status line of `netlog` is built from
what the app has: `all` and `state` add their part of the header, and `show`, `runs` and
`record` their hint (`services/status-lines.ts`); `show` reads the run list `runs` made
(`services/run-list.ts`).

## What it does

The game's connections are read in the page, the lines are posted to the wrapper, and
the wrapper writes them as readable text, one file per run and game instance:

    data/netlogs/<date>_<time>_<instance>.log

- A **run** is one start of the app.
- An **instance** is a game window:
  - `local` (or `sadburst`);
  - `server` for the p2p host;
  - `tester-<name>` for a remote play tester.
- Several apps running at once each write their own files. If two start in the same
  second, the second one's files are named `<name>-2.log`.
- `netlog runs` lists every file, and `netlog show run:<n>` reads another one. A
  remote tester sees only their own file.

## The protocol, as recorded

The protocol lives in the game's `scripts/connection.js`; see also
[anticheat](../research/anticheat.md) §13.3. A packet is text, with fields split by
`\x01` (written `$.1` inside a field):

    ack | latest unreliable state | uid | reliable message | uid | reliable message ...

- **ack**: the highest reliable sequence number received in order.
- **state**: one unreliable message, the newest. An unsent older one is replaced.
- **reliable messages**: numbered 0, 1, 2 … per connection.
  - Every packet repeats every message that is not acknowledged yet, until its ack
    arrives, about one round trip later. The game sends a packet about every 16 ms.
  - That repeating is normal and is not loss. `STAT` counts it as `repeated`.
  - A message's parts are split by `\x02` (written `$.2`). Part 0 is its type, an
    encoded number; the game's type names map it to `RELIABLE_...`.
- **numbers** inside messages are written in base N with the game's digits: the
  characters 1–126 except a few, so they look like control characters and punctuation.
  - The callback ID a `RESPONSE` answers is decoded as a number even when it looks like
    a letter. The counter starts at 100, so the first ID is `h`.
  - So is every part of `RESPAWN`, `RESSURECT` and `HEAL_PLAYER`, and every part of
    `HIT_PLAYER` except the server's trailing kill flag
    ([anticheat](../research/anticheat.md) §14.9).
- **transports**: a socket.io socket, sent *volatile* (dropped when the socket is busy),
  or a peer-to-peer data channel (unordered, never retransmitted).

### What counts as packet loss

| Line | Meaning |
|---|---|
| `slow ack` | a message acknowledged more than 500 ms after the ping (`SLOW_ACK_MS`) |
| `no ack` | a message still not acknowledged after 2 s (`STALL_MS`); said once per message |
| `dropped` | socket.io dropped a packet before sending it, because the socket was busy |
| `gap` | a reliable message arrived before an earlier one: lost or out of order |
| `late` | a message from a gap arrived; says how long it took |

Unreliable state updates have no number, so their loss cannot be seen one by one; the
`STAT` line counts them per second.

### State updates

`net_log_state` writes every state update, and `net_log_all` includes it.

- A client's own state is decoded by position. The positions the server reads (HP,
  respawn count, aim, head and face HP, position, killer, clock) come from the game's
  network class (`stateHp` …, found by `find-names`), so they follow a new game layout
  by themselves.
- The other positions are this version's layout (`KNOWN_STATE_LAYOUT`,
  `EXTRA_STATE_LAYOUT`). They are used only while the game's own positions still match
  and the part count is 21. Otherwise those parts are shown as `p<index>`.
- The server's snapshot is read as: the header (`~~` waiting, `~` paused, then the round
  timer in ms), then for each changed player their slot, the server's copy of their HP,
  `ping~skill~reputation`, and their state.

## How it reads the connections

- The connection's receive method is tapped through the kernel's `tap` (one wrapper per
  method, shared with the fingerprint capture).
- Its socket's `emit` and its peer's `send` are wrapped on each connection object, and
  only while `net_log` is on.
- Nothing global or on the network class is replaced: the game's anti-tamper scan
  compares those ([anticheat](../research/anticheat.md) §6).
- A connection that closes, or recording turned off, is unwrapped, and the game's
  objects are exactly as before.

## Secrets are never written

The recorder hides secrets before a line is formed (`domain/redaction.ts`):

| Message | Part | Holds |
|---|---|---|
| `AUTHENTICATE` | 2 | the login password, from the game's login cookie; on a private server, the server password |
| `JOIN_MATCH` | 5 | the password typed for a protected match |
| `CREATE_MATCH` | 1, field `password` | the new match's password |

- A non-empty value is written as `‹redacted›`; an empty one stays `""`.
- The recorder still matches a `RESPONSE` to its request using the parts as sent.
- The part positions come from the game's sending code. In `MPLobby.js`, AUTHENTICATE's
  parts are `[type, login, password, version, …]`. In `MPCreateMatch.js` and
  `GameScene.js`, JOIN_MATCH's last part is the match password.
- Logs written before this change can be cleaned with `npm run redact-netlogs`. It
  rewrites `data/netlogs/*.log` in place, reports counts only, and running it twice changes
  nothing.

## Limits

| Constant | Value | Why |
|---|---|---|
| `PART_CHARS_MAX` | 2000 | a longer part (a map chunk, a match list) is cut, unless `net_log_all` is on |
| `BUFFER_MAX` | 5000 | lines this page keeps for `netlog show` |
| `PENDING_MAX` | 20000 | lines waiting for the wrapper |
| `LINE_CHARS_MAX` | 16 MB | one line, a bound against a runaway page; with `net_log_all` a whole map is one line |
| `POST_LINES_MAX` | 20000 | lines per POST |
| `READ_TAIL_BYTES` / `READ_LINES_MAX` | 4 MB / 20000 | how much of a file `netlog show run:` reads |
| `FILE_ACTIVE_MS` | 15 s | a file written this recently belongs to a running instance |

The lines still waiting when the page goes away are sent with
`navigator.sendBeacon`. A beacon is limited to about 64 KB, so a very large last batch
can be lost.

## Routes

| Route | Method | Answer |
|---|---|---|
| `__dev/netlog` | POST, a JSON array of lines | `{ run, file }`. 400 if the body is not JSON; 500 (and a `netlog.write_failed` log event) if it cannot be written |
| `__dev/netruns` | GET | every log, with `mine`, `active`, `current`; a tester gets only theirs |
| `__dev/netread?run=&lines=` | GET | the last lines without the header. 400 for a bad name, 404 when there is none, 403 for a tester asking for another file |

With the flag off, the console has no `netlog` command and nothing ticks, and the routes
answer 404.
