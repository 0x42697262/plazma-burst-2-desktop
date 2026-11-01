import { FEATURE } from '#shared/features/keys.ts';
import { isFeatureOn } from '../../flags.ts';
import { game } from '../game/bindings.ts';
import { GAME_FIELDS } from '../game/fields.ts';
import { player, isActive } from '../game/level.ts';
import type { Character } from '../game/types.ts';
import { KEY } from '../state/schema.ts';
import { settings } from '../state/store.ts';
import { print } from '../ui/log.ts';
import { COLOR } from '../core/keys.ts';
import {
  AIR_TOP_SPEED, AIR_WALK, FLY_DAMPING, MIN_MAX_HP, NO_WEAPON, PERCENT, STAND_WALK_BASE, STAND_WALK_SCALE, STAND_WALK_SIT_FACTOR,
} from './constants.ts';
import { NOTE_SEPARATOR } from './keys.ts';
import { TEXT } from './text.ts';
import { force, original, restore, restoreObj, restoreAll } from './force.ts';
import { installGod, uninstallGodExcept, uninstallAllGod } from './god.ts';
import { heldBack, guarding } from './server-checks.ts';

type Moving = Character & { stand?: boolean; sit: number; tox: number; toy: number; curwea: number };
type Bullet = Record<string, unknown> & { spx: number; spy: number };

const standWalk = (sit: number): number => (STAND_WALK_BASE - sit * STAND_WALK_SIT_FACTOR) * STAND_WALK_SCALE;

const lastMaxHp = new WeakMap<object, unknown>();
const hpBonusApplied = new WeakMap<object, number>();
const seenBullets = new WeakSet<object>();
const forcedGuns = new Set<object>();
let originalGravity: unknown = null;
let wasActive = false;
let previousTick: number | null = null;
let activeChanged: () => void = () => undefined;
let heldNote = '';

export const levelWasActive = (): boolean => wasActive;
export const onActiveChange = (listener: () => void): void => { activeChanged = listener; };
export const hpBonusAppliedTo = (character: object): number => hpBonusApplied.get(character) ?? 0;

const isSet = (key: string): boolean => settings.has(key);
const valueOf = (key: string): unknown => settings.get(key);
const numberOf = (key: string): number => valueOf(key) as number;
const maxHpOf = (character: Character): number => character[GAME_FIELDS.MAX_HP];
const healthOf = (character: Character): number => character[GAME_FIELDS.HP];

export function hpBonusFor(base: number): number {
  const flat = (settings.effective(KEY.HP_BONUS) as number | undefined) ?? 0;
  const percent = (settings.effective(KEY.HP_BONUS_PCT) as number | undefined) ?? 0;
  const flatBonus = heldBack(KEY.HP_BONUS, flat) ? 0 : flat;
  const percentBonus = heldBack(KEY.HP_BONUS_PCT, percent) ? 0 : Math.round(base * percent / PERCENT);
  return flatBonus + percentBonus;
}

export const gameMaxOf = (character: Character | null): number | null => (character ? (original(character, GAME_FIELDS.MAX_HP) as number) - hpBonusAppliedTo(character) : null);
export const gameMaxHp = (): number | null => (isActive() ? gameMaxOf(player()) : null);

const maxHpOn = (character: Character): boolean => isSet(KEY.MAX_HP) && !heldBack(KEY.MAX_HP, valueOf(KEY.MAX_HP), gameMaxOf(character));

function noteHeld(character: Character): void {
  if (!guarding()) {
    heldNote = '';
    return;
  }
  const held = [KEY.MAX_HP, KEY.HP_BONUS, KEY.HP_BONUS_PCT].filter((key) => settings.has(key) && heldBack(key, valueOf(key), gameMaxOf(character)));
  const note = held.join(NOTE_SEPARATOR);
  if (note && note !== heldNote) print(TEXT.notApplying(note), COLOR.warn);
  heldNote = note;
}

function forceMultiplied(target: Record<string, unknown>, field: string, key: string): void {
  if (isSet(key)) force(target, field, (original(target, field) as number) * numberOf(key));
  else restore(target, field);
}

function applyGod(character: Character): void {
  const isGod = !!valueOf(KEY.GOD);
  uninstallGodExcept(isGod ? character : null);
  if (!isGod) return;
  installGod(character, () => !!valueOf(KEY.GOD));
  if (character[GAME_FIELDS.DEAD] && healthOf(character) > 0) character[GAME_FIELDS.DEAD] = false;
}

function applyMaxHp(character: Character): void {
  if (maxHpOn(character)) {
    force(character, GAME_FIELDS.MAX_HP, valueOf(KEY.MAX_HP));
    if (lastMaxHp.get(character) !== valueOf(KEY.MAX_HP)) {
      character[GAME_FIELDS.HP] = numberOf(KEY.MAX_HP);
      lastMaxHp.set(character, valueOf(KEY.MAX_HP));
    }
  } else if (restore(character, GAME_FIELDS.MAX_HP)) {
    lastMaxHp.delete(character);
    if (healthOf(character) > maxHpOf(character)) character[GAME_FIELDS.HP] = maxHpOf(character);
  }
}

function applyHpBonus(character: Character): void {
  if (maxHpOn(character) || !(healthOf(character) > 0) || character[GAME_FIELDS.DEAD]) return;
  const applied = hpBonusAppliedTo(character);
  const wanted = hpBonusFor(maxHpOf(character) - applied);
  if (wanted === applied) return;
  const newMax = Math.max(MIN_MAX_HP, maxHpOf(character) + (wanted - applied));
  const reallyAdded = newMax - maxHpOf(character);
  if (reallyAdded === 0) return;
  character[GAME_FIELDS.MAX_HP] = newMax;
  character[GAME_FIELDS.HP] = Math.max(MIN_MAX_HP, Math.min(healthOf(character) + Math.max(reallyAdded, 0), maxHpOf(character)));
  hpBonusApplied.set(character, applied + reallyAdded);
}

function applySpeed(character: Moving, running: boolean, tick: number): void {
  if (!isSet(KEY.SPEED) || !running || !(healthOf(character) > 0)) return;
  const speed = numberOf(KEY.SPEED);
  const walk = character[GAME_FIELDS.WALK] as number;
  if (!walk) return;
  if (character.stand) character.tox += walk * standWalk(character.sit) * tick * (speed - 1);
  else if (speed > 1 && character.tox * Math.sign(walk) < AIR_TOP_SPEED * speed) character.tox += walk * AIR_WALK * tick * (speed - 1);
}

function applySwords(character: Moving): void {
  if (isSet(KEY.SWORDS)) {
    const swordsOff = !valueOf(KEY.SWORDS);
    if (character[GAME_FIELDS.NO_SWORDS] !== swordsOff) {
      force(character, GAME_FIELDS.NO_SWORDS, swordsOff);
      game.refreshChar(game.me());
    }
  } else if (restore(character, GAME_FIELDS.NO_SWORDS)) {
    game.refreshChar(game.me());
  }
}

function applyPlayer(character: Moving, running: boolean, tick: number): void {
  noteHeld(character);
  applyGod(character);
  applyMaxHp(character);
  applyHpBonus(character);
  if (guarding() && healthOf(character) > maxHpOf(character)) {
    uninstallGodExcept(null);
    character[GAME_FIELDS.HP] = maxHpOf(character);
  }
  applySpeed(character, running, tick);

  if (isSet(KEY.JUMP)) force(character, GAME_FIELDS.JUMP, valueOf(KEY.JUMP));
  else restore(character, GAME_FIELDS.JUMP);

  const isFlying = valueOf(KEY.FLY) === true;
  const isAlive = healthOf(character) > 0;
  if ((valueOf(KEY.GRAVITY) === false || isFlying) && running && isAlive && !character.stand) {
    character.toy -= (game.getGravity() as number) * tick;
  }

  applySwords(character);

  if (isFlying && running && isAlive) {
    const flySpeed = settings.effective(KEY.FLY_SPEED) as number;
    if (game.keyUp()) character.toy = -flySpeed;
    else if (game.keyDown()) character.toy = flySpeed;
    else character.toy *= FLY_DAMPING;
  }
}

function applyGun(character: Moving): void {
  const guns = game.guns();
  const held = character.curwea >= NO_WEAPON && guns ? guns[character.curwea] ?? null : null;
  for (const gun of [...forcedGuns]) {
    if (gun !== held) {
      restoreObj(gun);
      forcedGuns.delete(gun);
    }
  }
  if (!held || typeof held !== 'object') return;
  forcedGuns.add(held);
  forceMultiplied(held, GAME_FIELDS.G_RATE, KEY.FIRE_RATE);
  if (isSet(KEY.PELLETS)) force(held, GAME_FIELDS.G_PELLETS, valueOf(KEY.PELLETS));
  else restore(held, GAME_FIELDS.G_PELLETS);
  forceMultiplied(held, GAME_FIELDS.G_SPREAD, KEY.SPREAD);
  if (isSet(KEY.SPREAD) && valueOf(KEY.SPREAD) === 0) held[GAME_FIELDS.G_BLOOM] = 0;
  forceMultiplied(held, GAME_FIELDS.G_RECOIL, KEY.RECOIL);
}

function keepPenetration(bullet: Bullet, keep: number): void {
  let damage = bullet[GAME_FIELDS.B_DMG];
  Object.defineProperty(bullet, GAME_FIELDS.B_DMG, {
    configurable: true,
    enumerable: true,
    get: () => damage,
    set: (next: unknown) => {
      const isLoss = typeof next === 'number' && typeof damage === 'number' && next < damage;
      damage = isLoss ? damage as number - (damage as number - next) * (1 - keep) : next;
    },
  });
}

function applyBullets(): void {
  const bullets = game.bullets() as (Bullet | null | undefined)[] | null;
  const me = game.me();
  if (!bullets) return;
  for (const bullet of bullets) {
    if (!bullet || typeof bullet !== 'object' || seenBullets.has(bullet)) continue;
    seenBullets.add(bullet);
    if (bullet[GAME_FIELDS.B_OWNER] !== me) continue;
    if (isSet(KEY.BULLET_DAMAGE)) bullet[GAME_FIELDS.B_DMG] = (bullet[GAME_FIELDS.B_DMG] as number) * numberOf(KEY.BULLET_DAMAGE);
    if (isSet(KEY.BULLET_SPEED)) {
      bullet.spx *= numberOf(KEY.BULLET_SPEED);
      bullet.spy *= numberOf(KEY.BULLET_SPEED);
    }
    if (isSet(KEY.BULLET_LIFE)) bullet[GAME_FIELDS.B_LIFE] = (bullet[GAME_FIELDS.B_LIFE] as number) * numberOf(KEY.BULLET_LIFE);
    if (isSet(KEY.PENETRATION) && numberOf(KEY.PENETRATION) > 0) keepPenetration(bullet, numberOf(KEY.PENETRATION));
  }
}

function applyWorld(): void {
  if (isSet(KEY.WORLD_GRAVITY)) {
    if (originalGravity === null) originalGravity = game.getGravity();
    if (game.getGravity() !== valueOf(KEY.WORLD_GRAVITY)) game.setGravity(valueOf(KEY.WORLD_GRAVITY));
  } else if (originalGravity !== null) {
    game.setGravity(originalGravity);
    originalGravity = null;
  }
}

function cleanupAll(): void {
  uninstallAllGod();
  restoreAll();
  forcedGuns.clear();
  if (originalGravity !== null) {
    game.setGravity(originalGravity);
    originalGravity = null;
  }
}

export function applyOverrides(): void {
  if (!isActive()) {
    if (wasActive) {
      cleanupAll();
      wasActive = false;
      activeChanged();
    }
    previousTick = null;
    return;
  }
  if (!wasActive) {
    wasActive = true;
    activeChanged();
  }
  const character = player() as Moving;
  const running = !!game.isRunning();
  const tick = previousTick ?? game.playerDt();
  previousTick = game.playerDt();
  if (isFeatureOn(FEATURE.player)) applyPlayer(character, running, tick);
  applyGun(character);
  applyBullets();
  applyWorld();
}
