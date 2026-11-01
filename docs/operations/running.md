# Running

## Start modes

| Command | What it starts | Flag that can turn it off |
|---|---|---|
| `npm start` | The game window: the server list, then the official server or a private one | (none; `server_list` off goes straight to the official game) |
| `npm run sadburst` | Sad Burst 2 in its own session ([client-sadburst](../features/client-sadburst.md)) | `client_sadburst` |
| `npm run host -- [options]` | Remote play: testers play games on this machine from a browser ([remote-play](remote-play.md)) | `remote_play` |
| `npm run p2p-host` | The player-hosted dedicated host ([p2p-host](p2p-host.md)) | `p2p_host` |
| `npm run server` | Your own lobby server, no Electron ([private-server](private-server.md)) | (separate program) |
| `npm start -- --features` | Prints every feature flag, on or off and why, and quits | |

Every Electron start mode builds first (`npm run build`): the console, the server list
page, the hooks runtime and the remote-play client go to `dist/`.

## Settings

| Variable or argument | Default | What |
|---|---|---|
| `PB2_FEATURES=+id,-id` | | Turn features on or off for this start ([feature flags](../architecture/feature-flags.md)). `features.json` at the repository root does the same, kept. |
| `PB2_DEV=0` | on | The same as `-dev_console`. |
| `PB2_HOOKS=0` | on | The same as `-hooks`. |
| `PB2_GAME_DIR` | `game/` (Sad Burst 2: `game.sadburst/`) | Play a different game copy. |
| `PB2_VERSION` | from `pb2-version.json` | The version folder used in the URL. |
| `PB2_LOGIN`, `PB2_PASSWORD`, `PB2_UID` | `desktop/credentials.json` | Login cookies ([login](../features/login.md)). |
| `--verbose` / `-v`, `--log-level=<level>`, `PB2_LOG_LEVEL` | `info` | Terminal log level: `error`, `warn`, `info` or `debug`. `debug` adds every request, window events, the page's `console.debug` and the game's own `trace()` output. |
| `--log-format=json` | text | One JSON object per log line. |

Every setting is read once, at start, by `src/kernel/config/`; a value it cannot use
stops the start with the reason, before any window opens.

## Checks

- `npm run verify`: lint, type check, every test, build. Run it before every commit.
- `npm run smoke -- --run "<console line>"`: starts the real app over the DevTools
  protocol, plays the official server from the server list, and prints what each console
  line printed.
