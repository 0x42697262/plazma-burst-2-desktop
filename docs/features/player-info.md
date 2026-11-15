# player_info: pos, chars, players, bots, uid and accounts

Feature flag `player_info` (on by default; all modes). Code: `src/features/player_info/`.

- `pos` shows your position and the crosshair's, both rounded: what `tp x y` takes.
- `chars [<team>] [players | bots]` lists the characters in the level: index, nickname,
  team, HP, alive or dead, and distance. The index is what `tp`, `give to`, `drop from`,
  `revive` and `triggers run as` take. Filters narrow the list:
  - a team by the game's own name for it, or the start of the name, in any case: `alpha`,
    `beta`, `red` (for Red Team), `blue`. Several teams list all of them. The names are the
    game's team table (`teamNames`); without it, the team shows as its number and a team
    word is refused.
  - `players` keeps the characters a person plays (`charHuman`), `bots` the others.
  A word that is not a filter, or that starts more than one team name (`c`), is an error.
- `players [<team>]` and `bots [<team>]` are `chars players` and `chars bots`.
- `accounts` (aliases `authids`, `ids`) lists the players and spectators connected to the
  match: index, nickname, login and the **auth id** that `RELIABLE_REPORT_USER`,
  `RELIABLE_ENDORDSE_USER`, `RELIABLE_KICK_USER` and `RELIABLE_BAN_USER` take. A bot or map
  actor has no account and shows `-`, `?` means the match has not sent that player's account yet
  (before the first sync), and a spectator carries `(spectating)`. An empty slot is left out,
  so the numbers can have gaps. Players come from the characters array, spectators only from
  the per-slot table (`playersBySlot`), which is why an id read in one session must be read
  again after a rejoin: the lobby assigns it per join. Capability `player_info.accounts`.
- `uid [<# | name> | all]` gives a character's map uid (`#player*1`), as triggers name
  it: yours, one by index or (part of a) nickname as `tp` takes them, or everyone's.
  Characters are the map's `<player>` and `<enemy>` tags in map order, so character #3
  is the fourth of them (`capabilities/uid/uids.ts` reads them from the map text). A tag
  without a uid (maps without uids) says so; a character past the map's tags says how many
  the map has. Capability `player_info.uid`.
