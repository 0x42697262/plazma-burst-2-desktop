# Crafting messages: copy-paste lines

Every message a client can put on the wire, as a line you can paste into the dev console
([js](../features/js-eval.md)). The messages themselves, their parts and their checks are in
[protocol.md](protocol.md); this file is the "how do I send one" half.

Line numbers refer to `game/scripts/libs/flash.js` (decoded, as `npm run find-names -- --decode`
prints them). Nothing here needs a build: the page already has everything.

## Once per page load

```
js globalThis.pb={N:PB2_NAMES,M:(0,eval)(PB2_NAMES.net),log:[]};pb.C=()=>pb.M[pb.N.lobbyConn];pb.num=v=>pb.M[pb.N.netNum](v);pb.req=(name,parts)=>new Promise(done=>{const list=parts.map(p=>p==="REPLY"?pb.M[pb.N.netReplyTo]:p);pb.C()[pb.N.netSend](pb.M[pb.N.netChannel],[pb.M["RELIABLE_"+name],...list],r=>{const v=Array.from(r);pb.log.push({name,reply:v});done(v)})});pb.event=(name,...parts)=>{pb.M.Event(pb.M["RELIABLE_"+name],...parts);return true};pb.last=()=>JSON.stringify(pb.log.at(-1));"pb ready"
```

What you just built:

| | |
|---|---|
| `pb.req(name, parts)` | a **lobby** request: takes `"REPLY"` as a marker, swaps it for the reply placeholder, returns a promise of the answer. A wrong name or a dead connection leaves the promise pending forever — that is the usual reason "nothing happened". |
| `pb.event(name, ...parts)` | a **match** message, through the game's own `Event`, which picks the connection and does not expect an answer. |
| `pb.num(n)` | the game's number encoder, for parts the receiver reads as numbers. Sending a plain string works too (`parseInt` on the other side), so most examples below use strings. |
| `pb.log`, `pb.last()` | the last answers, stringified. `js pb.last()` after about 300 ms. |
| `pb.C()` | the lobby connection. In a match the gameplay connection is `pb.M[pb.N.p2pConn]`, and `pb.event` handles that for you. |

Two rules that save you an evening: a lobby request must be on `pb.N.lobbyConn` (that is the
socket the lobby answers on), and a gameplay message must go through `Event` (it routes to the
match server). Sending a gameplay message on the lobby socket gets you silence.

## Match list

```
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "match_list"])
js pb.last()
```

Variations — the third value is the view, the first is the filter:

```
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "relations"])
js pb.req("GET_MATCH_LIST", ["{}", "REPLY", "skill_board"])
js pb.req("GET_MATCH_LIST", [JSON.stringify({delete_relation: pb.lastRelationSince}), "REPLY", "relations"])
```

One every 300 ms per connection; sooner gets `["fail","Match listing error: Too fast"]`. The
answer is `["ok", <rows JSON string>, <your own JSON string>]` — parse the second value to get
`reputation`, `reputation_potential`, `skill`, `wins`, `loses`, `online`, `matches`.

## Create a match

```
js pb.req("CREATE_MATCH", [JSON.stringify({title:"probe",game_type:"DM",max_players:8,min_reputation:0,map_id:"random approved",ranked:false}), "REPLY"])
```

Answers `["ok", <match uid>]` or `["fail", <why>]`. The `min_reputation` you ask for is lowered
to your own reputation, `max_players` is clamped to 1..64, and one create a second is the limit
(`:2667-2684`, `:2686`).

## Join a match

```
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", -1, "", ""])
```

| Variation | Parts |
|---|---|
| own slot | `["<uid>", "REPLY", 3, "", ""]` — the slot you ask for |
| spectate | `["<uid>", "REPLY", -1, "1", ""]` |
| password | `["<uid>", "REPLY", -1, "", "the password"]` |

Answers `["ok", <match details JSON>, <slot>]` or `["fail","Match join error: <why>."]`. Every
refusal in order is listed in [protocol.md](protocol.md#20--join_match--client--lobby).

## Chat, and the owner's commands

```
js pb.event("CHAT", pb.num(1), "hello")
js pb.event("CHAT", pb.num(1), "-min_reputation 1")
```

Part 1 is the destination number (1 = everyone), part 2 the text, trimmed at 240 characters,
five messages a second. Everything that starts with `-` is the owner/staff command parser
(`:4029-4033`), so the second line only does something if you own the match.

## Report, endorse, kick, ban

```
js pb.req("REPORT_USER",   ["<auth id>", "REPLY"])
js pb.req("ENDORDSE_USER", ["<auth id>", "REPLY"])
js pb.req("KICK_USER",     ["<auth id>", "REPLY", "1"])
js pb.req("BAN_USER",      ["<auth id>", "REPLY"])
```

- The target is an **auth id**, not a nickname: `accounts` prints them
  ([player-info](../features/player-info.md)), and it changes on every join.
- Part 3 on `KICK_USER` is `"1"` to keep them out, `""` to only remove them.
- `BAN_USER` needs staff (`:2886`); a report or endorsement to yourself answers
  `Error: Can't do this to yourself` (`:2871`).
- Endorsing twice removes the relation; the replies and what they mean are in
  [reputation-probe.md](reputation-probe.md#observed-so-far).

## Ping

```
js pb.req("PING", ["REPLY"])
```

The answer is `[]`; the round trip is your ping. The page measures it from the same message, so
this is the cheapest "is my socket alive" check.

## Mark yourself as a host

```
js pb.req("LIST_ME_AS_HOST", ["REPLY"])
```

## Your own player fields

```
js pb.event("MY_PLAYER_PROPERTIES_CHANGED", pb.num(0), pb.num(0), JSON.stringify(1))
```

Pairs after the opcode: **property index, JSON value**. The index addresses this whitelist and
nothing else (`:216-221`, `:3576-3620`):

| Index | Property |
|---|---|
| 0 | `team` |
| 1 | `skin_snapshot` |
| 2-11 | `slot0` … `slot9` (the gun in that slot) |
| 12 | `curwea` |

The example sets `team` to `1`. A value the match rejects (a gun you do not hold, a slot that
does not exist) is undone by the server, which writes the old value back on your own player.

## Respawn

```
js pb.req("ENTER_RESPAWN_QUEUE", ["REPLY"])
js pb.event("RESPAWN", pb.num(0), pb.num(0), pb.num(100))
```

The first answers `["n"]` when there is nothing to join (no match, not allowed, already queued)
and `[true]`/`[false]` later when the queue grants or refuses the slot (`:3775-3808`). The
second is the respawn itself: parts 1-2 are the position, part 3 the HP you claim; under
`respawn_model: "v2"` it only works from the head of the queue, and the server rewrites part 4
with your new respawn counter (`:3830-3863`).

## A gameplay message, by hand

```
js pb.event("VAR_SYNC", "r", "varname", "1")
js pb.event("EXEC_TRIGGER", pb.num(0), pb.num(0), pb.num(100))
js pb.event("HIT_PLAYER", pb.num(1), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(10), pb.num(0))
```

In order: a map variable set to `1`, trigger 0 run by player 0, and a 0.1-damage hit
(`10/100`) on slot 1 with every other field zeroed. The last one is the clearest illustration of
who checks what: the match server keeps its own copy of the victim's HP, subtracts the damage
after its checks, and rewrites the message for the other clients — see
[protocol.md](protocol.md#4--hit_player--client--match-server--every-client-in-the-match).

The complete parts list of every gameplay message is in [protocol.md](protocol.md); the recipe
is always the same, `pb.event("<NAME>", …)` in order.

## Loops, and reading what came back

```
js globalThis.run=[];(()=>{const t=["<auth id>","<auth id>"];let i=0;const step=()=>{if(i>=8)return;pb.req("ENDORDSE_USER",[t[i++%2],"REPLY"]).then(step)};step()})()
js JSON.stringify(pb.log)
```

`pb.log` collects every answer with the message name, so one line at the end shows the whole
batch. Watch the toggle in [reputation-probe.md](reputation-probe.md): an even number of
endorsements leaves an account where it started.

## When nothing comes back

1. `pb.C()` must be truthy — you have to be logged in. `js !!pb.C()`.
2. The name must exist: `js pb.M["RELIABLE_ENDORDSE_USER"]` prints a number. A typo gives
   `undefined`, and `Event` then sends nothing.
3. The server may simply not answer: gameplay messages never do, and a lobby message the server
   rejects by design (the tamper report) does not either.
4. `net_log on` + `netlog show` shows the same traffic with the type names and the numbers
   decoded, which is faster than guessing ([netlog](../features/netlog.md)).
