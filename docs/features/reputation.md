# reputation: your reputation, relations and the match's numbers

Feature flag `reputation` (on by default; local and server modes, not in remote play).
Code: `src/features/reputation/`: the lobby request (`adapters/lobby.ts`), reading its reply
(`domain/reply.ts`) and one folder per command under `capabilities/`. Background:
[reputation research](../research/reputation.md).

Capabilities: `reputation.mine` (`rep`), `reputation.relations` (`rep relations`) and
`reputation.players` (`rep players`). `reputation` is an alias of `rep`.

| Command | Shows | From |
|---|---|---|
| `rep` | reputation, potential reputation, skill, wins, losses | the lobby, asked now |
| `rep relations` | each relation: fit (endorsement) or unfit (report), from → to, its delta, since when and until when | the lobby, asked now |
| `rep players` | everyone in this match: slot, nickname, reputation, skill | what the match already sent |

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

## Which numbers these are

They belong to the stats entry the lobby picked for this login, which follows the device id
the client sends. Another client, or another account on this install, can show other
numbers ([Which entry a login gets](../research/reputation.md#which-entry-a-login-gets)).

## With the flag off

`PB2_FEATURES=-reputation npm start`: `rep` and `reputation` are unknown commands.
