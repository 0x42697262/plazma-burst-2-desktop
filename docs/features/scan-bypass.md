# scan_bypass: the anti-cheat scan report and turning the protection off

Feature flag `scan_bypass` (on by default; local and server modes, not in remote play).
Code: `src/features/scan_bypass/`.

The ranked-match protection itself is not part of this feature. It stays in the console
(`src/console/kernel/overrides/server-checks.ts`, `src/console/kernel/danger/bypass.ts`) and is always on unless turned off
here. With this flag off there is no `bypass` command, so the protection cannot be
turned off at all.

## The protection

In an approved, ranked match the console holds back what the match's server checks
([anticheat](../research/anticheat.md) §14):
- raising your HP above your normal max (`max_hp`, `hp_bonus`, `hp_bonus_pct`,
  `hp +n`, `game god`, `game grow`): the server reports it as "HealthAltering" (§14.4);
- zooming out: you could aim outside the normal view, which the server announces to the
  other players (§14.6).

Typing them is refused, and a setting you already had is kept but not applied there.
Unranked matches, unapproved maps and single-player are not touched.

## `bypass`

- `bypass` says whether the protection is on.
- `bypass checks` prints a red warning, then waits for the next line typed into the
  console. Exactly `ALLOW DANGEROUS COMMANDS` turns the protection off for this page
  load; any other line turns it down and is not run.
- It must be typed by hand: it is refused from a bind, a profile's `onload` or a `;`
  chain.
- `bypass off`, or a reload, turns the protection back on. Nothing is saved.
- Not in remote play: a tester plays on the host's account and cannot take that risk for
  the host.

## The scan report

The game's anti-tamper scan sends its report as a `RELIABLE_PING` with four parts
(code, detail; §6.2, §7.3), then reloads the page 300 ms later. A frame hook reads the
game's own log of sent messages (the network class's message log, which the send method
fills) and writes the report to the terminal with `console.warn`, decoded:
- code 1: a registered array was replaced;
- code 2: a function changed;
- code 3: a locked array changed, named by its index.

No game function is replaced. In single-player the scan reloads without sending
anything, so there is nothing to log.
