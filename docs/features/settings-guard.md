# settings_guard

Feature flag `settings_guard` (on by default; all modes; needs `dev_console`). Code:
`src/features/settings_guard/`. It works the same for every game client.

## Why
The console saves its settings to `data/dev-overrides.json` through the wrapper
(`PUT __dev/kv`). Every client shares that file, so a bind saved in one client runs in the
others. Anything that runs in the game page can save there too, including code a lobby
server sends (RELIABLE_TASK, [fingerprinting](../research/fingerprinting.md) §4): the
official lobby, Sad Burst 2's, or a private one. Without a guard, such code could add a
bind that runs JavaScript in your next game, in any client, logged in as you.

## What it does
- When a save adds or changes a bind, a profile bind or a profile's `onload` (a text or a
  list of commands, read the way the console joins it) with a risky command anywhere in a
  `;` chain, any letter case, the wrapper asks in a native dialog, outside the page: **Refuse**
  (the default, also on Esc) or **Keep**. The dialog lists each command and where it goes.
  Page code cannot answer it. One dialog at a time: a save that comes while one is open
  waits for its answer. Each command is shown on one line and cut at 200 characters.
- Only this game's settings route counts: its host and `<game path>/__dev/kv`, compared
  after decoding, the way the wrapper serves it.
- Refused: the refused commands go back to what the file held (or are left out when they
  are new), everything else in that save is written, the console prints "Not saved: …" and
  reloads the file, so the bind is gone from the page too. Kept: saved as usual.
- A command already in the file is not asked about again. The same command on another key
  is asked about.
- A remote tester's page (remote play) cannot add one: refused without asking the host.
- The player-hosted host's page cannot either: its window is hidden, so a dialog would wait
  for an answer nobody can give. Edit its settings file by hand instead.
- Editing `data/dev-overrides.json` by hand is not checked: that is you.
- Other settings (keys, harmless binds, history) are saved without a question.

## Where
- Which commands count: `RISKY_COMMANDS` in `src/features/settings_guard/keys.ts`, aliases
  included: commands that run code (`js`, `fingerprint`), act as you on a server (`wire`,
  `game`, `servers`, `diagnostics`, `triggers`, `regions`, `vars`) or turn a protection off
  (`bypass`). Every other command word is in `SAFE_COMMANDS`; `classified.test.ts` boots the
  console and fails when a command word is in neither list, so a new command is classified
  before it ships.
- The check: `newRiskyCommands` in `domain/risky.ts`; the route check:
  `entry/interceptor.ts`; the dialog: `adapters/dialog.ts`.
- The console side: `onSaveRefused` in `src/console/kernel/state/store.ts`.

## Turning it off
`PB2_FEATURES=-settings_guard npm start` saves every command without asking, as before.
