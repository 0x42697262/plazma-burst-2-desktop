# p2p_host

Feature flag `p2p_host` (on by default; server mode only, `npm run p2p-host`; not for Sad
Burst 2). Code: `src/features/p2p_host/`: config, page log, the host driver in the page
(`services/host.ts`), its `server` command and shortcuts (`entry/command.ts`) and the
console side (`console.ts`). How to run it: [p2p-host](../operations/p2p-host.md).

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

## The host driver in the page
`services/host.ts` runs in the game page of the dedicated host window only (`PB2_SERVER`
set); the console starts it once the game's stage exists. It logs in to the lobby server,
starts the match from the config as a player-hosted ("THIS DEVICE (UDP)") one, moves
itself to the spectators, and keeps the match going: who joins and leaves, the `allow`
list, the local map, and starting again when the match is gone.
- Every step is one the game takes itself: its lobby screen logs in, the create screen's
  message makes the match, the "Spectate" button's message moves the host, and the match
  owner's chat commands (`-map`, `-pause`, ...) and kick button do the rest. The players
  play over WebRTC with this game; the lobby server lists the match, checks who may join
  and passes their connection offers along.
- It ticks every 500 ms through the phases starting the game, logging in, creating,
  joining, running, waiting to start again and stopped. From the menu it goes to the
  lobby screen (`MPLobby`) and creates the match once the lobby connection is ready.
- A step that takes longer than 30 s is reported once.
- While running, the game being back on the lobby or menu screen for more than 8 s means
  the match is gone, as does the match leaving the game's match list.
- When the match stops by itself, the host waits `restart_after_s` and starts again from
  the beginning; with 0 it stays stopped until `server start`. `server restart` waits 3 s.
- Replies from the lobby server arrive inside the game's network code, so their handlers
  (and the tick) catch everything they throw and print it instead.
- The match title defaults to "Game by <nickname>", and the region the match browser
  shows defaults, as the game's create screen does, to the first part of this computer's
  time zone ("Europe/Berlin" gives "Europe").
- Without `host_plays`, the host sends the "Spectate" button's message (a join to the
  spectator slot with the match password) when it is in the level and not spectating,
  at most every 10 s.
- `allow`: a player whose login is not on the list is told "this match is for invited
  players only" in a server message and kicked; the same auth id is not kicked again for
  30 s. A kick is the match owner's: out of the match, and kept out of it (the match's ban
  list) until `server unbanall`. A player without an auth id has not fully joined yet and
  cannot be kicked.
- The local map is `desktop/maps/<name>.xml`. The wrapper serves it as map ID
  `local-<name>` at the address where the game downloads maps (`/pb2/server.php`); the
  host downloads it there and sets it as the match's map, which sends it to every player.
  From then on it is put back over any map the lobby server sends (a rotation, `-map`)
  whenever the match's map text differs. A note says when the map has fewer player starts
  than the match has slots. `server map <id>` drops the held local map.
- Chat lines reach the terminal (the game's chat trace is turned on at start), and any
  extra ICE servers from the config are added to the game's WebRTC configuration.
- `server stop` sends `-terminate` when the match is running and stays stopped.
- `entry/command.ts`: `server` and its subcommands; `who`, `kick` and `say` are the same
  as their `server` subcommands, for short. A player is found by slot (`3` or `#3`),
  nickname or login, or the unique start of one of them.
