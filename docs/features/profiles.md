# profiles: settings for some maps

Feature flag `profiles` (on by default; all modes). Code: `src/features/profiles/`. The
profile data itself is kept by the console's store (`desktop/dev/console/state/store.js`,
the `profiles` and `maps` parts of `dev-overrides.json`) until the console kernel moves
(P4).

- **What a profile holds.** A profile is a set of game keys (`god`, `speed` …; never
  console keys, which are the same on every map), key binds, and `onload` commands. A
  map uses one profile, and on that map its values and binds win over yours. Several
  maps can share a profile.
- **Which map.** In multiplayer it is the match's map; otherwise the map loaded last (a
  campaign level such as `c31a`, or the custom map ID you typed).
- **The watcher** (`services/watcher.ts`, every 250 ms):
  - says so when you reach a map with a profile, or leave it for one without;
  - runs the profile's `onload` each time a level starts on its maps (joining a match,
    or starting or restarting the level).
- **Editing by hand.** `dev-overrides.json` can hold profiles written by hand:
  `"profiles": { "hardcore": { "god": false, "binds": { "shift+j": "heal" }, "onload": "heal; pos" } }`
  and `"maps": { "<map id>": "hardcore" }`. `onload` may also be a list of commands.
- **`list profile`** shows the active profile.
- **With the flag off**, the store treats every map as having no profile
  (`activeProfile()` is null). Saved profiles stay in the file, untouched, and apply
  again once the flag is back on.
