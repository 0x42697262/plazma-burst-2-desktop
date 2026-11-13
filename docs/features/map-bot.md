# map_bot: maps from the official lobby

Feature flag `map_bot` (on by default; lobby server only, `npm run server`). Code:
`src/features/map_bot/`: the account file (`adapters/account.ts`), the game's own
lobby client run in Node (`adapters/lobby-client.ts`), one lobby session per map
(`services/fetch-map.ts`) and the server part (`server.ts`).

With `"official_lobby"` in the server's `map_sources`
([private-server](../operations/private-server.md#maps)), a map the server doesn't have
is fetched from the official lobby, as a player would get it:

1. Log in to `vvvv.plazmaburst2.com:2053` with an account.
2. Create a private match with the map: a random password, 2 players, not ranked, on the
   lobby's own servers.
3. The lobby sends the map in `MAP_CHUNK` messages: the same text the site's map
   download (`/pb2/server.php`) returns.
4. Disconnect. The match ends with nobody in it.

The server then checks the map, keeps it in `data/maps/` and starts the player's match.
A map is fetched once. The server's limits apply (one at a time, at most 6 new maps a
minute), and the bot itself creates a match at most every 10 s.

## Why the lobby, not the site
The site is behind Cloudflare, which answers datacenter addresses (AWS and the like)
with a challenge, so a cloud server cannot download maps from it. The lobby is not
behind Cloudflare. Guests are refused from such addresses ("Guests can't join with VPN
services on"), an account is let in. Verified from AWS on 2026-11-14.

## The account
- `data/server/map-bot-account.json`, or the file in `PB2_MAP_BOT_ACCOUNT` (a Docker
  secret, for example): `{ "login": "…", "password": "<md5 of the password>" }`, the
  format of `data/credentials.json` (other keys are ignored). The lobby takes the md5 of
  the password as the password, so the site is never asked.
- Without the file, a server that lists `"official_lobby"` does not start, and says why.
- The account is visible to the lobby: it creates a match for a moment for each new map.

## Lobby tasks are never run
The lobby may send code for the client to run (`RELIABLE_TASK`,
[fingerprinting](../research/fingerprinting.md) §4). The game runs it only for its main
connection (`net.lobbyConn`); the bot's connection is never registered as one, so the
game's own rule leaves every task unrun. The server logs once that a task came. A test
checks the connection is never the main one.

## The game's code in Node
The client is the game's own `connection.js` and `flash.js` with its strings, in a
`vm` context, the way the server runs the lobby side. Two page functions the network
tick calls on a client (`tickGuardBefore`, `tickGuardAfter`, found by find-names) are
stood in by functions that do nothing: with no level loaded, the page's own return at
once. The map is read from the raw packets with the network codec.

The login sends the game's own client fields (`LOBBY_CLIENT` in `keys.ts`: `version_h5`,
`hash_h5` and the build). If the game's build changes, the server warns at start, and a
test fails, until `LOBBY_CLIENT` follows it.

## With the flag off
`PB2_FEATURES=-map_bot npm run server` with `"official_lobby"` in `map_sources` stops
with "official_lobby is not in this server". A server edition without `map_bot` leaves
its code out.
