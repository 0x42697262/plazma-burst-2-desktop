# triggers: map triggers, regions, variables and the logic view

Feature flag `triggers` (on by default; all modes). Feature wiring:
`src/features/triggers/console.ts`. The code itself is still the console's JavaScript
in `desktop/dev/console/`:
- `commands/triggers.js`, `commands/regions.js`, `commands/vars.js`, `commands/logic.js`;
- `triggers/` (the trigger model, running, the run log, variables, regions, map-editor
  script);
- `logic/` (the logic graph and its overlay).

Converting them to TypeScript in the feature folder is refactor step P6.1. Their tests
are still in `test/console.test.mjs`, because they build on each other's state there.

- `triggers` lists map triggers, shows one trigger's actions, keeps a history of trigger
  runs (a frame hook watches the game's runner), finds triggers by uid, value, action
  type or what starts them, runs one now (`triggers run`), and runs a trigger pasted
  from the map editor's text view (`triggers exec`).
- `regions` lists the map's regions and what activates them.
- `vars` reads, sets, removes and syncs map variables. In multiplayer, region
  activations are broadcast to every client, and once a lobby server has connected it
  broadcasts `RELIABLE_VAR_SYNC` to everyone.
- `logic` draws the map's logic (what starts what) as an overlay.
- `list logic` and `list vars` are this feature's `list` sections.

With the flag off, none of these commands exist and the trigger history is not kept.
The map editor needs this feature's model, so it is off as well.
