# The state message

The unreliable half of the protocol: the message each client sends about its own player on
every network tick, and the one the match server sends back with everyone else's. It carries
what changes all the time: position, velocity, HP, the cursor, the keys held, the ragdoll and
the projectiles in flight. Everything else travels in the reliable messages of
[protocol.md](protocol.md).

Line numbers are the decoded ones (`npm run find-names -- --decode <file>`): `flash.js` is
`game/scripts/libs/flash.js`, `frame2.js` and `connection.js` are in `game/scripts/`. Checked
against build v1769098419.

| | |
|---|---|
| Built by the client | `$ТеeАp`, `flash.js:421-783`, for the local player |
| Built by the match server | the same function, `flash.js:790-847`, once per client |
| Handled | `$pOeрМ`, `flash.js:869`: the server branch to `:1199`, the client branch from `:1200` |
| Slot on the connection | the unreliable message, channel `$ММ.$ОAA0р` = 0 (`flash.js:74`) |
| Cadence | every network tick: 16 ms on a socket, 4 ms peer to peer (`connection.js:19-20`, `:1059`) |

## Unreliable, newest only

A connection holds one unreliable message. Each new one replaces the last one
(`connection.js:720-722`), and the packet carries whatever is there when it leaves
(`connection.js:1099-1100`). A lost state is never resent: the next one, a tick later,
replaces it. On the receiving side the connection also keeps only the newest
(`connection.js:763`), and handles it once per tick after every reliable message of the same
packet (`connection.js:982`). So a `RESPAWN` and a state that arrive together are applied in
that order.

Numbers go through the game's encoder `$Oоolр` (`flash.js:5249-5261`): clamped to the safe
integer range, rounded to a whole number, and written in base-N digits. With its second
argument set, 0 is written as `""`. Parts are joined with `\x02`, as in a reliable message.

## Client → server: your own player

The client builds it only for a local character that is in play, never while spectating
(`flash.js:436-439`), and only after `CLIENT_READY_FOR_FIRST_SYNC` (`frame2.js:14374`).

| Part | Value | Built at |
|---|---|---|
| 0 | body control × 100 (`$eoОpА`); `""` at 100, standing | `flash.js:448`, `:452` |
| 1, 2 | `x`, `y`: position | `:453-454` |
| 3, 4 | `tox`, `toy`: velocity × 5 (`$ММ.$MеМMА`, `:178`), `""` for 0 | `:455-456` |
| 5 | the ragdoll, only when part 0 is under 100 | `:460-478` |
| 6 | HP, `Math.ceil(hea)` | `:480` |
| 7, 8 | the cursor: `tarx - x`, `tary - y` | `:482-483` |
| 9 | packed flags: guns not ready, fire, the movement keys | `:486-527` |
| 10 | the held gun's animation frame (`$OАMco`), `""` with no gun | `:529` |
| 11 | the vehicle's index (`$ОMррe`), `""` on foot | `:530` |
| 12-15 | body part HP, rounded up: head `$ААНММ`, body `$НТcep`, arms `$lMIсo`, legs `$HAрH1` | `:532-535` |
| 16 | alive: crouch, `sit × 35`, `""` standing; dead: the last damage source (`$1МI0р`) | `:537-540` |
| 17 | two flags as one character: `"3"`, `"2"`, `"1"` or `""` | `:542-555` |
| 18 | your projectiles in flight, 7 values each, joined with `~` | `:558-591` |
| 19 | the client clock: `performance.now()` minus the page's start | `:593` |
| 20 | your respawn count | `:595` |

The part numbers the code names are constants at `flash.js:178-186`: 1, 2, 6, 7, 8, 12, 13, 16,
19 and 20.

**Part 0, body control.** 1 is a character standing on its own; lower values let the ragdoll
take over. X held (`frame2.js:27402-27403`) lowers it (`:37382-37390`), and dying sets it to −2
(`:35391`). The receiver divides by 100, and `""` means 1 (`flash.js:1378`).

**Part 5, the ragdoll.** Only sent when part 0 is under 100. 8 body segments, or 10 when the body
HP is 0 or less (`flash.js:462`). For each: x and y relative to the player, and velocity relative
to the player's, × 5 (`:470-473`). The receiver writes them onto its copy of the body
(`:1387-1413`). When body control is above 0.5 it then keeps each segment inside a box of
−80…80 × scale across and −100…40 × scale up and down around the player (`:1415-1439`).

**Part 6, HP.** The server reads it for its own checks and blanks it before passing the state on
(`flash.js:1119`). The other players get the server's HP instead (below).

**Parts 7 and 8, the cursor.** See [The cursor](#the-cursor).

**Part 9, the flags.** One packed string (`$IooорO.$oеМ0рe`). In order (`flash.js:487-524`):
- one per gun slot, `slot0` to `slot9`: the gun in it is not ready (its `ready` is false);
- fire held (`$рoeсl`);
- right held (`$AМIМ1 === 1`, D or →), left held (`−1`, A or ←; keys at `frame2.js:27189-27192`);
- crouch held (`$TНесe === 1`, S or ↓), jump held (`−1`, W, ↑ or Space; keys at `:27214-27215`,
  `:27396-27397`).

The receiver clears the movement keys first and sets those that are on (`flash.js:1489-1554`),
so the character on its screen moves with the same keys held. For a gun slot it plays the gun's
reload frames when the flag changes, except for the gun in hand (`:1503-1533`).

**Part 10, the gun frame.** The frame of the gun in hand's animation, not an id. A receiver more
than 10 frames off jumps to it (`flash.js:1560-1580`); at frame 2 or less the gun becomes ready.

**Part 11, the vehicle.** On a change the receiver takes the player out of the old vehicle and
puts them in the new one (`flash.js:1441-1451`).

**Parts 12-15, body parts.** Written onto the receiver's copy (`flash.js:1626-1629`). A value that
rises is taken only in some states (`:1597-1599`), and one that rises from 0 restores the part
(`:1601-1612`). One that falls to 0 plays the hurt reaction (`:1615`, `:1631-1632`).

**Part 16, crouch or cause of death.** While HP is above 0 it is the crouch amount × 35; the
receiver divides by 35 (`flash.js:1642`). At 0 HP it is the last damage source: a gun's index or
a negative code such as −15 for a wall (`frame2.js:4788-4795`). Each hit writes it (for example
`frame2.js:30804`, `:32502`). The server takes it as the cause of a death it learns from the state
(`flash.js:1080-1083`), and `PLAYER_DIES` reports it ([protocol.md](protocol.md#12--player_dies--match-server--every-client)).

**Part 17, two flags.** `"3"` both, `"2"` the first only, `"1"` the second only, `""` neither:
- the first is `$ОeНIpo`, X held (`frame2.js:37376`), which lets the body go limp;
- the second is `$loАoM`. It is set when the character dies (`frame2.js:35390`) or its body
  breaks at 0 body HP, which also kills it (`:16452-16527`). Set through `$Нес1p`, it plays a voice
  line from the character's voice set (`:16656-16692`). The code holds no name for it.

**Part 18, projectiles.** Up to 16 (`$ММ.$0ТoНHp`, `flash.js:252`) of your own visible
projectiles that carry a network id (`:558-591`). For each: its id, x, y, speed x and y × 5,
rotation, and `$МecHM × 10`. A projectile tied to a physics node sends that node's position and
speed instead. The receiver finds the projectile by owner and id and moves it there
(`:1656-1711`). This is how a thrown grenade moves on other screens after its
`PROJECTILE_CREATE`.

**Part 19, the clock.** The server compares it with its own clock and disconnects a client whose
clock runs too fast ([anticheat.md](anticheat.md) §14.7).

**Part 20, the respawn count.** It must equal the server's count, or the server ignores the state
(below).

## On the server

`$pOeрМ`, server branch (`flash.js:884-1199`), for a player in a match who has sent
`CLIENT_READY_FOR_FIRST_SYNC`:

1. **A spectator's state is dropped** (`flash.js:891`).
2. **The respawn count gates everything** (`:897`). A count that is not the server's is counted,
   and after enough of them the match is told "Respawn counter desync happens for …"
   (`:899-911`). Nothing else happens with that state.
3. **With the right count** (`:912`) the server runs its checks on HP and the cursor, stores the
   HP and handles a death or a revival ([anticheat.md](anticheat.md) §14.4-§14.6). It then blanks
   part 6 (`:1119`), notes whether the player moved more than 10 units (the inactivity timer,
   `:1121-1131`), and runs the clock check (`:1134-1189`).
4. **It keeps the parts** as the player's latest state (`$OeeНl`, `:1192`) and empties the list
   of who has received it (`:1193`).

The server does not change any other part. Position, velocity, cursor, flags and projectiles reach
the others as the player wrote them.

## Server → client: everyone else

Each tick the match server builds one state per client (`flash.js:794-847`). The lobby does this
only for a match it hosts (`:803`); in a player-hosted match the host's app runs the same code
for its guests.

```
<header>, then for each player: <slot>, <HP>, <ping~skill~reputation>, <count>, <count parts>
```

**The header** (`flash.js:817`) is the time until the round state next changes, in ms, or `""`
when nothing is pending. In front of it:
- `~~`: you are not shown the others. In a ranked match this is a spectator who is not staff, or
  a player who has been dead for more than 3 s (`$0Melеo`, `:5426-5454`, `$ММ.$еAТМрА = 3000`,
  `:16`). No player groups follow, and the client covers the view (`:1213-1235`).
- `~`: the match is paused (`$оАНеAT`, a ping pause, or `$се1ссo`, `-pause`, `:815`). The
  client stops its game loop (`system_non_stop = false`, `:1238-1247`).

**One group per player** in a slot (`flash.js:819-845`):

| Value | Meaning |
|---|---|
| slot | the player's slot |
| HP | the server's copy of the player's HP |
| `ping~skill~reputation` | the server's numbers, skill × 100 |
| count | how many parts follow: the length of that player's kept state, or 0 |
| parts | that player's kept state, as they sent it, part 6 blank |

A group is sent to each client once per new state: the set `$рO0IНI` records who has had it
(`:827-829`). Your own group, and a player who has not sent a state the server kept, carry
count 0 (`:838-845`).

## On the receiver

For each group (`flash.js:1274-1718`):

1. **Ping, skill and reputation** are copied onto the player (`flash.js:1295-1297`).
2. **HP comes from the server**, not from the sender (`:1339-1372`), except for your own slot
   while you play. A drop of more than 10 plays the hurt reaction (`:1350-1352`).
3. **With parts** (`:1376`), the rest is written onto the receiver's copy of that player: body
   control, position, velocity, ragdoll, vehicle, cursor, flags, gun frame, body parts, crouch, the
   two part 17 flags and the projectiles, as described part by part above.

The receiver does not check any part against the map or the sender's last state. Between two
states it runs that player on its own with the keys from part 9.

## The cursor

No reliable message carries where a player points. The cursor is parts 7 and 8: the aim point
minus the player's position.

| | |
|---|---|
| Read from the mouse | `frame2.js:38330-38333`, every frame, into `$еT0рTр`, `$оTО10T` (stage pixels) |
| Turned into the aim point | `frame2.js:33879-33880`, for the local player; `:34956-34957` in `bot 1` mode |
| Sent | `flash.js:482-483`, parts 7 and 8 (`$ММ.$OlОplр` = 7, `$ММ.$рI1lрA` = 8, `:182-183`) |
| Read by the server | `flash.js:952-953`, the zoom check only |
| Applied by every receiver | `flash.js:1486-1487` |
| Used | `frame2.js:36379`, `:36383`, the gun's angle |

### From the mouse to the aim point

1. **The mouse.** Each frame the game copies `mouseX` and `mouseY` into two globals, unless both
   are 0 (`frame2.js:38330-38333`). They are stage pixels, 800 × 400.
2. **The aim point.** For the local player, when not spectating (`frame2.js:33845-33847`):

   ```
   tarx = (mouseX - game.x) / zoom
   tary = (mouseY - game.y) / zoom
   ```

   `game.x`, `game.y` are the camera offset, and `zoom` is `$оМMОО`. The `gamescale` engine mark,
   some vehicles and the `zoom 25` … `zoom 200` chat commands change it (`frame2.js:12024-12033`,
   `:14760-14765`, `:26756-26768`). A wider view lets the cursor reach farther.
3. **No limit in normal play.** Only in `bot 1` mode (the chat command that lets the AI play the
   local player, `$OM0TM`, `frame2.js:26833-26847`) does a multiplayer match clamp the aim to
   ±800 by ±400 around the player (`:34983-34984`). The normal path at `:33879` has no clamp.

### On the wire

Part 7 is how far right of the player the cursor is, part 8 how far below (y grows downwards),
in whole world units. They are relative: a player standing still with a still mouse sends the
same two numbers every tick, and a player who moves with the mouse still sends different ones.
Only the newest goes out, and a lost one is not resent.

### On the server

- **The zoom check** is the only code that reads parts 7 and 8 (`flash.js:946-990`). It runs while
  the player reports HP above 0, on an approved map, while a round is played. It counts samples
  where the aim changed and `dx > 1000` or `dy > 600`. After more than 25 net samples it tells
  the other players "aims outside of their view area". The comparison has no `Math.abs`, so
  aiming far left or up never counts ([anticheat.md](anticheat.md) §14.6).
- **Passed on unchanged**, with the rest of the kept state. While the respawn count is wrong
  nothing new is kept, and the others keep seeing the last aim that was accepted.

### On the receiver

After the position from parts 1 and 2 (`flash.js:1379-1380`), the receiver sets the aim point
(`:1486-1487`):

```
tarx = x + part 7
tary = y + part 8
```

The receiver adds the offset to the position from the same state, so the aim lands where the
sender saw it relative to the player. The sender's zoom and camera do not matter, and the receiver
never checks the size of the offset.

### What the aim point does

- **The gun's angle.** Every character's arm points from its arm segment to `tarx`, `tary`
  (`frame2.js:36379`, `:36383`). For another player's character the receiver adds a small offset
  first, kept per character and reset when it would put the point inside the arm
  (`:36370-36378`). So the others see the gun turn where the cursor is.
- **Shots are not aimed by it.** A shot from another player is created from the angle in
  `PROJECTILE_CREATE`, and hits come in `HIT_PLAYER`. A late or lost state moves the arm, never a
  shot.
- **Bots.** A bot's aim point travels whole, not as an offset, in `AI_STATE_SYNC` parts 7 and 8
  (`flash.js:4749`).

### Situations

- **Lag.** The aim arrives one trip through the server late, with the position of the same state,
  so the arm points the right way relative to the body and lags with it.
- **Wide views.** A map that zooms out, or a client with a zoom command, sends offsets beyond what
  a normal view allows. Only offsets to the right or below can trip the zoom check.
- **Old netcode.** The older `;ss|<slot>#<tarx>#<tary>` event (`frame2.js:33889`, `:34988`) is
  written into `MP_custom_events`, which in this build is a property that always reads `""` and
  only logs what is written (`frame2.js:4086`). It never reaches the wire.

## Watching it

`net_log_state on`, then `netlog show`: each `STATE` line labels the known parts, for example
`hp 150 | respawns 1 | aim +212,-40 | pos 1264,-520` ([netlog](../features/netlog.md)).

## For the local server's maintainer

`src/server/` runs this code from the decoded `flash.js`. A player who stops moving on everyone
else's screen is usually one whose respawn count the server does not accept: look for "Respawn
counter desync" in chat. To see one player's cursor or keys on the server, read parts 7-9 of that
player's kept state.
