# fingerprint: keeping and running the main server's fingerprinter

Feature flag `fingerprint` (on by default; local and server modes, not in remote play).
Code: `src/features/fingerprint/`. Background:
[fingerprinting research](../research/fingerprinting.md).

## What it does

- **Capture** (`services/capture.ts`). The main server sends the game a browser
  fingerprinter as JavaScript source, in a `RELIABLE_TASK` (or `RELIABLE_TASK_ASNYC`,
  the game's spelling) whose part 1 is the code. The console taps the lobby
  connection's receive method, whatever `net_log` is, and looks into a packet only when
  its text contains `getBrowserFingerprint`. The game resends a message in every packet
  until its ack arrives, so the same source is posted to the wrapper only once.
- **Store** (`adapters/store.ts`, wrapper side). Every version is kept once in
  `data/fingerprint/` (Sad Burst 2: `data/fingerprint.sadburst/`, so its code never runs in the
  official game):
  - `<date>_<time>_<id>.js`: the source exactly as sent.
  - `index.json` (versioned): every version with first and last seen, how often, sync
    or async, and which one is the latest.
- **A version** is the code's shape: the source with comments, spacing, and the
  contents of every string and number left out, hashed (SHA-256, 12 hex characters).
  The server writes this session's values into the source (the IP address it sees, a
  token, the separator), and those do not make a new version. A known version's file is
  rewritten when the text differs, so it holds the newest values.
- **`fingerprint`** runs the latest version the way the game does:
  `(code)(\`<build tag>\`)` for a task, `(code)(tag, answer)` for an async one, which
  times out after 10 s. It then shows what the game would answer:
  - one part per string, number or boolean, the parts of an array, or nothing;
  - the fingerprinter's values are joined into one text by a separator the server picks
    per session (a Cyrillic letter), split here at the last `.join('…')` in the source;
  - each value is labelled from what it is (§7.2 of the research): full or hardware-only
    JSON, build tag, IP address, token, page origin, time zone, the MurmurHash3 hash in
    base 36.

  Nothing is sent anywhere.

## Never from a private server

On a private server (the page has `PB2_JOIN`), the capture does not listen at all. A
private lobby can send any task, and saving it would put that operator's code where
`fingerprint` would later run it in the official game. The
[lobby task guard](lobby-task-guard.md) also keeps such code from running in the game.

## Routes

| Route | Method | Answer |
|---|---|---|
| `__dev/fingerprint?kind=sync\|async` | POST, the source | `{ id, file, status }`, with status `new`, `updated` or `same`; a `fingerprint.saved` / `fingerprint.updated` log event |
| `__dev/fingerprint` | GET | the latest version with its code, or 404 |
| `__dev/fingerprints` | GET | every version, the latest first |

All three answer 403 to a remote play tester. A source must be non-empty text of at
most 1 MB.
