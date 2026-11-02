import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { UNLOCK_PHRASE } from './keys.ts';
import { CHECKS_TEXT as TEXT } from './text.ts';

let bypassed = false;
let asking = false;

export const checksBypassed = (): boolean => bypassed;
export const askToBypass = (): void => { asking = true; };

export function protectAgain(): void {
  bypassed = false;
  asking = false;
}

function answer(line: string): void {
  asking = false;
  if (line !== UNLOCK_PHRASE) {
    print(TEXT.notBypassed, COLOR.notice);
    return;
  }
  bypassed = true;
  for (const bypassedLine of TEXT.bypassed) print(bypassedLine, COLOR.error);
}

export const protectionSwitch = Object.freeze({ isOff: checksBypassed, isAsking: () => asking, answer, hint: TEXT.hint });
