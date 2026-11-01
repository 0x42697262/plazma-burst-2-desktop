# Editions: apps with different features

An edition is one app you build and hand out, with its own set of features
([ADR 0005](../adr/0005-editions-and-page-core.md)). The code of a feature the edition
leaves out is not in its bundles, and no `features.json` or `PB2_FEATURES` can turn it
on: that app says `"<id>" is not in this app` and stops.

## Edition files

One file per edition in `editions/`, named after it:

```json
{
  "name": "player",
  "title": "Plazma Burst 2 Client",
  "appId": "io.github.plazma-burst-2-desktop.player",
  "features": ["server_list", "client_sadburst"]
}
```

| Field | What |
|---|---|
| `name` | The file's name: lower case letters, digits and `-` |
| `title` | The app's name, shown to players |
| `appId` | Reverse-domain id; installed editions with different ids keep their settings and logins apart |
| `features` | Feature ids (`npm start -- --features` lists them), or `"all"` |

`editions/dev.json` is every feature, which is also what `npm start` runs.
`editions/player.json` is the player client (official and Sad Burst 2, private servers,
the game download). `editions/player-tp.json` is that plus `teleport`: the dev console with `tp` and
nothing else of the player commands or keys. Features are small (one command or a few
keys each: `teleport`, `player_info`, `health`, `movement`, `guns` …), so an edition
picks exactly what it offers. `tp --on <key>` needs `binds`, which it leaves out.

## Building one

```
npm run build -- --edition player            # an edition file
npm run build -- --features server_list,zoom  # a one-off list (edition "custom")
```

The build prints the edition's features and why each one it added is there, then builds
only what the edition needs: the page core always, the dev console only with
`dev_console`, the server list page only with `server_list`, the hooks runtime only with
`hooks`, the remote-play client only with `remote_play`.

## What the build adds or refuses

The build resolves the list with the feature catalog (`src/kernel/editions/resolve.ts`):
- a feature's `requires` are added (`map_editor` brings `dev_console`, `map_cache`,
  `triggers`);
- a locked feature comes with what it needs (`console_core` with `dev_console`);
- `server_list` always brings `lobby_task_guard` and `cert_pinning`
  (`ALWAYS_WITH` in `src/shared/editions/keys.ts`): an app that joins private servers is
  always protected from their code and their certificates;
- an unknown id stops the build.

## How left-out code stays out

- The build's esbuild plugin (`src/tools/build/edition-plugin.ts`) compiles the edition
  into `src/shared/editions/constants.ts` and filters the feature lists
  (`src/console/features.ts`, `src/page/features.ts`, `src/wrapper/features.ts`): their
  `import { x } from '#features/<id>/…'` lines and list entries of left-out features go.
  A left-out name still used elsewhere in a list stops the build.
- Feature folders are named by feature id, which is what the plugin matches.
- The main process is bundled the same way (`dist/wrapper/main.cjs`). Each feature with
  main-process code exports one part (`netlogWrapper`, `serverListPart`,
  `remotePlayPart`, `p2pHostPart` …), listed once in `src/wrapper/features.ts`; the app
  (`src/wrapper/app.ts`) reaches them only through that list (`WRAPPER_PARTS`), and every
  part may be missing. `login`, `cert_pinning` and the Sad Burst 2 start check are small
  and imported directly, so their code is in every main process; their flags still turn
  them off.
- Code a feature keeps in the console kernel (the player overrides, the settings table)
  goes only with the whole console.

## Where an installed app keeps its data

`src/kernel/config/root.ts` gives two roots: the code (`APP_ROOT`) and the user's files
(`USER_ROOT`). Run from the repository, both are the repository. The main-process bundle
replaces that module (`packagedRootPlugin`): the code is next to the bundle, and once
the app is installed (`app.isPackaged`) the user's files (`data/`, `game/`, `hooks/`) go
to Electron's per-user folder for the app, which differs per edition's title.

## Tests

`src/tools/build/editions.test.ts` builds every file in `editions/`, plus the smallest
(page core only) and the largest edition, and checks that no left-out feature's side
module or `entry/` is in the bundles, and that `console.js` exists only with
`dev_console`. It also builds each edition's main process and checks that no left-out
feature is in it, apart from the three above, and that the edition is compiled in. Adding
an edition file adds it to the test.
