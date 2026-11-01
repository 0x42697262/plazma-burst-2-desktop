# zoom

Feature flag `zoom` (on by default; all modes). Code: `src/features/zoom/`.

- `zoom <percent>` sets the camera zoom the way a map's "set zoom" trigger does, from 1
  to 1500 % (the game's own trigger clamps to that range). The game's chat command only
  offers 25, 50, 100 and 200.
- Without `--lock`, a map trigger, a vehicle or the map's gamescale mark can change it
  again. With `--lock`, a frame hook puts it back every frame, in this level and the next
  ones, until `zoom --unlock` or the app closes. A held zoom belongs to the command; it
  is not a setting.
- In a ranked match, zooming out is refused, and a lock already set is not applied:
  the server tells the other players when you aim outside the normal view
  ([anticheat](../research/anticheat.md) §14.6). `bypass checks` lifts that.
- `list zoom` shows a held or once-set zoom. The section comes from the feature
  (`listSections`, registered through `src/console/kernel/list-sections.ts`).
