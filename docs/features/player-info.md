# player_info: pos, chars and uid

Feature flag `player_info` (on by default; all modes). Code: `src/features/player_info/`.

- `pos` shows your position and the crosshair's, both rounded: what `tp x y` takes.
- `chars` lists the characters in the level: index, nickname, team, HP, alive or dead,
  and distance. The index is what `tp`, `give to`, `drop from`, `revive` and
  `triggers run as` take.
- `uid [<# | name> | all]` gives a character's map uid (`#player*1`), as triggers name
  it: yours, one by index or (part of a) nickname as `tp` takes them, or everyone's.
  Characters are the map's `<player>` and `<enemy>` tags in map order, so character #3
  is the fourth of them (`capabilities/uid/uids.ts` reads them from the map text). A tag
  without a uid (maps without uids) says so; a character past the map's tags says how many
  the map has. Capability `player_info.uid`.
