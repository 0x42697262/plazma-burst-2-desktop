# Editions: apps with different features

An edition is one app you build and hand out, with its own set of features
([ADR 0005](../adr/0005-editions-and-page-core.md)). The code of a feature the edition
leaves out is not in its bundles, and no `features.json` or `PB2_FEATURES` can turn it
on: that app says `"<id>" is not in this app` and stops.

## Edition files

One file per edition in `editions/`, named after it. The files are tracked in git, like
the code (only `data/`, `dist/` and `release/` are ignored): commit a new or changed
edition with the code it builds, and the release workflow builds every committed one
but `dev`.

An example (not one of the files; any name and list works the same):

```json
{
  "name": "example",
  "title": "Plazma Burst 2 Example",
  "appId": "io.github.plazma-burst-2-desktop.example",
  "features": ["server_list", "lobby_task_guard", "cert_pinning", "dev_console", "console_core", "teleport", "binds", "player_info.chars"]
}
```

This app has the server list and the dev console with `tp`, `bind`, `unbind`, `keyname`
and `chars`, and nothing else: `player_info.chars` picks one command of `player_info`, so
`pos` is left out.

| Field | What |
|---|---|
| `name` | The file's name: lower case letters, digits and `-` |
| `title` | The app's name, shown to players |
| `appId` | Reverse-domain id; installed editions with different ids keep their settings and logins apart |
| `features` | Feature ids and capability ids (`npm start -- --features` lists them), or `"all"`. A feature id means all of its capabilities; a capability id (`health.god`) brings its feature with only that capability |
| `defaults` | Optional: servers, binds and settings a new player starts with (see [Defaults](#defaults)) |
| `diagnostics` | Optional: `hidden`, `host`, `send`, `auto` (see [Diagnostics settings](#diagnostics-settings)) |

`dev` is the one edition the tooling relies on: every feature, what `npm start` and
`npm run verify` build.


## Defaults

An edition can start a new player with servers in the list, key binds and settings. An
example (the server, binds and values are made up):

```json
"defaults": {
  "servers": [{ "name": "Pal base", "address": "203.0.113.5:2053", "fingerprint": "AA:BB:…" }],
  "binds": { "shift+f": "tp", "alt+c": "chars" },
  "settings": { "speed": 1.5 }
}
```

- **Written once.** At its first start, when the player has no `data/servers.json`, the
  app writes the servers there; when there is no settings file, it writes the binds and
  settings there. From then on they are the player's own: editing or removing one is
  kept, and nothing comes back. A player who already has the files gets nothing.
- **Checked by the build** (`src/tools/build/edition-defaults.ts`), with the console's own
  parsers, and a problem stops it the same way a missing requirement does:
  - `servers` needs `server_list`; `binds` needs `binds.bind`; `settings` needs
    `dev_console`;
  - a bind runs commands the edition has: `"alt+c": "chars"` needs `player_info.chars`,
    and every part of a `;` chain is checked;
  - a setting is one of the edition's keys, with a value it accepts (`speed` needs
    `movement.speed`).
- **A server carries its certificate fingerprint**, because the app refuses a server whose
  certificate is not the saved one ([server list](../features/server-list.md)). Write
  `"fetch"` instead and the build asks the server, prints what it shows and stops: compare
  it with the fingerprint the host sent you, then write it in. The build never trusts a
  fetched fingerprint by itself.
- **A server has no nickname**: each player picks their own. Until they do (Edit), the list
  says "needs a nickname" and playing it is refused. No password is ever in an edition.
- The defaults are compiled into the main process only (`src/shared/editions/defaults.ts`,
  replaced by the build like the edition itself), not into the game page.

## Diagnostics settings

An example (the server is made up):

```json
"diagnostics": { "hidden": true, "host": "https://reports.example.test/pb2", "send": ["kind", "error"], "auto": true }
```

- `hidden` is compiled in, and an edition file is the only place that sets it: the app has
  no `diagnostics` command, no diagnostics log lines and no entry in the feature lists
  ([diagnostics](../features/diagnostics.md#hidden-in-an-edition)). Leaving it out shows them.
- `host`, `send` and `auto` are the starting values. A player's `data/diagnostics.json` and
  `PB2_DIAGNOSTICS_URL` win over them.
- The edition must list `diagnostics`, and `send` takes only the known fields; otherwise the
  build stops.

## Building one

```
npm run build -- --edition <name>            # editions/<name>.json
npm run build -- --features server_list,zoom  # a one-off list (edition "custom")
```

The build prints the edition's features, then builds
only what the edition needs: the page core always, the dev console only with
`dev_console`, the server list page only with `server_list`, the hooks runtime only with
`hooks`, the remote-play client only with `remote_play`.

## Which edition is in `dist/`

Every build writes to the same `dist/`, so the last build wins. `npm start`,
`npm run sadburst`, `npm run smoke` and `npm run verify` all build `dev` first, so they
replace an edition built before them. To see which one is there:

```
grep -o '"name": "[a-z-]*"' dist/wrapper/main.cjs
```

`npm run build -- --edition` replaces only the folders that edition builds: a folder it
leaves out (`dist/console/`, `dist/hooks/` …) can still be there from an earlier build.
`npm run release` empties `dist/` first. To package an edition for players, see
[releases](releases.md).

## Requirements are listed, never added

The build adds nothing on its own (`src/kernel/editions/resolve.ts`). An edition must list
everything it needs, and a missing requirement stops the build, naming what to add:

```
Edition "custom" cannot be built:
  teleport needs dev_console: add "dev_console" to the edition
Add to its "features": "dev_console"
```

What needs what:
- a feature's `requires` (`map_editor` needs `dev_console`, `map_cache`, `triggers`; every
  console feature needs `dev_console`);
- `dev_console` needs `console_core`, the console itself;
- `server_list` needs `lobby_task_guard` and `cert_pinning` (`ALWAYS_WITH` in
  `src/shared/editions/keys.ts`): an app that joins private servers is always protected
  from their code and their certificates;
- a capability's `requires` (`profiles.bind` needs `binds.bind`, `netlog.all` needs
  `netlog.record`);
- an unknown id is a problem too.

## Capabilities you can pick

`npm start -- --features` lists every feature and, under it, its capabilities
([ADR 0006](../adr/0006-capabilities.md) has the outcome). Examples:

| `"features"` | The app has |
|---|---|
| `["dev_console", "console_core", "teleport"]` | `tp` |
| `["dev_console", "console_core", "health.god"]` | the `god` key |
| `["dev_console", "console_core", "triggers.find"]` | `triggers find` |
| `["dev_console", "console_core", "trace", "binds.bind"]` | `trace`, `bind`, `unbind` |
| `["server_list", "lobby_task_guard", "cert_pinning", "client_sadburst"]` | a client without the console |

## How left-out code stays out

- The build's esbuild plugin (`src/tools/build/edition-plugin.ts`) compiles the edition
  into `src/shared/editions/constants.ts` and filters the feature lists
  (`src/console/features.ts`, `src/page/features.ts`, `src/wrapper/features.ts`): their
  `import { x } from '#features/<id>/…'` lines and list entries of left-out features go.
  A left-out name still used elsewhere in a list stops the build.
- Feature folders are named by feature id, which is what the plugin matches.
- A feature split into capabilities lists them in its `capabilities.ts`, one
  `import { x } from './capabilities/<name>/…'` line and one list entry each; the plugin
  keeps only the edition's capabilities there the same way.
- The main process is bundled the same way (`dist/wrapper/main.cjs`). Each feature with
  main-process code exports one part (`netlogWrapper`, `serverListPart`,
  `remotePlayPart`, `p2pHostPart` …), listed once in `src/wrapper/features.ts`; the app
  (`src/wrapper/app.ts`) reaches them only through that list (`WRAPPER_PARTS`), and every
  part may be missing. `login`, `cert_pinning` and the Sad Burst 2 start check are small
  and imported directly, so their code is in every main process; their flags still turn
  them off.
- The kernel holds no feature code: overrides, keys and list sections come from the
  capabilities' folders, and the console core reaches a feature only through a port it
  provides when it starts (`src/console/kernel/ports/`).
- A capability's texts live in its folder, so a left-out capability's commands, help and
  messages are not in the app either, not even its name in a usage line.

## Where an installed app keeps its data

`src/kernel/config/root.ts` gives two roots: the code (`APP_ROOT`) and the user's files
(`USER_ROOT`). Run from the repository, both are the repository. The main-process bundle
replaces that module (`packagedRootPlugin`): the code is next to the bundle, and once
the app is installed (`app.isPackaged`) the user's files (`data/`, `game/`, `hooks/`) go
to Electron's per-user folder for the app, which differs per edition's title.

## Tests

`src/tools/build/editions.test.ts` builds every file in `editions/`, plus the smallest
(page core only), the largest edition, and every capability alone, and checks that no
file of a left-out feature, and no file of a left-out capability's folder, is in the
page bundles, and that `console.js` exists only with `dev_console`. It also builds each edition's main process and checks that no left-out
feature is in it, apart from the three above, and that the edition is compiled in. Adding
an edition file adds it to the test.

`src/tools/build/leaks.test.ts` builds every capability alone with the console and
fails when the bundle holds the usage or description of any other capability's command,
subcommand or key.
