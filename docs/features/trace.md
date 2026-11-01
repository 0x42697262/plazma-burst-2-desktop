# trace: lines to other characters

Feature flag `trace` (on by default; all modes). Code: `src/features/trace/`.

- `trace` draws, on its own overlay layer, a white line from you to each traced
  character, with a label giving their name and distance in world units (as in
  `chars`). A dead or downed character's line fades.
- A character off screen gets its label where the line leaves the screen, 4 px inside
  the edge (`domain/screen-edge.ts`), so the direction and the distance still show.
- **A group** (`--all`, `--players` / `--npc`, `--team` / `--enemies`; one kind and one
  side combine) is checked every frame, so it includes characters who join later and
  follows team switches. "Team" means the same team number, as in `chars` and the
  game's own damage and team chat.
- **Picks**:
  - `trace 2` (a `#`) traces that slot, whoever is in it. The game keeps one character
    per slot and gives it to whoever joins next.
  - `trace bob` (a name) traces the person, known by their account. Guests and NPCs,
    which have no account, are known by slot and nickname. When that person leaves,
    their trace ends, even if they come back.
- `trace --off <# | name>` drops one, including from a group. `trace --off` stops all.
- Every word that is not an option is a character, so a player named `all` is
  `trace all`, and `--` ends the options. The old keywords (`all`, `off`, `bots` …)
  hint at their option when no character matches.
- `list trace` shows who is traced (a `listSections` entry).

The game's own `trace()` debug output, which the wrapper prints at debug log level, is
unrelated: it belongs to the wrapper's logging.
