# player_info: pos and chars

Feature flag `player_info` (on by default; all modes). Code: `src/features/player_info/`.

- `pos` shows your position and the crosshair's, both rounded: what `tp x y` takes.
- `chars` lists the characters in the level: index, nickname, team, HP, alive or dead,
  and distance. The index is what `tp`, `give to`, `drop from`, `revive` and
  `triggers run as` take.
