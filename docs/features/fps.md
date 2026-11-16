# fps

Feature flag `fps` (on by default; all modes; needs `dev_console`). Code: `src/features/fps/`.

`fps` sets the game's own display settings, the same values its Esc menu sets:

| Word | Sets | Game value |
|---|---|---|
| `20`, `30`, `60` | the FPS | `fpsChoice` 1, 2 or 3, then `applyFps()` sets the stage frame rate |
| `low`, `high` | the physics quality | `lowPhysics` true or false, then `syncPointHistory()` (Sad Burst's menu does this too, so points do not jump) |
| `match`, `unlimited` | the logic | the official client's `UNLIMITED_SCREEN_REFRESH_RATE`; the Sad Burst clients' `FRAME_INTERPOLATION` ("UNLIMITED RENDER FPS") |

- Each word sets only its part, in any order (`fps 60 high`, `fps high 60`, `fps 30`, `fps low`);
  `fps` alone shows all three. A part given twice is a usage error.
- A client without the logic setting says so and sets the rest.
- The names come from `find-names` (`fpsChoice`, `lowPhysics`, `applyFps`, `syncPointHistory`;
  [find-names](../operations/find-names.md)), so it works in all three clients.
- Client-only: only your own game runs differently. It does not depend on `fly`; `fly sweep`
  needs 60 FPS with high physics, and `fps 60 high` gets you there.
