# guns: the gun list, give and drop

Feature flag `guns` (on by default; all modes). Code: `src/features/guns/`. The gun
settings (`fire_rate`, `pellets`, `spread` …) are console keys and stay with the
per-frame overrides.

Capabilities, one folder each under `capabilities/`: `guns.list` (`guns`), `guns.give`,
`guns.drop`, `guns.gun` (the keys `fire_rate`, `pellets`, `spread`, `recoil` and the held
gun's override) and `guns.bullets` (`bullet_damage`, `bullet_speed`, `bullet_life`,
`penetration` and the bullet override).

- `guns [filter]` lists every gun the game can build, read from its own gun factory, in
  three groups: standard (`gun_…`), custom (community guns) and items (`item_…`). A
  grenade item's class is `item_grenade_<name>`, whatever its model is called; that is
  where its slot is read. The list is built once and kept (`services/armory.ts`).
- `give <# | model | name> [0-3] [to #]` spawns the gun at the character's feet at
  upgrade 3 unless told, and equips it when its slot can be assigned. The game's slot
  setter drops whatever gun was in that slot. Grenade items are picked up by walking
  over them, and vehicle guns cannot be carried, so those are only spawned. An
  ambiguous name is refused and up to six matches are listed.
- `drop [slot | all] [from #]` does the steps of the game's own drop (the V key)
  without its conditions:
  - empty the slot (which also blocks picking it up again for 1 s);
  - toss the gun along the aim angle (`TOSS` speeds), 20 units ahead;
  - wake its physics points.
  The V key refuses in a vehicle, or for guns that cannot be thrown; this does not.
- `to #` and `from #` act on a bot, in single-player only. In multiplayer the other
  characters are real players.
- Both are client-only: the server never sees the gun or the drop.
