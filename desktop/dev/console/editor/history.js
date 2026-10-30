// Undo and redo for the editor. An entry is one user action (a drag, a typed value, a
// delete) as the list of changes it made:
//   { kind: 'attrs', e, before, after }  attributes, undefined = not there
//   { kind: 'insert', e, at }            an element added at index `at`
//   { kind: 'remove', e, at }            an element taken out from index `at`
// edit.js records them and plays them back; this only keeps the lists.
const MAX_ENTRIES = 200;

const undoList = [];
const redoList = [];
let open = null; // the entry being recorded, while an action lasts (a drag)

// Starts an action made of many changes; endAction closes it. Changes outside an action
// are an entry each.
export function beginAction() { if (!open) open = []; }

export function endAction() {
  const entry = open;
  open = null;
  if (entry && entry.length) push(entry);
}

function push(entry) {
  undoList.push(entry);
  if (undoList.length > MAX_ENTRIES) undoList.shift();
  redoList.length = 0;
}

// One change. Attribute changes of the same element in one action merge: the first
// "before", the last "after".
export function record(change) {
  if (!open) { push([change]); return; }
  const last = open[open.length - 1];
  if (change.kind === 'attrs' && last && last.kind === 'attrs' && last.e === change.e) {
    for (const [k, v] of Object.entries(change.before)) if (!(k in last.before)) last.before[k] = v;
    Object.assign(last.after, change.after);
    return;
  }
  open.push(change);
}

export const takeUndo = () => { const entry = undoList.pop(); if (entry) redoList.push(entry); return entry || null; };
export const takeRedo = () => { const entry = redoList.pop(); if (entry) undoList.push(entry); return entry || null; };
export const canUndo = () => undoList.length > 0;
export const canRedo = () => redoList.length > 0;
export function clearHistory() { undoList.length = 0; redoList.length = 0; open = null; }
