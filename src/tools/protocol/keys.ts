export const GAME_FILES = Object.freeze({
  actions: 'scripts/actions.js',
  connection: 'scripts/connection.js',
  escMenu: 'scripts/screens/EscMenu.js',
  flash: 'scripts/libs/flash.js',
  frame18: 'scripts/frame18.js',
  frame2: 'scripts/frame2.js',
  gameScene: 'scripts/screens/GameScene.js',
  hud: 'scripts/screens/HUD.js',
  mpCreateMatch: 'scripts/screens/MPCreateMatch.js',
  mpLobby: 'scripts/screens/MPLobby.js',
});

export const SCANNED_FILES: readonly string[] = Object.freeze(Object.values(GAME_FILES));

export const OPCODE_ASSIGNMENT = /"(RELIABLE_[A-Z_]+)"\]=\$сеMlO\(\)/;
export const DISPATCH_USE = /type===\$ММ\["(RELIABLE_[A-Z_]+)"\]/;
export const CONTEXT_CHARS = 110;
export const LINE_SPLIT = '\n';
export const LINE_JOIN = '\n';
export const SENDER_SEPARATOR = ' ';
export const FLASH_SUFFIX = 'libs/flash.js';
export const GAME_FOLDER = 'the game folder';
export const TABLE_HEADER = '| Op | Message | Opcode line | First dispatch line | Sent from |\n|---|---|---|---|---|';
export const NOT_DISPATCHED = '-';
export const NO_SENDERS = '-';

export const TEXT = Object.freeze({
  title: '# Messages: opcode, dispatch and send sites',
  generated: (version: string) => `Generated from the game files by \`npm run protocol\`; build ${version}. Do not edit by hand.`,
  note: [
    'One row per reliable message. "Opcode line" is where the opcode is assigned in load order,',
    '"first dispatch line" is the first place the receiving side compares against it, and "sent',
    'from" lists the other scripts that put it on the wire. Parts belong in',
    '[protocol.md](protocol.md), where they are read one by one.',
  ].join('\n'),
  usage: [
    'usage: npm run protocol [-- <gameDir>]',
    '',
    'Prints every reliable message with its opcode, its dispatch line and every script that',
    'sends it. Writes Markdown to stdout.',
  ],
  noGame: (dir: string) => `no game in ${dir} (run "npm run fetch-game")`,
  row: (index: number, name: string, opcodeLine: number, dispatchLine: number | null, senders: string) => `| ${index} | \`${name}\` | ${opcodeLine} | ${dispatchLine ?? NOT_DISPATCHED} | ${senders} |`,
  sender: (file: string, line: number) => `\`${file}:${line}\``,
});
