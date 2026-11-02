import { GRENADE_CLASS_PREFIX, ITEM_PREFIX_AT_START } from '../keys.ts';
import { kindOf, type Gun } from '../domain/catalog.ts';
import { gunBindings as game } from '../adapters/game-guns.ts';

let catalog: Gun[] | null = null;

function slotOfModel(model: string): number | null {
  const scripts = game.gunScripts();
  const grenadeClass = GRENADE_CLASS_PREFIX + model.replace(ITEM_PREFIX_AT_START, '');
  const gunClass = scripts[model] ? model : scripts[grenadeClass] ? grenadeClass : null;
  return gunClass ? game.gunSlotOf(gunClass) : null;
}

function nameOf(model: string): string {
  try {
    return game.gunName(model) || model;
  } catch {
    return model;
  }
}

export function gunList(): Gun[] {
  if (catalog) return catalog;
  const models = game.gunModels();
  if (!models.length) models.push(...Object.keys(game.gunScripts()));
  catalog = models.map((model) => ({ model, name: nameOf(model), kind: kindOf(model), slot: slotOfModel(model) }));
  return catalog;
}
