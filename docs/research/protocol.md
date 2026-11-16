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
- **`state`** — one unreliable message, the newest; an unsent older one is replaced
  ([protocol-state.md](protocol-state.md)).
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
| 0 | `RESPONSE` | `1`, then the values | the reply id and the values (`:1963`) |
| 1 | `EXEC_TRIGGER` | `1,2,3` | trigger index, region index or `""`, power; the activator is the sender (`:4651`) |
| 2 | `RESPAWN` | `1..4` | spawn x, y, HP, and the respawn count the server writes (`:3830`, `:4095`) |
| 3 | `GRENADE_THROW` | — | reserved: nothing sends or handles it |
| 4 | `HIT_PLAYER` | `1..15` | victim, limb, power, knockback, position, velocity, gun, damage, respawn count (`:3866`, `:4314`) |
| 5 | `DAMAGE_PLAYERS_VIA_EXPLOSION` | `1`, then groups of 14 | a reply id, then per victim: blast point, push, damage, gun, respawn count and atoms (`:3934`, `:4386`) |
| 6 | `HEAL_PLAYER` | `1..4` | power, gun, target slot, the target's respawn count (`:3990`, `:4533`) |
| 7 | `PROJECTILE_CREATE` | `1`, then groups of 4 | gun or grenade type, then per projectile: number, x, y, angle (`:4177`) |
| 8 | `PROJECTILE_REMOVE` | `1,2,3` | the projectile's number and where it ended (`:4241`) |
| 9 | `BARREL` | `1..5` | barrel index, its HP, whether a player caused it, its position (`:4807`) |
| 10 | `THROW_GUN` | `1..9` | gun index, position and velocity of its two nodes (`:4142`) |
| 11 | `HIT_GRENADE` | `1..4` | grenade id, shot id, the push added (`:4261`) |
| 12 | `PLAYER_DIES` | `1..7` | victim, killer, limb, cause, wording, kills, deaths; sent by the match server only (`:2082`, `:7058`) |
| 13 | `HIT_SHIELD` | `1..4` | shield id, HP before, damage, owner slot (`:4556`) |
| 14 | `CHAT` | `1,2` | destination (2 = team) and text; reaches the sender's match only, cut at 240 characters while the sender stays under 5 lines a second (`:4014-4040`) |
| 15 | `CREATE_MATCH` | `1,2` | settings JSON and reply id; answered `["ok", "", -1]`, refused at negative reputation (`:2667`, `:2829`) |
| 16 | `AUTHENTICATE` | `1..8` | login, password, version, hash, reply id, campaign nickname, first uid, build timestamp; answered `["ok", <profile>]` or `["fail", <why>]` (`:1982`) |
| 17 | `LIST_ME_AS_HOST` | — | reserved: defined (`:105`), never sent or handled |
| 18 | `SERVICE_MESSAGE` | `1` | a server line shown in chat; ignored when a client sends it (`:2042`) |
| 19 | `GET_MATCH_LIST` | `1,2,3` | filter JSON, reply id, and which view: `match_list`, `relations` or `skill_board` (`:2497`); once per 300 ms |
| 20 | `JOIN_MATCH` | `1..5` | match uid, reply id, slot, send-the-map flag, password (`:2932`) |
| 21 | `MATCH_JOIN_RESPONSE` | `2,3` | the match details JSON and the slot you take (`:3315`) |
| 22 | `MAP_CHUNK` | `1,2,3` | chunk index, chunk count, and the text of one piece (`:3268`) |
| 23 | `CLIENT_READY_FOR_FIRST_SYNC` | — | asks the match for its first state (`:3395`) |
| 24 | `FIRST_SYNC_RESPONSE` | `1,2,3` | slot, the player's JSON or empty for a free slot, and whether to announce it (`:3421`) |
| 25 | `MY_PLAYER_PROPERTIES_CHANGED` | — | your own player fields: `team`, `skin_snapshot`, `slot0…slot9`, `curwea` only (`flash.js:216-221`, `:3526`) |
| 26 | `PING` | `1,2,3` | the lobby's ping, answered empty; the client sends it only as the anti-tamper report, `"undefined"` then mode and detail, never answered (`:3066-3078`) |
| 27 | `REPORT_USER` | `1,2,3` | target auth id and reply id; self refused (`:2845`) |
| 28 | `ENDORDSE_USER` | `1,2,3` | same shape, the opposite relation (`:2846`) |
| 29 | `KICK_USER` | `1,2,3` | target auth id, reply id, and whether to bar the guest uid too (`:2847`, `:2892`) |
| 30 | `MATCH_INFO_PARTIAL_UDPATE` | `1,2` | a dotted path into the match details and its new value as JSON (`:3292`) |
| 31 | `PLAYER_SCORE_UPDATE` | `1,2,3` | slot, kills, deaths, as the server counts them (`:2060-2080`) |
| 32 | `PLAY_SOUND` | `1` | a sound to play (`:3302`) |
| 33 | `BAN_USER` | `1,2,3` | target auth id, reply id; staff only (`:2848`, `:2886`) |
| 34 | `RESSURECT` | `1..4` | x, y, HP, and the respawn count the server writes; round restarts and trigger action 59 only (`:3831`) |
| 35 | `SWORD_ATTACK` | — | a sword swing (`:4672`) |
| 36 | `VAR_SYNC` | `1,2,3` | merge mode, map variable name, value (`:4677`) |
| 37 | `FLOW_AT` | `1..6` | a blood burst: x, y, type, velocity, count (`:4718`) |
| 38 | `AI_STATE_SYNC` | `1..14` | a bot's slot, HP, position, velocity, aim, target, action and random values (`:4730`) |
| 39 | `AI_HEALTH_SYNC` | `1..6` | a bot's slot, HP, and head, body, arms and legs HP (`:4784`) |
| 40 | `TASK` | `1,2` | a function's source the page runs with `eval`, and a reply id (`:3730`; hence [lobby_task_guard](../features/lobby-task-guard.md)) |
| 41 | `TASK_ASNYC` | `1,2` | the same, answered through a callback (`:3751`) |
| 42 | `YOU_ARE_STILL_DEAD` | — | the server's copy of you is dead but your client reports HP above 0 (`:1109`, `:3511`) |
| 43 | `ENTER_RESPAWN_QUEUE` | `1` | a reply id; answered `"k"` when granted, `"n"` when refused (`:3775`) |

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

### 0 · RESPONSE — answering side → asking side, never relayed

The answer to a request. Either end of a connection can ask: the client asks the lobby
(`AUTHENTICATE`, `GET_MATCH_LIST`, `JOIN_MATCH`, `ENTER_RESPAWN_QUEUE`, the explosion batch,
…), and the server asks the client (`PING` every 3 seconds, `TASK`). The other end answers
with one `RESPONSE`, which carries the reply id the request put in its placeholder slot.

| | |
|---|---|
| Built | `flash.js:1868-1889`, the one answer function each incoming message gets (`$АpА1рO`); sent at `:1888` |
| Handled by both sides | `flash.js:1963-1980`, the same code on the server and in the page |
| Relayed | never: it is handled at `:1963`, before the match relay |
| Allowed | from a connection that has not logged in yet (`:1916-1926`) and from a spectator (`:1739`) |

#### The console command

A `RESPONSE` is never sent by hand: there is nothing waiting for an id you make up. To see one,
send a request that the lobby answers:

```
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "match_list"])
```

`pb.req` swaps `"REPLY"` for the placeholder, and the promise resolves with the values of the
`RESPONSE`. A `PING` sent this way gets no answer: on the server side `PING` only reads the
anti-tamper form and returns (`flash.js:3068-3073`).

#### What real ones look like

From `netlog show`, numbers decoded. Netlog adds `<- answers #n TYPE` to each one.

| Situation | Direction | As recorded |
|---|---|---|
| The page answers the server's `PING` | sent | `RESPONSE(100)` |
| The page answers a `TASK` with its result | sent | `RESPONSE(119, "7")` |
| The lobby answers an explosion batch | received | `RESPONSE(108)` |
| The lobby refuses a match list | received | `RESPONSE(101, "fail", "Match listing error: Too fast")` |
| The lobby accepts a `JOIN_MATCH` | received | `RESPONSE(102, "ok", "", "-1")` |

The ids start at 100 on every connection, so the same id shows up again and again.

#### How it works

1. **The asker files a callback.** `connection.js:693-709` finds the placeholder object
   (`Multiplayer.CALLBACK_UID_PLACEHOLDER`, `flash.js:77`) in the message, replaces it with
   the connection's counter, and stores the callback under that number. The counter starts at
   100 (`connection.js:414`). Over 1000 pending callbacks logs a warning (`:706-707`).
2. **The answering side runs the request's handler.** The handler calls the answer function
   with the id it read and the values (`flash.js:1868`). The function sends
   `[RESPONSE, id, …values]` back on the same connection (`:1888`).
3. **One answer per message.** A second call for the same incoming message is refused: it
   warns in debug mode and throws otherwise (`:1870-1877`).
4. **The asker matches it.** It decodes part 1, looks the id up, deletes it and calls the
   callback with the rest of the parts (`:1965-1974`). An unknown id is dropped without a word
   (`:1976-1979`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the reply id |
| 2 … | strings | the values; what they mean depends on the request |

**Part 1, the reply id.** The asker's own counter, written in the base-N digits. Some
handlers echo the id exactly as it came (the page's `PING` answer passes `parts[1]` untouched,
`flash.js:3076-3077`), so it does not have to be decoded on the way. A wrong or reused id finds
no callback and is dropped (`:1976-1979`).

**Parts 2 and later, the values.** The callback gets them as one array of strings
(`flash.js:1972-1974`). Nothing in the `RESPONSE` handler reads them. Each requester decides:
the match list reads `"ok"` or `"fail"` and then JSON, the explosion batch ignores them and
only uses the arrival (`:702-705`). An empty list is a valid answer.

#### Situations

- **"Nothing happened."** A request whose answer never comes leaves the callback waiting
  forever. The usual causes are a wrong name, a handler that does not answer (as `PING` on the
  server), or a dead socket. The netlog shows the request and no `<- answers` line.
- **Flow control.** The explosion batch uses the answer only to open the next batch. The lobby
  answers with an empty list as soon as the batch arrives (`flash.js:3936-3937`), and the page
  sends no second batch until then (`:650`, `:702-705`).
- **Server-side requests.** The server pings every connection about every 3 seconds and
  ignores the answer's content (`flash.js:855-863`).
- **Before login.** The server accepts only `AUTHENTICATE` and `RESPONSE` from a connection
  with no profile yet (`flash.js:1916-1926`), so a page can still answer a server request
  during login.
- **For the local server's maintainer.** `src/server/` runs this same code. To find a lost
  answer, look for the request's handler and check that every path through it calls the answer
  function once.

### 1 · EXEC_TRIGGER — client → match server → every other client

One map trigger that fired on the sender's screen and should fire everywhere. The sender's
client decides that the trigger should run. Every other client runs the same trigger with
the sender as the activator.

| | |
|---|---|
| Built | `frame2.js:29316-29325` (a projectile hits a door), `:33788-33797` (the local player stands in a region), `:35543-35552` (a gun fires), `:40573-40582` (a gun's fire animation ends) |
| Queued | the region case goes through `flash.js:5115-5127` (`$epоoАp`) and is de-duplicated per tick (`:627-647`) |
| Checked by the match server | nothing: no branch reads it |
| Relayed | `flash.js:4056-4067`, to every other client |
| Applied by every receiver | `flash.js:4651-4670` |

#### The console command

```
js pb.event("EXEC_TRIGGER", pb.num(0), "", "")
```

The shape a gun's trigger sends: trigger 0, no region, no power. Every other client runs
trigger 0 with your slot as the activator, if that trigger exists, is enabled and has calls
left. The game fills part 2 or part 3, never both.

#### What real ones look like

From `netlog show`, numbers decoded. A received one has the sender's slot in front.

| Situation | Direction | As recorded |
|---|---|---|
| The local player stands in region 213, which calls trigger 345 | sent | `EXEC_TRIGGER(345, 213, "")` |
| The same, from slot 0 | received | `EXEC_TRIGGER(0, 345, 213, "")` |
| A gun's trigger, from slot 6 | received | `EXEC_TRIGGER(6, 100, "", "")` |
| A projectile with power 0.61 hits a door that calls trigger 72 | received | `EXEC_TRIGGER(2, 72, "", 61)` |

Region triggers make most of the traffic: a player standing in a region sends one every tick
while the trigger is enabled and has calls left. The recordings hold over 300 000
`EXEC_TRIGGER` lines, nearly all of them from regions.

#### How it works

1. **The sender's client fires the trigger itself.** Each of the four sites runs the trigger
   locally with `$pАTIТ` (`actions.js:47`) and sends only when that returns true
   (`frame2.js:29312`, `:35540`, `:40570`). It returns true whenever the game is in its
   `gaming` frame (`actions.js:66`, `:6498-6503`), even if the trigger itself was disabled.
   The region site instead checks first that the trigger is enabled and has calls left
   (`frame2.js:33787`).
2. **Only the local player's own events are sent.** A door hit is sent only for the
   sender's own projectile (`frame2.js:29314`), a gun trigger only for the gun the local
   player holds (`:35542`, `:40572`), and a region only for the local player, not a spectator
   (`:33787`). Without a connection nothing is sent.
3. **The match server relays it unchanged.** No branch of the server handler reads it. It
   puts the sender's slot in front and sends it to everyone else (`flash.js:4056-4067`).
4. **Each receiver runs the trigger.** It reads the trigger index, the region and the power
   (`flash.js:4653-4655`). If part 2 names a region that does not exist here, it stops
   (`:4657`). Otherwise it sets the activator to the sender's slot and the power from part 3
   (`:4659-4660`), and runs the trigger if it exists (`:4667-4668`). Running checks the
   trigger's own enabled flag and call count on this client (`actions.js:112`).

#### Field by field

Part numbers as the receiver reads them, after the sender's slot is removed. The names in
quotes are the receiver's message log (`flash.js:4663-4664`).

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | `trigger_name` (logged from the trigger's `uid`) | the trigger's index in the map |
| 2 | number, or empty | region | the region's index, or `""` |
| 3 | number / 100 | `projectile_power` | power × 100, or `""` |

**Part 1, the trigger.** An index into the map's trigger list. The receiver logs the
trigger's `uid`, or `non-existing trigger N` (`flash.js:4663`), and runs it only if it exists
(`:4667-4668`). The trigger then runs only if it is enabled and has calls left on the
receiver's copy of the map (`actions.js:112`); each run uses up one call (`:6477-6478`).

**Part 2, the region.** Sent only by the region site, as the index of the region the player
stood in (`frame2.js:33794`). The receiver turns `""` into -1 (`flash.js:4654`). A region that
does not exist on the receiver stops the message (`:4657`). The region is only this guard:
it is not passed to the trigger, and the receiver does not check that the sender is inside it.
The activator is not in this part: it is the sender, whose slot the server puts in front
(`:4659`).

**Part 3, `projectile_power`.** Sent only for a door hit, as the projectile's power × 100
(`frame2.js:29324`). The receiver divides by 100 (`flash.js:4655`). An empty part decodes as
0 (`:5282-5306`). The trigger's actions can copy it into a map variable or subtract it from one
(`actions.js:3283-3292`).

**The activator.** Not a part of the message. Receivers set it to the sender's slot
(`flash.js:4659`, `$Oр0ol`), and the power to `$MppHI` (`:4660`). Actions that read
the activator's login, nickname or slot (`actions.js:2561`, `:2886`) therefore see the player
who sent the message.

#### Situations

- **Lag.** The trigger runs on the sender's screen at once and on the others one trip through
  the server later. A map that moves a door on a trigger shows the door move later for
  everyone else.
- **Calls running out.** Each client counts calls on its own copy. A trigger with one call
  left runs once on each client, so two players who set it off at the same moment can both
  succeed: each ran it locally before the other's message arrived.
- **Region spam.** The region site sends every tick while the player stands in the region.
  The queue drops identical messages inside one tick (`flash.js:627-647`), not across ticks,
  so the receivers keep running the trigger until its calls run out or it is disabled.
- **Regions that start a timer.** For such a region the sender starts timer N locally
  (`frame2.js:33804-33809`) but sends N as a trigger index (`:33792`), so the receivers run
  trigger N. The code does not tell the two apart.
- **Spectators.** A spectator's client does not send it (`flash.js:5124`, `:1784`), and the
  server refuses one from a spectator (`:1930-1934`).
- **For map authors.** The activator on other clients is the sender. An action that rewards
  "the activator" rewards the player whose client sent the trigger, on every screen.
- **For the local server's maintainer.** The server does not check this message at all. To
  see why a trigger did not run, look for its `EXEC_TRIGGER` in the netlog, then check the
  region index and whether the trigger still has calls on the receiver.

### 2 · RESPAWN — client → match server → every client, the sender too

The sender's player comes back to life at a spawn point. The sender places itself, and every
other client moves that player to the same point with the same HP. The server counts the
respawn and stamps the new count on the message.

| | |
|---|---|
| Built | `frame2.js:42923`, a reliable message through `Event` |
| Checked by the match server | `flash.js:3830-3864`; under `respawn_model: "v2"` only a chat warning (`:3833-3849`) |
| Relayed | `flash.js:4056-4067`, to every client including the sender (`:3859`, `:4060`) |
| Applied by every receiver | `flash.js:4095-4139` |

#### The console command

```
js pb.event("RESPAWN", pb.num(0), pb.num(0), pb.num(100))
```

A respawn at (0, 0) with 100 HP. The game itself sends (0, 0) when it finds no spawn point
(`frame2.js:42815-42818`), and it always sends its own `hmax` as the HP (`:42848`). Sending
this by hand moves you on the other screens only: your own client does not apply its own
echo (`flash.js:4107`).

#### What real ones look like

From `netlog show`, numbers decoded. A sent one has 3 parts. A received one has 5: the sender's
slot in front, and the server's respawn count at the end.

| Situation | Direction | As recorded |
|---|---|---|
| Own respawn | sent | `RESPAWN(9022, -1817, 600)` |
| The echo of that respawn, 32 ms later | received | `RESPAWN(1, 9022, -1817, 600, 1)` |
| A second respawn in the same match | sent, then received | `RESPAWN(8450, -1829, 600)` → `RESPAWN(1, 8450, -1829, 600, 2)` |
| Another player, after 28 respawns | received | `RESPAWN(4, 8776, -1840, 450, 28)` |
| A map with very high max HP | received | `RESPAWN(0, 2228, -1958, 99999999, 55)` |
| A spawn point left of 0 | sent | `RESPAWN(-847, 124, 165)` |

#### How it works

1. **The sender respawns itself.** It takes the spawn point it chose (`frame2.js:42810-42822`) and resets
   its own player: HP to `hmax` and all four body-part HPs to the same value
   (`:42848`, `:42865-42868`), position, velocity and body segments (`:42854-42902`). It
   refills the grenade counts (`:42859-42861`).
2. **It sends x, y and HP** (`frame2.js:42923`) and adds 1 to its own `respawns` at once
   (`:42924`).
3. **The match server checks the queue.** Under `respawn_model: "v2"` it expects the sender at
   the head of the respawn queue with a fresh permission. If so it takes the sender off the
   queue (`flash.js:3836-3843`). If not, it only posts a warning in chat (`:3845`, `:3848`) and
   goes on: nothing here refuses a respawn.
4. **The server updates its copy** (`flash.js:3851-3863`): HP from part 3, `respawns` + 1,
   the last-hit time cleared, the "still dead" timer cleared, and part 4 set to the new count.
   It then commits a pending kill result (`:3863`, see Situations).
5. **The server relays it to everyone, the sender included** (`flash.js:3859`, `:4060`).
6. **Each receiver applies it** (`flash.js:4095-4139`). Every receiver stores part 4 as that
   player's `respawns` (`:4103`). If the respawn is not its own, or it is a spectator
   (`:4107`), it also leaves a copy of the old body behind (`:4109`), plays the respawn effect
   at x, y (`:4113`), puts all 10 body segments at x, y with no velocity (`:4115-4127`), and sets
   HP and the four body-part HPs to part 3 (`:4132-4136`).

#### Field by field

Part numbers as the server and the receivers read them; on a received message the sender's
slot comes first and is removed before this.

| Part | Read as | Meaning | Sent as |
|---|---|---|---|
| 1, 2 | number | x, y of the spawn point | world coordinates, rounded |
| 3 | number | the HP to set | the sender's `hmax` |
| 4 | number | the player's `respawns` | written by the server |

**Parts 1 and 2, x and y.** The spawn point the sender chose. The server does not read them.
Receivers place the player and all body segments there (`flash.js:4115-4127`) and play the
effect there (`:4113`). Nothing checks them against the map's spawn points.

**Part 3, the HP.** The sender writes its own `hmax` (`frame2.js:42848`, `:42923`). The
server copies it into its own HP for that player with no bound (`flash.js:3851`). Receivers set
HP and the four body-part HPs to it (`:4132-4136`), also with no bound. The server's health
check on the state message (`:938-944`) compares the reported HP with the match's `hmax`
later, not here.

**Part 4, `respawns`.** The sender does not write it. The server writes its new count after
the last part (`flash.js:3857`), so the received message is one part longer. Every receiver,
the sender too, stores it (`:4103`). This is the counter `HIT_PLAYER`, `HEAL_PLAYER` and
`DAMAGE_PLAYERS_VIA_EXPLOSION` carry: a hit stamped with the old count is dropped.

#### Situations

- **Hits in flight.** The server clears the last-hit time on respawn (`flash.js:3854`), so
  a kill can no longer be credited to someone who hit the old body. Hits fired at the old body
  carry the old `respawns` and are dropped by the server and by every receiver.
- **The counters agree again.** The sender counts up at once (`frame2.js:42924`) and then takes
  the server's count from the echo (`flash.js:4103`). If they drifted apart, the server posts
  `Respawn counter desync has been resolved` once they match (`:921`).
- **Respawn queue (v2).** A client that respawns without permission is still respawned.
  The only sign is the server's chat line `respawns without respawn permission or it has
  expired` (`flash.js:3848`) or `respawns yet is not at the start of the respawn queue`
  (`:3845`).
- **Pending kill results.** In a TDM match a kill's ranked result and the other team's point
  wait until the dead player respawns or is revived, or leaves (`flash.js:7077-7100`,
  `:7105-7136`, `:6854`). This respawn commits them (`:3863`). In other modes they apply at
  once (`:7102`).
- **"Still dead".** While the server holds a player at 0 HP and that player's state claims
  more, the server sends `YOU_ARE_STILL_DEAD` once a second (`flash.js:1096-1112`). The
  respawn sets the server's HP and clears that timer (`:3851`, `:3855`).
- **Who may send it.** A spectator's respawn is refused (`flash.js:1930-1934`).
- **For the local server's maintainer.** This is where the server's copy of a player comes
  back to life. Part 3 is taken as is; a server that wants to enforce a max HP has to do it
  here.

### 3 · GRENADE_THROW — reserved, sent by nobody

Assigned an opcode at `flash.js:89` and never used. No code builds it and no handler reads
it. A grenade is created with `PROJECTILE_CREATE` (a negative part 1) and then moves inside the
sender's state message (`flash.js:558-591`).

| | |
|---|---|
| Built | nowhere |
| Checked by the match server | no branch; it falls through to the relay (`flash.js:4056-4067`) |
| Applied by receivers | no branch in `flash.js:4095-4850`; it is only written to the message log when `TRACK_MP_LOGS` is on (`:1938-1953`) |

#### The console command

```
js pb.event("GRENADE_THROW", pb.num(1), pb.num(0), pb.num(0))
```

The wire form only. The server passes it on to the other clients, and they ignore it.

### 4 · HIT_PLAYER — client → match server → every other client

One projectile hitting one player. The shooter's client decides that it hit and how much it
hurt. The match server keeps its own score with that number, and every other client draws the
hit and copies the number.

| | |
|---|---|
| Built | `frame2.js:30493-30510`, sent at `:30528` |
| Checked by the match server | `flash.js:3866-3931`, with `match.$1eMМеТ` at `:6923-6986` |
| Relayed | `:4056-4066` |
| Applied by every receiver | `:4314-4383` |
| Only with | match netcode 3 or later; older netcode sends the same values as a `;hit\|…` string in the state instead (`frame2.js:30473-30491`) |

#### The console command

```
js pb.event("HIT_PLAYER", pb.num(1), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(10), pb.num(0))
```

A 0.1 damage hit on slot 1 with every other field zeroed. It only counts if part 14 matches
slot 1's respawn counter (see part 14 below).

#### What real hits look like

Recorded with `netlog show` on the local server (`npm run server`), numbers decoded. A sent
message has 14 parts. A received one has 16: the match server puts the shooter's slot in
front and writes part 15 at the end.

| Situation | As received |
|---|---|
| Body hit, armed victim | `HIT_PLAYER(9, 8, 3, 350, 100, 1, 5181, -1830, -47, 18, 3, -11, 5, 8750, 2, "")` |
| The same gun, unarmed victim | `HIT_PLAYER(7, 3, 3, 350, 100, 1, 6479, -2186, -49, -7, 3, -11, 5, 13125, 38, "")` |
| Same gun, limb 2 | `HIT_PLAYER(9, 8, 2, 350, 100, 1, 5192, -1790, -48, 12, 3, -11, 1, 10500, 2, "")` |
| Same gun, limb 0 | `HIT_PLAYER(0, 7, 0, 350, 100, 1, 5677, -7440, 0, -50, 3, -11, 7, 19250, 14, "")` |
| A hit that leaves the victim at 0 HP | `HIT_PLAYER(2, 5, 0, 350, 100, 1, 5501, -1982, -49, 12, 3, -11, 7, 28875, 23, "1")` |
| Limb 1, on a victim already down | `HIT_PLAYER(0, 4, 1, 550, 100, 32, 9161, -1870, 150, 4, 5, 3, 4, 16500, 2, "1")` |
| Extra knockback, low power | `HIT_PLAYER(0, 3, 3, 58, 158, 30, 4667, -2262, 123, 42, 1, 81, 5, 2175, 1, "")` |
| A frame-41 projectile, no damage | `HIT_PLAYER(1, 0, 0, 100, 0, 41, 5544, -4243, 103, -282, 0, 14, 7, 0, 4, "")` |

The same hit as its shooter sent it: no shooter slot in front and no part 15.

```
HIT_PLAYER(5, 0, 350, 100, 1, 5352, -2495, -50, 0, 3, -11, 7, 28875, 6)
```

Every damage in the table follows the formula under part 13. For example, the first row is
power 3.5 × 25 for limb 3 = 87.50, sent as `8750`. The second row is the same shot × 1.5,
because the victim held no gun.

#### How it works

1. **The shooter's client finds the hit.** Every frame, each projectile is tested against
   every player it may hit (`frame2.js:30316-30323`): not the shooter, and not a teammate
   unless the projectile is frame 41 or the rules let teams hurt each other. The first body
   segment it touches decides the limb (`:30329-30391`). The victim's state can then turn one
   limb into another (`:30410-30433`).
2. **It applies the hit to its own copy of the victim** with `$eМcМlТ` (`:30518`, the
   function at `:32350`). It sends the HP that copy lost: health before (`:30515`) minus
   health after (`:30523`), × 100 (`:30527`). Only the projectile's owner sends
   (`:30469-30471`), so each hit is sent once.
3. **The match server checks it** (`flash.js:3866-3931`). It drops the message if the damage
   is not a number (`:3881`), if the victim's slot is empty (`:6927-6928`), or if part 14 is
   not the victim's respawn counter (`:6930`). Otherwise it subtracts the damage from its own
   copy of the victim's HP (`:6979`). At 0 or less that copy dies and the kill is scored
   (`:6981-6982`). Part 15 is set to `"1"` when the server's copy is at 0 HP after the hit
   (`:3929`).
4. **The server relays it** to every other client in the match: it adds the shooter's slot
   as the new part 1 (`:4056`) and sends to everyone but the shooter (`:4058-4066`). There is
   no team filter for this message; the team-only flag at `:4038-4039` is for team chat. A
   message the server refused is not relayed.
5. **Each receiver applies it** (`:4314-4383`). It removes the shooter slot and records who
   it was (`:4084-4092`). Then it drops the hit on a respawn mismatch (`:4349`) or a negative
   power (`:4352`), runs the same `$eМcМlТ` for the effects (blood, push, damage indicator),
   and sets the victim's HP from the received damage (`:4370-4378`).

The damage number travels unchanged from the shooter to everyone. The match server does not
recompute it from the power or the limb, and receivers do not check it against their own
result. They use whichever result does more damage (part 13).

#### Field by field

Part numbers are as the match server and the receivers read them, after the shooter slot is
removed. The names in quotes are the game's own: each receiver writes them into its message
log (`flash.js:4335-4346`, kept when `TRACK_MP_LOGS` is on, `frame2.js:1143`).

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | victim slot | slot index |
| 2 | number | `limb_type` | 0, 1, 2 or 3 |
| 3 | number / 100 | `projectile_power` | power × `$ММ.$Мссe1o` (100, `flash.js:191`) |
| 4 | number / 100 | `projectile_knockback_multiplier` | multiplier × 100 |
| 5 | number | `projectile_frame` | the projectile's animation frame |
| 6, 7 | number | x, y | world position of the hit |
| 8, 9 | number / 5 | `spx`, `spy` | velocity × `$ММ.$MеМMА` (5, `flash.js:178`) |
| 10 | number | `cclass` | projectile class |
| 11 | number | `source` | the weapon that fired it |
| 12 | number | `local_atom_id` | index of the body segment that was hit, 0-9 |
| 13 | number / 100 | `provided_health_delta` | HP lost on the shooter's copy × 100 |
| 14 | number | the victim's `respawns` | as the shooter knows it |
| 15 | string | died flag | written by the match server |

**Part 1, the victim's slot.** The server looks up the connection in that slot
(`flash.js:3868-3869`). An empty slot fails the check at `:6927-6928`, and the message is
dropped. Receivers use their own player in that slot (`:4332`). If a player leaves and someone
else takes the slot while the message is on its way, part 14 normally stops the hit landing on
the newcomer.

**Part 2, `limb_type`.** It does three things:
- Sets the damage factor on whichever client runs `$eМcМlТ` (part 13).
- Sets the size of the blood effect: limb 0 gets `min(5 × power, 7)`, the others
  `min(2 × power, 7)` (`frame2.js:32672`, `:32680`).
- Is stored as the victim's last-hit limb on the server (`flash.js:6960`). If this hit leads
  to a kill, that limb goes into `PLAYER_DIES` (`:7017`).

The values are constants at `frame2.js:4797-4800`. Limb 0 comes from segments 6 and 7
(`:30333-30336`), limb 3 from segment 5 (`:30339-30349`), limb 2 from segments 0, 1 and 2
(`:30352-30389`), and limb 1 from segments 3 and 4. Limb 1 is only tested when the victim is
down (`:30360-30369`).
The code holds no names for them. Limb 0, with the largest factor and the larger blood burst,
behaves as the head.

**Part 3, `projectile_power`.** The base of the damage (part 13). It also scales the push
(by its square root, `frame2.js:32688-32689`) and the blood effect. Receivers drop a hit whose
power is negative (`flash.js:4352`). In `$eМcМlТ` a missing power counts as 1 and a power over
100 000 is capped (`frame2.js:32368-32375`). The server does not read this part.

**Part 4, `projectile_knockback_multiplier`.** It multiplies only the push: the victim's
velocity while alive (`tox`, `toy`, `frame2.js:32647`, `:32688-32689`) and the ragdoll impulse on segments within
30 px of the one hit (`:32726-32728`). 100 is the normal push and 0 is none, as in the frame-41
row. The recorded 158 pushes 1.58 times as hard for the same power. It does not change damage.

**Part 5, `projectile_frame`.** The projectile's visual frame, which identifies its kind.
Three frames change behaviour:
- Frame 41 zeroes the damage before the 0.01 floor (`frame2.js:32447-32448`). Its hits are
  sent even between teammates (`:30323`), and a frame-41 hit from a teammate does not count as
  that teammate's hit for kill credit (`:32488-32489`). In recordings, frame-41 hits arrive with
  damage 0 and knockback 0.
- Frames 29 and 51 use the second hit effect (`:32436-32437`).

**Parts 6 and 7, x and y.** Where the hit landed: the middle of the projectile's last step
(`frame2.js:30397-30398`), or a point along it when the test found a closer hit
(`:30402-30405`). Receivers draw the hit effect and the blood there (`:32430-32439`, `:32672`).
Nothing checks them against the victim's position. With netcode 3, the geometry re-check in
`$рТeерО` returns early (`:32189-32190`), so a receiver draws the hit where the shooter saw it.

**Parts 8 and 9, `spx` and `spy`.** The projectile's velocity, sent × 5 and divided by 5 on
receipt (`flash.js:4324-4325`). They give the direction of the push (`frame2.js:32688-32689`)
and of the blood. On the victim's own screen they also give the side of the red damage
indicator, `$1ОHоОА(-spx, -spy, …)` (`:32717`). A zero velocity gives a hit with no push.

**Part 10, `cclass`.** The projectile class. Class `$O1есo` uses the first hit effect
(`frame2.js:32432-32433`). On the shooter's side some classes are hidden once they have hit
(`:30557`). The server does not read it.

**Part 11, `source`.** The weapon. The server stores it as the victim's last-hit weapon
(`flash.js:3877`, `:6964`), and `PLAYER_DIES` reports it as the cause of death (`:7018`). The
receivers' copy feeds their own records (`frame2.js:32502`).

**Part 12, `local_atom_id`.** Despite the name, this is the index of the body segment that was
hit (`frame2.js:31028-31051`). Receivers turn it back into the segment (`$M0eIТО`,
`:31053-31076`, called at `flash.js:4363`) to place the blood and push that segment. It must
match part 2: segment 7 with limb 0, segment 5 with limb 3, and so on. An unknown index gives
`-1`, and the push then goes to no segment.

**Part 13, `provided_health_delta`.** The damage. The shooter's `$eМcМlТ` computes it as:

1. Start from the power: `v = power`. Frame 41 sets `v = 0` (`frame2.js:32447-32448`).
2. ×1.5 when the victim is a player holding no gun (`:32461-32463`).
3. ×0.1 when shooter and victim are on the same team and either is a player (`:32468-32471`).
4. A floor of `0.01` (`:32519-32520`).
5. HP lost = `v` × the limb factor:

| Limb | Factor | Line |
|---|---|---|
| 0 | 55 | `:32563` |
| 1 | 20 | `:32621` |
| 2 | 30 | `:32592` |
| 3 | 25 | `:32537` |

What the server does with it, by value:
- **Positive:** subtracted from the server's copy of the victim's HP (`flash.js:6979`).
- **Zero:** passes the check like any hit. It records the shooter as the last attacker
  (`:6960-6964`) and takes no HP.
- **Negative:** replaced with 0 (`:3884-3886`). The message is still checked, under the
  no-damage rules: a shooter at 0 HP may not send one about himself (`:3889-3891`). For a
  teammate the check only refreshes a 3-second window on a downed victim (`:6948-6957`,
  `$ММ.$0AA1HO = 3000`, `:18`); in that window the victim's own health update is accepted
  although they are at 0 HP (`:934-936`). For an enemy it records the attacker and takes no
  HP. Either way the server rewrites part 13 to `0` and part 15 to `""` (`:3908-3909`).
  Receivers therefore never see a negative value. The builder cannot produce one, because
  `$eМcМlТ` only subtracts and throws on a negative `v` (`frame2.js:32527`).
- **Not a number:** the message is dropped (`flash.js:3881-3882`).
- **Over the victim's HP:** subtracted anyway. The server's copy goes to 0 or below and dies
  (`:6981-6982`). There is no upper bound here.

Each receiver then runs `$eМcМlТ` on the victim. Only the victim's own client lets that run
take HP: the last argument is "this victim is me" (`flash.js:4364`), and it gates the
subtraction (`frame2.js:32533`). Then (`flash.js:4370-4378`):
- **Positive:** HP = the lower of the current HP and HP before minus the damage. The victim's
  client keeps whichever of its own result and the shooter's number hurt more. Other clients,
  which took nothing in the run, simply subtract the number.
- **Zero:** HP = the higher of the two, capped at `hmax`. The victim's own run is undone, and
  a zero hit leaves HP as it was.

**Part 14, the victim's `respawns`.** The shooter writes the counter it knows (`frame2.js:30510`).
The server increments the counter on every `RESPAWN` and `RESSURECT`, and writes the new value
into the relayed message (`flash.js:3852`, `:3857`), so every client keeps the same count. A
mismatch drops the hit on the server (`:6930`) and on every receiver (`:4349`). A shot fired
just before the victim respawned, but arriving after, therefore does not hit the new body.

**Part 15, the died flag.** The shooter does not send it. The server writes `"1"` when its copy
of the victim is at 0 HP or below after this hit (`flash.js:3929`), or `""` otherwise. On the
victim's own client, a `"1"` forces HP to 0 if it is still above (`:4380-4383`), so the victim
dies on screen when the server says they died. Other clients ignore it.

#### Situations

- **Lag, shooter's view.** A shooter 150 ms behind sees the victim where they were 150 ms ago,
  and hits that. The server never checks positions, and receivers skip the geometry re-check
  at netcode 3 (`frame2.js:32189-32190`). The hit lands, and the victim can be hit after
  reaching cover on their own screen. This is shooter-side hit detection: smooth for the
  shooter, at the victim's expense.
- **Two shooters at once.** The server handles them one at a time. The first takes the
  server's copy to 0, kills it, and its shooter is credited (`flash.js:7012-7039`). The second
  finds the copy at 0: the check skips its damage and attacker records (`:6933`), and only
  relays it with part 15 `"1"`. The second shooter does not steal the kill.
- **Respawn race.** The victim respawns while a hit is in flight. Part 14 is one behind, so the
  hit is dropped everywhere (`:6930`, `:4349`). The netlog shows the message going out, and
  nothing happens.
- **The victim's client disagrees.** The victim's client may see a bigger hit than the shooter,
  for example because it holds a gun the shooter has not seen yet, which changes the 1.5
  factor. It keeps the bigger damage (`:4375`). The server keeps the shooter's number, and the
  died flag settles the case where only the server thinks the victim died (`:4380-4383`). If
  the counters drift apart, `Respawn counter desync has been resolved` in chat (`:921`) shows
  the server correcting one.
- **Kill credit.** The server credits a kill to the last player who hit the victim within
  7 seconds, if that player is still in their slot (`flash.js:7012-7013`). That player's
  `kills` goes up, or down for a teammate (`:7030`, `:7039`), and the victim's `deaths` goes up
  (`:7053`). Limb and weapon come from that last hit (`:7016-7018`). A zero-damage hit from an
  enemy also counts as a hit for this.
- **Who may send it.** A spectator's message is refused with "not compatible with spectator
  mode" (`flash.js:1930-1934`). In a player-hosted (p2p) match the lobby ignores it
  (`:1814-1820`), and the hosting player's app runs this same handler. A client also ignores a
  gameplay message that came from the lobby instead of that host (`:1851-1859`).
- **For the local server's maintainer.** `src/server/` runs this handler from the decoded
  `flash.js`, so the server's copy of HP and the kill credit behave as above. To see why a hit
  did nothing, compare part 14 with the victim's last `RESPAWN` and check part 13 for a value
  that is not a number. To check the damage numbers, recompute power × factor from the tables
  above and compare with part 13.

### 5 · DAMAGE_PLAYERS_VIA_EXPLOSION — client → match server → every other client

The damage one player's explosions did to every player in range. The thrower's client works
out the damage on its own copies of the victims, sums it per victim, and sends one batch. The
match server answers at once, keeps its own score with the numbers, and relays the batch. Each
victim's own client then takes the damage.

| | |
|---|---|
| Collected | `frame2.js:31169-31197`, `:31381-31393`, in the explosion code (`$рeOАНс` at `:17097`, `$МсTОlT` at `:31080`) |
| Built and sent | `flash.js:650-709`, in the per-tick sender (`$ТеeАp`, `:421`), as a request with a reply id |
| Answered, checked and rewritten by the match server | `flash.js:3934-3988`, with `match.`$1eMМеТ`` at `:6923-6987` |
| Relayed | `flash.js:4056-4067`, to every other client |
| Applied by every receiver | `flash.js:4386-4530` |

#### The console command

```
js pb.event("DAMAGE_PLAYERS_VIA_EXPLOSION", pb.num(0), pb.num(1), pb.num(0), pb.num(0), "", "", "", pb.num(0), "", "", "", "", pb.num(0), pb.num(0), pb.num(0))
```

A reply id of 0, then one victim group for slot 1 with no damage, no push and no atoms: the
shape the game sends for a player who was in range but took nothing. It only counts if the
second-to-last value matches slot 1's respawn counter. The answer comes back as `RESPONSE(0)`
and finds no callback. A group shorter than 14 values makes the server's decoder throw on the
missing parts (`flash.js:5292`).

#### What real ones look like

From `netlog show`, numbers decoded. `""` is a zero written short: the builder writes most
zeros as an empty part (`flash.js:5257-5259`). The health damage (the 8th value of a group) is
the exception: it is always written as a number, so `""` there comes only from the server.

A sent batch starts with the reply id. A received one starts with the thrower's slot and an
empty part where the reply id was.

| Situation | Direction | As recorded |
|---|---|---|
| The thrower caught in its own blast: health damage 0, part damage 23/0/47/47, 5 atoms | sent | `DAMAGE_PLAYERS_VIA_EXPLOSION(108, 0, 8687, 82, 22, -19, 150, 0, 23, "", 47, 47, 6, 1, 5, 0, 16, -76, 79, -379, 1, 51, 66, 256, 330, 2, 81, 14, 403, 68, 5, 8, -71, 39, -354, 7, 0, -68, -1, -339)` |
| Two victims of two different explosions in one batch (603 and 843 are the blast x) | sent | `DAMAGE_PLAYERS_VIA_EXPLOSION(120, 0, 603, -5, -4, -8, 50, 0, "", "", 13, "", 0, 0, 2, 1, -12, -26, -61, -129, 2, -18, -32, -88, -158, 16, 843, -9, 9, -10, 125, 67, 13, "", 27, 27, 0, 0, 5, 0, -18, -62, -92, -309, 1, 36, 57, 182, 287, 2, 54, 42, 269, 208, 5, -10, -57, -50, -286, 7, -1, -53, -6, -264)` |
| One victim, 5 HP, no push, no atoms | received | `DAMAGE_PLAYERS_VIA_EXPLOSION(0, "", 1, 3, -3020, "", "", "", 5, 2, "", 1, 3, 87, 10, 0)` |
| A blast that leaves the victim at 0 HP on the server | received | `DAMAGE_PLAYERS_VIA_EXPLOSION(6, "", 9, 10347, -2078, -4, 2, 23, "", 4, "", "", 4, 81, 9, 2, 5, -10, 13, "", "", 7, -19, -1, "", "")` |
| A blast on a body the server already holds at 0 HP | received | `DAMAGE_PLAYERS_VIA_EXPLOSION(0, "", 5, 7912, -2213, -4, 4, 41, "", "", "", "", "", 3, 14, 1, 8, -26, 29, -129, 147)` |

The first row is self-damage: the head took 23 but the health damage is 0, because the builder
zeroes it for the thrower's own slot (`frame2.js:31390-31393`). In the second row slot 0 is
again the thrower and slot 16 lost 67 HP.

#### How it works

1. **The thrower's client damages its copies.** When an explosion goes off, the client that
   owns it runs the damage for every body segment in range (`frame2.js:17205-17287`). Only the
   owner does this for a player's explosion (`:17218-17220`); characters that are not players
   follow other rules (`:17227-17232`). It passes its batch object only when
   it is the owner and not a spectator (`:17286`).
2. **It sums the damage per victim** (`frame2.js:31169-31197`, `:31381-31387`): push, stability,
   HP lost, the four body-part HPs lost, and a push and a blood spray for each segment. The
   explosion point and the weapon are overwritten by the latest explosion (`:31191-31197`).
   The thrower's own HP loss is set to 0 (`:31390-31393`); its own HP reaches the server in
   its state message.
3. **One batch at a time.** Each tick, if no batch is waiting for its answer and the sum is not
   empty, the client sends it with a reply id (`flash.js:650-702`) and empties the sum
   (`:707-708`). The next batch waits for the answer (`:702-705`). Explosions in between are
   summed into the next batch.
4. **The match server answers and checks** (`flash.js:3934-3988`). It answers with an empty
   list at once (`:3936-3937`) and blanks the reply id (`:3939`). For each victim group it
   runs the same check as a hit, as limb 3, with the sender as the attacker
   (`:3972-3981`). A group that fails the check stays in the message unchanged (`:3981`). If
   the server's copy of the victim is at 0 HP or less after the group, it empties that
   group's health damage part (`:3983-3986`).
5. **The server relays it** to every other client, with the sender's slot in front
   (`flash.js:4056-4067`).
6. **Each receiver applies it** (`flash.js:4386-4530`). It drops a group whose respawn count
   does not match (`:4440`). Only the victim's own client takes the push, the HP and the
   body-part HP (`:4442-4451`). Every client plays the hurt reaction (pain sound and flinch, `frame2.js:16730`) and the
   blood (`flash.js:4453-4461`, `:4498`), and the victim's client pushes each listed segment
   (`:4489-4495`) and shows the red damage indicator (`:4520-4521`). An empty health damage
   puts the victim at 0 HP on its own client (`:4406-4408`, `:4525-4529`).

#### Field by field

After part 1 come victim groups until the message ends. Each group is 14 values, then 5
values for each atom it lists. The names in quotes are the receiver's message log (`flash.js:4415-4429`,
`:4481-4486`) and the builder's object (`:662-697`).

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | reply id | the reply id; the server blanks it |
| group 1 | number | victim slot | slot index |
| group 2, 3 | number | `explosion_x`, `explosion_y` | the latest blast point, rounded |
| group 4, 5 | number / 5 | `tox`, `toy` | push × 5 (`flash.js:670-671`) |
| group 6 | number / 100 | `stability_damage` | stability lost × 100 |
| group 7 | number, or empty | `hea_damage` | HP lost × 1; empty = the server holds the victim at 0 HP |
| group 8-11 | number | `hp_head_damage`, `hp_arms_damage`, `hp_legs_damage`, `hp_body_damage` | body-part HP lost × 1 |
| group 12 | number | `source` | the weapon |
| group 13 | number | `respawns` | the victim's respawn count, as the thrower knows it |
| group 14 | number | atom count | how many atoms follow |
| atom 1 | number | `local_atom_id` | body segment index |
| atom 2, 3 | number / 5 | `atox_add`, `atoy_add` | push on that segment × 5 |
| atom 4, 5 | number / 5 | `particles_tox`, `particles_toy` | blood spray direction × 5 |

**Part 1, the reply id.** The placeholder the sender swaps for its counter
(`flash.js:657`). The server answers it at once with no values (`:3936-3937`) and replaces it
with `""` before the relay (`:3939`). The answer only opens the next batch (`:702-705`).

**The victim slot.** On the server it selects the connection (`flash.js:3947`); an empty slot
fails the check (`:6927-6928`) and the group is relayed unchanged. On receivers it selects the
player (`:4398`); a missing player skips the effects but the parts are still read.

**`explosion_x`, `explosion_y`.** The latest blast that touched this victim
(`frame2.js:31191-31192`). Receivers use them only for the direction of the red damage
indicator (`flash.js:4521`) and the log.

**`tox`, `toy`.** The push the victim's body gets, summed over the batch. Divided by 5 on
receipt (`flash.js:4402-4403`) and added to the victim's velocity on its own client only
(`:4444-4445`). The server does not read them.

**`stability_damage`.** How much the blast knocks the victim off balance, × 100 on the wire
(`flash.js:672`, `:4404`). The victim's client subtracts it from its stability (`:4451`).

**`hea_damage`.** The HP the thrower's copy lost: HP before minus HP after
(`frame2.js:31383`). Each segment hit takes `max(0.1, |power| / 6)` HP (`:31270`); in a
networked match the thrower's own blast does half (`:31257-31258`). The thrower's own group is
always 0 (`:31390-31393`). On the server:
- **Positive:** subtracted from the server's copy (`flash.js:6979`). At 0 or less the victim
  dies and the kill is scored with limb 3 and this group's weapon (`:6981-6982`,
  `:7016-7018`).
- **Negative:** treated as 0 for the server's copy (`:3959-3960`). The relayed part keeps
  the sent value. The builder only subtracts, so it does not produce one.
- **Server at 0 HP after the group:** the part is emptied (`:3983-3986`).

On the victim's own client the value is subtracted from HP (`:4450`). An empty part means
"all of your HP" (`:4406-4408`), and HP is then forced to 0 (`:4525-4529`), so the victim dies
on screen when the server says so.

**The four body-part damages.** What each body-part HP of the thrower's copy lost
(`frame2.js:31384-31387`), sent without scaling. Head, arms, legs and body each take
`|power| / 6` per segment of that part (`:31277-31300`). The victim's own client subtracts
them (`flash.js:4446-4449`). A body part at 0 is drawn as lost (the legs, for example, at
`frame2.js:16278-16297`).
The server does not read them.

**`source`.** The weapon that made the blast (`frame2.js:31197`). The server stores it as the
victim's last-hit weapon (`flash.js:3966`, `:6964`), and `PLAYER_DIES` reports it
(`:7018`). Receivers skip it (`:4433`).

**`respawns`.** The victim's respawn count when the thrower hit it (`frame2.js:31186`). A
mismatch fails the server's check (`flash.js:6930`) and makes receivers skip that group's
damage (`:4440`). The atoms are still drawn.

**The atom count and the atoms.** One entry per body segment that was pushed or sprayed
(`frame2.js:31199-31205`, `:31317-31323`). Each is the segment index and four values × 5
(`flash.js:692-697`, `:4469-4474`). The victim's client adds the push to that segment
(`:4493-4494`). Every client sprays blood from it (`:4498`). The server skips them
(`:3970`).

#### Situations

- **Many explosions, one message.** A grenade launcher or a chain of barrels sends one batch,
  not one per blast. The values are sums; the blast point is the last one. While a batch
  waits for its answer, new damage piles up for the next one, so a slow round trip makes the
  batches bigger, not more frequent.
- **Who decides the damage.** The thrower's client. The server keeps its own HP with the
  number but does not recompute it. The victim's client takes the number as it comes.
- **The died marker.** The empty health damage is how the server tells the victim it is dead
  when the clients disagree: the victim's client forces its HP to 0 (`flash.js:4525-4529`).
- **Teammates and bystanders.** A teammate in range gets a group with push and no damage: the
  damage needs an enemy, the thrower himself, or a flag the caller passes
  (`frame2.js:31231`). Groups for slots the server has no connection for fail the check
  and pass through unchanged (`flash.js:3981`).
- **Kill credit.** The server records the thrower as the last attacker for every group whose
  victim it holds above 0 HP, even with no damage (`flash.js:6933`, `:6960-6964`), so a no-damage blast on an enemy can
  still earn the kill if the enemy dies within 7 seconds (`:7012-7013`).
- **Respawn race.** A batch stamped before the victim respawned misses on the server and on
  the receivers, as with `HIT_PLAYER`.
- **For the local server's maintainer.** The server answers before it checks anything, so a
  bad batch never blocks the next one. A group cut short makes the server's decoder throw on
  the missing part (`flash.js:5292`). To check a kill, add up `hea_damage` over the victim's groups since its
  last `RESPAWN`.

### 6 · HEAL_PLAYER — client → match server → every other client

One defibrillator shot reaching one player. The healer's client decides who is in reach.
Every other client applies the same shot to its own copy: a downed teammate is revived, and
an enemy who is still up loses HP.

| | |
|---|---|
| Built | `frame2.js:35708-35719`, in the gun's fire code, for a gun of type 7 (`:35680`) |
| Checked by the match server | `flash.js:3990-4012`, with `match.`$1eMМеТ`` at `:6923-6987` |
| Relayed | `flash.js:4056-4067`, to every other client |
| Applied by every receiver | `flash.js:4533-4554`, with `$еHТТе` (`frame2.js:5222-5410`) |
| Only with | match netcode 3 or later; older netcode sends a `;heal\|…` string in the state instead (`frame2.js:35698-35705`) |

#### The console command

```
js pb.event("HEAL_PLAYER", pb.num(100), pb.num(0), pb.num(1), pb.num(0))
```

The shape the game sends when gun 0 is a defibrillator and its shot reaches slot 1: power
1.00, gun 0, slot 1, and slot 1's respawn counter 0. It only counts if part 4 matches.

#### What real ones look like

From `netlog show`, numbers decoded. A received one has the healer's slot in front.

| Situation | Direction | As recorded |
|---|---|---|
| A shot reaching slot 5, sent with `PROJECTILE_CREATE(3)` in the same millisecond | sent | `HEAL_PLAYER(100, 3, 5, 0)` |
| A shot from slot 4 | received | `HEAL_PLAYER(4, 100, 3, 2, 4)` |
| One shot reaching two players | sent, same millisecond | `HEAL_PLAYER(100, 2, 1, 4)` and `HEAL_PLAYER(100, 2, 3, 3)` |
| The same target again, about every 800 ms | sent | `HEAL_PLAYER(100, 2, 3, 3)` |
| A target on its 273rd life | received | `HEAL_PLAYER(3, 100, 29, 9, 273)` |

Part 1 is always 100 in the recordings: the defibrillator is the only gun of type 7, and its
power is 1 (`guns.js:293`, `:308`, `:316`).

#### How it works

1. **The healer's client finds who is in reach.** When a type 7 gun fires, a player is in
   reach if the healer's arm segment lies within 60 px left or right of that player's body
   point, and between 40 px above and 80 px below it (`frame2.js:35682-35688`; the segment is
   an arm by the body-part table at `:31298`). Teammates and enemies alike.
2. **It applies the shot to its own copy** with `$еHТТе` (`frame2.js:35691-35692`).
3. **It sends one message per player in reach** (`frame2.js:35708-35719`), but not for
   itself unless it is in the second down state described under Situations (`:35696`). The
   gun's own fire is sent as a `PROJECTILE_CREATE` with no projectiles (`:35674-35675`).
4. **The match server checks it** (`flash.js:3990-4012`). It drops a heal a downed healer
   aims at himself (`:3998-4000`), and a heal whose target slot is empty or whose respawn
   count does not match (`:6927-6931`). For a teammate it may open a 3-second revive window
   (`:6948-6957`). For an enemy it records the healer as the last attacker
   (`:6960-6964`). It never changes HP (`:6966-6968`). It resets the healer's inactivity
   timer (`:4048-4053`).
5. **The server relays it** to every other client, with the healer's slot in front
   (`flash.js:4056-4067`).
6. **Each receiver applies it** (`flash.js:4533-4554`). It drops the heal on a respawn
   mismatch (`:4547-4548`), runs `$еHТТе` with the healer and the power (`:4550`), and caps
   the target's HP at `hmax` (`:4552-4553`).

#### Field by field

Part numbers as the server and the receivers read them, after the healer's slot is removed.

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number / 100 | `stat_power` | the gun's power × 100 |
| 2 | number | gun | the gun's index in the map's gun list |
| 3 | number | target slot | slot index |
| 4 | number | the target's `respawns` | as the healer knows it |

**Part 1, `stat_power`.** The gun's power × `$ММ.$Мссe1o` (100, `flash.js:191`), divided on
receipt (`:4535`) and logged (`:4542`). In `$еHТТе` a negative power counts as 0 and a
missing one as 1 (`frame2.js:5225-5229`). It scales every effect:
- A downed teammate below 5 HP comes back with `10 × max(1, power)` HP
  (`frame2.js:5273-5274`, `:5292-5293`, `:5329-5330`).
- A downed teammate at 5 HP or more gains `15 × power`, up to half of `hmax`
  (`:5275-5276`, `:5294-5295`, `:5331-5332`).
- An enemy who is not down loses `30 × power` HP (`:5385`).

The server does not read it.

**Part 2, the gun.** Not the healer's slot (the server puts that in front), but the healer's
gun: its index in the gun list (`frame2.js:9121-9122`, sent at `:35714`). Receivers pass it
as the weapon to `$еHТТе` (`flash.js:4550`), which stores it as the enemy's last-hit weapon
(`frame2.js:5398`). The server stores it the same way (`flash.js:4007`, `:6964`), so a kill
that follows names the defibrillator in `PLAYER_DIES` (`:7018`). Nothing checks that the
healer holds it.

**Part 3, the target slot.** The server looks up that connection (`flash.js:3992-3993`);
an empty slot drops the heal (`:6927-6928`). Receivers use their own player in that slot
(`:4545`).

**Part 4, the target's `respawns`.** The healer writes the count it knows
(`frame2.js:35718`). A mismatch drops the heal on the server (`flash.js:6930`) and on every
receiver (`:4547-4548`), so a shot aimed at a body that has since respawned does nothing.

**What the receiver's `$еHТТе` does with it** (`frame2.js:5222-5410`). It runs on every
client: the guard at `:5241` passes whenever the match netcode is above 1 (`flash.js:3360`).
- **Teammate, down or in the second down state:** revived with the HP above
  (`frame2.js:5245-5339`); at more than 0 HP the player is no longer dead (`:5279-5285`,
  `:5334-5339`). On the target's own client, after 7 revives in one life the revive only
  succeeds by chance (`:5247`, `:5253`; the count is reset on respawn, `:42872`).
- **Teammate who is up:** nothing.
- **Enemy who is not down:** loses `30 × power` HP, plays the hurt reaction, and the healer
  and gun are recorded as the last hit (`:5382-5398`).
- **Enemy who is down:** nothing.

#### Situations

- **Revive and the server.** The server never raises HP for a heal. The revived player's
  own client raises it and reports it in its state message. The server accepts that report
  from a player it holds at 0 HP only inside the 3-second window the heal opened
  (`flash.js:6951-6955`, `:934-936`). The window opens only when two body-part values in
  that player's last state are above 0 (`:924-926`).
- **Healing an enemy.** The same shot hurts an enemy for 30 HP on every client, the enemy's
  own client included, which then reports the lower HP. The server records the healer as
  the last attacker, so if the enemy dies within 7 seconds the healer gets the kill
  (`flash.js:7012-7018`).
- **Two healers at once.** Each heal is applied on its own; the second finds the target
  already up and does nothing.
- **The second down state.** The code tracks a second kind of down with a player flag that
  is cleared on revive (`frame2.js:5337`). A teammate in it can be healed while above 0 HP
  (`:5245`), and the healer may send a heal for himself while in it (`:35696`).
- **Activity.** A heal resets the healer's inactivity timer like a chat line or a shot
  (`flash.js:4048-4053`).
- **For the local server's maintainer.** The server never trusts a heal with HP. To follow a
  revive, look for the `HEAL_PLAYER`, then the target's next state with HP above 0 inside
  3 seconds.

### 7 · PROJECTILE_CREATE — client → match server → every other client

One shot from the sender's gun, or one thrown grenade. The shooter's client fires and sends
where each projectile starts and in which direction. Every other client creates the same
projectiles from its own copy of the gun, so all screens see the same shot.

| | |
|---|---|
| Built | `frame2.js:35568-35575` (a gun shot, one message for all its projectiles), `:31576-31609` (`$ссссol`, adds each projectile), `:32141-32142` (a grenade) |
| Checked by the match server | nothing; it resets the sender's inactivity timer (`flash.js:4048-4053`) |
| Relayed | `flash.js:4056-4067`, to every other client |
| Applied by every receiver | `flash.js:4177-4239` |
| Only with | match netcode 3 or later, on both ends (`frame2.js:31580`, `flash.js:4179-4180`) |

#### The console command

```
js pb.event("PROJECTILE_CREATE", pb.num(0), pb.num(1), pb.num(0), pb.num(0), pb.num(0))
```

Gun 0 fires projectile 1 from (0, 0) at angle 0. Receivers create it only if they see you
holding gun 0 (`flash.js:4188-4193`).

#### What real ones look like

From `netlog show`, numbers decoded. A received one has the shooter's slot in front.

| Situation | Direction | As recorded |
|---|---|---|
| One bullet: gun 0, projectile 0, angle 4.469 rad | sent | `PROJECTILE_CREATE(0, 0, 58, -402, 4469)` |
| Two projectiles in one shot | sent | `PROJECTILE_CREATE(7, 27, -1191, -1609, 4478, 28, -1191, -1609, 4478)` |
| 13 projectiles from one point, angles −0.001 to 0.468 | sent | `PROJECTILE_CREATE(88, 0, 6140, -1824, -1, 1, 6140, -1824, 29, …, 12, 6140, -1824, 468)` |
| A grenade of type 1 | sent | `PROJECTILE_CREATE(-1, 34, 2144, -2180, 0)` |
| A defibrillator shot: no projectiles | sent | `PROJECTILE_CREATE(3)` |
| A shot from slot 5 | received | `PROJECTILE_CREATE(5, 4, 1320, 8181, -1911, 1384)` |
| A grenade of type 3 from slot 6 | received | `PROJECTILE_CREATE(6, -3, 4, 18, -2967, 0)` |

#### How it works

1. **The shooter's client fires.** For each projectile of the shot (`frame2.js:35578`) it
   creates the projectile with `$I0cAoс` (`:35669`), which rounds the start point and the
   angle first (`:31697-31699`).
2. **It numbers each one and adds it to the message** (`frame2.js:31580-31606`): only its own
   projectiles, not as a spectator, with netcode 3 or later. The number comes from one counter
   per page that starts at 0 (`:31575`, `:31583`).
3. **Rapid guns are not sent.** A gun that fires faster than a set rate is left out
   (`$0lMMpH`, `frame2.js:31628-31645`, used at `:35568`). Other clients fire such a gun
   themselves from the shooter's state (inferred from the remote-player branch at
   `:35583-35650`).
4. **It sends one message per shot** (`frame2.js:35674-35675`), or one per grenade
   (`:32141-32142` through `:31608`).
5. **The match server relays it** to every other client, with the shooter's slot in front
   (`flash.js:4056-4067`). It only resets the shooter's inactivity timer (`:4048-4053`).
6. **Each receiver creates the projectiles** (`flash.js:4177-4239`). For a grenade it throws
   one from the shooter's body (`:4208-4214`). For a gun it builds each projectile from its
   own copy of the gun at the sent point and angle (`:4216-4222`), but only if the gun exists
   and the shooter holds it (`:4188-4193`). It gives each projectile the sent number
   (`:4211`, `:4219`), then plays the gun's fire animation and sound unless the gun is rapid
   (`:4225-4237`).

#### Field by field

Part numbers as the receiver reads them, after the shooter's slot is removed. After part 1
come groups of 4 values, one group per projectile, until the message ends. The receiver logs
each as `projectiles` with the gun or grenade type and the offset from the shooter
(`flash.js:4213`, `:4221`).

| Part | Read as | Meaning | Sent as |
|---|---|---|---|
| 1 | number | gun, or grenade type | the gun's index in the gun list; −1, −2, −3 for a grenade |
| group 1 | number | projectile number | the shooter's counter |
| group 2, 3 | number | x, y | the start point, rounded |
| group 4 | number / 1000 | angle in radians | angle × 1000, rounded |

No part names the owner: it is the shooter, whose slot the server puts in front.

**Part 1, the gun or grenade.** For a gun shot it is the shooter's current gun
(`frame2.js:35573`). Receivers create projectiles only if that gun exists and is held by the
shooter in their copy (`flash.js:4188-4193`). Otherwise they skip the projectiles and play no
fire animation. For a grenade it is minus the grenade type (`frame2.js:32141`):
- −1: type 1, counted by the map's `he_nades_count` (`frame2.js:12034-12038`, `:41421`)
- −2: type 2, `port_nades_count` (`:12039-12044`, `:41431`)
- −3: type 3, `sh_nades_count` (`:12045-12050`, `:41441`); it gets a timer of 60 + 30 × 60
  instead of 60 and 10 HP (`:32103-32111`; inferred: 30 seconds longer at 60 frames a second)

Values below −3 create nothing (`flash.js:4208`).

**The projectile number.** Unique per shooter for the life of the page (`frame2.js:31575`,
`:31583`). Receivers store it on the projectile (`flash.js:4211`, `:4219`) so that a later
`PROJECTILE_REMOVE` from the same shooter can find it. It must not repeat for one shooter.

**x and y.** Where the projectile starts. For a gun the receiver builds the projectile there
(`flash.js:4218`). Both ends round the point the same way (`frame2.js:31697-31698`), so the
projectiles start from the same numbers. For a grenade the receiver ignores them and throws
it from the shooter's body (`frame2.js:32078-32079`); they only go into the log
(`flash.js:4213`).

**The angle.** Radians × 1000 (`frame2.js:31597`), divided on receipt (`flash.js:4206`).
Values from about −π to 2π appear. For a grenade it is 0 (`frame2.js:32142`).

**No groups at all.** A gun with no projectiles, like the defibrillator (`guns.js:309`), sends
part 1 alone. Receivers then only play its fire animation and sound (`flash.js:4225-4237`).

#### Situations

- **Lag.** The shot starts on the receiver one trip through the server later, from the sent
  point, so it lines up with the shooter's gun as the shooter saw it. Hits are not decided
  here: the shooter's client sends `HIT_PLAYER` for each one.
- **A gun the receiver does not see.** If a receiver still thinks the gun is on the floor or
  in another hand, it creates nothing (`flash.js:4188-4193`), and a later
  `PROJECTILE_REMOVE` finds nothing.
- **Grenades.** After the create, a grenade moves inside the thrower's state message
  (`flash.js:558-591`). `GRENADE_THROW` is not used.
- **Activity.** A shot resets the shooter's inactivity timer (`flash.js:4048-4053`), so a
  player who shoots without moving is not kicked as idle.
- **For the local server's maintainer.** The server passes this through untouched. The
  netlog shows every shot, and gun indexes match the gun list of the map.

### 8 · PROJECTILE_REMOVE — client → match server → every other client

One of the sender's projectiles ended. The shooter's client sends where it ended. Every other
client moves its copy of that projectile there and hides it, so it does not fly on.

| | |
|---|---|
| Built | `frame2.js:31611-31626` (`$АТ0Тe`), called when the shooter's client frees the projectile (`$HOНОO`, `:6725-6729`) |
| Checked by the match server | nothing |
| Relayed | `flash.js:4056-4067`, to every other client |
| Applied by every receiver | `flash.js:4241-4259`; the projectile is hidden on its next step (`frame2.js:30591-30598`) |
| Only with | match netcode 3 or later, on both ends (`frame2.js:31613`, `flash.js:4243-4244`) |

#### The console command

```
js pb.event("PROJECTILE_REMOVE", pb.num(1), pb.num(0), pb.num(0))
```

Projectile 1 ends at (0, 0). Receivers act only if they hold a projectile 1 from you.

#### What real ones look like

From `netlog show`, numbers decoded. A received one has the shooter's slot in front.

| Situation | Direction | As recorded |
|---|---|---|
| The 13 projectiles of `PROJECTILE_CREATE(88, 0, …)` all end 3 s later, in the same millisecond as a `DAMAGE_PLAYERS_VIA_EXPLOSION` with weapon 88 | sent | `PROJECTILE_REMOVE(0, 6142, -1559)` … `PROJECTILE_REMOVE(12, 5245, -1892)` |
| A projectile from slot 0 | received | `PROJECTILE_REMOVE(0, 331, 9110, -1910)` |
| A projectile from slot 1 | received | `PROJECTILE_REMOVE(1, 4, 5525, -1018)` |

#### How it works

1. **The shooter's client frees a projectile.** It frees one when the projectile has ended
   and is hidden (`frame2.js:6762-6764`, `:31008-31013`), or when its slot is reused for a new
   projectile (`:31701`, `:32056`). Freeing always calls `$АТ0Тe` first (`:6729`).
2. **It sends only its own numbered projectiles** (`frame2.js:31613-31614`): not as a
   spectator, with netcode 3 or later, and only projectiles that were sent with a number. It
   rounds the position first (`:31616-31617`).
3. **The match server relays it** to every other client, with the shooter's slot in front
   (`flash.js:4056-4067`).
4. **Each receiver finds the projectile** with the same owner and number (`flash.js:4250-4258`)
   and stores the end point on it (`:4255`).
5. **On its next step the projectile jumps there and is hidden** (`frame2.js:30593-30597`),
   unless it is of class 2 (`$OeесA`, `:4781`, checked at `:30591`).

#### Field by field

Part numbers as the receiver reads them, after the shooter's slot is removed.

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the projectile number from `PROJECTILE_CREATE` |
| 2, 3 | number | x, y where it ended, rounded |

**Part 1, the projectile number.** The number the shooter gave it in `PROJECTILE_CREATE`
(`frame2.js:31621`), not an atom id. The receiver matches it together
with the shooter's slot (`flash.js:4253`), so two shooters with the same numbers do not clash.
A number with no match is ignored.

**Parts 2 and 3, x and y.** Where the projectile was on the shooter's screen when it ended
(`frame2.js:31616-31624`). The receiver moves its copy there before hiding it
(`:30595-30597`), so the last frame shows the projectile where the shooter saw it end.

#### Situations

- **Lag.** A receiver's copy may have flown a little farther or less far than the shooter's.
  The end point puts it back on the shooter's spot, so impacts and explosions line up.
- **A projectile that was never created.** If the receiver skipped the create (it did not see
  the gun in the shooter's hand), the remove finds nothing and does nothing.
- **Class 2 projectiles** keep their own position and are not hidden by this message
  (`frame2.js:30591`).
- **For the local server's maintainer.** The server passes this through untouched. Pair each
  remove with its create by shooter slot and number to see how long a projectile flew.

### 9 · BARREL — client → match server → every other client

One barrel lost health. The client that saw the damage sends the barrel's new health and
where the barrel is. Every other client moves its copy of the barrel there and lowers its
health. At 0 the barrel explodes on each client.

| | |
|---|---|
| Built | `frame2.js:17560-17567`, inside the barrel update function at `:17546` |
| Checked by the match server | not checked: no branch for it, it goes straight to the relay (`flash.js:4046-4068`) |
| Relayed | `flash.js:4056-4066`, to everyone but the sender |
| Applied by every receiver | `flash.js:4807-4858` |
| Only with | a multiplayer match (`frame2.js:17550`); any netcode |

#### The console command

None: the game only sends the barrel's own position, so a hand-made line moves a barrel on
every other client, which the game never does. To see real ones, shoot a barrel with netlog on. The wire form is below.

#### What real ones look like

Recorded with `netlog show`, numbers decoded. A sent message has 5 parts. A received one has
6: the match server puts the sender's slot in front.

| Situation | As recorded |
|---|---|
| Shot, destroyed, sent | `BARREL(3, 0, "1", 920, -260)` |
| Shot, survives with 3 HP, sent | `BARREL(6, 3, "1", 1810, -20)` |
| Shot by slot 0, survives with 6 HP, received | `BARREL(0, 5, 6, "1", 1355, -10)` |
| Shot by slot 0, destroyed, received | `BARREL(0, 3, 0, "1", 874, -248)` |
| Hit a wall, survives with 9 HP, received | `BARREL(0, 3, 9, "", 1050, -217)` |
| Hit a wall, destroyed, received | `BARREL(0, 3, 0, "", 1044, -26)` |

Part 3 is `"1"` when a player or a bot caused the damage, and `""` for a hard landing.

#### How it works

1. **A client damages its own copy of the barrel.** There are three ways:
   - A projectile hits it: HP − power × 20 (`frame2.js:30093`). Only the shooter's client
     tests this, or every client for a bot's shot (`:30020`). The shot's owner becomes the
     barrel's owner (`:30094`).
   - An explosion reaches it: HP − a quarter of the explosion's damage (`:17318`). Only
     the client that owns the explosion runs this, or every client for an unowned or bot
     explosion (`:17316`). The explosion's owner becomes the barrel's owner (`:17319`).
   - It hits the ground or a wall. When the impact changes its speed by more than 10, it
     loses its vertical speed in HP (`:24575-24580`). Every client that simulates the barrel
     runs this.
2. **The client calls the barrel update function** (`frame2.js:17546`) with sync on. It sends
   `BARREL` if the match is multiplayer (`:17550`) and either the damage was not caused by a
   player, or the barrel's owner is this client, nobody (`-1`) or a bot (`:17552-17553`).
3. **The match server relays it** without reading it: it adds the sender's slot as the new
   part 1 and sends it to everyone but the sender (`flash.js:4056-4066`).
4. **Each receiver applies it** (`flash.js:4807-4858`). It removes the sender's slot
   (`:4084`). It skips a barrel that does not exist or is already at 0 HP (`:4817-4818`).
   It moves the barrel's four nodes by the gap between the received point and its own
   barrel position (`:4828-4849`). It keeps the lower HP (`:4852`), takes the sender as owner
   if part 3 is set (`:4854-4855`), and runs the update function without sync (`:4857`). That
   call does not send again. At 0 HP it breaks the barrel and explodes it (`frame2.js:17571`,
   `:17641`), owned by the barrel's owner.

Nothing checks that the sender saw the damage it reports. The server does not read the
message, and receivers only refuse to raise HP or revive a barrel.

#### Field by field

Part numbers are as the receiver reads them, after the sender's slot is removed. The names in
quotes are the game's own: the receiver writes them into its message log (`flash.js:4821-4825`).

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | `barrel_id` | the barrel's index in the level's barrel list |
| 2 | number | `hea` | the barrel's HP after the damage, rounded up, at least 0 |
| 3 | string | `by_player` | `"1"` if a player or bot caused it, `""` otherwise |
| 4, 5 | number | `xx`, `yy` | the barrel's position when it was sent |

**Part 1, `barrel_id`.** The barrel's index in the level's barrel list (`frame2.js:17562`).
Every client builds that list from the same map, so the index names the same barrel. An index
with no barrel is ignored (`flash.js:4817`).

**Part 2, `hea`.** `max(0, ceil(HP))` (`frame2.js:17563`). The receiver keeps the lower of its
own HP and this value (`flash.js:4851-4852`). A higher value changes nothing, so a late or
repeated message cannot heal a barrel. A barrel already at 0 HP ignores the message
(`:4818`), so a destroyed barrel cannot come back. At 0 or less the receiver explodes the
barrel.

**Part 3, `by_player`.** Only its length is read (`flash.js:4811`). Non-empty sets the barrel's
owner to the sender's slot (`:4854-4855`). The owner is who the explosion is credited to, and
who its damage counts as coming from (`frame2.js:17641`). Empty leaves the owner as it was. A
message without a part 3 at all makes the handler throw, because it reads `.length` of
`undefined`.

**Parts 4 and 5, `xx` and `yy`.** The barrel's own position on the sender's screen
(`frame2.js:17565-17566`), not the point of impact. The receiver shifts all four nodes, and
their previous positions, by the same amount (`flash.js:4831-4849`). The barrel jumps to the
sender's position and keeps its speed. This lines up a barrel that rolled differently on each
screen before it explodes.

#### Situations

- **A hard landing is sent by everyone.** The wall/ground damage runs on every client that
  simulates the barrel, and it is sent without the owner check (`frame2.js:24580` passes
  "not by a player"). One landing can arrive once from each player. Receivers keep the lowest
  HP, so the duplicates do not add up, but each one moves the barrel to that sender's
  position.
- **Two shooters at once.** Each shooter's client subtracts its own damage from its own copy
  and sends the result. Receivers keep the lowest HP they get. Damage from two shots seen by
  different clients is not added together, so a barrel can take longer to break than the
  sum of hits suggests.
- **Kill credit.** Each client explodes the barrel with the barrel's owner as the explosion's
  owner (`frame2.js:17641`). So the last `"1"` message decides who the blast counts for. The
  game names death source `-12` `barrel` (`frame2.js:8348`); a `PLAYER_DIES` with that source
  reads "hugs an explosive barrel" or similar in chat (`flash.js:2372-2382`).
- **Who may send it.** A spectator's client does not send it (`flash.js:1784`), and the server
  refuses one with "not compatible with spectator mode" (`:1930-1934`). A receiver still
  loading the level queues it until the level runs (`:4077-4081`).
- **For the local server's maintainer.** `src/server/` relays it as is. To find who destroyed a
  barrel, look for the first received `BARREL` with part 2 at 0 and read its sender slot.

### 10 · THROW_GUN — client → match server → every other client

A player dropped the gun they hold. The thrower's client sends where the gun's two physics
nodes are and how fast they move. Every other client puts its copy of the gun there, so the
gun flies the same way on every screen.

| | |
|---|---|
| Built | `frame2.js:35461-35474`, in the per-character update |
| Checked by the match server | not checked: it goes straight to the relay (`flash.js:4046-4068`) |
| Relayed | `flash.js:4056-4066`, to everyone but the sender |
| Applied by every receiver | `flash.js:4142-4174` |
| Followed by | a `MY_PLAYER_PROPERTIES_CHANGED` from the thrower that empties its weapon slot |

#### The console command

None: a hand-made line puts a gun anywhere on every other client, whoever holds it. The game
only sends this for the gun the sender holds, at the gun's own position. Drop a gun in game
(the V or Backspace key, `frame2.js:27303`) with netlog on to see one.

#### What real ones look like

Recorded with `netlog show`, numbers decoded. A sent message has 9 parts. A received one has
10: the match server puts the sender's slot in front.

| Situation | As recorded |
|---|---|
| Thrown to the right and up, sent | `THROW_GUN(9, 3820, -1806, 27, 18, 3865, -1764, 5, 13)` |
| Thrown to the left, sent | `THROW_GUN(88, 6146, -1808, -9, -37, 6142, -1822, -1, 12)` |
| Slot 2 throws gun 43, received | `THROW_GUN(2, 43, 8266, -1902, 74, 20, 8279, -1896, 48, 26)` |
| Slot 6 throws gun 24, received | `THROW_GUN(6, 24, 7864, -834, 25, 25, 7920, -814, 10, 7)` |
| Slot 0 throws a gun hard to the left, received | `THROW_GUN(0, 42, 6931, -1884, -118, -4, 6916, -1884, -88, 17)` |

At the same moment as a sent one, the recording shows the thrower's
`MY_PLAYER_PROPERTIES_CHANGED(5, "-1", 12, "-1")`: property 5 (`slot3`, the weapon slot that
held the gun) and property 12 (`curwea`) both set to -1 (`flash.js:216-221`).

#### How it works

1. **The thrower's client drops the gun** (`frame2.js:35434-35488`). It needs a character that
   is alive, not in a vehicle (`:35437`), holding a gun (`:35438`), and either the local
   player pressing the drop key (`:35436`, key flag set at `:27303`) or a character flagged at
   `:16380`. That flag is set when one of the character's limb health values reaches 0; the
   meaning "lost an arm" is inferred from that. The client sets the gun's holder to nobody
   (`:35444`) and, unless that flag is set, adds a throw speed along the aim angle: 7 to the
   first node, 1 to the second (`:35451-35454`).
2. **Only the local player's own drop is sent** (`frame2.js:35459-35461`). The velocities are
   multiplied by 5 (`$ММ.$MеМMА`, `flash.js:178`). The client then empties its current weapon
   (`frame2.js:35486`). Its next property check (`flash.js:597-625`) sees `curwea` and the
   weapon slot change and sends the `MY_PLAYER_PROPERTIES_CHANGED` that tells the others the
   gun is no longer held.
3. **The match server relays it** without reading it (`flash.js:4056-4066`).
4. **Each receiver applies it** (`flash.js:4142-4174`). It removes the sender's slot (`:4084`),
   finds the gun by its index (`:4145`), and overwrites both nodes' position and velocity
   (`:4148-4155`). An unknown index is ignored (`:4146`). The receiver does not change who holds
   the gun; that comes from the properties message (`frame2.js:7497-7503`).

#### Field by field

Part numbers are as the receiver reads them. The receiver logs the result as `gun_throw` with
`x1`, `y1`, `sx1`, `sy1`, `x2`, `y2`, `sx2`, `sy2` (`flash.js:4162-4172`).

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | gun index | the gun's index in the level's gun list |
| 2, 3 | number | `x1`, `y1` | position of the gun's first node |
| 4, 5 | number / 5 | `sx1`, `sy1` | velocity of the first node × 5 |
| 6, 7 | number | `x2`, `y2` | position of the second node |
| 8, 9 | number / 5 | `sx2`, `sy2` | velocity of the second node × 5 |

**Part 1, the gun index.** The gun's place in the gun list, the same on every client because a
gun is stored under its own index (`frame2.js:9105`). It is not a player slot or a weapon slot.
The receiver ignores an index with no gun (`flash.js:4146`). It does not check that the sender
held that gun.

**Parts 2, 3, 6 and 7, the node positions.** World coordinates, rounded to whole pixels by the
encoder (`flash.js:5261`). The receiver writes them over its own (`:4148-4153`). The gun
appears there at once.

**Parts 4, 5, 8 and 9, the node velocities.** Sent × 5, divided by 5 on receipt
(`flash.js:4150-4155`, `$ММ.$MеМMА = 5`, `:178`). That keeps one fifth of a pixel per frame of
precision. The first node gets most of the throw (7 against 1, `frame2.js:35451-35454`). A
zero velocity drops it in place.

#### Situations

- **Lag.** The throw arrives about half a round trip late. The receiver puts the gun where it
  was on the thrower's screen at that time, with the same speed. On a slow link the gun
  appears a short way into its flight.
- **Order with the properties message.** `THROW_GUN` and the following
  `MY_PLAYER_PROPERTIES_CHANGED` are both reliable, numbered in that order, and the recorded
  pairs left together. A receiver first moves the gun, then learns it is no longer held.
- **A dropped gun the game does not send.** A gun dropped by a bot, or by another player on
  your screen, is not sent by you (`frame2.js:35459`). Bots' drops run on every client.
- **Who may send it.** A spectator's client does not send it (`flash.js:1784`), and the server
  refuses one (`:1930-1934`). A receiver still loading the level queues it (`:4077-4081`).
- **For the local server's maintainer.** The server does not track guns. A `THROW_GUN` for a gun
  its sender does not hold is relayed like any other.

### 11 · HIT_GRENADE — client → match server → every other client

A shot hit someone else's grenade and pushed it. The shooter's client sends which grenade,
which shot, and how much speed the push added. Every other client adds the same speed to its
copy of the grenade and draws the spark. It does no damage.

| | |
|---|---|
| Built | `frame2.js:28600-28608`, in the projectile-against-grenade test at `:28559-28614` |
| Checked by the match server | not checked: it goes straight to the relay (`flash.js:4046-4068`) |
| Relayed | `flash.js:4056-4066`, to everyone but the sender |
| Applied by every receiver | `flash.js:4261-4312` |
| Only with | match netcode 3 or later, on both ends (`frame2.js:28597`, `flash.js:4263-4264`) |

#### The console command

```
js pb.event("HIT_GRENADE", pb.num(1), pb.num(0), pb.num(0), pb.num(0))
```

Grenade id 1, shot id 0, no push. On every other client it finds the first visible
projectile with network id 1 and adds a speed of zero to it, then draws a spark at projectile
0 if that one is visible. It moves nothing.

#### What real ones look like

Recorded with `netlog show`, numbers decoded. All recorded ones are received: 5 parts, the
shooter's slot in front. The recordings hold no sent one.

| Situation | As received |
|---|---|
| Slot 4 hits grenade 3012 with a fast weapon, one of six hits in a row | `HIT_GRENADE(4, 3012, 2465, -44, 122)` |
| The next shot of the same burst | `HIT_GRENADE(4, 3012, 2466, -47, 121)` |
| Slot 4 pushes grenade 738 to the right | `HIT_GRENADE(4, 738, 116, 130, -6)` |
| Slot 3 pushes grenade 600 to the right | `HIT_GRENADE(3, 600, 2791, 120, -4)` |
| Slot 3, a weaker push | `HIT_GRENADE(3, 1434, 145, 55, 4)` |

The shot ids climb by one: each is the next number of the shooter's own projectile counter.

#### How it works

1. **The shooter's client tests its shots against grenades** (`frame2.js:28559-28588`). It tests
   a projectile that is not itself of class 4 or 6 against every visible projectile of class 4
   or 6. Both classes fall under gravity (`:28704-28708`) and ride on a physics node
   (`:28773-28780`); that they are the grenades is inferred from the message name. It runs
   the test for its own shots, for bots' shots, at netcode below 3, or
   outside multiplayer (`:28560`). A shot hits a grenade once (`:28567`, `:28589`).
2. **It pushes its own copy of the grenade**: speed += shot velocity × shot power / node size
   × knockback multiplier (`frame2.js:28591-28595`).
3. **It sends `HIT_GRENADE`** if the match is multiplayer at netcode 3 or later, it is not
   spectating (`:28597`), the grenade has a network id and is someone else's (`:28598`), and the
   shot has a network id and is its own (`:28599`). Pushing your own grenade is not sent.
4. **The match server relays it** without reading it (`flash.js:4056-4066`).
5. **Each receiver applies it** (`flash.js:4261-4312`). It drops it below netcode 3
   (`:4263-4264`). It finds the first projectile with the shot's id and keeps it only if
   visible (`:4276-4287`). It finds the first projectile with the grenade's id (`:4288-4291`);
   if that one is visible, it adds the push to the grenade's node (`:4297-4298`) and draws the
   spark at the shot, if it found one (`:4302-4306`).

#### Field by field

Part numbers are as the receiver reads them. The receiver logs parts 3 and 4 as `tox` and
`toy` (`flash.js:4272-4273`).

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | grenade id | the grenade's network projectile id |
| 2 | number | shot id | the shot's network projectile id |
| 3, 4 | number / 5 | `tox`, `toy` | speed added to the grenade × 5 |

**Part 1, the grenade id.** The network id its owner gave it when it was created (`frame2.js:31583`,
a counter that only counts that client's own projectiles). Other clients store the id that came
with `PROJECTILE_CREATE` (`flash.js:4211`, `:4219`). The receiver matches on the id alone
(`:4291`). It does not check the owner, unlike `PROJECTILE_REMOVE` (`:4253`) and `HIT_SHIELD`
(`:4573`). Two players' projectiles can share an id. Then the first one in the list is
pushed, which may be the wrong grenade. An id that matches nothing does nothing.

**Part 2, the shot id.** The shooter's own network id for the shot (`frame2.js:28604`). It is
only used to place the spark (`flash.js:4302-4306`). The same owner-blind lookup applies
(`:4280`). If the shot is gone or invisible on the receiver, there is no spark, and the push
still applies.

**Parts 3 and 4, `tox` and `toy`.** The speed added to the grenade's node, × 5 on the wire and
/ 5 on receipt (`flash.js:4268-4269`, `$ММ.$MеМMА = 5`, `:178`). The shooter computes it as
shot velocity × shot power / grenade node size × the shot's knockback multiplier
(`frame2.js:28591-28592`). It is added, not set (`flash.js:4297-4298`). So a grenade moving on
its own keeps that motion plus the push. Zero pushes nothing. Nothing bounds it.

#### Situations

- **Lag.** The push lands half a round trip late on the grenade owner's screen. The grenade
  has moved on by then. The push is added to whatever speed it has, so the grenade's path
  differs a little between screens. A later `PROJECTILE_REMOVE` from the owner settles where it
  ended.
- **Shooting your own grenade.** That is not sent (`frame2.js:28598`). Every other client runs
  the test only for its own shots and bots' (`:28560`), so the push happens on your screen only.
- **Netcode below 3.** No projectile has a network id (`frame2.js:31580`), nothing is sent, and
  every client runs the test for every shot itself.
- **Who may send it.** A spectator's client does not send it (`frame2.js:28597`,
  `flash.js:1784`), and the server refuses one (`:1930-1934`).
- **For the local server's maintainer.** The server does not track projectiles. Any
  `HIT_GRENADE` is relayed. To follow one grenade, pair the received `PROJECTILE_CREATE` that
  carries its id with the `HIT_GRENADE` and `PROJECTILE_REMOVE` messages that follow.

### 12 · PLAYER_DIES — match server → every client

The match server's announcement that a player died: who, who gets the kill, which body part
and which cause, and both players' new counters. Every client marks the death, prints the
line in chat, and copies the counters. A client does not originate it: the server ignores a
`PLAYER_DIES` that a client sends (`flash.js:2084`), and it is not relayed.

| | |
|---|---|
| Built | `flash.js:7058-7074`, in the match's death function at `:6988` |
| Started by | a hit or explosion that takes the server's HP copy to 0 (`:6981-6982`); the victim's own state reporting HP at 0 or below (`:1080-1085`); a living player leaving shortly after being hit (`:6856-6859`) |
| Sent to | every connection in the match, the victim included (`:7055-7058`) |
| Applied by every client | `flash.js:2082-2494` |
| Not sent | in a COOP match outside a running round (`:6996-7000`) |

#### The console command

None. A client does not send this message. The server drops one from a client at
`flash.js:2084`. The wire form, for reference:

```
PLAYER_DIES(<victim slot>, <killer slot or -1>, <limb>, <source>, <random>, <killer's kills>, <victim's deaths>)
```

#### What real ones look like

Recorded with `netlog show`, numbers decoded. All are received. The server sends it directly,
so there is no sender slot in front: 7 parts. Netlog prints some one-character counters as
quoted strings (for example `"'"`); they are decoded here.

| Situation | As received |
|---|---|
| Limb-0 kill by slot 0 with gun 10 | `PLAYER_DIES(5, 0, 0, 10, 1487327431471442, 1, 1)` |
| Sword kill by slot 1 | `PLAYER_DIES(4, 1, 3, -11, 6599260246543775, 1, 7)` |
| Grenade kill by slot 3 | `PLAYER_DIES(2, 3, 3, -1, 4905506280921099, 9, 16)` |
| Fell out of the map within 7 s of a hit by slot 0 | `PLAYER_DIES(3, 0, 0, -17, 580718249497268, 1, 2)` |
| Hit a wall, nobody to blame | `PLAYER_DIES(1, -1, 0, -15, 2296816484128199, 0, 1)` |
| Acid, nobody to blame | `PLAYER_DIES(4, -1, 0, -14, 5046363067984657, 0, 26)` |
| Killed by their own gun 79 | `PLAYER_DIES(0, 0, 3, 79, 5577452289990011, 0, 5)` |
| Cause unknown to the server | `PLAYER_DIES(0, -1, 0, 9007199254740991, 4191431308281130, 0, 40)` |

A kill by a hit arrives just before the hit that caused it:

```
#13222 PLAYER_DIES(5, 0, 0, 10, 1487327431471442, 1, 1)
#13223 HIT_PLAYER(0, 5, 0, 1200, 100, 5, 8131, -1913, -299, 20, 0, 10, 7, 99000, 1, "1")
```

#### How it works

1. **The server decides a player died.** Three paths call the death function
   (`flash.js:6988`):
   - The hit check shared by `HIT_PLAYER`, `DAMAGE_PLAYERS_VIA_EXPLOSION` and `HEAL_PLAYER`
     (`:6923`) takes the server's HP copy to 0 or below (`:6979-6982`).
   - The victim's own state packet takes it there: the server copies the reported HP
     (`:1059`) and, if the player was alive, calls the death function with "use the reported
     cause" (`:1078-1085`).
   - A living player leaves a match that still has players (`:6854-6859`). This path sends
     nothing unless someone hit the leaver in the last 7 seconds (`:7046-7047`).
2. **It finds the killer** (`flash.js:7012-7043`). The last player who hit the victim gets the
   kill if that hit was less than 7 seconds ago and that player still holds the same slot
   (`:7012-7013`). Their `kills` goes up for an enemy (`:7039`), down for a teammate (`:7030`),
   and stays the same when the killer is the victim (`:7024-7027`). Limb and cause come from
   that last hit (`:7016-7018`). Without such a hit there is no killer (`-1`), the limb is 0,
   and the cause is the victim's reported one on the state path (`:7049-7050`) or `-321`
   otherwise (`:7005`). The victim's `deaths` goes up (`:7053`).
3. **It sends `PLAYER_DIES` to every connection in the match** (`flash.js:7055-7074`).
4. **It settles the score** (`flash.js:7077-7102`). In TDM the team point and the ranked update
   wait until the victim respawns or leaves (`:7083-7099`, done by `:7105-7137`); in other modes
   they happen now (`:7102`).
5. **Each client applies it** (`flash.js:2082-2494`):
   - It copies the killer's `kills` and the victim's `deaths` from parts 6 and 7
     (`:2104-2108`).
   - For a victim that is not the local player (or always, when spectating), and that this
     client has not already marked dead: HP to 0 (`:2118-2119`), a death voice
     (`:2121-2122`), and the victim's `ondeath` map trigger (`:2124-2129`).
   - It builds the chat line from the cause, the slots and part 5 (`:2237-2489`), and shows
     it if kill messages are on (`:2491-2493`).

#### Field by field

The names in quotes are the game's own: each client writes them into its message log
(`flash.js:2097-2102`).

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | victim | the victim's slot |
| 2 | number | killer | the credited player's slot, or `-1` |
| 3 | number | `damaged_limb_type` | the limb of the last hit, 0 without a killer |
| 4 | number | `damage_source` | the cause: a gun index or a negative code |
| 5 | number | — | a random number that picks the chat wording |
| 6 | number | killer's `kills` | after this kill; 0 without a killer |
| 7 | number | victim's `deaths` | after this death |

**Part 1, the victim.** The victim's slot (`flash.js:7060`). A client with no player in that
slot prints "Error: Player at slot N dies, but there is no player at that slot. Report?"
(`:2111-2112`) and does nothing else.

**Part 2, the killer.** The slot of the player credited with the kill, or `-1`
(`flash.js:7062`). It equals part 1 when the victim killed themselves. With `-1` the chat line
names no killer and no `kills` counter is set (`:2092`, `:2104`).

**Part 3, `damaged_limb_type`.** The limb of the credited hit: part 2 of that `HIT_PLAYER`, or
3 for an explosion (`flash.js:3975`). It is 0 when there is no killer (`:7004`), so a 0 there
does not mean the head. With a killer and a gun cause, limb 0 adds " [ Headshot ]" to the chat
line (`:2438-2439`).

**Part 4, `damage_source`.** The cause. A gun is its index in the gun list, and the chat line
says "<killer> eliminated <victim> via <gun name>" (`flash.js:2436`). The negative codes are
constants at `frame2.js:4788-4795`, and the game names them at `:8346-8352`:

| Code | Game's name | Chat line (`flash.js`) |
|---|---|---|
| -1 | `item_grenade` | via the grenade's name (`:2436`) |
| -11 | `swords` | "sliced" or "cut" (`:2420-2427`) |
| -12 | `barrel` | "hugs an explosive barrel" and 2 more (`:2372-2382`) |
| -13 | `level logic` | "has died due to unexpected circumstances" (`:2384-2387`) |
| -14 | `acid` | "dissolved" and 4 more (`:2389-2403`) |
| -15 | `wall` | 30 wall lines (`:2274-2370`) |
| -16 | `nothing` | "died", plus the killer's part in it (`:2249-2266`, `:2461-2476`) |
| -17 | — | "flew out of bounds" (`:2269-2272`) |

On the state path the server takes the cause from the victim's state, part 16
(`flash.js:184`, `:1082`), which the victim writes from its last damage cause (`:540`). The
recorded 9007199254740991 is `Number.MAX_SAFE_INTEGER`. Inferred: the victim's cause was
`undefined`, the encoder writes that as the text `undefined` (`:5261-5280`), the server decodes
those letters as a huge number (`:5282-5305`), and the encoder clamps it on the way out
(`:5251-5252`). The `-321` default (`:7005`) has no chat line of its own.

**Part 5, the random number.** `Math.random() × MAX_SAFE_INTEGER` (`flash.js:7068`). Clients
take it modulo 4, 30, 3, 5, 2 or 6 to pick one wording (`:2253`, `:2276`, `:2374`, `:2391`,
`:2422`, `:2463`). Every client gets the same number, so every screen prints the same line.
Nothing else reads it.

**Part 6, the killer's `kills`.** The server's count after this kill (`flash.js:7070`). Each
client sets the killer's counter to it (`:2105`). Without a killer the server encodes an empty
string, which the encoder rounds to 0 (`:5261`); clients ignore it.

**Part 7, the victim's `deaths`.** The server's count after this death (`flash.js:7072`). Each
client sets it (`:2108`). Both counters are set, not added, so a client that missed an earlier
death is corrected by the next one.

#### Situations

- **Order with the hit.** The server sends `PLAYER_DIES` from inside the hit check, before it
  relays the hit (`flash.js:6982`, `:4056`). Receivers learn of the death first, then get the
  hit, as in the recorded pair above.
- **Falling after a hit.** A player knocked into acid, a wall or out of the map within
  7 seconds of a hit dies on the state path, and the server still credits the hitter
  (`flash.js:7012-7018`). The cause is the victim's reported one: `:1083` stores it over the
  last hit's weapon before `:7018` reads it. Hence the recorded `-17` with killer slot 0.
- **Leaving to dodge a kill.** A player who leaves within 7 seconds of a hit, while alive, is
  counted as killed by the hitter (`flash.js:6856-6859`).
- **COOP between rounds.** No death is sent and no counter changes (`flash.js:6996-7000`).
- **The self-kill wording.** The "suicided" lines are under a condition that requires the
  killer to differ from the victim (`flash.js:2249`), so they never show. A self-kill reads
  "<name> killed itself" (`:2409-2411`).
- **For a map author.** A player's `ondeath` trigger runs on the victim's own client from its
  death code (`frame2.js:35397-35405`) and on the other clients from this message
  (`flash.js:2124-2129`). If another client has already marked that player dead itself
  (`frame2.js:35007-35009`, flag set at `:35353`), it skips the trigger (`flash.js:2116`), and
  its own death code does not run triggers for other human players (`frame2.js:35398`). So a
  trigger that must run on every screen may miss some (inferred from the two code paths).
- **For the local server's maintainer.** `src/server/` runs this death function. Every kill,
  with its credit rule, passes through `flash.js:6988`. A cause of 9007199254740991 points at a
  client that died without a recorded cause.

### 13 · HIT_SHIELD — client → match server → every other client

A shot hit an energy shield. A shield is backed by a projectile with its own HP. The shooter's
client works out the damage and sends which shield, its HP before the hit, the damage, and the
shield owner's slot. Every other client lowers its copy of the shield and breaks it at 0.

| | |
|---|---|
| Built | `frame2.js:29074-29086`, in the shot-against-shield test at `:28928-29088` |
| Checked by the match server | not checked: it goes straight to the relay (`flash.js:4046-4068`) |
| Relayed | `flash.js:4056-4066`, to everyone but the sender |
| Applied by every receiver | `flash.js:4556-4585`, with the damage function at `frame2.js:5127-5143` |
| Only with | a shield that has a network id: netcode 3 or later (`frame2.js:31580`) |

#### The console command

```
js pb.event("HIT_SHIELD", pb.num(1), pb.num(100), pb.num(10), pb.num(0))
```

On every other client this finds slot 0's projectile with network id 1. If that projectile has
HP, its HP becomes the lower of its own and 100, minus 10. If slot 0 has no such projectile,
nothing happens.

#### What real ones look like

Recorded with `netlog show`, numbers decoded. A sent message has 4 parts. A received one has 5:
the shooter's slot in front. Netlog prints some one-character HP values as quoted strings; they
are decoded here.

| Situation | As recorded |
|---|---|
| First hit on slot 0's shield 175, sent | `HIT_SHIELD(175, 100, 7, 0)` |
| The next hit on it, sent | `HIT_SHIELD(175, 93, 7, 0)` |
| The hit that breaks slot 3's shield 73, sent | `HIT_SHIELD(73, 1, 6, 3)` |
| Slot 1 hits slot 0's shield 3012, received | `HIT_SHIELD(1, 3012, 100, 7, 0)` |
| Slot 1 hits it again, harder, received | `HIT_SHIELD(1, 3012, 93, 10, 0)` |
| Slot 4 hits slot 1's shield 58, received | `HIT_SHIELD(4, 58, 96, 10, 1)` |

Part 2 of each hit is part 2 of the one before minus its damage.

#### How it works

1. **The shooter's client finds the hit** (`frame2.js:28928-28932`): the shot's new position is
   inside the shield's radius and its last one was not. The shield points to the projectile
   that holds its HP (`:28932`).
2. **Grenades bounce off** (`frame2.js:28941-28977`) and do no damage.
3. **Other shots do damage.** The base is the shot's power (`:28981`). Two kinds of shot are
   deflected and lose half their power: one class when it strikes at a glancing angle, and
   another class always (`:28992-29006`).
4. **The damage is applied locally** when the match is not multiplayer, the shooter is this
   client, the shooter is a bot, or the shield has no network id (`frame2.js:29062-29063`).
   Damage = `round(power × 8)` (`:29065`). The HP before is taken first, rounded up (`:29067`).
5. **It sends `HIT_SHIELD`** if this client fired the shot in a multiplayer match and the
   shield has a network id (`frame2.js:29071-29073`).
6. **The match server relays it** without reading it (`flash.js:4056-4066`).
7. **Each receiver applies it** (`flash.js:4556-4585`). It finds the projectile with that owner
   and that id (`:4573`). If it has HP (`:4575`), the HP becomes the lower of its own and part 2
   (`:4577`), then the damage is subtracted (`:4579`, `frame2.js:5131`). At 0 or less the shield
   is switched off and its break effect plays (`frame2.js:5134-5151`).

#### Field by field

Part numbers are as the receiver reads them. The receiver logs part 3 as `dmg`
(`flash.js:4565`).

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | shield id | network id of the shield's projectile |
| 2 | number | HP before | the shield's HP before this hit, rounded up |
| 3 | number | `dmg` | `round(power × 8)` |
| 4 | number | owner | the slot that owns the shield |

**Part 1, the shield id.** The network id the shield's owner gave its projectile
(`frame2.js:29078`, assigned at `:31583`). Ids are per owner, so the receiver matches it
together with part 4 (`flash.js:4573`). An id with no match does nothing.

**Part 2, HP before.** `ceil(HP)` on the shooter's copy before the damage (`frame2.js:29067`,
`:29080`). The receiver first lowers its HP to this value if its own is higher
(`flash.js:4577`). A value above the receiver's HP changes nothing. This catches a receiver up
with hits it has not seen yet.

**Part 3, `dmg`.** `round(power × 8)` (`frame2.js:29065`), with power halved for a deflected
shot (`:29006`). The receiver subtracts it after the step above (`frame2.js:5131`). The handler
does not check its sign or size. A deflected shot still does damage; only grenades do none.

**Part 4, the owner.** The slot of the player whose shield it is (`frame2.js:29084`). It is not
the shooter; the shooter's slot is the one the server puts in front.

#### Situations

- **Two shooters at once.** Shooter A sends (100, 7) and shooter B sends (100, 10). A receiver
  takes min(100, 100) − 7 = 93, then min(93, 100) − 10 = 83. The two hits add up, unlike
  `BARREL`, which keeps only the lowest value.
- **Lag.** A late hit with a higher part 2 does not undo later damage, because of the `min`.
- **Bot shots.** A bot's shot is computed on every client (`frame2.js:29062`) and not sent.
- **Netcode below 3.** Shields have no network id (`frame2.js:31580`), so nothing is sent and
  each client computes every hit itself (`:29063`).
- **Who may send it.** A spectator's client does not send it (`flash.js:1784`), and the server
  refuses one (`:1930-1934`). A receiver still loading the level queues it (`:4077-4081`).
- **For the local server's maintainer.** The server keeps no shield HP and relays every
  `HIT_SHIELD`. A shield's history is the chain of part 2 and part 3 values, as in the table
  above.

### 14 · CHAT — client → lobby → every client in the sender's match

One chat line typed in a match, to everyone or to the sender's team. It always goes through
the lobby, even in a player-hosted match. The lobby also reads it for the match owner's and
staff's `-` commands.

| | |
|---|---|
| Built | `frame2.js:3951-3963` (chat box), `GameScene.js:286-294` (emoji button) |
| Routed | always to the lobby connection, never to a player host (`flash.js:1754-1763`, `:1779-1780`) |
| Checked by the lobby | `flash.js:4014-4043`; commands at `:4865-5112` |
| Relayed | `:4046-4067`, back to the sender as well when under the rate limit |
| Applied by every receiver | `:4587-4649` |
| Only with | the sender in a match: the lobby ignores chat from a player who is not (`:1806-1811`) |

#### The console command

```
js pb.event("CHAT", pb.num(1), "hello")
js pb.event("CHAT", pb.num(2), "hello team")
js pb.event("CHAT", pb.num(1), "/s8")
js pb.event("CHAT", pb.num(1), "-min_reputation 1")
```

A line to everyone; a team line (what the team-chat key sends in a team match); the emoji
button's line; and an owner command. `-min_reputation 1` works for anyone when the match is at
0 (see Commands below). `pb.event` is right here: the game's own `Event` sends `CHAT` to the
lobby connection by itself.

#### What real ones look like

Recorded with `netlog show`, numbers decoded. The text is not a number: it stays a string. A
sent line has 2 parts. A received one has 3: the lobby puts the sender's slot in front. The
sender gets its own line back too.

| Situation | As sent | As received |
|---|---|---|
| The owner changes the map | `CHAT(1, "-map next")` | `CHAT(0, 1, "-map next")` |
| An emoji from the button | `CHAT(1, "/s8")` | `CHAT(3, 1, "/s11")` |
| Team chat in a team match | — | `CHAT(3, 2, "<text>")` |
| `-min_reputation` with a recheck of slot 8 | — | `CHAT(9, 1, "-min_reputation 1 -recheck 8")` |
| A player lowers the bar | — | `CHAT(2, 1, "-min_reputation 0")` |
| A `-` line this parser does not know | — | `CHAT(6, 1, "-slots")` |

No team line was recorded as sent; by the builder it is `CHAT(2, "<text>")`. Commands stay in
the chat: every receiver prints `-map next` like any other line.

#### How it works

1. **The client builds it.** The chat box is opened by the key whose setting is 2 (team) or 3
   (all) (`T_KEY_ACTION`, `ENTER_KEY_ACTION`, `frame2.js:26360-26376`, `:27125-27126`). On
   Enter, a non-empty text is sent (`:27019-27020`, `:27097`). The builder writes the
   destination as a number: 1 when the game mode value is 1 and the player is not a spectator,
   else the box's own choice, 1 or 2 (`:3958`, constants at `:4081-4082`). The emoji button
   sends `"/s"` and the emoji number with destination 1 (`GameScene.js:286-294`).
   `TextField.QuickReplaceMyEmojis` returns its input unchanged (`scripts/flash.js:1900-1902`),
   so `/s8` travels as typed.
2. **It goes to the lobby.** `Event` sends every message to the player host if there is one,
   but `CHAT` always to the lobby (`flash.js:1775-1786`; the test at `:1754-1763`).
3. **The lobby gates it.** It drops a message from a connection that has not logged in
   (`:1914-1926`). Spectators may chat (`:1737`). A player who is not in a match is ignored
   (`$НeеoрН`, `:1806-1811`). In a player-hosted match every other message is ignored, but
   `CHAT` is not (`:1814-1821`).
4. **The lobby checks it** (`:4014-4043`). It keeps the times of the last second's lines. If
   there are fewer than 5 (`:4016-4021`), it cuts the text to 240 characters (`:4023-4024`),
   runs the command parser (`:4033`), logs the line through the account module (`:4036`),
   sets the team-only flag for destination 2 (`:4038-4039`), and marks the line to be echoed
   to the sender (`:4041`).
5. **The lobby relays it.** Any chat line resets the sender's inactivity countdown
   (`:4048-4053`). The lobby puts the sender's slot in front (`:4056`) and sends it to every
   slot of the match (`:4058-4066`): to the sender only when echoed, to teammates only when
   team-only (`:4060-4061`).
6. **Each receiver shows it.** It drops a `CHAT` that came from a player host instead of the
   lobby (`:1843-1848`). Outside the game screen it queues the message (`:4077-4080`). It
   takes the slot back off (`:4084`), escapes the text (`:4596`), and prints and plays it
   (`:4601-4648`).

#### Field by field

Part numbers as the lobby reads them. The receivers' parts are one higher, after the slot.

| Part | Read as | Meaning | Sent as |
|---|---|---|---|
| 1 | number | destination | 1 everyone, 2 team |
| 2 | string | the text | as typed, emojis as `/s<n>` |
| (in front, received) | number | the sender's slot | written by the lobby |

**Part 1, the destination.** The lobby decodes it (`flash.js:4026`) and compares it with 2
(`:4038`). 2 means team-only: the relay skips every slot whose player is on another team than
the sender (`:4061`). Any other value means everyone. The receiver compares it with its own
team constant, 2 (`frame2.js:4082`), and writes `[Team Chat]` in front of the line (`flash.js:4640`).
In the game mode with value 1 (inferred to be deathmatch: it is the mode where the builder
forces 1, `frame2.js:3958`) the receiver prints no team prefix at all (`flash.js:4633-4634`).

**Part 2, the text.** A string, never decoded. The lobby cuts it to 240 characters
(`flash.js:4023-4024`). Each receiver removes line breaks and escapes `<` and `>` (`$ОOAAM`,
`:4596`, the function in `scripts/libs/tools.js`), so a player cannot send markup. When the
"censoreship" setting is on (`frame2.js:2987`), words from the game's list become
` [ censored ] ` (`flash.js:4610`, the function at `frame2.js:1190`). Then:
- The line is printed when the "display chat" setting is 1 or more (`flash.js:4601`; the
  setting at `frame2.js:2988`, default 2). With 0 it is hidden, and the sender gets a note
  that they talked with chat off (`frame2.js:27100-27103`).
- A chat sound plays (`flash.js:4615-4616`), and a non-spectator sender gets a small effect
  25 px above (`:4619-4620`; inferred to be the "talking" mark).
- The line reads `(<team>) <nickname>: <text>` in the team colour, or `<nickname>: <text>` in
  mode 1 (`:4633-4642`). A dead sender in mode 2 gets `*Dead* ` in front (`:4641`).
- Finally `$AH01cр(slot, text)` passes the line to a map-trigger hook (`:4648`,
  `frame2.js:10476-10483`). The hook only runs when `$HТс1I` is 0 or more, and `frame2.js`
  only ever sets it to -1 (`:10577`), so in this build it does nothing.

**The slot in front.** Written by the lobby with the game's number encoder
(`flash.js:4056`). The receiver looks the sender up among players and spectators (`:4605`).

#### Commands

The lobby's parser (`$МеесАА`, `flash.js:4865-5112`) runs on every line that passes the rate
limit. "Owner" means the match owner, unless the owner is a guest: the test compares the
owner's uid with the player's and excludes the guest uid `850431` (`:4029`, `:249`). "Staff"
is the profile's `is_staff` (`:4030`). A refused command answers with a `SERVICE_MESSAGE`. The
line itself is relayed as chat either way.

| Text | Who | What it does | Lines |
|---|---|---|---|
| `-announce <text>` | staff | sends `* Global Announcement * <login>: <text>` to every connection on the lobby, as HTML | `:4871-4882` |
| `-terminate` | owner, staff | ends the match | `:4884-4897` |
| `-pause` | owner, staff | removes a ping pause, or pauses / resumes; others get no answer | `:4899-4922` |
| `-swap` | owner, staff | moves every player to the neighbouring slot, even ↔ odd (inferred: the other team) | `:4924-4956` |
| `-endround` | owner, staff | ends the round, cooperative mode only | `:4958-4972` |
| `-unbanall` | owner, staff | clears the match's ban list | `:4974-4982` |
| `-min_reputation <n>` | owner, staff, or anyone when the match is at 0 and `n` is 1 | sets the match's minimum reputation, at least 0, at most the sender's own; not a number answers "Server: Not a number" | `:4984-5026` |
| `-min_reputation <n> -recheck <slot>` | as above | then removes players who no longer qualify: everyone, or only that slot | `:4986-4991`, `:5007-5019` |
| `-ping_action <action>` | owner, staff | one of `spectate`, `spectate_then_ban`, `pause_match`, `notify_everyone` | `:5028-5047` |
| `-ping <ms>` | owner, staff | sets the ping limit; 0 or not a number turns it off | `:5049-5073` |
| `-map <id>`, `-map next`, `-map reload` | owner, staff | loads a map; `next` needs map rotation | `:5075-5103` |

In a player-hosted match, `-terminate`, `-pause` and `-swap` are also forwarded to the host
as `P2P_CHAT_ADMIN_COMMAND` (`:5105-5111`).

#### Situations

- **Typing too fast.** The sixth line within one second is not dropped. It skips the cut to
  240 characters, the commands, the log and the team filter, is not echoed to the sender, and
  is still relayed to everyone else (`flash.js:4019`, `:4046-4067`). A team line sent that
  fast reaches the other team. The sender does not see the line in their own chat.
- **Chat in the lobby screen.** There is no lobby-wide chat. A `CHAT` from a player who is not
  in a match is ignored (`:1806-1811`). Lines that reach every connection are `-announce`
  results, which are `SERVICE_MESSAGE`s.
- **Player-hosted match.** Chat still goes through the lobby (`:1779-1780`), and the hosting
  player's app ignores a `CHAT` that reaches it (`:1826-1831`). The lobby relays it to the
  match's slots as in a lobby-hosted match.
- **Idle players.** A chat line resets the inactivity countdown, to 5 minutes for a player and
  30 for a spectator (`:4048-4053`, `:49-50`). A player who only chats is not excluded for
  inactivity.
- **Missing text.** The lobby reads `parts[2].length` (`:4023`). A `CHAT` without part 2 throws,
  and on the lobby a message that throws disconnects its sender (`connection.js:917-930`,
  `flash.js:403-405`).
- **netlog.** A text made only of characters from the number alphabet can show as a number,
  e.g. `CHAT(3, 1, 4.26403222527511e+88)`. On the wire it is still the text.
- **For the local server's maintainer.** `src/server/` runs this handler, and the line logged
  at `:4036` reaches the server log as a chat line (`src/server/game.ts`, `event`). The
  commands work as above; `-announce` needs an account marked staff.

### 15 · CREATE_MATCH — client → lobby

A request to open a new match with the settings from the "Start New Match" screen. The lobby
makes the match, loads the map, puts the creator in it, and answers.

| | |
|---|---|
| Built | `MPCreateMatch.js:501-571`, sent at `:549-554` |
| Handled by the lobby | `flash.js:2667-2843` |
| Answer applied | `MPCreateMatch.js:555-570` |
| Only with | a logged-in connection (`flash.js:1914-1926`), not spectating a match (`:1929-1934`), and more than 1 s after connecting (`:2671`) |

#### The console command

The game always sends every key of its settings object (`MPCreateMatch.js:73-101`). Keep them
all: a missing `password` becomes the string `"undefined"` and locks the match, and a missing
`map_rotation` turns rotation on (see the fields). Set the base once:

```
js pb.match={ranked:false,max_players:8,game_type:"DM",min_reputation:0,map_rotation:"random approved in rotation",title:"probe",map_id:"random approved in rotation",password:"",gameplay_modifications:"",ping_limit:"",rounds_until_rotation:"15",round_duration_str:"default",round_duration:0,p2p:false,p2p_region:"",exclude_inactive_players:true,allow_vpn_guests:1,ping_limit_action:"spectate",respawn_model:"v2",accept_connections_manually:false}
```

Then one line per case:

```
js pb.req("CREATE_MATCH", [JSON.stringify(pb.match), "REPLY"])
js pb.req("CREATE_MATCH", [JSON.stringify({...pb.match, password:"letmein"}), "REPLY"])
js pb.req("CREATE_MATCH", [JSON.stringify({...pb.match, game_type:"COOP", map_id:"<map id>", map_rotation:""}), "REPLY"])
js pb.req("CREATE_MATCH", [JSON.stringify({...pb.match, game_type:"TDM", max_players:16, min_reputation:1}), "REPLY"])
js pb.req("CREATE_MATCH", [JSON.stringify({...pb.match, p2p:true}), "REPLY"])
```

A plain deathmatch on a random map; with a password; a cooperative match on one map with no
rotation; a team match for 16 that asks for reputation 1; and a player-hosted one, which only
works if the lobby allows it and your app can host. The game itself switches to the match
screen when the answer is `"ok"`; from the console you get the answer only.

#### What real ones look like

Recorded with `netlog show`. The game's requests, as sent. The title and password are
replaced: the default title is "Game by " and the creator's nickname (`MPCreateMatch.js:81`).
The reply id is shown as sent, not decoded.

| Situation | As sent (settings shortened) |
|---|---|
| Deathmatch, random map in rotation | `CREATE_MATCH({"ranked":true,"max_players":8,"game_type":"DM","min_reputation":1,"map_rotation":"random approved in rotation","title":"<title>","map_id":"random approved in rotation","password":"",…,"p2p":false,"p2p_region":"",…}, "k")` |
| 64 players | `CREATE_MATCH({"ranked":true,"max_players":64,"game_type":"DM","min_reputation":0,…}, "j")` |
| One map, no rotation, unranked | `CREATE_MATCH({"ranked":false,"max_players":8,"game_type":"DM","min_reputation":0,"map_rotation":"","title":"<title>","map_id":"<map id>",…}, "r")` |
| Cooperative | `CREATE_MATCH({"ranked":false,"max_players":8,"game_type":"COOP","min_reputation":1,"map_rotation":"","title":"<title>","map_id":"<map id>",…}, "j")` |

The answers, as received:

| Situation | As received |
|---|---|
| Made and joined | `RESPONSE(107, "ok", "", "-1")`, after a `MATCH_JOIN_RESPONSE` |
| The map could not be loaded | `RESPONSE(102, "fail", "Match creation error: Map \"random approved in rotation\" was not found")` |

The `MATCH_JOIN_RESPONSE` comes first because joining the creator sends it (`flash.js:2821`)
before the answer (`:2829`).

#### How it works

1. **The client builds it.** "Start New Match" fills `p2p_region` from the time zone when
   `p2p` is on (`MPCreateMatch.js:504-507`), saves the settings among the last six presets
   (`:516-535`), and sends them as one JSON string with a reply id (`:549-554`). The button
   stays disabled until the lobby connection has logged in (`:499`, `:576-589`).
2. **The lobby checks the sender.** It must have logged in (`flash.js:1914-1926`) and not be
   spectating a match (`:1929-1934`).
3. **The lobby refuses, in order:** a connection less than 1 s old (`:2671`, `:2842`),
   negative reputation (`:2673-2676`), settings over 5000 characters (`:2678-2681`).
4. **It builds the match** (`:2684-2770`) from the settings, with the clamps below. The new
   match takes the next uid, counting from 1000 (`:2709`, `:197`). The creation is logged
   through the account module (`:2772`).
5. **It limits matches per owner.** If the owner already has 4 matches, or 8 for a guest
   (`:2781-2784`), the least populated one is ended (`:2786-2813`).
6. **It loads the map** (`:2817`, `match.$ееААT` at `:5752`). On failure it answers
   `"Match creation error: "` and the reason (`:2835`), and the empty match ends itself
   (`:5603-5611`).
7. **It puts the creator in the match** (`:2821`, `$IcсcA` at `connection.js:580`). For a
   lobby-hosted match it answers `["ok", "", -1]` (`flash.js:2829`). For a player-hosted one it
   says "Connecting to self-hosted match..." and answers with the hosting information
   (`:2823-2826`). If the creator cannot be placed, there is no answer.
8. **The client applies the answer** (`MPCreateMatch.js:555-570`). On `"ok"` it passes values
   1 and 2 to the player-host connector, which does nothing for `""` (`flash.js:5150-5152`),
   and keeps the password for later. On `"fail"` it re-enables the button and prints the
   reason.

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | JSON | the settings |
| 2 | string | reply id, passed back unchanged |

**Part 1, the settings.** Parsed with a helper that returns `{}` for bad JSON
(`flash.js:2684`, `tools.js:521-533`). The lobby reads these keys (`flash.js:2686-2769`):

| Key | What the lobby does |
|---|---|
| `title` | `"" + title`. `undefined` becomes `"undefined"`. A title with `[^c]` stops the map load (`:5759`, `:5826-5827`). |
| `map_id` | `"" + map_id`, the map to load |
| `game_type` | `DM`, `COOP` or `TDM` (`:173`); anything else becomes `DM` (`:2713`) |
| `max_players` | not a number → 8, over 64 → 64, under 1 → 1 (`:2691-2698`); stored as `desired_players_max` |
| `min_reputation` | missing → 1 (`:2686`); above the creator's reputation → the creator's reputation (`:2688-2689`); no lower bound |
| `map_rotation` | rotation is on unless it is exactly `""` (`:2726`); the value becomes `next_map_id` (`:2727`) |
| `password` | `"" + password` (`:2700`); `has_password` is true when it is not empty (`:2769`) |
| `ranked` | only `true` counts (`:2749`) |
| `p2p` | only `true`, and only when the lobby allows player hosting (`:2751`, on by default at `:11`) |
| `p2p_region`, `ping_limit_action`, `respawn_model` | copied as strings (`:2733`, `:2735`, `:2752`) |
| `ping_limit` | `""` → 0, else `parseInt` (`:2732`) |
| `allow_vpn_guests` | `parseInt` (`:2730`) |
| `exclude_inactive_players` | only `true` counts (`:2737`) |
| `gameplay_modifications` | a string, `""` when missing (`:2754`) |
| `rounds_until_rotation` | `parseInt`, else 15 (`:2756`, `:58`) |
| `round_duration` | `parseInt`, else 0 (`:2757`) |

`round_duration_str` and `accept_connections_manually` are not read by the lobby. The client
keeps `accept_connections_manually` for itself (`MPCreateMatch.js:547`). The owner's login,
auth id and reputation, and `netcode` 3, come from the lobby (`flash.js:2746`, `:2761-2764`).

**Part 2, the reply id.** Not decoded: the lobby sends it back as it came (`flash.js:2669`,
`:1888`).

#### Situations

- **The first second.** The time compared at `:2671` is set when the connection is made
  (`connection.js:444`) and never changed. So the check is not "one create a second": it only
  refuses a create in the first second after connecting. Clicking "Start New Match" again
  later is not rate-limited by this.
- **Negative reputation.** Refused outright (`flash.js:2673-2676`). A `min_reputation` above
  your own is lowered to it, so you cannot make a match you could not join.
- **Too many matches.** A fifth match from the same owner ends their least populated one,
  counting spectators as 0.1 of a player, with a notice to the owner and the players
  (`:2786-2813`). Guests are counted by their uid; since the guest uid is shared (`:249`, used
  as the guest test at `:4029`), all guests together are inferred to share the limit of 8.
- **Map not found.** The answer is a `"fail"`, the match ends itself, and the client's button
  becomes usable again.
- **No reply id.** Answering without a reply id throws (`:1882-1885`). On the lobby that
  disconnects the sender (`connection.js:917-930`).
- **For the local server's maintainer.** `src/server/` resolves the map through its own map
  request (`src/server/game.ts`, `mapRequest`): local files first, `random approved…` from
  the configured list, downloads only when allowed. Its refusals come back as
  `Match creation error: <reason>`.

### 16 · AUTHENTICATE — client → lobby

The login. It is the first message on every lobby connection, and the only one the lobby
accepts before it (besides `RESPONSE`). The lobby hands the parts to its account code, which
is not in the shipped files, and answers with the profile or a reason.

| | |
|---|---|
| Built | `MPLobby.js:130-160`, sent at `:149` |
| Handled by the lobby | `flash.js:1982-2040`, account check `$с0A.$ITTНрl` (server-private) |
| Answer applied | `MPLobby.js:161-200` |
| Rate | one attempt per 3 s per connection (`flash.js:2001-2003`) |

#### The console command

```
js pb.req("AUTHENTICATE", ["<login>", "<password>", "version_h5", "hash_h5", "REPLY", "<nickname>", "\"<device id>\"", "1769098189070"])
js pb.req("AUTHENTICATE", [".guest", ".guest", "version_h5", "hash_h5", "REPLY", "", "\"<device id>\"", "1769098189070"])
```

An account login and a guest login, in the shape the game sends. The game does this once per
connection; sending it again on a live socket is answered by the account code (on the local
server: "That nickname is already playing here", because the connection itself is online).
Part 8 is the plain string the game sends, not `pb.num`.

#### What real ones look like

Recorded with `netlog show`. The netlog writes `‹redacted›` for the password. Every recorded
login had all 8 parts, `version_h5`, `hash_h5` and `1769098189070`.

| Situation | Message |
|---|---|
| Login, as sent | `AUTHENTICATE("<login>", "‹redacted›", "version_h5", "hash_h5", "h", "<nickname>", "\"<device id>\"", "1769098189070")` |
| Accepted by the local server | `RESPONSE(100, "ok", {"nickname":"<nickname>","login":"<login>","login_proof":"","uid":1001,"mdl":"1","mdl2":"0","is_staff":false,"is_guest":false,"is_vpn":false,"is_public_supporter":false,"support_months":0})` |
| Accepted by the official lobby | `RESPONSE(100, "ok", {"nickname":"<nickname>","login":"<login>","login_proof":"<proof>","uid":<uid>,"mdl":17,"mdl2":77,"is_staff":0,…,"support_months":0,"real_register":<time>})` |
| Refused | `RESPONSE(100, "fail", "Server: Unknown error [2]")` |

The device ids seen were 47 or 48 characters (the game's own) or 21 (another client).

#### How it works

1. **The client connects and builds it** (`MPLobby.js:99-160`). It closes a connection to
   another lobby first (`:103-107`). Login and password come from the page parameters `l` and
   `p`, or are `.guest` (`:130-137`). Parts 3, 4 and 8 are constants (`:154-159`).
2. **The lobby gates it.** Until a connection has logged in, every message other than
   `AUTHENTICATE` and `RESPONSE` is dropped without an answer (`flash.js:1914-1926`).
3. **The lobby reads the parts** (`:1984-1993`) and strips the quotes from part 7 (`:1991`).
4. **It refuses a missing part 8** with `"Server: Refresh page to get new version of the
   game"` (`:1995-1996`), but goes on with the login anyway. Only the first answer is sent
   (`:1868-1878`).
5. **It rate-limits:** a second attempt within 3 s gets `"Server: Too frequently"` (`:2001`,
   `:2038-2039`). The time starts at 0 (`connection.js:421`), so the first attempt passes.
6. **The account code decides** (`$с0A.$ITTНрl`, `flash.js:2023-2036`). It gets the connection and
   every part, sets the profile on the connection, and calls back with `null` or a reason.
   The lobby answers `["ok", <profile JSON>]` or `["fail", <reason>]` (`:2029-2034`).
7. **The client applies it** (`MPLobby.js:161-200`). On `"ok"` it stores the profile, marks
   this connection as the logged-in lobby, takes the nickname, login and skin, and prints
   "Authenticated successfully" (`:165-186`). On `"fail"` it prints "Unable to authenticate
   as <login>: <reason>" (`:194-196`).

#### Field by field

| Part | Read as | Meaning | The game sends |
|---|---|---|---|
| 1 | string | login | page parameter `l`, or `.guest` |
| 2 | string | password | page parameter `p`, or `.guest` |
| 3 | string | version | `"version_h5"` |
| 4 | string | hash | `"hash_h5"` |
| 5 | string | reply id | the placeholder |
| 6 | string | nickname | the saved campaign nickname |
| 7 | string | device id, JSON-quoted | the saved `first_uid` |
| 8 | string | build | `"1769098189070"` |

The lobby reads every part as a string and passes it to the account code
(`flash.js:2025`). What the account code checks is not in the shipped files; only part 7's
length and part 8's presence are checked in `flash.js`.

**Parts 1 and 2, login and password.** The account code's input. On the local server, the
login is the nickname to play under and the password is the server password or an admin's
secret (`src/server/game.ts`, `login`).

**Parts 3 and 4, version and hash.** Constants in this build (`MPLobby.js:154-155`).

**Part 5, the reply id.** Passed back unchanged (`flash.js:1988`, `:1888`).

**Part 6, the nickname.** The campaign nickname, saved as `cmpg_nick` (`frame2.js:2393`,
`:2895`). The client shows a guest as `Guest-` and this name (`MPLobby.js:139`). Missing
becomes `""` (`flash.js:1989`).

**Part 7, the device id.** The lobby strips the first and last character, the quotes
(`flash.js:1990-1991`); missing becomes `0hash`. `MPLobby.js:158` seems to send a fresh
random value, but the call is `JSON.strіngіfy` with look-alike letters, not `JSON.stringify`. The
game replaces it at start (`flash.js:30`, `:7516-7548`): it ignores its argument and returns
the `first_uid` kept in the save data, made once from four random base-36 numbers. So part 7
is the same on every login from one install. Its twin `JSON.pаrsе` (`:7520-7533`) records
the first non-guest `login` and `login_proof` it parses into the same save data. A value over
60 characters after stripping is not cut: `first_uid.length=60` (`:1998-1999`) throws in this
strict code, and the lobby disconnects the sender (`connection.js:917-930`).

**Part 8, the build.** Missing → the "Refresh page" refusal (`flash.js:1995-1996`).
Otherwise passed to the account code as it is.

**The answer.** `["ok", <profile JSON>]`. The profile is whatever the account code set on the
connection. Its fields are listed in an unused object at `flash.js:2007-2020`: `nickname`,
`login`, `login_proof`, `uid`, `mdl`, `mdl2`, `is_staff`, `is_guest`, `is_vpn`,
`is_public_supporter`, `support_months`. The official lobby also sent `real_register`.

#### Situations

- **Refresh page, but logged in.** Without part 8 the client gets the refusal, but the
  account code still runs (`flash.js:1995-2036`). The connection may end up logged in while
  the client believes it failed. Its second answer is dropped (`:1872-1873`).
- **Retrying.** A retry within 3 s is refused with "Server: Too frequently" (`:2038-2039`).
  The game itself does not retry: after a `"fail"` it keeps the connection, and later list
  requests reuse it without logging in again (`MPLobby.js:103-109`, `:203-205`). Those
  requests are then dropped unanswered (`flash.js:1916-1926`) until the lobby screen
  reconnects to another server.
- **Before login.** A client that sends `GET_MATCH_LIST` before the answer gets no answer:
  the message is dropped (`:1916-1926`).
- **Privacy.** Part 2 is the account's password or site token and part 7 identifies the
  install. Do not paste a recorded `AUTHENTICATE` anywhere; the netlog redacts part 2 only.
- **For the local server's maintainer.** The local server's account code
  (`src/server/game.ts`, `authLogin`) uses parts 1 and 2 only. It refuses `.guest` and an
  empty login ("This server needs a nickname"), a wrong server password, a taken nickname, a
  ban and a full server. It sends `login_proof` as `""`.

### 17 · LIST_ME_AS_HOST — reserved, never sent

An opcode with no sender and no handler. The game defines the name (`flash.js:105`), and it
takes a number in the opcode count, but no script sends it and no handler tests for it.

| | |
|---|---|
| Defined | `flash.js:105` |
| Sent | nowhere in `game/scripts` |
| Handled | nowhere |

#### Wire form

```
LIST_ME_AS_HOST()
```

No parts. There is no console line: no message the game sends has this shape, and nothing
answers it, so a `pb.req` promise never resolves.

#### What happens if one arrives

On the lobby it falls through every handler to the relay at the end, like an unknown
gameplay message:
- Before login it is dropped (`flash.js:1916-1926`). From a spectator it is refused with
  "not compatible with spectator mode" (`:1929-1934`).
- From a player not in a match, or in a player-hosted match, it is ignored (`:1806-1821`).
- In a lobby-hosted match it is relayed to the other players with the sender's slot in front
  (`:4056-4066`), and they ignore it: no receiver branch tests for it.

It does not mark a connection as a host. Player-hosted matches are made by `CREATE_MATCH` with
`p2p` set (`:2751`) and run over the `P2P_…` messages.

### 18 · SERVICE_MESSAGE — lobby or player host → client, shown in chat

A line from the server: a refusal, a notice, a round result, an announcement. It is printed in
chat as HTML. The server sends it; a client never does.

| | |
|---|---|
| Built | `connection.js:666-675` (one connection), `flash.js:6818-6828` (one player, or the whole match) |
| Applied by the client | `flash.js:2042-2058`, printed by `ChatNewMsg` at `frame2.js:19774` |
| Ignored by the server | `flash.js:2044-2045` |

#### Wire form

```
SERVICE_MESSAGE("<font color=\"#ffff00\">Round 1</font>")
```

There is no console line: a client's `SERVICE_MESSAGE` is ignored by the lobby (`:2044-2045`),
and a spectator's is refused with a message.

#### What real ones look like

Recorded with `netlog show`, all as received. The colour is part of the text.

| Situation | As received |
|---|---|
| A round starts | `SERVICE_MESSAGE("<font color=\"#ffff00\">Round 1</font>")` |
| A round ends even | `SERVICE_MESSAGE("<font color=\"#ffff00\">Round draw</font>")` |
| The map changes | `SERVICE_MESSAGE("<font color=\"#ffffff\">Loading next map...</font>")` |
| `-min_reputation 1` to the match | `SERVICE_MESSAGE("<font color=\"#ffffaa\">Server: Minimum reputation to access this match was set to 1</font>")` |
| `-ping 4` to its sender | `SERVICE_MESSAGE("Server: Ping limit was set to 4")` |
| A player removed by a recheck | `SERVICE_MESSAGE("<font color=\"#ff0000\">Disconnected: This match does not allow users with reputation below <font color=\"#fff998\">1</font> to join</font>")` |
| The owner's `-terminate` | `SERVICE_MESSAGE("Server: Match has been terminated by match owner")` |
| Over the match's ping limit | `SERVICE_MESSAGE("<font color=\"#ffff00\">Server: High ping detected (48 ms > 4 ms)</font>")` |

#### How it works

1. **The server builds it.** `$ТАMpо(text, colour)` sends one line to one connection, wrapped
   in `<font color>` when a colour is given (`connection.js:666-675`). A match sends to one of
   its players (`$cТTоМH`, `flash.js:6818-6821`, yellow by default) or to all of them
   (`$HАeHT`, `:6822-6828`). Ending a match sends its reason to every player (`:6632-6645`).
   `flash.js` calls these in dozens of places.
2. **The client gets it from any connection**, before the match checks (`:2042`). If it plays
   in a player-hosted match, it marks where the line came from: `[ Player-hosted server ]`
   from the host, `[ Main server ]` from the lobby (`:2047-2053`).
3. **The client prints it** with `ChatNewMsg` (`:2057`). The text is HTML and is not escaped.
   When the "censoreship" setting is on, words from the game's list are censored
   (`frame2.js:19786`). Outside the game screen, for example in the lobby, it shows as a
   floating line for 2 to 10 seconds, 70 ms a character (`:19788-19810`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | the line, as HTML |

**Part 1, the line.** Printed as HTML (`flash.js:2057`). Colours come from `<font color>`
tags. The message log keeps it as `msg` (`:2055`). A part 1 that is missing prints
`undefined`.

#### Situations

- **Refusals without an answer.** Some refusals are a `SERVICE_MESSAGE` instead of an answer.
  A spectator who sends a message spectators may not send gets "Server: Action of type …
  is not compatible with spectator mode" (`:1929-1934`), and a request then never gets its
  `RESPONSE`.
- **Markup.** Unlike `CHAT`, the text is not escaped. `-announce` puts staff text into one
  as it is (`:4878`), so it can carry tags. The local server's `say` escapes `<`
  (`src/server/game.ts`, `say`).
- **For the local server's maintainer.** `src/server/` sends its welcome text one second
  after login, a kick reason before closing, and its own announcements as this message
  (`src/server/game.ts`: `login`, `kickConnection`, `say`).

### 19 · GET_MATCH_LIST — client → lobby

A request for one of the lobby's lists: the matches, your reputation relations, or the skill
board. Every answer also carries your own reputation and skill and the lobby's counts. The
same request ends a relation.

| | |
|---|---|
| Built | `MPLobby.js:210-673`, sent at `:663-671` |
| Handled by the lobby | `flash.js:2497-2665` |
| Answer applied | `MPLobby.js:212-658` |
| Only with | a logged-in connection (`flash.js:1914-1926`), not spectating a match (`:1929-1934`), 300 ms since the last one (`:2503`) |

#### The console command

```
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "match_list"])
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "relations"])
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "skill_board"])
js pb.req("GET_MATCH_LIST", [JSON.stringify({delete_relation: 1700000000000}), "REPLY", "relations"])
```

The match list; your relations; the skill board; and ending one of your relations. For the
last one, replace the number with the `since` of a row from your own `relations` answer.

#### What real ones look like

Recorded with `netlog show`. The reply id is shown as sent. Logins, titles, auth ids and map
ids are replaced.

| Situation | Message |
|---|---|
| The match list, as sent | `GET_MATCH_LIST({}, "i", "match_list")` |
| Relations, as sent | `GET_MATCH_LIST({}, "l", "relations")` |
| Sent right after login | `RESPONSE(101, "fail", "Match listing error: Too fast")` |
| An empty list (local server) | `RESPONSE(108, "ok", [], {"reputation":40,"skill":0,"wins":0,"loses":0,"online":1,"matches":0})` |
| One match (local server) | `RESPONSE(102, "ok", [{"uid":1000,"title":"<title>","players_current":1,"spectators_current":0,"players_max":16,"map_id":"<map id>","map_name":"<map id>","game_type":"DM","match_owner_login":"<login>","match_owner_auth_id":<auth id>,"match_owner_reputation":40,"has_password":false,"netcode":3,"approved":0,"ranked":false,"min_reputation":0,"average_skill":-1,"p2p":false,"p2p_region":"","gameplay_modifications":"","ping_limit":0,"ping_limit_action":"spectate","respawn_model":"v2","next_map_id":"random approved in rotation","can_join":true}], {"reputation":40,"skill":0,"wins":0,"loses":0,"online":2,"matches":1})` |
| One relation row (official lobby) | `{"is_mine":1,"from":"<login>","to":"<login>","is_support":1,"relative_since":-120621,"relative_cap_time_until":2591879379,"personal_delta":0,"other_auth_id":<auth id>,"since":<since>,"is_active":true}` |

The netlog prints the two JSON values parsed. On the wire they are JSON strings.

#### How it works

1. **The client asks** (`MPLobby.js:210-673`). Opening the lobby screen, the "Update Match
   List" button and the filter ask for `match_list` (`:806-808`, `:824-826`, `:851`). The
   reputation and skill buttons ask for `relations` and `skill_board` (`:743`, `:771`). Each
   request first goes through the connect-and-login step (`:661`, the step at `:99-206`).
2. **The lobby checks the sender** (`flash.js:1914-1934`) and the time: a request within
   300 ms of the last one, or of connecting, gets `["fail", "Match listing error: Too fast"]`
   (`:2503-2505`, `:2662-2663`; the time starts at connection, `connection.js:446`).
3. **It builds the rows for the view** (`flash.js:2509-2642`). An unknown view gives no rows.
4. **It adds your stats** (`:2645-2656`) and answers `["ok", <rows JSON>, <stats JSON>]`
   (`:2659`).
5. **The client applies it** (`MPLobby.js:212-658`). It shows your reputation, potential
   reputation, skill, and the player and match counts (`:221-241`), then draws the rows. A
   `"fail"` reason is printed in chat (`:656-657`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | JSON | the filter: `{}`, or `{"delete_relation": <since>}` |
| 2 | string | reply id, passed back unchanged |
| 3 | string | the view: `match_list`, `relations` or `skill_board` |

**Part 1, the filter.** Parsed with a helper that returns `{}` for bad JSON (`flash.js:2507`).
Only `delete_relation` is read, and only in the `relations` view (`:2572-2589`). It must equal
a relation's `since` exactly. You can end only a relation you started that is still active
(`:2575-2583`). Otherwise you get "Server: Unable to end relation initiated by other player"
or "Server: Relation is already inactive - it will be kept for logging purposes for a week"
(`:2584-2588`). The client sends it from a relation row (`MPLobby.js:580-586`).

**Part 2, the reply id.** Passed back unchanged (`flash.js:2499`).

**Part 3, the view.**
- `match_list` (`:2511-2551`). First the lobby may end empty matches: every 10 s, if there
  are more than 8 matches, or for a match with a password, a match past its idle deadline
  is ended with "Match is inactive and has been empty for too long" (`:5214-5239`).
  Then, for each match, it refreshes the owner's reputation (`:2519`, `:5503-5527`) and copies the fields listed at `:199-201` that are set. It adds
  `can_join`, and `reason` when you cannot join (`:2534-2541`). The client sorts by owner
  reputation × (players + 1), and pushes matches with a password or no players down
  (`MPLobby.js:252-262`).
- `relations` (`flash.js:2553-2615`). Every reputation relation that involves you, with both
  logins, whether you started it (`is_mine`), whether it is an endorsement (`is_support`),
  times relative to now, the reputation change on your side, the other player's current auth
  id if online, `since` and `is_active` (`:2595-2610`).
- `skill_board` (`:2617-2642`). Players with skill and reputation above 0, active in the last
  7 days, not the guest uid, sorted by skill, at most 200 (`:2619-2641`).

**The stats.** `reputation`, `reputation_potential`, `skill`, `wins`, `loses`, the number of
connections (`online`) and of matches (`:2645-2656`).

#### Situations

- **"Too fast" on opening the lobby.** The 300 ms count starts when the connection is made
  (`connection.js:446`). The client logs in and asks for the list at once, so in the
  recordings the first request, 15-19 ms after the login answer, was refused. The next click
  works.
- **Privacy.** `relations` and `skill_board` return other players' logins, and the match list
  returns owners' logins and auth ids. Do not paste these answers as they are.
- **Not a filter.** Part 1 does not filter the match list; the lobby always returns every
  match. The "CAN JOIN" filter is the client's (`MPLobby.js:806`).
- **No reply id.** Answering without one throws (`flash.js:1882-1885`), and the lobby
  disconnects the sender (`connection.js:917-930`).
- **For the local server's maintainer.** `src/server/` replaces the 300 ms gap with its
  `match_list_gap_ms` setting, and its first request is never too fast
  (`src/server/game.ts`, `accept`; 0 turns the gap off). Its account module is a stand-in
  whose functions return nothing (`src/server/game.ts:142-144`), so `reputation_potential` is
  missing from the stats, as in the recording above.

### 20 · JOIN_MATCH — client → lobby

Asks the lobby for a slot in a match, or to leave the current match. The same message is
used for joining from the match list, for spectating, for switching between playing and
spectating inside a match, and for leaving. The answer only says whether it worked. The
match itself arrives in separate messages: `MAP_CHUNK` (if asked for), then
`MATCH_JOIN_RESPONSE`.

| | |
|---|---|
| Built | `MPLobby.js:452` (join), `MPLobby.js:565` (spectate), `GameScene.js:109` (the Spectate / Join Game button), `GameScene.js:1146` (a team button), `flash.js:5136` (leave) |
| Handled by the lobby | `flash.js:2932-3063`, then the slot choice in `connection.js:580-633` and the join in `flash.js:6655-6816` |
| Answer | a `RESPONSE`: `["ok", <p2p info>, <host id>]` or `["fail", "<why>"]` |
| Allowed while spectating | yes, it is on the spectator list (`flash.js:1738`) |

#### The console command

```
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", -1, "1", ""])
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", -100, "1", ""])
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", 3, "1", ""])
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", -1, "1", "<password>"])
js pb.req("JOIN_MATCH", [-1, "REPLY", -1, "", ""])
```

1. Plain join: any free player slot, and send me the map. This is what a click on a match
   row sends.
2. As a spectator: slot `-100` asks for a spectator slot.
3. A chosen slot: slot 3 if it is free. If it is taken, the lobby picks any free player
   slot instead.
4. With a password, for a match with `has_password`.
5. Leave the current match: match uid `-1`.

`<match uid>` is the `uid` from the match list (`GET_MATCH_LIST`), in decimal. The lobby
then sends the map and the match details, and the game loads the match as if you had
clicked. The game's own callback is not run, so this cannot join a player-hosted (p2p)
match: the hoster's connection info in the answer is not used.

#### What real ones look like

Recorded with `netlog show`, as sent. The uid and the slot are decimal text, so they show as
strings. The reply id is a base-N number: netlog decodes it when it is not a printable
character (`129`), and shows it as text when it is (`"j"`). A password shows as
`‹redacted›` ([netlog](../features/netlog.md)).

| Situation | As sent |
|---|---|
| Join from the list | `JOIN_MATCH("1000", "k", "-1", "1", "")` |
| Join from the list, map already saved (`fast_maps`) | `JOIN_MATCH("54711", "j", "-1", "", "")` |
| The Spectate button inside the match | `JOIN_MATCH("54711", "k", "-100", "", "")` |
| A protected match | `JOIN_MATCH("52099", 129, "-1", "1", "‹redacted›")` |
| Leaving | `JOIN_MATCH("-1", "q", "-1", "", "")` |

No recording has a chosen slot: only the team buttons send one, and none were used.

The answers, as received:

| Situation | As received |
|---|---|
| Joined a lobby-hosted match | `RESPONSE(103, "ok", "", "-1")` |
| Wrong password | `RESPONSE(<id>, "fail", "Match join error: Password doesn't match.")` |
| Reputation too low | `RESPONSE(<id>, "fail", "Match join error: This match does not allow users with reputation below <font color=\"#fff998\">1</font> to join.")` |
| Full | `RESPONSE(<id>, "fail", "Match join error: Match has no free slots.")` |
| Two joins within 2 s | `RESPONSE(<id>, "fail", "Match join error: Too fast.")` |

In the recordings the lobby sends `MATCH_JOIN_RESPONSE` before this `RESPONSE`.

#### How it works

1. **The client builds it.** A click on a match row sends slot `-1` and the map flag
   (`MPLobby.js:443-444`, `:452`). The narrow button next to it sends slot `-100`
   (`MPLobby.js:556-557`, `:565`). A protected match first asks for the password
   (`MPLobby.js:404-419`). Inside a match, the Spectate / Join Game button sends `-100` or
   `-1` without the map flag (`GameScene.js:104-105`). A team button sends the first slot
   whose character is on that team and has no player (`GameScene.js:1131-1142`). Leaving
   sends uid `-1` (`flash.js:5136`).
2. **The lobby reads it** (`flash.js:2934-2938`) and refuses it in this order:
   - "Still leaving ranked match." while a delayed ranked leave is pending (`:2940-2944`).
   - Uid `-1`: the lobby removes you from your match and answers `["ok", "", -1]`
     (`:2946-2951`). The 2-second limit below does not apply.
   - "Too fast." within 2 s of your last successful join (`:2953-2957`).
   - For the match with that uid (`:2959-2963`): a password check (`:2965-2974`), "Match is
     still being created." (`:2976-2977`), then the access check `$lрTp1`
     (`:6564-6630`): reputation, guest and VPN rules, the match ban list
     ([reputation.md](reputation.md#where-the-join-check-runs)).
   - "Match not found." when no match has that uid (`:3063`).
3. **It leaves your current match first.** If you are in a match, the lobby leaves it and
   joins from the callback (`:3033-3041`). Leaving a ranked match while alive is delayed by
   2 s (`connection.js:542-561`, `$ОTОМT = 2000` at `connection.js:17`). Chat then says
   "Waiting on ranked match leave delay...".
4. **It picks the slot** (`connection.js:595-617`):
   - the slot asked for, if that index exists and is free;
   - else, for `-100`, the first free slot from `players_max` on, which is a spectator slot;
   - else the first free slot below `players_max`.
   No slot gives "Match join error: Match has no free slots." (`flash.js:3030`).
5. **It joins you** (`flash.js:6655-6816`). A slot at or above `players_max` makes you a
   spectator (`:6670`). Your player record starts fresh: 0 HP, 0 respawns, team `-123`
   (17 for a spectator), no skin, no guns (`:6712-6766`). Then the lobby sends you the map
   in `MAP_CHUNK`s if part 4 asked for it (`:6768-6778`), then `MATCH_JOIN_RESPONSE`
   (`:6780-6788`). In a lobby-hosted match it also tells everyone else, with a
   `FIRST_SYNC_RESPONSE` (`:6797-6804`).
6. **It answers.** A lobby-hosted match answers `["ok", "", -1]` (`:3026`). A p2p match
   starts the hoster handshake and answers `["ok", <hoster's connection info>, <hoster id>]`,
   or `["ok", "same", -1]` when the existing p2p connection is reused (`:2992-3022`,
   `:7325-7375`).
7. **The client acts on the answer** (`flash.js:5150-5212`). An empty second value closes
   any p2p connection and sends `P2P_DISCONNECT` (`:5199-5210`), which is the
   `P2P_DISCONNECT()` seen after a join. A JSON value starts the p2p handshake. A `"fail"`
   goes to chat (`MPLobby.js:458-461`).

#### Field by field

| Part | Read as | Meaning | Sent as |
|---|---|---|---|
| 1 | `parseInt`, decimal | match uid, or `-1` to leave | the list's `uid` |
| 2 | reply id | where the answer goes | the placeholder |
| 3 | `parseInt`, decimal | slot asked for | `-1`, `-100`, or a slot index |
| 4 | string, empty or not | send me the map | `"1"` or `""` |
| 5 | string | match password | the typed password, or `""` |

**Part 1, the match uid.** Compared with `===` against each match's `uid`
(`flash.js:2963`), after `parseInt` (`:2934`). It is plain decimal, not base-N: the client
puts the number in the array and the sender turns it into text (`connection.js:101-102`).
Text that is not a number gives `NaN`, and "Match not found.". `-1` means leave
(`:2946`).

**Part 2, the reply id.** The answer goes to it (`flash.js:1868-1888`). There is always an
answer, so a `pb.req` promise resolves.

**Part 3, the slot.** Decimal, read with `parseInt` (`flash.js:2936`). See step 4 above:
`-100` (`$ММ.$оОсOс`, `flash.js:71`) asks for a spectator slot. Any free index is taken as
asked, including a spectator index; a taken or invalid one falls back to any free player
slot. The match has `players_max + 16` slots (`flash.js:5656`, `$ММ.$ОlAlTO = 16`, `:72`),
which is the `slots_total` in `MATCH_JOIN_RESPONSE`. Slots `players_max` and up are the 16
spectator slots.

**Part 4, send me the map.** Any non-empty text means yes (`flash.js:2937`). The lobby then
sends the map as `MAP_CHUNK`s before `MATCH_JOIN_RESPONSE` (`:6768`). The game sends `"1"`
from the match list and `""` when it switches slot inside the same match, because it has the
map already (`GameScene.js:105`, `:1142`). Without it, `MATCH_JOIN_RESPONSE` keeps the map
already loaded (`flash.js:3373-3377`). The [map_cache](../features/map-cache.md) feature
clears it when the map is saved locally. This part is **not** the spectator flag; the
spectator choice is part 3.

**Part 5, the password.** Compared with `!==` against the match's password, only when
`has_password` is set (`flash.js:2965`). A wrong one answers "Password doesn't match." and
starts a 2-second cooldown (`:2972`, `$рсНAе.$рHТе0 = 2000`, `connection.js:71`). During the
cooldown every try answers "Can't enter match due to cooldown after failed attempt.", even
with the right password (`:2967-2968`). The in-game switch buttons resend the password typed
in the lobby (`GameScene.js:109`).

#### Situations

- **Switching slot is a leave and a join.** The Spectate button, the Join Game button and
  the team buttons all send `JOIN_MATCH` for the match you are in. The lobby leaves the old
  slot, which everyone sees as `FIRST_SYNC_RESPONSE(<slot>, "", "1")` ("left the game"),
  and joins the new one. The 2-second "Too fast." limit applies, so two quick clicks fail.
- **Ranked leave delay.** In a ranked match while alive, leaving waits 2 s
  (`connection.js:551-561`). A second `JOIN_MATCH` in that window gets "Still leaving
  ranked match." (`flash.js:2940`).
- **The match owner hears about refusals.** When the access check refuses someone, the
  owner gets a grey chat line, "Someone received message on join attempt: …", at most once
  every 5 minutes (`flash.js:3049-3057`).
- **The lobby moves players itself** with the same join code. The owner's `-swap` rejoins
  everyone on the other team without the map (`flash.js:4929-4951`). A map change rejoins
  everyone with the map (`:5741-5745`). A ping over the match's limit moves the player to a
  spectator slot (`:6167-6170`). Each sends a new `MATCH_JOIN_RESPONSE`.
- **Spectators can still send it** (`flash.js:1738`); that is how they rejoin as players.
- **For the local server's maintainer.** `src/server/` runs this handler from the decoded
  `flash.js`. Refusals come back as text in the answer, so `netlog show type:response`
  shows why a join failed. A join that answers `"ok"` but does not load points at the
  `MAP_CHUNK` / `MATCH_JOIN_RESPONSE` that should follow.

### 21 · MATCH_JOIN_RESPONSE — lobby → client

The match you just joined: its settings, and the slot you got. The client resets its match
state, puts the map together from the `MAP_CHUNK`s, and goes to the loading screen. It is
sent after every successful join, including a slot switch inside the same match.

| | |
|---|---|
| Built | `flash.js:6780-6788`, at the end of every join |
| Handled by the client | `flash.js:3315-3393` |
| Ignored | by the lobby (`:3317-3318`) |

#### The console command

None. A client does not originate it: a client that sends one reaches the lobby, which
returns at once (`flash.js:3317-3318`). The wire form, for reference:

```
MATCH_JOIN_RESPONSE("chunked", <match details JSON>, "<slot>")
```

#### What real ones look like

Recorded with `netlog show`, as received. Names are replaced. The slot is decimal text, so
it shows as a string.

```
MATCH_JOIN_RESPONSE("chunked", {"players_max":8,"approved":0,"ranked":false,"game_type":"COOP","map_name":"<map>","map_id":"<map>","title":"<title>","uid":52096,"netcode":3,"p2p":false,"p2p_region":"","desired_players_max":16,"min_reputation":0,"gameplay_modifications":"","slots_total":24,"match_owner_login":"<owner>","team_scores":{},"coop_state":0,"respawn_model":"v2","force_player_health":null,"joined_as_spectator":false}, "4")
```

| Situation | What differs |
|---|---|
| A player slot in a COOP match | as above, slot `"4"` |
| A spectator slot | `"joined_as_spectator":true`, slot `"8"` = `players_max` 8 |
| A TDM match in progress | `"team_scores":{"12":46,"13":15}` |
| A match with modifications | `"gameplay_modifications":"suddendeath=1,extra-bots,…"` |

#### How it works

1. **The lobby sends it** at the end of a join (`flash.js:6780-6788`), after the
   `MAP_CHUNK`s if any. Part 3 is your slot as a plain number, which the sender writes in
   decimal (`connection.js:101-102`).
2. **The client resets** (`flash.js:3320-3330`): it clears the hint text, drops queued
   outgoing match events (`$ММ.$pрlIHM`), forgets the player properties it last sent, so
   all 13 are sent again (`:3324-3325`, see `MY_PLAYER_PROPERTIES_CHANGED`), and drops match
   messages that were waiting for the level (`:3327`).
3. **From a p2p hoster** it only goes to the loading screen (`:3333-3339`).
4. **From the lobby** it reads the details (`:3342-3371`): spectator or not, approved,
   game type, netcode, modifications, the number of slots, your slot, title and map id. If
   chunks arrived, it joins them into the map text (`:3373-3377`). It sets the lobby as
   the match connection (`:3383`) and goes to the loading screen (`:3391-3392`).
5. **When the level is loaded** the client sends `CLIENT_READY_FOR_FIRST_SYNC`
   (`frame2.js:14371`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | not read | always `"chunked"` |
| 2 | JSON | the match details |
| 3 | `parseInt`, decimal | your slot |

**Part 1.** Always the text `"chunked"` (`flash.js:6784`). The handler never reads it.

**Part 2, the match details.** Built at `flash.js:6674-6710`. The whole object becomes
`Multiplayer.match_details` (`:3347`), which other code reads later. The handler itself
reads:
- `joined_as_spectator`: whether you spectate (`:3354`); the lobby sets it when your slot
  is at or above `players_max` (`:6670`).
- `approved`: above 0 means an approved map (`:3358`).
- `game_type`: `DM`, `COOP` or `TDM`; anything else counts as DM (`:3359`, list at `:172`).
- `netcode`: above 1 turns on the newer netcode (`:3360`).
- `gameplay_modifications` (`:3362`), `title` (`:3368`), `map_id` (`:3369`, `:3371`).
- `slots_total`: the number of slots, `players_max + 16` (`:3364`).
- `p2p`, `p2p_region`: the region label, or "USA, Arizona" for the lobby (`:3380`).

`force_player_health` is only sent for an approved map; otherwise it is `null` (`:6707`).

**Part 3, your slot.** Read with `parseInt` (`flash.js:3344`) and becomes your slot
(`:3367`). Every later message that names "my slot" uses it.

#### Situations

- **Slot switch.** A switch inside the match sends no `MAP_CHUNK`, so the map already
  loaded is kept (`:3373`). The level still reloads.
- **Lobby-made moves.** `-swap`, a map change and the ping limit send a new one without you
  asking (see `JOIN_MATCH`).
- **For the local server's maintainer.** The details are what the client believes about
  the match. A wrong `slots_total` or `players_max` puts players and spectators in the wrong
  arrays on the client (`flash.js:3437-3440`).

### 22 · MAP_CHUNK — lobby → client

One piece of the map text. The lobby splits the map into pieces of 8000 characters and sends
them all just before `MATCH_JOIN_RESPONSE`. The client stores them and joins them when that
message arrives.

| | |
|---|---|
| Split | `flash.js:5639`, by `$ОIpМlM` at `:7458-7466` |
| Sent | `flash.js:6768-6778`, only when `JOIN_MATCH` part 4 asked for the map |
| Handled by the client | `flash.js:3268-3290` |
| Joined | `flash.js:3373-3377`, on `MATCH_JOIN_RESPONSE` |
| Ignored | by the lobby (`:3270-3271`) |

#### The console command

None. A client does not originate it: the lobby returns at once (`flash.js:3270-3271`).
The wire form, for reference:

```
MAP_CHUNK(<index>, <count>, "<8000 characters of map text>")
```

#### What real ones look like

Recorded with `netlog show`, as received. netlog decodes a number only when it contains a
control character (`showPart`, `src/console/kernel/net/codec.ts`). Index 29 and up are
printable digits, so they show as text: below, `"x"` is 116 and `"w"` is 115.

| Situation | As received |
|---|---|
| A small map, one piece | `MAP_CHUNK(0, 1, "<player uid=\"#player\" x=\"650\" y=\"-120\" …")` |
| A big map, first piece | `MAP_CHUNK(0, "x", "<player uid=\"#player*0\" x=\"7325\" y=\"-1825\" …")` |
| The same map, piece 29 | `MAP_CHUNK(" ", "x", "n_text\" actions_4_targetB=\"0\" …")` |
| The same map, last piece | `MAP_CHUNK("w", "x", "get=\"#trigge…")` |

The big map was 116 pieces, about 928 000 characters. They arrived in 1.1 s, and
`MATCH_JOIN_RESPONSE` came 31 ms after the last one.

#### How it works

1. **The lobby splits the map once**, when the match gets its map (`flash.js:5637-5639`).
2. **On a join that asked for the map**, it sends every piece in order (`:6768-6778`).
3. **The client stores each piece** at its index (`:3273-3283`). If no buffer exists, or
   the count differs from the buffer's length, it starts a new buffer (`:3277-3281`). It
   shows "Downloading map: N%" (`:3289`).
4. **`MATCH_JOIN_RESPONSE` joins the pieces** into the map text and clears the buffer
   (`:3373-3377`). If the text starts with `<q.`, the level loader unpacks it first
   (`frame2.js:10612-10615`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the piece index, from 0 |
| 2 | number | the number of pieces |
| 3 | string | the piece's text |

**Part 1, the index.** Where the piece goes in the buffer (`flash.js:3283`). The progress
text uses it as `(index + 1) / count` (`:3289`).

**Part 2, the count.** Sizes the buffer. A count that differs from the current buffer's
starts a new, empty buffer (`:3277-3281`). A piece from another map download therefore
throws away the pieces stored so far.

**Part 3, the text.** 8000 characters, or fewer for the last piece (`flash.js:7460-7464`).
It is stored as it came. Nothing checks it before the level loads it.

#### Situations

- **A missing piece.** `Array.join` writes an empty string for a missing index, so the map
  would be silently cut. Reliable messages are applied strictly in order
  (`connection.js:909`), so on a working connection every piece arrives before
  `MATCH_JOIN_RESPONSE`.
- **No map.** A switch inside the same match sends no pieces; the buffer stays empty and the
  map already loaded is kept.
- **For the local server's maintainer.** The map bot uses this message to fetch a map from
  the official lobby ([map_bot](../features/map-bot.md)). The text is what the site's map
  download returns.

### 23 · CLIENT_READY_FOR_FIRST_SYNC — client → lobby

"My level is loaded." The match server then marks the player as ready and sends a
`FIRST_SYNC_RESPONSE` for every occupied slot, the player's own included. It has no parts
and no answer.

| | |
|---|---|
| Built | `frame2.js:14371`, once the multiplayer level is loaded |
| Handled by the match server | `flash.js:3395-3419` |
| Sent on | the match connection: the lobby, or the hoster in a p2p match (`frame2.js:14370`) |
| Allowed while spectating | yes (`flash.js:1740`) |

#### The console command

```
js pb.event("CLIENT_READY_FOR_FIRST_SYNC")
```

The same message the game sends. The match server sends a `FIRST_SYNC_RESPONSE` for every
occupied slot again, and the client copies those fields onto its players again.

#### What real ones look like

As sent, with `netlog show`:

```
CLIENT_READY_FOR_FIRST_SYNC()
```

It comes about 0.5 s after `MATCH_JOIN_RESPONSE`, while the level loads, and in the same
packet as the first `MY_PLAYER_PROPERTIES_CHANGED`. The burst of `FIRST_SYNC_RESPONSE`s
follows about one round trip later.

#### How it works

1. **The client sends it** when the level is loaded (`frame2.js:14355-14374`). First it
   handles the match messages that arrived while the level was loading (`:14365-14368`).
   Then it sends this message, and from then on it sends its own state each frame (`:14374`,
   checked at `flash.js:441`).
2. **The match server checks** that the sender is in a match, and that it is not a
   lobby-side message for a p2p match (`flash.js:3397-3400`).
3. **It marks the player ready** (`$HеeТTA`, `:3402`). Until then the server ignores that
   player's state (`:886-887`) and refuses gun slot changes (`:3616`).
4. **It sends one `FIRST_SYNC_RESPONSE` per occupied slot** to this player (`:3405-3416`),
   with part 3 empty, so the client shows no "connected" lines for them.

#### Situations

- **Sent twice.** Each copy gets the full burst again. Nothing breaks: the client copies
  the same fields again.
- **Never sent.** If a level fails to load, the player keeps a slot, but the server
  ignores their state and other clients see no movement from them.
- **For the local server's maintainer.** A client that joined but never became ready shows
  `JOIN_MATCH` and `MATCH_JOIN_RESPONSE` in `netlog show`, with no
  `CLIENT_READY_FOR_FIRST_SYNC` after them.

### 24 · FIRST_SYNC_RESPONSE — lobby → client

One slot's player: who they are and their fields, or that the slot is now empty. The match
server sends it in three cases: the burst after `CLIENT_READY_FOR_FIRST_SYNC`, a new player
joining, and a player leaving. This is where a client gets every other player's `login`,
`nickname` and `auth_id` ([player-info](../features/player-info.md)).

| | |
|---|---|
| Sent | `flash.js:3408-3416` (the burst), `:6797-6804` (a join, lobby-hosted only), `:6869-6880` (a leave) |
| Player fields | `connection.js:636-666`, lists at `flash.js:200-221` |
| Handled by the client | `flash.js:3421-3509` |
| Ignored | by the lobby (`:3423-3424`); in a p2p match, if it does not come from the lobby (`:3426-3427`, `:1836-1862`) |

#### The console command

None. A client does not originate it: the lobby returns at once (`flash.js:3423-3424`).
The wire form, for reference:

```
FIRST_SYNC_RESPONSE(<slot>, <player JSON or "">, "<"1" or "">")
```

#### What real ones look like

Recorded with `netlog show`, as received. Names and ids are replaced. `"…"` stands for
`"slot1":-1` through `"slot9":-1`.

| Situation | As received |
|---|---|
| The burst: another player | `FIRST_SYNC_RESPONSE(0, {"respawns":1,"kills":0,"deaths":0,"nickname":"player1","login":"player1","auth_id":<auth id>,"team":1,"skin_snapshot":"<skin>","slot0":-1,…,"curwea":-1}, "")` |
| The burst: yourself | `FIRST_SYNC_RESPONSE(1, {"respawns":0,"kills":0,"deaths":0,"nickname":"player2","login":"player2","auth_id":<auth id>}, "")` |
| The burst: a spectator | `FIRST_SYNC_RESPONSE(8, {"nickname":"player3","login":"player3","auth_id":<auth id>,"reputation":<reputation>}, "")` |
| A player joins | `FIRST_SYNC_RESPONSE(4, {"respawns":0,"kills":0,"deaths":0,"nickname":"player4","login":"player4","auth_id":<auth id>,"team":-123,"skin_snapshot":"",…,"curwea":-1}, "1")` |
| A player leaves | `FIRST_SYNC_RESPONSE(1, "", "1")` |

A joining player has team `-123` and no skin: the lobby has not had their
`MY_PLAYER_PROPERTIES_CHANGED` yet. It arrives a moment later.

#### How it works

1. **The match server builds the player JSON** with `$АIpНН` (`connection.js:636-666`):
   - a spectator: `nickname`, `login`, `auth_id`, `reputation` (`flash.js:200-202`);
   - a player: `respawns`, `kills`, `deaths`, `nickname`, `login`, `auth_id`
     (`:203-205`), plus `team`, `skin_snapshot`, `slot0`…`slot9`, `curwea` (`:216-221`),
     except in your own copy in the burst (`flash.js:3413`): your client knows those itself.
2. **It sends it** in the three cases in the table above. The join announcement goes to
   every slot but the joiner (`$Мpcp0H`, `:6829-6841`), and only in lobby-hosted matches
   (`:6790-6805`). The leave goes to everyone else (`:6869-6880`).
3. **The client finds the player** (`flash.js:3429-3440`): below `players_max`, the
   character in that slot; from `players_max` up, a spectator record, made if missing
   (`frame2.js:8239-8257`).
4. **A non-empty part 2 connects the slot** (`flash.js:3448-3492`): the character is marked
   as a connected player and shown. Every JSON field is copied onto it; `skin_snapshot`
   goes through the skin loader (`:3461-3474`).
5. **An empty part 2 empties the slot** (`:3494-3508`): hidden, HP 0, and "X left the
   game" or "X is no longer spectating".

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the slot |
| 2 | JSON, or empty | the player's fields; empty means the slot is now empty |
| 3 | string, empty or not | announce it in chat |

**Part 1, the slot.** Base-N (`flash.js:3429`). Below `players_max` it is a character slot
(`$0Ме1А`), above a spectator slot (`$HрТМc`, `frame2.js:4691-4692`).

**Part 2, the player's fields.** JSON (`flash.js:3459`). Every key is copied onto the
player object (`:3472`). On a character, a key the object does not have throws
"Player property … does not exist" (`:3463-3464`). The client reports the error and goes
on (`connection.js:917-921`). A spectator record takes any key. The lobby only sends the
keys listed above; the copy itself has no list.

If the character in that slot was a map actor and not a player slot, the client says
"Error: Player connects into actor slot. Converting actor into player" and converts it
(`flash.js:3453-3457`).

**Part 3, announce.** Any text means yes (`flash.js:3433`). The join and leave messages
send `"1"`; the burst sends `""`. When set on a connect, chat shows "X connected" or "X is
spectating" (`:3478-3487`). The client also runs the map's join trigger, if the map set one
with trigger action 228 (`:3490-3491`, `actions.js:3193`). For a player, the joining slot
becomes that trigger's player (`$Oр0ol`, `:3487`; inferred from its use as the trigger's
player elsewhere). This part is **not** the spectator flag; a spectator is known by its slot.

#### Situations

- **The joiner never sees "X connected" for players already there.** The burst has part 3
  empty. Only those already in the match see the joiner announced.
- **A slot switch** shows as a leave and a join: "X left the game", then "X is spectating".
- **For a map author.** A map's join trigger runs on every client for each announced
  connect, players and spectators, but not for the players already there when you join.
- **For the local server's maintainer.** `kills` can be negative in recordings (teammate
  kills subtract, see `HIT_PLAYER`). `accounts` in the console reads the fields this message
  wrote ([player-info](../features/player-info.md)).

### 25 · MY_PLAYER_PROPERTIES_CHANGED — client → match server → every other client

Your own player's synced fields: team, skin, the ten gun slots and the gun in hand. The
client sends only the fields that changed since the last send. The match server checks the
gun fields, stores what it accepts, and passes it on to everyone else with your slot in
front.

| | |
|---|---|
| Built | `flash.js:597-625`, each frame, after the first sync |
| Checked by the match server | `flash.js:3526-3644` |
| Relayed | `flash.js:3687-3693`, to every slot but the sender (`$Мpcp0H`, `:6829-6841`) |
| Corrected | `connection.js:491-505` writes the server's value back to the sender |
| Applied by every receiver | `flash.js:3649-3684` |
| Not allowed | while spectating (`flash.js:1929-1933`); the client does not send it then (`:437`) |

#### The console command

```
js pb.event("MY_PLAYER_PROPERTIES_CHANGED", pb.num(12), JSON.stringify(-1))
```

The pair the game sends when you put your gun away: property 12, `curwea`, value `-1`. The
parts are pairs, **property index, JSON value**, with no slot in front. The game remembers
what it last sent (`flash.js:605-620`). It does not resend a value it thinks the server
has, so a crafted pair can leave the others seeing something your client does not.

#### What real ones look like

Recorded with `netlog show`. The index is a base-N number, decoded. The value is JSON text,
so it shows as a string. A received one has the sender's slot in front.

| Situation | As sent |
|---|---|
| Right after joining: all 13 | `MY_PLAYER_PROPERTIES_CHANGED(0, "2", 1, "\"----~marine~1~1~1~1~1~1~1~1~1~1~1~1~1~1\"", 2, "-1", 3, "-1", 4, "-1", 5, "-1", 6, "-1", 7, "-1", 8, "-1", 9, "-1", 10, "-1", 11, "-1", 12, "-1")` |
| Picking up gun 0 into `slot4` and holding it | `MY_PLAYER_PROPERTIES_CHANGED(6, "0", 12, "0")` |
| Picking up gun 15 into `slot6` | `MY_PLAYER_PROPERTIES_CHANGED(8, "15", 12, "15")` |
| Putting the gun away | `MY_PLAYER_PROPERTIES_CHANGED(12, "-1")` |
| Dropping guns | `MY_PLAYER_PROPERTIES_CHANGED(7, "-1", 8, "-1", 12, "-1")` |

| Situation | As received |
|---|---|
| A player joined: team and skin | `MY_PLAYER_PROPERTIES_CHANGED(6, 0, "7", 1, "\"<skin>\"")` |
| Slot 4 holds gun 4 | `MY_PLAYER_PROPERTIES_CHANGED(4, 12, "4")` |
| Slot 1 has gun 14 in `slot6` | `MY_PLAYER_PROPERTIES_CHANGED(1, 8, "14")` |

The joiner sent all 13 pairs, but the others received two. The server drops a pair whose
value it already has (`flash.js:3580-3581`), and the empty gun slots were already `-1`.

#### How it works

1. **The client builds it** each frame while it plays (`flash.js:428-441`): not while
   spectating, and only after `CLIENT_READY_FOR_FIRST_SYNC` (`frame2.js:14374`). For each
   of the 13 properties it compares your character's value with the last value sent
   (`flash.js:598-623`), and sends the ones that differ (`:624-625`).
   `MATCH_JOIN_RESPONSE` forgets the last values (`:3324-3325`), so the first send after a
   join carries all 13.
2. **The match server checks it** (`flash.js:3532-3644`). The sender must be in a match
   (`:3535`). In a p2p match the lobby ignores it (`:3538`). For each pair it reads the
   index and parses the value (`:3569-3570`), skips a value equal to the stored one
   (`:3580-3581`), then by property:
   - `curwea`: accepted if it is `-1` or a gun in one of your ten slots (`:3588-3604`);
     otherwise your old value is sent back to you (`:3608`).
   - `slot0`…`slot9`: refused if another player already has that gun, or if you are not
     ready yet (`:3616`). A refusal sends your old value back to you, then tells you who has
     the gun (`:3621-3625`). Accepted, it updates which slot owns which gun
     (`:3629-3636`).
   - `team`, `skin_snapshot`: stored with no check (`:3639-3642`).
3. **It relays only the accepted pairs**, with your slot in front, to everyone else in the
   match (`:3687-3693`). A message with nothing accepted is not relayed.
4. **A correction** is the same message from the server: `[<slot>, <index>, <value>]`
   (`connection.js:491-505`). For your own slot it puts your value back.
5. **Each receiver applies it** (`flash.js:3540-3684`). In a p2p match it must come from the
   hoster (`:3544-3545`). Before the level runs, it is queued and handled at load
   (`:3547-3550`, `frame2.js:14365-14368`). The slot picks the player, spectators first
   (`flash.js:3553-3555`). Then, by property:
   - gun slots and `curwea`: set only if the value is `-1` or a gun that exists on this
     client's map (`$AО1оОА`, `frame2.js:8261-8267`); `curwea` also redraws the gun
     (`flash.js:3659-3665`);
   - `team`, `skin_snapshot`: set only if the type matches the old value; a different type is
     ignored with a trace (`:3669-3675`); `team` also updates the player's team (`:3677-3678`).

#### Field by field

Parts come in pairs from part 1 on; a received one has the sender's slot as part 1.

| Index | Property | Value |
|---|---|---|
| 0 | `team` | a team number |
| 1 | `skin_snapshot` | the skin, as text |
| 2-11 | `slot0`…`slot9` | the gun in that slot, or `-1` |
| 12 | `curwea` | the gun in hand, or `-1` |

The list is `$ММ.$АooHс` (`flash.js:216-221`).

**The index.** A base-N number (`flash.js:3569`). An index outside 0-13 skips the pair
(`:3572`). The check uses `<=`, so 13 passes and finds no property. On the match server,
`prop.substring` then throws (`:3612`). On the lobby an error in a message disconnects the
sender, after the chat line "Server: Reliable messsage error from …"
(`connection.js:922-930`, `flash.js:403-407`).

**The value.** JSON text, parsed with `JSON.parse` (`flash.js:3570`). Text that is not JSON
throws, with the same result: the lobby disconnects the sender. A `pb.num(...)` value is
not JSON, so it disconnects.

**`team`.** Stored as sent (`flash.js:3641`). A join starts at `-123` (`:6751`, `$АOрAO1`,
`:288`) until this message brings the real team. Spectators are team 17 (`$HА1co`, `:287`).
The match code skips team `-123` and team 17 in its ping-limit pass (`:6144-6148`).

**`skin_snapshot`.** The skin, as a `~`-separated text; the default marine is
`----~marine~1~1~1~1~1~1~1~1~1~1~1~1~1~1`. Stored with no check; receivers need a string.

**`slot0`…`slot9`.** A gun's index in the map's gun list (inferred: receivers check it
against that list, `frame2.js:8264`), or `-1` for empty (`$ММ.$pTcHМ`, `flash.js:251`).
The match server keeps one owner per gun (`$O0OOoТ`, `:3614`, `:3629-3633`). Two players
cannot both have the same gun on the server.

**`curwea`.** The gun in hand: `-1`, or a gun that is also in one of your slots
(`flash.js:3591-3599`). Each receiver redraws that player's gun (`:3664`).

#### Situations

- **Two players pick up the same gun.** The server takes the first message. The second
  player gets their old slot value back and is told which slot has the gun
  (`flash.js:3621-3625`). On their screen the gun moves to the other player.
- **Joining.** Your first send comes in the same packet as `CLIENT_READY_FOR_FIRST_SYNC`,
  right after it, so you are ready when the gun slots are checked.
- **Spectators** cannot send it: the lobby answers "Action of type … is not compatible with
  spectator mode" (`flash.js:1929-1933`).
- **A receiver has a different map version.** A gun index that does not exist on that
  client is ignored there (`frame2.js:8264`). That client shows the player without the gun.
- **For the local server's maintainer.** `src/server/` runs this handler from the decoded
  `flash.js`. A player disconnected right after "Reliable messsage error" sent a pair that
  did not parse. To see who holds which gun, compare the relayed pairs with
  `FIRST_SYNC_RESPONSE`.

### 26 · PING — lobby → client, answered; client → lobby only as the scan report

Two uses. The lobby sends it to a quiet client every 3 s or so, so that it has an
acknowledgement to time; the client answers with an empty `RESPONSE`. The client sends it
for one thing only: the anti-tamper scan's report, with the text `"undefined"` where the
reply id goes. The lobby never answers a client's ping.

| | |
|---|---|
| Sent by the lobby | `flash.js:855-864`, to each client in a lobby-hosted match |
| Answered by the client | `flash.js:3076-3077` |
| Sent by the client | `main.js:1037-1038`, the scan report only |
| Handled by the lobby | `flash.js:3068-3074`: the report goes to the anti-cheat; anything else is dropped |
| The round trip | measured from acks of every reliable message (`connection.js:1019-1049`) |

#### The console command

```
js pb.C().ping
```

The ping the client measured on the lobby connection, in ms: the time the last reliable
message took to be acknowledged (`connection.js:1047-1048`).

```
js pb.req("PING", ["REPLY"])
```

This one never resolves. The lobby drops a client's ping that is not a report
(`flash.js:3068-3074`), so it is no use as a ping.

#### What real ones look like

Recorded with `netlog show`. All 455 recorded `PING`s are received ones.

| Situation | Line |
|---|---|
| The lobby's ping, first request on the connection | received `PING("h")` (reply id 100) |
| A later one | received `PING(124)` |
| The client's answer | sent `RESPONSE(100)`, 27 ms later |

The scan report, as `main.js` builds it (no recording, the scan did not fire):

```
PING("undefined", "3", "<detail>")
```

#### How it works

1. **The lobby pings quiet clients.** Each state tick, for each client in a lobby-hosted
   match, it checks a timer (`flash.js:855-857`). Every 3 s plus up to 100 ms, if no ack has
   been timed in the last 3 s, it sends `PING` with a reply id and an empty callback
   (`:859-863`).
2. **The client answers** with an empty `RESPONSE` (`flash.js:3076-3077`).
3. **The ping is measured from acks, not from this answer.** Each side times every reliable
   message from send to ack (`connection.js:1019-1027`). The lobby averages the last 3 s
   (`:1043-1046`); the client keeps the latest (`:1047-1048`). The `PING` exists so a quiet
   connection still has a message to time.
4. **The scan report.** When the anti-tamper scan fails, the client sends
   `[RELIABLE_PING, undefined, <code>, <detail>]` on the lobby connection
   (`main.js:1037-1038`), then reloads 300 ms later (`:1041-1045`). The sender turns
   `undefined` into the text `"undefined"` (`connection.js:101-102`).
5. **The lobby hands the report to the anti-cheat** (`flash.js:3070-3071`), with the code
   as a decimal number and the detail as text, and answers nothing.

#### Field by field

| Part | From the lobby | From a client |
|---|---|---|
| 1 | reply id | `"undefined"` |
| 2 | — | the scan code, decimal |
| 3 | — | the detail |

**Part 1.** From the lobby, the reply id; the client answers to it (`flash.js:3076`). From
a client, the lobby compares it with the text `"undefined"` (`:3070`). Anything else is
dropped with no answer (`:3073`).

**Part 2, the code.** Read with `parseInt` (`flash.js:3071`). It is `1`, `2` or `3`, the
kind of scan failure ([scan-gating.md](scan-gating.md),
[scan_bypass](../features/scan-bypass.md#the-scan-report)).

**Part 3, the detail.** Text, passed on as it came (`flash.js:3071`). For code 3 it is the
index of the array that changed.

#### Situations

- **Ping limit.** The lobby compares its averaged ping with the match's `ping_limit`
  (`flash.js:6153`). Over the limit for 2.5 s in total, the player is moved to spectators,
  or excluded, by `ping_limit_action` (`:6161-6212`). This `PING` keeps that number fresh
  when a player sends little.
- **A spectator's scan report is refused.** `PING` is not on the spectator list
  (`flash.js:1730-1753`), so the lobby answers "Action of type … is not compatible with
  spectator mode" and drops it (`:1929-1933`).
- **Single-player.** With no lobby connection the scan sends nothing (`main.js:1037`).
- **For the local server's maintainer.** `src/server/` supplies the anti-cheat function
  this handler calls. It logs "Anti-cheat report about …: code N", and kicks the player
  when `cheat_reports` is `"kick"` (`src/server/game.ts:230-234`). The default is `"log"`
  (`src/server/constants.ts:14`).

### 27 · REPORT_USER — client → lobby

A player marks another account as "unsuitable for the Plazma Burst 2 community". The client
sends only the target's auth id. The lobby checks that the id is online and is not the
sender, then hands the pair to its account module, which decides what changes. The answer is
one chat line.

| | |
|---|---|
| Built | `HUD.js:2066`, by the report button of a player row: the match scoreboard (`frame18.js:1167`), the lobby's match list (match owner) and relations list (`MPLobby.js:353`, `:362`), and the match logs (`MPLogs.js:303`) |
| Handled by the lobby | `flash.js:2845-2930`, the branch it shares with `ENDORDSE_USER`, `KICK_USER` and `BAN_USER` |
| Decided by | the account module's `$HpААоe(target, initiator)` (`:2879`), which is not in the game files ([reputation.md](reputation.md#the-account-module)) |
| Answered | `RESPONSE [<reply id>, <chat string>]` (`:2929`); the client prints it with `ChatNewMsg` (`HUD.js:2068`) |
| Relayed | never |
| Only with | a logged-in lobby connection (`flash.js:1916-1926`). Allowed while spectating (`:1730-1753`). Not gated on being in a match. |

#### The console command

```
js pb.req("REPORT_USER", ["<auth id>", "REPLY"])
js pb.req("REPORT_USER", ["<your own auth id>", "REPLY"])
```

The first is what the button sends. The second checks an id: the lobby answers
`Error: Can't do this to yourself` before the module is called (`flash.js:2871`). Use your own
accounts only. The auth id is the one `accounts` prints ([player-info](../features/player-info.md)).

#### What real ones look like

No report is in the recordings. The request below is built from `HUD.js:2066`; the answers
are recorded on `ENDORDSE_USER`, which runs the same lines up to the module call.

| Situation | Line |
|---|---|
| The button's request, as sent | `REPORT_USER("<auth id>", "j")` |
| Answer when the id is your own, this repo's server | `RESPONSE(109, "Error: Can't do this to yourself")` |
| Answer when the id has no record, official lobby | `RESPONSE(105, "Error: Target user wasn't online for too long")` |
| Answer from this repo's server (`src/server/game.ts:156`) | `RESPONSE(<reply id>, "Server: This server keeps no reputation; nothing was changed")` |

The target goes as decimal text, not in the base-N digits: the client turns the number into
a string (`connection.js:99-102`), and the lobby reads it with `parseInt`. The reply id is a
base-N number, so netlog prints it as the letter it is (`"j"` is 102).

#### How it works

1. **The client builds it.** The button sends `[REPORT_USER, auth_id, placeholder]` straight
   on the lobby connection (`HUD.js:2066`). The connection swaps the placeholder for its
   counter (`connection.js:693-709`).
2. **The lobby gates it.** A connection that has not logged in may send only `AUTHENTICATE`
   and `RESPONSE` (`flash.js:1916-1926`). A spectator may send this one (`:1930`,
   `:1730-1753`). Nothing checks that the sender is in a match.
3. **The lobby finds the target.** `parseInt(parts[1])` (`:2851`) is looked up in the module's
   map from auth id to record, `$IIрМeT` (`:2855`). No record: the answer is
   `Error: Target user wasn't online for too long` (`:2927`).
4. **It refuses yourself.** The sender's own id comes from the module's map keyed by the
   connection, `$1OoOН` (`:2865-2869`). The same id answers `Error: Can't do this to yourself`
   (`:2871-2872`). The client never says who it is.
5. **The module decides.** `$HpААоe(target, initiator)` returns the chat string (`:2879`).
6. **The lobby logs it** as `RELIABLE_REPORT_USER*<target login>*<target nickname>` unless the
   answer starts with `Error: ` (`:2920-2923`).
7. **The client shows it.** It prints the answer (`HUD.js:2068`). In a match whose
   `min_reputation` is 0 or less, against a target already at 0 reputation, it adds a note that
   the report changes nothing here (`:2072-2076`). If your own reputation is above 0, it offers
   to send `-min_reputation 1 -recheck <slot>` in chat (`:2079-2109`).

#### Field by field

| Part | Read as | Meaning | Sent as |
|---|---|---|---|
| 1 | decimal text, `parseInt` | the target's auth id | the row's `auth_id` |
| 2 | string, echoed | reply id | the connection's counter, base-N |
| 3 | `=== "1"` | read for the whole family (`:2857`), used only by `KICK_USER` | not sent |

**Part 1, the target's auth id.** `parseInt` (`flash.js:2851`), so `"1042"`, `" 1042"` and
`"1042abc"` are the same id. The id belongs to the module's login record, not to the account:
on the official lobby the same account was seen with a new id after joining again
([reputation-probe.md](reputation-probe.md#observed-so-far)). On this repo's server it is a
counter given at each login (`src/server/game.ts:184`, `:192-193`). The lookup is global
(`:2855`): the target need not be in your match, or in any match.

**Part 2, the reply id.** Echoed unchanged into the `RESPONSE` (`flash.js:2853`, `:2929`). Every
path answers once, including the refusals.

**Part 3.** Not sent by the button. The branch reads it for all four messages (`:2857`), but only
the kick passes it on (`:2900`, `:2910`). Here it changes nothing.

There is no amount, reason or text part. The size of a report's effect is the module's.

#### Situations

- **Reporting from the lobby.** The match list offers the report on a match's owner, and the
  relations list on the other side of a relation (`MPLobby.js:353-370`). The handler has no
  "in a match" gate, so these work outside any match.
- **A stale id.** A player who left long enough ago has no record, and the answer is
  `wasn't online for too long`. Nothing is logged and nothing changes (`flash.js:2927`). A
  record whose connection has no profile still resolves: the log then names
  `- disconnected user -` (`:2876`).
- **No throttle.** The branch has no time gate, unlike `CREATE_MATCH` (`:2671`) or `CHAT`
  (`:4016-4019`). Every message is another call into the module.
- **Report and the match minimum.** A report lowers reputation only as the module decides.
  What keeps a player out of a match is the match's `min_reputation`, checked at join time
  (`:6573`). That is why the client offers `-min_reputation 1` after reporting a player at 0.
- **The match logs screen.** Its row passes no slot (`MPLogs.js:379-381`). If you are in a
  match whose minimum is 0 or less, the client's after-report check reads the reputation of
  an undefined player (`HUD.js:2070-2074`) and throws after the chat line is printed. The
  report itself has already been handled.
- **For the local server's maintainer.** `src/server/` answers with
  `Server: This server keeps no reputation; nothing was changed` (`src/server/game.ts:156`,
  `src/server/text.ts:47`), after the same checks from the decoded `flash.js`.

### 28 · ENDORDSE_USER — client → lobby

The opposite of a report: a player marks another account as "a good fit". The message and
the lobby's handling are the same as `REPORT_USER`'s. Only the module call differs:
`$peеHeН(target, initiator)` (`flash.js:2882`). The name's spelling is the game's.

| | |
|---|---|
| Built | `HUD.js:2128`, by the endorse button of the same player rows as the report |
| Handled by the lobby | `flash.js:2845-2930`, shared with `REPORT_USER` |
| Decided by | the account module's `$peеHeН` (`:2882`) |
| Answered | `RESPONSE [<reply id>, <chat string>]` (`:2929`), printed in chat (`HUD.js:2130`) |
| Relayed | never |
| Only with | a logged-in lobby connection; allowed while spectating (`flash.js:1730-1753`) |

#### The console command

```
js pb.req("ENDORDSE_USER", ["<auth id>", "REPLY"])
js pb.req("ENDORDSE_USER", ["<auth id>", "REPLY", "11"])
```

The second adds a fourth part. The lobby never reads it for this message, and the live lobby
answered it exactly like a plain send. Each send toggles the relation on the live lobby (see
below), so send an even number to leave the target as it was. Own accounts only; the full
sequence is in [reputation-probe.md](reputation-probe.md).

#### What real ones look like

From `netlog show`, with ids and nicknames replaced. Requests as sent, answers as received.

| Situation | Line |
|---|---|
| A plain endorsement | `ENDORDSE_USER("<auth id>", "j")` |
| With an ignored fourth part | `ENDORDSE_USER("<auth id>", "v", "11")` |
| Accepted, official lobby | `RESPONSE(102, "Server: <font color=\"#fff998\"><nickname></font> is endorsed for <font color=\"#fff998\">1</font> month")` |
| The next one to the same account | `RESPONSE(103, "Server: Relationship with <font color=\"#fff998\"><nickname></font> was reset to neutral (default)")` |
| Your own id, this repo's server | `RESPONSE(109, "Error: Can't do this to yourself")` |
| An id with no record | `RESPONSE(105, "Error: Target user wasn't online for too long")` |

On the official lobby each answer took about 210-320 ms. The self refusal on the local server
took 3 ms.

#### How it works

The steps are those of `REPORT_USER` (gate, lookup at `flash.js:2855`, self check at `:2871`, log
at `:2920-2923`, answer at `:2929`). Two things differ:

1. **The module call** is `$peеHeН` (`:2882`).
2. **The client does nothing more** than print the answer and refresh the list it came from
   (`HUD.js:2130-2133`). There is no reputation note, unlike the report.

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | decimal text, `parseInt` | the target's auth id |
| 2 | string, echoed | reply id |
| 3 | `=== "1"` | read, then unused for this message |

The parts are those of `REPORT_USER`; see there. A fourth or later part is never read.

#### Situations

- **Endorsing twice resets it.** On the live lobby, five sends to one target alternated
  "is endorsed for 1 month" and "reset to neutral" ([reputation-probe.md](reputation-probe.md#observed-so-far),
  not derivable from `game/`). An odd number of sends flips the relation, and an even number
  leaves it as it was.
- **The term, not the amount.** The answer names how long the relation lasts ("1 month"),
  which matches the `Until` column of the lobby's Relations screen. The reputation each side
  gains or pays is not shown anywhere.
- **No throttle.** Five sends about 250 ms apart were all answered on the live lobby, and the
  branch has no time gate (`flash.js:2845-2930`).
- **Endorsing a match owner from the lobby** works like reporting one: the match list row
  carries `match_owner_auth_id` (`MPLobby.js:355`).
- **For the local server's maintainer.** `src/server/` answers
  `Server: This server keeps no reputation; nothing was changed` (`src/server/game.ts:157`).

### 29 · KICK_USER — client (match owner or staff) → lobby

Removes a player from the sender's match and puts them on that match's ban list. Any client
can send it. The lobby carries it out only for staff, or for the match's owner when the owner
is not a guest. The answer is one chat line.

| | |
|---|---|
| Built | `HUD.js:2033`, by the "Permanently exclude player from match" button of a scoreboard row (`frame18.js:1167`) or a match-log row (`MPLogs.js:379`); the lobby lists hide it (`HUD.js:2041-2042`) |
| Handled by the lobby | `flash.js:2845-2930`, the branch at `:2892-2917` |
| Carried out by | the match's `$lI0ОНO` (`:7183-7227`) |
| Answered | `RESPONSE [<reply id>, <chat string>]`, printed in chat (`HUD.js:2035`) |
| Relayed | never; the target gets a `SERVICE_MESSAGE` and is moved out of the match (`flash.js:7222-7226`) |
| Only with | the sender in a match (`:2894-2895`); allowed while spectating (`:1730-1753`) |

#### The console command

```
js pb.req("KICK_USER", ["<auth id>", "REPLY", "0"])
js pb.req("KICK_USER", ["<guest's auth id>", "REPLY", "1"])
```

The first is what the button sends for any account. The second is "Ban all guests", the
choice the client offers only when the target is a guest (`HUD.js:2016-2026`).

#### What real ones look like

No kick is in the recordings. These lines are built from `HUD.js:2033` and the answers
from `flash.js:2899-2917`.

| Situation | Line |
|---|---|
| Kick an account, as sent | `KICK_USER("<auth id>", "j", "0")` |
| Kick one guest, as sent | `KICK_USER("<auth id>", "j", "0")` |
| Kick a guest and keep every guest out, as sent | `KICK_USER("<auth id>", "j", "1")` |
| Staff sender | `RESPONSE(102, "Server: User has been successfully excluded using staff permissions")` |
| Owner sender | `RESPONSE(102, "Server: User has been successfully excluded using match owner permissions")` |
| Owner sender, staff target | `RESPONSE(102, "Server: Unable to exclude Plazma Burst 2 staff member")` |
| Anyone else | `RESPONSE(102, "Server: This option is only available to non-guest match owners. You can mark user as unsuitable or start your own match instead")` |
| Sender in no match | `RESPONSE(102, "Error: Not in a match")` |

#### How it works

1. **The client builds it.** The button sends `[KICK_USER, auth_id, placeholder, "1" or "0"]`
   (`HUD.js:2033`). For a guest target it first asks "Ban all guests from this match?":
   "Ban all guests" sends `"1"`, "Ban only this guest" sends `"0"` (`:2016-2026`). Any other
   target gets `"0"` (`:2029`).
2. **The lobby finds the target and refuses yourself**, as for `REPORT_USER`
   (`flash.js:2851-2872`).
3. **It picks the match.** The match is the *sender's* (`connection.$eоIIH`, `:2894`), not the
   target's. No match: `Error: Not in a match` (`:2917`).
4. **It checks the sender.** Staff pass (`:2897-2900`). Otherwise the sender must own the
   match, and the owner's uid must not be the shared guest uid `$ММ.$НТpAНT` (850431,
   `:249`, `:2903`). An owner cannot exclude staff (`:2905-2906`).
5. **The match excludes the target** (`$lI0ОНO`, `:7183-7227`):
   - A staff target is refused unless the sender is staff, and is told who tried
     (`:7185-7202`).
   - The target's uid goes on the match's ban list `$АpеОрН` (`:7208`). For a guest, it does
     only when part 3 is `"1"` (`:7204`), and since every guest shares one uid, that bars
     every guest.
   - The target's address, device id and account key always go on the list
     (`:7211-7219`).
   - If the target is in this match, they get the reason as a `SERVICE_MESSAGE` and leave it
     at once (`:7222-7226`; the forced leave is `connection.js:506-540`). They stay connected
     to the lobby.
6. **The lobby logs it** as `RELIABLE_KICK_USER*<login>*<nickname>` unless the answer starts with
   `Error: ` (`flash.js:2920-2923`). The refusal for non-owners starts with `Server: `, so it is
   logged too.

#### Field by field

| Part | Read as | Meaning | Sent as |
|---|---|---|---|
| 1 | decimal text, `parseInt` | the target's auth id | the row's `auth_id` |
| 2 | string, echoed | reply id | the connection's counter |
| 3 | `=== "1"` | also bar the guest uid | `"1"` or `"0"` |

**Part 1, the target's auth id.** Looked up in the module's global map (`flash.js:2855`), so the
target need not be in your match. A target elsewhere is not moved: they are only put on your
match's ban list, by address, device and account key (`:7211-7219`, `:7222`). A record whose
connection has no profile (a player who left) gets no uid entry (`:7185`), but still gets the
other three.

**Part 2, the reply id.** Echoed into the answer (`:2929`).

**Part 3, bar all guests.** Compared with `"1"` (`:2857`) and passed to `$lI0ОНO` (`:2900`,
`:2910`). It matters only for a guest target (`:7204-7208`): `"1"` adds the guest uid, so the
join check then refuses every guest with "Access for guests has been restricted via match ban
list" (`:6599-6603`). For an account, the uid is added whatever part 3 says. Any value other
than `"1"` counts as `"0"`.

#### Situations

- **The ban list is per match.** The join check reads it at `:6599-6627`: uid, then address,
  device id, account key. Players on another connection from the same address are refused too,
  with "Similar user has been restricted via match ban list" (`:6609-6612`). Staff skip the
  whole check (`:6568-6570`).
- **Undoing it.** The owner or staff can clear the list with `-unbanall` in chat
  (`:4974-4981`). There is no message that removes one entry.
- **Who sees the button.** Every scoreboard row shows it, to every player. The lobby, not the
  client, decides; the tooltip says "Only non-guest match owners can perform this action"
  (`HUD.js:2010`).
- **A guest owner** cannot kick: their uid is the guest uid, and `:2903` rejects it.
- **Staff against staff.** A staff sender may exclude a staff member: the owner path refuses
  (`flash.js:2905`), but the staff path calls `$lI0ОНO`, which lets a staff initiator through
  (`:7189-7191`).
- **Player-hosted matches.** The message still goes to the lobby, which acts on its own record
  of the sender's match. Whether that reaches the host's copy was not traced.
- **For the local server's maintainer.** `src/server/` runs this branch unchanged. Staff are the
  names in `admins` (`src/server/game.ts:185`).

### 30 · MATCH_INFO_PARTIAL_UDPATE — match server → every client in the match

One field of the match details, sent when the match server changes it. The client writes the
value into its copy of the match details and reacts to the round state and the team scores.
The name's spelling is the game's. A client does not originate it: a copy a client sends is
dropped by the lobby or the host (`flash.js:3294-3295`).

| | |
|---|---|
| Built | the match's `$ТccHeT(path, value)` (`flash.js:7229-7298`), sent at `:7269-7274` |
| Sent to | every connection in a slot of the match, players and spectators (`:7269-7270`) |
| Applied by every receiver | `:3292-3300`, which runs the same `$ТccHeT` on `match_details` with "do not send" set |
| Dropped | by any server-side connection (`:3294`); there is no host-or-lobby check for it |

#### The console command

None. The message is server → client only, and a client's copy is dropped at `flash.js:3294`.
To watch it:

```
netlog show type:match_info
```

#### What real ones look like

Received in matches (netlog prints part 2 as the JSON text it is).

| Situation | As received |
|---|---|
| A round ends (DM, TDM or COOP) | `MATCH_INFO_PARTIAL_UDPATE("coop_state", "1")` |
| The next round starts | `MATCH_INFO_PARTIAL_UDPATE("coop_state", "2")` |
| Play begins | `MATCH_INFO_PARTIAL_UDPATE("coop_state", "0")` |
| The time the server rethinks the state, 3 s ahead | `MATCH_INFO_PARTIAL_UDPATE("coop_state_rethink_after", "1794636135063")` |
| No timer: a COOP round with no rotation | `MATCH_INFO_PARTIAL_UDPATE("coop_state_rethink_after", "null")` |
| A TDM kill, red team (12) | `MATCH_INFO_PARTIAL_UDPATE("team_scores.12", "17")` |
| A TDM kill, blue team (13) | `MATCH_INFO_PARTIAL_UDPATE("team_scores.13", "14")` |

One COOP round, as recorded, with the sounds that come with it:

```
15:02:12.179  MATCH_INFO_PARTIAL_UDPATE("coop_state", "1")
15:02:12.179  MATCH_INFO_PARTIAL_UDPATE("coop_state_rethink_after", "1794636135063")
15:02:12.179  PLAY_SOUND("coop_draw")
15:02:15.228  MATCH_INFO_PARTIAL_UDPATE("coop_state", "2")
15:02:15.228  MATCH_INFO_PARTIAL_UDPATE("coop_state_rethink_after", "1794636138111")
15:02:15.228  PLAY_SOUND("warmup")
15:02:18.267  MATCH_INFO_PARTIAL_UDPATE("coop_state", "0")
15:02:18.267  MATCH_INFO_PARTIAL_UDPATE("coop_state_rethink_after", "null")
```

#### How it works

1. **The match server changes a field** with `$ТccHeT(path, value)`. The code calls it for three
   paths only: `coop_state` (`flash.js:4964`, `:6290`, `:6391`, `:6411`, `:6467`, `:6519`,
   `:6546`), `coop_state_rethink_after` (`:5498`) and `team_scores.<team>` (`:5978`, `:7135`).
2. **It writes the value** by walking the dotted path from the match (`:7237-7261`).
3. **It sends the path and `JSON.stringify(value)`** to every connection in a slot
   (`:7264-7274`). Lobby connections outside the match get nothing; they read the list instead.
4. **Each receiver applies it** to `$ММ["match_details"]` with the same function and "do not
   send" set (`:3299`). Then (`:7276-7297`):
   - `coop_state` from 0 to 1 runs `$НТсclT` (`frame2.js:15818-15838`): every map gun a
     player holds is taken out of their hands.
   - `coop_state` from 1 to 2 runs `$MрHMрI` (`frame2.js:15839`): it rebuilds the level's
     barrels and other objects for the next round (inferred from `:15841-15880`).
   - A `team_scores` path refreshes the HUD's score display (`flash.js:7293-7296`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | dotted path into the match details |
| 2 | JSON | the new value |

**Part 1, the path.** Split on `.` and walked from `match_details` (`flash.js:7240-7248`). Paths
the server sends:
- `coop_state`: the round state. The code holds no names for its values; from what the code
  does with them: 0 a round is being played, 1 the round has ended, 2 the next round is
  starting (`:41-43`, `:6391-6411`). Despite the name it is used in DM and TDM too (`:6286-6290`).
- `coop_state_rethink_after`: when the server next moves the state on (`:6284`).
- `team_scores.12` and `team_scores.13`: red and blue (`:46-47`).

A missing middle step makes the walk throw a `TypeError`. A new key on an object that already
has more than 100 keys is refused (`:7251-7258`); on a client that refusal itself throws,
because `match_details` has no chat method. Any throw is caught and logged by the connection
(`connection.js:913-920`). Before joining a match, `match_details` is not set, and the message
throws the same way.

**Part 2, the value.** `JSON.parse` (`flash.js:3299`). `coop_state` and the scores are numbers.
`coop_state_rethink_after` is the server's clock time in ms (`:5422-5424`, `:5475-5489`), or
`Infinity` when nothing is pending (`:5495`), which JSON turns into `null`. The client does not
rely on this copy for its countdown: each state message carries the time left
(`:817`), and the client sets the field from that (`:1271`).

#### Situations

- **The round cycle.** A round ends (`coop_state` 1). Three seconds later the next starts (2),
  with "Round N" in chat and the `warmup` sound (`:6391-6405`). Three seconds later play begins
  (0, `:6411`). Each step also resends `coop_state_rethink_after` (`:5485`, `:5489`, `:5498`).
- **A late joiner** gets the whole details, `team_scores` and `coop_state` included, in its
  `MATCH_JOIN_RESPONSE` (`:6702-6703`), and these updates from then on.
- **`-endround`** in chat makes the server set `coop_state` to 1 in COOP (`:4958-4966`), and the
  update goes out like any other.
- **Lag.** It is reliable, so it arrives in order with the `PLAY_SOUND` and `SERVICE_MESSAGE`
  sent with it. The recordings show all of them in the same packet.
- **For the local server's maintainer.** `src/server/` runs this code from the decoded
  `flash.js`. The three paths above are all a client ever receives.

### 31 · PLAYER_SCORE_UPDATE — match server → every client in the match

Sets one player's kills and deaths on every client. The match server sends it in one case
only: a death is taken back, because a player at 0 HP came back to life before respawning.
Kills and deaths otherwise travel in `PLAYER_DIES`. A client does not originate it: a copy a
client sends is dropped by the lobby or the host (`flash.js:2062-2063`).

| | |
|---|---|
| Built | `flash.js:7139-7178` (the match's `$се0еОО`), sent at `:7162-7173` |
| Triggered by | the player's own state message reporting HP above 0 while the server's copy is at 0 (`:1088-1091`) |
| Sent to | every connection in a slot of the match, the player included (`:7162-7164`) |
| Applied by every receiver | `:2060-2080` |
| Only in | TDM and COOP; COOP only while `coop_state` is 0 (`:7147-7155`) |

#### The console command

None. The message is server → client only. To watch it:

```
netlog show type:player_score
```

#### What real ones look like

Received in matches, numbers decoded.

| Situation | As received |
|---|---|
| Slot 4 dies, deaths 1 | `PLAYER_DIES(4, -1, 0, 19, <number>, 0, 1)` |
| … and comes back 3.7 s later, deaths back to 0 | `PLAYER_SCORE_UPDATE(4, 0, 0)` |
| Slot 1, 4 deaths taken back to 3 | `PLAYER_SCORE_UPDATE(1, 0, 3)` |
| Slot 3, after killing two teammates | `PLAYER_SCORE_UPDATE(3, -2, 3)` |

#### How it works

1. **The server's copy dies.** A hit, or the player's own state message, takes the server's
   copy to 0 HP. The death counts at once: `deaths` goes up and `PLAYER_DIES` goes out
   (`flash.js:7053-7072`).
2. **The player's state reports HP above 0.** A state message from a player at 0 HP is
   accepted only inside a short window (`:934-936`). The window opens for 3 seconds
   (`$ММ.$0AA1HO`, `:18`) when a teammate lands a no-damage hit on the downed player
   (`:6951-6954`), and for everyone as a round starts (`:6402`). A downed flag in the state
   must be set too (`$МоТeII`, `:924-926`). Inferred from these conditions: this is a player
   brought back by a teammate, not a respawn.
3. **The server takes the death back** (`$се0еОО`, `:7139-7178`). In DM it does nothing. In TDM,
   and in COOP during play, it lowers `deaths` by one and sends this message to every slot
   (`:7158-7174`). It also drops the pending TDM team point for that death (`:7177`).
4. **Each receiver applies it** (`:2060-2080`). It finds the player record by slot, first among
   spectators, then players (`:2073`), and overwrites `kills` and `deaths` (`:2077-2078`). The
   scoreboard reads them from there.

A death becomes final on the next `RESPAWN` or `RESSURECT`, or when the player leaves (`:3863`,
`:6854`, via `$р0THTо`). After that it cannot be taken back.

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | number | the player's slot |
| 2 | number | the player's kills on the server |
| 3 | number | the player's deaths on the server, after the take-back |

**Part 1, the slot.** The connection's slot index (`flash.js:7167`), decoded with `$OНННО`
(`:2068`). Not an auth id. An empty slot on the receiver changes nothing (`:2075`).

**Part 2, kills.** The server's current count, sent unchanged (`:7169`). It can be negative: a
teamkill lowers it (`:7030`). The receiver overwrites its own number with it (`:2077`), so this
message also corrects a drifted kill count.

**Part 3, deaths.** The server's count after lowering it (`:7160`, `:7171`). The receiver
overwrites its own (`:2078`).

#### Situations

- **Why DM never sends it.** A DM death is never taken back (`:7153-7155`), so a DM scoreboard
  only changes with `PLAYER_DIES`.
- **A COOP round in between.** Outside play (`coop_state` not 0) the take-back does nothing
  (`:7147-7151`): the death stands.
- **TDM team points.** A TDM death gives the other team a point only when it becomes final
  (`:7083-7100`, `:7105-7135`). Taking the death back clears the pending point (`:7177`), so a
  revived player costs their team nothing.
- **Order.** It is reliable and comes after the `PLAYER_DIES` it corrects. A client that missed
  nothing ends with the server's numbers.
- **Who it reaches.** The lobby or host ignores a copy from a client (`:2062`). In a
  player-hosted match a client takes it only from the host (`:2065`, `:1836-1862`).

### 32 · PLAY_SOUND — match server → client

Plays one sound by name on the client: the end-of-round and round-start sounds. A client does
not originate it: a copy a client sends is dropped by the lobby or the host (`flash.js:3304-3305`).

| | |
|---|---|
| Built | `flash.js:5990`, `:5992`, `:6001`, `:6329`, `:6331`, `:6365`, `:6367` |
| Applied | `:3302-3313` |
| Only from | in a player-hosted match, the host (`:3307`, `:1836-1862`) |

#### The console command

None. The message is server → client only. To watch it:

```
netlog show type:play_sound
```

#### What real ones look like

Received in matches.

| Situation | As received |
|---|---|
| A round ends in a draw | `PLAY_SOUND("coop_draw")` |
| The next round starts | `PLAY_SOUND("warmup")` |
| Your side won | `PLAY_SOUND("coop_victory")` |
| Your side lost | `PLAY_SOUND("coop_defeat")` |

The recordings hold 76 `warmup`, 61 `coop_draw`, 2 `coop_defeat` and 1 `coop_victory`. The
`warmup_ping` countdown below was not recorded.

#### How it works

1. **The match server picks a sound** at a round event and sends its name, either to
   each player separately or to every slot (`flash.js:5997-6002`).
2. **The receiver plays it** (`:3310-3312`). It wraps the name as a sound source
   (`DefineSoundSource`, `scripts/flash.js:87-124`) at twice the volume, and plays it on the
   next of 22 sound channels, the same on both speakers (`frame2.js:3723-3763`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | the sound's resource name |

**Part 1, the sound's name.** Passed unchanged to `DefineSoundSource` (`flash.js:3310`). The names
the server sends:

| Name | When | Sent to | Line |
|---|---|---|---|
| `coop_victory`, `coop_defeat` | a COOP round won by one team | each player of a team, by team | `:5983-5994` |
| `coop_victory`, `coop_defeat` | a DM game ends | top killers and spectators win, the rest lose | `:6322-6331` |
| `coop_victory`, `coop_defeat` | a TDM game ends | the winning team and spectators win | `:6359-6367` |
| `coop_draw` | teams tied (TDM), or a COOP round drawn | every slot | `:6350`, `:6523` |
| `warmup` | the next round starts | every slot | `:6405` |
| `warmup_ping` | the 3-2-1 countdown when a paused match resumes | every slot | `:6102`, `:6110`, `:6118` |

A spectator is a slot at or above `players_max` (`:5914`), and always gets the victory sound.

A name that is not in the sound list throws `Sound <name> was not listed in sounds.js`
(`libs/audio.js:199-202`). The connection catches and logs it (`connection.js:913-920`), and no
sound plays. With no sound channels the client plays nothing (`frame2.js:3605-3609`, `:3725`).
In the game frame, nothing plays while the game is hidden (`:3726`).

#### Situations

- **It follows the match state.** Each round sound comes in the same packet as its
  `MATCH_INFO_PARTIAL_UDPATE("coop_state", …)` and its chat line (see message 30).
- **Paused matches.** With `ping_limit_action` `pause_match`, the match pauses while a player's
  ping is over the limit (`flash.js:6014-6057`). Resuming prints "Server: 3...", "2...", "1..."
  a second apart, each with `warmup_ping` (`:6096-6120`).
- **For the local server's maintainer or a map author.** The names are fixed in the decoded
  `flash.js`; a map cannot pick one. `src/server/` sends the same names at the same events.

### 33 · BAN_USER — client (staff) → lobby

A staff member bans an account from multiplayer. The lobby checks the sender's staff flag
and hands the target to the account module, which decides what a ban does. The answer is one
chat line.

| | |
|---|---|
| Built | `HUD.js:2153`, by a button only staff see (`:2138`), after a confirmation dialog (`:2148`) |
| Handled by the lobby | `flash.js:2845-2930`, the branch at `:2884-2890` |
| Decided by | the account module's `$сTIoMO(target, initiator)` (`:2887`) |
| Answered | `RESPONSE [<reply id>, <chat string>]`, printed in chat (`HUD.js:2155`) |
| Relayed | never |
| Only with | `is_staff` in the sender's profile, which only the server sets at login (`flash.js:2886`) |

#### The console command

```
js pb.req("BAN_USER", ["<auth id>", "REPLY"])
```

From an account without staff the answer is `Error: Not a staff`, and nothing else happens.

#### What real ones look like

No ban is in the recordings. Built from `HUD.js:2153` and the answers in `flash.js:2871`,
`:2889`, `:2927` and `src/server/text.ts:50`.

| Situation | Line |
|---|---|
| As sent | `BAN_USER("<auth id>", "j")` |
| Not staff | `RESPONSE(102, "Error: Not a staff")` |
| Your own id | `RESPONSE(102, "Error: Can't do this to yourself")` |
| Staff, on this repo's server | `RESPONSE(102, "Server: User has been banned from this server")` |

#### How it works

1. **The client builds it.** The button shows for staff only (`HUD.js:2138`). Its tooltip
   describes the official effect: "set … reputation to zero, disconnect all connections and
   remove all matches" (`:2140`). A dialog asks "Ban <login> from Multiplayer?" first (`:2148`).
2. **The lobby finds the target and refuses yourself**, as for `REPORT_USER`
   (`flash.js:2851-2872`).
3. **It checks staff.** The sender's profile must have `is_staff` (`:2886`); otherwise
   `Error: Not a staff` (`:2889`).
4. **The module bans** with `$сTIoMO(target, initiator)` and returns the chat string (`:2887`).
5. **The lobby logs it** as `RELIABLE_BAN_USER*<login>*<nickname>` unless the answer starts with
   `Error: ` (`:2920-2923`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | decimal text, `parseInt` | the target's auth id |
| 2 | string, echoed | reply id |
| 3 | `=== "1"` | read, then unused for this message |

**Part 1, the target's auth id.** As for `REPORT_USER`: a global lookup (`flash.js:2855`), so
the target need not share your match.

#### Situations

- **Who is staff.** The flag comes in the login profile from the server; the client cannot
  set it (`flash.js:2007-2018`). A modified page can show itself the button, but the lobby
  reads its own copy (`:2886`).
- **Guests.** The dialog suggests banning accounts unless dealing with guests (`HUD.js:2148`).
  What the official module does to a guest is not in the game files.
- **For the local server's maintainer.** Staff are the names in `admins`
  (`src/server/game.ts:185`). The module bans the record's login: it adds it to the server's
  ban list, disconnects that player with "Server: You are banned by a server admin", and
  answers `Server: User has been banned from this server` (`src/server/game.ts:158-163`,
  `:358-368`).

### 34 · RESSURECT — client → match server → every client, the sender included

The local player comes back to life without going through the respawn queue. The game sends it
in two cases: at the start of each new round, and when a map trigger gives the dead local player
health. It carries the position and the new HP. The match server sets its HP copy and the
respawn counter, and sends the message to everyone, the sender too, so all agree on the counter.

| | |
|---|---|
| Built | `frame2.js:16070`, in the round restart at `:15839`; `actions.js:1603`, in trigger action 59 |
| Handled by the match server | `flash.js:3830-3864`, the branch it shares with `RESPAWN` |
| Relayed | `flash.js:4056-4066`, to everyone, the sender included (`:3859`, `:4060`) |
| Applied by every receiver | `flash.js:4095-4139` |
| Not checked | the respawn queue (`:3833-3849` is for `RESPAWN` only), whether the player was dead, the HP limit |

#### The console command

No hand-made line: the server would set the sender's HP and count a respawn, dead or not,
which the game only does at a round start or from a map trigger. To produce a real one, own a COOP match on the local server
and end the round. The owner's chat command does that (`flash.js:4958-4966`):

```
js pb.event("CHAT", pb.num(1), "-endround")
```

The round state goes to 1, then a few seconds later to 2 (`flash.js:5485`), and every client
sends `RESSURECT`.

#### What real ones look like

Recorded with `netlog show`, numbers decoded. A sent message has 3 parts. A received one has 5:
the match server puts the sender's slot in front and writes the respawn counter at the end.

| Situation | As recorded |
|---|---|
| Round start, sent | `RESSURECT(-180, 0, 150)` |
| The same message coming back to its sender, slot 0 | `RESSURECT(0, -180, 0, 150, 1)` |
| Round start, another player, received | `RESSURECT(4, -1020, -2600, 500, 21)` |
| A map that sets 10 HP, received | `RESSURECT(1, -13935, 501, 10, 1)` |
| A map that gives 99999999 HP, received | `RESSURECT(0, 12894, -4674, 99999999, 3)` |

In the first recording the round state changes to 2 and the `RESSURECT` leaves 25 ms later.

#### How it works

1. **The round restart sends it.** When the match's `coop_state` changes from 1 to 2
   (`flash.js:7284-7285`), or a state packet of the older netcode carries a higher round number
   (`frame2.js:20896-20901`), each client runs the round restart (`:15839`). It resets the map,
   and, unless spectating (`:15985`), the local player: HP = max HP (`:16007`), position = the
   start point (`:16011-16012`), no gun (`:16017`), not dead (`:16018-16019`), no last attacker
   (`:16005-16006`). It moves the body there (`:16038-16067`), sends `RESSURECT` (`:16070`) and
   adds 1 to its own respawn counter (`:16071`). This happens even for a player who was alive.
2. **Or trigger action 59 sends it** (`actions.js:1556-1606`). The action is skipped when the
   match forces player health (`actions.js:37-45`, `:1561`). It sets a character's HP and max
   HP to the trigger's value (`:1570`). With HP above 0 the character is revived
   (`:1572-1576`). Only if that character is the local player and was dead before
   (`:1568`, `:1600-1601`) does it send `RESSURECT` and add 1 to the counter (`:1603-1604`).
   The action's name in the editor is not in the code; "set health" is inferred from `:1570`.
3. **The match server updates its copy** (`flash.js:3830-3864`). It sets HP to part 3
   (`:3851`), adds 1 to `respawns` (`:3852`), clears the time of the last hit (`:3854`) and the
   "still dead" timer (`:3855`), and writes the new counter into part 4 (`:3857`). It then
   settles the score left from the player's last death (`:3863`, the function at `:7105-7137`):
   the ranked update and, in TDM, the team point.
4. **It relays it to everyone, the sender too** (`flash.js:3859`, `:4056-4066`), with the
   sender's slot as the new part 1.
5. **Each receiver applies it** (`flash.js:4095-4139`). Every receiver sets that player's
   `respawns` from part 4 (`:4103`). The sender's own copy stops there. For another player, or
   on a spectator's screen (`:4107`), it leaves a still copy of the old body in the world
   (`:4109`, `frame2.js:16955-17017`), sets HP and the four body-part HP values to part 3
   (`flash.js:4132-4136`), and re-checks the body parts (`:4138`). It does not move the
   character: only `RESPAWN` does (`:4111-4113`).

#### Field by field

Part numbers are as the server and the receivers read them, after the sender's slot is removed.

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1, 2 | number | x, y | the local player's position |
| 3 | number | HP | the new HP |
| 4 | number | `respawns` | written by the match server |

**Parts 1 and 2, x and y.** The round restart sends the start point (`frame2.js:16011-16012`);
action 59 sends the current position (`actions.js:1603`). Receivers read them (`flash.js:4101-4102`)
but use them only for `RESPAWN` (`:4111-4113`). The revived player's position reaches the others
through its state packets.

**Part 3, HP.** The round restart sends the max HP (`frame2.js:16007`); action 59 sends the
trigger's value (`actions.js:1570`). The server stores it as is (`flash.js:3851`). State packets
have their HP checked against the map's limit (`:938-944`); this path does not. Receivers set HP
and all four body-part HP values to it (`:4132-4136`). The sender itself sets its body parts to
40 to 60 % of HP, at least 30 each, after action 59 (`actions.js:1587-1590`); the next state packet
carries those (`flash.js:532-535`).

**Part 4, `respawns`.** The server's counter after adding 1 (`flash.js:3857`). The sender
already added 1 itself (`frame2.js:16071`, `actions.js:1604`), and the echo sets the same value
(`flash.js:4103`). A `HIT_PLAYER` still carrying the old counter is dropped on the server
(`:6930`) and on receivers (`:4349`). A value the client sends in part 4 is overwritten.

#### Situations

- **Round start.** Every player sends one at once. Hits in flight from the last round carry the
  old counter and are dropped. Clearing the last-hit time (`flash.js:3854`) means nobody gets a
  kill for a hit from the round before.
- **A player who was alive.** The round restart sends it anyway, and the server counts a respawn.
  The counters stay in step because every client counts it too.
- **TDM score timing.** In TDM a death's team point waits for the next respawn (`flash.js:7083-7099`).
  `RESSURECT` pays it out (`:3863`) like `RESPAWN` does.
- **Big HP values.** Maps that give huge health send it here; the recorded 99999999 passed the
  server unchanged.
- **For a map author.** Action 59 on a dead local player revives them through this message. On a
  living player it sends nothing (`actions.js:1601`). With forced player health in the match
  settings the action does nothing (`:1561`).
- **Who may send it.** A spectator's client does not send it (`flash.js:1784`), the round
  restart skips spectators (`frame2.js:15985`), and the server refuses one (`flash.js:1930-1934`).
- **For the local server's maintainer.** Unlike `RESPAWN` with the v2 queue, this path logs
  nothing (`flash.js:3845`, `:3848` are `RESPAWN` only). To see why a player came back without
  queueing, look for a `RESSURECT` right after a `coop_state` change to 2.

### 35 · SWORD_ATTACK — client → match server → every other client

The local player made a bare-handed melee swing. The game names this attack's source
`swords` (`frame2.js:8347`). The message has no parts. Every other client replays the swing on
that player's character. Damage does not travel here: a swing that lands sends its own
`HIT_PLAYER`.

| | |
|---|---|
| Built | `frame2.js:35853`, in the swing at `:35809-35899` |
| Checked by the match server | not checked: it goes straight to the relay (`flash.js:4046-4068`) |
| Relayed | `flash.js:4056-4066`, to everyone but the sender |
| Applied by every receiver | `flash.js:4672-4675`, used at `frame2.js:35427-35432` |

#### The console command

```
js pb.event("SWORD_ATTACK")
```

Every other client swings your character once, if it holds no gun on their screen. No damage.

#### What real ones look like

Recorded with `netlog show`. Sent, it has no parts. Received, it has the sender's slot.

| Situation | As recorded |
|---|---|
| A swing, sent | `SWORD_ATTACK()` |
| Slot 3 swings, received | `SWORD_ATTACK(3)` |

Holding the fire button with no gun sends one about every 250-280 ms (one recording: 53.099,
53.349, 53.616, 53.899 s). A swing that lands is followed by a `HIT_PLAYER` with frame 1, class 3,
source -11 and power 3.5 (see the `HIT_PLAYER` table).

#### How it works

1. **The swing.** In the per-character update, a character that fires with no gun
   (`frame2.js:35510-35512`), is not in a vehicle and shows its lower body (`:35737-35738`)
   swings when its swing phase passes half a turn and its charge is 1 (`:35808-35809`). The
   charge grows by 0.3 a frame in multiplayer and 0.65 alone, up to 1 (`:35499-35502`).
2. **It creates an invisible projectile** (`frame2.js:35845`, alpha 0 at `:35884`): source -11
   (`:35869`), class 3 (`:35876`), power 3.5 × character scale × charge (`:35881`), knockback 1
   (`:35882`), owned by the swinging character (`:35885`). The charge goes back to 0 (`:35899`).
3. **It sends `SWORD_ATTACK`** if the match is multiplayer and the character is the local player
   (`frame2.js:35849-35853`).
4. **The match server relays it** with the sender's slot in front (`flash.js:4056-4066`).
5. **Each receiver sets a flag** on that player's character (`flash.js:4674`). On its next
   update, if the character holds no gun, the flag becomes a fire press and is cleared
   (`frame2.js:35427-35432`). The character then swings as in step 1, with its own invisible
   projectile owned by that player. Only the projectile's owner sends `HIT_PLAYER`
   (`:30469-30471`), so the replayed swing reports no damage.

#### Field by field

No parts. The receiver only uses the sender's slot that the server adds (`flash.js:4084-4087`).
Extra parts are ignored.

#### Situations

- **Why it exists.** The state packet already carries the fire button (`flash.js:507-508`), but
  state is unreliable: only the newest is sent. This reliable message makes every swing show up
  on other screens, even a short tap between two state packets (inferred).
- **A gun on the receiver's screen.** The flag is only used while the character holds no gun
  (`frame2.js:35428`). If a receiver still sees a gun in that player's hands, the flag waits,
  and the swing plays when the gun is gone.
- **Damage.** The swinger's client decides hits and damage, and sends them as `HIT_PLAYER` with
  source -11. A kill reads "sliced" or "cut" in chat (`flash.js:2420-2427`).
- **Who may send it.** A spectator's client does not send it (`flash.js:1784`), and the server
  refuses one (`:1930-1934`). A receiver still loading the level queues it (`:4077-4081`).
- **For the local server's maintainer.** The server relays it without reading it. The count of
  `SWORD_ATTACK` messages per player is a count of swings, not of hits.

### 36 · VAR_SYNC — client → match server → every other client

Copies one map variable from one client to the others. A trigger action in the map sends it,
the match server relays it untouched, and each receiver merges the value into its own map
variables with one of five rules. It is how a map keeps doors, scores and switches the same on
every screen.

| | |
|---|---|
| Built | trigger actions 223-227, `actions.js:3107-3189` (sent at `:3117`, `:3134`, `:3151`, `:3168`, `:3185`) |
| Checked by the match server | nothing specific: the general match and spectator checks only (`flash.js:3814`, `:1929-1934`) |
| Relayed | `:4056-4066` |
| Applied by every receiver | `:4677-4716` |
| Only with | the map's `var_sync` engine mark, on the sender and on every receiver (`frame2.js:12060-12063`) |

#### The console command

One line per merge mode. Each sends the value you type, not the value of your own variable,
and does not change your own copy: set that first (`vars set`, [triggers](../features/triggers.md)),
or use the dev console's `vars sync <name> <mode>`, which sends your own value and explains
what each mode would do.

```
js pb.event("VAR_SYNC", "r", "var_suddendeath", "11")
js pb.event("VAR_SYNC", "d", "round_seed", "4217")
js pb.event("VAR_SYNC", "x", "door_19", "1")
js pb.event("VAR_SYNC", "n", "Redgun_Y", "-1029")
js pb.event("VAR_SYNC", "l", "checkpoints", "1,2,3,4")
```

What a map author uses each one for:

| Mode | Trigger action (map editor) | Rule on the receiver | Use |
|---|---|---|---|
| `r` | 223, "through overriding value" | take the value | a value one client decides for everyone: a round number, a sudden-death timer, a text to show |
| `d` | 224, "through keeping defined value" | take it only where the variable is unset or not a number | agree once on a value nobody has yet: a random seed, which of several door layouts this round uses |
| `x` | 225, "through keeping maximum value" | keep the larger number | a state that only goes up: a door or switch that, once opened (0 → 1), stays open for all |
| `n` | 226, "through keeping minimum value" | keep the smaller number | a value that only goes down: a best time, a countdown, the highest point reached (y grows downwards) |
| `l` | 227, "through keeping longest String value" | keep the longer text | a text that only grows: a list of checkpoints reached, a log |

The action names are from the map editor's list (`data/opcodes.js`, entries 223-227).

#### What real ones look like

From recordings, as `netlog show` prints them. A sent message has 3 parts. A received one has 4:
the match server puts the sender's slot in front.

| Situation | Mode | Message |
|---|---|---|
| A door state, sent when a player joins | `x` | as sent `VAR_SYNC("x", "door_19", "0")` |
| The same door after another client opened it | `x` | as received `VAR_SYNC(5, "x", "door_19", "1")` |
| A per-player flag, set to 1 | `x` | as received `VAR_SYNC(0, "x", "size_P3", "1")` |
| A position that may only go down | `n` | as sent `VAR_SYNC("n", "Redgun_Y", "-1029")` |
| The same variable at its starting value | `n` | as received `VAR_SYNC(0, "n", "Blackgun_Y", "8000")` |
| A timer set by one client | `r` | as received `VAR_SYNC(4, "r", "var_suddendeath", "9")` |
| A client that had no value sends one anyway | `d` | as received `VAR_SYNC(1, "d", "Move_door_set", "undefined")` |

All values are text on the wire, including numbers. The recordings hold about 11,500 sent `x`,
540 `n`, 96 `r`, 28 `d` and no `l`. Most `x` lines come in bursts of `"0"` right after a player
joins (see "Late joiners" below). Some maps put player names in `r` variables; those are left out
here.

#### How it works

1. **A trigger action sends it.** Actions 223-227 (`actions.js:3107-3189`) refuse a name or a
   current value longer than 2048 characters (`:3109-3112`, it throws "Buffer overflow during
   var sync"). Without the `var_sync` mark they throw "Variable value synchronizing trigger
   actions require Var Sync engine mark" (`:3121`). In single player they do nothing (the
   multiplayer flag `$pMМ1`, `:3116`). Otherwise they send the mode letter, the name, and the
   sender's current value of that variable (`:3117`) through `Event`. The sender does not apply
   the message to itself: it already has the value.
2. **`Event` drops it for a spectator** (`flash.js:1775-1787`, the allowed list at `:1730-1753`).
3. **The match server relays it.** It has no case for this message: it checks the player is in
   a match that is not player-hosted (`:3814`, `:1802-1835`), refuses a spectator (`:1929-1934`),
   puts the sender's slot in front (`:4056`), and sends it to every other client in the match
   (`:4058-4066`). It keeps no copy of the variables, and does not check length or mode.
4. **Each receiver applies it** (`:4677-4716`). A gameplay message that came from the lobby in a
   player-hosted match is ignored (`:4073`). One that arrives while the receiver's map is still
   loading is queued (`:4077-4080`) and replayed when loading ends (`frame2.js:14365-14368`).
   The sender's slot is removed (`flash.js:4084`) and not used. Without the `var_sync` mark the
   receiver ignores the message (`:4679`). Otherwise it merges the value into the map variables
   `$ррAН` by the mode letter.

The receiver runs no trigger when a variable changes. A map that must react to a synced value
checks it from a timer or another trigger.

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | the merge mode: `r`, `d`, `x`, `n` or `l` |
| 2 | string | the variable's name |
| 3 | string | the value, as text |

**Part 1, the mode.** One letter, compared with `===` (`flash.js:4685`, `:4690`, `:4700`,
`:4705`, `:4710`). Any other value does nothing. What each letter does with the receiver's
current value `cur` and the received text `v`:

- **`r`** stores `v` (`:4687`). The variable becomes text even if it was a number.
- **`d`** stores `v` only if `cur` is `undefined`, `null`, the texts `"undefined"` or `"null"`, or
  anything `isNaN` (`:4692-4697`). So it also overwrites a variable that holds a word, such as
  `"open"`. It keeps a number, a numeric text and an empty text.
- **`x`** stores `Math.max(parseFloat(v), parseFloat(cur))` (`:4702`), a number.
- **`n`** stores `Math.min(…)` the same way (`:4707`).
- **`l`** stores `v` if it has more characters than `cur` turned into text (`:4712-4713`).

**Part 2, the name.** Any text. It is used as the key into the map variables (`flash.js:4687`).
The sender refuses names over 2048 characters (`actions.js:3109-3110`); the receiver does not
check.

**Part 3, the value.** The sender's value turned into text by the send, so the number 5 arrives
as `"5"`, and a variable the sender never set arrives as `"undefined"`. The receiver does not
check the length (the 2048 limit is only on the sender, `actions.js:3111-3112`).

#### Situations

- **Number or text.** A map loads its trigger values through a converter that turns whole
  numbers into numbers (`frame2.js:10436-10437`, used at `:12734`), so "set variable to 1"
  stores the number 1 (`actions.js:2274`). After `r`, `d` or `l` the receiver holds the text
  `"1"`. The "value equals" checks compare with `===` (`actions.js:2369` for action 116), so a
  check against 1 passes on the sender and fails on every receiver. `x` and `n` store numbers
  and do not have this problem. Comparisons by size (actions 114, 115) use `parseFloat` and work
  either way.
- **`x` and `n` on an unset variable.** `parseFloat(undefined)` is `NaN`, and `Math.max` with
  `NaN` gives `NaN` (`flash.js:4702`). A receiver that never set the variable ends up with `NaN`,
  not with the sent value. Set every synced variable on every client first, for example in a
  trigger that runs at map start. A later `d` replaces a `NaN` (`:4696`).
- **`l` on an unset variable.** `cur` turns into the text `"undefined"`, 9 characters
  (`:4712`), so a value of 9 characters or fewer does not replace it.
- **Late joiners.** The server keeps nothing, so a player who joins gets no old syncs. Maps solve
  this with action 228, "Call trigger 'A' each time new player joins the match"
  (`actions.js:3192-3193`). Every client already in the match runs that trigger when another
  player connects (`flash.js:3490-3491`) and re-sends its values, so the newcomer receives one copy from each
  player. This is why `x` and `n` exist: the copies may arrive in any order and still end with
  the same result. With `r` the last copy to arrive wins, and two clients can end up with
  different values.
- **Two clients at once.** With `r`, two clients that send different values at the same moment
  each keep their own value (neither applies its own message) and get the other's. They swap.
  The merge modes avoid this.
- **The mark.** The `var_sync` mark is set when a map that has it loads, and nothing sets it back
  to false (`frame2.js:373`, `:12062`). A client that loaded such a map earlier in the session
  still sends and applies syncs on a map without the mark; one that did not, drops them.
- **Map reloads.** The map variables are emptied when a map loads (`frame2.js:10572`), and the
  map's start triggers set them again. A client that reloads the map starts from the map's own
  values.
- **For the local server's maintainer.** `src/server/` relays this message as above and stores
  nothing. To see why a door is open for one player and closed for another, look for the
  `VAR_SYNC` lines of that variable in each client's netlog and apply the mode in order.

### 37 · FLOW_AT — client → match server → every other client

A blood burst. When the local player bleeds from something only its own client simulates (a
hard landing, a body part hitting a wall, a bot's shot), the client draws the blood and sends
this so the other players draw the same burst at the same place.

| | |
|---|---|
| Built | `$АATHc`, `frame2.js:6674-6693`, sent at `:6684` |
| Checked by the match server | nothing specific (relayed like `VAR_SYNC`) |
| Relayed | `flash.js:4056-4066` |
| Applied by every receiver | `:4718-4728` |
| Only with | a multiplayer match, and only when the bleeding character is the sender's own player |

#### The console command

```
js pb.event("FLOW_AT", pb.num(6433), pb.num(-360), pb.num(0), pb.num(-163), pb.num(-287), pb.num(3))
```

A burst the game sent when a body part of the player hit something hard (the third row below).
The other players draw 3 drops of the sender's blood at (6433, -360). Nothing else changes.

#### What real ones look like

From recordings, numbers decoded. A sent message has 6 parts. A received one has 7: the match
server puts the sender's slot in front.

| Situation | Message |
|---|---|
| The player slammed into a floor or wall (count 5) | as sent `FLOW_AT(7390, -2044, 0, 5, 10, 5)` |
| The same, from another player | as received `FLOW_AT(7, 6732, -2223, 0, 11, 7, 5)` |
| A body part hit something hard (count 3) | as sent `FLOW_AT(6433, -360, 0, -163, -287, 3)` |
| The same, from another player, over and over at one spot | as received `FLOW_AT(5, 7300, -813, 0, -197, 78, 3)` |

netlog prints some of these parts as quoted characters, because it only decodes parts it knows
are numbers; they are decoded here. Count 5 and count 3 are the two cases in the recordings.

#### How it works

1. **The client draws blood.** `$АATHc(x, y, type, vx, vy, count, sync)` (`frame2.js:6674`)
   caps the count at 100 (`:6676-6677`). In multiplayer, with `sync` true, it sends the message
   (`:6681-6693`). Then it draws the burst itself (`:6698-6723`).
2. **Who passes `sync`.** Five places, each passing "the bleeding character is my player":
   - the character slams into a wall (`:23829`, `:23831`) or a floor or ceiling (`:23956`,
     `:23958`), count 5;
   - one of its body segments hits something hard (`:24787`), count 3;
   - a projectile hit (`:32672`, `:32680`, `:32702`, `:32708`), count 2 × power or 5 × power,
     but only when the victim is the local player and the shooter is not a player
     (`:30438`, `:30457-30458`). A bot's shot, in practice.

   Hits between players are not sent this way: every receiver of `HIT_PLAYER` draws that blood
   itself.
3. **The match server relays it** to every other client, with the sender's slot in front
   (`flash.js:4056-4066`). It does not read it.
4. **Each receiver draws it** (`:4718-4728`). It sets the bleeding character to the sender's
   slot (`:4720`) and calls the same `$АATHc` without `sync` (`:4721-4727`), so nothing is sent
   on.

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1, 2 | number | x, y: world position of the burst |
| 3 | number | effect type, 0 from every sender |
| 4, 5 | number / 5 | velocity x, y of the drops, sent × `$ММ.$MеМMА` (5, `flash.js:178`) |
| 6 | number | count: how many times the burst repeats |

**Parts 1 and 2, the position.** Rounded to whole units by the encoder (`flash.js:5261`).
Receivers draw there (`frame2.js:6712-6715`) and do not check it against the sender's position.

**Part 3, the effect type.** Every sender passes 0. The receiver hands it to the effect function
`$р00Ap` (`frame2.js:6101`), where 0 is the blood drop `eff_blood` (`:6146-6150`). Each step of
the count draws three of these and one type 10, `eff_blood_sprite` (`:6712-6715`, `:6317-6321`).
Another value would draw another effect from that function's list.

**Parts 4 and 5, the velocity.** Sent × 5 and divided by 5 on receipt (`flash.js:4725-4726`).
The drops fly that way. For an armored character the drops become metal sparks,
`eff_metal` (type 8), pushed back at 5% of that velocity (`frame2.js:6707-6708`, `:6298-6302`).

**Part 6, the count.** The receiver caps it at 100 again (`frame2.js:6676-6677`). With the
`gamescale` engine mark below 100, it is scaled down to at least 1 (`:6700-6701`).

**The sender's slot.** It decides whose colors tint the blood (`frame2.js:6156-6157`) and whose armor
turns it into sparks (`:6707`). Receivers take it from the relay, not from the message body.

#### Situations

- **Bots.** A bot's own landing and impact blood is not sent: the `sync` argument is "this is my
  player". Each client draws a bot's blood from its own simulation of the bot.
- **Violence off.** With `VIOLENCE` false (`frame2.js:2412`), a receiver draws one `altblood`
  (type 19) instead (`:6722-6723`, `:6479-6483`), whatever the message says.
- **Repeats.** A body lying on an edge can hit it again and again; the recordings show the same
  burst from one player many times at one spot.
- **For the local server's maintainer.** It is cosmetic. The server only relays it. A flood of
  them costs bandwidth, not game state.

### 38 · AI_STATE_SYNC — client → match server → every other client

The state of one bot (any non-player character): position, movement, target and random seeds.
Bots run on every client; this message keeps them in step. For each bot, the client of the
nearest living player sends it, up to ten times a second.

| | |
|---|---|
| Built | `$Нc0eМ`, `frame2.js:8153-8202`, sent at `:8167` (alive) or `:8190` (dead) |
| Owner chosen | `flash.js:729-761`, once a second, by every client for every bot |
| Sent from | the state builder, `:766-778` |
| Checked by the match server | nothing specific |
| Relayed | `:4056-4066` |
| Applied by every receiver | `:4730-4782` |

#### The console command

```
js pb.event("AI_STATE_SYNC", pb.num(16), pb.num(1000000), pb.num(850), pb.num(1), pb.num(0), pb.num(0), pb.num(740), pb.num(0), pb.num(-1), pb.num(4), pb.num(157), pb.num(309), pb.num(854), pb.num(0))
```

A copy of a message the game sent (first row below): bot 16 standing at (850, 1) with no target.
Receivers apply it only if slot 16 is a bot that is in play, and its HP part can only lower the
bot's HP.

#### What real ones look like

From recordings, numbers decoded. A sent message has 14 parts (2 for a dead bot). A received
one has one more: the sender's slot in front.

| Situation | Message |
|---|---|
| A bot standing still, no target | as sent `AI_STATE_SYNC(16, 1000000, 850, 1, 0, 0, 740, 0, -1, 4, 157, 309, 854, 0)` |
| The same bot, moving, hunting slot 0 | as sent `AI_STATE_SYNC(16, 1000000, 941, 1, 17, 0, 740, 0, 0, 4, 157, 309, 854, 0)` |
| A bot hunting the player who sends it (slot 2) | as received `AI_STATE_SYNC(2, 16, 499999323, 5111, 861, 0, 0, 5360, 850, 2, 4, 959, 996, 604, 0)` |
| A dead bot | as sent `AI_STATE_SYNC(8, 0)`, as received `AI_STATE_SYNC(0, 19, 0)` |

#### How it works

1. **Every client picks an owner for every bot** once a second (`flash.js:729-761`): the nearest
   player who is in play and alive, within 400 px divided by the zoom (`:746-757`). The result
   is stored on the bot as `$ОOсоH` (`:760`). No player in range gives no owner.
2. **The owner sends.** Each time the client builds its state packet, it picks 5 characters at
   random; for a bot it owns, it calls `$Нc0eМ` (`:766-778`). That function sends at most
   every 100 ms, or every 3 s while the bot is dead (`frame2.js:8155-8163`). A living bot sends
   the full state (`:8167-8186`), a dead one only its slot and 0 (`:8190-8195`). This only runs
   when the client is not spectating and its own player is in play (`flash.js:437-442`).
3. **The match server relays it** to every other client, with the sender's slot in front
   (`:4056-4066`). It does not read it.
4. **Each receiver applies it** (`:4730-4782`) if the slot holds a character that is in play
   (`io`) and is not a player (`$HМ0М1` false, `:4734-4736`). HP becomes the lower of its
   own and the received value (`:4741`). If the received HP is above 0, the position, movement,
   target, action and random values are overwritten (`:4743-4757`). If HP went down, the bot
   reacts as hurt (`$оo1pO`, `:4759-4760`).

The receiver does not check that the sender is the bot's owner.

#### Field by field

The names in quotes are the game's own property names.

| Part | Read as | Name | Sent as |
|---|---|---|---|
| 1 | number | the bot's slot | slot index |
| 2 | number | `hea` | HP, rounded up |
| 3, 4 | number | `x`, `y` | position |
| 5, 6 | number / 5 | `tox`, `toy` | velocity × 5 |
| 7, 8 | number | `tarx`, `tary` | the point it aims at |
| 9 | number | `hunt` | the slot it hunts, -1 for none |
| 10 | number | `botaction` | its current action code |
| 11, 12, 13 | number / 1000 | `rand`, `rand2`, `rand3` | its random values × 1000 |
| 14 | number | `randtim` | a timer for those values |

**Part 1, the slot.** A player's slot, an empty slot or a character not in play is ignored
(`flash.js:4734-4736`).

**Part 2, `hea`.** Applied with `Math.min` (`flash.js:4741`), so this message never heals a bot.
0 or less makes the receiver skip the rest (`:4743`) and leaves the bot at that HP. The sender
rounds up (`frame2.js:8171`), so a bot at 0.4 HP is sent as 1.

**Parts 3 to 14.** Copied onto the bot as they are, with `tox`, `toy` divided by 5 and the three
`rand` values by 1000 (`flash.js:4745-4757`). They take effect on the next frame of the bot's AI.
`hunt` is the slot of the player the bot chases (initial value -1, `frame2.js:7718`).
`botaction` is 4 in almost every recording; the code gives no names for its values. The `rand`
values are each bot's random numbers (set at `frame2.js:7741-7743`); syncing them makes the
bot's random choices come out the same on every client (inferred: they are sent only for that).

Each receiver also writes these into its message log (`flash.js:4764-4778`, kept when
`TRACK_MP_LOGS` is on). That log records `tox` in place of `toy` (`:4770`); the bot itself gets
the right value.

#### Situations

- **Lag.** A receiver snaps the bot to where the owner saw it up to 100 ms plus one trip ago.
  Between messages each client runs the bot on its own.
- **Two owners.** Every client picks owners from its own view. Near the 400 px edge, or with
  two players at about the same distance, two clients may both think they own a bot and both
  send. Receivers apply both.
- **No owner.** A bot with no living player within range has no owner and is not synced; each
  client runs it alone until someone comes near.
- **Healing.** A bot healed on the owner's client (by a map trigger) is not healed on the others,
  because HP only goes down here.
- **The `hunt` test in the owner choice.** `:752` accepts a player beyond 400 px if that
  player's own `hunt` equals the player's own slot. It probably meant the bot's target
  (inferred); as written, distance decides.
- **For the local server's maintainer.** The server only relays it. A bot that jumps around on
  one screen usually means two clients both think they own it.

### 39 · AI_HEALTH_SYNC — client → match server → every other client

The health of one bot and of its four body parts. A client that hurts a bot, or sees it die,
sends this so the others lower the bot's health to match.

| | |
|---|---|
| Built | `$pHсоH`, `frame2.js:8204-8226`, sent at `:8215` |
| Called | when the local player hits a bot (`:32781-32786`), and when a bot dies on this client (`:35408-35409`) |
| Checked by the match server | nothing specific |
| Relayed | `flash.js:4056-4066` |
| Applied by every receiver | `:4784-4805` |

#### The console command

```
js pb.event("AI_HEALTH_SYNC", pb.num(16), pb.num(1000000), pb.num(400000), pb.num(600000), pb.num(400000), pb.num(500000))
```

A copy of a message the game sent (first row below): bot 16 at full health. Receivers only lower
values, so on a bot with this much or less it changes nothing.

#### What real ones look like

From recordings, numbers decoded. Sent: 6 parts. Received: 7, the sender's slot in front.

| Situation | Message |
|---|---|
| A bot at full health; its parts at the starting shares | as sent `AI_HEALTH_SYNC(16, 1000000, 400000, 600000, 400000, 500000)` |
| A bot killed with its head at 0 | as sent `AI_HEALTH_SYNC(19, -1000, 0, 100, 100, 100)`, as received `AI_HEALTH_SYNC(0, 19, -1000, 0, 100, 100, 100)` |
| A bot far below 0 HP | as received `AI_HEALTH_SYNC(1, 16, -609611, 50, -250220, -249875, -136044)` |
| A boss bot at 2 HP | as received `AI_HEALTH_SYNC(5, 32, 2, 1799999970, 1799999970, 1799999970, 1799999970)` |

#### How it works

1. **Something hurts a bot on this client.** When the local player's hit lands on a bot, and a
   round-state value is 0 (`$cАpОр` = `$ММ.$ОeрoT`, the state a match starts in, inferred
   from `flash.js:5418`), the client calls `$pHсоH` (`frame2.js:32781-32786`). When a bot
   dies on this client, it calls it too (`:35408-35409`); every client that sees the death does.
2. **It waits 200 ms.** Each call cancels the previous timer and starts a new one
   (`frame2.js:8206-8211`), so a burst of hits sends one message with the final values
   (`:8215-8224`). Values are rounded up.
3. **The match server relays it** to every other client with the sender's slot in front
   (`flash.js:4056-4066`). It does not read it.
4. **Each receiver applies it** (`:4784-4805`) under the same test as `AI_STATE_SYNC`: a
   character in play that is not a player (`:4788-4790`). Each of the five values becomes the
   lower of its own and the received one (`:4795-4800`). If HP went down, the bot reacts as hurt
   (`:4802-4803`).

#### Field by field

| Part | Read as | Meaning | Starting share of HP (`frame2.js:7769-7772`) |
|---|---|---|---|
| 1 | number | the bot's slot | |
| 2 | number | HP (`hea`) | |
| 3 | number | head HP, `$ААНММ` | 0.4 |
| 4 | number | body HP, `$НТcep` | 0.6 |
| 5 | number | arms HP, `$lMIсo` | 0.4 |
| 6 | number | legs HP, `$HAрH1` | 0.5 |

Each share has a floor of 30.

**Part 1, the slot.** Ignored unless it holds a bot in play (`flash.js:4788-4790`).

**Part 2, HP.** `Math.min` with the receiver's value (`flash.js:4795`). This message never heals.

**Parts 3 to 6, the body parts.** Also `Math.min` (`flash.js:4797-4800`). The code has no names
for them. Which is which follows from what hits them and what breaks: impact damage on the head
segments lowers part 3, on the chest and hip segments part 4, on the feet part 6, on the two
arm segments part 5 (`frame2.js:24760-24777`). At 0 or below, the receiver's frame code breaks that part off:
legs (`:16278`, `:16296-16297`), arms (`:16370`, `:16389-16390`), body (`:16452`, `:16485`), head
(`:16563`, `:16585`). The old netcode sent the same four as `hh`, `hb`, `ha`, `hl` (`:20355-20358`).

#### Situations

- **Two shooters.** Each shooter's client sends its own result. Receivers keep the lowest of
  each value, so the bot ends up as hurt as the worst report.
- **Not the owner.** Any client that hurts a bot sends this, not only the bot's
  `AI_STATE_SYNC` owner. The next `AI_STATE_SYNC` also carries HP, with the same `Math.min`.
- **Body parts and HP disagree.** A part can reach 0 on one client before HP does; the receiver
  breaks the part off when it applies the message, whatever its own simulation said.
- **For the local server's maintainer.** The server only relays it. A bot that dies on one screen
  and not another: compare the `AI_HEALTH_SYNC` lines; the lower values win wherever they arrive.

### 40 · TASK — lobby → client

Code that the lobby asks the page to run. The page evaluates it as a function, calls it with the
client's build tag, and sends the result back as a `RESPONSE`. The official lobby uses it for its
browser fingerprint ([fingerprinting](fingerprinting.md)). A client does not originate it.

| | |
|---|---|
| Built | by the lobby only; the client has no send site |
| Applied | `flash.js:3730-3749` |
| Only from | the lobby connection `$ММ.$ceTOI` (`:3735`); never on a server-side connection (`:3732`) |
| Guarded | on a private server, by [lobby_task_guard](../features/lobby-task-guard.md) |

#### The console command

None. The message is lobby → client only. A client that sent it would be ignored: a server-side
connection drops it at `flash.js:3732`.

#### What real ones look like

Received from the lobby, as netlog prints them.

| Situation | Message |
|---|---|
| The fingerprint task (netlog cuts the code at 2000 characters) | `TASK("( v )=>{\n…"...(7370 chars), "r")` |
| Its answer, sent | `RESPONSE(110, "<one string>")  <- answers #… TASK` |
| A short task right after joining a match | `TASK(Infinity, "h")` |
| Its answer, sent 25 ms later | `RESPONSE(100, "0")` |

The 45 long tasks in the recordings all call `getBrowserFingerprint`. netlog prints the short
task's code as `Infinity`: the code holds control characters, so netlog tried to read it as a
number (`src/console/kernel/net/codec.ts`, `showPart`).

#### How it works

1. **The lobby sends** the source of a function and a reply id.
2. **The page checks the connection.** It returns at once if this side is a server
   (`flash.js:3732-3733`) or if the message did not come on the lobby connection
   (`:3735-3736`). In a player-hosted match the host cannot send tasks.
3. **The page runs it** with a direct `eval` in the handler's own scope (`:3741`):
   `` result = (<code>)(`<build tag>`) ``. The build tag is `$ерОр0`, the constant
   `"mkpnduz2"` in this build (`frame2.js:5413`). An error is caught and dropped.
4. **The page answers** (`flash.js:3743-3748`): a string, number or boolean as one value, an
   array as several values. Anything else (`undefined`, an object, a `Promise`, an error) sends
   nothing. The answer is a `RESPONSE` whose first part is part 2, unchanged (`:1888`).

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | the source of a function expression |
| 2 | string, echoed | the reply id |

**Part 1, the code.** Must be a function expression: it is wrapped as `(<code>)(…)`. Code that
is not a function throws, and the error is dropped (`flash.js:3741`). The code can read every
local of the handler and every global of the page; nothing limits it
([fingerprinting](fingerprinting.md) §4.4).

**Part 2, the reply id.** Not decoded: it is passed back as the first part of the `RESPONSE`
(`flash.js:3743`, `:1888`), so the lobby gets back exactly what it sent.

#### Situations

- **Private servers.** Joining one makes it the lobby, so its operator could run code in the
  page. The `lobby_task_guard` feature replaces each task's code with `()=>undefined` before the
  game reads it, so nothing runs and nothing is answered.
- **Logging.** netlog writes the code cut at 2000 characters, or whole with `net_log_all` on.

### 41 · TASK_ASNYC — lobby → client

The same as `TASK`, except that the code gets a callback and answers through it, later if it
wants. A client does not originate it. No recording contains one.

| | |
|---|---|
| Built | by the lobby only; the client has no send site |
| Applied | `flash.js:3751-3773` |
| Only from | the lobby connection (`:3756`); never on a server-side connection (`:3753`) |
| Guarded | on a private server, by [lobby_task_guard](../features/lobby-task-guard.md) |

#### The console command

None. The message is lobby → client only.

#### What real ones look like

None recorded. The wire form is the same as `TASK`:

```
TASK_ASNYC(<function source>, <reply id>)
```

#### How it works

1. **The same checks as `TASK`** (`flash.js:3753-3757`).
2. **The page builds a callback** (`:3763-3770`) that answers like `TASK`: a string, number or
   boolean as one value, an array as several, anything else nothing.
3. **It runs the code** as `` (<code>)(`<build tag>`, <callback>) `` (`:3772`). The `eval`
   itself is synchronous; the code may keep the callback and call it later, for example when a
   `Promise` settles. Errors thrown during the `eval` are dropped.

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | string | the source of a function expression taking (build tag, callback) |
| 2 | string, echoed | the reply id |

**The callback answers once.** A second call throws inside the caller's code (`flash.js:1870-1875`)
and sends nothing. Never calling it sends nothing.

#### Situations

- **Private servers.** `lobby_task_guard` replaces the code as for `TASK`; `()=>undefined` never
  calls the callback, so nothing is answered.

### 42 · YOU_ARE_STILL_DEAD — match server → client

The match server tells a player that, on the server, they are dead. The client sets its own
player's HP to 0. It is sent when a client keeps reporting HP above 0 after the server's copy of
that player died. A client does not originate it.

| | |
|---|---|
| Built | `flash.js:1109`, in the match server's handling of a player's state |
| Applied | `:3511-3524` |
| Only from | in a player-hosted match, the host (`:3516`, `:1836-1862`) |

#### The console command

None. The message is server → client only. A client that sent it would be ignored: the handler
returns on a server-side connection (`flash.js:3513-3514`).

#### What real ones look like

Received, no parts:

```
YOU_ARE_STILL_DEAD()
```

It comes in series, about one a second: 08:41:47.836, 48.674, 49.857, 50.761 … in one recording,
which holds 2852 of them over about 50 minutes. The recording does not show why that client kept
reporting HP above 0.

#### How it works

1. **The client reports its HP** in every state packet (part 6 of the state).
2. **The match server compares** (`flash.js:884-936`). It only looks when the player is in a
   match, has asked for the first sync (`:887`, set at `:3402`), is not spectating (`:891`), and
   the state's respawn counter matches the server's (`:897-899`). If the server's copy is dead
   (HP 0 or less, `:930`) and the client is not within a revive window (`:934-936`), the
   reported HP is not accepted.
3. **It waits a second.** If the reported HP is above 0 (`:1098-1099`), the first such state
   starts a one-second timer (`:1102-1104`). A state after the timer runs out sends
   `YOU_ARE_STILL_DEAD` and starts the timer again (`:1107-1111`). An accepted state (`:1094`) or
   a `RESPAWN` (`:3855`) clears the timer.
4. **The client applies it** (`:3511-3524`): if its own player's HP is above 0, it becomes 0.
   The client's own frame code then handles the death. There is no answer.

The revive window is the 3 seconds after a teammate's no-damage hit on a downed player
(`flash.js:6948-6957`, see `HIT_PLAYER`), while the state's parts 12 and 13 are both above 0
(`:924-926`).

#### Situations

- **A missed death.** The server killed the player (a hit that the victim's client did not see,
  or saw as smaller) but the client still shows them alive. One second later this message
  corrects the client.
- **A client that will not die.** A client that keeps reporting HP above 0 gets one every
  second. The server's copy stays dead until the next `RESPAWN`.
- **For the local server's maintainer.** A steady stream of these for one player means that
  player's client and the server disagree about whether the player is alive. Check the player's
  `RESPAWN` messages and the state's respawn counter.

### 43 · ENTER_RESPAWN_QUEUE — client → match server, answered

A dead player asks for permission to respawn. With the `v2` respawn model, the match server lets
one player respawn at a time; the answer `"k"` means "your turn, pick a spawn point now".

| | |
|---|---|
| Built | `frame2.js:42272-42278` |
| Handled by the match server | `flash.js:3775-3809` |
| Queue | granted one at a time in the match tick, `:6228-6273` |
| Answered | `RESPONSE [<reply id>, "k"]` when granted, `["n"]` when refused or dropped |
| Only with | `respawn_model` `"v2"`, in DM and TDM (`frame2.js:42261`, `:42272`) |

#### The console command

```
js pb.req("ENTER_RESPAWN_QUEUE", ["REPLY"])
```

`pb.req` sends on the lobby connection, so this only reaches a match the lobby runs; for a
player-hosted match the lobby answers `"n"`. The game sends it only while its player is dead. A
grant you do not use holds the queue for 3 seconds, and every other dead player waits.

#### What real ones look like

From a recording, in order. netlog prints the reply id as the raw character (`"j"` is id 102).

| What | Message |
|---|---|
| The request, sent | `ENTER_RESPAWN_QUEUE("j")` |
| The grant, received 263 ms later | `RESPONSE(102, "k")  <- answers #168 ENTER_RESPAWN_QUEUE` |
| The respawn, sent 470 ms later | `RESPAWN(6582, -847, 450)` |
| The same respawn relayed back, with the slot in front | `RESPAWN(3, 6582, -847, 450, 1)` |

All 153 answers in the recordings are `"k"`.

#### How it works

1. **The dead client asks.** After death a screen overlay fades in (`frame2.js:42204-42225`).
   When it is fully opaque (`:42247`), the client is in a multiplayer match, not on the exit
   screen, not spectating (`:42251-42253`), the game type is DM or TDM (`:42261`), and no request
   is pending (`:42263-42268`), it sends the request with the `v2` model (`:42272-42278`). Without
   `v2` it picks a spawn point at once (`:42726`).
2. **The match server queues it** (`flash.js:3775-3809`). It answers `"n"` at once if the player
   is not in a match (`:3783-3786`), if the match is player-hosted and this is the lobby
   (`:3788-3791`), or if the player is already queued (`:3793-3796`). Otherwise it adds the
   connection and its answer to the queue `$lOрplр` / `$MToo0T` (`:3801-3806`).
3. **The match grants one at a time** (`:6228-6273`). If the first in the queue has no grant, it
   gets one, valid 3 s (`$ММ.$OMIHОe`, `:21`), and the answer `"k"` (`:6267-6270`). A grant
   that runs out is dropped and the next player is served (`:6253-6262`).
4. **The client picks a spot.** On `"k"` it searches for a spawn point for at most
   max(100, 400 − ping) ms (`frame2.js:42302`, `$ММ.$OоАoOp`, `flash.js:20`), then sends
   `RESPAWN` (`frame2.js:42923`). On any other answer it clears the pending flag
   (`:42288-42291`) and asks again on a later frame.
5. **The server checks the respawn** (`flash.js:3833-3848`). If this player holds the grant and
   is first, the grant is used up (`:3836-3842`). Otherwise it writes a warning to the match chat
   (`:3845`, `:3847`), but the respawn still happens.

#### Field by field

| Part | Read as | Meaning |
|---|---|---|
| 1 | reply id | where the answer goes |

**Part 1, the reply id.** The only part the handler reads (`flash.js:3781`). The answer is
`"k"` for a grant, `"n"` for a refusal (`:3785`, `:3790`, `:3795`), or `"n"` when the player
leaves the match before being granted (`:6882-6893`). A player who leaves after the grant already
had its `"k"`; its entry is only removed.

#### Situations

- **Why a queue.** The code does not say. Each client picks its own spawn point
  (`frame2.js:42299-42725`), and a grant lasts until that player's `RESPAWN` arrives or 3 s
  pass. So the next player's search starts after the last one's `RESPAWN` has been relayed, and
  can take the new body into account (inferred from the order: grant, search, respawn).
- **Stale answers.** The client stamps each request with a map-load counter (`frame2.js:42270`,
  incremented at `:10538`) and ignores an answer from before the last map load (`:42285-42286`).
- **The queue is advisory.** A `RESPAWN` without a grant is accepted with a chat warning
  (`flash.js:3845-3847`). A modified client can skip the queue; the warning shows it.
- **Map change.** On a map change the server empties the queue of connections (`flash.js:5747`) but not
  the list of answers `$MToo0T`. If anyone was waiting, the next grant goes to a stale answer
  (inferred from the code, not seen in a recording): the newly queued player gets no `"k"` until
  the stale entries run out, 3 seconds each, and may respawn later with the warning.
- **For the local server's maintainer.** A player stuck on the death screen in DM or TDM: look
  for an `ENTER_RESPAWN_QUEUE` without a `RESPONSE`, and for the chat warnings above.

## The state message

Position, velocity, HP, the cursor, the keys held and the projectiles in flight travel in the
unreliable state message, not in any message above. Its parts, what the server does with them
and how the cursor gets from the mouse to the other screens are in
[protocol-state.md](protocol-state.md).

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

- The *state* message, in [protocol-state.md](protocol-state.md).
- What the lobby decides to do with a message once it has it — the account module is not
  shipped ([reputation.md](reputation.md)).
- The private server's side of the same protocol: it runs this very code
  ([private-server](../operations/private-server.md)).
