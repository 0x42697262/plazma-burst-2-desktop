import { FPS_VALUES } from './constants.ts';

const fpsList = FPS_VALUES.join(', ');

export const TEXT = Object.freeze({
  usage: 'fps [20 | 30 | 60] [low | high] [match | unlimited]',
  usageError: `usage: fps [${FPS_VALUES.join(' | ')}] [low | high] [match | unlimited], any order, each at most once`,
  description: 'The game\'s FPS, physics quality and logic, as its Esc menu sets them',
  clientOnly: 'only your own game runs differently',
  about: [
    'Each word sets one part and leaves the others as they are, in any order:',
    `the FPS (${fpsList}), the physics (low or high) and the logic (match or unlimited:`,
    'the official client\'s unlimited screen refresh, Sad Burst 2\'s unlimited render FPS).',
    'These are the game\'s own settings, the same as clicking its Esc menu.',
  ],
  args: [
    ['20 | 30 | 60', 'the FPS'],
    ['low | high', 'the physics quality'],
    ['match | unlimited', 'the logic'],
  ],
  examples: [
    ['fps', 'what they are now'],
    ['fps 60 high', '60 FPS, high physics'],
    ['fps 30', 'only the FPS'],
    ['fps low', 'only the physics'],
  ],
  see: ['fly'],
  now: (fps: string, physics: string, logic: string) => `FPS ${fps}, physics ${physics}, logic ${logic}`,
  unknown: '?',
  noLogic: 'logic is not in this game client; FPS and physics were set',
});
