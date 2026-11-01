import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expectedKeys } from '#tools/find-names/find-names.ts';
import { stringOf } from '#kernel/text/text-of.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const CONSOLE_ENTRY = path.join(REPO, 'src/console/index.ts');
const DEFAULT_MAP_FILE = path.join(REPO, 'test/fixtures/map.xml');
const FAKE_NAME_PREFIX = '__pb2_';
const CONSOLE_PRINT_PREFIX = '[pb2dev] ';
const ECHOED_COMMAND_PREFIX = '> ';
const GAME_CANVAS_WIDTH = 1600;
const GAME_CANVAS_HEIGHT = 800;
const GAME_CANVAS_RESOLUTION = 2;
const GUN_SLOT_COUNT = 9;

const REGION_MODES_THE_MAP_LOADER_REWRITES_FROM_HIDDEN_USE_KEYS_TO_PLAIN_ONES: Readonly<Record<number, number>> = Object.freeze({ 8: 1, 11: 9, 12: 10, 15: 1 });

export type FakeGameLog = { net: any[]; runs: any[]; ran: any[]; printed: Lines; frames: any[]; drawn: any[] };

export type Lines = [string, ...string[]];

export type FakeGame = {
  G: Record<string, any>;
  N: any;
  globals: Record<string, any>;
  names: any;
  log: FakeGameLog;
  store: Map<string, string>;
  chars: any[];
  triggers: any[];
  globalsBeforeConsole: string[];
  intervals: (() => void)[];
  player: any;
  run(line: string): Lines;
  frame(count?: number): void;
  press(code: string, modifiers?: Record<string, unknown>): Lines;
  setMP(on: boolean): void;
  dispatch(...args: any[]): any;
};

type Attributes = Record<string, string>;

function parseMap(xml: string) {
  const tags = (name: string): Attributes[] => [...xml.matchAll(new RegExp(`<${name} [^>]*\\/>`, 'g'))].map((match) => {
    const attributes: Attributes = {};
    for (const attribute of match[0].matchAll(/([A-Za-z0-9_]+)="([^"]*)"/g)) attributes[attribute[1] ?? ''] = attribute[2] ?? '';
    return attributes;
  });
  return { triggers: tags('trigger'), regions: tags('region'), timers: tags('timer'), players: tags('player'), decors: tags('decor') };
}

const A_FEW_OF_THE_MAP_EDITORS_ACTIONS_OPCODES_JS_HAS_THEM_ALL = Object.freeze({
  aliases: { MovableTo: 0, TimerDisable: 26, 'next if VarA == ValueB': 123, SetVar: 100 },
  actions: {
    0: { desc: "Movable › Force Movable 'A' move to region 'B'", a: 'door', b: 'region', alias: 'MovableTo' },
    26: { desc: "Timer › Deactivate Timer 'A'", a: 'timer', b: 'nochange', alias: 'TimerDisable' },
    100: { desc: "Var › Set variable 'A' to value 'B'", a: 'string', b: 'string', alias: 'SetVar' },
    123: { desc: "Var › Skip next trigger action if value of variable 'A' does not equals value 'B'", a: 'string', b: 'string', alias: 'next if VarA == ValueB' },
    562: { desc: 'Debug › Something without a name', a: 'string', b: 'string' },
  },
  params: [
    { name: 'uid', kind: 'string', title: 'ID', desc: 'Object ID', cls: '*' },
    { name: 'x', kind: 'value+round10', title: 'X', desc: 'Object position along X axis', cls: '*' },
    { name: 'use_target', kind: 'trigger+none', title: 'Activation Trigger', desc: 'Trigger being called on Action event', cls: 'region' },
    { name: 'use_on', kind: 'region_activation', title: 'Activation on', desc: 'When it runs', cls: 'region' },
  ],
  values: { region_activation: { 0: 'No activation', 1: "''USE'' key (with button)" } },
  markPairs: {},
});

const isWholeNumberText = (text: string) => String(parseInt(text)) === text;

export async function bootConsole({ mapFile = DEFAULT_MAP_FILE, sayTrigger, entry = CONSOLE_ENTRY }: { mapFile?: string; sayTrigger?: string; entry?: string } = {}): Promise<FakeGame> {
  const globals: Record<string, any> = globalThis;
  const names: Record<string, any> = Object.fromEntries(expectedKeys().map((key) => [key, `${FAKE_NAME_PREFIX}${key}`]));
  names.version = 'vTEST';
  globals.PB2_NAMES = names;
  globals.PB2_OPCODES = A_FEW_OF_THE_MAP_EDITORS_ACTIONS_OPCODES_JS_HAS_THEM_ALL;
  const set = (key: string, value: unknown) => { globals[names[key]] = value; };
  const log: FakeGameLog = { net: [], runs: [], ran: [], printed: [] as unknown as Lines, frames: [], drawn: [] };

  const xml = fs.readFileSync(mapFile, 'utf8');
  const map = parseMap(xml);
  const indexInItsList = new Map<string, number>();
  for (const list of Object.values(map)) list.forEach((object, index) => { indexInItsList.set(object.uid ?? '', index); });
  const loaderUidRegistryInMapOrder = new Map<string, number>();
  const countPerTag: Record<string, number> = {};
  for (const match of xml.matchAll(/<(\w+) uid="([^"]*)"/g)) {
    const tag = match[1] ?? '';
    const uid = match[2] ?? '';
    countPerTag[tag] = (countPerTag[tag] ?? -1) + 1;
    if (!loaderUidRegistryInMapOrder.has(uid)) loaderUidRegistryInMapOrder.set(uid, countPerTag[tag]);
  }
  set('resolveTarget', (value: unknown) => {
    const text = stringOf(value ?? '-1');
    if (text.startsWith('#')) return loaderUidRegistryInMapOrder.get(text) ?? text;
    return isWholeNumberText(text) ? parseInt(text) : text;
  });
  const loaderTargetFixup = (value = '-1') => {
    if (value.startsWith('#')) return indexInItsList.get(value) ?? value;
    return isWholeNumberText(value) ? parseInt(value) : value;
  };
  const triggers = map.triggers.map((attributes) => {
    const trigger: Record<string, any> = { uid: attributes.uid, [names.trigTargetA]: [], [names.trigTargetB]: [], [names.trigTypes]: [] };
    let actionCount = 0;
    for (let action = 1; attributes[`actions_${action}_type`] !== undefined; action++, actionCount++) {
      trigger[names.trigTypes].push(parseInt(attributes[`actions_${action}_type`] ?? ''));
      trigger[names.trigTargetA].push(loaderTargetFixup(attributes[`actions_${action}_targetA`]));
      trigger[names.trigTargetB].push(loaderTargetFixup(attributes[`actions_${action}_targetB`]));
    }
    Object.assign(trigger, {
      [names.trigActionCount]: actionCount, [names.trigEnabled]: attributes.enabled === 'true', [names.trigAtStart]: attributes.execute === 'true',
      [names.trigMaxCalls]: parseInt(attributes.maxcalls ?? ''), [names.trigCalls]: parseInt(attributes.maxcalls ?? ''),
    });
    return trigger;
  });
  set('triggers', triggers); set('triggerCount', triggers.length);
  set('regions', map.regions.map((attributes) => {
    const useOn = parseInt(attributes.use_on ?? '');
    return {
      x: +(attributes.x ?? 0), y: +(attributes.y ?? 0), w: +(attributes.w ?? 0), h: +(attributes.h ?? 0),
      [names.regionUseOn]: REGION_MODES_THE_MAP_LOADER_REWRITES_FROM_HIDDEN_USE_KEYS_TO_PLAIN_ONES[useOn] ?? useOn,
      [names.regionTrigger]: loaderTargetFixup(attributes.use_target), [names.regionUsesTimer]: attributes.uses_timer === 'true',
    };
  }));
  set('regionCount', map.regions.length);
  set('timers', map.timers.map((attributes) => ({ [names.timerTarget]: loaderTargetFixup(attributes.target), [names.trigEnabled]: attributes.enabled === 'true' })));
  set('timerCount', map.timers.length);
  set('decors', map.decors.map((attributes) => ({
    x: +(attributes.x ?? 0), y: +(attributes.y ?? 0), rotation: +(attributes.r ?? 0), scaleX: +(attributes.sx ?? 1), scaleY: +(attributes.sy ?? 1),
  })));
  set('mapText', xml);
  set('mapVars', { var_mods: 'CTHC Lenaa', door_1: 0, size_P0: 1, SkinChatVar: '-zoom 0.9' });
  set('varSyncOn', true);

  const chars = map.players.map((attributes, index) => {
    const character: Record<string, any> = {
      nickname: attributes.nick || `p${index}`, team: +(attributes.team ?? 0), [names.charVehicle]: -1, [names.charHuman]: attributes.human !== 'false',
      hea: +(attributes.hea ?? 0), hmax: +(attributes.hmax ?? 0), x: +(attributes.x ?? 0), y: +(attributes.y ?? 0), io: true,
      tarx: 400, tary: -300, curwea: -1, stand: true, sit: 0, tox: 0, toy: 0,
      [names.dead]: false, [names.dying]: false, [names.refPoint]: index, [names.walk]: 0, [names.jump]: 1, [names.noSwords]: false,
      [names.charIndex]: index, [names.charOnDeath]: loaderTargetFixup(attributes.ondeath), [names.aimAngle]: 0, [names.facing]: 1,
      [names.headHp]: 50, [names.faceHp]: 80, [names.legsHp]: 60, [names.armsHp]: 50,
      [names.headOff]: false, [names.faceGone]: false, [names.legsBroken]: false, [names.armsBroken]: false,
      [names.afterMove]() { return undefined; },
    };
    for (let slot = 1; slot <= GUN_SLOT_COUNT; slot++) character[`slot${slot}`] = -1;
    return character;
  });
  const nothing = () => undefined;
  set('chars', chars); set('me', 0); set('charCount', chars.length);
  set('ptX', chars.map((character) => character.x)); set('ptY', chars.map((character) => character.y));
  set('ptPrevX', chars.map((character) => character.x)); set('ptPrevY', chars.map((character) => character.y));
  set('ptCount', chars.length); set('ptOwner', chars.map((_, index) => index)); set('gunPtBase', 1000); set('gunPtRange', 100);
  set('ptVelX', []); set('ptVelY', []);
  set('interpolating', () => false); set('clearPtInterp', nothing); set('wakePt', nothing);
  set('cameraTarget', -1); set('spectating', false);
  set('effect', nothing); set('effectTypes', { [names.effectTeleport]: 7 });
  set('playerDt', 1); set('keyUp', false); set('keyDown', false); set('chatTyping', false);
  set('refreshChar', nothing); set('healChar', nothing); set('updateBody', nothing);
  set('levelState', ''); set('failText', ''); set('fadeOverlay', null);
  set('guns', []); set('bullets', []);
  globals.Guns = { gun_class_scripts: { gun_rifle: { frames: { 1: `.${names.gunSlot}=1;` } } } };
  set('gunFactory', (model: string, params: { upg: unknown }) => ({ model, upg: params.upg, [names.gunSlot]: 1, [names.charIndex]: 0, [names.gunFixed]: false }));
  set('gunName', (model: string) => ({ gun_rifle: 'Assault Rifle' } as Record<string, string>)[model] || '');

  set('mp', true); set('customMap', true);
  set('sayTrigger', sayTrigger && indexInItsList.has(sayTrigger) ? indexInItsList.get(sayTrigger) : -1);
  set('net', {
    RELIABLE_EXEC_TRIGGER: 'EXEC', RELIABLE_VAR_SYNC: 'VSYNC', RELIABLE_JOIN_MATCH: 'JOIN', RELIABLE_GET_MATCH_LIST: 'LIST',
    RELIABLE_PING: 'PING',
    [names.netNum]: (number: number) => `n${number}`, [names.mapChunks]: null, [names.netLog]: [], Event: (...args: unknown[]) => log.net.push(args),
  });
  set('lockedArrays', []);
  set('triggerActivator', -1); set('triggerPower', 0);
  const runnerName: string = names.runTrigger;
  const runnerNamedLikeTheGamesReadingEnabledTheWayItDoesSoTheRunLogSeesIt = ({ [runnerName](index: number) {
    log.runs.push(index);
    const trigger = globals[names.triggers][index];
    log.ran.push({ i: index, uid: trigger.uid, types: [...trigger[names.trigTypes]], A: [...trigger[names.trigTargetA]], B: [...trigger[names.trigTargetB]], by: globals[names.triggerActivator] });
    return trigger[names.trigEnabled];
  } })[runnerName];
  set('runTrigger', runnerNamedLikeTheGamesReadingEnabledTheWayItDoesSoTheRunLogSeesIt);
  set('openChat', nothing); set('chatPopups', []); set('chatPanel', null);

  const domNodeWithWhatThePanelAndTheLogUse = (): Record<string, any> => ({
    style: {}, childNodes: [], parent: null,
    get textContent() { return ''; },
    set textContent(value: unknown) { this.childNodes = []; this.text = value; },
    get firstChild() { return this.childNodes[0]; },
    append(...children: any[]) { for (const child of children) { if (child && typeof child === 'object') child.parent = this; this.childNodes.push(child); } },
    remove() { if (this.parent) this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 1); },
    replaceWith(replacement: any) {
      const parent = this.parent;
      if (!parent) return;
      parent.childNodes[parent.childNodes.indexOf(this)] = replacement;
      replacement.parent = parent;
      this.parent = null;
    },
    after(next: any) { const parent = this.parent; if (!parent) return; parent.childNodes.splice(parent.childNodes.indexOf(this) + 1, 0, next); next.parent = parent; },
    select: nothing,
    on: {},
    addEventListener(type: string, listener: unknown) { (this.on[type] ||= []).push(listener); },
    contains(target: unknown) { return target === this || this.childNodes.includes(target); }, focus: nothing, blur: nothing,
  });
  const node = domNodeWithWhatThePanelAndTheLogUse;
  type Listener = (event: any) => void;
  const documentListeners: Record<'capture' | 'bubble', Record<string, Listener[]>> = { capture: {}, bubble: {} };
  const phaseOf = (capture: unknown) => (capture ? 'capture' : 'bubble');
  const documentAdd = (type: string, listener: Listener, capture?: unknown) => { (documentListeners[phaseOf(capture)][type] ||= []).push(listener); };
  const documentRemove = (type: string, listener: Listener, capture?: unknown) => {
    const list = documentListeners[phaseOf(capture)][type] || [];
    if (list.includes(listener)) list.splice(list.indexOf(listener), 1);
  };
  const windowListenersGoToTheGraphicsStageLikeTheGamesFlashJsWhichSendsNoDomEvents = nothing;
  globals.addEventListener = windowListenersGoToTheGraphicsStageLikeTheGamesFlashJsWhichSendsNoDomEvents;
  globals.removeEventListener = nothing;
  const dispatchCaptureThenTargetAndParentsThenDocumentThenWindowHandler = (target: any, type: string, props: Record<string, unknown> = {}) => {
    let stopped = false;
    let stoppedImmediately = false;
    const event = {
      type, target, button: 0, defaultPrevented: false, ...props,
      stopPropagation() { stopped = true; }, stopImmediatePropagation() { stopped = stoppedImmediately = true; },
      preventDefault() { this.defaultPrevented = true; },
    };
    const runListeners = (list?: Listener[]) => { for (const listener of [...(list || [])]) { if (stoppedImmediately) return; listener(event); } };
    runListeners(documentListeners.capture[type]);
    for (let current = target; current && !stopped; current = current.parent) runListeners(current.on[type]);
    if (!stopped) runListeners(documentListeners.bubble[type]);
    const windowHandler = globals[`on${type}`];
    if (!stopped && typeof windowHandler === 'function') windowHandler(event);
    return event;
  };
  const listeners: Record<string, Listener> = {};
  set('uiOverlay', class GameOverlay { static overlay = node(); });
  const drawn: any[] = [];
  const contextThatRecordsWhatIsDrawn = () => new Proxy<Record<string | symbol, unknown>>({}, {
    get: (target, key) => (key in target ? target[key] : (...args: unknown[]) => drawn.push([key, ...args])),
    set: (target, key, value) => { target[key] = value; drawn.push(['set', key, value]); return true; },
  });
  const canvasNode = (width: number, height: number) => ({
    ...node(), width, height, getContext: contextThatRecordsWhatIsDrawn,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: width / GAME_CANVAS_RESOLUTION, height: height / GAME_CANVAS_RESOLUTION }),
    after: nothing, remove: nothing,
  });
  globals.document = {
    createElement: (tag: string) => (tag === 'canvas' ? canvasNode(0, 0) : node()),
    addEventListener: (type: string, listener: Listener, capture?: unknown) => { listeners[type] = listener; documentAdd(type, listener, capture); },
    removeEventListener: documentRemove,
    pointerLockElement: null,
    head: node(),
    getElementById(id: string) {
      const find = (current: any): any => (current && current.id === id ? current : (current?.childNodes || []).map(find).find(Boolean));
      return find(this.head) || null;
    },
  };
  globals.stage = { currentFrameLabel: 'gaming', addEventListener: (_type: string, listener: Listener) => { listeners.frame = listener; }, runEvents: nothing };
  globals.Event = { ENTER_FRAME: 'enterFrame' };
  globals.KeyboardEvent = { KEY_DOWN: 'keyDown', KEY_UP: 'keyUp' };
  globals.gravity = 0.5;
  globals.system_non_stop = true;
  globals.game = { x: 0, y: 0, scaleX: 1, scaleY: 1, parent: { x: 0, y: 0, scaleX: 1, scaleY: 1 }, clearMCInterpolationData: nothing };
  globals.game_canvas = canvasNode(GAME_CANVAS_WIDTH, GAME_CANVAS_HEIGHT);
  globals.game_canvas.style.zIndex = '2';
  log.drawn = drawn;
  const frames: unknown[] = [];
  globals.requestAnimationFrame = (callback: unknown) => frames.push(callback);
  globals.cancelAnimationFrame = () => { frames.length = 0; };
  log.frames = frames;
  globals.graphics_3d = globals.graphics_3d_front = { clearMCInterpolationData: nothing };
  const store = new Map<string, string>();
  globals.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: unknown) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
  };
  globals.fetch = () => Promise.reject(new Error('no desktop wrapper in tests'));
  const intervals: (() => void)[] = [];
  globals.setInterval = (callback: () => void) => intervals.push(callback);
  globals.clearInterval = nothing;
  const realLog = console.log;
  console.log = (...parts: unknown[]) => {
    const line = parts.join(' ');
    if (line.startsWith(CONSOLE_PRINT_PREFIX)) log.printed.push(line.slice(CONSOLE_PRINT_PREFIX.length));
    else realLog(...parts);
  };

  const globalsBeforeConsole = Object.keys(globals);
  await import(pathToFileURL(entry).href);
  await new Promise((resolve) => { setImmediate(resolve); });
  const bootPollFindsTheGameReadyAndStartsTheConsole = intervals.shift();
  bootPollFindsTheGameReadyAndStartsTheConsole?.();

  return {
    G: globals, N: names, globals, names, log, store, chars, triggers, globalsBeforeConsole,
    intervals,
    player: chars[0],
    run(line) {
      log.printed.length = 0;
      globals.pb2dev.run(line);
      return log.printed.filter((printed) => !printed.startsWith(ECHOED_COMMAND_PREFIX)) as Lines;
    },
    frame(count = 1) { for (let frame = 0; frame < count; frame++) listeners.frame?.(undefined); },
    press(code, modifiers = {}) {
      log.printed.length = 0;
      const event = { code, key: code, target: null, repeat: false, preventDefault: nothing, stopImmediatePropagation: nothing, ...modifiers };
      listeners.keydown?.(event);
      listeners.keyup?.(event);
      return log.printed.slice() as Lines;
    },
    setMP(on) { globals[names.mp] = on; },
    dispatch: dispatchCaptureThenTargetAndParentsThenDocumentThenWindowHandler,
  };
}
