// What the game puts back when a match starts a new round (and a co-op game starts
// over): movables go back to where the map put them, triggers and timers to how the
// map left them enabled and their calls. The loader keeps a copy of each for that
// (frame2.js: mc.<start x>=mc["x"]=parseFloat(b["#x"])); an edit that is live writes the
// copy too, or the round would take it back. The copies' names are read from the
// loader's branches; one this game version does not have is left alone.
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';
import { branchNames, loaderSource, GAME_ID as ID } from './loader.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const copyOf = (attr) => new RegExp(String.raw`mc\.(${ID})=mc\["${attr}"\]=parseFloat\(b\["#${attr}"\]\)`);
const enabledCopy = () => new RegExp(String.raw`\.(${ID})=${ID}\[${ID}\]\.${escapeRe(GAME_FIELDS.T_ENABLED || '?')};`);

const PATTERNS = Object.freeze({
  door: () => ({ x: copyOf('x'), y: copyOf('y'), tarx: copyOf('tarx'), tary: copyOf('tary') }),
  trigger: () => ({ enabled: enabledCopy() }),
  timer: () => ({ enabled: enabledCopy() }),
});

let names = {};
let namesFor = null;

function namesOf(tag) {
  const src = loaderSource();
  if (namesFor !== src) { names = {}; namesFor = src; }
  if (!names[tag]) names[tag] = PATTERNS[tag] ? branchNames(tag, PATTERNS[tag]()) : {};
  return names[tag];
}

// Sets the start copy `key` of object o (a movable, trigger or timer) to v.
export function setStart(tag, o, key, v) {
  const name = namesOf(tag)[key];
  if (name && o) o[name] = v;
}
