// Applies your settings to the game every frame. No game function is patched (the
// game's anti-tamper check compares function source): values are forced from an
// ENTER_FRAME listener and put back when a setting is removed or the level ends.
import { isFeatureOn } from '../../../../src/console/flags.ts';
import { game } from '../../../../src/console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';
import { player, isActive } from '../../../../src/console/kernel/game/level.ts';
import { KEY } from '../../../../src/console/kernel/state/schema.ts';
import { settings } from '../../../../src/console/kernel/state/store.ts';
import { force, original, restore, restoreObj, restoreAll } from './force.js';
import { installGod, uninstallGodExcept, uninstallAllGod } from './god.js';
import { heldBack, guarding, REASON, BYPASS_HINT } from './server-checks.js';
import { print } from '../ui/log.js';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';

// The game's walk acceleration per tick, which "speed" scales.
const STAND_WALK = (sit) => (2 - sit * 0.75) / 2 * 3;
const AIR_WALK = 0.4;
const AIR_TOP_SPEED = 3; // air control stops adding speed past this (x the multiplier)
const FLY_DAMPING = 0.8; // vertical speed kept per tick while flying without a key held

const lastMaxHp = new WeakMap(); // character -> max_hp last applied
const hpBonusApplied = new WeakMap(); // character -> bonus already added to its max HP
const seenBullets = new WeakSet();
const forcedGuns = new Set();
let origGravity = null;
let wasActive = false;
let prevDt = null;
let activeChanged = () => {};

export const levelWasActive = () => wasActive;
export const onActiveChange = (fn) => { activeChanged = fn; };
export const hpBonusAppliedTo = (p) => hpBonusApplied.get(p) || 0;

const on = (key) => settings.has(key);
const val = (key) => settings.get(key);

// Total bonus for a character whose own (game) max HP is `base`: flat plus a percent of
// base. Percents add up (+50% twice = +100% of base), they do not compound.
// A bonus held back in a ranked match (server-checks.js) counts as 0.
export function hpBonusFor(base) {
  const flat = settings.effective(KEY.HP_BONUS) ?? 0;
  const pct = settings.effective(KEY.HP_BONUS_PCT) ?? 0;
  return (heldBack(KEY.HP_BONUS, flat) ? 0 : flat) + (heldBack(KEY.HP_BONUS_PCT, pct) ? 0 : Math.round(base * pct / 100));
}

// Your character's own max HP, without max_hp or a bonus from the console; null
// outside a level.
export const gameMaxOf = (p) => (p ? original(p, GAME_FIELDS.MAX_HP) - hpBonusAppliedTo(p) : null);
export const gameMaxHp = () => (isActive() ? gameMaxOf(player()) : null);

// max_hp is set and not held back.
const maxHpOn = (p) => on(KEY.MAX_HP) && !heldBack(KEY.MAX_HP, val(KEY.MAX_HP), gameMaxOf(p));

// Says once which of your settings multiplayer holds back, and again when that changes.
let heldNote = '';
function noteHeld(p) {
  if (!guarding()) { heldNote = ''; return; }
  const held = [KEY.MAX_HP, KEY.HP_BONUS, KEY.HP_BONUS_PCT]
    .filter((k) => settings.has(k) && heldBack(k, val(k), gameMaxOf(p)));
  const note = held.join(', ');
  if (note && note !== heldNote) print(`Ranked match: not applying ${note}: ${REASON.hp}. Your saved values are kept. ${BYPASS_HINT}.`, COLOR.warn);
  heldNote = note;
}

function forceMult(obj, field, key) {
  if (on(key)) force(obj, field, original(obj, field) * val(key));
  else restore(obj, field);
}

function applyGod(p) {
  const god = !!val(KEY.GOD);
  uninstallGodExcept(god ? p : null);
  if (!god) return;
  installGod(p, () => !!val(KEY.GOD));
  if (p[GAME_FIELDS.DEAD] && p[GAME_FIELDS.HP] > 0) p[GAME_FIELDS.DEAD] = false;
}

function applyMaxHp(p) {
  if (maxHpOn(p)) {
    force(p, GAME_FIELDS.MAX_HP, val(KEY.MAX_HP));
    if (lastMaxHp.get(p) !== val(KEY.MAX_HP)) { p[GAME_FIELDS.HP] = val(KEY.MAX_HP); lastMaxHp.set(p, val(KEY.MAX_HP)); }
  } else if (restore(p, GAME_FIELDS.MAX_HP)) {
    lastMaxHp.delete(p);
    if (p[GAME_FIELDS.HP] > p[GAME_FIELDS.MAX_HP]) p[GAME_FIELDS.HP] = p[GAME_FIELDS.MAX_HP];
  }
}

// Adds only the difference between the wanted bonus and what this character already
// got, so it is applied once per character object (a new life or level gets it again)
// and never adds up frame after frame. Skipped while max_hp forces the max.
function applyHpBonus(p) {
  if (maxHpOn(p) || !(p[GAME_FIELDS.HP] > 0) || p[GAME_FIELDS.DEAD]) return;
  const applied = hpBonusAppliedTo(p);
  const want = hpBonusFor(p[GAME_FIELDS.MAX_HP] - applied); // max minus applied = the game's own max
  if (want === applied) return;
  const newMax = Math.max(1, p[GAME_FIELDS.MAX_HP] + (want - applied));
  // Record only what was really added (max HP cannot go below 1), so removing the
  // bonus later takes back exactly that much.
  const real = newMax - p[GAME_FIELDS.MAX_HP];
  if (real === 0) return;
  p[GAME_FIELDS.MAX_HP] = newMax;
  // Raising max HP also gives that much HP; lowering it only caps current HP.
  p[GAME_FIELDS.HP] = Math.max(1, Math.min(p[GAME_FIELDS.HP] + Math.max(real, 0), p[GAME_FIELDS.MAX_HP]));
  hpBonusApplied.set(p, applied + real);
}

// Adds (speed - 1) x the game's own walk acceleration for the last tick. The game's
// speed field also scales knockback and balance loss, so it is left alone.
function applySpeed(p, running, dt) {
  if (!on(KEY.SPEED) || !running || !(p[GAME_FIELDS.HP] > 0)) return;
  const sp = val(KEY.SPEED);
  const walk = p[GAME_FIELDS.WALK];
  if (!walk) return;
  if (p.stand) p.tox += walk * STAND_WALK(p.sit) * dt * (sp - 1);
  else if (sp > 1 && p.tox * Math.sign(walk) < AIR_TOP_SPEED * sp) p.tox += walk * AIR_WALK * dt * (sp - 1);
}

function applyPlayer(p, running, dt) {
  noteHeld(p);
  applyGod(p);
  applyMaxHp(p);
  applyHpBonus(p);
  // Ranked match: never more HP than your max (what was held back above lowered it). God
  // ignores decreases, so it steps aside for this one write; it is put back next frame.
  if (guarding() && p[GAME_FIELDS.HP] > p[GAME_FIELDS.MAX_HP]) { uninstallGodExcept(null); p[GAME_FIELDS.HP] = p[GAME_FIELDS.MAX_HP]; }
  applySpeed(p, running, dt);

  if (on(KEY.JUMP)) force(p, GAME_FIELDS.JUMP, val(KEY.JUMP));
  else restore(p, GAME_FIELDS.JUMP);

  // Gravity off: undo the gravity the last tick added (y moves before gravity is added).
  const fly = val(KEY.FLY) === true;
  if ((val(KEY.GRAVITY) === false || fly) && running && p[GAME_FIELDS.HP] > 0 && !p.stand) {
    p.toy -= game.getGravity() * dt;
  }

  // Swords: set the game's per-character "swords disabled" flag, then let the game
  // re-evaluate. Maps that disable swords for everyone ("nopsi") still win over "on".
  if (on(KEY.SWORDS)) {
    const off = !val(KEY.SWORDS);
    if (p[GAME_FIELDS.NO_SWORDS] !== off) { force(p, GAME_FIELDS.NO_SWORDS, off); game.refreshChar(game.me()); }
  } else if (restore(p, GAME_FIELDS.NO_SWORDS)) {
    game.refreshChar(game.me());
  }

  if (fly && running && p[GAME_FIELDS.HP] > 0) {
    const flySpeed = settings.effective(KEY.FLY_SPEED);
    if (game.keyUp()) p.toy = -flySpeed;
    else if (game.keyDown()) p.toy = flySpeed;
    else p.toy *= FLY_DAMPING;
  }
}

function applyGun(p) {
  const guns = game.guns();
  const gun = p.curwea >= 0 && guns ? guns[p.curwea] : null;
  for (const g of [...forcedGuns]) {
    if (g !== gun) { restoreObj(g); forcedGuns.delete(g); }
  }
  if (!gun || typeof gun !== 'object') return;
  forcedGuns.add(gun);
  forceMult(gun, GAME_FIELDS.G_RATE, KEY.FIRE_RATE);
  if (on(KEY.PELLETS)) force(gun, GAME_FIELDS.G_PELLETS, val(KEY.PELLETS));
  else restore(gun, GAME_FIELDS.G_PELLETS);
  forceMult(gun, GAME_FIELDS.G_SPREAD, KEY.SPREAD);
  if (on(KEY.SPREAD) && val(KEY.SPREAD) === 0) gun[GAME_FIELDS.G_BLOOM] = 0;
  forceMult(gun, GAME_FIELDS.G_RECOIL, KEY.RECOIL);
}

// Lets a bullet keep `keep` of the damage the game takes off after each hit.
function keepPenetration(b, keep) {
  let v = b[GAME_FIELDS.B_DMG];
  Object.defineProperty(b, GAME_FIELDS.B_DMG, {
    configurable: true,
    enumerable: true,
    get() { return v; },
    set(nv) {
      if (typeof nv === 'number' && nv < v) v = v - (v - nv) * (1 - keep);
      else v = nv;
    },
  });
}

function applyBullets() {
  const arr = game.bullets();
  const me = game.me();
  if (!arr) return;
  // The bullet list is a ring buffer that wraps around, so scan every slot. Scanning
  // only up to the newest slot index missed the shot just fired, and every single-shot
  // gun (railgun, sniper) got no damage/speed/range/penetration change.
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    if (!b || typeof b !== 'object' || seenBullets.has(b)) continue;
    seenBullets.add(b);
    if (b[GAME_FIELDS.B_OWNER] !== me) continue;
    if (on(KEY.BULLET_DAMAGE)) b[GAME_FIELDS.B_DMG] *= val(KEY.BULLET_DAMAGE);
    if (on(KEY.BULLET_SPEED)) { b.spx *= val(KEY.BULLET_SPEED); b.spy *= val(KEY.BULLET_SPEED); }
    if (on(KEY.BULLET_LIFE)) b[GAME_FIELDS.B_LIFE] *= val(KEY.BULLET_LIFE);
    if (on(KEY.PENETRATION) && val(KEY.PENETRATION) > 0) keepPenetration(b, val(KEY.PENETRATION));
  }
}

function applyWorld() {
  if (on(KEY.WORLD_GRAVITY)) {
    if (origGravity === null) origGravity = game.getGravity();
    if (game.getGravity() !== val(KEY.WORLD_GRAVITY)) game.setGravity(val(KEY.WORLD_GRAVITY));
  } else if (origGravity !== null) {
    game.setGravity(origGravity);
    origGravity = null;
  }
}

function cleanupAll() {
  uninstallAllGod();
  restoreAll();
  forcedGuns.clear();
  if (origGravity !== null) { game.setGravity(origGravity); origGravity = null; }
}

export function applyOverrides() {
  if (!isActive()) {
    if (wasActive) { cleanupAll(); wasActive = false; activeChanged(); }
    prevDt = null;
    return;
  }
  if (!wasActive) { wasActive = true; activeChanged(); }
  const p = player();
  const running = game.isRunning();
  const dt = prevDt === null ? game.playerDt() : prevDt;
  prevDt = game.playerDt();
  if (isFeatureOn('player')) applyPlayer(p, running, dt);
  applyGun(p);
  applyBullets();
  applyWorld();
}
