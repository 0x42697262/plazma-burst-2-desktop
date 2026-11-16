import { FPS_VALUES } from '../constants.ts';
import { LOGIC, PHYSICS, type Logic, type Physics } from '../keys.ts';
import { TEXT } from '../text.ts';

export type FpsChange = { fps?: number; physics?: Physics; logic?: Logic };

const PHYSICS_WORDS: readonly string[] = Object.values(PHYSICS);
const LOGIC_WORDS: readonly string[] = Object.values(LOGIC);

export function parseFpsWords(words: readonly string[]): FpsChange {
  const change: FpsChange = {};
  for (const raw of words) {
    const word = raw.toLowerCase();
    const fps = Number(word);
    const isFps = FPS_VALUES.includes(fps);
    const isTaken = (isFps && change.fps !== undefined)
      || (PHYSICS_WORDS.includes(word) && change.physics !== undefined)
      || (LOGIC_WORDS.includes(word) && change.logic !== undefined);
    if (isTaken) throw new Error(TEXT.usageError);
    if (isFps) change.fps = fps;
    else if (PHYSICS_WORDS.includes(word)) change.physics = word as Physics;
    else if (LOGIC_WORDS.includes(word)) change.logic = word as Logic;
    else throw new Error(TEXT.usageError);
  }
  return change;
}
