# Reputation

Reputation points are the lobby's, not the game's: the page never computes one, it only
shows what the lobby sends and forwards two requests that ask the lobby to move somebody
else's points. Checked against game build v1769098419 (`game/pb2-version.json`). The
commands under [Re-checking](#re-checking) print every line cited here.

## The account module

The lobby's account module is where an account and its reputation live. It is **not in the
game files**: on the page it is a stand-in with three no-ops (`scripts/libs/flash.js:345`).
Only the official lobby runs the real one. What the lobby code calls on that module:

| Call | Means | `src/server/game.ts` |
|---|---|---|
| `$ITTНрl(connection, version, hash, login, password, uid, device, callback)` | log in; the callback gets the profile or why not | `authLogin` |
| `$HpААоe(targetId, initiatorId)` | a report ("unsuitable") | `authReport`, `:156` |
| `$peеHeН(targetId, initiatorId)` | an endorsement ("good fit") | `authEndorse`, `:157` |
| `$ТОIсe(connection)` | the account's potential reputation | not answered |
| `$0еMlMp(relation, time)` | end a relation by its own side | not answered |
| `$1OoOН`, `$IIрМeT`, `$T0ОHОс` | connection → auth id, auth id → record, record → auth id | `authRecords`, `p2pAuthIds` |
| `$оlеоН(connection, kind, text, match)` | a log line | `authLog` |

The two reputation calls answer with one **string** each, which the lobby passes to the
player as chat. No numbers cross this boundary.

## Requests and replies

A reliable message is an array whose first element is the opcode. Opcodes are not fixed
constants: they come from a counter in load order (`scripts/libs/flash.js:82`), so name them
by their `RELIABLE_…` field. With v1769098419, counting from 0:
`RELIABLE_RESPONSE` 0, `RELIABLE_AUTHENTICATE` 16, `RELIABLE_GET_MATCH_LIST` 19,
`RELIABLE_JOIN_MATCH` 20, `RELIABLE_REPORT_USER` 27, `RELIABLE_ENDORDSE_USER` 28.

A message that wants an answer carries the shared placeholder object
(`Multiplayer.$p1еeс`, `scripts/libs/flash.js:77`) in the slot where the
reply id goes. The sender swaps it for its own counter and files the callback under it
(`scripts/connection.js:693`). The answer is a `RELIABLE_RESPONSE` whose first value is that
id (`scripts/libs/flash.js:1868`, `:1888`), so a reply is
`[<RELIABLE_RESPONSE>, <reply id>, <value>, …]`.

| Sent | Array | Reply |
|---|---|---|
| `RELIABLE_AUTHENTICATE` | `[op, login, password, version, hash, <reply id>, uid, device, timestamp]` | `["ok", <profile JSON>]` or `["fail", <why>]` |
| `RELIABLE_REPORT_USER` | `[op, <target auth id>, <reply id>]` | `[<chat string>]` |
| `RELIABLE_ENDORDSE_USER` | `[op, <target auth id>, <reply id>]` | `[<chat string>]` |
| `RELIABLE_GET_MATCH_LIST` | `[op, <filter JSON>, <reply id>, <view>]` | `["ok", <rows JSON>, <own JSON>]` or `["fail", …]` |

The login profile has no reputation in it (`scripts/libs/flash.js:2007-2018`): you learn
your own only from a list reply, and other players' only from a match.

### Report and endorse

The client sends the target's **auth id** and nothing else — no amount, no reason, no text,
no rating (`scripts/screens/HUD.js:2066` for report, `:2128` for endorse). The lobby reads
it as an integer, looks the target up by that id (`scripts/libs/flash.js:2855`), refuses
yourself (`:2871`), and asks the account module (`:2879`, `:2882`). Answers seen in the code:

- `Error: Can't do this to yourself`
- `Error: Target user wasn't online for too long` — the auth id no longer resolves
- `Error: Not a staff` — only on the ban path (`:2887`)

The action is logged as `<message name>*<target login>*<target nickname>` (`:2922`) and the
player sees the module's string in chat. There is no message that sets a reputation
directly, for yourself or for anybody else.

### Match list, relations, skill board

One request serves three lists; the fourth element picks which:
`"match_list"`, `"relations"` or `"skill_board"` (`scripts/screens/MPLobby.js:210` builds the
array, `:663-667` sends it).
The filter is `{}` normally, or `{"delete_relation": <since>}` to end a relation you started
(`MPLobby.js:584`); the lobby then calls `$0еMlMp` (`flash.js:2582`). One request per 300 ms
per connection, or `["fail", "Match listing error: Too fast"]` (`flash.js:2503`).

The second reply value is the rows; the third is your own numbers
(`reputation`, `reputation_potential`, `skill`, `wins`, `loses`, `online`, `matches`,
`flash.js:2645`). Rows are per view:

- **`match_list`:** the match fields around `flash.js:200-201`, including
  `match_owner_reputation` and `min_reputation`, plus `can_join` and `reason`, which the
  lobby computes per viewer with the same check that gates joining (`:2535`, `:6573`).
- **`relations`:** `is_mine`, `from`, `to`, `is_support`, `relative_since`,
  `relative_cap_time_until`, `personal_delta`, `other_auth_id`, `since`, `is_active`
  (`:2595-2611`).
- **`skill_board`:** `login`, `skill`, `relative_last_activity` (`:2624`).

## The store behind it

Two collections, both on the lobby:

- **`entries`** — per account: login, nickname, reputation, skill, wins, losses, last
  activity. The same object the profile comes from.
- **`relations`** — one record per report or endorsement that still counts. Its fields, as
  the lobby reads them: the two account keys, a `type` (compared against the module's
  `$МоНM0`, the endorsement type), `since`, a cap time, an active flag, and **two deltas**:
  one for the side that sent it and one for the side that received it
  (`flash.js:2555-2612`, shown in the lobby as "Reputation delta", "Since", "Until",
  "Active", `MPLobby.js:38-51`).

So one action moves **two** reputations by **two separate amounts** — that is the "cost of
your Reputation points" in the lobby's own help text (`MPLobby.js:732-739`). Both amounts
are temporary and end at the record's cap time; that is the "points usually recover
overtime" (`MPCreateMatch.js:293-296`) and why the reply carries a
`reputation_potential` next to `reputation`. A relation can be ended early by the side that
created it; an inactive one is kept a week for logging (`flash.js:2585`, `:2588`).

In a match the number arrives per player, in the state message, as
`ping~skill*100~reputation` (`flash.js:835`); the page stores it on the player (`:1297`)
and the scoreboard's "Rep." column shows it (`scripts/screens/GameScene.js:413-433`,
drawn at `scripts/frame2.js:20729`).

## Who can change what

| Number | Changed by | Limits |
|---|---|---|
| Your own reputation | nothing in the game | only the lobby's module, through logins and relations |
| Another player's reputation | `RELIABLE_REPORT_USER`, `RELIABLE_ENDORDSE_USER` | the amount is the module's; the game sends none |
| A relation's effect | its initiator, `delete_relation: <since>` | only the side that created it (`flash.js:2588`) |
| A match's `min_reputation` | owner or staff: create settings, or `-min_reputation <n> [-recheck <slot>]` in chat | lowered to the setter's own reputation (`:2686`, `:4998`); with `-recheck`, players below it are disconnected (`:5010-5021`) |
| Creating a match | — | refused at negative reputation (`:2673`) |
| Joining a match | — | refused below its `min_reputation` (`:6573`); staff bypass (`:6568`) |

### What a report or an endorsement may carry

The request is `[<opcode>, <target auth id>, <reply id>]` and the lobby reads only those two
values (`flash.js:2851`, `:2853`). Consequences a client can see:

- **No amount, ever.** There is no fourth value that means points: the only other part the
  lobby reads on this branch is `parts[3] === "1"` (`:2857`), and that is used by kick and
  ban, not by report or endorse. A hand-sent message with an extra part changes nothing.
- **The target is a number, normalised.** `parseInt(parts[1])`, so `"1042"`, `" 1042"`,
  `"01042"` and `"1042abc"` all mean auth id 1042.
- **Self is refused by the lobby, not by the page.** `parts[1]` is compared with the
  initiator's own id, read from the account module's map keyed by the connection
  (`:2865-2871`). The client never states who it is, and the page's report and endorse
  handlers carry no self-check of their own (`HUD.js:2061-2070`, `:2123-2133`): the answer
  comes back as the chat string `Error: Can't do this to yourself`.
- **No throttle and no "we played together" check.** The dispatcher's only time gates are
  creating a match, once a second (`:2671`), the join-password cooldown (`:2965`) and chat,
  five a second (`:4016-4019`). This branch has none of them and does not compare matches.
  Every message is another call into the module.
- **Spectating allows it** (`:1730-1753` lists report and endorse among the messages a
  spectator may still send).

## What each object checks before it changes

| Object | Who may change it | Checked at |
|---|---|---|
| A profile (`nickname`, `uid`, `is_staff`) | only the account module during login | `flash.js:2008`. The only other write is the player-hosted p2p branch (`:3180`), which the lobby returns from first (`:3147`) |
| An account's stats (`reputation`, `skill`, wins, losses) | only the account module during login | `:3181`, the same p2p branch; nothing else |
| Your player's fields in a match | you | whitelist `team`, `skin_snapshot`, `slot0…slot9`, `curwea` (`:216-221`), each validated and applied to your own player (`:3576-3620`) |
| Kills and deaths | a match server only | the lobby drops a player's own report of them (`:2062`) |
| A relation's `is_active` | the side that created it | `:2570-2588` |
| A match's ban list | staff, or the owner if not a guest | `:2897-2914`, `:7183-7227` |
| An account ban | staff | `:2886` |
| Match settings, `min_reputation` | owner or staff | `:4029-4033`, `:4998` |

"The lobby drops it" in those rows is `$с0А0О`, which is
`connection.$с0А0О = $ММ.$T0еcр` — "this code is the lobby server"
(`scripts/connection.js:248`, so every player connection on a lobby has it set, including
this repo's server, which raises the same flag at `src/server/game.ts:119`).

Two references carry no owner check, and both are inside these rules rather than around
them: report and endorse reach any online auth id, not only players in your match (`:2855`
resolves it from the module's global map), and a kick resolves the target the same way but
adds them to the *actor's* match ban list, disconnecting them only if they are in it
(`:7183-7227`).

## Probing the live lobby

Every number above is enforced by the lobby, so the only way to learn what its account
module decides is to ask it and watch the two numbers the client is allowed to see. Two of
your own accounts, the lobby's own server, nothing else. The same lines, one per block and
with the target set once, are in [reputation-probe.md](reputation-probe.md).

1. `net_log on` in the dev console. Join a match with the second account, open the Tab
   scoreboard, click **Endorse** on that account once.
2. `netlog show` and read the `ENDORDSE_USER` line: it is
   `[<opcode>, <target auth id>, <reply id>]`, and the answer is `[<string>]`. Write both
   down, plus the target's `REPUTATION` in the lobby and its `reputation_potential` in the
   tooltip.
3. Replay it, same target id, as often as you like ([js](../features/js-eval.md) runs in the
   page and has `PB2_NAMES`). First check the four pieces are there:

```
js JSON.stringify((()=>{const N=PB2_NAMES,M=(0,eval)(N.net),c=M[N.lobbyConn];return {build:N.version,net:typeof M,connected:!!c,channel:!!M[N.netChannel],placeholder:typeof M[N.netReplyTo]}})())
```

   `(0,eval)` is not decoration: the network object is `class $ММ` at the top of
   `scripts/libs/flash.js:5`, and a top-level class is a binding, not a property of
   `globalThis`, so `globalThis[PB2_NAMES.net]` is `undefined`. The replies collect in
   `probe`, which `js` prints as `[object Object]` unless it is stringified:

```
js globalThis.probe=[];(()=>{const N=PB2_NAMES,M=(0,eval)(N.net),c=M[N.lobbyConn],T="1042";const send=(extra)=>new Promise(d=>{const p=[M.RELIABLE_ENDORDSE_USER,T,M[N.netReplyTo]];if(extra)p.push(extra);c[N.netSend](M[N.netChannel],p,r=>{probe.push(Array.from(r));d()})});let i=0;const step=()=>{if(i++>=5)return;send().then(step)};step()})()
js JSON.stringify(probe)
```

4. Send it once with the target set to **your own** auth id: expect
   `Error: Can't do this to yourself` and no change on the other account.
5. Send it once with a fourth part, `"11"`: the reply and both numbers should be
   indistinguishable from one plain send.
6. After each round, the target opens the lobby's Relations screen: one row per relation,
   with `Since`, `Until`, `Active` and `Reputation delta` (`MPLobby.js:38-51`). That is the
   only view of what the module stored.

What each outcome proves: whether the lobby took the message and, for a live target, how the
module answers — the string in chat is its own wording. The sizes stay hidden. First live
results are in [reputation-probe.md](reputation-probe.md#observed-so-far).

An id that is not live is harmless: the lookup fails before the module is called
(`flash.js:2855`) and the reply `Error: Target user wasn't online for too long` is not even
logged (`:2920-2923`). So a batch with a wrong id leaves no trace and needs no cleanup.

## Staff

`is_staff` is one boolean in a player's profile, the object the lobby keeps on the connection
as `connUser` (`scripts/libs/flash.js:2007-2018` names it, `:6568` reads it). It is not a
rank, a tag or a chat command: it marks the accounts that belong to the people running the
game, and the lobby's account module decides it at login.

- **Only the server sets it.** The client's `RELIABLE_AUTHENTICATE` carries login, password,
  version, hash, uid and device — no staff field (`MPLobby.js:155-160`). The lobby's answer
  `["ok", <profile JSON>]` carries the finished profile, `is_staff` included, and the page
  keeps it as its own copy (`MPLobby.js:165-170`). A modified page can show itself staff
  buttons, but every check that matters reads the lobby's copy.
- **On this repository's server it comes from `admins`** in `server.json`:
  `is_staff: isStaff` where `isStaff = config.admins.includes(key)`
  (`src/server/game.ts:185-187`). On the official server it is the staff accounts' flag in
  its account database.
- **What it grants:** skipping the join checks (`flash.js:6568`), joining a ranked match in
  progress (`:5431`), kicking (`:2897`) and banning (`:2886`) anyone, being un-kickable by
  non-staff (`:2905`, `:7187`), the owner-or-staff chat commands of any match —
  `-announce`, `-min_reputation`, `-map`, `-endround` and the rest (`:4030`) — and the staff
  buttons of the Tab and Esc menus (`HUD.js:2138`, `EscMenu.js:86`, `:225`).

## Where the join check runs

On the server. The client is told the verdict and only styles the row with it; it never
re-checks a reputation and never refuses to send the join.

- `match.$lрTp1(connection)` (`scripts/libs/flash.js:6564`) returns the answer and leaves
the reason in `$ММ.$O0lАА`. Its order: staff passes without a look (`:6568`), then
`reputation < min_reputation` (`:6573`), then the guest and VPN rules (`:6579-6597`), then the
match's ban list by uid, address, device and account key (`:6599-6627`). Free slots and
ping are not part of it.
- The gate that counts is inside `RELIABLE_JOIN_MATCH`: after finding the match by uid and
after the password and "still being created" checks, `if(match.$lрTp1(connection))` at
`:2979`, else `["fail", "Match join error: " + reason + "."]` at `:3047` — so the player
reads `Match join error: This match does not allow users with reputation below N to join.`
- The match list calls the same function once per match per viewer (`:2537`) and ships
`can_join` plus `reason` (`:2535-2540`). `scripts/screens/MPLobby.js:306-316` turns that
into a greyed row and a tooltip; the click still sends `RELIABLE_JOIN_MATCH`, and
`$cТHMрI()` (`MPLobby.js:379`) only guards open dialogs and the mouse, not the reputation.
- The same function decides who is thrown out by `-recheck` (`:5011`), and the create-side
clamp (`:2686`) is what keeps a match's minimum within reach of the player setting it.

Because it runs at join time against the server's own store, a match list fetched before
someone's reputation changed cannot be used to get past a new minimum.

## What cannot be known from here

The module is not shipped, so the numbers themselves are the lobby's own choices and are not
in any file:

- points lost, gained, or paid per report and per endorsement;
- which of the two deltas belongs to which side and its sign;
- how long a relation's cap time lasts, whether recovery is instant at the cap or gradual,
  and whether `reputation_potential` moves with it;
- any rate limit or per-day cap (the lobby's report path has no throttle of its own).

The game says as much: "Note: This feature is incomplete and may still be reset"
(`MPLobby.js:739`). A server that wants working reputation invents these numbers; see
[Your own server](../operations/private-server.md#reputation), where everyone has 40.

## Re-checking

```
npm run find-names -- --decode scripts/libs/flash.js | rg -n -i "reputation"
npm run find-names -- --decode scripts/screens/MPLobby.js | rg -n -i "reputation"
npm run find-names -- --decode scripts/screens/MPCreateMatch.js | rg -n -i "reputation"
npm run find-names -- --decode scripts/screens/HUD.js | rg -n "ENDORDSE_USER|REPORT_USER"
npm run find-names -- --decode scripts/screens/GameScene.js | rg -n -i "reputation"
```

`npm run find-names -- --decode` prints the same line numbers as the file it reads, so a
line cited here can be opened in `game/` directly. If a game update moves one, the claim is
to be corrected here (see "Reporting fixes" in `AGENTS.md`).
