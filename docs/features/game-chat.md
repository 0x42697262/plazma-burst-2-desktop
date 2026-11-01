# game_chat: the game's own chat commands

Feature flag `game_chat` (on by default; all modes). Code: `src/features/game_chat/`.

- `game <command>` runs one of the game's chat commands (`frame2.js`, its chat keydown
  handler). The game has no help of its own, so `game help` lists them, grouped
  (`GAME_COMMANDS` in `text.ts`).
- **`builtin off`**: the command is typed into the chat and Enter is pressed. The game
  parses chat commands only when it is not multiplayer and not a custom map. On a custom
  map, chat goes to the map's "player says" triggers instead, so the custom-map flag is
  cleared for that one Enter press.
- **`builtin on`**: the multiplayer and custom-map flags are cleared and the map's
  "player says" trigger detached for the command; then everything is put back. The chat
  lines it produced (popups and the chat panel) are hidden again, and their text is
  printed in the console. The game's echo of the command is left out. "command not
  found" is shown as an error.
- Ranked-match checks can refuse a command (`overrides/server-checks.js`), and a level
  must be running.
