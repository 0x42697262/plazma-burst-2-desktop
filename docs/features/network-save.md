# network_save: the account's network save

Feature flag `network_save` (on by default; local and server modes, not in remote play).
Code: `src/features/network_save/`; the save text's decoding is shared in
`src/kernel/game-save/`. Background: how the game downloads and uploads its save,
[reputation research, Data flow](../research/reputation.md#how-the-network-save-travels).

The game keeps its save in `localStorage["plazma_burst2"]` and in the account's **network
save** on the site (`/pb2/server.php`). It downloads the network save once at start and
uploads the whole save after every local save, always to the account the page was loaded
with (the page's `l` and `p`). `netsave` shows and drives both sides.

Capabilities: `network_save.watch` (the wrapper's record, which `rep device` also needs),
`network_save.status` (`netsave`), `.preview`, `.diff`, `.download`, `.upload`, `.direct`
(`netsave upload --direct`) and `.restore` (`netsave restore`, `netsave backups`).
`networksave` is an alias of `netsave`.

## Commands

| Command | Does | Writes |
|---|---|---|
| `netsave` | the page's account (where uploads go), the lobby login next to it with a warning when they differ, the save address, the local save's size, and every download and upload seen this session (by the game or by the console) | nothing |
| `netsave preview [--raw]` | exactly what the next upload sends, built with the game's own function: value by value, or the text | nothing |
| `netsave diff` | the local save next to the network save: the same, different, only local, only online | nothing |
| `netsave download [--raw]` | asks the site for the network save now and shows it | nothing |
| `netsave upload [--yes]` | runs the game's own upload | the network save |
| `netsave upload --direct [--yes]` | sends the same text through the app, past the game's rules, and shows the site's HTTP answer | the network save |
| `netsave restore [--yes]` | writes the network save over the local save with the game's own loader, as a start does | the local save |
| `netsave restore --backup <n> [--yes]` | writes backup n over the local save, then uploads it so the next start keeps it | both |
| `netsave backups` | the kept backups, newest first | nothing |

- **Every write asks first.** Without `--yes` a write command only says what it would do: which
  account, how many values, and, for a restore, whether the device id would change (the lobby
  picks the reputation entry with it, [reputation](reputation.md#rep-device)).
- **Uploads and restores keep a backup first.** An upload saves the network save from before;
  a restore saves the local save from before. If the network save cannot be backed up, nothing
  is uploaded.
- **The game's upload keeps the game's rules:** it is skipped while a level is being played with
  no menu open (`netsave upload` then says so), and the site's answer is not checked. `--direct`
  skips those rules and reports the answer.
- **Never shown:** the password or site token (`p`) and `first_login_proof` (`‹hidden›`).
- **No editing.** There is no command to write a hand-made text or to change the device id.
- `settings_guard` counts `netsave` as risky: a bind or profile that runs it asks first.

## The game's functions

`find-names` finds them in `scripts/frame1.js` (`npm run find-names`; a new game version may
move them): `gameSave` (the `SharedObject`), `saveUrl` (the address, already rewritten for the
client), `saveText` (builds the upload text), `saveUpload` (the upload, with its rules) and
`saveApply` (writes a network save text over the save and flushes it). `netsave preview`,
`upload` and `restore` call them, so they behave the way the game does.

## The wrapper

- **The record** (`network_save.watch`). The wrapper watches `POST /pb2/server.php` on the
  official site and the client's own host. An upload (`rq=save`) is read from its `str` field
  and goes on untouched; a download (`rq=load`) is sent by the wrapper and its answer handed to
  the game unchanged (same body, status and headers). For each it keeps the time, the account
  (`l`), who made it (the game or the console), the device id, `first_login` and whether a
  proof was there: in memory, the last 20 of each. `__dev/netsaves` answers `{ loads, uploads }`.
- **The console's requests** go through `POST __dev/netsave` with `{ action: "load" | "save",
  url, login, password, text }`. The wrapper refuses another address, an empty login, an action
  whose capabilities are off, and a remote play tester, and sends the form with the game
  session (its cookies). The password is passed through and never kept or logged.
- **Backups** (`__dev/netsavebackups`): `data/netsaves/` (Sad Burst 2:
  `data/netsaves.sadburst/`, for the official servers `data/netsaves.sadburst-erich5/`), one
  JSON file each, mode 600, the newest 10. A local backup holds the save object, an online one
  the save text. Both hold the whole save, the login proof included, never the password. Off
  when upload, direct and restore are all off.

All three routes answer 403 to a remote play tester.

## With the flag off

`PB2_FEATURES=-network_save npm start`: `netsave` is an unknown command, the wrapper neither
watches nor answers its routes, and `rep device` is off too (it needs `network_save.watch`).
`PB2_FEATURES=-network_save.direct` refuses `--direct`; `-network_save.restore` removes
`restore` and `backups`.
