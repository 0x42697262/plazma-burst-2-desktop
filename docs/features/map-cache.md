# map_cache: local maps and the map cache

Feature flag `map_cache` (on by default; all modes). Code: `src/features/map_cache/`.
Its wrapper side works without the dev console: with `PB2_DEV=0`, local maps and the
cache still work. The settings `save_maps` (on by default) and `fast_maps` (off by
default) are read from the console's settings file.

## Local maps

Type `local-<name>` as the Map ID in Campaign > Custom Map. The wrapper answers the
game's map download (`POST /pb2/server.php`, `rq=cmap`) itself, with
`data/maps/<name>.xml` (or `.txt`, or no extension; case does not matter; a byte
order mark is dropped). A missing map is answered `<not_published />`, as the site
answers an unpublished one. Sad Burst 2 uses `data/maps.sadburst/`.

## The cache

Every other map the game downloads is saved to `data/maps/<map id>.xml`:
- uncompressed: the site's `<q.` format is unpacked with the game's own function from
  `scripts/libs/xml.js`, run in a sandbox (`src/kernel/maps/map-text.ts`, shared with the
  server);
- one tag per line, so the files are readable and diff cleanly;
- the map ID made safe as a file name (anything else becomes `%XX`).

With `fast_maps` on, a saved map is served instead of downloaded.

**Multiplayer maps** come over the game socket, not HTTP, so the console handles them
(`services/multiplayer-cache.ts`, every 250 ms):
- **save**: once a multiplayer level runs, its map text is posted to `__dev/savemap`
  with the match's map ID;
- **fast load**:
  - The lobby's match list tells which map each match uses, and saved ones are fetched
    ahead (`__dev/mapfile`).
  - Joining sends a `JOIN_MATCH` whose part 4 is "send me the map". With `fast_maps` on
    and the map saved, that flag is cleared (as the game does when you rejoin a match)
    and the saved map is put where the game reads it.
  - This wraps the lobby connection's send method, on the connection object only and
    only while `fast_maps` is on ([anticheat](../research/anticheat.md) §9.11: the scan
    checks globals, not object methods).

## Routes

| Route | Answer |
|---|---|
| `__dev/maps` | the local map IDs |
| `__dev/savemap?id=` (POST, the map) | `saved`, `same` or `off`; 400 for a bad ID or text that is not a map |
| `__dev/saveedited?name=&overwrite=1` (POST) | `{ file, id }` for the editor's save; 409 when the file exists and `overwrite` is not set, 400 for a bad name |
| `__dev/mapfile?id=` | a saved map, or 404 |

The map download is caught by an interceptor (`WrapperFeature.interceptors`), a hook
for requests outside `__dev/`.
