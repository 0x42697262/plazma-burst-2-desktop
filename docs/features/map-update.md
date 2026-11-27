# map_update: downloading a saved map again

Feature flag `map_update` (on by default; lobby server only, `npm run server`). Code:
`src/features/map_update/`: reading the command (`domain/request.ts`), updating and
reloading (`services/update-map.ts`) and the server part (`server.ts`). The download
itself is `update` in `src/server/maps.ts`.

The server downloads a published map once and keeps it in `data/maps/`
([private-server](../operations/private-server.md#maps)). When the author publishes a new
version, the server keeps playing the old one. An admin asks for the new one:

| Where | Command | Does |
|---|---|---|
| Terminal | `maps update <map ID>` | downloads the map again |
| Terminal | `maps update #<match>` | the same for the map of a match (its number from `matches`) |
| Terminal | either, then `now` | also reloads the match, or every match playing that map ID |
| In a match, admins only | `-mapupdate` | downloads the match's map again; the match keeps playing |
| In a match, admins only | `-mapupdate now` | downloads it, then reloads the match |

- **What a reload does:** the match loads its map again, as `map <match> <map ID>` does;
  its round starts over for everyone in it. Before that, each player in the match gets
  "This map was updated by …: reloading".
- **Without `now`:** a running match keeps the copy it loaded, and players who join it get
  that copy, until its next map load.
- **The download goes through the server's map sources** and their limits: one at a time,
  at most 6 new maps a minute, an update counting as one.
- **A failed download keeps the saved map:** a source that fails, an answer that is no
  map, or "not published". Nothing is reloaded, and the admin gets the reason (in game, in
  a line only they see).
- **The new copy replaces the file the server reads** (`.xml`, `.txt`, whatever case),
  through a temporary file, so the folder never holds half a map.
- **Refused:** `local-<name>` maps (never downloaded) and a server with
  `download_maps: false`.
- **Not admins:** `-mapupdate` from anyone else is plain chat. The command shows in the
  match's chat like any line, since the server sees chat only after the game has sent it.
- **Players with `fast_maps` on** load their own saved copy and may keep the old version;
  that is the client's cache ([map-cache](map-cache.md)).

## With the flag off
`PB2_FEATURES=-map_update npm run server`: `maps` is an unknown command and `-mapupdate`
is plain chat. A server edition without `map_update` leaves its code out.
