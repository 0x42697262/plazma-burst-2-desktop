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

## The messages in detail

Opcode, dispatch line and every send site for all 44 are in
[protocol-messages.md](protocol-messages.md) (`npm run protocol` regenerates it). Below is each
message in load order: what it carries, what the receiving side does with it, and the line that
sends it.

Encoding note that applies to every table: a part marked **number** is written in the base-N
digit alphabet and read through the game's own `parseInt`-equivalent; a part marked **string**
is passed through untouched; **JSON** parts are `JSON.parse`d. A part the handler never reads
can be anything.

### 0 · RESPONSE — the answer to any request

`flash.js:1963-1980`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the reply id the request put in its placeholder slot |
| 2 … | depends on the request | the values the answering side returns |

The receiver looks the id up in the connection's callback map, deletes it, and calls the stored
callback with everything after the id (`:1965-1974`). An id with no callback is dropped
silently (`:1976-1979`), which is why a wrong id looks like "no answer".

To craft one is to answer somebody: there is nothing to send by hand. To *receive* one, send
something that asks:

```
js pb.req("PING", ["REPLY"])
```

### 1 · EXEC_TRIGGER — client → match server → every client

`:4651-4671`, sent from `frame2.js:29318`, `:33790`, `:35545`, `:40575`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the trigger's index in the map |
| 2 | number, may be empty | the activator's slot; empty means nobody (`-1`) |
| 3 | number / 100 | `projectile_power` |

The receiver runs that trigger with the activator and logs `trigger_name` from the trigger's own
uid, so a map's script sees who set it off.

```
js pb.event("EXEC_TRIGGER", pb.num(0), pb.num(0), pb.num(100))
```

### 2 · RESPAWN — client → match server → every client

`:3830-3864` (server side), `:4095-4140` (client side), sent from `frame2.js:42923` on the
**state** channel.

| Part | Read as | Meaning |
|---|---|---|
| 1, 2 | number | x, y to place the player at |
| 3 | number | the HP to set |
| 4 | number, server-written | the player's `respawns` counter, rewritten on the way through |

Under `respawn_model: "v2"` the server first requires the sender at the head of the respawn queue
and warns in chat otherwise (`:3833-3849`); it then sets HP from part 3, bumps `respawns`, resets
the fire and respawn timers, rewrites part 4 (`:3851-3863`) and relays. Every client teleports
that slot, sets all body parts to part 3, and stores part 4 on the player.

```
js pb.event("RESPAWN", pb.num(0), pb.num(0), pb.num(100))
```

### 3 · GRENADE_THROW — reserved

Assigned at `:89`, and nothing in this build sends or dispatches it: a grenade travels inside the
state message and through `PROJECTILE_CREATE`. Documented here so the gap is not mistaken for a
missing part of this reference. The line shows the wire form only — nothing listens for it.

```
js pb.event("GRENADE_THROW", pb.num(1), pb.num(0), pb.num(0))
```

### 4 · HIT_PLAYER — client → match server → every client in the match

The whole combat model in one message: the shooter builds it (`frame2.js:30493-30512`), the match
server checks and rewrites it (`:3866-3931`), every client applies it (`:4314-4383`).

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the **victim's** slot |
| 2 | number | `limb_type`: which body part was hit (`:4337`) |
| 3 | number / 100 | `projectile_power` (`:4338`) |
| 4 | number / 100 | `projectile_knockback_multiplier` (`:4339`) |
| 5 | number | `projectile_frame`, the animation frame (`:4340`) |
| 6, 7 | number | x, y of the hit |
| 8, 9 | number / 100 | `spx`, `spy`, the projectile's velocity (`:4341-4342`) |
| 10 | number | `cclass`, the projectile class (`:4343`) |
| 11 | number | `source`, the weapon (`:4344`) |
| 12 | number | `local_atom_id`, the shooter's local id for it (`:4345`) |
| 13 | number / 100 | `provided_health_delta`: the damage claimed (`:4346`) |
| 14 | number | the victim's `respawns` counter — a stale-message guard (`:4349`) |
| 15 | string, server-written | non-empty means "the victim was left at 0 HP" (`:3929`, `:4330`) |

The match server: reads parts 1, 2, 13, 14, 11 and drops a `NaN` damage (`:3881`); clamps a
negative damage to `0` and treats it as a no-damage claim (`:3884-3911`); otherwise passes
`hea_damage` to the match's own check (`match.$1eMМеТ`, `:6923`), which requires the target's
`respawns` counter to match (`:6930`), applies team rules (`:6944`), and then subtracts the damage
from **its own copy** of the victim, killing at zero (`:6979-6982`); a refusal rewrites
`parts[13] = 0` or sets `parts[15] = "1"` (`:3908-3909`, `:3929`). It relays to everyone but the
shooter, team-only in team modes (`:4058-4067`).

Each client applies the hit, then the HP: a positive delta can only lower the current value
(`Math.min`, `:4375`), a negative one is bounded by `hmax` (`:4377`), and the died flag forces
`0` on the local player (`:4380-4383`). The number is believed inside limits the receiver
enforces; nothing is recomputed.

```
js pb.event("HIT_PLAYER", pb.num(1), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(10), pb.num(0))
```

A 0.1 damage hit on slot 1 with every other field zeroed.

### 5 · DAMAGE_PLAYERS_VIA_EXPLOSION — client → match server → every client

A request **and** a relay: the shooter asks, the match server answers with an empty list
(`:3936-3937`), rewrites what a client may claim, and forwards (`:4386-4480`).

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | reply id; blanked before the relay (`:3939`) |
| per victim | 11 values | slot, explosion x, explosion y, `tox` /100, `toy` /100, stability damage /100, health damage (**empty = "their current HP", a kill claim**, `:4406-4408`), then four body-part damages (`:4409-4412`) |
| per victim, after those | 1 value | how many atoms follow (`:4437`) |
| per atom | 5 values | local atom id and four positions/velocities, each /100 (`:4469-4474`) |

The server clamps the health damage (`:3957-3965`) and checks it like a hit (`:3972-3982`).

```
js pb.event("DAMAGE_PLAYERS_VIA_EXPLOSION", pb.num(1), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0))
```

Part 1 is the reply id a hand-crafted send can leave at `0`; then one victim group with zeroed
figures and a closing zero atom count.

### 6 · HEAL_PLAYER — client → match server → every client

`:4533-4555` (client), `:3990-4048` (server).

| Part | Read as | Meaning |
|---|---|---|
| 1 | number / 100 | `stat_power`, the heal amount |
| 2 | number | the initiator's slot |
| 3 | number | the target's slot |
| 4 | number | the target's `respawns` counter |

The receiver heals, revives and updates the stat counters; the server arbitrates as with a hit,
with the respawn counter as the guard.

```
js pb.event("HEAL_PLAYER", pb.num(100), pb.num(0), pb.num(1), pb.num(0))
```

### 7 · PROJECTILE_CREATE — client → match server → every client

`:4177-4240`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the owner's slot |
| per projectile, 4 values | | atom id, projectile type, a frame figure, and one more scaled by 1000 (`:4203-4206`) |

The receiver creates the projectile in its own world so everyone sees the same shot.

```
js pb.event("PROJECTILE_CREATE", pb.num(0), pb.num(1), pb.num(0), pb.num(0), pb.num(0))
```

### 8 · PROJECTILE_REMOVE — client → match server → every client

`:4241-4260`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the projectile's atom id |
| 2, 3 | number | x, y where it ended |

```
js pb.event("PROJECTILE_REMOVE", pb.num(1), pb.num(0), pb.num(0))
```

### 9 · BARREL — client → match server → every client

`:4807-4850`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | `barrel_id` |
| 2 | number | `hea`, the barrel's health after the interaction |
| 3 | string | non-empty: `by_player`, a player rather than a shot |
| 4, 5 | number | `xx`, `yy` where it was hit |

The receiver moves the barrel by the difference between that point and its own position, then
applies the health, so a rolling barrel and a death animation line up.

```
js pb.event("BARREL", pb.num(3), pb.num(0), "1", pb.num(100), pb.num(50))
```

### 10 · THROW_GUN — client → match server → every client

`:4142-4176`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the gun's slot index |
| 2, 3 | number | x, y of its first node |
| 4, 5 | number / 100 | velocity x, y of that node |
| 6, 7 | number | x, y of its second node |
| 8, 9 | number / 100 | velocity x, y of that node |

A gun has two nodes, and both are placed in one message, so a thrown gun lands where it was
thrown rather than snapping.

```
js pb.event("THROW_GUN", pb.num(0), pb.num(100), pb.num(200), pb.num(0), pb.num(0), pb.num(110), pb.num(200), pb.num(0), pb.num(0))
```

### 11 · HIT_GRENADE — client → match server → every client

`:4261-4313`, logged as `tox` / `toy`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the grenade's atom id |
| 2, 3 | number | x, y of the hit |
| 4 | number | what it struck |

```
js pb.event("HIT_GRENADE", pb.num(1), pb.num(0), pb.num(0), pb.num(0))
```

### 12 · PLAYER_DIES — client → match server → every client

`:2082-2132`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the killer's slot |
| 2 | number | the victim's slot |
| 3 | number | `damaged_limb_type` |
| 4 | number | `damage_source`, the weapon |
| 5 | number | a further figure the receiver reads at `:2133` |
| 6 | number | the killer's `kills` counter |
| 7 | number | the victim's `deaths` counter |

The receiver marks the death and then **sets** both counters from the message (`:2105`,
`:2108`) — the counters are part of the claim, not computed from the match.

```
js pb.event("PLAYER_DIES", pb.num(0), pb.num(1), pb.num(0), pb.num(74), pb.num(0), pb.num(3), pb.num(5))
```

### 13 · HIT_SHIELD — client → match server → every client

`:4556-4586`, logged as `dmg`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the shield's atom id |
| 2 | number | its health before the hit |
| 3 | number | the damage |
| 4 | number | a fourth figure the receiver reads at `:4568` |

```
js pb.event("HIT_SHIELD", pb.num(1), pb.num(100), pb.num(10), pb.num(0))
```

### 14 · CHAT — client → lobby → everyone

`:4014-4046` (lobby), `:4587-4650` (client).

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | destination: 1 = everyone, other values the game's own |
| 2 | string | the text, trimmed to 240 characters |

Five messages a second per connection (`:4016-4024`). Everything starting with `-` after that
is the match owner's command parser — `-announce`, `-min_reputation`, `-map`, `-endround`,
`-ping_action`, `-recheck` — each guarded by owner or staff (`:4029-4033`).

```
js pb.event("CHAT", pb.num(1), "hello")
js pb.event("CHAT", pb.num(1), "-min_reputation 1")
```

### 15 · CREATE_MATCH — client → lobby

`:2667-2844`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | JSON | the settings; `min_reputation` is clamped down to the creator's own (`:2686`), `max_players` to 1..64 (`:2695-2701`) |
| 2 | number | reply id |

Refusals: one create a second (`:2671`), negative reputation (`:2673`), more than 5000 characters
of settings (`:2679`). Answers `["ok", <match uid>]` or `["fail", <why>]`.

```
js pb.req("CREATE_MATCH", [JSON.stringify({title:"probe",game_type:"DM",max_players:8,min_reputation:0,map_id:"random approved",ranked:false}), "REPLY"])
```

### 16 · AUTHENTICATE — client → lobby

`:1982-2040`, sent from `MPLobby.js:152-160`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | login, as in the site's cookie |
| 2 | string | password, or an admin's secret on a private server |
| 3 | string | game version |
| 4 | string | build hash |
| 5 | number | reply id |
| 6 | string | first uid, or empty |
| 7 | string | device fingerprint, quoted JSON (cut at 60 characters) |
| 8 | number | build timestamp; missing → `Server: Refresh page to get new version of the game` |

Answer: `["ok", <profile JSON>]` or `["fail", <why>]`; the profile carries `nickname`, `login`,
`login_proof`, `uid`, `mdl`, `mdl2`, `is_staff`, `is_guest`, `is_vpn`, `is_public_supporter`,
`support_months`. At most one attempt every 3 s (`:2001-2003`).

```
js pb.req("AUTHENTICATE", ["<login>", "<password>", "version_h5", "hash_h5", "REPLY", "", "\"device\"", pb.num(1769098189070)])
```

Re-authenticating on a live socket is not something the game does; the line documents the shape.

### 17 · LIST_ME_AS_HOST — client → lobby

No parts, no answer: it marks the connection as the host of a player-hosted match, and the
lobby's relay and join rules key off it (`:1802-1835`).

```
js pb.req("LIST_ME_AS_HOST", ["REPLY"])
```

### 18 · SERVICE_MESSAGE — lobby → client → shown in chat

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | the line, as HTML the game's chat understands |

`:2042-2059`. The client prints it and treats it as a server message. A host or the lobby sends
it; a client only receives it.

```
js pb.event("SERVICE_MESSAGE", "<font color=\"#ffff00\">hello</font>")
```

### 19 · GET_MATCH_LIST — client → lobby

`:2497-2660`, sent from `MPLobby.js:210`, `:663-667`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | JSON | the filter: `{}`, or `{"delete_relation": <since>}` to end a relation |
| 2 | number | reply id |
| 3 | string | view: `match_list`, `relations` or `skill_board` |

Answer `["ok", <rows JSON>, <own JSON>]` or `["fail", "Match listing error: Too fast"]`; own JSON
carries `reputation`, `reputation_potential`, `skill`, `wins`, `loses`, `online`, `matches`
(`:2645`). One request per 300 ms (`:2503`).

```
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "match_list"])
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "relations"])
```

### 20 · JOIN_MATCH — client → lobby

`:2932-3060`, sent from `MPLobby.js:452`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the match uid |
| 2 | number | reply id |
| 3 | number | the slot asked for, `-1` for any |
| 4 | string | `"1"` = join as a spectator, empty = play |
| 5 | string | the match password |

Refusals in order: "Match not found", a cooldown after a wrong password (`:2965-2974`), "Match is
still being created", then everything `$lрTp1` checks — reputation, guest/VPN rules, the match ban
list (`:6564-6630`, [reputation.md](reputation.md#where-the-join-check-runs)). Answer
`["ok", <match details>, <slot>]` or `["fail","Match join error: <why>."]`.

```
js pb.req("JOIN_MATCH", ["<uid>", "REPLY", -1, "", ""])
js pb.req("JOIN_MATCH", ["<uid>", "REPLY", -1, "1", ""])
```

### 21 · MATCH_JOIN_RESPONSE — lobby → client

`:3315-3394`.

| Part | Read as | Meaning |
|---|---|---|
| 2 | JSON | the match details the client starts the match screen with |
| 3 | number | the slot you take |

A client only receives it; the lobby sends it as the answer to `JOIN_MATCH`.

```
js pb.event("MATCH_JOIN_RESPONSE", pb.num(0), JSON.stringify({title:"probe"}), pb.num(0))
```

### 22 · MAP_CHUNK — lobby → client

`:3268-3291`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | chunk index |
| 2 | number | chunk count |
| 3 | string | the text of that chunk |

The client reassembles the map and unpacks it with the game's own function. A host sends it for
its own map; a client only receives it.

```
js pb.event("MAP_CHUNK", pb.num(0), pb.num(1), "<map text>")
```

### 23 · CLIENT_READY_FOR_FIRST_SYNC — client → lobby

No parts, no answer. The client says it is ready, and the lobby then sends one
`FIRST_SYNC_RESPONSE` per player (`:3395-3414`).

```
js pb.req("CLIENT_READY_FOR_FIRST_SYNC", ["REPLY"])
```

### 24 · FIRST_SYNC_RESPONSE — lobby → client

`:3421-3510`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the slot |
| 2 | JSON | the player's fields; empty means the slot is now empty |
| 3 | string | non-empty when that player is a spectator |

Every field of that JSON is copied onto the player object, which is where `login`, `nickname`
and `auth_id` come from ([player-info](../features/player-info.md)); the client announces
"X connected" and turns a map bot in that slot into a player (`:3455-3460`).

```
js pb.event("FIRST_SYNC_RESPONSE", pb.num(0), JSON.stringify({login:"x",nickname:"x",auth_id:1,team:1}), "")
```

### 25 · MY_PLAYER_PROPERTIES_CHANGED — client → lobby → everyone

`:3526-3690`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | your slot |
| then pairs | number, JSON | property index, new value |

The index addresses this whitelist only (`:216-221`): 0 `team`, 1 `skin_snapshot`, 2-11
`slot0`…`slot9`, 12 `curwea`. Each value is checked (a gun you hold, a slot that exists) and a
refused one is written back as the old value on your own player (`:3576-3620`).

```
js pb.event("MY_PLAYER_PROPERTIES_CHANGED", pb.num(0), pb.num(0), JSON.stringify(1))
```

### 26 · PING — both ways

`:3066-3078`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number, or the string `"undefined"` | the reply id; `"undefined"` marks the anti-tamper report |
| 2, 3 | number, string | for a report: the mode and the detail |

As a request it answers with an empty list, which is how a round trip is measured. With
`"undefined"` in part 1 the lobby hands it to the anti-tamper handler and answers nothing
([scan-gating.md](scan-gating.md)).

```
js pb.req("PING", ["REPLY"])
```

### 27 · REPORT_USER — client → lobby

`:2845-2930`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the target's auth id |
| 2 | number | reply id |
| 3 | string | read for every message in this family, used only by kick and ban |

Self is refused against the lobby's own record (`:2871`); an id that resolves to nobody answers
`Error: Target user wasn't online for too long` (`:2855`, `:2927`). The amount and the effect are
the account module's ([reputation.md](reputation.md)).

```
js pb.req("REPORT_USER", ["<auth id>", "REPLY"])
```

### 28 · ENDORDSE_USER — client → lobby

Same shape and same handler as the report; the account module decides the direction
(`:2846`, `:2882`). Two in a row to the same account remove the relation again
([reputation-probe.md](reputation-probe.md#observed-so-far)).

```
js pb.req("ENDORDSE_USER", ["<auth id>", "REPLY"])
```

### 29 · KICK_USER — staff or the match owner → lobby

`:2847`, `:2892-2917`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the target's auth id |
| 2 | number | reply id |
| 3 | string | `"1"` to keep them out of the match as well, `""` to only remove them |

Staff may exclude anyone (`:2897-2901`); the owner only in their own match, and never a staff
member (`:2903-2913`). The target is resolved from the lobby's global auth-id map, so it need not
be in your match — they are then only pre-banned there (`:7183-7227`).

```
js pb.req("KICK_USER", ["<auth id>", "REPLY", "1"])
```

### 30 · MATCH_INFO_PARTIAL_UDPATE — lobby → client

`:3292-3301`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | the field name, `"coop_state"`, `"team_scores.12"`, … |
| 2 | JSON | its new value |

One field per message, which is how the match screen stays in sync without re-reading the whole
match.

```
js pb.event("MATCH_INFO_PARTIAL_UDPATE", "coop_state", JSON.stringify("1"))
```

### 31 · PLAYER_SCORE_UPDATE — match server → client

`:2060-2080`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the player's auth id |
| 2 | number | kills |
| 3 | number | deaths |

The lobby drops this from a player (`:2062`); only the match server's copy is applied.

```
js pb.event("PLAYER_SCORE_UPDATE", pb.num(1), pb.num(3), pb.num(5))
```

### 32 · PLAY_SOUND — server → client

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | which sound |

`:3302-3314`. No answer; a host or the match server sends it.

```
js pb.event("PLAY_SOUND", pb.num(0))
```

### 33 · BAN_USER — staff → lobby

`:2848`, `:2884-2889`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the target's auth id |
| 2 | number | reply id |

Refused with `Error: Not a staff` for anyone else (`:2886-2889`).

```
js pb.req("BAN_USER", ["<auth id>", "REPLY"])
```

### 34 · RESSURECT — client → match server → every client

Shares the respawn branch with `RESPAWN` (`:3830-3864`, same parts), and does not go through the
respawn queue: it is the revive path (defibrillator), applied by the same clients at
`:4095-4140`.

```
js pb.event("RESSURECT", pb.num(0), pb.num(0), pb.num(100))
```

### 35 · SWORD_ATTACK — client → match server → every client

No parts: the receiver sets the attacking flag on that player (`:4672-4675`). The blade's damage
travels as `HIT_PLAYER` like any other hit.

```
js pb.event("SWORD_ATTACK")
```

### 36 · VAR_SYNC — client → match server → every client

`:4677-4716`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | mode: `r` replace, `d` set if unset, `x` keep the larger, `n` keep the smaller, `l` keep the longer |
| 2 | string | the variable's name |
| 3 | string | the value |

Each mode is a merge rule, so the same message applied in any order converges — which is why map
variables survive late joiners.

```
js pb.event("VAR_SYNC", "r", "varname", "1")
js pb.event("VAR_SYNC", "x", "score", "10")
```

### 37 · FLOW_AT — client → match server → every client

`:4718-4728`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the player's slot |
| 2, 3 | number | x, y |
| 4, 5 | number / 100 | velocity x, y |
| 6 | number | a direction figure |

It feeds the "where a shot is going" indicator the other players see.

```
js pb.event("FLOW_AT", pb.num(0), pb.num(100), pb.num(200), pb.num(0), pb.num(0), pb.num(0))
```

### 38 · AI_STATE_SYNC — client → match server → every client

`:4730-4783`, logged field by field at `:4764-4778`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the bot's slot |
| 2 | number | `hea` |
| 3 | number | a state figure the receiver reads at `:4741` |
| 4, 5 | number | x, y |
| 6, 7 | number | `tox`, `toy`, the point it heads for |
| 8, 9 | number | `tarx`, `tary`, the target point |
| 10 | number | `hunt` |
| 11, 12 | number | `botaction`, `rand` |
| 13, 14 | number | `rand2`, `rand3` |

Only a bot slot is accepted (`:4735-4736`) and only by clients that do not own it, so a peer
applies another machine's bot.

```
js pb.event("AI_STATE_SYNC", pb.num(13), pb.num(850), pb.num(0), pb.num(200), pb.num(300), pb.num(400), pb.num(300), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0))
```

### 39 · AI_HEALTH_SYNC — client → match server → every client

`:4784-4806`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the bot's slot |
| 2 | number | `hea` |
| 3 | number | head HP |
| 4 | number | face HP |
| 5 | number | arms HP |
| 6 | number | legs HP |

Every value is applied with `Math.min` (`:4795-4800`), so this message can only lower a bot's
health, never heal it; the receiver re-runs the body-part update when the total fell.

```
js pb.event("AI_HEALTH_SYNC", pb.num(13), pb.num(850), pb.num(100), pb.num(100), pb.num(100), pb.num(100))
```

### 40 · TASK — lobby → client

`:3730-3750`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | code the page runs with `eval` |
| 2 | number | reply id |

The page answers with the value if it is a string, number or boolean (`:3740-3746`). This is why
the message exists and why this repository guards it
([lobby_task_guard](../features/lobby-task-guard.md)): a lobby server can run code in a page.

```
js pb.event("TASK", "1+1", pb.num(0))
```

### 41 · TASK_ASNYC — lobby → client

`:3751-3774`. Same parts as `TASK`; the answer arrives later, which is what lets a lobby run code
that takes time without stalling the packet it came in.

```
js pb.event("TASK_ASNYC", "1+1", pb.num(0))
```

### 42 · YOU_ARE_STILL_DEAD — match server → client

No parts (`:3511-3525`): the answer to a respawn request that cannot be granted yet. The client
shows the "still dead" state instead of placing the player.

```
js pb.event("YOU_ARE_STILL_DEAD")
```

### 43 · ENTER_RESPAWN_QUEUE — client → match server

`:3775-3829`.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | reply id |

Outside a match, when not allowed, or when already queued, the answer is `["n"]`
(`:3783-3796`); otherwise the connection joins `match.$lOрplр` and the answer — `[true]` or
`[false]` — arrives later, when the queue grants or refuses the slot (`:3801-3806`).

```
js pb.req("ENTER_RESPAWN_QUEUE", ["REPLY"])
```

## Crafting one

Every message has a ready line in [protocol-crafting.md](protocol-crafting.md); the general shape is below.

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
