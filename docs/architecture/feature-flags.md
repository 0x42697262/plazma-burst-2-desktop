# Feature flags

Code: `src/shared/features/`,
`src/kernel/flags/`, `src/wrapper/context.ts`, `src/console/flags.ts`.

## Catalog

`src/shared/features/catalog.ts` is the only definition of a feature. Each entry has:

| Field | Meaning |
|---|---|
| `id` | Snake-case feature id, also the flag name |
| `defaultOn` | Its state when nothing overrides it; defaults keep today's behavior |
| `owner` | Who decides about the flag |
| `availableIn` | The modes it can run in: `local`, `remote` (remote play), `server` (p2p host), `lobby` (the lobby server, `npm run server`: its features are listed in `src/server/features.ts` and read `PB2_FEATURES` like the app) |
| `requires` | Features that must be on for this one to be on |
| `unavailableForClients` | Clients it is forced off for, e.g. hooks with the Sad Burst 2 client |
| `locked` | It cannot be turned off (`console_core`) |
| `description` | One line, shown by the `features` command |

## Capabilities

A feature can declare capabilities (`capabilities` in its catalog entry, ids
`<feature>.<name>`, [ADR 0006](../adr/0006-capabilities.md)): one per command, subcommand
or key. A capability is on when its feature is on and nothing turns it off; flags,
`data/features.json`, `PB2_FEATURES` (`-health.heal`) and editions take capability ids
too, and `--features` lists each feature's capabilities under it. Commands, subcommands,
keys and overrides name their capability (`capability`); a command whose own capability is
off but some subcommand's is on stays, offering only those subcommands. The page gets the
capability states in `PB2_CAPABILITIES`, read-only like `PB2_FEATURES`.

## Override order

Resolved once at boot by the pure `resolve()` in `src/kernel/flags/resolve.ts`. Later
layers win:

0. the app's edition: a feature it leaves out is off (source `edition`) and stays off
   ([editions](../operations/editions.md));
1. the catalog default;
2. `data/features.json` (gitignored, versioned);
3. the environment: `PB2_FEATURES=+id,-id`, plus the aliases `PB2_DEV=0`
   (`-dev_console`) and `PB2_HOOKS=0` (`-hooks`);
4. hard constraints: `locked`, `requires`, `unavailableForClients`, `availableIn`.

The wrapper logs one `flags.resolved` line listing every flag that is not at its
default, with its source. The console gets the resolved flags before any script runs.
They are set as a non-enumerable global, like `PB2_REMOTE`, and **cannot be changed
from the page**. Code a server pushes into the page (RELIABLE_TASK,
[fingerprinting research](../research/fingerprinting.md) §9) can write console
settings, so allowing changes from the page would let that code turn a feature back
on.

## Adding a feature

1. Add a catalog entry.
2. Create `src/features/<id>/` (the folder is named by the id) with its `console.ts`,
   `page.ts` and/or `wrapper.ts`.
3. Add those to `src/console/features.ts`, `src/page/features.ts` or
   `src/wrapper/features.ts`, one `import { x } from '#features/<id>/…'` line and one
   list entry each, so an edition build can leave it out.
4. Write `docs/features/<id>.md`.
5. Add a flag-off test: no commands, routes 404, no ticks, nothing written.

## Seeing the flags

- `npm start -- --features` prints every flag, its state, its source and why, then
  exits.
- The console's `features` (alias `flags`) prints the same list in the game. It is
  hidden in remote play, because it would show the host's setup to a tester.
- When any flag was set in `data/features.json` or the environment, the wrapper logs one
  `flags.resolved` line naming those flags, e.g.
  `flags.resolved hooks=off:env`.

## Problems stop the start

Each of these stops the app before a window opens, with one line per problem:
- an unknown feature id;
- turning off a locked feature;
- turning on a feature the app's edition leaves out;
- a malformed `PB2_FEATURES`;
- an unreadable `data/features.json`.
