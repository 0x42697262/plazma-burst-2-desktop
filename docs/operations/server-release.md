# A server edition on a cloud machine

A server edition ([editions](editions.md#server-editions)) is released as one bundle: the
lobby server, the web client and the map bot in Node, with Docker and Caddy files. The
source tree never goes to the server.

```
browser ──443──▶ Cloudflare (proxied) ──443──▶ Caddy (Origin CA certificate) ──http──▶ pb2 (lobby server)
                                                                                    └──▶ official lobby (map bot)
```

## Build
```
npm run release -- --edition <name> --public-url https://pb2.example.com   # release/<name>/<name>/ and release/<name>/<name>.tar.gz
```
The bundle's README lists what to add on the server. With `include_game: true` the game
is fetched into it at release time; the archive then holds the game, so keep it to
yourself.

## Deploy (Debian with Docker, for example on EC2)
1. Install Docker (`apt install docker.io docker-compose-v2` on Debian 13), and give the
   machine an Elastic IP.
2. Copy the archive over, unpack it, and add:
   - `game/`: the game (fetched where the site can be reached; from a cloud address
     Cloudflare challenges it),
   - `certs/origin.pem` and `certs/origin.key`: a Cloudflare Origin CA certificate for the
     domain,
   - `secrets/map-bot-account.json`: the map bot's account (owned by uid 1000, mode 600),
   - `data/server/server.json`: from `server.example.json`, with `admins` given secrets.
3. `docker compose up -d --build`.
4. Cloudflare: the domain's DNS record proxied, SSL/TLS "Full (strict)".
5. Security group: TCP 443 from Cloudflare's ranges only, SSH from your own address.

## Running it
- Logs: `docker compose logs -f pb2`.
- The server's terminal: `docker attach $(docker compose ps -q pb2)`, then Ctrl-P Ctrl-Q.
- A new game version: copy it over `game/`, `docker compose restart pb2`.
- A new release: unpack it over the old folder (keep `game/`, `certs/`, `secrets/`,
  `data/`), `docker compose up -d --build`.

## What runs where
- `pb2` is plain HTTP inside Docker's network (`behind_proxy`); a player's address is
  Cloudflare's `CF-Connecting-IP`, forwarded by Caddy.
- Caddy answers only Cloudflare's addresses (the list in `Caddyfile`, from
  `CLOUDFLARE_RANGES` in `src/tools/release/keys.ts`).
- Maps come from `data/maps/`, else from the map sources (the bot: the official lobby,
  [map-bot](../features/map-bot.md)), and are kept in `data/maps/`.
