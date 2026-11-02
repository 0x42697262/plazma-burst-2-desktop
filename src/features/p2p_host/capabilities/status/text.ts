import { stringOf } from '#kernel/text/text-of.ts';

export const TEXT = Object.freeze({
  statusHead: (phase: string, seconds: number, restartIn: number | null) =>
    `Host: ${phase} for ${seconds} s${restartIn !== null ? `, starting again in ${restartIn} s` : ''}`,
  statusLast: (last: string) => `  last: ${last}`,
  statusMatch: (title: string, gameType: string, maxPlayers: number, hasPassword: boolean) =>
    `  match:    "${title || '(Game by <you>)'}", ${gameType}, ${maxPlayers} players, password ${hasPassword ? 'set' : 'none'}`,
  statusMapLive: (name: unknown, id: unknown, localMap: string) =>
    `  map:      ${stringOf(name || '?')} (${stringOf(id || '?')})${localMap ? `, local map ${localMap} held` : ''}`,
  statusMapPlanned: (id: string, localMap: string) => `  map:      ${id}${localMap ? `, then local map ${localMap}` : ''}`,
  statusRegion: (region: string) => `  region:   ${region || '(this computer\'s time zone)'}`,
  statusAllow: (allow: readonly string[]) => `  allow:    ${allow.length ? allow.join(', ') : 'anyone who can join'}`,
  statusHost: (hostPlays: boolean, fps: number, ports: { min: number; max: number } | null, iceServers: number) =>
    `  host:     ${hostPlays ? 'plays' : 'spectates'}, ${fps} fps${ports ? `, UDP ports ${ports.min}-${ports.max}` : ''}${iceServers ? `, ${iceServers} extra ICE server(s)` : ''}`,
  unknownSubcommand: (word: string | undefined) => `unknown "server ${stringOf(word)}". Type "help server".`,
  subcommand: { usage: 'server status', desc: 'What the host is doing, the match settings and who is in it' },
  server: Object.freeze({
    usage: 'server',
    desc: 'The dedicated host: its match, players and match owner commands',
    about: [
      'This window hosts one player-hosted match, set up from data/p2p-host.json.',
      'Players find it in the game\'s match browser and play over WebRTC with this',
      'host; the lobby server lists it and passes their connections along.',
      'Commands that change the match are the match owner\'s own chat commands, sent',
      'by this host. Every other console command works here too.',
    ],
    examples: [
      ['server status', 'what it is doing'],
    ] as const,
    notes: ['Type "quit" (or Ctrl+C) to end the match and close the host.'],
  }),
});
