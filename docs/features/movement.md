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
    lets go of both. While limp the game does not turn you to face your aim
    (`frame2.js:36362`); it takes your facing from your body's layout (`36934`), which the
    sweep's first tick sets. So the sweep starts toward the cursor's side, and you face your
    cursor for the whole flight.
  - Other players see your aim flip: it is in your state updates. In an approved match the
    server reports aim more than 1000 to the side (anticheat.md §14.6), so the range is held
    to 1000 there; `bypass checks` lifts that.
  - Any other `fly` mode stops the sweep. Moving, jumping, crouching and commands work as
    usual; shots go where the sweep points.
  - How it steers is `fly_sweep_aim`, shared by sweep and sword, set with an option that can go
    with a run option (`fly sword --inverse --on`, or `bind --hold mouse2 "fly sword --inverse"`):
    - `--directional` (the default): you fly toward the cursor. The aim height is mirrored
      through you (above lifts you), and left or right (`keyLeft`, `keyRight`, the A and D
      flags) is held toward the cursor's side, the walking push the game gives a limp body
      (`frame2.js:37388`); within 50 of straight above or below, neither.
    - `--inverse`: only the aim height is mirrored (`tary`, a getter like `tarx`), so the cursor
      above you lifts you.
    - `--plain`: the plain sweep; the cursor below you lifts you.
    - `--default`: back to the default (unsets `fly_sweep_aim`).
  - `fly_sweep_ragdoll` is the share of ticks the sweep holds X for you: 1 (the default) every
    tick; 0 never, it leaves X alone and you press it yourself; in between, X is held on that
    share of the ticks, spread evenly, and released on the others (an experiment: less limp,
    less lift). A saved on/off from before reads as 1/0. The sweep only writes the keys it holds (X, the mouse
    button for sword, A or D for directional) and lets go of only those when it stops, so
    your own click still fires a gun during `fly sweep`, and an X you hold yourself stays held.
  - How fast is `fly_sweep_throttle`:
    - `edge` (the default): by how far your cursor is toward the screen edge. The share is
      measured on screen, per axis (the cursor's distance from you times the zoom, over the
      game's width, 800, left and right, and its height, 400, up and down), so zoom does not
      change it; the camera keeps you opposite the cursor, so the edge is 100%. Under 5% counts
      as nothing. `fly_sweep_measure distance` measures in game units from you instead, against
      `fly_sweep_reach` (400): the cursor that far away is full speed at any zoom, so zoomed out
      (25%) you do not have to reach for the screen edge. `fly_sweep_curve` shapes the rest: 1 is a straight line, 2 gentler near you, and the
      default, 0.25 (down to 0.1), gets fast soon after the cursor leaves you.
      Up and down: the aim swings on a circle of radius `fly_sweep_range` around you, by an
      angle from none (both aims straight below or above you: no lift) to half a turn (level
      left, then level right: full lift); the aim is never farther than the radius, so the
      approved-match hold back never cuts in below 1000. Left and right (directional): A or D
      is held for that share of the ticks, spread evenly. The first tick aims fully toward
      the cursor's side, so the facing rule above still holds.
      With `--directional` the swing is tilted toward the cursor: it circles the point
      opposite the cursor, not the point below you, by an angle from the cursor's share of
      the screen (left and right over 800, up and down over 400, combined), so the push that
      lifts you points at the cursor in any direction. The aim stays on the radius, so it is
      as safe in approved matches as the plain swing; A or D is still held as before.
      `--inverse` and `--plain` keep the swing around the point below or above you. Checked
      headless: the cursor to your right aimed `-210, -668` then `-172, 679`; up and right
      `-441, -544` then `356, 603`. Whether the push follows the tilt is felt in a real window.
    - `near`: the earlier sweep, left and right at `fly_sweep_range`, at your cursor's height;
      the closer the cursor, the bigger the swing, and the side is held whole.
    - Checked headless: with the cursor at the screen center the aim was `0, 700` (no swing),
      half way up `-455, 532`, at the top `-699, 38`. Lift itself is felt in a real window.
  - Safe with the anti-cheat checks on (no `bypass checks`): `fly sweep` and `fly sword` are the
    only fly modes, and the only movement commands, that are. They change nothing the game
    does not let a player change: your own aim (`tarx`, which the AHK sweep changes by moving
    the cursor) and the X and mouse keys. The aim override is a getter on your character
    object, so the game's anti-tamper scan, which compares globals and classes
    ([anticheat](../research/anticheat.md) §6), sees nothing new; in an approved match the aim
    stays within 1000 of you, the server's zoom-hack limit (§14.6). `fly on` and `fly free`
    move you in ways no input can, and are not safe there.
  - The sweep owns your aim, so your facing, arm and shots follow the swing, not the cursor.
    `fly_sweep_shoot` (off by default): while you hold the left mouse button yourself in
    `fly sweep`, every other tick aims at your cursor (the game's own aim, kept aside), so a
    gun fires where you point when its reload falls on such a tick; the swept ticks still
    take both sides in turn, so you keep about half the lift while you shoot. `fly sword`
    holds the button itself and never does this. Checked headless: with the button held the
    aims went `412,-211` (cursor), `241,657`, `411,-211` (cursor), `-394,-579`.
  - Not yet: aiming at the cursor on exactly the tick a gun fires (all the lift kept).
  - Checked headless: the aim and facing flip every frame and the crosshair stays put. The
    climb was confirmed in a real window, not headless.
- Client-only. With the flag off, the keys do not exist; saved values are kept but not
  applied.
