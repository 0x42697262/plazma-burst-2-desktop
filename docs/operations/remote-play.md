# Remote play

Let other people play your copy of the game (with the dev console) **from their own
browser**, while everything runs on your machine. They get a video of their own game
and send their keys and mouse back. No file of this project ever reaches them.

```
tester's browser  ── keys, mouse ──▶  npm run host (your machine)  ──▶  their own game window (hidden)
                  ◀── JPEG frames ──
```

## Quick start (5 minutes)

1. Add a tester. It prints their personal link:
   ```
   npm run testers -- add alice
   ```
2. Start the host:
   ```
   npm run host
   ```
3. Try it yourself: open `http://localhost:8787/#t=<alice's token>` and click **Click to play**.
4. For people on the internet, put a tunnel in front (below) and send them
   `https://<tunnel address>/#t=<token>`.

Each tester gets **their own game**: own saves, own console settings, own level. Several
can play at once (`--max`, default 4).

## Testers

| Command | What |
|---|---|
| `npm run testers -- add <name>` | New tester, or a new link for an existing one (the old link stops working) |
| `npm run testers -- remove <name>` | Their link stops working |
| `npm run testers -- list` | Who has a link |

- Links are stored in `desktop/remote-testers.json` (not in git, readable only by you).
  The host reads it on every connect, so no restart is needed.
- The token sits after `#` in the link, so browsers never send it in a URL and tunnels
  don't log it. The page sends it once, over the WebSocket.
- Anyone who has a link can play as that tester. Send links privately.
- 10 wrong links from one address within a minute: that address is refused for a minute,
  and the terminal shows `[remote] wrong link from <address>`. Through a tunnel on this
  machine, the tunnel's forwarded address counts.

## Reaching testers on the internet

The host listens on `127.0.0.1` only (this machine) unless told otherwise. Recommended: a
tunnel, so no router ports are opened and testers get HTTPS.

| Way | Command |
|---|---|
| Cloudflare quick tunnel (no account) | `cloudflared tunnel --url http://localhost:8787` → prints `https://<random>.trycloudflare.com` |
| Tailscale Funnel | `tailscale funnel 8787` |
| Your own network, no tunnel | `npm run host -- --public` (listens on every interface, plain HTTP) |

## Options

`npm run host -- --port=9000 --max=6 ...`

| Option | Default | What |
|---|---|---|
| `--port=N` | `8787` | Port of the page and the WebSocket |
| `--public` | off | Listen on every network interface instead of `127.0.0.1` |
| `--bind=ADDR` | `127.0.0.1` | Listen on one address |
| `--max=N` | `4` | Games at the same time. A tester beyond that sees "The host is full" |
| `--fps=N` | `30` | Frames per second sent to each tester (1–60) |
| `--quality=N` | `60` | JPEG quality (10–100) |
| `--size=WxH` | `960x540` | Game window size, and frame size |

**Cost per tester:** one game instance (roughly the memory and CPU of the normal app),
plus upload bandwidth. A frame is about 10–70 KB (a full console screen measured 65 KB),
so at 30 fps expect roughly **3–15 Mbit/s of upload per tester**. On a slow upload, use
`--fps=20 --quality=45 --size=800x450`. Frames are skipped automatically when a
tester's connection falls behind, so the game doesn't lag.

## What testers can and cannot do

**Can:** play, use every menu, play online matches, and use the dev console.

**Cannot:**
- **Get any file:** the server answers only `/`, `/client.js` and `/client.css`, and
  everything else is a 404. They receive pixels, never game or project code.
- **Run code:** the console's `js` command doesn't exist in their game, and there are no DevTools.
- **See your hooks:** the `hooks` command doesn't exist in their game.
- **Risk your account:** they play logged in as you, so `bypass checks` (turning off the console's ranked match protection, [docs/research/anticheat.md §14.8](../research/anticheat.md#148-summary-for-players)) doesn't exist in their game.
- **See other network logs:** their game writes `netlogs/<date>_<time>_tester-<name>.log` on your machine, and their `netlog` shows only that one: no `netlog runs`, no `run:` ([README.md §7](../../README.md#7-network-log)).
- **Read paths, file names or game internals:** everything the console prints is
  scrubbed of host paths, file names, and the game's obfuscated names (shown as `‹hidden›`).
  Explanations of how the anti-cheat works are left out.
- **Leave the game:** the window only ever loads the game's start page (never a file served
  next to it), with no new windows, no downloads, and every permission refused (camera,
  clipboard, ...).
- **Touch your clipboard:** paste is blocked, so they can't read it. Copy and cut are blocked
  too, so they can't put text in it for you to paste later.
- **Disturb others:** each game is its own session (cookies, saves, console settings in
  `desktop/remote-data/<name>/`). The machine plays no sound from their games.

**Can affect your machine, within limits:**
- Their screenshot key (F12) saves to your `screenshots/`, at most one every 2 seconds per tester.
- A broken or oversized message only drops that tester's connection, never the host.

**What they share with you:**
- Your **PB2 login** (`desktop/credentials.json`): online they play as your account.
- Map files (`desktop/maps/`): maps they save land there.
- Screenshots they take land in `screenshots/`.

## Sessions

- A game starts when a tester connects, and stays **2 minutes** after they leave, so a
  reload or a dropped connection continues the same game.
- Opening the same link in a second tab takes the game over; the first tab is told so.
- Keys still held when a tester leaves are released.
- The terminal shows `[remote] <name>: game started / connected / disconnected / game
  closed`, and each game's page output as `[page <name>:...]`.

## Files

| File | What |
|---|---|
| `src/features/remote_play/services/host.ts` | The server: client page, WebSocket, one game per tester |
| `src/features/remote_play/domain/input.ts` | Browser keys and mouse → the game window's input events (paste dropped) |
| `src/features/remote_play/adapters/lockdown.ts`, `domain/blocked-keys.ts`, `domain/game-page.ts` | What a tester's game window may not do |
| `src/features/remote_play/adapters/testers-file.ts`, `testers.ts` | Tester links (`npm run testers`) |
| `src/features/remote_play/client/` | The page testers open, built to `dist/remote-client/` (the only files they receive) |
| `src/features/remote_play/domain/redactor.ts`, `src/console/kernel/core/mode.ts` | The console's remote mode (no `js` or `hooks`, hidden paths and names) |
| `src/wrapper/platform/remote-games.ts` | `--host` mode: makes each tester's offscreen game window and session |

Tests: `src/features/remote_play/*.test.*` (`npm test`). The feature is described in
[remote-play](../features/remote-play.md).

## Limits

- No sound for testers (the host's games are muted).
- Video is JPEG frames, not a video codec: simple and reliable through any tunnel, but it
  uses more bandwidth than WebRTC would.
- Testers' keyboard shortcuts their browser keeps for itself (Ctrl+W, Ctrl+T, F11, ...)
  never reach the game.
- The game window has a fixed size (`--size`); the page scales it to the tester's window.
