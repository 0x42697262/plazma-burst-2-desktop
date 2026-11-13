# web_client: the game in a browser, for this server only

Feature flag `web_client` (on by default; lobby server only, `npm run server`). Code:
`src/features/web_client/`: the form and paths (`domain/web.ts`), the routes
(`services/web-client.ts`) and the server part (`server.ts`).

The lobby server serves the game to browsers, so players need neither the app nor an
install. Each player's browser plays this server and nothing else.

## Routes
| | |
|---|---|
| `GET /` | the join page: nickname, and a password (the server's, or an admin's secret) |
| `POST /play/` | the game: the game's `index.html`, prepared like the app prepares it (`prepareIndex`): the page core and a join target back to this site with that nickname and password |
| `GET /play/<file>` | the game's files, from the server's `game/` |
| `GET /play/__dev/names.js` | the game's names, found at the server's start |
| `GET /play/__dev/page/…` | the page core of the server edition's web part (`dist/web/page/`) |

A reload of `/play/` goes back to the join page; `index.html` is never served without
the form. Paths with `..` or hidden files are refused.

## This server only
- The join target is the server's own address: `public_url`, or the address the
  browser used. The page core's join client points the game's lobby there and gives it
  the nickname and password, as it does for a private server in the app.
- The game page is sent with `Content-Security-Policy: connect-src 'self'` (and
  `default-src 'self'`): the browser lets it open connections only to this site. The
  official servers, Sad Burst 2 and any other site are out of reach, whatever the
  game's own code tries; its requests to plazmaburst2.com fail.
- The page core is built from the server edition's web part, so it holds only the
  features listed there (the lobby task guard, the join client), never the dev console
  ([editions](../operations/editions.md#server-editions)).
- Maps come from the lobby server, which sends each player the map of their match.

## Without a page bundle
The server warns at start ("no page bundle"), and `POST /play/` answers 503. Build the
server edition first.

## With the flag off
`PB2_FEATURES=-web_client npm run server`: `/` and `/play/` answer 404. A server edition
without `web_client` leaves its code out.
