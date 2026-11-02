import { stringOf } from '#kernel/text/text-of.ts';

export const TEXT = Object.freeze({
  mapNow: (name: unknown, id: unknown, localMap: string) => `Map: ${stringOf(name)} (${stringOf(id)})${localMap ? `; local map ${localMap} is held` : ''}`,
  mapLocalUsage: 'usage: server map local <name>   (a file in data/maps; "maps" lists them)',
  mapSent: (line: string, dropped: string) => `Sent "${line}"${dropped ? ` (local map ${dropped} no longer held)` : ''}`,
  subcommand: {
    usage: 'server map [<map ID> | next | reload | local <name>]',
    desc: 'Change the map: a published one through the lobby server, or one from data/maps sent by this host',
    about: [
      'Without a word: the map now. A map ID, "next" (rotation on) or "reload" goes',
      'through the lobby server, as the match owner\'s "-map" chat command does.',
      '"local <name>" plays data/maps/<name>.xml: this host sends it to every',
      'player, and puts it back over any map the lobby server sends later.',
    ],
    examples: [['server map nanotech-cht', 'a published map'], ['server map local my-arena', 'data/maps/my-arena.xml'], ['server map reload', 'restart the map']] as const,
  },
  ownerLine: (id: string) => `-map ${id}`,
});
