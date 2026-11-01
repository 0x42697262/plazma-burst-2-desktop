export const COMMAND = Object.freeze({ name: 'js', helpWord: 'help' });
export const EVAL_SOURCE = 'pb2dev-eval.js';
export const GAME_NAME = Object.freeze({ me: 'me', chars: 'chars' });
export const withSourceUrl = (code: string): string => `${code}\n//# sourceURL=${EVAL_SOURCE}`;
