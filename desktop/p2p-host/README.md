# Player-hosted dedicated host

> For a server of your own that the official site is not part of at all, see
> [server/README.md](../../server/README.md) (`npm run server` and `npm run join`). This
> host is for a match listed by the official lobby, that any copy of the game can join.

`npm run p2p-host` runs the game with no window and nobody playing on it. It hosts one
match with the game's **MATCH LOCATION: THIS DEVICE (UDP)** setting, and you control it
from the terminal. Your friends join from the normal match browser in any copy of the
game (browser or desktop). They play against this computer, not the official server in
Arizona.

```
npm run p2p-host                       # desktop/p2p-host.json
npm run p2p-host -- --config other.json
npm run p2p-host -- --verbose          # also the game's own debug output
```

## Setup

1. Log in with an account in `desktop/credentials.json`, as for `npm start`. A guest
   can host, but only an account can change maps, kick players or use the other match
   owner commands.
2. Copy `desktop/p2p-host.example.json` to `desktop/p2p-host.json`, then set at least
   `match.map_id` and `match.password`.
3. Run `npm run p2p-host`. Once the terminal says `Host: running`, the match is listed in
   the browser as *"<your region>, player-hosted"*.

## Settings (`desktop/p2p-host.json`)

`match` is the game's own preset, the same JSON as **Create New Match > Copy Preset as
text**, so you can paste one in. The host always sets `p2p: true`, `ranked: false` and
`accept_connections_manually: false`, and warns if the file says otherwise.

| `match` key | |
|---|---|
| `title` | shown in the browser; empty = "Game by <your nickname>" |
| `map_id` | the map to start with: a published map ID, `random approved`, or IDs joined with `,` |
| `map_rotation` | `""` (off), `reload`, `random approved`, `random approved in rotation`, or a list of IDs |
| `game_type` | `DM`, `TDM`, `COOP` |
| `max_players` | 2, 3, 4, 5, 6, 8, 16, 32, 64 |
| `password` | join password |
| `gameplay_modifications`, `min_reputation`, `exclude_inactive_players`, `ping_limit`, `ping_limit_action`, `rounds_until_rotation`, `round_duration_str`, `respawn_model`, `allow_vpn_guests` | as on the create screen |

| Host key | |
|---|---|
| `allow` | account logins that may stay; anyone else who joins is kicked, which keeps them out of this match. `[]` = anyone with the password |
| `host_plays` | `false`: the host moves itself to the spectators |
| `local_map` | a map in `desktop/maps` (without `.xml`) that this host sends to the players (see below) |
| `region` | what the browser shows; empty = your time zone's region, as the game does |
| `udp_ports` | e.g. `"50000-50100"`: WebRTC on this computer uses only these UDP ports, so you can forward them on your router |
| `ice_servers` | more STUN/TURN servers for this host's side, e.g. `["stun:stun.example.com:3478"]` or `{ "urls": "turn:…", "username": "…", "credential": "…" }` |
| `fps` | the game's frame rate here (10-120) |
| `restart_after_s` | when the match ends by itself, start a new one after this many seconds (0 = stay stopped) |

## Terminal

Every line is a dev console command. These ones exist only on the host:

| | |
|---|---|
| `server status` | what the host is doing, the settings, who is in the match |
| `who` | slot, name, ping, team, HP, reputation |
| `say <text>` | chat to everyone |
| `server tell <player> <text>` | a server message to one player |
| `kick <player>` | removes them and keeps them out of this match (`server unbanall` lets them back) |
| `server map <id \| next \| reload>` | the match owner's `-map` |
| `server map local <name>` | play `desktop/maps/<name>.xml` |
| `server pause`, `swap`, `endround`, `unbanall` | the owner's `-pause`, `-swap`, `-endround`, `-unbanall` |
| `server ping <ms \| off>`, `ping_action <…>`, `min_reputation <n>` | `-ping`, `-ping_action`, `-min_reputation` |
| `server stop` / `start` / `restart` | end the match / start a new one / both |
| `quit` (or Ctrl+C) | end the match and close |

A player can be named by slot number, nickname or login, or by the start of one.
Chat, joins and leaves are printed as they happen.

`netlog` shows each player's connection (`p2p-guest`) with its ping and losses, and
`netlogs/<date>_<time>_server.log` keeps it. Use it to see how laggy a friend really is.

## Local maps

The lobby server loads maps by ID from the map database. A player-hosted match gets
its map from the lobby server, and the host then sends that map to each player who
joins. With `local_map`, or `server map local <name>`, this host replaces it with a file
from `desktop/maps` (the game's own map change: everyone reloads into it), and puts the
file back whenever the lobby server sends another map. Keep `match.map_rotation` at `""`
so that happens only once.

- `match.map_id` still has to be a published map. The lobby server makes the match with
  it, and the browser shows that map's name.
- The match keeps the slot count it was created with. The host warns when the local map
  has fewer player starts than that.

## What goes through the official server

Your friends' game connects to a player-hosted match only through the lobby server.
The lobby server's reply to a join carries the host's WebRTC offer. So even with this
host, the official server still does these things:

| Through the lobby server (Arizona, TCP) | Between your friends and this host (WebRTC, UDP) |
|---|---|
| login, the match list, join checks (password, reputation, kicks, VPN) | every gameplay message, both ways |
| which slot each player gets | the match's state, rounds, scores |
| passing the WebRTC offers and answers along | the map, sent to each player who joins |
| **chat** and the owner's `-` commands | |
| loading a map by ID | |

Gameplay never goes through Arizona: each friend's ping is to your computer. Chat does
go through Arizona, so it arrives a little late, but it doesn't affect play.

A match with no official server at all is not possible with the game as it is. The game
has a hidden switch for a lobby server on `localhost`, but the lobby server itself (its
accounts and player records) is not in the game's files. That would mean writing a
whole lobby server, and every friend running a changed game.

## Player-hosted vs. official server

| | Official server (USA, Arizona) | This host |
|---|---|---|
| Gameplay latency | to Arizona | to your computer |
| Ranked, stats | yes | no (the game doesn't count player-hosted matches) |
| Connection | TCP websocket, always works | WebRTC: STUN only (Google, Twilio), **no TURN relay**. If both sides are behind a strict NAT (CGNAT, some mobile networks), the connection fails. Fix it on your side with `udp_ports` plus port forwarding, or a TURN server in `ice_servers` |
| Ping in the browser | shown | "?" (the browser cannot measure it); `who` and `netlog` here show it |
| Ping limit | against ping to Arizona | against ping to this host |
| Anti-cheat reports | the server disconnects the player | on a P2P host a player's report fails. The match says they will be disconnected, but they are not (ANTICHEAT.md §13.5) |
| Accept each player | — | the game asks in a dialog nobody here can click; use `allow` |
| Match lives while | the server runs | this host is online and logged in to the lobby server; if the host drops, the match ends and the host starts a new one after `restart_after_s` |
| Maps | published IDs | published IDs, plus local maps through this host |
| Match browser listing | yes | yes, as "<region>, player-hosted"; the game shows a notice that your IP address is shared with whoever joins |
