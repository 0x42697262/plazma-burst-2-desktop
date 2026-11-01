# Documentation

## Architecture
- [principles.md](architecture/principles.md): the rules this codebase follows (hard rules, layers, testing, docs)
- [layers.md](architecture/layers.md): source tree, layers inside a feature, wiring, build
- [feature-flags.md](architecture/feature-flags.md): the feature catalog, override order, adding a feature

## Decisions
- [0001 TypeScript with esbuild](adr/0001-typescript-esbuild.md)
- [0002 Layered feature flags, read-only at runtime](adr/0002-feature-flags-layered.md)
- [0003 One folder per feature](adr/0003-feature-modules.md)
- [0004 Versioned local files](adr/0004-versioned-local-files.md)

## Features
- [hooks.md](features/hooks.md): changing the game's scripts as they are served
- [hooks-reference.md](features/hooks-reference.md): the hooks API

## Operations
- [private-server.md](operations/private-server.md): running your own server (`npm run server`)
- [p2p-host.md](operations/p2p-host.md): the player-hosted dedicated host (`npm run p2p-host`)
- [remote-play.md](operations/remote-play.md): streaming a game window to a tester (`npm run host`)

## Research
- [anticheat.md](research/anticheat.md): the game's anti-cheat, client and server side
- [fingerprinting.md](research/fingerprinting.md): the main server's browser fingerprinter and the RELIABLE_TASK code path

## Refactor
- [plan.md](refactor/plan.md): the refactor plan
- [progress.md](refactor/progress.md): what is done, and the next step
