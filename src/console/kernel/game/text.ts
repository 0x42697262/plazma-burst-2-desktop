import { ACTION } from './constants.ts';

export const ACTION_NAMES: Readonly<Record<number, string>> = Object.freeze({
  [ACTION.DISABLE_TRIGGER]: 'disable trigger A',
  [ACTION.ENABLE_TRIGGER]: 'enable trigger A',
  [ACTION.ENABLE_TIMER]: 'enable timer A',
  [ACTION.DISABLE_TIMER]: 'disable timer A',
  [ACTION.MOVE_TO_REGION]: 'move character A to region B',
  [ACTION.RUN_TRIGGER]: 'run trigger A',
  [ACTION.JUMP_TO_TRIGGER]: 'continue in trigger A',
  [ACTION.RUN_REGION_TRIGGER]: 'run the trigger of region A',
  [ACTION.RUN_REGION_TRIGGER_TOO]: 'run the trigger of region A',
});

export const TEXT = Object.freeze({
  nameMissing: (key: string, file: string, findNames: string) => `game name "${key}" is not in ${file}. Run "${findNames}", then restart the app.`,
  levelRequired: 'start a level first',
  noCharacter: (index: number) => `no character #${index}. Type "chars".`,
  charLabel: (index: number, nickname: string) => `#${index} ${nickname}`.trim(),
  youAre: 'you are',
  isWho: (who: string) => `${who} is`,
  youHave: 'you have',
  hasWho: (who: string) => `${who} has`,
  othersSinglePlayer: 'other characters only work in single-player',
  noCharacterNamed: (query: string) => `no character named "${query}". Type "chars".`,
  ambiguousCharacter: (query: string, count: number, matches: string) => `"${query}" matches ${count} characters: ${matches}. Use the #.`,
  characterMatch: (index: number, nickname: string) => `#${index} ${nickname}`,
  matchSeparator: ', ',
  noPosition: 'could not read your position',
  noWall: (index: number) => `no wall #${index} in the running level`,
  outsideGrid: 'that is outside the area the level\'s walls were built for',
  noNetwork: 'the game network class is not available',
  noLoginParameters: 'the game has no login parameters yet',
  notLoggedIn: 'not logged in to the lobby server yet',
});
