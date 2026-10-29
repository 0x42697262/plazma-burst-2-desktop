// The running level and its characters.
import { game } from './bindings.js';
import { F } from './fields.js';
import { parseIndex } from '../core/text.js';

// The game takes a character's middle this far above its feet (x, y): the region check
// tests y - 41, and the teleport effect plays there.
export const BODY_MIDDLE = 41;

export const player = () => {
  const c = game.chars();
  return c ? c[game.me()] : null;
};

export function isActive() {
  if (!game.inLevelFrame()) return false;
  const p = player();
  return !!p && typeof p === 'object' && typeof p[F.HP] === 'number';
}

export const LEVEL_REQUIRED = 'start a level first';

export function requireLevel() {
  if (!isActive()) throw new Error(LEVEL_REQUIRED);
}

export const noCharacter = (i) => new Error(`no character #${i}. Type "chars".`);

export const isDown = (c) => !!c && (c[F.DEAD] === true || c[F.DYING] === true || !(c[F.HP] > 0));

// A character slot that is in use.
export function charAt(i) {
  const c = game.chars()[i];
  return c && c.io && i < game.charCount() ? c : null;
}

export const charLabel = (i, c = game.chars()[i]) => `#${i} ${(c && c.nickname) || ''}`.trim();

// "you are" / "#1 bob is", and the same for "have".
export const be = (who) => (who === 'you' ? 'you are' : `${who} is`);
export const have = (who) => (who === 'you' ? 'you have' : `${who} has`);

// Character by index for commands that act on someone; other characters only outside
// multiplayer (bots are local, real players are not).
export function targetChar(i) {
  requireLevel();
  const me = game.me();
  if (i === undefined || i === me) return { p: player(), i: me, who: 'you' };
  if (game.isMP()) throw new Error('other characters only work in single-player');
  const p = charAt(i);
  if (!p) throw noCharacter(i);
  return { p, i, who: charLabel(i, p) };
}

// Character by number ("2", "#2") or by part of the nickname.
export function resolveChar(q) {
  const c = game.chars();
  const alive = [];
  for (let i = 0; i < game.charCount(); i++) if (c[i] && c[i].io) alive.push(i);
  const idx = parseIndex(q);
  if (idx !== null) {
    if (!alive.includes(idx)) throw noCharacter(idx);
    return idx;
  }
  const lq = q.toLowerCase();
  const nick = (i) => String(c[i].nickname || '').toLowerCase();
  const exact = alive.filter((i) => nick(i) === lq);
  const hits = exact.length ? exact : alive.filter((i) => nick(i).includes(lq));
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error(`no character named "${q}". Type "chars".`);
  throw new Error(`"${q}" matches ${hits.length} characters: ${hits.map((i) => `#${i} ${c[i].nickname}`).join(', ')}. Use the #.`);
}

// "... to <char#>" / "... from <char#>" at the end of a command's arguments. Returns the
// arguments before it and the index (undefined without one).
export function takeCharSuffix(args, word, usage) {
  const at = args.findIndex((a) => a.toLowerCase() === word);
  if (at === -1) return { args, target: undefined };
  const target = parseIndex(args[at + 1]);
  if (target === null || args.length !== at + 2) throw new Error(usage);
  return { args: args.slice(0, at), target };
}

// The map you are on, for profiles: the match's map in multiplayer, otherwise the map
// loaded last (a campaign level such as "c31a", or the custom map ID you typed).
export function currentMapId() {
  const id = (game.isMP() && game.matchMapId()) || game.mapId();
  return id === undefined || id === null || id === '' ? null : String(id);
}
