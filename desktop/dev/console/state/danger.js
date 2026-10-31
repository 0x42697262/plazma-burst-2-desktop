// "bypass checks": the console's multiplayer protection, and the one way to turn it off.
// By default, in multiplayer the console holds back what the match's server checks
// (overrides/server-checks.js). "bypass checks" prints a warning and waits for the next
// line typed into the console: exactly UNLOCK_PHRASE (case-sensitive) turns the
// protection off for this page load; any other line turns the question down and is not
// run. Never saved: a reload, or "bypass off", turns the protection back on.

export const UNLOCK_PHRASE = 'ALLOW DANGEROUS COMMANDS';

let bypassed = false;
let asking = false;

export const checksBypassed = () => bypassed;
export const askingToBypass = () => asking;
export const askToBypass = () => { asking = true; };

// The typed line after "bypass checks". Returns true when it unlocked.
export function answerBypass(line) {
  asking = false;
  if (line !== UNLOCK_PHRASE) return false;
  bypassed = true;
  return true;
}

export function protectAgain() {
  bypassed = false;
  asking = false;
}
