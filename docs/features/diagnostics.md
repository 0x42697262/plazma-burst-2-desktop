# diagnostics

Feature flag `diagnostics` (on by default; all modes). Code: `src/features/diagnostics/`.
Capabilities: `diagnostics.capture`, `diagnostics.show`.

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
`flags` (the features and capabilities that are on) and `error` (`name`, `message`,
`stack`, `source`, `line`, `column`).

Every text is redacted before it is saved (`domain/redact.ts`): password, token, `pb2uid`,
cookie and authorization values, bearer tokens, 32-digit md5 digests (the official site's
`password` cookie is one, and it works as the password), home folders and IP addresses.

## Where
`data/diagnostics/reports.json`, readable only by you, the newest 50.

## Commands
- `diagnostics` or `diagnostics status`: is capture on, how many reports are saved.
- `diagnostics show [<#> | last]`: the list, or one report in full.
- `diagnostics report [<note>]`: save one by hand.
- `diagnostics clear`: delete them.
