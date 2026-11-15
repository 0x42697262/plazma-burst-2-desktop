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
(`Multiplayer.CALLBACK_UID_PLACEHOLDER`, `scripts/libs/flash.js:77`) in the slot where the
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
| Joining a match | — | refused below its `min_reputation` (`:6573`); staff bypass (`:6567`) |

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
