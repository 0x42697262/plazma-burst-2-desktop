# p2p_host

Feature flag `p2p_host` (on by default; server mode only, `npm run p2p-host`; not for Sad
Burst 2). Code: `src/features/p2p_host/` (config, page log, console side) and, until
P6.1, `desktop/dev/console/server/host.js` and `commands/server.js`. How to run it:
[p2p-host](../operations/p2p-host.md).

With the flag off, `npm run p2p-host` logs that the host is off and quits. In the page,
the `server`, `who`, `kick` and `say` commands are not registered and the host never
starts.

## The config file
- `desktop/p2p-host.json`, or the file given with `--config <file>` / `--config=<file>`.
  It is written by hand, never by the app, so it carries no version.
- `match` is the game's own match preset, the JSON its create screen copies with "Copy
  Preset as text" (title, map_id, max_players, password, ...). It is sent to the lobby
  server as the create screen would, always as a player-hosted ("THIS DEVICE (UDP)")
  match that is not ranked.
- The rest is what only the host does: who may stay (`allow`), which local map it serves,
  the UDP ports and ICE servers its WebRTC uses, the frame rate it runs at, and how soon
  it starts again after the match is gone.
- Keys starting with `_` (such as `_comment`) are ignored. Unknown keys are left out with a
  warning. Problems are warnings and the host starts; errors stop it.

## Checks
- The create screen's choices (the game's `scripts/screens/MPCreateMatch.js`): game type
  DM, TDM or COOP; 2, 3, 4, 5, 6, 8, 16, 32 or 64 players; minimum reputation 0, 1, 5, 10,
  20 or 40; ping limit actions spectate, spectate_then_ban, pause_match,
  notify_everyone; respawn model v2 or v1. Rounds until rotation defaults to the game's
  own 15.
- Forced values, whatever the file says:
  - `p2p` true: the dedicated host only hosts on this device;
  - `ranked` false: stats of player-hosted matches are not counted, and spectating,
    which the host does, is not allowed in a ranked match;
  - `accept_connections_manually` false: the game asks in a dialog nobody can click
    here; `allow` does that job.
- `map_rotation` defaults to off: a private match plays the map it is given.
- `title` is at most 100 characters; `title` and `map_id` may not contain `[^c]`, which
  the server splits messages on.
- `round_duration_str` is read as the game reads ROUND DURATION: "default" (or "auto",
  or empty), or units like "1 hour 30 minutes 5 seconds", a decimal comma allowed.
- `udp_ports`: "50000-50100" or one port, within 1024-65535, low to high.
- `ice_servers`: "stun:host:port", or `{ urls, username, credential }`; urls start with
  stun:, stuns:, turn: or turns:, and a TURN server needs a username and credential.
- `allow`: account logins, trimmed, lowercased, without duplicates.
- `local_map`: a file name in `desktop/maps` without `.xml`; a `local-` prefix and a
  `.xml`/`.txt` extension are dropped. Paths are refused.
- `region` (at most 40 characters) also becomes the match's `p2p_region`.
- `fps` 10-120; `restart_after_s` 0 or more (0: never start again by itself).
- Warnings: a local map with a map rotation (each rotation brings the server's next map,
  and the host puts the local map back over it, so everyone reloads twice); no `allow`
  list and no password (anyone who sees the match in the browser can join).

## The host window
- The default session, logged in like `npm start`, its own console settings file
  (`desktop/p2p-host-overrides.json`), and `PB2_SERVER` (the checked `{ match, server }`,
  not enumerable) set before any script on its page.
- The page's console goes to the terminal: the console's own `[pb2dev] ` lines and
  `[chat] ` lines as plain text (HTML tags dropped, entities decoded), errors as errors,
  the game's other output only with `--verbose`.
- When the page's process dies, the game loads again after 5 s. On quit, `server stop`
  runs first and the app waits 1.5 s, the time for "-terminate" to reach the lobby
  server; Ctrl+C a second time closes at once.
- Every terminal line is a console command; `quit` or `exit` ends the match and closes.
