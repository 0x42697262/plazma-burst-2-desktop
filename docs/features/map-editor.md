# map_editor: the in-game map editor

Feature flag `map_editor` (on by default; local and server modes). It needs
`map_cache` (to save edited maps) and `triggers` (the trigger model). Feature wiring:
`src/features/map_editor/console.ts`. The code is still the console's JavaScript in
`desktop/dev/console/editor/` (23 modules) and `commands/editor.js`. It moves into the
feature folder and becomes TypeScript in refactor step P6.1, and its tests stay in
`test/console.test.mjs` until then.

- `editor` turns the editor on and off; so does the editor key (setting `editor_key`),
  which only works while the flag is on.
- Selecting:
  - every object is outlined;
  - objects are selected by click or from the lists;
  - the selection's connections are drawn as in the game's map editor (dashed, green
    out, white in);
  - an object parameter is picked by clicking the object in the world.
- **Edits go straight into the running level**, in any mode. A frame hook (`editorTick`)
  keeps them in place. They are applied again when the level starts over on the same
  map:
  - Walls, backgrounds, water, pushers and movables move live.
  - A wall's grab points go with it, where there is room beside its corners.
  - A lamp is rebuilt in its slot, its light and flare drawn with the game's own code.
  - A map gun moves, changes model, is deleted, and comes back.
  - An edit nothing finer can make rebuilds the object with the game's own loader code.
  - Trigger actions are added, changed and removed, or edited as the map editor's text.
- Tools: place, copy, delete and undo. The params panel lists every parameter the game
  reads and says how each one reaches a running level.
- `editor save <name>` writes `desktop/maps/<name>.xml` through the map cache's
  `__dev/saveedited`, played as `local-<name>`. `editor reset` undoes and forgets every
  edit.
- `list editor` shows how many objects were changed, added and deleted.

With the flag off there is no `editor` command and the editor key does nothing.
