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
js pb.match={ranked:false,max_players:8,game_type:"DM",min_reputation:0,map_rotation:"random approved in rotation",title:"probe",map_id:"random approved in rotation",password:"",gameplay_modifications:"",ping_limit:"",rounds_until_rotation:"15",round_duration_str:"default",round_duration:0,p2p:false,p2p_region:"",exclude_inactive_players:true,allow_vpn_guests:1,ping_limit_action:"spectate",respawn_model:"v2",accept_connections_manually:false}
js pb.req("CREATE_MATCH", [JSON.stringify(pb.match), "REPLY"])
```

The first line holds every key the game sends (`MPCreateMatch.js:73-101`); keep them all, since
a missing `password` becomes the string `"undefined"` and locks the match (`:2700`). Answers
`["ok", "", -1]` (`:2829`) or `["fail", <why>]`. The `min_reputation` you ask for is lowered to
your own reputation (`:2686`) and `max_players` is clamped to 1..64. The lobby refuses a create
only in the first second after you connect (`connection.js:444`). Variants (password, COOP,
TDM, player-hosted) are in [protocol.md](protocol.md#15--create_match--client--lobby).

## Join a match

```
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", -1, "1", ""])
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", -100, "1", ""])
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", 3, "1", ""])
js pb.req("JOIN_MATCH", ["<match uid>", "REPLY", -1, "1", "<password>"])
js pb.req("JOIN_MATCH", [-1, "REPLY", -1, "", ""])
```

A plain join; as a spectator (slot `-100`); slot 3 if it is free; with a password; and leaving
the current match. Part 4 `"1"` asks the lobby to send the map. Answers `["ok", <p2p info>,
<host id>]` or `["fail", "<why>"]`; the match details and your slot arrive separately, in
`MATCH_JOIN_RESPONSE`. Every refusal in order is listed in [protocol.md](protocol.md#20--join_match--client--lobby).

## Chat, and the owner's commands

```
js pb.event("CHAT", pb.num(1), "hello")
js pb.event("CHAT", pb.num(2), "hello team")
js pb.event("CHAT", pb.num(1), "-min_reputation 1")
```

Part 1 is the destination (2 = your team, `:4038`), part 2 the text. It reaches only the match
you are in: the lobby ignores chat from a player who is not in one (`:1806-1811`). The text is
cut at 240 characters while you stay under five lines a second (`:4019`). A line that starts
with `-` goes to the owner and staff command parser; `-min_reputation 1` works for anyone while
the match is at 0 (`:4993`). The commands are listed in
[protocol.md](protocol.md#14--chat--client--lobby--every-client-in-the-senders-match).

## Report, endorse, kick, ban

```
js pb.req("REPORT_USER",   ["<auth id>", "REPLY"])
js pb.req("ENDORDSE_USER", ["<auth id>", "REPLY"])
js pb.req("KICK_USER",     ["<auth id>", "REPLY", "0"])
js pb.req("BAN_USER",      ["<auth id>", "REPLY"])
```

- The target is an **auth id**, not a nickname: `accounts` prints them
  ([player-info](../features/player-info.md)), and it changes on every join.
- A kick always keeps the target out of that match, by account, address and device
  (`:7183-7227`). Part 3 on `KICK_USER` matters only for a guest: `"1"` also bars the uid every
  guest shares, so it keeps all guests out (`:7204-7208`); `"0"` bars only this one.
- `BAN_USER` needs staff (`:2886`); a report or endorsement to yourself answers
  `Error: Can't do this to yourself` (`:2871`).
- Endorsing twice removes the relation; the replies and what they mean are in
  [reputation-probe.md](reputation-probe.md#observed-so-far).

## Ping

```
js pb.C().ping
```

The ping the client measured on the lobby connection, in ms: how long the last reliable message
took to be acknowledged (`connection.js:1047-1048`). A `PING` you send yourself gets no answer:
the lobby only reads the anti-tamper report form and drops the rest (`flash.js:3068-3074`). For
an "is my socket alive" check, ask for the match list (above) instead.

## Your own player fields

```
js pb.event("MY_PLAYER_PROPERTIES_CHANGED", pb.num(12), JSON.stringify(-1))
```

Pairs after the opcode: **property index, JSON value**. The index addresses this whitelist and
nothing else (`:216-221`, `:3576-3620`):

| Index | Property |
|---|---|
| 0 | `team` |
| 1 | `skin_snapshot` |
| 2-11 | `slot0` … `slot9` (the gun in that slot) |
| 12 | `curwea` |

The example is the pair the game sends when you put your gun away: `curwea` set to `-1`. There
is no slot in front: the server adds yours. A value the match rejects (a gun you do not hold, a slot that
does not exist) is undone by the server, which writes the old value back on your own player.

## Respawn

```
js pb.req("ENTER_RESPAWN_QUEUE", ["REPLY"])
js pb.event("RESPAWN", pb.num(0), pb.num(0), pb.num(100))
```

The first answers `"n"` when it is refused or dropped and `"k"` when the queue grants you the
respawn (`:3775-3809`, `:6270`, `:6890`). The game sends it only while its player is dead, and a
grant you do not use holds the queue for 3 seconds. The second is the respawn itself: parts 1-2
are the position and part 3 the HP, which the game always sends as its own `hmax`. Under
`respawn_model: "v2"` it is meant to come from the head of the queue (the server only warns in
chat otherwise), and the server writes your new respawn counter into part 4 (`:3830-3864`).

## Gameplay messages

Each message's section in [protocol.md](protocol.md) has a "The console command" part with its
lines, one per variant, because the parts differ enough that a single example would mislead.
The recipe is always:

```
js pb.event("NAME", part1, part2)
```

`pb.event` goes through the game's own `Event`, which routes to the match server and expects no
answer. Numbers the receiver parses can be sent as strings (`pb.num` is shorthand for the
game's encoder and is what the game itself uses), and a part the receiver never reads may be
anything — `0` is the safe filler.

Three worth knowing before you try them:

| Message | Line | Why it is interesting |
|---|---|---|
| `HIT_PLAYER` | [protocol.md](protocol.md#4--hit_player--client--match-server--every-other-client) | the match server subtracts the damage on its own copy and rewrites the message; the receiver clamps what it is told |
| `VAR_SYNC` | [protocol.md](protocol.md#36--var_sync--client--match-server--every-other-client) | five merge modes; only keep-larger and keep-smaller give every client the same value whatever the order |
| `AI_HEALTH_SYNC` | [protocol.md](protocol.md#39--ai_health_sync--client--match-server--every-other-client) | a receiver keeps the lower of its own HP and the one it is told, so it never heals a bot |

## Every section's line, gathered

The first line of each message's "The console command" in [protocol.md](protocol.md), and how
many lines that section has. Most sections have several, one per variant; read the section
before sending. A message with no line is one a client does not originate, or one whose only
hand-made form would do something the game never does. Regenerated from protocol.md, so the two
cannot disagree.

| Op | Message | First line | Lines in its section |
|---|---|---|---|
| [0](protocol.md#0--response--answering-side--asking-side-never-relayed) | `RESPONSE` | `pb.req("GET_MATCH_LIST", ["{}", "REPLY", "match_list"])` | 1 |
| [1](protocol.md#1--exec_trigger--client--match-server--every-other-client) | `EXEC_TRIGGER` | `pb.event("EXEC_TRIGGER", pb.num(0), "", "")` | 1 |
| [2](protocol.md#2--respawn--client--match-server--every-client-the-sender-too) | `RESPAWN` | `pb.event("RESPAWN", pb.num(0), pb.num(0), pb.num(100))` | 1 |
| [3](protocol.md#3--grenade_throw--reserved-sent-by-nobody) | `GRENADE_THROW` | `pb.event("GRENADE_THROW", pb.num(1), pb.num(0), pb.num(0))` | 1 |
| [4](protocol.md#4--hit_player--client--match-server--every-other-client) | `HIT_PLAYER` | `pb.event("HIT_PLAYER", pb.num(1), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(0), pb.num(10), pb.num(0))` | 1 |
| [5](protocol.md#5--damage_players_via_explosion--client--match-server--every-other-client) | `DAMAGE_PLAYERS_VIA_EXPLOSION` | `pb.event("DAMAGE_PLAYERS_VIA_EXPLOSION", pb.num(0), pb.num(1), pb.num(0), pb.num(0), "", "", "", pb.num(0), "", "", "", "", pb.num(0), pb.num(0), pb.num(0))` | 1 |
| [6](protocol.md#6--heal_player--client--match-server--every-other-client) | `HEAL_PLAYER` | `pb.event("HEAL_PLAYER", pb.num(100), pb.num(0), pb.num(1), pb.num(0))` | 1 |
| [7](protocol.md#7--projectile_create--client--match-server--every-other-client) | `PROJECTILE_CREATE` | `pb.event("PROJECTILE_CREATE", pb.num(0), pb.num(1), pb.num(0), pb.num(0), pb.num(0))` | 1 |
| [8](protocol.md#8--projectile_remove--client--match-server--every-other-client) | `PROJECTILE_REMOVE` | `pb.event("PROJECTILE_REMOVE", pb.num(1), pb.num(0), pb.num(0))` | 1 |
| [9](protocol.md#9--barrel--client--match-server--every-other-client) | `BARREL` | none: a hand-made one would do what the game never does; see the section | 0 |
| [10](protocol.md#10--throw_gun--client--match-server--every-other-client) | `THROW_GUN` | none: a hand-made one would do what the game never does; see the section | 0 |
| [11](protocol.md#11--hit_grenade--client--match-server--every-other-client) | `HIT_GRENADE` | `pb.event("HIT_GRENADE", pb.num(1), pb.num(0), pb.num(0), pb.num(0))` | 1 |
| [12](protocol.md#12--player_dies--match-server--every-client) | `PLAYER_DIES` | none: match server → every client | 0 |
| [13](protocol.md#13--hit_shield--client--match-server--every-other-client) | `HIT_SHIELD` | `pb.event("HIT_SHIELD", pb.num(1), pb.num(100), pb.num(10), pb.num(0))` | 1 |
| [14](protocol.md#14--chat--client--lobby--every-client-in-the-senders-match) | `CHAT` | `pb.event("CHAT", pb.num(1), "hello")` | 4 |
| [15](protocol.md#15--create_match--client--lobby) | `CREATE_MATCH` | `pb.match={ranked:false,max_players:8,game_type:"DM",min_reputation:0,map_rotation:"random approved in rotation",title:"probe",map_id:"random approved in rotation",password:"",gameplay_modifications:"",ping_limit:"",rounds_until_rotation:"15",round_duration_str:"default",round_duration:0,p2p:false,p2p_region:"",exclude_inactive_players:true,allow_vpn_guests:1,ping_limit_action:"spectate",respawn_model:"v2",accept_connections_manually:false}` | 6 |
| [16](protocol.md#16--authenticate--client--lobby) | `AUTHENTICATE` | `pb.req("AUTHENTICATE", ["<login>", "<password>", "version_h5", "hash_h5", "REPLY", "<nickname>", "\"<device id>\"", "1769098189070"])` | 2 |
| [17](protocol.md#17--list_me_as_host--reserved-never-sent) | `LIST_ME_AS_HOST` | none: reserved, never sent | 0 |
| [18](protocol.md#18--service_message--lobby-or-player-host--client-shown-in-chat) | `SERVICE_MESSAGE` | none: lobby or player host → client, shown in chat | 0 |
| [19](protocol.md#19--get_match_list--client--lobby) | `GET_MATCH_LIST` | `pb.req("GET_MATCH_LIST", ["{}", "REPLY", "match_list"])` | 4 |
| [20](protocol.md#20--join_match--client--lobby) | `JOIN_MATCH` | `pb.req("JOIN_MATCH", ["<match uid>", "REPLY", -1, "1", ""])` | 5 |
| [21](protocol.md#21--match_join_response--lobby--client) | `MATCH_JOIN_RESPONSE` | none: lobby → client | 0 |
| [22](protocol.md#22--map_chunk--lobby--client) | `MAP_CHUNK` | none: lobby → client | 0 |
| [23](protocol.md#23--client_ready_for_first_sync--client--lobby) | `CLIENT_READY_FOR_FIRST_SYNC` | `pb.event("CLIENT_READY_FOR_FIRST_SYNC")` | 1 |
| [24](protocol.md#24--first_sync_response--lobby--client) | `FIRST_SYNC_RESPONSE` | none: lobby → client | 0 |
| [25](protocol.md#25--my_player_properties_changed--client--match-server--every-other-client) | `MY_PLAYER_PROPERTIES_CHANGED` | `pb.event("MY_PLAYER_PROPERTIES_CHANGED", pb.num(12), JSON.stringify(-1))` | 1 |
| [26](protocol.md#26--ping--lobby--client-answered-client--lobby-only-as-the-scan-report) | `PING` | `pb.C().ping` | 2 |
| [27](protocol.md#27--report_user--client--lobby) | `REPORT_USER` | `pb.req("REPORT_USER", ["<auth id>", "REPLY"])` | 2 |
| [28](protocol.md#28--endordse_user--client--lobby) | `ENDORDSE_USER` | `pb.req("ENDORDSE_USER", ["<auth id>", "REPLY"])` | 2 |
| [29](protocol.md#29--kick_user--client-match-owner-or-staff--lobby) | `KICK_USER` | `pb.req("KICK_USER", ["<auth id>", "REPLY", "0"])` | 2 |
| [30](protocol.md#30--match_info_partial_udpate--match-server--every-client-in-the-match) | `MATCH_INFO_PARTIAL_UDPATE` | none: match server → every client in the match | 0 |
| [31](protocol.md#31--player_score_update--match-server--every-client-in-the-match) | `PLAYER_SCORE_UPDATE` | none: match server → every client in the match | 0 |
| [32](protocol.md#32--play_sound--match-server--client) | `PLAY_SOUND` | none: match server → client | 0 |
| [33](protocol.md#33--ban_user--client-staff--lobby) | `BAN_USER` | `pb.req("BAN_USER", ["<auth id>", "REPLY"])` | 1 |
| [34](protocol.md#34--ressurect--client--match-server--every-client-the-sender-included) | `RESSURECT` | `pb.event("CHAT", pb.num(1), "-endround")` | 1 |
| [35](protocol.md#35--sword_attack--client--match-server--every-other-client) | `SWORD_ATTACK` | `pb.event("SWORD_ATTACK")` | 1 |
| [36](protocol.md#36--var_sync--client--match-server--every-other-client) | `VAR_SYNC` | `pb.event("VAR_SYNC", "r", "var_suddendeath", "11")` | 5 |
| [37](protocol.md#37--flow_at--client--match-server--every-other-client) | `FLOW_AT` | `pb.event("FLOW_AT", pb.num(6433), pb.num(-360), pb.num(0), pb.num(-163), pb.num(-287), pb.num(3))` | 1 |
| [38](protocol.md#38--ai_state_sync--client--match-server--every-other-client) | `AI_STATE_SYNC` | `pb.event("AI_STATE_SYNC", pb.num(16), pb.num(1000000), pb.num(850), pb.num(1), pb.num(0), pb.num(0), pb.num(740), pb.num(0), pb.num(-1), pb.num(4), pb.num(157), pb.num(309), pb.num(854), pb.num(0))` | 1 |
| [39](protocol.md#39--ai_health_sync--client--match-server--every-other-client) | `AI_HEALTH_SYNC` | `pb.event("AI_HEALTH_SYNC", pb.num(16), pb.num(1000000), pb.num(400000), pb.num(600000), pb.num(400000), pb.num(500000))` | 1 |
| [40](protocol.md#40--task--lobby--client) | `TASK` | none: lobby → client | 0 |
| [41](protocol.md#41--task_asnyc--lobby--client) | `TASK_ASNYC` | none: lobby → client | 0 |
| [42](protocol.md#42--you_are_still_dead--match-server--client) | `YOU_ARE_STILL_DEAD` | none: match server → client | 0 |
| [43](protocol.md#43--enter_respawn_queue--client--match-server-answered) | `ENTER_RESPAWN_QUEUE` | `pb.req("ENTER_RESPAWN_QUEUE", ["REPLY"])` | 1 |

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
