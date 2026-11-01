# find-names

`npm run find-names` (`src/tools/find-names/`) finds the obfuscated names the dev console needs in a downloaded game copy and writes them to `data/names.js` (`data/names.sadburst.js` with `--sadburst`).

The game's identifiers are random look-alike names (e.g. `$0Ме1А`, with Cyrillic letters) that can change with every game version. The code structure around them is assumed to stay the same, so every name is found with a pattern that matches the surrounding code and treats all other obfuscated names as wildcards.

## Rules

Each rule (`RULES` in `src/tools/find-names/constants.ts`): `keys` are the names captured by `⟨ID⟩` in order (`_` = ignore), `file` is a key of `FILES`, `re` is a regular expression source with these placeholders:

- `⟨ID⟩` captures an obfuscated name;
- `⟨_⟩` is any obfuscated name (not captured);
- `⟨key⟩` is a name found by an earlier rule.

String constants are matched as literals: the game keeps them in `_strings.js` as variables, which are replaced by their values before matching. `what` is the description written to names.js. Rules may depend on names from other rules; they are tried again until nothing changes. The `CHECKS` run after all rules: each must match at least once.

## Why the patterns look the way they do

### Characters

- `playerDt`: Three smoothing lines in a row; the player one is right before the fixed 30 fps one.
### Physics points and teleport (map trigger "move character to region")

### Guns

- `wakePt, gunPtA, gunPtB`: End of the game's own weapon drop (V key): wake both gun points so the gun falls.
- `ptVelX, aimAngle, ptVelY`: Start of the same drop: the toss (velocity along the aim angle, offset in the facing direction).
### Bullets

### Map triggers, regions, timers (map loader)

- `charVehicle`: The region check: which characters each activation mode accepts.
- `triggerActivator, triggerPower, runTrigger`: A shot that hits a movable with a trigger: sets the activator and power, then runs it.
- `resolveTarget`: The map loader's target fixup, run on every trigger action's A and B once the map is in: "#uid" becomes that object's index, a whole number becomes a number.
- `decors`: Each <decor> of the map, as the loader makes it: a display object, stored in map order.
- `wallX, wallCount, wallY, wallW, wallH, wallMaterial`: Walls: the loader keeps each <box> in parallel arrays, counted in map order.
- `gridCell, grid, gridCols, gridRows, gridMinX, gridMinY, gridAddWall`: The wall collision grid: cells of gridCell units from (gridMinX, gridMinY), each a list of wall indexes; gridAddWall(i) puts wall i into every cell it reaches.
- `doors, doorCount`: Each <door> (movable) of the map: a display object in the 3D layer, in map order.
- `bgX, bgCount, bgY, bgW, bgH, bgShadow`: Backgrounds: drawn once into a shared layer; their rectangles also kept in arrays.
- `pushX1, pushCount, pushY1, pushX2, pushY2, pushToX, pushToY, pushStab, pushDamage`: Pushers (gravitator fields): corners and settings in parallel arrays.
- `waters, waterCount`: Water: a display object each, and the area it acts on in parallel arrays.
- `displayInit, textureFollows`: A visible movable's texture, made after the map is read: a texture_front0 in the 3D layer, made inert to the mouse, then tied to the movable's index so it follows it.
- `net, netNum`: The same shot, in multiplayer: tells the server so every other client runs it too.
- `lobbyConn, netSend`: Joining a match from the lobby: [type, match uid, callback, slot, "1" = send me the map, password].
- `netLog`: Kept for the game's multiplayer logs screen. A sent message is always added (scripts/connection.js); a received one only with TRACK_MP_LOGS.
### Network recorder (src/features/netlog/)

- `connRecv`: A connection's raw packet in (socket "m" event or P2P data), its P2P peer, and the text it gives when it closes.
- `netDigits`: Numbers in messages are written in base N with this alphabet (built at load).
- `buildTag`: The main server's tasks (RELIABLE_TASK, docs/research/fingerprinting.md): JavaScript the game runs with eval, called with this build tag; net/fingerprint.js runs the fingerprinter so.
### Dedicated host (src/features/p2p_host/, "npm run p2p-host")

- `netChannel, netReplyTo`: Leaving a match: [type, -1, where the reply goes, slot -1, "", ""] on the reliable channel.
- `enterMatch`: What the lobby does with a join or create reply: connects to a player-hosted match (the reply carries the host's WebRTC offer), or leaves one ("", -1).
- `spectatorSlots, matchSlots`: A player-hosted match the host makes for itself: a slot per player, then spectator slots.
- `connUser, connStats, p2pAuth, p2pAuthIds`: The host accepting a player: their account, their standing, and their auth id.
- `connPlayer, connSpectator`: The match's inactivity check, per slot: spectators are only excluded when spectating is full.
- `matchSetMap`: The map a match plays: [map text, name, approved, max players, map ID]; every player in it gets the new map.
- `acceptManually, createSettings`: The create screen's "Start New Match".
- `spectatorSlot`: The in-match "Spectate" / "Join Game" button.
### The state update (docs/research/anticheat.md §14.2): where each value sits

- `stateHp`: The server reads parts of your state update by these indices (numbers on the network class). The recorder labels STATE lines with them, so a new layout follows by itself.
### Own lobby server (src/server/, "npm run server"): the game's server code, run in Node

- `setupClass, setupMethod`: Run once at start: builds the digits of encoded numbers (and, with arguments, the device ID the client sends).
- `webRequests, webRequest, mapUrl, mapKey, mapRequest`: A match loading its map: POST [map ID, "h5", title, ip] joined by "[^c]", answered "map text[^#]name[^#]approved[^#]max players[^#]map ID" or "x[^#]why".
- `serverLocation`: The location the Tab scoreboard shows, chosen by the client when it joins a match: a player-hosted match's region, otherwise always "USA, Arizona".
- `lobbyHosts, lobbyPort`: The lobby address: hosts[CONNECTION_SERVER_ID] + "plazmaburst2.com" + ":" + port.
- `lockedArrays`: The anti-cheat's locked arrays (docs/research/anticheat.md §7). The scan's code 3 report sends an index into this list.
- `levelStart`: The function that builds a level (frame18.js calls it once per level start). Its first lines: unlock the locked arrays, set a quicksave flag, clear a list. Its body (past a nested empty debug function) unpacks a "<q." map. Used by hooks (Game.levelStart).
- `zoom`: The camera zoom the game sets (1 = 100%): the map's "gamescale" engine mark, the "set zoom" trigger actions and the chat's "zoom 50" write it, the camera follows it.
- `varSyncOn`: The map's "var_sync" engine mark: set from an <inf mark="var_sync"> element, and the gate on both sending and applying a variable sync. Never set back to false.
- `mapVars`: Map variables: one object, variable name -> value, emptied when a map loads. Found at the "sync this variable to the server" action, which reads both the name and the value.
### Input, chat, multiplayer, map

- `mapId`: The map being loaded or played: a campaign level ("c31a") or a custom map ID, set as the load starts, before the built-in levels table is looked up.
### Level end


## Sad Burst 2

Sad Burst 2 is a fork of the official client: its obfuscated names are the official ones, but its code is minified (locals renamed, `if` turned into `&&`, `true` into `!0`, constants folded), so most patterns do not match it. A name is found in one of two ways, the first that works:

1. pattern: the pattern matches its code once (after `!0` / `!1` are read as true / false);
2. same: the name is the one the official client uses for it (found in `game/` now, or in `data/names.js`), or the one the file had before, and it appears in the Sad Burst 2 code.

So keep the official copy around (`npm run fetch-game`) for the second way. If Sad Burst 2 ever renames its identifiers, the second way finds nothing and says so.

Names Sad Burst 2 does not have are left out of names.sadburst.js, so the console does not list them as missing: `authReport` and `authEndorse` are only for the own lobby server, which runs the official client's code (Sad Burst handles report, endorse, kick and ban in one handler); `lockedArrays` is a block-scoped `let` in its minified tools script and cannot be reached from outside (only the anti-cheat scan report's array names need it).
