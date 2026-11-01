import { UNLOCK_PHRASE } from './text.ts';

export { UNLOCK_PHRASE };

let bypassed = false;
let asking = false;

export const checksBypassed = (): boolean => bypassed;
export const askingToBypass = (): boolean => asking;
export const askToBypass = (): void => { asking = true; };

export function answerBypass(line: string): boolean {
  asking = false;
  if (line !== UNLOCK_PHRASE) return false;
  bypassed = true;
  return true;
}

export function protectAgain(): void {
  bypassed = false;
  asking = false;
}
