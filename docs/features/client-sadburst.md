# client_sadburst

Feature flag `client_sadburst` (on by default; all modes). The client map:
`src/shared/clients/keys.ts` (what the page may know: titles, hosts, page prefix,
settings file name, session partition, run flags) and `src/kernel/config/clients.ts` (the
same plus the game, names and opcodes files). The gate: `desktop/main.js` until P4.3.

## The two clients
- `official`: Plazma Burst 2, `www.plazmaburst2.com/h5/versions/<version>/`, the default
  everywhere.
- `sadburst`: Sad Burst 2, `sadburst2.com/gameplay/`, a community fork of the official
  client with its own servers and accounts. Same obfuscated names, but bundled and
  minified, and loaded from a manifest of hashed script files. Only its game page is
  served from `game.sadburst/`; the rest of its site (login, API) is the network's.

## Choosing one
- Every command is for the official client unless asked:
  `npm run fetch-game -- --sadburst`, `npm run find-names -- --sadburst`,
  `npm run sadburst` (`electron . --sadburst`). Running the usual commands never touches
  the Sad Burst files.
- The `--` passes the flag to the script: npm 12 refuses
  `npm run fetch-game --sadburst` as an unknown npm option, and older npm turns it into
  `npm_config_sadburst` ("true", or "" on some versions), which is read too ("false" and
  "0" do not count). The one reader is `clientOf` in `src/kernel/config/environment.ts`.

## Kept apart
- Sad Burst 2 keeps everything apart from the official client: its own settings file
  (`desktop/dev-overrides.sadburst.json`), names and opcodes files, game folder and
  browser session (`persist:sadburst`). Its lobby can run code in its page
  (RELIABLE_TASK, [fingerprinting](../research/fingerprinting.md) §4), and nothing it
  writes may reach the official client, e.g. a bind running `js ...` in the official
  game, signed in with your official account.
- Hooks are off for it: its loader sends a hash of the game scripts with the login
  ([hooks](hooks.md)). Remote play and the player-hosted host are for the official client
  only.

## The flag
- With the flag off, `npm run sadburst` logs that Sad Burst 2 is off and quits. The
  official client is not affected. The download and names tools are not gated (P5 moves
  them).
