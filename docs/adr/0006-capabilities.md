# 0006. Capabilities: one flag per command, inside feature folders

Date: 2026-11-02. Status: accepted.

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
  model, `teleport.tp --on` needs `binds.bind`); the resolver adds those, as it adds a
  feature's `requires` today.
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
- A test builds every capability alone as an edition, boots it, and checks that only it
  is there. New coupling fails that test.
- Order of work: the console core cleanup; the capability model in the catalog,
  resolver and editions; then features one by one, each with its capabilities and tests.
