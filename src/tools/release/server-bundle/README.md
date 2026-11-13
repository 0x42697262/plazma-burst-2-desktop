# {{title}}

A Plazma Burst 2 lobby server with the game for browsers, built from the server edition
"{{name}}" of plazma-burst-2-desktop. Players open https://{{domain}}/.

- `pb2`: the lobby server, its web client and its map bot (Node, no browser).
- `caddy`: TLS in front of it, behind Cloudflare.

## Files to add
| | |
|---|---|
| `game/` | {{game_step}} |
| `certs/origin.pem`, `certs/origin.key` | a Cloudflare Origin CA certificate for {{domain}} (Cloudflare > SSL/TLS > Origin Server > Create certificate) |
| `secrets/map-bot-account.json` | the map bot's account: `{ "login": "…", "password": "<md5 of the password>" }` (the format of the app's `data/credentials.json`), owned by uid 1000 with `chmod 600` |
| `data/server/server.json` | the server's settings: start from `server.example.json`, and give `admins` secrets |

`data/` holds what the server keeps: its settings, bans and the maps it fetched
(`data/maps/`). Back it up.

## Start
```
docker compose up -d --build
docker compose logs -f pb2
```
The server's terminal (`help`, `who`, `kick`, `say`, …): `docker attach $(docker compose ps -q pb2)`;
leave it with Ctrl-P Ctrl-Q.

## The desktop app
Browsers come through Cloudflare on 443. The desktop app (server list > Add server)
pins the server's certificate, which Cloudflare's own would break, so it connects to this
machine directly on TCP 2053: address `<this machine's Elastic IP>:2053`, fingerprint
"Get from server". The fingerprint is that of `certs/origin.pem`: when you replace the
certificate, players edit the server and get the new one.

## Cloudflare and the firewall
- DNS: `{{domain}}` → this machine's Elastic IP, proxied (orange cloud).
- SSL/TLS: Full (strict).
- Caddy answers only Cloudflare's addresses on 443. Let the EC2 security group allow TCP
  443 from Cloudflare's ranges only (https://www.cloudflare.com/ips/), TCP 2053 from
  anywhere (the desktop app), and SSH from your own address. When Cloudflare's ranges change, update both, and the list in `Caddyfile`.

## Updating the game
Fetch the new game where the site is reachable (`npm run fetch-game` in the
repository), copy it over `game/`, then `docker compose restart pb2`. The server finds
the game's names at start and refuses to run if any are missing.
