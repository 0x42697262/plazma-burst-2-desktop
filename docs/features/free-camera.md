# free_camera

Feature flag `free_camera` (on by default; all modes; needs `dev_console`). Code:
`src/features/free_camera/`.

`freecam` moves the view without moving your character, for live map editing: no walking to a
place just to look at it.

## Use
- `freecam` switches it on and off; `freecam --on` and `freecam --off` set it, which is what a
  hold bind runs: `bind --hold f4 freecam` keeps it on while F4 is held.
- While it is on, W A S D and the arrow keys pan the view and never reach the game, so your
  character stands still. Shift pans faster. Every other key, click and the map editor work as
  usual.
- A middle mouse drag drags the map; the middle button does not reach the game.
- It ends when you turn it off, die or the level ends, and when the window loses focus the pan
  keys are let go. Turning it off hands the camera back; the game eases it back to you.

## Settings
| Setting | Default | |
|---|---|---|
| `freecam_speed` | 900 | Pan speed in screen pixels a second (the game is 800 wide), the same at any zoom |
| `freecam_fast` | 3 | How many times faster while Shift is held |

## How
- The game moves its camera every frame, in its frame handler, toward your character and your
  aim (`game.x` and `game.y`, `frame2.js:38641-38650`). The console's frame hook runs after it
  and puts the camera back on the free camera's center, a point in the world, so `zoom` keeps
  working around the same center. A frame counts at most a tenth of a second, so a hitch does
  not jump the view.
- The pan keys are taken in the console's key handler (`provideKeyHandler`), before binds and
  the game; their release comes through `provideKeyUpHandler`, which the console now calls on
  every key up.
- The game has a free camera of its own, but only while you are dead or spectating
  (`frame2.js:38596`); turning that on while alive would mean flagging you as a spectator.

## Approved matches
Off in approved matches unless `bypass checks` is on: with the view far from you, your cursor
reaches far outside the normal view. In multiplayer the game holds your aim within 800 left and
right and 400 up and down of you (`frame2.js:34983`), but the free camera is in the bypass group
all the same. If a match becomes approved while it is on, it turns off.

## Checked
Headless, official client: the view held still while the game would move it, D panned it and
did not reach the game (the right-key flag stayed false, your character did not move), letting
go stopped it, and after `freecam --off` D reached the game again and the camera came back to
you.
