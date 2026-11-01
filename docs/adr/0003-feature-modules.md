# 0003. One folder per feature

Date: 2026-11-01. Status: accepted.

## Context
A feature today is spread over `desktop/main.js`, `desktop/<feature>.js`,
`desktop/dev/console/commands/`, `net/`, `core/`, and over the large
`test/console.test.mjs`. Turning a feature off, or deleting it, means touching many
places.

## Decision
- Each feature lives in `src/features/<id>/`, holding:
  - its wrapper side and console side;
  - its own `domain/`, `services/`, `adapters/` and `entry/` layers;
  - its own constants, text, events and keys;
  - its tests.
- One list per side wires the features in ([layers](../architecture/layers.md)).

## Rejected
- **Keep the layered folders (`core/`, `net/`, `commands/` …) and add flags at the
  registration points.** Pros: a smaller diff. Cons: a feature stays spread out and
  cannot be removed cleanly.

## Consequences
- Cross-feature calls go through a feature's `index.ts`, enforced by a lint rule.
- Docs name file paths under `src/features/<id>/`; a moved file means updating them.
