# Your own server

`npm run server` runs a Plazma Burst 2 lobby server on your computer. Your friends
pick it in the app's server list. The official site and its servers are not part of
it: it has its own match list, matches, chat and bans.

It's the game's own server. Every copy of the game includes the official lobby server's
code (`scripts/libs/flash.js`, `scripts/connection.js`): logging in, the match list,
creating and joining matches, rounds, maps, and the match owner's commands. This server
runs that code in Node. It adds only what the game doesn't include: accounts (nickname
and server password), a map source, and TLS (see `src/server/game.ts`). The matches
therefore play by the official rules.

```
npm run server                         # data/server/server.json
npm run server -- --config other.json
npm run server -- --verbose            # also the game code's own debug output
```

Gameplay goes over TCP (a websocket) between each player and your computer, like the
official "USA, ARIZONA (TCP)" matches, only closer. A player's ping is to your computer.

## Hosting

1. `npm install` and `npm run fetch-game`. The server reads the game files in `game/`.
2. Copy `data/server/server.example.json` to `data/server/server.json` and set a `password`.
3. Run `npm run server`. On first start it makes a certificate (`data/server/`) and
   prints what players need:
   ```
   address:     192.168.1.20:2053
   fingerprint: 0B:3A:52:…
   ```
   `join` in the terminal prints it again.
4. For friends outside your network, forward **TCP port 2053** on your router to this
   computer, and give them your public address instead of the local one.

## Joining (each player)

1. Get this project and the game: `npm install`, then `npm run fetch-game`.
2. `npm start` opens the server list: PlazmaBurst2.com and your private servers, each
   with its address, ping, players and description.
3. **Add server**: the address, the fingerprint (the host sends it, or "Get from server"
   asks the server; compare the two), your nickname, the server password. Saved in
   `data/servers.json`; add as many servers as you like.
4. Double-click a server (or select it and press Play / Enter), then **Multiplayer**. The
   match browser lists that server's matches; creating and joining work as usual.

Back to the list from the game: `servers page` in the dev console, or **Servers > Server
list** in the menu (Alt shows it). There's no shortcut key, so every key stays free for
your `bind`s. Everything the list does also works from the console, if you'd rather skip
the page:

| | |
|---|---|
| `servers` | the list: number, name, address, ping, players, description |
| `servers connect <server>` | play there (`official`, a number from the list, or a name or address) |
| `servers add address=… fingerprint=… nickname=… [password=…] [name="…"]` | save a server; `fingerprint=fetch` asks the server for it |
| `servers edit <server> key=value …` | change any of those |
| `servers remove <server>` | forget it |
| `servers fingerprint <address>` | what certificate a server shows |
| `servers page` | back to the list page |

A typed `password=` is kept out of the console's history and log (shown as `•••`).

A `data/join.json` from before the list is imported once.

What playing on a private server does:
- **The game starts logged out.** Your PB2 account (`data/credentials.json`, or the
  game's own login, put aside until you play the official server again) isn't
  loaded, so it is never sent anywhere. The nickname and server password are given to
  the game only after start-up, and only the lobby uses them. The list page never gets
  the password back from the app either.
- **The game connects to that address only if the certificate there is exactly the
  saved fingerprint.** Nobody else can pose as the server, and the connection is
  encrypted. The list says so when a server's certificate has changed.
- **The ping is the time to open a connection, one round trip.** Players, description and
  game version come from the server's `/status`, which names no one.
- **Everything else is unchanged.** Game files are local and the dev console works.

## Terminal

| | |
|---|---|
| `status` | how many are online, and the matches |
| `who` | nickname, address, ping, which match |
| `matches` | number, title, map, players |
| `say <text>` | a server line in everyone's chat |
| `kick <nickname>` | disconnect a player |
| `ban <nickname>` / `unban` / `bans` | keep someone out; kept in `data/server/bans.json` |
| `end <match>` | end a match (its number from `matches`) |
| `map <match> <map ID>` | change a match's map |
| `join` | what players need to add the server |
| `quit` (Ctrl+C) | close the server |

Logins, matches created, joins, leaves, chat and anti-cheat reports are printed as
they happen. Players can be named by the start of their nickname.

## Settings (`data/server/server.json`)

| | default | |
|---|---|---|
| `port` | 2053 | TCP port (the game's own lobby port) |
| `bind` | `0.0.0.0` | address to listen on |
| `name` | `"Plazma Burst 2 server"` | the server's name in players' server lists |
| `description` | `""` | a line under it there |
| `password` | `""` | the server password players enter when they add the server |
| `nicknames` | `[]` | if set, only these nicknames may log in |
| `admins` | `[]` | nicknames with the game's staff rights: `-announce`, ending any match, kicking from any match, the in-game ban (a server ban) |
| `max_players` | 64 | players online at once |
| `skin` | 1 | the skin everyone starts with; players change it in the game as usual |
| `download_maps` | `true` | published map IDs are downloaded from the site's public map download (and kept in `data/maps`); `false` = only `data/maps` |
| `random_maps` | `[]` | your list of map IDs that `random approved` and `random approved in rotation` pick from (the example has one); empty = every map in `data/maps` |
| `cheat_reports` | `"log"` | the game's anti-cheat reports: `"log"` them, or `"kick"` the player too |
| `welcome` | `""` | a line each player gets in chat after logging in |

## Maps

A match's map ID is looked up on the server's computer:
- **`local-<name>` or `<name>`:** `data/maps/<name>.xml` (or `.txt`), the same local
  maps as the wrapper's.
- **Any other ID:** a published map, downloaded from plazmaburst2.com (no login needed),
  unpacked to plain XML with the game's own function, and kept in `data/maps/<map id>.xml`
  (the same folder and file names the game client saves downloaded maps to, through
  `src/kernel/maps/file-name.ts`), so each map is downloaded once, by either. This is the only time the server contacts the site.
- **Only if the site doesn't have it either** does the match get an error ("does not exist:
  not on this server, not on plazmaburst2.com"). A map without player starts (an add-on
  such as `nanotech-cht`) leaves the player count to the match's own setting.

- **`random approved`, `random approved in rotation`:** the create screen's default IDs. The
  official map service picks a random approved map for them; this server picks one from
  `random_maps`, or every map in `data/maps` (your local maps and the ones the wrapper
  saved from play), not the one playing now. With rotation on, each round picks again.
- **IDs joined with a comma** (`a,b`, the official service merges them) are not supported.

Players don't need the map file: the server sends each map to whoever joins.

## Next to the official server

| | Official | Yours |
|---|---|---|
| Accounts | PB2 accounts | a nickname and the server password; no profiles, stats, reputation (everyone has 40, enough for any "min reputation") or relations |
| Ranked, stats | yes | ranked matches can be created, but nothing is kept |
| Reports, endorsements | change reputation | answered "nothing was changed" |
| Anti-cheat reports | the server disconnects the player | printed (`cheat_reports: "kick"` disconnects too). The game still reloads the page of a player whose own scan trips, as it always does |
| Location on the Tab scoreboard | "USA, Arizona" | "Private server, <address>": the game writes "USA, Arizona" for every match not hosted by a player, and join mode replaces it |
| Game version | the site's | the server and every player must run the **same game version**. After `npm run fetch-game` brings a new one, update all of them |
| Who can connect | anyone | only this app, with your fingerprint and password saved in its server list; ordinary copies of the game never come here |

Player-hosted ("THIS DEVICE (UDP)") matches use the same server code, so they should
work too, but they haven't been tried.
