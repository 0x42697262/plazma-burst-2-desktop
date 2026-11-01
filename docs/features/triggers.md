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

## How it works (`src/features/triggers/`)

### The run log (`run-log.ts`)
- Every trigger run is recorded, whatever started it: a region, a timer, a shot, a death,
  chat, the network, another trigger, or `triggers run`.
- The game's runner reads a trigger's "enabled" flag exactly once per run, at the start.
  Each trigger object in the map's triggers array is wrapped in a Proxy that notices that
  read when the caller is the runner (its function name, from the stack). No game function
  is replaced: the anti-tamper scan compares function source. Accessor properties are not
  used either: quicksave skips them, so F5/F9 would lose the enabled state. A Proxy keeps
  plain data properties, so quicksave and everything else see no change.
- Limit: triggers that run while the map loads ("at start") run before the wrap.
- Repeats are merged: a run right after the same run, or a refused attempt seen in the
  last 20 entries (regions retry every frame). At most 1000 entries are kept. A level start
  (a new map, a restart) starts the history over; the map text does not, since the editor
  changes it while the level runs. A full check runs every 60 frames, because quickload
  may swap the trigger objects.

### The model (`model.ts`)
- Region activation modes ("use_on") come from the region check in frame2.js. The map
  loader turns 8 into 1, 11 into 9 and 12 into 10 (the same use keys without the switch
  graphic it draws for 1, 9 and 10), and 15 into 1 (no switch, no use sound), so only the
  listed modes occur at run time.
- The game keeps uids only on triggers, but its map loader numbers each kind in the order
  the map lists them, so the n-th `<timer>` in the map text is timer #n. They are read once
  per map.
- "start" is not a source of its own in the map: it is the trigger's "runs at map start"
  flag. A "uses timer" region names a timer, not a trigger: it starts no trigger itself.

### Running a trigger (`run.ts`, `regions.ts`)
- A trigger is run the way the game does: through its own runner, with the activator ("the
  player who started it", which many actions use) set first, and shot power 1.
- Without `force` the game's rules apply: enabled, with calls left, and running uses up a
  call. With `force` it runs anyway, and its enabled state and calls left are put back.
- Multiplayer: the run is sent like a normal one, so other players run it too. It is not
  sent (your client only) when the other clients would refuse it or run it differently:
  forced, "as" another character (the server always makes the sender the activator), past
  a region's own condition, or while spectating. A synced run uses up a call on every
  client, so the used call is kept here too.
- `regions run` checks the region's mode with the same tests, in the same order, as the
  game's region check, setting aside where the character stands. A "uses timer" region
  enables its timer, as the game does; in multiplayer nothing is sent, because the game
  would send a trigger run with the timer's number, which runs the wrong trigger
  everywhere else.

### Triggers written as text (`script.ts`, `triggers exec`)
- The format is the map editor's "edit triggers as text" view (lib_gui.js,
  CompileTrigger): `uid:`, `enabled:` and `maxcalls:` headers, then one action per line,
  `Name( "A", "B" );`. The name is everything before the first `(`: the editor's alias
  for an action number, or `op<number>`. A is the text between `( "` and the first
  `", "`, B runs from there to the first `" );`. Nothing is escaped, so `""1""` is the
  value `"1"` with its quotes. The editor reads each line as typed; here they are trimmed
  first. A script on one line also works: headers first, each action ending at its `" );`.
- The names come from `desktop/dev/opcodes.js` (`npm run fetch-opcodes`).
- A `#uid` target the map does not have, in a target kind that names an object, would
  reach the action as text, which most actions read as index 0 (a different object), so
  it is refused.
- The script runs once as a trigger of its own, through the game's runner: it is put in
  the triggers array just past the map's, run, and removed again, so nothing else can
  start it. In multiplayer it is not sent (the other players have no such trigger); what
  its actions send themselves (`vars sync`) still goes out.

### Variables (`vars.ts`)
- Triggers keep their state in one object, variable name to value, emptied whenever a map
  loads. A value from the map went through the loader's conversion: a whole number
  becomes a number, everything else stays text. The "variable equals" actions compare
  with `===`, so that difference decides whether a gate fires. `vars set` follows the same
  rule (5 is the number 5; 3.5, 01 and -0 stay text); double quotes force text.
- The game's own sync actions refuse a name or value longer than 2048 characters.
- Merge modes, as receivers apply them (flash.js, frame2.js): r replace, d default (only
  where unset or not a number), x max, n min, l longest. x and n re-send each client's
  own value with a merge that can undo yours.
- A client sends and applies syncs only with the map's `var_sync` engine mark. The game
  never sets it back to false, so it can still be on from an earlier map in the session.
- Triggers that write a variable and run once or at map start are the map's own
  initialisers: a client that reloads the map runs them again, so it ends up with the
  map's value whatever was synced to it earlier.
