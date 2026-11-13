# 0007. Server editions: a lobby server and its web client, released as one bundle

Date: 2026-11-14. Status: accepted.

## Context
A lobby server (`npm run server`) is to run on a cloud machine, with the game served to
browsers so players need no app. Run from the repository, the server needs the whole
source tree, `npm install` and the dev tools on that machine.

- An edition ([ADR 0005](0005-editions-and-page-core.md)) is one Electron app. A lobby
  server is not one: it is Node, plus a page core for the browsers it serves.
- From a cloud address the site's map download answers with a Cloudflare challenge, so
  the server needs another map source (the map bot, [map-bot](../features/map-bot.md)).

## Decision
- **A second kind of edition.** `"kind": "server"` in an edition file makes it a server
  edition with two parts, each a feature list: `server` (the lobby server's features,
  catalog mode `lobby`) and `web` (the page core the web client serves). Each part is
  resolved and left out like an app edition: the server bundle is built with the edition
  plugin over `src/server/features.ts`, the page core over `src/page/features.ts`. The web
  part may not hold the dev console.
- **One bundle.** `npm run release -- --edition <name>` writes `release/<name>/<name>/`
  and its `.tar.gz`: `dist/server/server.cjs` (the server and its dependencies in one file,
  with the code root next to it), `dist/web/page/`, a Dockerfile, `compose.yml` (the server
  and Caddy), a Caddyfile for Cloudflare in front, `server.example.json` from the edition's
  `config`, and a README. No source tree and no `node_modules` go to the server.
- **The game is copied, not built in.** `include_game: false` (the default to write)
  leaves `game/` empty: the site can't be reached from the cloud, so it is fetched
  elsewhere and copied. `true` fetches it into the bundle at release time. The image never
  holds the game: it is mounted, so an update is a copy and a restart.
- **TLS outside the server.** `behind_proxy` makes the server plain HTTP behind Caddy,
  which holds a Cloudflare Origin CA certificate, answers only Cloudflare's addresses and
  forwards `CF-Connecting-IP` as the player's address.

## Rejected
- **Run the repository on the server.** Pros: nothing to build. Cons: the whole source
  and the dev tools on a public machine; every edition's code is there.
- **An app edition running the server in Electron.** Pros: one kind of edition. Cons:
  a browser runtime on the server for code that needs none.
- **Bake the game into the image.** Pros: one artifact. Cons: a rebuild per game update,
  and the game in every image pushed anywhere.

## Consequences
- `editionNames()` lists app editions only; the release workflow packages app editions,
  server editions are released by hand.
- `src/tools/build/server-edition.test.ts` builds a server edition's parts and checks a
  left-out feature is in neither, and that a release holds every file.
