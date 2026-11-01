# lobby_task_guard: no code from a private server's lobby

Feature flag `lobby_task_guard` (on by default; local mode). Code:
`src/features/lobby_task_guard/`. This is security fix 3 from
[fingerprinting](../research/fingerprinting.md) §9.4.

## Why

The game runs whatever a `RELIABLE_TASK` carries: `eval("(" + code + ")(tag)")`
(`scripts/libs/flash.js`, the two task handlers). The only check is that the message came
on the lobby connection. Joining a private server makes that server the lobby, so its
operator could run any code in the page. That page code can reach the wrapper's
`__dev/` routes ([fingerprinting](../research/fingerprinting.md) §9.3).

## What it does

When the page joins a private server (`PB2_JOIN` is set), the console's start hook puts
an argument rewriter on the game connection class's receive method
(`connClass.prototype[connRecv]`, through the kernel's `rewriteArguments`).
- Because it sits on the class, it is in place before the first lobby connection
  exists, so even a task in the server's very first packet is caught.
- In every packet the game receives, each `RELIABLE_TASK` and `RELIABLE_TASK_ASNYC`
  keeps its sequence number and callback ID, but its code becomes `()=>undefined`.
- The game then evaluates only that, gets `undefined`, and sends no reply.
- Everything else in the packet stays exactly as sent: acks, state, other messages.
  So the reliable stream has no gap.
- The console prints once per packet that it replaced a task.

The anti-tamper scan walks only the enumerable properties of `globalThis` and the
network object, and compares each function's source
([anticheat](../research/anticheat.md) §6). A method on a class's prototype is not
walked, and the class's own source text does not change, so the scan sees nothing.

On the official server the guard does nothing; the connection class is left as it is.

## Turning it off

`PB2_FEATURES=-lobby_task_guard` gives back the old behavior, in which a private
server's tasks run. A server built from this repository never sends tasks, so with the
guard on nothing is lost.

If `names.js` has no `connClass` (an old names file), the guard cannot sit on the class.
It then prints an error saying that the server's code would run.
