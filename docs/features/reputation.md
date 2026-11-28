# reputation: your reputation, relations and the match's numbers

Feature flag `reputation` (on by default; local and server modes, not in remote play).
Code: `src/features/reputation/`: the lobby request (`adapters/lobby.ts`), reading its reply
(`domain/reply.ts`) and one folder per command under `capabilities/`. Background:
[reputation research](../research/reputation.md).

Capabilities: `reputation.mine` (`rep`), `reputation.relations` (`rep relations`),
`reputation.players` (`rep players`), `reputation.device` (`rep device`, which needs
`network_save.watch`, the wrapper's record of network saves) and `reputation.entry` (`rep entry`). `reputation` is an alias of `rep`.

| Command | Shows | From |
|---|---|---|
| `rep` | reputation, potential reputation, skill, wins, losses | the lobby, asked now |
| `rep relations` | each relation: fit (endorsement) or unfit (report), from → to, its delta, since when and until when | the lobby, asked now |
| `rep players` | everyone in this match: slot, nickname, reputation, skill | what the match already sent |
| `rep device` (`rep id`) | the device id lobby logins send, its shape, the save's first account, and how the id got here | the game's save and the wrapper's record |
| `rep entry` (`rep key`) | a tag for the stats entry this login got, its reputation, the lobby's VPN flag, and how it compares with the entries seen earlier in this window | the lobby, asked now |

## How it asks the lobby

`rep` and `rep relations` send the request the lobby screen sends to refresh its lists,
`RELIABLE_GET_MATCH_LIST` with `{}`, the reply placeholder and the view (`match_list` or
`relations`), on the lobby connection. The answer is `["ok", <rows JSON>, <your numbers JSON>]`
([reputation](../research/reputation.md#match-list-relations-skill-board)):

- `rep` reads the third part: `reputation`, `reputation_potential`, `skill`, `wins`, `loses`.
- `rep relations` reads the rows: `is_support` (fit or unfit), `from`, `to`,
  `personal_delta`, `relative_since`, `relative_cap_time_until`, `is_active`.
- `["fail", <why>]` is printed as "the lobby refused: <why>"; the lobby answers "Too fast" to
  a second list request within 300 ms.
- Before the lobby login there is no lobby connection: "not logged in to the lobby server
  yet". No answer in 10 s: "the lobby did not answer".

Nothing else is sent, and nothing is stored.

## `rep players`

Reads the `reputation` and `skill` the match's state message puts on each player
(`ping~skill*100~reputation`, the Tab scoreboard's Rep. column), slot by slot like
`accounts`. Bots and map actors have none and show `-`.

## `rep entry`

The lobby picks a stats entry at login, partly from the device id, but never sends the
entry's key (`connStats.key`) or its own device id (`connDevice`): both stay in the lobby
server's memory. Each relation in the Relations view carries its fixed start time (`since`,
`flash.js:2590-2603`), so `rep entry` hashes the sorted start times into an 8-digit tag:

- **The same tag** is the same entry.
- **A changed tag that shares relations** with an earlier one is most likely the same entry,
  with relations started or dropped since (an ended relation drops out after a week).
- **Nothing shared** is another entry. An entry with no relations has no tag.

It also prints the reputation and the `is_vpn` flag from the lobby's login reply. Each run is
kept in the window's `sessionStorage` (the last 10: time, tag, start times, reputation), which
survives a reload but not closing the window, so: change the device id, upload it, reload, and
run `rep entry` again.

## `rep device`

The lobby picks your reputation entry with the device id (`first_uid`) that every lobby login
sends ([research](../research/reputation.md#the-device-id-travels-with-the-accounts-saved-game)).
`rep device` shows:

- **The id**, read from the game's save, `localStorage["plazma_burst2"]` of this client's
  session: what the next lobby login sends. "None yet" until a lobby login makes one.
- **Its shape.** Four base-36 numbers joined by dots is how this game version makes one
  (`flash.js:7536-7543`); anything else came from an older version, another client, or a
  hand edit. How the game makes it, step by step:
  [How the device id is made](../research/reputation.md#how-the-device-id-is-made).
- **The first account on this save** (`first_login`), and whether its login proof is kept. The
  proof itself is never shown.
- **How it got here, in this session**, from the wrapper's record of network saves:
  - the account's network save was loaded at start and carried this id: it came with that
    account;
  - it carried no id: the id was already in this install's save, or the game made it here;
  - it carried another id: shown, with the one the save holds now;
  - no load seen: the id was already in the save;
  - the last upload: which account's network save now carries the id.

The id identifies the install; the command says not to share it. There is no command to
change it.

### The record of network saves

`rep device` reads the record the `network_save` feature keeps of the game's downloads and
uploads (`__dev/netsaves`, [network-save](network-save.md#the-wrapper)). It uses only the ones
the game made, not the console's (`netsave download`, `netsave upload --direct`).

## Which numbers these are

They belong to the stats entry the lobby picked for this login, which follows the device id
the client sends. Another client, or another account on this install, can show other
numbers ([Which entry a login gets](../research/reputation.md#which-entry-a-login-gets)).

## With the flag off

`PB2_FEATURES=-reputation npm start`: `rep` and `reputation` are unknown commands.
`PB2_FEATURES=-reputation.device` keeps the other commands. With `network_save.watch` off,
`rep device` is off as well.
