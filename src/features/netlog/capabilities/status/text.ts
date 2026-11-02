export const STATUS_TEXT = Object.freeze({
  usage: 'netlog',
  description: 'The network log: messages sent and received, packet losses, ping',
  about: [
    'Every message the game sends and receives on its connections (main server, P2P),',
    'packet losses and once a second each connection\'s ping and traffic. Written as',
    'plain text to data/netlogs/<date>_<time>_<instance>.log: one file per run and game',
    'window, so other instances (another app, remote play testers) have their own.',
    'Alone, "netlog" says whether it records, where, and the losses of each connection.',
    'Passwords in a login or a match are written as ‹redacted›.',
  ],
  examples: [['netlog', 'on or off, the file, each connection\'s ping and losses']],
  notes: [
    'In the file each line is: time, connection, OUT/IN/---, kind (REL, LOSS, STAT, CONN,',
    'STATE, PKT, PAGE), details. A message reads like a call: CHAT("hello", 7): text in',
    'quotes, numbers bare (decoded), #<n> a sequence number. The file header explains it all.',
  ],
  see: ['net_log', 'net_log_state', 'net_log_all'],
  header: (on: boolean) => `Network log: ${on ? 'on' : 'off'} (net_log).`,
  headerSeparator: ' ',
  writeError: (message: string) => `  Not written to a file: ${message}`,
  file: (file: string | null) => `  File: ${file || 'none yet (made with the first line sent)'}`,
  pageLines: (count: number) => `  This page: ${count} line${count === 1 ? '' : 's'}.`,
  noConnections: '  No connections now.',
  offNothing: '  Nothing is recorded while it is off.',
  connection: (id: number, kind: string, connected: boolean, ping: string, outPackets: number, inPackets: number, loss: string, waiting: number, missing: number) => `  c${id} ${kind} ${connected ? 'connected' : 'not connected'}, ping ${ping}, out ${outPackets} packets, in ${inPackets} packets | loss: ${loss}`
    + `${waiting ? ` | ${waiting} waiting for ack` : ''}${missing ? ` | ${missing} missing` : ''}`,
  footer: (hints: readonly string[]) => `${hints.join(', ')}.`,
});
