# Reputation probe: copy sheet

The lines from [reputation.md](reputation.md#probing-the-live-lobby), kept separate so they
can be copied one at a time into the dev console. Own accounts only: the lobby's own server,
two accounts you control, and stop at the first reply that is not the endorsement text.

What the lines do, in game terms: `RELIABLE_ENDORDSE_USER` carries the target's auth id and
nothing else (`libs/flash.js:2851-2882`), so the only thing these lines vary is the target and
an ignored fourth part. Every check the lobby makes — self, existence, the module — stays in
place.

## 1. The target, once

Set it here and every later line picks it up. The auth id is the `auth_id` inside a
`FIRST_SYNC_RESPONSE` line of the match, or the middle value of an `ENDORDSE_USER` line in
`netlog show`.

```
js globalThis.T="322947"
```

## 2. Preflight

Four pieces must be there before anything is sent.

```
js JSON.stringify((()=>{const N=PB2_NAMES,M=(0,eval)(N.net),c=M[N.lobbyConn];return {build:N.version,net:typeof M,connected:!!c,channel:!!M[N.netChannel],placeholder:typeof M[N.netReplyTo]}})())
```

Expect `{"build":"v1769098419","net":"function","connected":true,"channel":true,"placeholder":"object"}`.
`connected:false` means no lobby connection: log in first.

`(0,eval)` is load-bearing. The network object is `class $ММ`, at the top of
`scripts/libs/flash.js:5`; a top-level class is a global binding, not a property of
`globalThis`, so `globalThis[PB2_NAMES.net]` is `undefined`.

## 3. One round, one paste

Does the whole sequence in the order that leaves the target as it started: three sends —
plain, with a fourth part, plain — so from *endorsed* it ends *neutral*, and the middle reply
is the one to compare with the first and last.

```
js globalThis.probe2=[];(()=>{const N=PB2_NAMES,M=(0,eval)(N.net),c=M[N.lobbyConn],T="322947";const send=(extra)=>new Promise(d=>{const p=[M.RELIABLE_ENDORDSE_USER,T,M[N.netReplyTo]];if(extra!==undefined)p.push(extra);c[N.netSend](M[N.netChannel],p,r=>{probe2.push(Array.from(r));d()})});(async()=>{await send();await send("11");await send();console.log("PROBE "+JSON.stringify(probe2))})()})()
```

## 4. Read them

```
js JSON.stringify(probe2)
```

Wait about two seconds first: each reply is one round trip (about 250 ms). What the live
lobby actually answers, observed with two accounts, is in
[Observed so far](#observed-so-far).

## 5. One send with a fourth part, on its own

Step 3 already sends one of these in the middle. This is the same send alone, for when the
fourth part is the only thing being checked. Two plain sends on either side keep the target
where it was, because the answers alternate (see
[Observed so far](#observed-so-far)).

```
js globalThis.one=[];(()=>{const N=PB2_NAMES,M=(0,eval)(N.net),c=M[N.lobbyConn];c[N.netSend](M[N.netChannel],[M.RELIABLE_ENDORDSE_USER,T,M[N.netReplyTo],"11"],r=>{one.push(Array.from(r))})})()
```

```
js JSON.stringify(one)
```

It must be indistinguishable from one plain send: same reply text, same effect on the
target's numbers.

## 6. Self, from the target account

One line, with the account's own id in `T` (its `auth_id` from `accounts` or from the match's
`FIRST_SYNC_RESPONSE`), then the read. Nothing changes anywhere: the lobby answers before the
account module is called (`libs/flash.js:2865-2871`).

```
js globalThis.one=[];(()=>{const N=PB2_NAMES,M=(0,eval)(N.net),c=M[N.lobbyConn],T="322951";c[N.netSend](M[N.netChannel],[M.RELIABLE_ENDORDSE_USER,T,M[N.netReplyTo]],r=>{one.push(Array.from(r))})})()
```

```
js JSON.stringify(one)
```

Expect `["Error: Can't do this to yourself"]`. A block that names `T` without declaring it
reads the global from step 1; one that declares `const T=…` keeps it local, which is why a
later block can fail with `T is not defined`.

## What each reply means

| Reply | Meaning |
|---|---|
| `Server: <nickname> is endorsed for N month` | accepted; N is what the module granted |
| `Error: Can't do this to yourself` | that id is the sender's own |
| `Error: Target user wasn't online for too long` | no live session with that id; nothing logged, nothing changed (`:2855`, `:2920-2923`) |
| `Server: …` anything else | the module's refusal, in its own words |

None of these lines reveals a delta's size; that is the module's, and it is not shipped. The
only view of what it stored is the lobby's Relations screen (`Since`, `Until`, `Active`,
`Reputation delta`).

## Observed so far

Not derivable from `game/`: these come from replies on the live lobby, two accounts,
2026-11-15, build v1769098419.

- **An endorsement to an account that is already endorsed removes it.** Five sends to one
target alternated `Server: Relationship with X was reset to neutral (default)` and
`Server: X is endorsed for 1 month`, so the fifth send put the account back at neutral. Two
endorsements cannot stand at once, and an even number of sends is a no-op.
- **The reply names a term, not a number:** “endorsed for **1** month”. So an endorsement is a
relation held for a month, which matches the `Until` column of the Relations screen.
- **Nothing is throttled:** five sends in a row, about 250 ms apart, were all answered.
- **A fourth part is ignored.** A round of plain, then the same message with an extra `"11"`,
  then plain answered `reset to neutral`, `is endorsed for 1 month`, `reset to neutral` — the
  middle reply is exactly what a plain send gives from neutral, so the extra part reaches no
  reader and the round leaves the target where it was.
- **The toggle is a useful tool:** an odd number of sends flips the relation, an even number
  leaves it, which is how a round can be tested without changing anyone's standing.
- **Self refusal is free.** A send to the logged-in account's own id answers
  `Error: Can't do this to yourself` and changes nothing, which also verifies that an id
  belongs to that account (`libs/flash.js:2865-2871`).
- **An auth id is per join, not per account.** The same account was `322975` in one
  `accounts` listing and `322978` after spectating and joining again, and every id seen so far
  sits in one rising band (322947 … 322978). So a stored id goes stale on the next join, and a
  target has to be read from `accounts` in the same join it is used.

Still unobserved: the ignored fourth part, the self refusal, a report (the opposite direction
of the same two calls), and what a reset does to the target's `reputation` number.
