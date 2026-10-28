// The contract with desktop/main.js: route names and map text markers, defined once in
// shared.json and read by both sides.
import shared from '../shared.json' with { type: 'json' };

export const MAP = shared.map;
// What saving a map answers: written, unchanged, or saving is off.
export const SAVE_RESULT = shared.saveResult;

// URLs are relative to the game page, which is where main.js serves __dev/.
export const ROUTE = Object.freeze(Object.fromEntries(
  Object.entries(shared.routes).map(([key, path]) => [key, shared.devDir + path]),
));
