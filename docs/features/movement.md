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
- `fly sweep` arms the aim sweep, the game's own way of flying with high physics: your
  aim is flipped left and right of you every tick, so your facing flips and your body pose
  is mirrored; with high physics the game does not move each point's previous position
  along with it (`frame2.js:17731-17926`), so the pose change carries speed. `fly` is also a
  command: `fly sweep --on` starts sweeping (and arms `fly sweep`), `--off` stops, `--toggle`
  switches. It only sweeps at 60 FPS with high physics (`fps 60 high`, [fps](fps.md)).
  `fly_sweep_range` (700 game units) is how far left and right of you it aims.
  - How: it writes the game's `mouseX`, as a moved cursor does; the game copies `mouseX` into
    its aim source at the start of each tick (`frame2.js:38332`) and aims from that, so a
    write to the aim source itself would be overwritten. Your OS cursor stays where it is;
    the game's drawn crosshair follows `mouseX`, and stopping asks the game to read the real
    pointer again (`MovieClip.schedule_mouse_move_event`). The value stays on the stage
    (1 to 800), like a real cursor.
  - Other players see your aim flip: it is in your state updates. In an approved match the
    server reports aim more than 1000 to the side (anticheat.md §14.6), so the range is held
    to 1000 there; `bypass checks` lifts that.
  - Any other `fly` mode stops the sweep. Moving, jumping, crouching and commands work as
    usual; shots go where the sweep points.
  - Not yet: aiming at the cursor on the ticks a gun fires.
  - Checked headless: the aim and facing flip every frame. A climb was not reproduced
    headless (gun or none, standing or jumping, any range); check it in a real window.
- Client-only. With the flag off, the keys do not exist; saved values are kept but not
  applied.
