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
  - How: it overrides your character's aim x (`tarx`), not the mouse. The game computes `tarx`
    from the mouse each tick (`frame2.js:33879`) and turns you to face it (`36364`); while
    sweeping, `tarx` on your character reads your x plus or minus the range, flipping side
    every tick, and the game's own writes are kept aside. The camera and the drawn crosshair
    follow the mouse, not `tarx`, so neither moves. It is a getter on your character object
    only: no global changes. Stopping, another fly mode, low physics, death or a pause puts
    the game's own aim back.
  - It holds ragdoll (X, the game's `ragdollKey`, set on key 88 at `frame2.js:27403`) for you
    every tick while it sweeps: the sweep only lifts you while you are limp. `fly sword` sweeps
    the same way and also holds the left mouse button (`mouseHeld`, which the tick reads to
    fire or swing, `frame2.js:33881`), to fly with swords; use `fly sweep` with a gun.
    `fly sword --on/--off/--toggle` works like the sweep's, and `bind --hold mouse2 "fly sword"`
    holds it. Both are set again every tick, so a game mouse up does not end them; stopping
    lets go of both. While limp the game does not turn you to face your aim, so your facing
    stays put; the aim itself still flips.
  - Other players see your aim flip: it is in your state updates. In an approved match the
    server reports aim more than 1000 to the side (anticheat.md §14.6), so the range is held
    to 1000 there; `bypass checks` lifts that.
  - Any other `fly` mode stops the sweep. Moving, jumping, crouching and commands work as
    usual; shots go where the sweep points.
  - Not yet: aiming at the cursor on the ticks a gun fires.
  - Checked headless: the aim and facing flip every frame and the crosshair stays put. The
    climb was confirmed in a real window, not headless.
- Client-only. With the flag off, the keys do not exist; saved values are kept but not
  applied.
