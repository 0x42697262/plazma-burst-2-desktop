# map_editor: the in-game map editor

Feature flag `map_editor` (on by default; local and server modes). It needs
`map_cache` (to save edited maps) and `triggers` (the trigger model). Code:
`src/features/map_editor/`:

- `console.ts`: the feature wiring (command, frame hook, list section).
- `entry/command.ts`: the `editor` command and its subcommands.
- `domain/`: pure parts: the map document (`doc.ts`), undo history (`history.ts`), the
  element kinds (`kinds.ts`), trigger actions (`actions.ts`) and parameters (`params.ts`).
- `services/`: the session state (`session.ts`), edits (`edit.ts`), and everything that
  reaches the running level: `apply.ts`, `rebuild.ts`, `loader.ts`, `later.ts`,
  `guns.ts`, `lamps.ts`, `start.ts`, `live.ts`.
- `ui/`: the editor's keys and wiring (`editor.ts`), the overlay (`view.ts`), the mouse
  (`input.ts`), the panels (`panels.ts`, `trigger-panel.ts`, `dropdown.ts`,
  `fields.ts`) and their look (`style.ts`).

Tests: `src/features/map_editor/map-editor.test.ts`.

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
- `editor save <name>` writes `data/maps/<name>.xml` through the map cache's
  `__dev/saveedited`, played as `local-<name>`. `editor reset` undoes and forgets every
  edit.
- `list editor` shows how many objects were changed, added and deleted.

With the flag off there is no `editor` command and the editor key does nothing.

## How it works

The editor edits the level you are playing, from inside it. The game keeps running; the
editor draws over it and takes the mouse. Views (the overlay, the panels) listen to the
session and draw again when it notifies them; the session never draws.

### Session (`services/session.ts`)

- The editor's state: whether it is on, the map document, what is selected, which layers
  can be selected, which edits the running level does not have. Nothing here touches the
  screen.
- While no level runs (loading, menus) the editor stays on but is not shown ("shown" means
  on, and a level is running). It hides while no level runs and shows again with the
  next one.
- `pending` holds the ids of elements with edits the running game does not have yet.
- `layer` is the layer the objects list shows. `selectable` is the active layers: what a
  click can select; the rest is drawn faint. `moreLayers`: the Layers list shows every
  kind ("More"), not just the groups.
- `pick` is a parameter waiting for an object clicked in the world (the map editor's
  quick pick): until one of its kinds is clicked (any layer, as in the map editor) or Esc,
  a click picks instead of selecting. The object a pick at a point takes is the one of
  those kinds whose center is nearest, within reach, or one whose box holds the point.
- `levelStarts` counts the level starts seen, editor on or off. `docLevel` is the level
  start the running level got the document's edits at. The running level has the
  document's edits when it plays the document's map and has not started over since they
  went in (`docInLevel`).
- Tools: `select` (a click selects, a drag moves or resizes the selection) and `place` (a
  click, or for a rectangle a drag, adds an element of the layer the objects list shows).
  `preview` is the rectangle being dragged out with the place tool.
- Notices: `shown` (on/off, or a level start/end), `doc`, `reloaded` (the level started
  again on the same map), `selection`, `layer`, `layers`, `tool`, `pick`, `edit`.
- Turning it on while the same map still runs keeps the document, with everything added,
  deleted and changed. If the level started over meanwhile, the edits go in again
  (`reloaded`). Turning it on also reads the game's loader, for rebuilding objects.
- `resetDocument` reads the document again from the map the game plays (its edits,
  history and pending ones gone). With the editor off, or no map to read, the document is
  dropped until the next "editor on". `forgetDocument` is for tests.
- A new document has nothing selected, pending or undoable (`edit.ts` clears its history
  on `doc`).
- Layer groups are the map editor's ("Layers:" in its left panel). When the active layers
  change, a selection on a layer that is no longer active is let go, as in the map editor.
- What a click selects: the smallest element under it, so a region on a wall wins over the
  wall. Clicking the same spot again (within 3 world units) takes the next one down the
  stack; a thin element is hit within 2 world units around it.
- Once per frame (`editorTick`): a level that starts on the same map (a restart, dying, a
  new round) gets the edits again; any other map starts a new document. Map text that is
  not readable yet is tried again next frame.

### The map document (`domain/doc.ts`)

- The map being edited, as the map text lists it: one element per tag, in map order, each
  with its attributes. The game numbers each kind in that order (the third `<region>` is
  region #2).
- An element's ordinal is its place in the document now. `live` is where the running game
  has it, from when the level loaded this text: elements added since have none, and
  deleting one does not move the others in the game. `live.index` is its index among its
  kind, `live.char` its character (players and enemies share the game's characters array,
  in map order), `live.loaded` its attributes as the game read them.
- Untouched elements keep their exact text; `toText()` gives the map back. A changed
  element is written out again from its attributes. Values hold no quotes (the editor
  refuses them), so `>` inside one is fine for the tag pattern.
- An added element goes in after a line break.
- Old maps leave out x and y of triggers, timers and engine marks: they get a `spot`,
  where the editor (and "logic show") shows them, written to the map only once moved.
- Map text the editor cannot read (compressed until the level starts) gives no document.
- `version` goes up with every change, so views draw again what changed. An insert goes
  at the end by default, so no other element of its kind changes its number.

### Kinds (`domain/kinds.ts`)

- Every kind of map element the editor shows: its name, its layer color, and its shape
  in the world. Rectangles (walls, regions, ...) are x, y, w, h. Everything else is a
  point with a box around it, sized like the map editor's selection boxes
  (`level_editor/editor_scripts/lib_sources.js`); `side="-1"` mirrors it. The order is
  the layer list's, roughly the map editor's: things you build with first.
- An `<image>` is a custom image's size, for the backgrounds and decorations that use it:
  no place in the map, shown with the others an old map leaves unplaced; not added by
  hand. Boxes, backgrounds, engine marks and images have no uid in the map editor either.
- `boundsOf` is where the map puts an element (w and h never negative), or nothing for an
  element with no place (an `<image>`, an unknown tag, a broken number). `anchorOf` is the
  corner the map stores for a rectangle, the point itself otherwise; an element an old map
  gives no place has the document's `spot`.
- Elements are named in lists by uid, or by kind and index for the many walls and
  backgrounds without one.
- A new element starts with the map editor's defaults for its kind
  (`level_editor/editor_scripts/lib_classes.js`), so the game reads it like one the map
  editor made. A new uid is numbered like the map editor's: `#region*12`.
- A parameter names an element by its uid, or in old maps without uids by its number (a
  character's among players and enemies together, as the game counts them).

### History (`domain/history.ts`)

- An entry is one user action (a drag, a typed value, a delete) as the list of changes it
  made: attribute changes (before and after, missing attributes as undefined), an element
  inserted at an index, an element removed from an index. `edit.ts` records and plays them
  back; history only keeps the lists (at most 200 entries).
- An action made of many changes (a drag) is opened with `beginAction` and closed with
  `endAction`; changes outside an action are an entry each. Attribute changes of the same
  element in one action merge: the first "before", the last "after".

### Edits (`services/edit.ts`)

- Each change goes into the document, then into the running level (`apply.ts`). What the
  running level cannot take stays in the document, for "editor save". Every change is
  recorded for undo.
- The same in every mode: the game's map text is never written. When the level starts
  again on the same map (dying, a restart, a new round), the game builds it from that text,
  and the edits are put into the new level again: every attribute of an element the game
  has that differs from the map is put in again, the way the edit put it in the first
  time; what was taken out is taken out again, and what was added is added again, in the
  order it was added.
- Adding and taking out also happen in the running level (`rebuild.ts`): a new object is
  made with the game's loader, a deleted one is taken out of play, and an undone delete
  is built again. What the level cannot take is kept for "editor save" and says why
  (`notLiveReason`, for the status line).
- A copy lands 20 right of and below the original, with a uid of its own when it has one.
  A rectangle placed with a click instead of a drag is 100 x 100.
- `resetEdits` undoes every edit, last first, the way "editor undo" undoes each in the
  running level, and reads the document again from the map the game plays: nothing is
  left to put in again when the level starts over. It counts the undo steps the running
  level did not take (edits it never had, or could not take back out: the map's way on
  its next start). A level without them (another map, or started over since) is the
  map's already.
- `editSummary` counts what the editor keeps against the map as it loaded (changed, added,
  deleted objects) for `list editor`.
- Another map means another history; a new document clears it and forgets the guns and
  lamps found.
- `editor save` writes `data/maps/<name>.xml`, played as `local-<name>`.

### Reaching the running level (`services/apply.ts`)

- Some attributes can be written straight into the game's object, the way the map loader
  would have set them (`frame2.js`, the map loader): those changes are live. What a running
  level cannot take (an element it does not have, an attribute only read at load) says
  why, and stays in the map.
- Walls, water and pushers keep their geometry in arrays the game's integrity check
  snapshots: writing them makes the game report the client and reload the page. They are
  written like everything else; nothing hides it ([anticheat](../research/anticheat.md)
  §7.2).
- How an edit reaches a running level (`liveSupport`): written into the game's object,
  the object built again (`rebuild.ts`), or why not. Nothing finer taking it, the game's
  loader builds the object again. A game name missing from an older `names.js` says so.
- Regions: the loader rewrites hidden use keys to the plain ones (activation 8 → 1,
  11 → 9, 12 → 10, 15 → 1). Modes 1, 9 and 10 draw a switch at load: changing to or from
  one is not live (the switch is not drawn). A use-key region has its switch drawn at its
  center, moved with it. One attached to a movable keeps its offset from it: it is built
  again to take a new one.
- Triggers: actions as the loader stores them (types as numbers, targets resolved,
  `actions_1` to `actions_100`). `execute` runs it when the level starts (and when a match
  starts a new round). `enabled` and the calls left are shared by triggers and timers; a
  new round puts back the copies the loader keeps (`start.ts`). Where the editor shows a
  trigger or timer (x, y) the game never reads.
- Decorations are display objects: place, rotation and scale can change at once. One
  attached to a movable is placed by it.
- Movables are display objects: place, size and destination change at once, the texture
  (a visible one has one in the 3D layer that follows it) with it, and what is attached to
  it. A new round puts it back where the map puts it (`start.ts`). One attached to another
  movable is placed by it. Its other settings build it again.
- Walls: arrays, collision grid, body and trims (`src/console/kernel/game/walls.ts`), and
  their grab points (`later.ts`).
- Backgrounds: their arrays, and the rectangle drawn for them. One attached to a movable
  is drawn in a sprite of its own the movable carries, so it cannot move.
- Pushers: corners and settings, as the loader stores them.
- Water: the display object at the map's place, and the area it acts on, which the loader
  widens by 10 on each side and lowers by 10 (`frame2.js`). Its damage (water or acid,
  shown differently), friction (shown or not) and attachment build it again.
- A map gun is the game gun it is (`guns.ts`), moved or made again. A lamp's light is
  built and drawn again in its slot (`lamps.ts`).
- Read only when the level starts: a wall's material and how a background looks (drawn
  into the level's layers when it loads), characters, vehicles, barrels, a gun's uid,
  songs, engine marks, custom images.

### Rebuilding, adding, taking out (`services/rebuild.ts`)

- Objects of the running level made, made again and taken out, with the game's own loader
  (`loader.ts`) wherever it can.
- Built again, for edits nothing finer can put in: a region's activation (its USE switch
  is drawn or taken away), a decoration's model, a movable's settings, water's kind, what
  an object is attached to, a trigger's or timer's uid (lamps have `lamps.ts`). The
  element's branch runs with the kind's counter at its index, so the game's arrays get a
  new object in its place; what the old one put on screen is taken off first, and the
  loader's later steps run for the new one (`later.ts`).
- For each kind built in place: the old object, what of it to take off the screen before
  the new one is made, which entries of the game's attachments list are the old one's
  (an attached object is tied to its movable once, after the map is read: the new one is
  tied again), and the loader's later steps for the new one. Pushers and water are tied by
  index (attachment types 3 and 5, `frame2.js`). Kinds not rebuilt: walls and backgrounds
  draw into shared layers; barrels, vehicles and guns have no place of their own to
  rebuild into; lamps have `lamps.ts`.
- A movable made again (or added): what was tied to the old one is tied to it, a visible
  one has its texture (the old one's, or one made as the loader makes it) and the two
  edges characters grab, and what is attached to it is put where it is.
- Adding: characters, engine marks and songs cannot be added to a running level. A wall
  is added with its grab points. Once the loader made an object it is in the level: a
  later step that fails is said (`live.problem`), not undone. Barrels and vehicles (no
  index) are made by the game's own helpers: no place of ours to edit later. A gun is
  edited later through `guns.ts`.
- Taking out keeps the game's arrays in their order: a region, movable or the like is
  sent far away (10,000,000) and hidden, a trigger or timer disabled with no calls left,
  a background, water or pusher made empty, a wall removed with its grab points.
- Undoing a delete builds the object again in its place where the loader can; a gun is
  made again where the old one lies, a lamp lit again.

### The game's loader (`services/loader.ts`)

- `scripts/frame2.js` builds a level at the top level of the script: for each element of
  the map it sets the globals `a` (the tag) and `b` (its attributes, `b["#x"]`) and runs
  a branch `if(a==<tag>){...}` that makes the object at the kind's counter and advances
  it; a second loop then turns uid references into indexes (`if(a==<tag>)` again, with
  counters of its own). All of it is globals, so a branch can be run again for one
  element: the counter set to that element's index rebuilds it in place, at the end adds
  one. The code comes from the game's file itself (served by the wrapper like the game),
  so it is whatever this game version does.
- The branches are found by their shape, not by line: from the loop that holds the `box`
  branch, the loops over the map's elements that follow (the game builds walls to vehicles
  in one, decorations to characters in the next, then resolves uids in a third; at most
  six loops are read). A kind's first branch builds it; a later one for the same kind
  resolves it. The tags are written through the game's string table (`if(a==$x)`,
  `$x = "box"`), read from the page. Branches for several tags at once (players and
  enemies, built together) are left out.
- A kind's counter is the last statement `$x++;` in its branch (a for loop's `i++)` is not
  one).
- The globals the branches use as scratch (`a`, `b`, `mc`, `i`, `i2`, `n`) are put back
  after a run so the game sees no change; so is the counter (except a counter that grew
  by the addition). A run returns whether the branch kept the element (advanced its
  counter past the index): a lamp without a flare outside every background is not kept.
- The loader's watchdog is a function it calls in its loops that throws once the level
  has taken too long to build (always, after the level is built). Code run here gets its
  own that does nothing.
- Code is run with indirect `eval`, named `pb2dev-loader-<name>.js` for the debugger.
- `blockEnd` finds the end of a block, skipping strings, template strings and comments.
- `decoded` gives the game's code with its string-table names replaced by their text
  (`$x` → `"x"`), to read it by shape. `branchNames` reads the names a kind's branch gives
  what it makes; a pattern that does not match is left out.
- `loopAt` finds the innermost loop of the loader's later steps around a position:
  `for(v=0;v<n;v++)` (or `for(var v=0;...)`) and its body, a block or a single `if` with a
  block.
- `runGameCode` runs a block of the game's code like the loader's, with some of its names
  set first and others only kept, all put back afterwards like the scratch globals. The
  names are set by the code itself, so a `let` of the game's scripts is reached as well as
  a global.

### The loader's later steps (`services/later.ts`)

- Once the map is read, the loader goes over everything it made: it ties each attached
  object to its movable, shows water (water, acid or the map's own colors) and widens the
  area it acts on, gives each visible movable its texture and the two edges characters
  grab. Each step is a loop over every object; its body is read from the game's file (like
  the loader's branches) and run for the one index.
- Attachments are `{ parent, child, type, ... }` entries in the game's global
  `attachments` list. Entries a branch just added name their movable by uid: they are tied
  to it as the loader ties them; one whose movable the level does not have is taken out.
- `textureFollows` keeps two lists: the textures, and the movable each follows; a
  movable's texture is found there.
- The function that moves what is attached to movable i takes (i, speed, interpolation).
- A wall's grab points: the loader gives a wall a grab point at each top corner (a "Hand
  holder" vehicle, `veh_hh`) where there is room beside it: a line from 15 out, 30 above
  to 75 below the corner, and one from 5 in, 5 to 50 above it, cross no wall
  (`frame2.js`). The code read: the loop that makes them, the game's line test it asks
  whether there is room beside a corner, the function that makes a vehicle of one, and
  the model it gives it. After a wall moves, the grab points it had go along where there
  is room, the others are taken out of play, and a corner that has room and none gets
  one, as the loader makes it. When this game version's code for them is not found, the
  wall's old ones are taken out.

### Guns (`services/guns.ts`)

- The game keeps every gun in one list (the ones lying on the map and the ones characters
  carry), so which game gun a map element is, is found when it is first edited: a gun no
  one holds, of the element's model, within 400 world units of where the map put it (it
  may have fallen since), nearest first, as it is now or as the level loaded it (after a
  restart the game made it from the map). It is remembered until the level starts over.
- Moving one moves its two physics points, the way "drop" does. A new model, upgrade or
  team is a new gun from the game's gun factory where the old one lies (or where the map
  puts it if the old one was taken out), the old one sent out of play.
- A gun the loader just made for an added element is the newest one in the list.

### Lamps (`services/lamps.ts`)

- The game keeps its lights in parallel arrays (place, power, state: 2 with a flare, -1
  without, 0 off, 1 turned on by a trigger) that hold more than the map's lamps: after the
  map is read it drops lamps a lit decoration stands on and adds lights of its own (lit
  decorations, a faint fill along the walls). Each light is drawn once into a shape of its
  own, its rays stopped by the walls, and the lightmap is those shapes over the darkness
  (`frame2.js`, "L-map").
- So which light a map lamp is, is found by its place when it is first edited (as the
  level loaded it, or as it is now), and remembered until the level starts over. An edit
  builds it again in its slot with the loader's lamp branch, draws its shape and flare
  with the game's own code (read from its file like the loader), and has the game draw
  the lightmap again. The light drawing writes the plain globals `g` and `alphas`, which
  are kept.
- A lamp the loader does not keep (no flare, outside every background), or deleted, is put
  out for good: a new round of a match lights every lamp that is out again (`frame2.js`),
  so it is left with no power and a light of nothing, its flares hidden.

### New rounds (`services/start.ts`)

- What the game puts back when a match starts a new round (and a co-op game starts over):
  movables go back to where the map put them, triggers and timers to how the map left them
  enabled and their calls. The loader keeps a copy of each for that (`frame2.js`:
  `mc.<start x>=mc["x"]=parseFloat(b["#x"])`); an edit that is live writes the copy too,
  or the round would take it back. The copies' names are read from the loader's branches;
  one this game version does not have is left alone.

### Where things are now (`services/live.ts`)

- Where an element is in the running game is not always where the map put it: regions
  ride on the movables they are attached to, and characters walk around. Everything else,
  and elements added since the level loaded (not in the game yet), is drawn where the map
  puts it.

### Trigger actions (`domain/actions.ts`, `ui/trigger-panel.ts`)

- A trigger's actions as the map stores them (`actions_1_type`, `actions_1_targetA`,
  `actions_1_targetB`, `actions_2_...`, type -1 = an empty slot), as a list, and as the map
  editor's text view (`src/features/triggers/script.ts` reads that format; this writes it).
  Setting a list removes every action attribute beyond it.
- Like the map editor, a trigger may end up with no actions at all.
- In the params panel a trigger shows its actions as a list (each action's name, then its
  A and B), with an action added, removed or changed in place; or, after "Edit triggers as
  text", the whole trigger as the editor's text view (the format "triggers exec" reads),
  applied in one go. A new action is type 100 ("set variable A to value B"), an action
  that does something harmless. The action's name opens the editor's action list: every
  action by category, searchable; typing a name or a number works too. A target that is an
  object can be clicked in the world; one with choices opens the drop-down; anything else
  is typed.

### Parameters (`domain/params.ts`)

- What the params panel shows for a kind, as the map editor does: every parameter that
  kind has (its place, its size for a rectangle, and the editor's defaults for it),
  whether the map writes it or not, with the editor's title and description, and the
  values a parameter offers (teams, activation modes, materials, ...). The titles and
  values come from `data/opcodes.js` (`npm run fetch-opcodes`); without them the
  attribute names are shown.
- Attributes the game reads (`frame2.js`) that the map editor does not show are listed
  after the editor's, with the value the game takes when the map leaves them out: water
  `attach`, movable `mute`, region `uses_timer`, trigger `execute`, decoration `text`. New
  elements do not get them, as in the map editor.
- Parameters whose kind of value follows another parameter (the editor's `mark_pairs`,
  `lib_params.js`): an engine mark's parameter is a sky for "sky", a count for
  "he_nades_count", ... and free text for a mark the table leaves out.
- The object kinds a value names, for picking one in the world, follow the map editor's
  `special_values_table[kind]['[listof]']`.
- The pictures the map editor shows next to a model or a skin come from its server's
  lists (`decors/<model>.png`, `chars_full/char0001.png`; a sky from `pic.php`).
- The drop-down rows follow the map editor's `special_values_table[kind]`, walked like the
  editor walks it: values it offers (a model or a skin with its picture), "# calls" (type
  a number; `-[val]` means it is stored negative), objects of the map named as a parameter
  names them, and trigger actions as "Category › what it does" in the category's color.
  A kind like `team+any` also offers its base kind's values (`team`).

### The overlay (`ui/view.ts`)

- An outline for every element in its layer's color (faint off the active layers, as the
  map editor draws them at 0.3), the selection highlighted, the selection's connections
  drawn the way the map editor draws them (`lib_render.js`: 1 px, dashed 4/4, green to what
  the selection points at, white from what points at it; uids at the far ends), the
  rectangle being placed, and quick-pick markers.
- The logic graph of the document is built again only after a change. A node is named by
  uid, or `<tag>#<index>` without one.
- Quick-pick markers are the map editor's (`level_editor/quickpick.png`, `quickpick2.png`
  on the one the pointer is over, its 27 px half size), pulsing as its `lib_render.js`
  pulses them.

### The mouse (`ui/input.ts`)

- While the editor is shown it hears pointer presses on the document before the page's
  elements do (capture), the game canvas included, and keeps the ones it uses from the
  game: no shooting, no pointer lock. Presses on the console or on the editor's own panels
  are left to them. Pointer moves still reach the game (aiming, and the crosshair the
  labels follow), and the keyboard is the game's as always: you walk around while editing.
- Pointer events, not mouse events: the game's graphics library cancels pointerdown on
  its canvas, and then the browser sends no mousedown or mouseup at all. The game's mouse
  handlers listen for mousedown, mouseup and click too: they are taken from them while a
  press is the editor's.
- Listeners go on `document`, not `window`: the game replaces `window.addEventListener`
  with one that registers on its graphics stage (`scripts/flash.js`), which sends no DOM
  events.
- A press over the world (not on the console, a panel or outside the game) is the
  editor's: the game never sees it, nor the release that ends it.
- A parameter waiting for an object: a press takes the nearest object of the kinds it
  names (within 9 screen units of its center, the editor's 20 px) instead.
- Select tool: a press selects what is under it and can drag it right away: from inside it
  moves, from an edge or a corner of a rectangle (3 screen units) it resizes. A rectangle
  drags by its bounds, a point by the spot the map stores. A click on the selection without
  moving takes the one below it instead; a press that just selected an element keeps it
  selected (the next click on the spot cycles). A press becomes a drag after 2 screen
  units.
- Place tool: a click places a point, or a rectangle of the default size with its corner
  there; a drag places the rectangle dragged out (at least one snap step each way).
- Positions snap to 10 world units, like the map editor's grid; with Alt held they do not.
  A drag is one step for undo.
- `editor status` reports the last press the window saw (whatever it landed on) and the
  last one the editor handled.

### The panels (`ui/panels.ts`, `ui/dropdown.ts`, `ui/fields.ts`, `ui/style.ts`)

- Laid out like the browser map editor's: a panel down each side of the game, so the level
  stays in view between them.
  - Left: Tools (select, then one place tool per kind, as the editor's icons; copy,
    delete, undo, redo), and Layers: what can be selected, as the editor's All, Nothing,
    Statics, Logics, Entities, or with More one kind at a time (Ctrl adds a kind, Alt takes
    it away). The rest is drawn faint.
  - Right: the object box (the active layers' objects, in map order, at most 400 rows; a
    long list says how many more), then the selection's params as title / value rows;
    click a value to edit it.
  - The top line, between them: how the mouse works, edits the running level does not
    have, the last reason an edit was not live, and a message (shown for 4 seconds).
- They are drawn from the session and drawn again when it changes.
- A value is edited as in the map editor: a parameter whose kind offers choices opens its
  drop-down, one that names an object can also be clicked in the world (the quick pick),
  and any other turns into a text box. The drop-down opens first: opening it closes any
  other, and with it that one's pick. A parameter the map leaves out shows the editor's
  default, dimmed.
- The drop-down is the map editor's "parambox" (`e_css.css` and `lib_letediting.js`): a
  black box under the value with a row per choice. A row is green under the pointer and
  blue when it is the value now. On top, a field: typing narrows the rows, Enter takes what
  is typed (a "# calls" row asks for that number). A row is taken on the press, before the
  field loses focus to it. Trigger actions get the editor's big box instead: a full-height
  list left of the params (its 700 px box), the categories along the top in their colors
  (Everything, ..., Do Nothing), and a search field. It closes on a choice, Esc, or a press
  anywhere else (the press still does what it does).
- A text field (as in the map editor's params): Enter applies it, Esc or clicking
  elsewhere leaves it as it was. Choices are offered as completions (a datalist).
- The look follows the browser map editor (`level_editor/e_css.css`): its panels and
  buttons in its Dark theme, its 16x16 object icons (`level_editor/icons16/<kind>.gif`,
  loaded from the site like the rest of the game). The panels are dark like the game's own
  dark panels (HUD panel type 2, `#000000d9`: the Esc menu's side panels, where a match
  host sees the logs), with the map editor's Dark theme greys for everything on them (its
  blue theme turned gray: `lib_gui.js`, ThemeSet). Sizes are game units (the overlay is
  800 x 400 of them); the editor's 10 px font is 5 units and a 16 px icon 8 units at the
  overlay's usual scale.
- The map editor's scroll bars (`e_css.css`: 4 px, rounded, a faint track) are only
  styled through a stylesheet, so the editor's scrolling elements carry a class and the
  rules are put on the page while the editor is shown. The standard `scrollbar-width` /
  `scrollbar-color` would win over them, so they are not set. 1.75 game units is the
  editor's 4 px at the overlay's usual scale.
- The game's CSS hides its overlay container; everything put in it shows itself
  (`IN_OVERLAY`). Panels take their clicks (the game never sees them). Buttons fire on
  "click", which fires even where the game cancels the press itself; a button that cannot
  do anything now is dim and inert, the active one highlighted.

### Keys (`ui/editor.ts`)

- The editor's keys work while it is shown and the console is closed (not while typing):
  Esc closes the drop-down, cancels a pick, goes back to the select tool, or clears the
  selection, in that order; Del deletes, Ctrl+D copies, Ctrl+Z undoes, Ctrl+Y and
  Ctrl+Shift+Z redo. A key that did nothing goes on to the game.

### The command (`entry/command.ts`)

- How the anti-cheat works is not shown to remote testers
  (`src/console/kernel/core/mode.ts`): the help note about the integrity check is left out
  in remote mode.
