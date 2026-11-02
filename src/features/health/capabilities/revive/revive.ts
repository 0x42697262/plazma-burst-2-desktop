import { ARMS_SHARE, DEFAULT_MAX_HP, FACE_SHARE, HEAD_SHARE, LEGS_SHARE, MIN_PART_HP, REVIVE_HP_PER_POWER } from '../../constants.ts';
import { LEVEL_FAILED } from '../../keys.ts';
import { TEXT } from './text.ts';
import { level, playerFields as fields, playerGame as game, type Character } from '#console/kernel/game/player-access.ts';

type BodyPart = readonly [hpField: string, brokenField: string, share: number];

const BODY: readonly BodyPart[] = Object.freeze([
  [fields.HEAD_HP, fields.HEAD_OFF, HEAD_SHARE],
  [fields.FACE_HP, fields.FACE_GONE, FACE_SHARE],
  [fields.LEGS_HP, fields.LEGS_BROKEN, LEGS_SHARE],
  [fields.ARMS_HP, fields.ARMS_BROKEN, ARMS_SHARE],
] as const);

const maxHpOf = (character: Character): number => Number(character[fields.MAX_HP]) || DEFAULT_MAX_HP;

function repairBody(index: number, character: Character): number {
  let broken = 0;
  const hp = Math.max(maxHpOf(character), 1);
  for (const [part, flag, share] of BODY) {
    const isBroken = character[flag] === true;
    if (isBroken) broken++;
    if (!((character[part] as number) > 0) || isBroken) character[part] = Math.max(hp * share, MIN_PART_HP);
  }
  if (broken) game.updateBody(index);
  return broken;
}

export function reviveCharacter(index: number, report: (text: string) => void): boolean {
  const character = level.at(index);
  if (!character) throw level.noCharacter(index);
  if (!level.isDown(character)) return false;
  const repaired = repairBody(index, character);
  if (repaired) report(TEXT.repaired(repaired));
  game.healChar(index, character, Math.max(1, maxHpOf(character) / REVIVE_HP_PER_POWER));
  if (level.isDown(character)) {
    const stillBroken = BODY.filter(([, flag]) => character[flag] === true).length;
    throw new Error(TEXT.refusedRevive(index, stillBroken));
  }
  return true;
}

export function cancelLevelFailed(report: (text: string) => void): void {
  const hasFailed = !game.isMP() && game.levelState() === LEVEL_FAILED && !level.isDown(level.player());
  if (!hasFailed) return;
  const fade = game.fadeOverlay();
  const pausedByFade = !!fade && fade.alpha >= 1 && !game.isRunning();
  game.setLevelState('');
  game.setFailText('');
  if (fade) {
    fade.alpha = 0;
    fade.visible = false;
  }
  if (pausedByFade) game.setRunning(true);
  report(TEXT.failureCanceled);
}
