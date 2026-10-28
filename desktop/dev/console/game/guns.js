// The gun catalog, read from the game's own gun factory so it matches exactly what the
// game can spawn: standard, community-made (custom) and grenade items.
import { game } from './bindings.js';
import { parseIndex } from '../core/text.js';

export const GUN_KINDS = Object.freeze(['standard', 'custom', 'items']);
export const ITEM_SLOT = -2; // slot of grenade items, which are picked up by walking over them
export const MAX_UPGRADE = 3; // guns spawn at this upgrade unless told otherwise

const kindOf = (model) => (model.startsWith('item_') ? 'items' : model.startsWith('gun_') ? 'standard' : 'custom');

// A grenade item's class is item_grenade_<name>, whatever the model is called.
function slotOf(model) {
  const scripts = game.gunScripts();
  const grenade = 'item_grenade_' + model.replace(/^item_/, '');
  const cls = scripts[model] ? model : scripts[grenade] ? grenade : null;
  return cls ? game.gunSlotOf(cls) : null;
}

let catalog = null;

export function gunList() {
  if (catalog) return catalog;
  const models = game.gunModels();
  if (!models.length) models.push(...Object.keys(game.gunScripts()));
  catalog = models.map((model) => {
    let name = '';
    try { name = game.gunName(model) || ''; } catch {}
    return { model, name: name || model, kind: kindOf(model), slot: slotOf(model) };
  });
  return catalog;
}

export const slotText = (slot) => (slot === null ? '?' : slot === ITEM_SLOT ? 'item' : String(slot));

const matches = (g, lq) => g.model.includes(lq) || g.name.toLowerCase().includes(lq);

// Gun by # in the list (1-based), exact model or name, or the one gun a part matches.
export function resolveGun(q) {
  const list = gunList();
  const n = parseIndex(q);
  if (n !== null) {
    if (!list[n - 1]) throw new Error(`no gun #${n}. Type "guns".`);
    return list[n - 1];
  }
  const lq = q.toLowerCase();
  const exact = list.find((g) => g.model === lq || g.name.toLowerCase() === lq);
  if (exact) return exact;
  const hits = list.filter((g) => matches(g, lq));
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error(`no gun matches "${q}". Type "guns".`);
  throw new Error(`"${q}" matches ${hits.length} guns: ${hits.slice(0, 6).map((g) => g.model).join(', ')}${hits.length > 6 ? ', ...' : ''}`);
}

export const filterGuns = (filter) => {
  const f = (filter || '').toLowerCase();
  return gunList().map((g, i) => ({ g, n: i + 1 })).filter(({ g }) => !f || matches(g, f));
};
