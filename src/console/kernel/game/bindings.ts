import { escapeRe } from '../core/words.ts';
import { DEFAULT_PARENT_SCALE, ENTER_KEY_CODE, GAME_HEIGHT, GAME_WIDTH, NO_CAMERA_TARGET } from './constants.ts';
import {
  ENTER, GAME_GLOBAL, GLOBAL_FLAG, LEVEL_FRAME, LOCKED_NAMED, NET, SCRIPT_FRAME, STATE_KEYS, UNKNOWN_COUNT, gunModelPattern, gunSlotPattern, type NameKey,
} from './keys.ts';
import { TEXT } from './text.ts';
import { readGlobal, writeGlobal } from './globals.ts';
import { NAMES, nameOf, read, write, call, escName } from './names.ts';
import { GAME_FIELDS } from './fields.ts';
import type { Character, DisplayObject, Gun, Layer, WallGrid, Walls } from './types.ts';

export { GAME_WIDTH, GAME_HEIGHT, NET };

type Bag = Record<string, unknown>;
type Callable = (...args: unknown[]) => unknown;
type Network = Bag & { Event: (...args: unknown[]) => void; match_details?: Bag | null; matches?: unknown; connections?: unknown };
type Stage = Bag & {
  currentFrameLabel?: string;
  addEventListener: (type: unknown, listener: () => void) => void;
  runEvents: (type: unknown, event: unknown) => void;
};
type Camera = Bag & { x: number; y: number; scaleX: number; scaleY: number; parent?: Bag | null; clearMCInterpolationData: () => void };
export type CameraView = {
  x: number; y: number; scaleX: number; scaleY: number;
  parentX: number; parentY: number; parentScaleX: number; parentScaleY: number;
};
export type SlotInfo = {
  login: string; nickname: string; guest: boolean; reputation: unknown; authId: unknown; ping: unknown;
  hp: unknown; team: unknown; spectator: boolean;
};
type TextureClass = new () => DisplayObject;

const ENTER_KEY = Object.freeze({
  keyCode: ENTER_KEY_CODE, which: ENTER_KEY_CODE, key: ENTER.key, code: ENTER.code,
  ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false,
  preventDefault: () => undefined, stopPropagation: () => undefined, stopImmediatePropagation: () => undefined,
});

const lockedNameKeys: readonly NameKey[] = LOCKED_NAMED;

const bagOf = (value: unknown): Bag => (value && typeof value === 'object' ? value as Bag : {});
const field = (target: unknown, key: NameKey): unknown => bagOf(target)[nameOf(key)];
const invoke = (target: unknown, key: NameKey, ...args: unknown[]): unknown => (field(target, key) as Callable).apply(target, args);
const network = (): Network | null => (read('net') as Network | null | undefined) ?? null;
const requireNetwork = (): Network => read('net') as Network;
const stageOrNull = (): Stage | null => (readGlobal(GAME_GLOBAL.stage) as Stage | null | undefined) || null;
const world = (): Camera | null => (Reflect.get(globalThis, GAME_GLOBAL.world) as Camera | null | undefined) ?? null;
const optionalGlobal = <Found>(name: string): Found | null => (readGlobal(name) as Found | undefined) ?? null;
const numberOf = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);

export const game = {
  typedName: (key: string): string => escName(key as NameKey),
  codeName: (key: string): string => nameOf(key as NameKey),
  namesVersion: (): string | undefined => NAMES.version,

  inLevelFrame: (): boolean => stageOrNull()?.currentFrameLabel === LEVEL_FRAME,
  ready: (): boolean => {
    const stage = stageOrNull();
    const event = readGlobal(GAME_GLOBAL.event) as Bag | undefined;
    return !!stage && typeof stage.addEventListener === 'function' && event !== undefined && !!event.ENTER_FRAME && !!game.overlay();
  },
  onEnterFrame: (listener: () => void): void => {
    const event = readGlobal(GAME_GLOBAL.event) as Bag;
    stageOrNull()?.addEventListener(event.ENTER_FRAME, listener);
  },
  overlay: (): unknown => bagOf(read('uiOverlay')).overlay,
  isRunning: (): unknown => readGlobal(GAME_GLOBAL.running),
  setRunning: (running: unknown): void => { writeGlobal(GAME_GLOBAL.running, running); },

  chars: (): (Character | null | undefined)[] => read('chars') as (Character | null | undefined)[],
  me: (): number => read('me') as number,
  charCount: (): number => read('charCount') as number,
  playerDt: (): number => read('playerDt') as number,
  keyUp: (): unknown => read('keyUp'),
  keyDown: (): unknown => read('keyDown'),
  refreshChar: (index: number): unknown => call('refreshChar', index),
  healChar: (index: number, healer: unknown, power: number): unknown => call('healChar', index, healer, power, true),
  updateBody: (index: number): unknown => call('updateBody', index),
  spectating: (): unknown => read('spectating'),

  ptX: (): number[] => read('ptX') as number[],
  ptY: (): number[] => read('ptY') as number[],
  ptPrevX: (): number[] => read('ptPrevX') as number[],
  ptPrevY: (): number[] => read('ptPrevY') as number[],
  ptVelX: (): number[] => read('ptVelX') as number[],
  ptVelY: (): number[] => read('ptVelY') as number[],
  ptCount: (): number => read('ptCount') as number,
  ptOwner: (): number[] => read('ptOwner') as number[],
  gunPtBase: (): number => read('gunPtBase') as number,
  gunPtRange: (): number => read('gunPtRange') as number,
  interpolating: (): unknown => call('interpolating'),
  clearPtInterp: (index: number): unknown => call('clearPtInterp', index),
  wakePt: (index: number): unknown => call('wakePt', index),
  cameraFollowsMe: (): boolean => read('cameraTarget') !== NO_CAMERA_TARGET || !read('spectating'),
  moveCamera: (shiftX: number, shiftY: number): void => {
    const camera = world();
    if (!camera) return;
    camera.x += shiftX;
    camera.y += shiftY;
    camera.clearMCInterpolationData();
    (readGlobal(GAME_GLOBAL.wallLayer) as Camera).clearMCInterpolationData();
    (readGlobal(GAME_GLOBAL.frontLayer) as Camera).clearMCInterpolationData();
  },
  teleportFx: (atX: number, atY: number): unknown => call('effect', atX, atY, bagOf(read('effectTypes'))[nameOf('effectTeleport')], 0, 0),

  gameCanvas: (): unknown => optionalGlobal(GAME_GLOBAL.canvas),
  camera: (): CameraView | null => {
    const camera = world();
    if (!camera) return null;
    const parent = bagOf(camera.parent);
    return {
      x: camera.x, y: camera.y, scaleX: camera.scaleX, scaleY: camera.scaleY,
      parentX: numberOf(parent.x, 0) || 0, parentY: numberOf(parent.y, 0) || 0,
      parentScaleX: numberOf(parent.scaleX, DEFAULT_PARENT_SCALE), parentScaleY: numberOf(parent.scaleY, DEFAULT_PARENT_SCALE),
    };
  },

  zoom: (): number => read('zoom') as number,
  setZoom: (zoom: number): void => { write('zoom', zoom); },
  getGravity: (): unknown => readGlobal(GAME_GLOBAL.gravity),
  setGravity: (gravity: unknown): void => { writeGlobal(GAME_GLOBAL.gravity, gravity); },

  guns: (): (Gun | null | undefined)[] => read('guns') as (Gun | null | undefined)[],
  bullets: (): unknown[] => read('bullets') as unknown[],
  spawnGun: (model: unknown, params: unknown): unknown => call('gunFactory', model, params),
  gunName: (model: unknown): string => call('gunName', model) as string,
  gunScripts: (): Bag => bagOf(bagOf(readGlobal(GAME_GLOBAL.guns)).gun_class_scripts),
  gunModels: (): string[] => {
    const models: string[] = [];
    const source = String(read('gunFactory'));
    const pattern = new RegExp(gunModelPattern(escapeRe(NAMES.strDecode)), GLOBAL_FLAG);
    for (const match of source.matchAll(pattern)) {
      const model: unknown = Reflect.get(globalThis, match[1] ?? '');
      if (typeof model === 'string' && !models.includes(model)) models.push(model);
    }
    return models;
  },
  gunSlotOf: (gunClass: string): number | null => {
    const script: unknown = bagOf(bagOf(game.gunScripts()[gunClass]).frames)[SCRIPT_FRAME];
    const match = typeof script === 'string' ? new RegExp(gunSlotPattern(escapeRe(GAME_FIELDS.G_SLOT))).exec(script) : null;
    return match ? Number(match[1]) : null;
  },

  levelState: (): unknown => read('levelState'),
  setLevelState: (state: unknown): void => { write('levelState', state); },
  fadeOverlay: (): { alpha: number; visible: boolean } | null => read('fadeOverlay') as { alpha: number; visible: boolean } | null,
  setFailText: (text: string): void => { write('failText', text); },

  triggers: (): Bag[] => read('triggers') as Bag[],
  triggerCount: (): number => read('triggerCount') as number,
  regions: (): Bag[] => read('regions') as Bag[],
  regionCount: (): number => read('regionCount') as number,
  timers: (): Bag[] => read('timers') as Bag[],
  decors: (): DisplayObject[] => read('decors') as DisplayObject[],
  doors: (): DisplayObject[] => read('doors') as DisplayObject[],
  doorCount: (): number => read('doorCount') as number,
  walls: (): Walls => ({
    x: read('wallX') as number[], y: read('wallY') as number[], w: read('wallW') as number[], h: read('wallH') as number[], count: read('wallCount') as number,
  }),
  wallGrid: (): WallGrid => ({
    cells: read('grid') as number[][][], cell: read('gridCell') as number, cols: read('gridCols') as number, rows: read('gridRows') as number,
    minX: read('gridMinX') as number, minY: read('gridMinY') as number,
  }),
  addWallToGrid: (index: number): unknown => call('gridAddWall', index),
  wallMaterials: (): unknown[] | null => read('wallMaterial') as unknown[] | null,
  setWallCount: (count: number): void => { write('wallCount', count); },
  initDisplay: (shown: unknown): unknown => call('displayInit', shown),
  textureFollows: (texture: unknown, door: unknown): unknown => call('textureFollows', texture, door),
  wallLayer: (): Layer | null => optionalGlobal<Layer>(GAME_GLOBAL.wallLayer),
  wallTexture: (): TextureClass | null => optionalGlobal<TextureClass>(GAME_GLOBAL.wallTexture),
  frontLayer: (): Layer | null => optionalGlobal<Layer>(GAME_GLOBAL.frontLayer),
  worldLayer: (): Camera | null => world() || null,
  backgrounds: (): Bag => ({ x: read('bgX'), y: read('bgY'), w: read('bgW'), h: read('bgH'), count: read('bgCount') }),
  pushers: (): Bag => ({
    x1: read('pushX1'), y1: read('pushY1'), x2: read('pushX2'), y2: read('pushY2'), count: read('pushCount'),
    tox: read('pushToX'), toy: read('pushToY'), stab: read('pushStab'), damage: read('pushDamage'),
  }),
  waters: (): Bag => ({
    shown: read('waters'), x: read('waterX'), y: read('waterY'), w: read('waterW'), h: read('waterH'),
    damage: read('waterDamage'), count: read('waterCount'),
  }),
  timerCount: (): number => read('timerCount') as number,
  sayTrigger: (): unknown => read('sayTrigger'),
  setSayTrigger: (trigger: unknown): void => { write('sayTrigger', trigger); },
  triggerActivator: (): unknown => read('triggerActivator'),
  setTriggerActivator: (activator: unknown): void => { write('triggerActivator', activator); },
  triggerPower: (): unknown => read('triggerPower'),
  setTriggerPower: (power: unknown): void => { write('triggerPower', power); },
  runTrigger: (index: number): unknown => call('runTrigger', index),
  runTriggerName: (): string | undefined => NAMES.runTrigger,
  resolveTarget: (target: unknown): unknown => call('resolveTarget', target),

  mapVars: (): Bag => read('mapVars') as Bag,
  varSyncOn: (): boolean => read('varSyncOn') === true,
  mapText: (): unknown => read('mapText'),
  setMapText: (text: unknown): void => { write('mapText', text); },

  isMP: (): unknown => read('mp'),
  setMP: (multiplayer: unknown): void => { write('mp', multiplayer); },
  messageType: (name: string): unknown => requireNetwork()[name],
  sendTriggerRun: (index: number, region?: number): void => {
    const net = requireNetwork();
    const encode = field(net, 'netNum') as Callable;
    net.Event(net[NET.EXEC_TRIGGER], encode(index), region === undefined ? '' : encode(region), '');
  },
  sendVarSync: (mode: unknown, name: unknown, value: unknown): void => {
    const net = network();
    if (!net || typeof net.Event !== 'function') throw new Error(TEXT.noNetwork);
    net.Event(net[NET.VAR_SYNC], mode, name, value);
  },
  lobbyConnection: (): unknown => {
    const net = network();
    return net && field(net, 'lobbyConn');
  },
  matchMapId: (): unknown => requireNetwork().match_details?.map_id,
  mapId: (): unknown => read('mapId'),
  sendMethodName: (): string => nameOf('netSend'),
  netLog: (): unknown[] => {
    const net = network();
    return ((net && field(net, 'netLog')) as unknown[] | undefined) || [];
  },
  connections: (): unknown[] => {
    const net = network();
    return net && Array.isArray(net.connections) ? net.connections as unknown[] : [];
  },
  p2pConnection: (): unknown => {
    const net = network();
    return (net && field(net, 'p2pConn')) || null;
  },
  recvMethodName: (): string => nameOf('connRecv'),
  connPeer: (connection: unknown): unknown => field(connection, 'connPeer') || null,
  connReason: (connection: unknown): unknown => field(connection, 'connReason') || null,
  netDigits: (): string => {
    const net = network();
    return ((net && field(net, 'netDigits')) as string | undefined) || '';
  },
  stateLayout: (): Record<string, number | null> | null => {
    const net = network();
    if (!net) return null;
    const layout: Record<string, number | null> = {};
    for (const [name, key] of Object.entries(STATE_KEYS)) {
      const obfuscated = NAMES[key];
      const position = obfuscated ? net[obfuscated] : undefined;
      layout[name] = typeof position === 'number' ? position : null;
    }
    return layout;
  },
  netTypeName: (type: number): string | null => {
    const net = network();
    const typeNames = net ? field(net, 'netTypeNames') as Record<number, string> | undefined : undefined;
    return typeNames?.[type] || null;
  },
  buildTag: (): unknown => read('buildTag'),

  setLobbyAddress: (start: string): void => {
    const hosts = field(requireNetwork(), 'lobbyHosts') as string[];
    for (let index = 0; index < hosts.length; index++) if (hosts[index] !== start) hosts[index] = start;
  },
  serverLocation: (): unknown => read('serverLocation'),
  setServerLocation: (text: string): void => { write('serverLocation', text); },
  setLoginParams: (login: string, password: string): void => {
    const parameters = bagOf(Reflect.get(globalThis, GAME_GLOBAL.loaderInfo)).parameters as Bag | undefined;
    if (!parameters) throw new Error(TEXT.noLoginParameters);
    parameters.l = login;
    parameters.p = password;
  },

  frameLabel: (): string | null => stageOrNull()?.currentFrameLabel ?? null,
  goToScreen: (label: string): unknown => (readGlobal(GAME_GLOBAL.goToFrame) as Callable)(label),
  lobbyReady: (): boolean => {
    const net = network();
    return !!(net && field(net, 'lobbyReady'));
  },
  myAccount: (): unknown => {
    const net = network();
    return (net && field(net, 'connUser')) || null;
  },
  sendLobby: (typeName: string, parts: readonly unknown[], reply?: unknown): void => {
    const net = network();
    const connection = net && field(net, 'lobbyConn');
    if (!net || !connection || !field(net, 'lobbyReady')) throw new Error(TEXT.notLoggedIn);
    invoke(connection, 'netSend', field(net, 'netChannel'), [net[typeName], ...parts], reply);
  },
  replyTo: (): unknown => field(requireNetwork(), 'netReplyTo'),
  setCreateSettings: (settings: unknown, askFirst: boolean): void => {
    write('createSettings', settings);
    requireNetwork()[nameOf('acceptManually')] = askFirst;
  },
  enterMatch: (hostInfo: unknown, slot: unknown): unknown => invoke(requireNetwork(), 'enterMatch', hostInfo, slot),
  setJoinPassword: (password: string): void => { write('joinPassword', password); },
  matchDetails: (): Bag | null => network()?.match_details || null,
  hostedMatch: (): Bag | null => {
    const net = network();
    const matches = net?.matches;
    return (Array.isArray(matches) && (matches[0] as Bag | undefined)) || null;
  },
  matchSlots: (match: unknown): unknown[] => (field(match, 'matchSlots') as unknown[] | undefined) || [],
  spectatorSlotCount: (): unknown => field(requireNetwork(), 'spectatorSlots'),
  slotInfo: (connection: unknown): SlotInfo => {
    const user = bagOf(field(connection, 'connUser'));
    const stats = bagOf(field(connection, 'connStats'));
    const playing = bagOf(field(connection, 'connPlayer'));
    const auth = read('p2pAuth');
    const ids = auth ? field(auth, 'p2pAuthIds') as { get(key: unknown): Bag | undefined } | undefined : undefined;
    const record = ids?.get(connection);
    return {
      login: (user.login as string | undefined) || '',
      nickname: (user.nickname as string | undefined) || (playing.nickname as string | undefined) || '',
      guest: !!user.is_guest,
      reputation: stats.reputation, authId: record ? record.id : null, ping: bagOf(connection).ping,
      hp: playing.hea, team: playing.team, spectator: !!field(playing, 'connSpectator'),
    };
  },
  tellSlot: (connection: unknown, text: string): unknown => invoke(connection, 'connSay', text),
  matchMapText: (match: unknown): unknown => field(match, 'mapText'),
  setMatchMap: (match: unknown, parts: readonly unknown[]): unknown => invoke(match, 'matchSetMap', parts),
  sendChat: (text: string): void => {
    const net = requireNetwork();
    const encode = field(net, 'netNum') as Callable;
    net.Event(net[NET.CHAT], encode(read('chatToAll')), text);
  },
  spectatorSlot: (): unknown => field(requireNetwork(), 'spectatorSlot'),
  isSpectating: (): boolean => !!read('spectating'),
  setChatTrace: (on: boolean): void => { write('chatTrace', on); },
  addIceServers: (servers: readonly unknown[]): void => {
    const peer = bagOf(readGlobal(GAME_GLOBAL.peer));
    const config = bagOf(peer.config);
    const iceServers = Array.isArray(config.iceServers) ? config.iceServers as unknown[] : [];
    peer.config = { ...config, iceServers: [...iceServers, ...servers] };
  },

  lockedArrayName: (index: number): string | null => {
    if (!NAMES.lockedArrays) return null;
    const locked = ((read('lockedArrays') as unknown[] | null) || [])[index];
    if (!locked) return null;
    return lockedNameKeys.find((key) => NAMES[key] && read(key) === locked) ?? null;
  },
  lockedArrayCount: (): number | string => (NAMES.lockedArrays ? ((read('lockedArrays') as unknown[] | null) || []).length : UNKNOWN_COUNT),
  clearMapChunks: (): void => { requireNetwork()[nameOf('mapChunks')] = null; },

  chatTyping: (): unknown => read('chatTyping'),
  openChat: (text: string): unknown => call('openChat', text),
  isCustomMap: (): unknown => read('customMap'),
  setCustomMap: (custom: unknown): void => { write('customMap', custom); },
  chatPopups: (): unknown => read('chatPopups'),
  chatPanel: (): unknown => read('chatPanel'),
  pressEnter: (): void => { stageOrNull()?.runEvents(bagOf(readGlobal(GAME_GLOBAL.keyboardEvent)).KEY_DOWN, ENTER_KEY); },
  releaseEnter: (): void => { stageOrNull()?.runEvents(bagOf(readGlobal(GAME_GLOBAL.keyboardEvent)).KEY_UP, ENTER_KEY); },
};
