# 0001. TypeScript with an esbuild build

Date: 2026-11-01. Status: accepted.

## Context
The repository is about 25k lines of plain JavaScript with no type check. The
guidelines ([principles](../architecture/principles.md) §9) require a type check in
CI. The console is served to the game page file by file from
`desktop/dev/console/`, and tests import those files directly.

## Decision
- Write all code in TypeScript (`strict`, `noUncheckedIndexedAccess`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`), checked with `tsc --noEmit`.
- esbuild bundles the wrapper, the console and the server into `dist/`. The wrapper
  serves the console bundle from `dist/console/`.
- Tests and tools run the `.ts` sources with Node's built-in type stripping, so only
  erasable syntax is used (no `enum`: `as const` objects with union types).
- During the migration `allowJs` lets old JS and new TS share the bundle; it is
  removed at the end (step P6).

## Rejected
- **JSDoc and `checkJs`, no build.** Pros: nothing changes in how files are served.
  Cons: wordier, generics awkward, weaker types.
- **No type check.** Breaks the guidelines; refactors would have no compiler checking
  them.

## Consequences
- `npm start` builds first.
- `dist/` is gitignored.
- `engines.node` becomes `>=22.18`, the first version with type stripping on by
  default.
