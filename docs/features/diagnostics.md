# diagnostics

Feature flag `diagnostics` (on by default; all modes). Code: `src/features/diagnostics/`.
Capabilities: `diagnostics.capture`, `diagnostics.show`, `diagnostics.send`,
`diagnostics.login`, `diagnostics.cookies`, `diagnostics.ips`.

## What is captured
- In the game page: uncaught errors and unhandled promise rejections
  (`src/features/diagnostics/page.ts`). The listeners add no globals.
- In the main process: uncaught exceptions (through Node's monitor event, so the app's
  normal crash behavior does not change) and a game page process that ended other than
  cleanly.
- By hand: `diagnostics report <note>`.

The same report within a minute is not saved twice, and at most 10 are saved a minute: a
game that throws every frame cannot fill the disk. The page's route refuses remote play
windows and accepts only the two page kinds from a page.

## What a report holds
`schemaVersion`, `id`, `time`, `kind`, `client`, `appVersion`, `edition`, `gameVersion`,
`flags` (the features and capabilities that are on), `login` (the active account's login, or
`null`; capability `diagnostics.login`), `cookies` (`login` and `pb2uid`, never the
`password` cookie; capability `diagnostics.cookies`), `ips` (this machine's non-internal IP
addresses; capability `diagnostics.ips`) and `error` (`name`, `message`, `stack`, `source`,
`line`, `column`).

Every text is redacted before it is saved (`domain/redact.ts`): password, token and
authorization values, bearer tokens, 32-digit md5 digests (the official site's `password`
cookie is one, and it works as the password) and home folders. Login names, `pb2uid` and IP
addresses are kept.

## Where
`data/diagnostics/reports.json`, readable only by you, the newest 50.

## Commands
- `diagnostics` or `diagnostics status`: is capture on, how many reports are saved.
- `diagnostics show [<#> | last]`: the list, or one report in full.
- `diagnostics report [<note>]`: save one by hand.
- `diagnostics clear`: delete them.
- `diagnostics send`: send the saved reports to the server now.
- `diagnostics send preview`: print exactly what would be sent, and send nothing.
- `diagnostics config`: the server, the fields and whether sending is automatic.

## Sending and its settings
Nothing leaves the machine until a server is set. `data/diagnostics.json`
(`data/diagnostics.example.json` is a template; read at each use, so a change needs no
restart):

```json
{ "host": "https://reports.example.test/pb2", "send": ["kind", "client", "error"], "auto": false }
```

| Key | What | Default |
|---|---|---|
| `host` | Where reports are POSTed: `https://`, or `http://` only for this machine | none: nothing is sent |
| `send` | Which of `kind`, `client`, `appVersion`, `edition`, `gameVersion`, `flags`, `login`, `cookies`, `ips`, `error` leave (a field whose capability is off is left out). `id`, `time` and `schemaVersion` always do | all of them |
| `auto` | Send each report when it is saved, instead of waiting for `diagnostics send` | `false` |

- The order is `PB2_DIAGNOSTICS_URL` (the server only), then this file, then the edition's
  `diagnostics` values, then the defaults above.
- The console shows the settings but cannot change them: a lobby server's code can run in
  the game page ([fingerprinting](../research/fingerprinting.md) §9), and it must not be
  able to point reports at its own server.
- The body is `{ "schemaVersion": 1, "reports": [...] }`, at most 50 reports at a time.
  Any 2xx answer removes them from the queue; anything else keeps them. The call times out
  after 10 seconds.

## Hidden in an edition
By default the feature is shown: it has its console command and writes log lines. Only an
edition file can hide it ([editions](../operations/editions.md#diagnostics-settings)). No
setting, flag, environment variable or console command can. Hidden, it still captures, and
sends if a server is set, but:
- the `diagnostics` command and its help are left out of the console bundle;
- it writes no log lines, also not its requests at `--log-level=debug`;
- `features` and `--features` do not list it.

Nothing then tells a player that reports leave their machine. An edition that is hidden
and also sets a `host` should say so to its players somewhere else, such as in its release
notes or privacy text.
