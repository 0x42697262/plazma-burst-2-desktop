// Property names on the game's objects. The obfuscated ones change with every game
// version (see names.js); the plain ones are the game's own field names.
import { N } from './names.js';

export const F = Object.freeze({
  // Characters
  HP: 'hea',
  MAX_HP: 'hmax',
  DEAD: N.dead,
  DYING: N.dying, // knocked down, can still be revived by a defibrillator
  JUMP: N.jump, // jump multiplier
  WALK: N.walk, // this tick's walk direction * class speed factor (0 = not walking)
  NO_SWORDS: N.noSwords, // swords disabled (map trigger "disable swords")
  REF_PT: N.refPoint, // the character's reference physics point
  AFTER_MOVE: N.afterMove, // method the game calls after teleporting a character
  INDEX: N.charIndex, // own index in the characters or guns array
  ON_DEATH: N.charOnDeath, // trigger run when it dies (-1 = none)
  AIM: N.aimAngle,
  FACING: N.facing,
  // Body parts: HP field, "broken" flag
  HEAD_HP: N.headHp,
  HEAD_OFF: N.headOff,
  FACE_HP: N.faceHp,
  FACE_GONE: N.faceGone,
  LEGS_HP: N.legsHp,
  LEGS_BROKEN: N.legsBroken,
  ARMS_HP: N.armsHp,
  ARMS_BROKEN: N.armsBroken,
  // Guns
  G_PELLETS: N.gunPellets, // projectiles per shot
  G_SPREAD: N.gunSpread, // spread cone
  G_BLOOM: N.gunBloom, // current accumulated inaccuracy
  G_RATE: N.gunRate, // fire-rate multiplier
  G_RECOIL: N.gunRecoil, // recoil multiplier
  G_SLOT: N.gunSlot, // slot 0-9 (-2 = grenade item)
  G_FIXED: N.gunFixed, // cannot be carried (vehicle gun)
  G_PT_A: N.gunPtA, // the gun's two physics points
  G_PT_B: N.gunPtB,
  // Bullets
  B_DMG: N.bulletDamage,
  B_LIFE: N.bulletLife, // max age
  B_OWNER: N.bulletOwner, // owner character index
  // Triggers (enabled and calls left are shared with timers)
  T_ENABLED: N.trigEnabled,
  T_AT_START: N.trigAtStart,
  T_MAX_CALLS: N.trigMaxCalls, // -1 = unlimited
  T_CALLS: N.trigCalls, // calls left, -1 = unlimited
  T_ACTIONS: N.trigActionCount,
  T_A: N.trigTargetA, // per action: target A
  T_B: N.trigTargetB, // per action: target B
  T_TYPES: N.trigTypes, // per action: the map editor's action number
  // Regions and timers
  R_USE_ON: N.regionUseOn, // activation mode
  R_TRIGGER: N.regionTrigger, // trigger it runs (-1 = none)
  TIMER_TARGET: N.timerTarget,
  // Chat panel item: its text field
  CHAT_TEXT: N.chatPanelText,
});

// The nine weapon slots a character carries, and the field holding each one.
export const FIRST_SLOT = 1;
export const LAST_SLOT = 9;
export const GUN_SLOTS = Object.freeze(Array.from({ length: LAST_SLOT - FIRST_SLOT + 1 }, (_, i) => FIRST_SLOT + i));
export const EMPTY_SLOT = -1;
export const slotField = (n) => `slot${n}`;
