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
- [0005 Editions, and a page core apart from the dev console](adr/0005-editions-and-page-core.md)
- [0006 Capabilities: one flag per command, inside feature folders](adr/0006-capabilities.md)

## Features
- [hooks.md](features/hooks.md): changing the game's scripts as they are served
- [hooks-reference.md](features/hooks-reference.md): the hooks API
- [binds.md](features/binds.md): `binds`, key binds and keyname
- [cert-pinning.md](features/cert-pinning.md): `cert_pinning`
- [client-sadburst.md](features/client-sadburst.md): `client_sadburst`, the Sad Burst 2 client and how the clients are kept apart
- [dev-console.md](features/dev-console.md): `dev_console` and `console_core`, the console itself
- [fingerprint.md](features/fingerprint.md): `fingerprint`, keeping and running the main server's fingerprinter
- [game-setup.md](features/game-setup.md): `game_setup`, downloading and updating the game
- [game-chat.md](features/game-chat.md): `game_chat`, the game's own chat commands
- [guns.md](features/guns.md): `guns`, the gun list, give and drop
- [js-eval.md](features/js-eval.md): `js_eval`, running JavaScript in the page
- [lobby-task-guard.md](features/lobby-task-guard.md): `lobby_task_guard`, no code from a private server's lobby
- [login.md](features/login.md): `login`
- [diagnostics.md](features/diagnostics.md): `diagnostics`, crash and error reports
- [map-cache.md](features/map-cache.md): `map_cache`, local maps and the map cache
- [map-editor.md](features/map-editor.md): `map_editor`, the in-game map editor
- [netlog.md](features/netlog.md): `netlog`, the network recorder
- [p2p-host.md](features/p2p-host.md): `p2p_host`, the player-hosted dedicated host
- [teleport.md](features/teleport.md): `teleport`, `tp`
- [player-info.md](features/player-info.md): `player_info`, `pos` and `chars`
- [health.md](features/health.md): `health`, `heal`, `hp`, `revive` and the HP keys
- [movement.md](features/movement.md): `movement`, the movement keys
- [profiles.md](features/profiles.md): `profiles`, settings for some maps
- [scan-bypass.md](features/scan-bypass.md): `scan_bypass`, the anti-cheat scan report and turning the protection off
- [remote-play.md](features/remote-play.md): `remote_play`, streaming a game to a tester's browser
- [screenshot.md](features/screenshot.md): `screenshot`
- [server-list.md](features/server-list.md): `server_list`, the server list and private servers
- [trace.md](features/trace.md): `trace`, lines to other characters
- [triggers.md](features/triggers.md): `triggers`, map triggers, regions, variables and the logic view
- [zoom.md](features/zoom.md): `zoom`

## Operations
- [running.md](operations/running.md): start modes, settings, checks
- [editions.md](operations/editions.md): building apps with different features (`npm run build -- --edition <name>`)
- [releases.md](operations/releases.md): packaging an edition for Linux and Windows (`npm run release -- --edition <name>`)
- [find-names.md](operations/find-names.md): how the obfuscated game names are found (`npm run find-names`)
- [private-server.md](operations/private-server.md): running your own server (`npm run server`)
- [p2p-host.md](operations/p2p-host.md): the player-hosted dedicated host (`npm run p2p-host`)
- [remote-play.md](operations/remote-play.md): streaming a game window to a tester (`npm run host`)

## Research
- [anticheat.md](research/anticheat.md): the game's anti-cheat, client and server side
- [anticheat-sadburst.md](research/anticheat-sadburst.md): the same for Sad Burst 2, the community fork, and how it differs
- [fingerprinting.md](research/fingerprinting.md): the main server's browser fingerprinter and the RELIABLE_TASK code path

