export const SEND_TEXT = Object.freeze({
  usage: 'wire <message> [field=value ...] [--dry] [--raw] [--force]',
  desc: 'Send a protocol message by name, fields in game units',
  about: [
    'Builds and sends one network message from this client (never as another player:',
    'the server stamps the sender). A field left out takes its default: a target is the',
    'character nearest your crosshair ("aim"), a position is yours, a respawn counter is',
    'read from the target. Values are game units (scaled for the wire); prefix one with',
    '"raw:" or pass --raw to send it unscaled. "wire list" lists the messages and "wire',
    'help <message>" lists one message\'s fields. --dry prints what it would send and',
    'sends nothing.',
  ],
  args: [
    ['<message>', 'the message name, any case, "reliable_" optional, a unique prefix works'],
    ['field=value', 'set a field; a target can be #n, a nickname, me, a list, @alpha/@players/@bots, aim, near, near:3, area, area:300 (aim, near and area measure from your crosshair)'],
    ['--dry', 'print the resolved parts and send nothing'],
    ['--raw', 'send every number unscaled (wire values)'],
    ['--force', 'required for messages that re-log the connection'],
  ],
  examples: [
    ['wire heal_player target=bob power=5', 'heal the player named bob'],
    ['wire var_sync r door_1 1', 'set a map variable for everyone'],
    ['wire join_match 52099', 'join a match by uid'],
    ['wire hit_player --dry', 'show what a hit on the aimed target would send'],
  ],
  see: ['wire list', 'wire help', 'netlog'],
});
