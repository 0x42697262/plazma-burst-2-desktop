# movement: the movement keys

Feature flag `movement` (on by default; all modes). Code: `src/features/movement/` (the
flag), the keys `speed`, `jump`, `gravity`, `fly`, `fly_speed`, `swords` and
`world_gravity` in `src/console/kernel/state/constants.ts`, and their per-frame
overrides in `src/console/kernel/overrides/frame.ts`.

- It has no commands: `speed 1.8`, `fly on`, `swords off` … are settings
  ([dev console](dev-console.md)).
- One capability per key, each with its own override under `capabilities/`:
  `movement.speed`, `movement.jump`, `movement.gravity`, `movement.fly` (with
  `fly_speed`), `movement.swords`, `movement.world_gravity`. `fly` and `gravity` both pull
  the character up against gravity; when both are set, `fly` leaves that to `gravity`.
- Client-only. With the flag off, the keys do not exist; saved values are kept but not
  applied.
