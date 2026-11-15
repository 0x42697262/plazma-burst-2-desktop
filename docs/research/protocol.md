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
