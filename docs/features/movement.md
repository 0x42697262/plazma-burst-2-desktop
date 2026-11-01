# movement: the movement keys

Feature flag `movement` (on by default; all modes). Code: `src/features/movement/` (the
flag), the keys `speed`, `jump`, `gravity`, `fly`, `fly_speed`, `swords` and
`world_gravity` in `src/console/kernel/state/constants.ts`, and their per-frame
overrides in `src/console/kernel/overrides/frame.ts`.

- It has no commands: `speed 1.8`, `fly on`, `swords off` … are settings
  ([dev console](dev-console.md)).
- Client-only. With the flag off, the keys do not exist; saved values are kept but not
  applied.
