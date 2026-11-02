# movement: the movement keys

Feature flag `movement` (on by default; all modes). Code: `src/features/movement/` (the
flag), the keys `speed`, `jump`, `gravity`, `fly`, `fly_speed`, `swords` and
`world_gravity` in `src/console/kernel/state/constants.ts`, and their per-frame
overrides in `src/console/kernel/overrides/frame.ts`.

- It has no commands: `speed 1.8`, `fly on`, `swords off` … are settings
  ([dev console](dev-console.md)).
- One capability per key, each with its own override under `capabilities/`:
  `movement.speed`, `movement.jump`, `movement.gravity`, `movement.fly` (with
  `fly_speed` and the `fly_*` keys of free flight), `movement.swords`,
  `movement.world_gravity`. `fly` and `gravity` both pull the character up against
  gravity; when both are set, `fly` leaves that to `gravity`.
- `fly` takes `on`, `off` or `free`. `on` moves you straight up and down with the jump
  and crouch keys at `fly_speed`. `free` pushes you along the movement keys in all four
  directions and lets you glide to a stop, like the community map `diegox124-fly`:
  `fly_accel_x` (1) and `fly_accel_y` (0.8) push, `fly_drag` (0.98) is the share of
  speed kept every 1/60 s, `fly_lift` (0.98) the share of gravity canceled, and
  `fly_upright` (on) keeps the character on its feet. The defaults are the map's values:
  its timers run every frame (the loader reads `delay="0.1"` as 0), so at 60 fps the two
  feel the same; the console's drag does not change with the frame rate. The direction
  comes from the character's movement intention (game names `moveIntentX`,
  `moveIntentY`), the same values trigger actions 247 and 248 read.
- Client-only. With the flag off, the keys do not exist; saved values are kept but not
  applied.
