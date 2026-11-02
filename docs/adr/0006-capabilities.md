# 0006. Capabilities: one flag per command, inside feature folders

Date: 2026-11-02. Status: accepted, done.

## Context
Editions ([ADR 0005](0005-editions-and-page-core.md)) pick features, and a feature is a
group: `triggers` is `triggers` (with history, find, run, exec and actions), `regions`,
`vars` and `logic`; `health` is `heal`, `hp`, `revive` and four keys. An app with only
`triggers find`, or only `god`, cannot be built. Splitting features by hand (as `player`
was split into `teleport`, `player_info`, `health` and `movement`) does not scale.

The console core also holds feature code, so it ships with every console: the per-frame
overrides of health, movement and guns (`src/console/kernel/overrides/frame.ts`), the
`builtin` command of `game_chat`, and texts that name other features (`list`).

## Decision
- **A capability is the unit of a flag**: one command, one subcommand, or one key (a few
  keys that only make sense together, like `fly` and `fly_speed`, may be one). Its id is
  `<feature>.<name>`, for example `triggers.find`, `health.god`, `trace.trace`.
- **Feature folders stay the unit of code.** A feature declares its capabilities in the
  catalog. Each capability's code is its own module under
  `src/features/<feature>/capabilities/<name>/`, and the feature's command list imports
  each one on its own line, so an edition build leaves out the capabilities it does not
  list, the same way it leaves out features today.
- **Editions and flags take capability ids or feature ids.** A feature id means all of
  its capabilities. Capabilities declare what they need (`triggers.run` needs the trigger
  model, `teleport.tp --on` needs `binds.bind`). The edition must list them: the build
  adds nothing and stops, naming what to add ([editions](../operations/editions.md)).
- **A command with subcommands is a container.** It exists when any of its subcommands
  does, and offers only those. Its own run (`triggers` alone lists triggers) is a
  capability too.
- **The console core keeps only what every console needs**: `help`, `set`, `get`,
  `unset`, `reset`, `list`, `features`, `clear`, `close`, `more`, `;` chains, the panel,
  the store and the game adapter. Overrides move into the features that own them (frame
  hooks), each key names the capability that owns it, and core texts name no feature.
- **The map editor is one capability** (`map_editor.editor`), and features without
  console commands (server list, login, remote play, p2p host's window, game setup) stay
  one capability each.

## Rejected
- **One feature folder per command.** Pros: no new concept. Cons: the code of a feature
  (triggers' model, its scripts, its views) would be shared across many folders, which
  breaks "a feature is one folder".
- **Flags only at runtime for commands, features for code.** Pros: little build work.
  Cons: a left-out command's code still ships and can be reached.
- **Top-level commands only, subcommands always together.** Pros: fewer ids. Cons: no
  "triggers find only".

## Consequences
- The catalog grows from about 30 features to about 80 capabilities; `--features` lists
  them by feature.
- A test builds every capability alone as an edition and checks that no file of a
  left-out feature or of a left-out capability's folder is in it. New coupling fails that
  test.
- Order of work: the console core cleanup; the capability model in the catalog,
  resolver and editions; then features one by one, each with its capabilities and tests.

## Outcome
- Split into capabilities: `health`, `movement`, `guns`, `player_info`, `binds`,
  `game_chat`, `screenshot`, `map_cache`, `fingerprint`, `scan_bypass`, `netlog`,
  `profiles`, `server_list` (the `servers` command), `triggers` and `p2p_host`. Features
  with one command (`teleport`, `zoom`, `trace`, `js_eval`, `hooks`) and the map editor are
  one capability: the feature itself.
- **Code and text** are left out per capability: every capability of a split feature
  has its folder (`capabilities/<name>/`) with its command, texts and keys, and nothing
  else imports it. A command with subcommands is a **shell** (a name and aliases in the
  feature's `console.ts`); its own run and each subcommand come from the parts of the
  capabilities present (`parent`, `ownRun` in `src/console/feature-types.ts`). Helpers
  several capabilities use stay in the feature (`services/`, the model), with only the
  texts they need.
- Where one capability's output named another (a status line, a hint), the other adds
  its part when it starts (netlog's status lines, the logic tree port, the protection
  switch of `scan_bypass.checks`), or the hint was dropped. Help `see` lists keep short
  names and are filtered to what exists when shown.
- The usage line of a shell is built from the parts present (`shellUsage` in
  `src/console/kernel/commands/text.ts`), so it names only the subcommands the app has.
- `src/tools/build/leaks.test.ts` builds every capability alone, with the console, and
  fails when the bundle holds the usage or description of a command, subcommand or key
  of any other capability.
- `src/console/kernel/commands/capability-audit.test.ts` fails when a command,
  subcommand, override or key of a split feature names no capability.
