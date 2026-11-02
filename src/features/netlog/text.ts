import { SHOW_LAST_MAX } from './constants.ts';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const REDACTED = '‹redacted›';
export const TICK_NAME = 'Network log';

export const LINE_TEXT = Object.freeze({
  plural,
  chars: (count: number) => `${count} chars`,
  kiloChars: (kilo: string) => `${kilo}K chars`,
  range: (first: number, last: number) => (first === last ? `#${first}` : `#${first}-#${last}`),
  message: (name: string, args: string) => `${name}(${args})`,
  argumentSeparator: ', ',
  connection: (id: number, kind: string) => `c${id} ${kind}`,
  line: (clock: string, connection: string, direction: string, kind: string, text: string) => `${clock}  ${connection}  ${direction}  ${kind}  ${text}`,
  reliable: (uid: number, text: string, answer: string) => `#${uid} ${text}${answer}`,
  answers: (uid: number, name: string, at: number, id: string, callback: string, took: number) => `  <- answers #${uid} ${name} (its part ${at}, ${id}, was callback ID ${callback}), ${took} ms later`,
  unknown: '?',
  slowAck: (uid: number, name: string, took: number, ping: number, tries: number) => `slow ack: #${uid} ${name} acknowledged after ${took} ms, ping ${ping} ms (sent ${plural(tries, 'time')}): packets or acks were lost on the way`,
  noAck: (uid: number, name: string, waited: number, tries: number) => `no ack: #${uid} ${name} not acknowledged after ${waited} ms (sent ${plural(tries, 'time')}): nothing is getting through`,
  dropped: (reliable: number, hadState: boolean) => `dropped: the socket was busy, socket.io did not send this packet (${plural(reliable, 'reliable message')}, sent again later${hadState ? '; its state update is lost' : ''})`,
  late: (uid: number, took: number) => `late #${uid} arrived ${took} ms after the gap was seen`,
  gap: (uid: number, missing: string, count: number) => `gap: #${uid} arrived before ${missing} (${count} missing: lost or out of order)`,
  ackNone: 'ack none',
  ackAt: (ack: number) => `ack #${ack}`,
  packetState: (parts: number, size: number) => `state (${plural(parts, 'part')}) ${size} chars`,
  packetMessage: (uid: number, name: string, size: number) => `#${uid} ${name} ${size} chars`,
  packet: (length: number, ack: string, what: readonly string[], framing: number) => `${length} chars | ${ack} | ${what.length ? `${what.join(', ')} | framing ${framing} chars` : 'nothing else'}`,
  alreadyConnected: (transport: string) => `already connected when recording started (${transport})`,
  newConnection: (transport: string) => `new connection (${transport})`,
  connected: (transport: string) => `connected (${transport})`,
  interrupted: 'connection interrupted',
  notRecorded: 'not recorded any more',
  closed: (reason: string, seconds: string, outPackets: number, outSize: string, inPackets: number, inSize: string, acks: string, loss: string) => `closed: ${reason} | after ${seconds} s: out ${outPackets} packets ${outSize}, in ${inPackets} packets ${inSize}${acks} | loss: ${loss}`,
  socketIo: (transport: string) => `socket.io${transport ? ` over ${transport}` : ''}`,
  peerChannel: 'peer-to-peer data channel (unordered, no retransmits)',
  lossNone: 'none',
  lossSeparator: ', ',
  lossItem: (count: number, word: string, pluralSuffix: string) => `${count} ${word}${count === 1 ? '' : pluralSuffix}`,
  lossWords: Object.freeze({ slow: ['slow ack', 's'], stalled: ['no ack', ''], dropped: ['dropped', ''], gaps: ['gap', 's'], late: ['late', ''] } as const),
  repeated: (out: number, received: number) => `repeated ${out} out, ${received} in`,
  acksIn: (milliseconds: number) => ` | acks in ${milliseconds} ms`,
  noReason: 'no reason given',
  reasonWithMeaning: (reason: string, meaning: string) => `${reason} (${meaning})`,
  pingNoneYet: 'none yet',
  pingMs: (ping: number) => `${ping} ms`,
  stat: (ping: string, acks: string, outPackets: number, outSize: string, outReliable: number, outState: number, inPackets: number, inSize: string, inReliable: number, inState: number, repeats: string, loss: string, waiting: number, missing: number) => `ping ${ping}${acks} | out ${plural(outPackets, 'packet')} ${outSize} (${outReliable} reliable, ${outState} state)`
    + ` | in ${plural(inPackets, 'packet')} ${inSize} (${inReliable} reliable, ${inState} state) | ${repeats} | loss: ${loss}`
    + `${waiting ? ` | ${waiting} waiting for ack` : ''}${missing ? ` | ${missing} missing` : ''}`,
  recordingOnAgain: 'recording on (net_log on)',
  pageLoaded: (version: string) => `page loaded, game ${version || '?'}, recording on`,
  recordingOff: 'recording off (net_log off)',
  recorderError: '[pb2dev] network log:',
});

export const CLOSE_REASONS: Readonly<Record<string, string>> = Object.freeze({
  'io server disconnect': 'the server closed the connection on purpose',
  'io client disconnect': 'this game closed the connection',
  'ping timeout': 'the server stopped answering socket.io\'s heartbeat',
  'transport close': 'the connection was cut (the network, or the server went away)',
  'transport error': 'the connection failed',
  'parse error': 'the server sent something socket.io could not read',
});

export const STATE_TEXT = Object.freeze({
  separator: ' | ',
  restSeparator: ', ',
  hpBlank: 'hp -',
  hp: (hp: number | null) => `hp ${hp ?? '?'}`,
  respawns: (count: number) => `respawns ${count}`,
  aim: (aimX: string, aimY: string) => `aim ${aimX},${aimY}`,
  position: (positionX: number | null, positionY: number | null) => `pos ${positionX ?? '?'},${positionY ?? '?'}`,
  velocity: (velocityX: number, velocityY: number) => `vel ${velocityX},${velocityY}`,
  bodyHp: (head: number | null, face: number | null, arms: number | null, legs: number | null) => `body hp: head ${head ?? '?'} face ${face ?? '?'} arms ${arms ?? '?'} legs ${legs ?? '?'}`,
  headFace: (head: number | null, face: number | null) => `head hp ${head ?? '?'}, face hp ${face ?? '?'}`,
  killedBy: (killer: number) => `killed by ${killer}`,
  crouchOrKiller: (value: number) => `crouch/killer ${value}`,
  crouch: (value: number) => `crouch ${value}`,
  knockedDown: 'knocked down',
  otherMark: 'mark 2',
  noGun: 'no gun',
  gun: (gun: number) => `gun ${gun}`,
  vehicle: (vehicle: number) => `vehicle ${vehicle}`,
  limp: (control: number, points: readonly string[]) => `limp ${control}%${points.length ? ` (${points.length} body points: ${points.join(' ')})` : ''}`,
  pointSeparator: ',',
  flags: (bits: string) => `flags ${bits}`,
  projectiles: (count: number) => `${count} projectiles`,
  clock: (seconds: string) => `clock ${seconds} s`,
  otherPart: (index: number, shown: string) => `p${index} ${shown}`,
  notThisLayout: (parts: number) => `(${parts} parts; not this version's layout: only the server's positions are named)`,
  positive: (value: number) => `+${value}`,
  waiting: 'waiting',
  paused: 'paused',
  roundTimer: (seconds: string) => `round timer ${seconds} s`,
  snapshotPlayer: (slot: number, hp: number, ping: number, state: string) => `#${slot} hp ${hp} ping ${ping} ms${state ? ` [${state}]` : ''}`,
  nothingNew: 'nothing new',
  partByPart: (parts: readonly string[]) => `(${parts.join(', ')})`,
});

export const FILE_TEXT = Object.freeze({
  header: Object.freeze([
    '# Plazma Burst 2 network log',
    '# One line per event: time, connection, direction, kind, details.',
    '#   connection  c<n> and what it is: server (main/lobby server), p2p-host (a player-hosted',
    '#               match you joined), p2p-guest (a player in a match you host), socket',
    '#   direction   OUT = sent by this game, IN = received, --- = neither',
    '#   kind        CONN  connected, disconnected (with the reason)',
    '#               REL   reliable message: #<sequence number> TYPE(part, part, ...); a RESPONSE ends with',
    '#                     "<- answers #<n> TYPE": the request it answers, by its callback ID',
    '#               STATE unreliable state update, decoded by position (only with net_log_state or net_log_all):',
    '#                     sent by a client: "hp 150 | respawns 1 | aim +212,-40 | pos x,y | ..."; from the',
    '#                     server: "#<slot> hp <server\'s copy> ping <ms> [that player\'s state]" per player',
    '#               PKT   one packet: its size, its ack, what it carries with each size, and the framing',
    '#                     (ack, sequence numbers, separators); they add up (only with net_log_all on)',
    '#               LOSS  packet loss: slow ack (acknowledged over 500 ms after the ping), no ack (none',
    '#                     after 2 s), dropped (never sent), gap (a message is missing), late (it arrived)',
    '#   The game repeats every unacknowledged message in every packet (about every 16 ms) until its',
    '#   ack arrives. That is normal, not loss: STAT counts it as "repeated".',
    '#               STAT  once a second per busy connection: ping, how long acks took, packets,',
    '#                     characters, repeats, losses',
    '#               PAGE  the game page loaded, recording turned on or off',
    '# Parts: "text" in quotes, numbers bare (the game sends them encoded; they are decoded here),',
    '# JSON as it is. #<n> is always a sequence number. Types are the game\'s RELIABLE_<TYPE> names.',
    '# Passwords (the login\'s, a match\'s) are written as ‹redacted›.',
  ]),
  runStarted: (when: string, instance: string, version: string, pid: number) => `# Run started ${when}, instance "${instance}", game ${version || '?'}, process ${pid}`,
  runFileName: (stamp: string, instance: string, attempt: number) => `${stamp}_${instance}${attempt > 1 ? `-${attempt}` : ''}`,
  notAnArray: 'expected an array of lines',
  tooManyLines: (max: number) => `at most ${max} lines at once`,
  badRunName: 'bad run name',
  noSuchRun: (name: string) => `no network log "${name}"`,
});

export const ROUTE_TEXT = Object.freeze({
  nothingYet: 'nothing recorded yet in this run',
  notAvailable: 'not available',
  writeFailed: (message: string) => `Network log not written: ${message}`,
  netlogsFolder: 'netlogs',
});

export const FILTER_TEXT = Object.freeze({
  inAndOut: '--in and --out do not go together (leave both out for both)',
  needsValue: (key: string, example: string) => `${key}: needs a value, e.g. ${example}`,
  termExamples: Object.freeze({ run: 'run:2', type: 'type:chat', conn: 'conn:c1', last: 'last:200' } as Readonly<Record<string, string>>),
  lastRange: `last: a whole number from 1 to ${SHOW_LAST_MAX}`,
});

export const usageError = (usage: string): string => `usage: ${usage}`;
