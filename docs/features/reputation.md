# reputation: your reputation, relations and the match's numbers

Feature flag `reputation` (on by default; local and server modes, not in remote play).
Code: `src/features/reputation/`: the lobby request (`adapters/lobby.ts`), reading its reply
(`domain/reply.ts`) and one folder per command under `capabilities/`. Background:
[reputation research](../research/reputation.md).

Capabilities: `reputation.mine` (`rep`), `reputation.relations` (`rep relations`),
`reputation.players` (`rep players`) and `reputation.device` (`rep device`, with the
wrapper's record of network saves). `reputation` is an alias of `rep`.

| Command | Shows | From |
|---|---|---|
| `rep` | reputation, potential reputation, skill, wins, losses | the lobby, asked now |
| `rep relations` | each relation: fit (endorsement) or unfit (report), from → to, its delta, since when and until when | the lobby, asked now |
| `rep players` | everyone in this match: slot, nickname, reputation, skill | what the match already sent |
| `rep device` (`rep id`) | the device id lobby logins send, its shape, the save's first account, and how the id got here | the game's save and the wrapper's record |

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

### The record of network saves (wrapper)

The game loads the account's network save at start and uploads its save after saves, both as
`POST /pb2/server.php` on the official site or the client's own host (`rq=load`, `rq=save`).
The wrapper watches these on those hosts, with `reputation.device` on:

- **Upload:** reads `first_uid`, `first_login` and whether `first_login_proof` is set from the
  `str` field, and lets the request go on untouched.
- **Download:** sends the request itself, reads the same three from the answer, and hands the
  game the answer unchanged: same body, status and headers.
- Kept in memory only, the last 20 of each, with the time and the `l` field (the account).
  The password (`p`) and the proof are never kept.
- `__dev/device` answers `{ loads, uploads }`, and 403 to a remote play tester.

## Which numbers these are

They belong to the stats entry the lobby picked for this login, which follows the device id
the client sends. Another client, or another account on this install, can show other
numbers ([Which entry a login gets](../research/reputation.md#which-entry-a-login-gets)).

## With the flag off

`PB2_FEATURES=-reputation npm start`: `rep` and `reputation` are unknown commands, and
the wrapper neither watches network saves nor answers `__dev/device`.
`PB2_FEATURES=-reputation.device` keeps the other commands and leaves network saves alone.
