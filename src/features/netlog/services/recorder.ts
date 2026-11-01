import { decodeNumber, PART } from '#console/kernel/net/codec.ts';
import { tap, untap } from '#console/kernel/net/tap.ts';
import {
  BUFFER_MAX, FLUSH_MS, RESPONSE_MIN_PARTS, MILLISECONDS_PER_SECOND, PENDING_MAX, PING_NONE, PING_UNKNOWN_MS, RECORDER_ERRORS_SHOWN, REQUESTS_KEPT,
  SECONDS_DECIMALS, SLOW_ACK_MS, STALL_MS, STAT_MS,
} from '../constants.ts';
import {
  CONNECTION_KIND, DIRECTION, LINE_KIND, MESSAGE_TYPE, PEER_SEND_METHOD, SOCKET_EMIT_METHOD, SOCKET_MESSAGE_EVENT, STATE_KIND, TAP_OWNER,
  type ConnectionKind, type Direction, type LineKind, type StateKind,
} from '../keys.ts';
import { LINE_TEXT } from '../text.ts';
import { formatLine, sizeText } from '../domain/line.ts';
import { ackText, lossText, newCounts, pingText, reasonText, repeatText, type Counts } from '../domain/loss.ts';
import { describeMessage, parsePacket, type DescribedMessage, type Packet } from '../domain/message.ts';
import { describeState } from '../domain/state.ts';
import type { StateLayout } from '#console/kernel/game/network.ts';
import type { MethodWrapper } from '../adapters/method-wrap.ts';
import type { GameConnection, GameNetwork, Peer, Socket } from '#console/kernel/game/network.ts';

export type { GameConnection, GameNetwork };

export type RecorderSettings = { recording(): boolean; everything(): boolean; states(): boolean };
export type LineSink = { send(body: string): Promise<{ run: string; file: string }>; beacon(body: string): boolean };

export type RecorderDeps = {
  network: GameNetwork;
  settings: RecorderSettings;
  sink: LineSink;
  methods: MethodWrapper;
  onPageHide(handler: () => void): void;
  warn(...parts: unknown[]): void;
  now(): number;
};

type SentMessage = { t: number; tries: number; name: string; stalled: boolean };
type AskedMessage = { uid: number; name: string; parts: string[]; t: number; answered: boolean };

type ConnectionRecord = {
  id: number; conn: GameConnection; kind: ConnectionKind; socket: Socket | null; peer: Peer | null; connected: boolean;
  maxOut: number; ackOut: number | null; unacked: Map<number, SentMessage>; asked: { OUT: AskedMessage[]; IN: AskedMessage[] };
  contig: number | null; seen: Set<number>; missing: Map<number, number>; sec: Counts; total: Counts; opened: number;
};

export type ConnectionSummary = {
  id: number; kind: ConnectionKind; connected: boolean; ping: string; total: Counts; unacked: number; missing: number;
};

export type Recorder = {
  tick(time?: number): void;
  on(): boolean;
  lines(): readonly string[];
  pageLines(): number;
  file(): string | null;
  run(): string | null;
  writeError(): string | null;
  connections(): ConnectionSummary[];
};

const isNumber = (value: number): boolean => !Number.isNaN(value);
const pingMs = (ping: unknown): number => (typeof ping === 'number' && ping < PING_NONE ? ping : PING_UNKNOWN_MS);

export function createRecorder(deps: RecorderDeps): Recorder {
  const { network, settings, sink, methods } = deps;
  const records = new Map<GameConnection, ConnectionRecord>();
  const lines: string[] = [];
  let pending: string[] = [];
  let nextId = 1;
  let on = false;
  let started = false;
  let lastStat = 0;
  let lastFlush = 0;
  let flushing = false;
  let file: string | null = null;
  let run: string | null = null;
  let writeError: string | null = null;
  let pageLines = 0;
  let recorderErrors = 0;
  let isPageHideHooked = false;

  const digits = (): string => { try { return network.digits(); } catch { return ''; } };
  const typeName = (type: number): string | null => { try { return network.typeName(type); } catch { return null; } };
  const layout = (): StateLayout | null => { try { return network.stateLayout(); } catch { return null; } };
  const isEverythingOn = (): boolean => settings.everything();
  const isStateOn = (): boolean => isEverythingOn() || settings.states();

  function emit(record: ConnectionRecord | null, direction: Direction, kind: LineKind, text: string, time = deps.now()): void {
    const line = formatLine(time, record && { id: record.id, kind: record.kind }, direction, kind, text);
    lines.push(line);
    if (lines.length > BUFFER_MAX) lines.splice(0, lines.length - BUFFER_MAX);
    pending.push(line);
    if (pending.length > PENDING_MAX) pending.splice(0, pending.length - PENDING_MAX);
    pageLines++;
  }

  const count = (record: ConnectionRecord, key: keyof Counts, amount = 1): void => {
    record.sec[key] += amount;
    record.total[key] += amount;
  };

  function stateKind(record: ConnectionRecord, direction: Direction): StateKind | null {
    const isClient = record.kind === CONNECTION_KIND.server || record.kind === CONNECTION_KIND.p2pHost;
    const isHost = record.kind === CONNECTION_KIND.p2pGuest;
    if (!isClient && !isHost) return null;
    return (direction === DIRECTION.out) === isClient ? STATE_KIND.player : STATE_KIND.snapshot;
  }

  function remember(list: AskedMessage[], uid: number, message: DescribedMessage, time: number): void {
    if (message.name === MESSAGE_TYPE.response) return;
    list.push({ uid, name: message.name, parts: message.parts, t: time, answered: false });
    if (list.length > REQUESTS_KEPT) list.splice(0, list.length - REQUESTS_KEPT);
  }

  function answerOf(list: AskedMessage[], message: DescribedMessage, time: number): string {
    const isResponse = message.name === MESSAGE_TYPE.response && message.parts.length >= RESPONSE_MIN_PARTS;
    if (!isResponse) return '';
    const id = message.parts[1] ?? '';
    for (let index = list.length - 1; index >= 0; index--) {
      const asked = list[index];
      if (!asked) continue;
      const at = asked.parts.indexOf(id, 1);
      if (asked.answered || at < 1) continue;
      asked.answered = true;
      const callback = decodeNumber(id, digits());
      return LINE_TEXT.answers(asked.uid, asked.name, at, JSON.stringify(id), callback === null ? LINE_TEXT.unknown : String(callback), time - asked.t);
    }
    return '';
  }

  function acked(record: ConnectionRecord, uid: number, sent: SentMessage, time: number): void {
    const took = time - sent.t;
    count(record, 'acked');
    count(record, 'ackMs', took);
    const ping = pingMs(record.conn.ping);
    if (took <= ping + SLOW_ACK_MS) return;
    count(record, 'slow');
    emit(record, DIRECTION.out, LINE_KIND.loss, LINE_TEXT.slowAck(uid, sent.name, took, ping, sent.tries), time);
  }

  function stallCheck(record: ConnectionRecord, time: number): void {
    for (const [uid, sent] of record.unacked) {
      if (sent.stalled || time - sent.t < STALL_MS) continue;
      sent.stalled = true;
      count(record, 'stalled');
      emit(record, DIRECTION.out, LINE_KIND.loss, LINE_TEXT.noAck(uid, sent.name, time - sent.t, sent.tries), time);
    }
  }

  function packetLine(record: ConnectionRecord, direction: Direction, text: string, packet: Packet, time: number): void {
    const hasAck = isNumber(packet.ack) && packet.ack >= 0;
    const what: string[] = [];
    let used = 0;
    if (packet.state) {
      what.push(LINE_TEXT.packetState(packet.state.split(PART).length, packet.stateSize));
      used += packet.stateSize;
    }
    for (const { uid, data, size } of packet.rel) {
      what.push(LINE_TEXT.packetMessage(uid, describeMessage(data, digits(), typeName).name, size));
      used += size;
    }
    emit(record, direction, LINE_KIND.packet, LINE_TEXT.packet(text.length, hasAck ? LINE_TEXT.ackAt(packet.ack) : LINE_TEXT.ackNone, what, text.length - used), time);
  }

  function onOut(record: ConnectionRecord, text: string, dropped: boolean, time = deps.now()): void {
    count(record, 'pkOut');
    count(record, 'bytesOut', text.length);
    const packet = parsePacket(text);
    if (isEverythingOn()) packetLine(record, DIRECTION.out, text, packet, time);
    if (isNumber(packet.ack)) record.ackOut = packet.ack;
    if (packet.state) {
      count(record, 'stateOut');
      if (isStateOn()) emit(record, DIRECTION.out, LINE_KIND.state, describeState(packet.state, digits(), stateKind(record, DIRECTION.out), layout()), time);
    }
    for (const { uid, data } of packet.rel) {
      if (!isNumber(uid)) continue;
      const sent = record.unacked.get(uid);
      if (uid > record.maxOut) {
        record.maxOut = uid;
        const message = describeMessage(data, digits(), typeName, isEverythingOn());
        record.unacked.set(uid, { t: time, tries: 1, name: message.name, stalled: false });
        count(record, 'relOut');
        emit(record, DIRECTION.out, LINE_KIND.rel, LINE_TEXT.reliable(uid, message.text, answerOf(record.asked.IN, message, time)), time);
        remember(record.asked.OUT, uid, message, time);
      } else {
        count(record, 'repeatsOut');
        if (sent) sent.tries++;
      }
    }
    if (dropped) {
      count(record, 'dropped');
      emit(record, DIRECTION.out, LINE_KIND.loss, LINE_TEXT.dropped(packet.rel.length, !!packet.state), time);
    }
  }

  function noteGap(record: ConnectionRecord, uid: number, contig: number, time: number): void {
    const fresh: number[] = [];
    for (let missingUid = contig + 1; missingUid < uid; missingUid++) {
      if (record.seen.has(missingUid) || record.missing.has(missingUid)) continue;
      record.missing.set(missingUid, time);
      fresh.push(missingUid);
    }
    const first = fresh[0];
    const last = fresh[fresh.length - 1];
    if (first === undefined || last === undefined) return;
    count(record, 'gaps', fresh.length);
    emit(record, DIRECTION.in, LINE_KIND.loss, LINE_TEXT.gap(uid, LINE_TEXT.range(first, last), fresh.length), time);
  }

  function onIn(record: ConnectionRecord, text: string, time = deps.now()): void {
    count(record, 'pkIn');
    count(record, 'bytesIn', text.length);
    const packet = parsePacket(text);
    if (isEverythingOn()) packetLine(record, DIRECTION.in, text, packet, time);
    if (isNumber(packet.ack)) {
      for (const [uid, sent] of record.unacked) {
        if (uid > packet.ack) continue;
        record.unacked.delete(uid);
        acked(record, uid, sent, time);
      }
    }
    if (packet.state) {
      count(record, 'stateIn');
      if (isStateOn()) emit(record, DIRECTION.in, LINE_KIND.state, describeState(packet.state, digits(), stateKind(record, DIRECTION.in), layout()), time);
    }
    const uids = packet.rel.map((entry) => entry.uid).filter(isNumber);
    if (record.contig === null && uids.length) record.contig = Math.min(...uids) - 1;
    for (const { uid, data } of packet.rel) {
      if (!isNumber(uid)) continue;
      const contig = record.contig ?? -1;
      const isRepeat = uid <= contig || record.seen.has(uid);
      if (isRepeat) {
        count(record, 'repeatsIn');
        continue;
      }
      count(record, 'relIn');
      const message = describeMessage(data, digits(), typeName, isEverythingOn());
      emit(record, DIRECTION.in, LINE_KIND.rel, LINE_TEXT.reliable(uid, message.text, answerOf(record.asked.OUT, message, time)), time);
      remember(record.asked.IN, uid, message, time);
      const gapSeenAt = record.missing.get(uid);
      if (gapSeenAt !== undefined) {
        record.missing.delete(uid);
        count(record, 'late');
        emit(record, DIRECTION.in, LINE_KIND.loss, LINE_TEXT.late(uid, time - gapSeenAt), time);
      }
      if (uid > contig + 1) noteGap(record, uid, contig, time);
      record.seen.add(uid);
      let newContig = contig;
      while (record.seen.has(newContig + 1)) {
        newContig++;
        record.seen.delete(newContig);
      }
      record.contig = newContig;
    }
  }

  function safe(action: () => void): void {
    try {
      action();
    } catch (error) {
      if (recorderErrors++ < RECORDER_ERRORS_SHOWN) deps.warn(LINE_TEXT.recorderError, error);
    }
  }

  const socketOf = (connection: GameConnection): Socket | null => connection.socket || null;
  const isConnected = (connection: GameConnection): boolean => {
    const socket = socketOf(connection);
    const peer = network.peerOf(connection);
    return !!(socket?.connected || peer?.connected);
  };

  function kindOf(connection: GameConnection): ConnectionKind {
    if (connection === network.lobbyConnection()) return CONNECTION_KIND.server;
    if (connection === network.p2pConnection()) return CONNECTION_KIND.p2pHost;
    if (network.peerOf(connection)) return CONNECTION_KIND.p2pGuest;
    return CONNECTION_KIND.socket;
  }

  function transportOf(connection: GameConnection): string {
    const socket = socketOf(connection);
    if (!socket) return LINE_TEXT.peerChannel;
    return LINE_TEXT.socketIo(transportName(socket));
  }

  function transportName(socket: Socket): string {
    try {
      return socket.io?.engine?.transport?.name ?? '';
    } catch {
      return '';
    }
  }

  function isDroppedBySocket(socket: Socket): boolean {
    try {
      return !!socket.flags?.volatile && !socket.io?.engine?.transport?.writable;
    } catch {
      return false;
    }
  }

  function wrapAll(record: ConnectionRecord): void {
    const connection = record.conn;
    tap(connection, network.receiveMethodName(), TAP_OWNER, (text) => {
      if (typeof text === 'string') safe(() => onIn(record, text));
    });
    const socket = socketOf(connection);
    if (socket && socket !== record.socket) {
      if (record.socket) methods.unwrap(record.socket, SOCKET_EMIT_METHOD);
      record.socket = socket;
      methods.wrap(socket, SOCKET_EMIT_METHOD, (target, args) => {
        const [event, data] = args;
        if (event === SOCKET_MESSAGE_EVENT && typeof data === 'string') {
          const dropped = isDroppedBySocket(target as Socket);
          safe(() => onOut(record, data, dropped));
        }
      });
    }
    const peer = network.peerOf(connection);
    if (peer && peer !== record.peer) {
      if (record.peer) methods.unwrap(record.peer, PEER_SEND_METHOD);
      record.peer = peer;
      methods.wrap(peer, PEER_SEND_METHOD, (_target, args) => {
        const [data] = args;
        if (typeof data === 'string') safe(() => onOut(record, data, false));
      });
    }
  }

  function unwrapAll(record: ConnectionRecord): void {
    untap(record.conn, network.receiveMethodName(), TAP_OWNER);
    methods.unwrap(record.socket, SOCKET_EMIT_METHOD);
    methods.unwrap(record.peer, PEER_SEND_METHOD);
  }

  function attach(connection: GameConnection): ConnectionRecord {
    const connected = isConnected(connection);
    const record: ConnectionRecord = {
      id: nextId++, conn: connection, kind: kindOf(connection), socket: null, peer: null, connected,
      maxOut: -1, ackOut: null, unacked: new Map(), asked: { OUT: [], IN: [] },
      contig: connected ? null : -1, seen: new Set(), missing: new Map(),
      sec: newCounts(), total: newCounts(), opened: deps.now(),
    };
    records.set(connection, record);
    wrapAll(record);
    emit(record, DIRECTION.none, LINE_KIND.conn, connected ? LINE_TEXT.alreadyConnected(transportOf(connection)) : LINE_TEXT.newConnection(transportOf(connection)));
    return record;
  }

  function detach(record: ConnectionRecord, why: string): void {
    unwrapAll(record);
    records.delete(record.conn);
    if (why) emit(record, DIRECTION.none, LINE_KIND.conn, why);
  }

  function statLines(time: number): void {
    for (const record of records.values()) {
      const counts = record.sec;
      if (counts.pkIn || counts.pkOut) {
        emit(record, DIRECTION.none, LINE_KIND.stat, LINE_TEXT.stat(
          pingText(record.conn.ping), ackText(counts), counts.pkOut, sizeText(counts.bytesOut), counts.relOut, counts.stateOut,
          counts.pkIn, sizeText(counts.bytesIn), counts.relIn, counts.stateIn, repeatText(counts), lossText(counts),
          record.unacked.size, record.missing.size,
        ), time);
      }
      record.sec = newCounts();
    }
  }

  function flush(useBeacon = false): void {
    const isBusy = flushing && !useBeacon;
    if (!pending.length || isBusy) return;
    const body = JSON.stringify(pending);
    pending = [];
    lastFlush = deps.now();
    if (useBeacon && sink.beacon(body)) return;
    flushing = true;
    Promise.resolve()
      .then(() => sink.send(body))
      .then((written) => {
        file = written.file;
        run = written.run;
        writeError = null;
      })
      .catch((error: unknown) => { writeError = (error as Error | null)?.message || String(error); })
      .finally(() => { flushing = false; });
  }

  function hookPageHide(): void {
    if (isPageHideHooked) return;
    isPageHideHooked = true;
    deps.onPageHide(() => flush(true));
  }

  function setOn(want: boolean): void {
    on = want;
    if (want) {
      emit(null, DIRECTION.none, LINE_KIND.page, started ? LINE_TEXT.recordingOnAgain : LINE_TEXT.pageLoaded(network.namesVersion()));
    } else {
      for (const record of [...records.values()]) detach(record, LINE_TEXT.notRecorded);
      emit(null, DIRECTION.none, LINE_KIND.page, LINE_TEXT.recordingOff);
      flush();
    }
    started = true;
  }

  function closedText(record: ConnectionRecord, time: number): string {
    const totals = record.total;
    const seconds = ((time - record.opened) / MILLISECONDS_PER_SECOND).toFixed(SECONDS_DECIMALS);
    return LINE_TEXT.closed(reasonText(network.closeReason(record.conn)), seconds, totals.pkOut, sizeText(totals.bytesOut), totals.pkIn, sizeText(totals.bytesIn), ackText(totals), lossText(totals));
  }

  function followConnections(time: number): void {
    hookPageHide();
    const connections = network.connections();
    for (const connection of connections) if (connection && !records.has(connection)) attach(connection);
    for (const record of [...records.values()]) {
      const connection = record.conn;
      if (!connections.includes(connection)) {
        detach(record, closedText(record, time));
        continue;
      }
      if (record.kind === CONNECTION_KIND.socket) record.kind = kindOf(connection);
      wrapAll(record);
      const isUp = isConnected(connection);
      if (isUp !== record.connected) {
        record.connected = isUp;
        emit(record, DIRECTION.none, LINE_KIND.conn, isUp ? LINE_TEXT.connected(transportOf(connection)) : LINE_TEXT.interrupted);
      }
      stallCheck(record, time);
    }
    if (time - lastStat >= STAT_MS) {
      lastStat = time;
      statLines(time);
    }
  }

  function tick(time = deps.now()): void {
    const want = settings.recording();
    if (want !== on || !started) setOn(want);
    if (on) followConnections(time);
    if (time - lastFlush >= FLUSH_MS) flush();
  }

  return {
    tick,
    on: () => on,
    lines: () => lines,
    pageLines: () => pageLines,
    file: () => file,
    run: () => run,
    writeError: () => writeError,
    connections: () => [...records.values()].map((record) => ({
      id: record.id, kind: record.kind, connected: record.connected, ping: pingText(record.conn.ping), total: { ...record.total },
      unacked: record.unacked.size, missing: record.missing.size,
    })),
  };
}
