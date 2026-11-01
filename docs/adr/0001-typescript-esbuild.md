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
- Only the dev console is bundled: esbuild turns it into `dist/console/index.js`, which
  the wrapper serves as `__dev/console/index.js`. The game page cannot run TypeScript.
- The wrapper (Electron's main process), the server, the tools and the tests run the
  `.ts` sources directly with Node's built-in type stripping. This was confirmed on
  2026-11-02 for Node 26.12 and for Electron 45, whose Node is 24.22: a CommonJS file
  can `require()` an ES module `.ts` file, and Electron's main process can too. Only
  erasable syntax is used (no `enum`: `as const` objects with union types).
- `src/package.json` makes everything under `src/` an ES module and defines the import
  aliases `#shared/*`, `#kernel/*`, `#features/*`, `#console/*`, `#wrapper/*`,
  `#tools/*`.
- Modules under `src/` that the wrapper loads never use top-level `await`, because
  `require()` of an ES module refuses it.
- `allowJs` is off: every source file and test is TypeScript.

## Rejected
- **JSDoc and `checkJs`, no build.** Pros: nothing changes in how files are served.
  Cons: wordier, generics awkward, weaker types.
- **No type check.** Breaks the guidelines; refactors would have no compiler checking
  them.

## Consequences
- `npm start` (and the other start scripts) builds the console first;
  `npm run build:watch` rebuilds it on every change.
- `npm run smoke` starts the real app with a debugging port, plays the official server
  from the launcher, runs console commands (`-- --run <line>`) and prints their output.
- `dist/` is gitignored.
- `engines.node` becomes `>=22.18`, the first version with type stripping on by
  default.
