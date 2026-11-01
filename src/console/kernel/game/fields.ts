import { EMPTY_SLOT, FIRST_SLOT, LAST_SLOT } from './constants.ts';
import { FIELD, slotField } from './keys.ts';
import { NAMES } from './names.ts';

export { EMPTY_SLOT, FIRST_SLOT, LAST_SLOT, slotField };

const field = (name: string | undefined): string => name ?? '';

export const GAME_FIELDS = Object.freeze({
  HP: FIELD.hp,
  MAX_HP: FIELD.maxHp,
  DEAD: field(NAMES.dead),
  DYING: field(NAMES.dying),
  JUMP: field(NAMES.jump),
  WALK: field(NAMES.walk),
  NO_SWORDS: field(NAMES.noSwords),
  REF_PT: field(NAMES.refPoint),
  AFTER_MOVE: field(NAMES.afterMove),
  INDEX: field(NAMES.charIndex),
  ON_DEATH: field(NAMES.charOnDeath),
  AIM: field(NAMES.aimAngle),
  FACING: field(NAMES.facing),
  VEHICLE: field(NAMES.charVehicle),
  HUMAN: field(NAMES.charHuman),
  HEAD_HP: field(NAMES.headHp),
  HEAD_OFF: field(NAMES.headOff),
  FACE_HP: field(NAMES.faceHp),
  FACE_GONE: field(NAMES.faceGone),
  LEGS_HP: field(NAMES.legsHp),
  LEGS_BROKEN: field(NAMES.legsBroken),
  ARMS_HP: field(NAMES.armsHp),
  ARMS_BROKEN: field(NAMES.armsBroken),
  G_PELLETS: field(NAMES.gunPellets),
  G_SPREAD: field(NAMES.gunSpread),
  G_BLOOM: field(NAMES.gunBloom),
  G_RATE: field(NAMES.gunRate),
  G_RECOIL: field(NAMES.gunRecoil),
  G_SLOT: field(NAMES.gunSlot),
  G_FIXED: field(NAMES.gunFixed),
  G_PT_A: field(NAMES.gunPtA),
  G_PT_B: field(NAMES.gunPtB),
  B_DMG: field(NAMES.bulletDamage),
  B_LIFE: field(NAMES.bulletLife),
  B_OWNER: field(NAMES.bulletOwner),
  T_ENABLED: field(NAMES.trigEnabled),
  T_AT_START: field(NAMES.trigAtStart),
  T_MAX_CALLS: field(NAMES.trigMaxCalls),
  T_CALLS: field(NAMES.trigCalls),
  T_ACTIONS: field(NAMES.trigActionCount),
  T_A: field(NAMES.trigTargetA),
  T_B: field(NAMES.trigTargetB),
  T_TYPES: field(NAMES.trigTypes),
  R_USE_ON: field(NAMES.regionUseOn),
  R_TRIGGER: field(NAMES.regionTrigger),
  R_USES_TIMER: field(NAMES.regionUsesTimer),
  TIMER_TARGET: field(NAMES.timerTarget),
  CHAT_TEXT: field(NAMES.chatPanelText),
});

export const GUN_SLOTS: readonly number[] = Object.freeze(Array.from({ length: LAST_SLOT - FIRST_SLOT + 1 }, (_, offset) => FIRST_SLOT + offset));
