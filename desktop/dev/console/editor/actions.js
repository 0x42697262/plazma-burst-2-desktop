// A trigger's actions, as the map stores them (actions_1_type, actions_1_targetA,
// actions_1_targetB, actions_2_..., type -1 = an empty slot), as a list, and as the map
// editor's text view (triggers/script.js reads that format; this writes it).
import { opcodeName, parseScript } from '../triggers/script.js';

const ACTION = /^actions_(\d+)_(type|targetA|targetB)$/;
export const EMPTY_TYPE = '-1';

export const isActionAttr = (attr) => ACTION.test(attr);

// [{ type, A, B }] in order, empty slots left out.
export function actionsOf(attrs) {
  const slots = new Map();
  for (const [attr, value] of Object.entries(attrs)) {
    const m = attr.match(ACTION);
    if (!m) continue;
    if (!slots.has(Number(m[1]))) slots.set(Number(m[1]), {});
    slots.get(Number(m[1]))[m[2]] = value;
  }
  return [...slots.keys()].sort((a, b) => a - b).map((n) => slots.get(n))
    .filter((a) => a.type !== undefined && a.type !== EMPTY_TYPE)
    .map((a) => ({ type: a.type, A: a.targetA ?? '', B: a.targetB ?? '' }));
}

// The attribute changes that make a trigger's actions `list`, numbered from 1, with
// every action attribute it had beyond them removed (undefined).
export function actionValues(attrs, list) {
  const values = {};
  for (const attr of Object.keys(attrs)) if (ACTION.test(attr)) values[attr] = undefined;
  list.forEach((a, i) => {
    values[`actions_${i + 1}_type`] = String(a.type);
    values[`actions_${i + 1}_targetA`] = a.A;
    values[`actions_${i + 1}_targetB`] = a.B;
  });
  return values;
}

// The editor's "Edit triggers as text" view of a trigger.
export function triggerText(attrs) {
  const lines = ['uid', 'enabled', 'maxcalls'].filter((k) => attrs[k] !== undefined).map((k) => `${k}: ${attrs[k]}`);
  lines.push('');
  for (const a of actionsOf(attrs)) lines.push(`${opcodeName(Number(a.type))}( "${a.A}", "${a.B}" );`);
  return lines.join('\n');
}

// The attribute changes that a text view stands for: its headers and its actions.
export function valuesFromText(attrs, text) {
  const { headers, actions } = parseText(text);
  return { ...headers, ...actionValues(attrs, actions.map((a) => ({ type: a.type, A: a.A, B: a.B }))) };
}

// Like the editor, a trigger may end up with no actions at all.
function parseText(text) {
  try {
    return parseScript(text);
  } catch (err) {
    if (/no actions in the script/.test(err.message)) {
      const headers = {};
      for (const m of String(text).matchAll(/^\s*(uid|enabled|maxcalls)\s*:\s*(.*?)\s*$/gim)) headers[m[1].toLowerCase()] = m[2];
      return { headers, actions: [] };
    }
    throw err;
  }
}
