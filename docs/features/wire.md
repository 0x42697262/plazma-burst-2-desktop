# wire: send a protocol message by name

Feature flag `wire` (on by default; all modes). Code: `src/features/wire/`.

`wire` builds and sends one network message from the dev console, so you do not have to paste
the `pb` helper and a `js` line ([protocol-crafting.md](../research/protocol-crafting.md)). It
is a thin wrapper over the same `Event` / lobby-request path the game itself uses; it sends only
from your own client, and the match server stamps the sender slot, so it cannot act as another
player ([protocol.md](../research/protocol.md) §4).

## Commands

- `wire <message> [field=value ...] [--dry] [--raw] [--force]` sends a message.
  - The message name is any case, `reliable_` optional, and a unique prefix works (`heal` →
    `HEAL_PLAYER`).
  - A field left out takes its default: a target is the character nearest your crosshair, a
    position is yours, a gun is the one you hold, a respawn counter is read from the target, a
    reply id is filled in.
  - A message that expects an answer is sent the way the game sends one, with a callback, so the
    game puts a real reply id in place of the placeholder; the answer is printed when it
    arrives. That covers lobby requests and the two match requests,
    `damage_players_via_explosion` and `enter_respawn_queue`.
  - Values are game units and are scaled for the wire (power `5` → `500`). Prefix one value
    with `raw:` (`power=raw:500`) or pass `--raw` to send numbers unscaled.
  - `--dry` prints the resolved parts in two columns (what you typed, what goes on the wire)
    and sends nothing.
  - `--force` is required for a message that re-logs the connection (`authenticate`).
- `wire list` lists every message with its direction; the ones the server sends are marked
  `[receive only]` and cannot be sent.
- `wire help <message>` says what the message does, then lists its fields under a header
  (`field`, `type`, `default`, `what to put`, `meaning`). `what to put` is the kind of value the
  field takes, e.g. `a gun index; your held gun` for `source`, `0-3; 0 hurts most` for `limb`,
  or `leave it out` for a field `wire` fills in itself: `type` is `player`, `number`, `text`, `JSON`, `flag`
  or `choice`, with `xN` when you type game units and the wire value is N times larger;
  `default` is what a field you leave out takes, in words (`your x`, `your gun`, `aim`,
  `target's count`, `(automatic)`), or `required` when you must give it. It ends with an example
  line and, for a message relayed to every other client, a note that your own screen will not
  change. When some fields have a value table, a `values:` line names them.
- `wire help <message> <field>` prints that field's row, then its value table: each value the
  field takes and what the game does with it. For example, `wire help hit_player source` shows
  that `-1` is a grenade (also what "your gun" sends when you hold none), `-11` a melee hit and a
  gun index that gun. Tables cover `hit_player` `source`, `limb` and `frame`,
  `damage_players_via_explosion` `source`, `projectile_create` `gun`, `var_sync` `mode`, `chat`
  `destination`, `join_match` `slot`, `kick_user` `allGuests` and
  `my_player_properties_changed` `property`; the values come from
  [protocol.md](../research/protocol.md). A field without a table says what to put instead.

## Why your own screen does not change

A message whose direction ends `every other client` (hit_player, heal_player, var_sync, the
AI syncs, ...) is relayed by the server to everyone except you, and the game's own client
already applied its copy the moment it fired. `wire` only sends, so other players see the hit,
the heal or the effect while your screen stays still. That is the protocol, not a wrong
parameter. Turn on `net_log`, then `netlog show`, to see the message leave and confirm its
fields.

`respawn` and `ressurect` are relayed to every client, you included, but your client applies
only the respawn counter from its own copy; the position and HP are applied by everyone else
(`flash.js:4103-4107`). Sent while dead, the server and the other players see you alive, and
your own screen stays dead until the game respawns you itself.

## What a message can do

Every message is about its sender: the server puts the sender's slot in front
([protocol.md](../research/protocol.md) §4). So `wire` can act on you, or report something
you did to another player, but never act as someone else.

- **Respawning: yourself only.** `respawn` and `ressurect` have no "who" field. The server
  refuses neither: it takes the HP as sent, adds one to your respawn counter and relays it
  (§2, §34). In a `respawn_model: "v2"` match, `respawn` without a grant from
  `enter_respawn_queue` posts "respawns without respawn permission or it has expired" to the
  match chat; `ressurect` skips that check and posts nothing (`flash.js:3830-3849`). That is
  the shipped code, which `src/server/` runs; the official server has not been watched doing
  it.
- **Healing: downed teammates only.** `heal_player` revives a teammate who is down and hurts
  an enemy who is up (`30 × power`); it does nothing to a teammate who is up, however hurt, or
  to an enemy who is down (§6). No message raises another player's HP.
- **One target per message.** A single-target field refuses a list or a selector that matches
  more than one player, and sends nothing. Only `damage_players_via_explosion` carries several
  victims in one message, as the game sends it. For several targets, chain commands with `;`,
  in the console or a bind: `wire heal_player target=blackmask; wire heal_player target=bob`.
- **The weapon defaults to the gun in hand.** With no gun in hand that is `-1`, which the game
  reads as a grenade; give `source=-11` for a melee hit. `wire help hit_player source` lists
  the codes.

## Picking a target

Any field that picks a player (a victim, a target, a bot) takes:

- `#3`, a nickname like `bob`, or `me`;
- a list, `bob,#4`;
- a filter, `@alpha` (a team by name or the start of it), `@players`, `@bots`;
- `all`;
- `ally` or `enemy` (also `allies`, `enemies`): everyone on your team, or not on it, other than
  you. Alone on a single-target field it means the ally (or enemy) nearest your crosshair; follow
  it with a rule to pick differently: `ally:near`, `enemy:near:3`, `enemy:area:300`. `@alpha`,
  `@players` and `@bots` work the same way;
- a rule, all measured from your crosshair: `aim` (the closest, within `wire_radius`),
  `near` or `near:3` (the closest, or the closest 3, at any distance), `area` or `area:300`
  (everyone within that many pixels).

Left out, a single target defaults to `aim`, except `heal_player`, whose target defaults to
`ally` (the ally nearest your crosshair); and a multi-target field (the explosion victims) to
`area`. `aim`, `near` and `area` never pick you; name yourself with `me` (`area,me`). An auth-id
field (`report_user`, `endordse_user`, `kick_user`, `ban_user`) takes the same selectors, or a
plain auth id; outside a level only the plain auth id works, since there are no characters to
pick from. Every send prints who it picked; if nothing is in range it is an error that names the
closest, and nothing is sent.

- `wire_radius` (aliases `wireradius`, `aim_radius`; default 150) is how far `aim` and `area`
  reach, in pixels.

## Flags and capabilities

Feature `wire`, with capabilities so an edition can drop parts: `wire.send` (the command),
`wire.list`, `wire.help`, `wire.lobby` (client→lobby messages), `wire.match` (match messages).
`PB2_FEATURES=-wire` removes the command; `PB2_FEATURES=-wire.match` keeps lobby requests and
refuses match messages.

## Examples

```
wire heal_player target=bob power=5
wire hit_player --dry
wire var_sync r door_1 1
wire join_match 52099
wire list
wire help hit_player
wire help hit_player source
wire ressurect
```
