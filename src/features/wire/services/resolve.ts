import { stringOf } from '#kernel/text/text-of.ts';
import { settings } from '#console/kernel/state/store.ts';
import { level, playerFields as fields, playerGame as game, words } from '#console/kernel/game/player-access.ts';
import { teamsMatching } from '#console/kernel/game/teams.ts';
import { AIM_RADIUS_DEFAULT, EMPTY_JSON, NEAREST_DEFAULT, NO_GUN } from '../constants.ts';
import { CHANNEL, CHAR, DEFAULT_RULE as RULE, FIELD_KIND as KIND, FILTER, SELECTOR, SETTING, SIDE_WORDS, TOKEN, WIRE_VALUE } from '../keys.ts';
import { WIRE_TEXT as TEXT } from '../text.ts';
import { toWire } from '../domain/units.ts';
import type { Parsed } from '../domain/parse.ts';
import type { Field, Message } from '../domain/types.ts';

export type OutPart = Readonly<{ fieldName: string; encode: boolean; reply: boolean; number?: number; text?: string; typed: string; scale?: number }>;
export type Resolution = Readonly<{ message: Message; parts: readonly OutPart[]; report: readonly string[] }>;

type Point = { x: number; y: number };

const store = settings as unknown as { effective(key: string): unknown };

const radius = (): number => {
  const value = Number(store.effective(SETTING.radius));
  return Number.isFinite(value) && value > 0 ? value : AIM_RADIUS_DEFAULT;
};

const ioSlots = (): number[] => {
  const characters = game.chars();
  const slots: number[] = [];
  for (let index = 0; index < game.charCount(); index++) if (characters[index]?.io) slots.push(index);
  return slots;
};

const posOf = (index: number): Point => {
  const character = game.chars()[index];
  const point = Number(character?.[fields.REF_PT] ?? index);
  return { x: game.ptX()[point] ?? character?.x ?? 0, y: game.ptY()[point] ?? character?.y ?? 0 };
};

const others = (): number[] => ioSlots().filter((slot) => slot !== game.me());

const crosshair = (): Point => {
  const me = level.player();
  return { x: Number(me.tarx), y: Number(me.tary) };
};

const distance = (from: Point, to: Point): number => Math.hypot(from.x - to.x, from.y - to.y);

const byDistance = (slots: readonly number[], from: Point): number[] => [...slots].sort((left, right) => distance(posOf(left), from) - distance(posOf(right), from));

const afterSeparator = (token: string, fallback: number): number => {
  const at = token.indexOf(TOKEN.ruleSeparator);
  if (at === -1) return fallback;
  const value = Number(token.slice(at + TOKEN.ruleSeparator.length));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

function filterSlots(name: string): number[] {
  const lowered = name.toLowerCase();
  if (lowered === FILTER.players) return ioSlots().filter((slot) => game.chars()[slot]?.[fields.HUMAN]);
  if (lowered === FILTER.bots) return ioSlots().filter((slot) => !game.chars()[slot]?.[fields.HUMAN]);
  const teams = new Set(teamsMatching(lowered, game.teamNames()).map((entry) => entry.team));
  return ioSlots().filter((slot) => teams.has(Number(game.chars()[slot]?.team)));
}

const teamOf = (slot: number): number => Number(game.chars()[slot]?.team);

function poolOf(word: string): number[] | null {
  const side = SIDE_WORDS[word.toLowerCase()];
  if (side === SELECTOR.ally) return others().filter((slot) => teamOf(slot) === teamOf(game.me()));
  if (side === SELECTOR.enemy) return others().filter((slot) => teamOf(slot) !== teamOf(game.me()));
  if (word.startsWith(TOKEN.filterPrefix)) return filterSlots(word.slice(TOKEN.filterPrefix.length));
  return null;
}

function ruleSlots(rule: string, pool: readonly number[]): number[] | null {
  const lowered = rule.toLowerCase();
  if (lowered === SELECTOR.aim) {
    const nearest = byDistance(pool, crosshair())[0];
    return nearest !== undefined && distance(posOf(nearest), crosshair()) <= radius() ? [nearest] : [];
  }
  if (lowered === SELECTOR.near || lowered.startsWith(SELECTOR.near + TOKEN.ruleSeparator)) {
    return byDistance(pool, crosshair()).slice(0, afterSeparator(lowered, NEAREST_DEFAULT));
  }
  if (lowered === SELECTOR.area || lowered.startsWith(SELECTOR.area + TOKEN.ruleSeparator)) {
    const reach = afterSeparator(lowered, radius());
    return pool.filter((slot) => distance(posOf(slot), crosshair()) <= reach);
  }
  return null;
}

const splitFilter = (token: string): { pool: number[] | null; rule: string | null } => {
  const at = token.indexOf(TOKEN.ruleSeparator);
  const head = at === -1 ? token : token.slice(0, at);
  return { pool: poolOf(head), rule: at === -1 ? null : token.slice(at + TOKEN.ruleSeparator.length) };
};

function selectorSlots(selector: string): number[] {
  const token = selector.trim();
  if (token.includes(TOKEN.listSeparator)) {
    const seen = new Set<number>();
    for (const piece of token.split(TOKEN.listSeparator)) for (const slot of selectorSlots(piece)) seen.add(slot);
    return [...seen];
  }
  const lowered = token.toLowerCase();
  if (lowered === SELECTOR.all) return ioSlots();
  if (lowered === SELECTOR.me) return [game.me()];
  const { pool, rule } = splitFilter(token);
  if (pool) {
    if (rule === null) return pool;
    const picked = ruleSlots(rule, pool.filter((slot) => slot !== game.me()));
    if (!picked) throw new Error(TEXT.unknownRule(token, rule));
    return picked;
  }
  return ruleSlots(token, others()) ?? [level.resolve(token)];
}

const isFilterOnly = (selector: string): boolean => !selector.includes(TOKEN.listSeparator) && splitFilter(selector.trim()).pool !== null && splitFilter(selector.trim()).rule === null;

const defaultSelector = (rule: Field['default']): string => {
  if (rule === RULE.area) return SELECTOR.area;
  if (rule === RULE.near) return SELECTOR.near;
  if (rule === RULE.self) return SELECTOR.me;
  if (rule === RULE.ally) return SELECTOR.ally;
  return SELECTOR.aim;
};

function resolveTargets(field: Field, raw: string | undefined): number[] {
  if (!level.isActive()) throw new Error(TEXT.needsLevel(field.name));
  const selector = raw ?? defaultSelector(field.default);
  const slots = selectorSlots(selector);
  if (slots.length) return slots;
  const closest = byDistance(others(), crosshair())[0];
  if (closest !== undefined) throw new Error(TEXT.nobodyInRange(selector, level.label(closest)));
  throw new Error(TEXT.nobodyAtAll(selector));
}

function singleTarget(field: Field, raw: string | undefined): number {
  const selector = raw ?? defaultSelector(field.default);
  const slots = resolveTargets(field, isFilterOnly(selector) ? selector + TOKEN.ruleSeparator + SELECTOR.aim : selector);
  if (slots.length > 1) throw new Error(TEXT.tooMany(field.name, slots.length));
  return slots[0] as number;
}

const defaultNumber = (rule: Field['default'], targetSlot: number | null): number => {
  if (rule === RULE.myPosX) return Math.round(posOf(game.me()).x);
  if (rule === RULE.myPosY) return Math.round(posOf(game.me()).y);
  if (rule === RULE.myHmax) return Number(level.player()[fields.MAX_HP] ?? 0);
  if (rule === RULE.myGun) return Number(level.player()[CHAR.currentGun] ?? NO_GUN);
  if (rule === RULE.targetRespawns && targetSlot !== null) return Number(game.chars()[targetSlot]?.[CHAR.respawns] ?? 0);
  return 0;
};

function numberPart(field: Field, raw: string | undefined, flags: Parsed['flags'], targetSlot: number | null): OutPart {
  if (raw === undefined) {
    const value = defaultNumber(field.default, targetSlot);
    return { fieldName: field.name, encode: true, reply: false, number: value, typed: stringOf(value), scale: field.scale };
  }
  const rawValue = flags.raw || raw.startsWith(TOKEN.rawPrefix);
  const written = raw.startsWith(TOKEN.rawPrefix) ? raw.slice(TOKEN.rawPrefix.length) : raw;
  const value = Number(written);
  if (!Number.isFinite(value)) throw new Error(TEXT.notANumber(field.name, raw));
  return { fieldName: field.name, encode: true, reply: false, number: rawValue ? Math.round(value) : toWire(value, field.scale), typed: raw, scale: rawValue ? undefined : field.scale };
}

function scalarPart(field: Field, raw: string | undefined, flags: Parsed['flags'], targetSlot: number | null): OutPart {
  if (field.default === RULE.replyId) return { fieldName: field.name, encode: false, reply: true, typed: field.name };
  if (field.kind === KIND.number || field.kind === KIND.decimal) return numberPart(field, raw, flags, targetSlot);
  if (field.kind === KIND.authId) {
    if (raw !== undefined && words.isNumber(raw)) return { fieldName: field.name, encode: false, reply: false, text: raw, typed: raw };
    const slot = singleTarget(field, raw);
    return { fieldName: field.name, encode: false, reply: false, text: stringOf(game.chars()[slot]?.[fields.AUTH_ID] ?? ''), typed: level.label(slot) };
  }
  if (field.kind === KIND.flag) {
    return { fieldName: field.name, encode: false, reply: false, text: raw && raw !== WIRE_VALUE.off ? WIRE_VALUE.on : '', typed: raw ?? '' };
  }
  if (field.kind === KIND.choice) {
    if (raw === undefined) throw new Error(TEXT.requiredField(field.name));
    if (field.choices && !field.choices.includes(raw)) throw new Error(TEXT.notAChoice(field.name, raw, field.choices));
    return { fieldName: field.name, encode: false, reply: false, text: raw, typed: raw };
  }
  if (field.kind === KIND.json) {
    const value = raw ?? (field.default === RULE.empty ? EMPTY_JSON : undefined);
    if (value === undefined) throw new Error(TEXT.requiredField(field.name));
    try { JSON.parse(value); } catch { throw new Error(TEXT.badJson(field.name, value)); }
    return { fieldName: field.name, encode: false, reply: false, text: value, typed: value };
  }
  const value = raw ?? (field.default === RULE.empty ? '' : undefined);
  if (value === undefined) throw new Error(TEXT.requiredField(field.name));
  return { fieldName: field.name, encode: false, reply: false, text: value, typed: value };
}

export function resolve(parsed: Parsed): Resolution {
  const { message, assignments, flags } = parsed;
  if (message.channel === CHANNEL.match) level.require();
  const report: string[] = [];
  const raw = (field: Field): string | undefined => assignments.get(field.name.toLowerCase());

  const primary = message.fields.find((field) => field.kind === KIND.slot || field.kind === KIND.authId);
  let targetSlot: number | null = null;
  if (primary && primary.kind === KIND.slot) {
    targetSlot = singleTarget(primary, raw(primary));
    report.push(TEXT.resolvedTo(primary.name, level.label(targetSlot)));
  }

  const topParts = message.fields.map((field) => {
    if (field === primary && targetSlot !== null) return { fieldName: field.name, encode: true, reply: false, number: targetSlot, typed: level.label(targetSlot) } satisfies OutPart;
    return scalarPart(field, raw(field), flags, targetSlot);
  });

  const group = message.group;
  if (!group) return { message, parts: topParts, report };

  const victimField = group.find((field) => field.kind === KIND.slot);
  const victims = victimField ? resolveTargets(victimField, raw(victimField)) : [game.me()];
  report.push(TEXT.resolvedTargets(victimField?.name ?? SELECTOR.all, victims.map((slot) => level.label(slot)).join(TOKEN.listSeparator + ' ')));
  const groupParts = victims.flatMap((slot) => group.map((field) => {
    if (field === victimField) return { fieldName: field.name, encode: true, reply: false, number: slot, typed: level.label(slot) } satisfies OutPart;
    return scalarPart(field, raw(field), flags, slot);
  }));
  return { message, parts: [...topParts, ...groupParts], report };
}
