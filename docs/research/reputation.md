# Reputation

Reputation points are the lobby's, not the game's: the page never computes one, it only
shows what the lobby sends and forwards two requests that ask the lobby to move somebody
else's points. They belong to a **stats entry**, not to an account: the lobby picks the
entry at each login, and one account can get different entries from different clients
([Which entry a login gets](#which-entry-a-login-gets)). Checked against game build v1769098419 (`game/pb2-version.json`). The
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
(`scripts/libs/flash.js:77`, `PB2_NAMES.netReplyTo` in the console) in the slot where the
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

- **`entries`** — keyed by a stats key, not by account: login, nickname, reputation,
  skill, wins, losses, last activity. A connection holds its entry as `connStats`
  (`connection.$НMМpо`), and the lobby reads `connStats.key` and
  `$с0A.entries[<key>]["login"]` (`flash.js:2559-2566`). One account can have more than
  one entry ([Which entry a login gets](#which-entry-a-login-gets)).
- **`relations`** — one record per report or endorsement that still counts. Its fields, as
  the lobby reads them: the two stats keys (`$TeeНОO` the sender's, `$АoсIрM` the
  receiver's), a `type` (compared against the module's
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

## Data flow: sent, stored, received

Three places hold something, and only one of them holds reputation.

| Where | What it holds | Reputation? |
|---|---|---|
| The install: `localStorage["plazma_burst2"]` | the game's save, a JSON object (`SharedObject.getLocal`, `flash.js:4047-4064`; opened at `frame1.js:457`), with `first_uid`, `first_login`, `first_login_proof` among the other saved values | no: the only reputation-related value saved is the create screen's `min_reputation` |
| The site: the account's network save | the same save as `name=value;` text, per account (`server.php`, `rq=save` / `rq=load`) | no |
| The lobby: the account module's `entries` and `relations` | per stats key: login, nickname, reputation, skill, wins, losses; relations between keys with their deltas | **yes**, and only here |

### Sent

| Message | Transport | Carries |
|---|---|---|
| Network save upload | `POST https://www.plazmaburst2.com/pb2/server.php` (`frame1.js:160`; Sad Burst 2 for the official servers rewrites the host, [map-cache](../features/map-cache.md)) | form fields `rq=save`, `l` (login), `p` (password or site token), `str` (the save text) (`frame1.js:419-433`) |
| Network save download | the same URL | `rq=load`, `l`, `p` (`frame1.js:226-279`) |
| Lobby login | socket.io, `RELIABLE_AUTHENTICATE` | part 7: `"\"<first_uid>\""`, the device id JSON-quoted ([protocol](protocol.md), part 7) |
| Endorse, report | socket.io, `RELIABLE_ENDORDSE_USER`, `RELIABLE_REPORT_USER` | the target's auth id only ([Report and endorse](#report-and-endorse)) |

**The save text.** Each value as `name=value;`, with `;` written `^1` and `=` written `^2`
inside names and values (`frame1.js:362-384`). Skipped: names starting `skin_allowed`, values
`NaN`, `undefined` or empty, and names with `<`, `>`, `{`, `}`, `(`, `)`, a space, `.`, `"` or
`:`. The upload includes `first_uid`, `first_login` and `first_login_proof`; the Settings
screen's text export is the only caller that leaves them out (`Settings.js:657`).

**When it is sent.** The download once per start with a login (`main.js:1179` →
`frame1.js:205-214`), retried up to 10 times on a network error. The upload after every local
save (`frame2.js:3597` → `frame1.js:394-416`), unless a level is being played with no menu
open, and only with a login; retried up to 10 times as well.

### Received

| From | Answer | Reputation in it |
|---|---|---|
| Network save download | the save text, or `x`, `Error: …` or `.` for "nothing to load" (`frame1.js:293-297`) | none. Every value is written into the local save, the three `first_*` values included (`frame1.js:300-347`); `true`/`false` and numbers are converted back |
| Lobby login | `["ok", <profile JSON>]` | none ([Requests and replies](#requests-and-replies)) |
| `GET_MATCH_LIST` | rows plus your own numbers | your entry's `reputation` and `reputation_potential`; the owner's in `match_owner_reputation` |
| `GET_MATCH_LIST`, `relations` view | relations of your entry's key | each relation's `personal_delta` |
| Endorse, report | one chat string | none |
| State message, in a match | `ping~skill*100~reputation` per player | each player's entry's `reputation` (`flash.js:835`, stored on the player at `:1297`) |

### One login, step by step

1. Start with a login: the network save is downloaded and written over the local save,
   `first_uid` included.
2. If the local save has no `first_uid`, the first lobby login makes one and saves it
   (`flash.js:7536-7546`); the save upload then puts it in the account's network save.
3. The lobby login sends `first_uid`. The account module picks a stats entry and puts it on
   the connection as `connStats`.
4. The first `["ok", …]` login answer records `first_login` and `first_login_proof` in the
   local save if they are not there yet (`flash.js:7520-7531`).
5. From here every reputation the client sees comes from `connStats` in the lobby's replies,
   and every endorsement or report it sends is stored against `connStats.key`.

## Which entry a login gets

Every reputation the lobby uses is read from `connStats`, the stats entry the account module
attaches to the connection while it logs in. Nothing reads a reputation from the client.

| Use | Reads | Code |
|---|---|---|
| Your own numbers in a list reply | `connStats.reputation`, `skill`, `wins`, `loses` | `flash.js:2645-2652` |
| Creating a match: refused below 0 | `connStats.reputation` | `:2673` |
| Creating a match: `min_reputation` lowered to yours | `connStats.reputation` | `:2688-2689` |
| `-min_reputation <n>` lowered to yours | `connStats.reputation` | `:4998-4999` |
| `match_owner_reputation` in the list | the owner's `connStats.reputation` | `:2764`, `:5507-5508` |
| The scoreboard's Rep. column | `connStats.reputation` in the state message | `:835` |
| The join check against `min_reputation` | the joiner's `connStats.reputation` | `:6573` |
| Your relations list | relations whose sender or receiver key is `connStats.key` | `:2559-2560` |
| "Similar user" match bans | `connStats.key`, beside uid, address and device id | `:6623`, kick adds it at `:7219` |

So the relations list (and the "Reputation delta" it shows) belongs to the entry, and a
report or an endorsement made from a connection is stored against that connection's key.

### What the account module is given

`RELIABLE_AUTHENTICATE` hands the module the connection (with its address), version, hash,
login, password, nickname, the **device id** and the build (`flash.js:1982-2036`,
[protocol](protocol.md), part 7). The device id is `first_uid`: made once from four random
base-36 numbers and kept in the game's save data, so it is the same on every login from one
install and different between installs ([protocol](protocol.md), "Part 7"). The module also
gives every connection a device id function (`connection.$сOрpM.$0О1еcM()`, read at `:6617`
and `:7216`). How it turns these inputs into a key is in the module, which is not shipped.

Each client of this app runs in its own browser session, so each has its own save data and
its own device id: the official client, and Sad Burst 2 for the official servers in
`persist:sadburst-erich5` ([client-sadburst](../features/client-sadburst.md)). Both log in
to the same official lobby with the same account and the same password.

### How the device id is made

The id is made by the game, once per save, the first time a lobby login asks for one.

1. **The hook.** At start, after the network save download (`main.js:1179`), the game runs
   `$ММ.$еccIpl()` (`main.js:1185`), which calls `$IooорO.$OОOeMе(JSON, save.data)`
   (`flash.js:28-31`, `:7468`). That adds two properties to the global `JSON` object whose
   names only look like `stringify` and `parse`: `JSON.strіngіfy` and `JSON.pаrsе`, with
   Cyrillic `і`, `а` and `е` (`flash.js:7520`, `:7534`). The real `JSON.stringify` and
   `JSON.parse` are untouched.
2. **The call.** The lobby login builds part 7 as
   `JSON.strіngіfy(r() + "." + r() + "." + r() + "." + r())` with fresh random values
   (`MPLobby.js:141-158`). The look-alike ignores its argument (`flash.js:7534-7547`):
   - if the save has no `first_uid`, it makes one: four times
     `Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36)`, joined by `.`
     (`:7538-7543`), and saves at once (`:7544`, `$IеOАT`);
   - it returns `"` + the saved `first_uid` + `"`, so the part is the saved id in quotes.
3. **The save.** `$IеOАT` (`frame2.js:3434`) writes the save to
   `localStorage["plazma_burst2"]` (`:3574`) and then uploads it to the account's network
   save (`:3597`), which is how the new id reaches the account (below).
4. **The lobby side.** The lobby strips the first and last character, the quotes; a missing
   part becomes `0hash`; over 60 characters throws and drops the connection
   (`flash.js:1990-1999`). The value goes to the account module as it is.

What follows from it:

- **Its shape.** Each of the four numbers is 0 to 2^53 − 2 written in base 36: 1 to 11
  characters of `0-9a-z` (`Number.MAX_SAFE_INTEGER` is `2gosa7pa2gv`). The whole id is 7 to
  47 characters, well under the lobby's 60. `rep device` checks this shape
  ([reputation](../features/reputation.md#rep-device)).
- **Its randomness.** `Math.random()` is the browser's ordinary generator, not a
  cryptographic one; nothing on the client ties the id to the hardware.
- **Made once.** Only when the save has none; afterwards every login sends the same id until
  the save changes: a network save download that carries another id, a cleared save, or
  another client with its own save.
- **The twin.** `JSON.pаrsе` parses the login answer and, the first time a non-guest
  account logs in, records `first_login` and `first_login_proof` in the same save
  (`flash.js:7520-7531`).
- **Other shapes.** An id that does not match, such as `l0.` followed by digits, was not
  made by this code: an older game version, another client, or an edited save.

### The device id travels with the account's saved game

`first_uid` is not only kept on the install. The game also keeps it in the account's
**network save** on the website, in both directions:

- **Upload.** Every local save also sends the whole save to the site (`frame2.js:3597` →
  `frame1.js:394-416`): `POST <site>/pb2/server.php` with `rq=save`, the logged-in account's
  `l` and `p`, and the save as `name=value;` text (`frame1.js:419-433`). That text includes
  `first_uid`, `first_login` and `first_login_proof` (`frame1.js:362-384`): the install's
  device id, and the first non-guest account that ever logged in on it with the lobby's
  `login_proof` for it (recorded by the look-alike `JSON.pаrsе`, `flash.js:7520-7531`).
- **Download.** At start, with a login, the game asks for the account's network save
  (`main.js:1179` → `frame1.js:205-214`, `rq=load` at `:226-279`) and writes every value it
  gets into the local save, `first_uid`, `first_login` and `first_login_proof` included
  (`frame1.js:330`, read with `$0Ao1o = true`). Only the Settings screen's text export leaves
  the three out (`Settings.js:657`, `$pНсНl(false)`).
- **The lobby login** then sends whatever `first_uid` the local save holds
  (`flash.js:7534-7547`).

So the device id follows the account wherever its network save is loaded, and an account can
pick up another account's id:

1. Account A's network save holds device id **X**. Starting the game as A writes X into the
   local save.
2. Switching to account B on the same install: if B's network save has its own id, the
   download replaces X with it; if it has none, X stays.
3. With X still local, B's lobby login sends X and gets X's entry, and B's next save uploads X
   into B's network save. From then on B carries X on every install.

That is why the number looks tied to the account most of the time (the account brings its id
with it), and why another account can take it over on one install and keep it ("it gets
stored there").

Two cases that follow from the order (download at start, then the first lobby login):

- **Clearing the game's data** does not by itself make a new id. If the game starts logged in,
  the download puts the account's id back before the first lobby login. A new id is made only
  when the account's network save has none, the game starts without a login, or the download
  fails all 10 tries.
- **Each client has its own network save address.** The game builds the address from where
  its page was loaded ([map-cache](../features/map-cache.md)), so Sad Burst 2 for the official
  servers loads and uploads at `https://sadburst2.com/gameplay_erich5/pb2/server.php`, not at
  plazmaburst2.com. It never sees the official network save, keeps an id of its own, and so
  reaches another reputation entry. What Sad Burst's server keeps is not visible from here;
  `rep device` in that client shows what its download carried.

### Observed: one account, two entries

Network logs from 2026-11-27 (`data/netlogs/`, `GET_MATCH_LIST` replies and the
`relations` view; accounts and devices renamed here). Account **A** is one official account:
the same uid in both login answers.

| Time (local) | Client | Device id | `reputation` / `reputation_potential` |
|---|---|---|---|
| 15:59 | Sad Burst 2 (official servers) | device 2 | 7 / 20 |
| 16:00 | official client | device 1 | 16 / 20 |
| 16:05–16:14 | Sad Burst 2 (official servers) | device 2 | 7, two endorsements sent |
| 16:19–16:21 | official client | device 1 | 16, then 17 |
| 16:22 | Sad Burst 2 (official servers) | device 2 | 11 / 20 |

- **Two numbers at once.** Logged in a few minutes apart, the same account read 16 through
  one client and 7 through the other, and each number moved on its own afterwards (16 → 17
  and 7 → 11). The account page on plazmaburst2.com showed 17, the official client's number.
- **Two relation lists.** At 16:01 the official client's `relations` view listed four relations
  (endorsements from three players, one to a fourth). The Sad Burst 2 view at 16:12 listed
  only the endorsement sent from that session a minute earlier. So the two connections had different
  `connStats.key`s, and what was given or received through one did not show on the other.
- **Not the client's doing.** Both clients send the same request with no reputation in it;
  the only identity part that differs is the device id (and both clients send `"version_h5"`,
  `"hash_h5"`, the same nickname and build).

The logs also show entries shared **between** accounts that log in with the same device id,
each on a fresh connection (accounts A, B, C; devices numbered as above):

| Time | Client | Account | Device | `reputation` | `skill` |
|---|---|---|---|---|---|
| 15:55 | Sad Burst 2 (official servers) | B | device 2 | 7 | 0 |
| 15:59 | Sad Burst 2 (official servers) | A | device 2 | 7 | 0 |
| 16:21 | official client | A | device 1 | 17 | 0 |
| 16:39 | official client | B | device 1 | 17 | 0 |
| 19:05 | official client | B | device 3 | 0 | the same 16-digit value on both |
| 19:12 | Sad Burst 2 (official servers) | B | device 4 | 0 | the same 16-digit value on both |

- **The id moves between sessions of one client.** In the official client, B logged in
  with device 3 at 15:38 and with device 1 at 16:39, right after A had logged in there
  with device 1; account C then logged in with device 3 again. Each account's network save
  set the local `first_uid`, or left the previous account's there.
- **B on A's device reads A's number.** At 15:39 and 15:55 account B read 6 and 7 elsewhere;
  logged in on device 1 at 16:39 it read 17, account A's number on that device 18 minutes
  earlier. On device 2 it was the other way round: A read B's 7.
- **Two devices, one entry.** At 19:05 and 19:12 account B read the same `skill` to all 16
  digits on device 3 and on device 4, so those two devices led to one entry.
- **A re-login on one connection is not evidence.** One log has account C log in, then
  account B on the **same** socket; B then shows C's `skill` exactly. That fits an entry
  that follows the device, but it also fits a lobby that keeps the first login's
  `connStats` on that connection, so it is left out of the tables above.

### What this means in practice

- **Your reputation is the entry's.** Which entry you get follows the device id the client
  sends, and that id comes from the local save, which the account's network save overwrites at
  start. An account logged in after another one on the same install can send the previous
  account's id, read its numbers, and save that id into its own network save. A client whose
  save is not the official network save (another session, a cleared save) keeps an id of its
  own and lands on another entry, with other numbers and another relations list.
- **Everything follows the entry of the connection in use**: whether you may create a match,
  the most `min_reputation` you can set, which matches let you join, what others see on the
  scoreboard, and which entry an endorsement or a report is stored against, sent or
  received.
- **It is still the server's number.** No client can raise it: the request carries no
  amount ([Report and endorse](#report-and-endorse)), and `connStats` is written only by the
  account module at login (and the p2p branch, `:3181`).

### Not known

- The rule that maps (login, device id, address, …) to a key, and when two of them are
  merged or split. The logs show one account split across two devices, two accounts sharing
  one entry through one device, and two devices sharing one entry. The address is the
  likeliest other input, and the client cannot see it.
- Whether a second login on the same connection gets a new entry.
- Whether the website shows one particular entry (it matched the official client's here) or
  computes its number some other way.
- Whether the module refuses an endorsement to a player whose reputation is higher than
  yours. The page has no such check (`HUD.js:2123-2133`), and none of the replies in the logs
  refuse one; if the module has it, it compares the two connections' entries.

To see which entry a client is on: open the multiplayer lobby, then `rep` and `rep relations`
in the dev console, and `rep device` for the device id this client sends and how it got there
([reputation](../features/reputation.md)).

## Who can change what

| Number | Changed by | Limits |
|---|---|---|
| Your own reputation | nothing in the game | only the lobby's module, through logins and relations; it is the reputation of the entry your login got ([Which entry a login gets](#which-entry-a-login-gets)) |
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
