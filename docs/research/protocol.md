# The multiplayer protocol

The one socket the game speaks, in one place: how a packet is framed, what the numbers are,
which messages exist, what each carries, who may send it, and how to make one or watch one.

Facts are taken from the shipped client (`game/scripts/connection.js`,
`game/scripts/libs/flash.js`) and its server-side handlers; line numbers are the decoded ones
(`npm run find-names -- --decode <file>`), the same numbers in `game/`. Checked against build
v1769098419. Anything observed live is marked as such.

Scattered elsewhere, not repeated here: the recorder that shows all this in game
([netlog](../features/netlog.md)), the anti-cheat's use of it (`anticheat.md` §13-§14), the
reputation calls ([reputation.md](reputation.md)), the tamper scan it can trigger
([scan-gating.md](scan-gating.md)).

## The socket

| | |
|---|---|
| Endpoint | the lobby's own TCP port, `2053`, spoken as socket.io over a websocket |
| Who connects | every client to its lobby; in a player-hosted match, also each client to the host |
| Two transports | socket.io (retransmitting) and a WebRTC data channel (`simplepeer`, unordered, never retransmitted) |
| Sending | volatile: a packet in flight is dropped rather than queued (`scripts/connection.js`) |
| Cadence | a packet about every 16 ms; every unacknowledged reliable message is repeated until acked |

A packet is text:

```
ack | state | uid | reliable message | uid | reliable message | …
```

- **`ack`** — the highest reliable sequence number received in order.
- **`state`** — one unreliable message, the newest; an unsent older one is replaced.
- **reliable messages** — numbered per connection, `0`, `1`, `2` … Every one that is not acked
  yet is repeated in each packet until its ack arrives, roughly one round trip later.
- **Split characters** — fields by `\x01`, a message's parts by `\x02`, both written `$.1` and
  `$.2` inside a field.

**Numbers are not decimal.** Each is written in base N with the game's own digit alphabet:
the characters 1-126 except a few, so they look like punctuation and control characters
(`src/console/kernel/net/codec.ts` decodes them; the counter for reply ids starts at 100, so
the first id is `h`). A part is only a number if the receiving side reads it as one: the same
`"1"` is a digit in one message and the string `"1"` in another.

## Requests and replies

A message that wants an answer carries the shared placeholder object
(`Multiplayer.CALLBACK_UID_PLACEHOLDER`, `flash.js:77`) in the slot where the reply id goes.
The sender swaps it for its own counter and files the callback under it
(`connection.js:693`); the answer is a `RELIABLE_RESPONSE` whose first value is that id
(`flash.js:1868`, `:1888`):

```
send:  [<opcode>, …parts…, <reply id>]
reply: RELIABLE_RESPONSE [<reply id>, …values…]
```

The client reads a reply's first value as its payload, e.g. `["ok", <json>, <json>]` for the
match list or `[<server string>]` for a report.

## The messages

Opcodes are not fixed constants: they come from a counter in load order (`flash.js:82`), so
name them. With this build, counting from 0, the table below holds for
`RELIABLE_<name>`.

**Directions.** `CHAT` is the only message a client sends to its lobby that the lobby does not
also send (`$ppМl0M`, `flash.js:1754-1760`); everything else the client sends is answered or
relayed. On the lobby, a message from a player who is not in a match is ignored, and so is
every non-`CHAT` message while that match is player-hosted (`$НeеoрН`, `:1802-1835`). While
spectating, only `CHAT`, `JOIN_MATCH`, `RESPONSE`, `CLIENT_READY_FOR_FIRST_SYNC`,
`REPORT_USER`, `ENDORDSE_USER`, `KICK_USER`, `BAN_USER` and the two p2p replies go through
(`$eоОHHO`, `:1730-1753`).

| Op | Message | Parts the handler reads | What it carries |
|---|---|---|---|
| 0 | `RESPONSE` | `1` | the reply id and the values (`:1963`) |
| 1 | `EXEC_TRIGGER` | `1,2,3` | trigger run: target, power, activator (`:4651`) |
| 2 | `RESPAWN` | `1..4` | position and view of a respawn (`:3830`, `:4014`) |
| 3 | `GRENADE_THROW` | — | thrown grenade |
| 4 | `HIT_PLAYER` | `1..15` | damage, body part, position, gun (`:3866`, `:4314`) |
| 5 | `DAMAGE_PLAYERS_VIA_EXPLOSION` | `1` | explosion and its damage list (`:3934`) |
| 6 | `HEAL_PLAYER` | `1..4` | target, healer, power, force (`:3990`, `:4049`) |
| 7 | `PROJECTILE_CREATE` | `1..4` | projectile type, owner, position, velocity (`:4050`) |
| 8 | `PROJECTILE_REMOVE` | `1,2,3` | the projectile that ended (`:4241`) |
| 9 | `BARREL` | `0..5` | barrel interaction (`:4807`) |
| 10 | `THROW_GUN` | `1..9` | a dropped gun and its state (`:4142`) |
| 11 | `HIT_GRENADE` | `1..4` | grenade hit (`:4261`) |
| 12 | `PLAYER_DIES` | `1..7` | whose death, and how (`:2082`) |
| 13 | `HIT_SHIELD` | `1..4` | shield damage (`:4556`) |
| 14 | `CHAT` | `1,2` | destination and text; the lobby caps it at 5 a second and 240 characters (`:4014-4024`) |
| 15 | `CREATE_MATCH` | `1,2` | settings JSON and reply id; once a second, refused at negative reputation (`:2667`, `:2671`) |
| 16 | `AUTHENTICATE` | `1..8` | login, password, version, hash, uid, device, timestamp; answered `["ok", <profile>]` or `["fail", <why>]` (`:1982`) |
| 17 | `LIST_ME_AS_HOST` | — | tells the lobby this client hosts a match |
| 18 | `SERVICE_MESSAGE` | `1` | a server line shown in chat (`:2042`) |
| 19 | `GET_MATCH_LIST` | `1,2,3` | filter JSON, reply id, and which view: `match_list`, `relations` or `skill_board` (`:2497`); once per 300 ms |
| 20 | `JOIN_MATCH` | `1..5` | match uid, reply id, slot, spectator flag, password (`:2932`) |
| 21 | `MATCH_JOIN_RESPONSE` | `2,3` | the match details JSON and the slot you take (`:3315-3345`) |
| 22 | `MAP_CHUNK` | `1,2,3` | chunk index, chunk count, and the text of one piece (`:3268`) |
| 23 | `CLIENT_READY_FOR_FIRST_SYNC` | — | asks the match for its first state (`:3395`) |
| 24 | `FIRST_SYNC_RESPONSE` | `1,2,3` | slot, the player's JSON (login, nickname, auth_id, team, …), and whether it is a spectator (`:3421`) |
| 25 | `MY_PLAYER_PROPERTIES_CHANGED` | — | your own player fields: `team`, `skin_snapshot`, `slot0…slot9`, `curwea` only (`flash.js:216-221`, `:3526`) |
| 26 | `PING` | `1,2,3` | part 1 is the reply id and the answer is empty; the anti-tamper report reuses it with the string `"undefined"` in part 1, then mode and detail, and is never answered (`:3066-3078`) |
| 27 | `REPORT_USER` | `1,2,3` | target auth id and reply id; self refused (`:2845`, `:2871`) |
| 28 | `ENDORDSE_USER` | `1,2,3` | same shape, the opposite relation (`:2846`) |
| 29 | `KICK_USER` | `1,2,3` | target auth id, reply id, and whether to keep them out (`:2847`) |
| 30 | `MATCH_INFO_PARTIAL_UDPATE` | `1,2` | one field of the match, as JSON (`:3292`) |
| 31 | `PLAYER_SCORE_UPDATE` | `1,2,3` | auth id, kills, deaths; the lobby drops a player's own (`:2060-2079`) |
| 32 | `PLAY_SOUND` | `1` | a sound to play (`:3302`) |
| 33 | `BAN_USER` | `1,2,3` | target auth id, reply id; staff only (`:2848`, `:2886`) |
| 34 | `RESSURECT` | `1..4` | revive (`:3831`) |
| 35 | `SWORD_ATTACK` | — | a sword swing |
| 36 | `VAR_SYNC` | `1,2,3` | a map variable (`:4677`) |
| 37 | `FLOW_AT` | `1,2,3,4,5,6` | where a shot is going (`:4718`) |
| 38 | `AI_STATE_SYNC` | `1..14` | a bot's state (`:4730`) |
| 39 | `AI_HEALTH_SYNC` | `1..6` | a bot's health (`:4784`) |
| 40 | `TASK` | `1,2` | code the page runs with `eval`, and a reply id (`:3730`; hence [lobby_task_guard](../features/lobby-task-guard.md)) |
| 41 | `TASK_ASNYC` | `1,2` | the same, asynchronous (`:3751`) |
| 42 | `YOU_ARE_STILL_DEAD` | — | the respawn was refused (`:3511`) |
| 43 | `ENTER_RESPAWN_QUEUE` | `1,3,4` | asking to respawn (`:3775`) |

Parts the handler reads are not the parts the sender writes: a message can carry more than it
is read for, and extra parts are ignored (proven for `ENDORDSE_USER`, see
[reputation-probe.md](reputation-probe.md#observed-so-far)).

## Crafting one

In the page, with the dev console ([js](../features/js-eval.md)). `RELIABLE_<NAME>` is a
property of the network class, which is a top-level class, so it is a binding rather than a
`globalThis` property:

```
js (0,eval)(PB2_NAMES.net).RELIABLE_ENDORDSE_USER
```

Sending, with the reply as a promise-ish callback — `Multiplayer.$p1еeс` is the placeholder
object, and `PB2_NAMES` names it:

```
js globalThis.reply=[];(()=>{const N=PB2_NAMES,M=(0,eval)(N.net),c=M[N.lobbyConn];c[N.netSend](M[N.netChannel],[M.RELIABLE_GET_MATCH_LIST,"{}",M[N.netReplyTo],"match_list"],r=>{reply.push(Array.from(r))})})()
js JSON.stringify(reply)
```

Rules that save an evening: `connected` must be true (a logged-in lobby connection),
`reply` stays empty when the id or the message type is wrong, and a message the server does not
answer leaves nothing to read — use `netlog` instead of guessing.

## Watching one

`net_log on`, then `netlog show` prints every packet with type names, decoded numbers, and a
line for each request/reply pair (`IN`/`OUT REL #n`, and `<- answers #m`). The whole run is
also a text file under `data/netlogs/` ([netlog](../features/netlog.md)).

## Re-checking the table

```
npm run find-names -- --decode scripts/libs/flash.js > /tmp/flash.js
rg -n '"(RELIABLE_[A-Z_]+)"\]=\$сеMlO' /tmp/flash.js      # opcode order
rg -n 'type===\$ММ\["RELIABLE_' /tmp/flash.js            # the dispatch, in order
rg -n 'parts\[[0-9]+\]' /tmp/flash.js                     # what each branch reads
```

Opcode numbers move when a game update adds or reorders a message; names do not. If a table row
no longer matches, the claim is to be corrected here (see "Reporting fixes" in `AGENTS.md`).

## What is not here

- The bytes inside a match's *state* message (position, HP, aim, …), which
  [anticheat.md](anticheat.md) §13 maps field by field.
- What the lobby decides to do with a message once it has it — the account module is not
  shipped ([reputation.md](reputation.md)).
- The private server's side of the same protocol: it runs this very code
  ([private-server](../operations/private-server.md)).

## The messages in detail

Opcode, dispatch line and every send site for all 44 are in
[protocol-messages.md](protocol-messages.md) (`npm run protocol` regenerates it). What follows
is what each one carries and what the receiving side does with it, for the messages a client
actually talks to the lobby with; the gameplay ones point at their handler, which
[anticheat.md](anticheat.md) §14 reads field by field.

Encoding note that applies to every table below: a part marked **number** is written in the
base-N digit alphabet and read through the game's own `parseInt`-equivalent; a part marked
**string** is passed through untouched; **JSON** parts are `JSON.parse`d. A part the handler
never reads can be anything.

### 16 · AUTHENTICATE — client → lobby

`flash.js:1982-2040`, sent from `MPLobby.js:152-160`.

| Part | Kind | Meaning |
|---|---|---|
| 1 | string | login, as in the site's cookie |
| 2 | string | password (the site's, or an admin's secret on a private server) |
| 3 | string | game version, `version_h5` |
| 4 | string | build hash, `hash_h5` |
| 5 | number | reply id |
| 6 | string | first uid, or empty |
| 7 | string | device fingerprint, quoted JSON |
| 8 | number | build timestamp; missing → `Server: Refresh page to get new version of the game` |

Answer: `["ok", <profile JSON>]` or `["fail", <why>]`. The profile is the object the client
keeps as its own (`nickname`, `login`, `login_proof`, `uid`, `mdl`, `mdl2`, `is_staff`,
`is_guest`, `is_vpn`, `is_public_supporter`, `support_months`). Retried at most once every
3 s (`:2001-2003`), first uid truncated at 60 characters (`:1998`).

### 19 · GET_MATCH_LIST — client → lobby

`flash.js:2497-2660`, sent from `MPLobby.js:210`, `:663-667`.

| Part | Kind | Meaning |
|---|---|---|
| 1 | JSON | the filter; `{}` usually, or `{"delete_relation": <since>}` to end a relation |
| 2 | number | reply id |
| 3 | string | view: `match_list`, `relations` or `skill_board` |

Answer: `["ok", <rows JSON>, <own JSON>]` or `["fail", "Match listing error: Too fast"]`. Own
JSON: `reputation`, `reputation_potential`, `skill`, `wins`, `loses`, `online`, `matches`
(`:2645`). One request per 300 ms per connection (`:2503`); the rows are listed per view in
[reputation.md](reputation.md#requests-and-replies).

### 15 · CREATE_MATCH — client → lobby

`flash.js:2667-2844`, sent from `MPCreateMatch.js`.

| Part | Kind | Meaning |
|---|---|---|
| 1 | JSON | the settings object; `min_reputation` is clamped down to the creator's own (`:2686`), `max_players` to 1..64 (`:2695-2701`) |
| 2 | number | reply id |

Refusals: `Date.now() > connection.lastCreate + 1000` gives "Too fast" (`:2671`), negative
reputation "Users with negative reputation can not start new matches" (`:2673`), data over 5000
characters "Too much data sent" (`:2679`). Answer: `["ok", <match uid>]` or `["fail", <why>]`.

### 20 · JOIN_MATCH — client → lobby

`flash.js:2932-3060`, sent from `MPLobby.js:452`, `:5136`.

| Part | Kind | Meaning |
|---|---|---|
| 1 | number | the match uid |
| 2 | number | reply id |
| 3 | number | slot asked for, `-1` for any |
| 4 | string | `"1"` = join as spectator, empty = play |
| 5 | string | match password |

Refusals, in order: "Match not found", a password cooldown after a wrong attempt
(`:2965-2974`), "Match is still being created", then everything `$lрTp1` checks —
[tune here](#where-the-join-check-runs) in [reputation.md](reputation.md#where-the-join-check-runs).
Answer: `["ok", <match details>, <slot>]` or `["fail", "Match join error: <why>."]`.

### 21 · MATCH_JOIN_RESPONSE — lobby → client

`flash.js:3315-3394`. Parts: 2 = the match details JSON, 3 = the slot you take. The client
starts the match screen and sets aside the map download before it asks for the first state.

### 23 · CLIENT_READY_FOR_FIRST_SYNC, 24 · FIRST_SYNC_RESPONSE — client → lobby → client

`:3395-3414` and `:3421-3510`. The client says it is ready; the lobby answers once per player
with part 1 = slot index, part 2 = that player's JSON (empty = the slot is now empty), part 3
= non-empty when the player is a spectator. The JSON's fields become the player object's
fields, which is where `login`, `nickname` and `auth_id` come from
([player-info](../features/player-info.md)). The client logs "X connected" and switches the
slot's actor into a player if the map had a bot there (`:3455-3460`).

### 22 · MAP_CHUNK — lobby → client

`:3268-3291`. Part 1 = chunk index, part 2 = chunk count, part 3 = the text of that chunk. The
client reassembles the map, then unpacks it with the game's own function.

### 26 · PING — both ways

`:3066-3078`. From a client: part 1 is the reply id and the answer is an empty list — that is
what keeps a connection's round trip measured. The anti-tamper report reuses the message: part
1 is then the literal string `"undefined"`, part 2 the mode, part 3 the detail, and the lobby
handles it without answering ([scan-gating.md](scan-gating.md)).

### 14 · CHAT — client → lobby → everyone

`:4014-4046` (lobby) and `:4587-4650` (client). Part 1 = destination as a number
(1 = everyone, other values the game's own), part 2 = the text. The lobby trims at 240
characters and allows 5 messages a second per connection (`:4016-4024`). Everything after
that is the match owner's command parser: `-announce`, `-min_reputation`, `-map`, `-endround`,
`-ping_action`, `-recheck` and the rest, each guarded by owner or staff (`:4029-4033`).

### 27-29, 33 · REPORT_USER, ENDORDSE_USER, KICK_USER, BAN_USER — client → lobby

`flash.js:2845-2930`. Part 1 = the target's auth id (a number, `parseInt`), part 2 = the reply
id, part 3 = `"1"` for the kick/ban "keep them out" flag, unread by report and endorse. Self is
refused against the lobby's own record (`:2871`). Answers and effects:
[reputation.md](reputation.md#what-a-report-or-an-endorsement-may-carry) and
[reputation-probe.md](reputation-probe.md#observed-so-far).

### 25 · MY_PLAYER_PROPERTIES_CHANGED — client → lobby → everyone

`:3526-3690`. Part 1 = a slot index (the target; it must be yours), then pairs of
property-index and JSON value. The property index addresses this whitelist and nothing else:
`team`, `skin_snapshot`, `slot0` … `slot9`, `curwea` (`flash.js:216-221`). Each value is
checked (a gun you actually hold, a slot that exists) and a bad one is answered by setting the
old value back on your own player (`:3576-3620`).

### 30 · MATCH_INFO_PARTIAL_UDPATE — lobby → client

`:3292-3301`. Part 1 = the field name (`"coop_state"`, `"team_scores.12"`, …), part 2 = its
JSON value. One field per message, which is how the match screen stays in sync without
re-reading the whole match.

### 31 · PLAYER_SCORE_UPDATE — match server → client

`:2060-2080`. Part 1 = the player's auth id, part 2 = kills, part 3 = deaths. The lobby drops
this from a player (`:2062`); only the match server's copy is applied.

### 18 · SERVICE_MESSAGE, 32 · PLAY_SOUND — server → client

`:2042-2059` and `:3302-3314`. A line shown in chat, and a sound to play. No answers.

### 40, 41 · TASK, TASK_ASNYC — server → client

`:3730-3774`. Part 1 = code, part 2 = reply id. The page runs it with `eval` and answers with
the value if it is a string, number or boolean (`:3740-3746`). That is why this repository
guards the message ([lobby_task_guard](../features/lobby-task-guard.md)) and why a private
server's code never runs here.

### 42 · YOU_ARE_STILL_DEAD, 43 · ENTER_RESPAWN_QUEUE, 2 · RESPAWN, 34 · RESSURECT

Respawn handshake. The client asks (`:3775-3829`), the lobby or match server answers with
`YOU_ARE_STILL_DEAD` (`:3511`) or moves the player and relays `RESPAWN` / `RESSURECT` with the
position and view (`:3830-4013`), which every client applies to that slot.

### The gameplay messages

`EXEC_TRIGGER` (1), `HIT_PLAYER` (4), `DAMAGE_PLAYERS_VIA_EXPLOSION` (5), `HEAL_PLAYER` (6),
`PROJECTILE_CREATE`/`REMOVE` (7, 8), `BARREL` (9), `THROW_GUN` (10), `HIT_GRENADE` (11),
`PLAYER_DIES` (12), `HIT_SHIELD` (13), `SWORD_ATTACK` (35), `VAR_SYNC` (36), `FLOW_AT` (37),
`AI_STATE_SYNC` (38), `AI_HEALTH_SYNC` (39): each is relayed by the match server to the other
players with the sender's slot prepended, and each is read field by field in
[anticheat.md](anticheat.md) §14, which is where their parts tables already live. `GRENADE_THROW`
(3) and `LIST_ME_AS_HOST` (17) have no dispatch branch of their own here: the first is written
by `frame2.js` and relayed, the second only marks the connection as a host.

## Who sends what, and who decides

Three roles, one protocol:

| Role | Who runs it | What it is for |
|---|---|---|
| **client** | the browser page of a player | simulates the match, sends state, sends its own actions |
| **lobby** (main server) | `flash.js` with `serverFlag` set — the official lobby, or this repo's `npm run server` | logins, the match list, creating and joining, chat relay, reports, the account module |
| **match server** | in a TCP match the lobby process itself; in a player-hosted match one player's page (`flash.js` with the p2p flag) | relays gameplay messages between the match's clients, and checks a few things |

The game itself says which side owns the rules — its own anti-tamper block, written as a
warning to anyone reading it (`frame2.js:27730-27731`):

> "Game is client-sided because too many maps depend on it."
> "But even then we would not be really able to afford servers that could handle server-side
> game logic."

So yes: **the simulation is client-sided.** Positions, hits, damage, projectiles, bot state
and trigger runs are computed by the client that caused them and relayed; the match server's
job is to pass them on and to reject a handful of specific claims (HP above the normal max,
zoom, ping, its ban list — [anticheat.md](anticheat.md) §14). Nothing recomputes a hit
server-side.

The messages split along those lines. Which side *ignores* a message is readable in the code:
a handler that starts with `if($с0А0О) return;` never runs on the lobby side, and one guarded
by `$НТАО0е` never runs on the client side for a message that came from the wrong peer.

| Origin | Messages |
|---|---|
| **client → lobby** | `AUTHENTICATE`, `GET_MATCH_LIST`, `CREATE_MATCH`, `JOIN_MATCH`, `LIST_ME_AS_HOST`, `PING`, `REPORT_USER`, `ENDORDSE_USER`, `KICK_USER`, `BAN_USER`, `CHAT` |
| **lobby → client** | `RESPONSE`, `SERVICE_MESSAGE`, `MATCH_JOIN_RESPONSE`, `FIRST_SYNC_RESPONSE`, `MAP_CHUNK`, `MATCH_INFO_PARTIAL_UDPATE`, `TASK`, `TASK_ASNYC`, `YOU_ARE_STILL_DEAD`, `PLAYER_SCORE_UPDATE` |
| **client → match server → every client in the match** | `EXEC_TRIGGER`, `RESPAWN`, `RESSURECT`, `GRENADE_THROW`, `HIT_PLAYER`, `DAMAGE_PLAYERS_VIA_EXPLOSION`, `HEAL_PLAYER`, `PROJECTILE_CREATE`, `PROJECTILE_REMOVE`, `BARREL`, `THROW_GUN`, `HIT_GRENADE`, `PLAYER_DIES`, `HIT_SHIELD`, `SWORD_ATTACK`, `VAR_SYNC`, `FLOW_AT`, `AI_STATE_SYNC`, `AI_HEALTH_SYNC`, `PLAY_SOUND`, `ENTER_RESPAWN_QUEUE`, `MY_PLAYER_PROPERTIES_CHANGED`, `CHAT` |
| **both, meaning it exists twice** | `PING` (a client's round trip; the anti-tamper report reuses it), `CLIENT_READY_FOR_FIRST_SYNC` (client says ready, no payload) |

Two consequences worth knowing before scripting anything:

- **A message is only as trustworthy as its sender.** `HIT_PLAYER` carries the damage its
  sender computed; the match server relays it. Anything the client does not want to be caught
  lying about is checked elsewhere (HP, zoom) or not at all.
- **Moving between the roles changes the same file's behaviour, not the code.** This repo's
  private server sets the very flag that makes `flash.js` the lobby
  (`src/server/game.ts:119`), which is why the same handlers run there and why its chat
  commands, join checks and report answers behave like the official server's.
