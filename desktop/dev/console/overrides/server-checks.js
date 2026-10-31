// What the console holds back in approved, ranked matches because the match's server
// checks it (ANTICHEAT.md §14, server-side checks on the state your game sends). Other
// matches (unapproved maps, unranked) and single-player are left alone:
//   - your HP above the map's limit: reported as "HealthAltering" (§14.4). Held back:
//     max_hp above your character's own max, any hp_bonus / hp_bonus_pct above 0, the
//     game's "god" and "grow" chat commands.
//   - aiming outside the normal view: announced to the other players (§14.6). Held back:
//     any zoom out (below 100%), from "zoom" or the game's "zoom 25" / "zoom 50".
// Whole kinds are held back, not values tuned to stay under a limit. Held back means:
// typing it is refused, and a setting or a held zoom you already had is not applied
// (your saved values stay as they are). "bypass checks" turns this off (state/danger.js).
// The respawn counter (§14.5) and the clock check (§14.7): no console command changes
// either, so there is nothing to hold back.
import { game } from '../game/bindings.js';
import { KEY } from '../state/schema.js';
import { checksBypassed } from '../state/danger.js';

export const REASON = Object.freeze({
  hp: 'the server reports HP above the map\'s limit as "HealthAltering" (ANTICHEAT.md §14.4)',
  aim: 'zoomed out you can aim outside the normal view, which the server announces to the other players (ANTICHEAT.md §14.6)',
});
export const BYPASS_HINT = '"bypass checks" turns this protection off (dangerous)';
export const NORMAL_ZOOM_PCT = 100;

// The match you are in is on an approved map and ranked: match_details as the server
// sent it when you joined (MATCH_JOIN_RESPONSE: "approved" is a number, 0 = not).
export function rankedMatch() {
  if (game.isMP() !== true) return false;
  const d = game.matchDetails();
  return !!(d && Number(d.approved) > 0 && d.ranked === true);
}

// The protection is on now: in an approved, ranked match and not bypassed.
export const guarding = () => !checksBypassed() && rankedMatch();

// Why a key's value is held back now, or null. gameMax: your character's own max HP
// (without the console's changes), or null outside a level.
export function heldBack(key, value, gameMax) {
  if (!guarding()) return null;
  if ((key === KEY.HP_BONUS || key === KEY.HP_BONUS_PCT) && value > 0) return REASON.hp;
  if (key === KEY.MAX_HP && (gameMax === null || gameMax === undefined || value > gameMax)) return REASON.hp;
  return null;
}

export const zoomHeldBack = (pct) => (guarding() && pct < NORMAL_ZOOM_PCT ? REASON.aim : null);

// The game's own chat commands ("game <command>") that do the same.
const GAME_COMMANDS = Object.freeze([
  [/^god(\s+1)?$/i, REASON.hp], // max HP x100000 and full heal
  [/^grow$/i, REASON.hp], // you x1.25, HP with it
  [/^zoom\s+(25|50)$/i, REASON.aim],
]);
export function gameCommandHeldBack(text) {
  if (!guarding()) return null;
  const hit = GAME_COMMANDS.find(([re]) => re.test(String(text).trim()));
  return hit ? hit[1] : null;
}

export const refusal = (what, reason) => new Error(`refused in a ranked match: ${what}: ${reason}. ${BYPASS_HINT}.`);
