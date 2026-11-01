# 0002. Layered feature flags, read-only at runtime

Date: 2026-11-01. Status: accepted.

## Context
Every feature must be behind a flag. Flags are needed by the wrapper, the console, the
server and the tools. The page can be made to run code a lobby server sends
(RELIABLE_TASK, [fingerprinting research](../research/fingerprinting.md) §9), and that
code can already write the console's settings.

## Decision
- One catalog in code, with overrides from `features.json` and then the environment.
- The flags are resolved once at boot by a pure function
  ([feature-flags](../architecture/feature-flags.md)).
- The page gets the result read-only. The console's `features` command only lists
  flags.

## Rejected
- **Environment only.** Pros: simplest, nothing persisted. Cons: many console features
  make long env lines; there is no file to keep a setup in.
- **Toggle from the console, saved in the console's settings.** Pros: convenient.
  Cons: page code pushed by a server could turn a dangerous feature back on.

## Consequences
- Changing a flag needs a restart.
- `PB2_DEV` and `PB2_HOOKS` keep working, as aliases.
