# Your own server

`npm run server` runs a Plazma Burst 2 lobby server on your computer. Your friends
connect to it with `npm run join`. The official site and its servers are not part of
it: it has its own match list, matches, chat and bans.

It's the game's own server. Every copy of the game includes the official lobby server's
code (`scripts/libs/flash.js`, `scripts/connection.js`): logging in, the match list,
creating and joining matches, rounds, maps, and the match owner's commands. This server
runs that code in Node. It adds only what the game doesn't include: accounts (nickname
and server password), a map source, and TLS (see `server/game.js`). The matches
therefore play by the official rules.

```
npm run server                         # server/server.json
npm run server -- --config other.json
npm run server -- --verbose            # also the game code's own debug output
```

Gameplay goes over TCP (a websocket) between each player and your computer, like the
official "USA, ARIZONA (TCP)" matches, only closer. A player's ping is to your computer.

## Hosting

1. `npm install` and `npm run fetch-game`. The server reads the game files in `game/`.
2. Copy `server/server.example.json` to `server/server.json` and set a `password`.
3. Run `npm run server`. On first start it makes a certificate (`server/data/`) and
   prints what players need:
   ```json
   { "address": "192.168.1.20:2053", "fingerprint": "0B:3A:…", "nickname": "<their nickname>", "password": "<the server password>" }
   ```
   `join` in the terminal prints it again.
4. For friends outside your network, forward **TCP port 2053** on your router to this
   computer, and give them your public address instead of the local one.

## Joining (each player)

1. Get this project and the game: `npm install`, then `npm run fetch-game`.
2. Copy `desktop/join.example.json` to `desktop/join.json` and fill it in from the
   server's lines: address, fingerprint, your nickname, the server password.
3. `npm run join`, then **Multiplayer**. The match browser lists the server's matches,
   and creating or joining a match works as usual.

`npm start` still plays on the official servers; only `npm run join` goes to yours.

What join mode does:
- **The game starts logged out.** Your PB2 account (`desktop/credentials.json`) isn't
  loaded, so it is never sent anywhere. The nickname and server password are given to
  the game only after start-up, and only the lobby uses them.
- **The game connects to the address in `join.json` only if the certificate there is
  exactly the one in `fingerprint`.** Nobody else can pose as the server, and the
  connection is encrypted.
- **Everything else is unchanged.** Game files are local and the dev console works.

## Terminal

| | |
|---|---|
| `status` | how many are online, and the matches |
| `who` | nickname, address, ping, which match |
| `matches` | number, title, map, players |
| `say <text>` | a server line in everyone's chat |
| `kick <nickname>` | disconnect a player |
| `ban <nickname>` / `unban` / `bans` | keep someone out; kept in `server/data/bans.json` |
| `end <match>` | end a match (its number from `matches`) |
| `map <match> <map ID>` | change a match's map |
| `join` | what players put in `desktop/join.json` |
| `quit` (Ctrl+C) | close the server |

Logins, matches created, joins, leaves, chat and anti-cheat reports are printed as
they happen. Players can be named by the start of their nickname.

## Settings (`server/server.json`)

| | default | |
|---|---|---|
| `port` | 2053 | TCP port (the game's own lobby port) |
| `bind` | `0.0.0.0` | address to listen on |
| `password` | `""` | the server password players put in `join.json` |
| `nicknames` | `[]` | if set, only these nicknames may log in |
| `admins` | `[]` | nicknames with the game's staff rights: `-announce`, ending any match, kicking from any match, the in-game ban (a server ban) |
| `max_players` | 64 | players online at once |
| `skin` | 1 | the skin everyone starts with; players change it in the game as usual |
| `download_maps` | `true` | published map IDs are downloaded from the site's public map download (and kept in `server/data/maps`); `false` = only `desktop/maps` |
| `cheat_reports` | `"log"` | the game's anti-cheat reports: `"log"` them, or `"kick"` the player too |
| `welcome` | `""` | a line each player gets in chat after logging in |

## Maps

A match's map ID is looked up on the server's computer:
- **`local-<name>` or `<name>`:** `desktop/maps/<name>.xml` (or `.txt`), the same local
  maps as the wrapper's.
- **Any other ID:** a published map, downloaded from plazmaburst2.com once and then kept.
  This is the only time the server contacts the site, and it sends no login.

Players don't need the map file: the server sends each map to whoever joins.

## Next to the official server

| | Official | Yours |
|---|---|---|
| Accounts | PB2 accounts | a nickname and the server password; no profiles, stats, reputation (everyone has 40, enough for any "min reputation") or relations |
| Ranked, stats | yes | ranked matches can be created, but nothing is kept |
| Reports, endorsements | change reputation | answered "nothing was changed" |
| Anti-cheat reports | the server disconnects the player | printed (`cheat_reports: "kick"` disconnects too). The game still reloads the page of a player whose own scan trips, as it always does |
| Match browser location | "USA, Arizona" | also shows "USA, Arizona": the game writes that text for every match not hosted by a player |
| Game version | the site's | the server and every player must run the **same game version**. After `npm run fetch-game` brings a new one, update all of them |
| Who can connect | anyone | only `npm run join` with your fingerprint and password; ordinary copies of the game never come here |

Player-hosted ("THIS DEVICE (UDP)") matches use the same server code, so they should
work too, but they haven't been tried.
