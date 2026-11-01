// The editor's panels, laid out like the browser map editor's: a panel down each side
// of the game, so the level stays in view between them.
// - Left: Tools (select, then one place tool per kind, as the editor's icons; copy,
//   delete, undo, redo), and Layers: what can be selected, as the editor's All,
//   Nothing, Statics, Logics, Entities, or with More one kind at a time (Ctrl adds a
//   kind, Alt takes it away). The rest is drawn faint.
// - Right: the object box (the active layers' objects), then the selection's params as
//   title / value rows; click a value to edit it.
// - The top line, between them: how the mouse works, edits the running level does not
//   have, messages.
// They are drawn from the session and drawn again when it changes. The look is style.js.
import { el } from '../ui/dom.js';
import { IN_OVERLAY } from '../ui/theme.js';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { game } from '../../../../src/console/kernel/game/bindings.ts';
import { KINDS, KIND_TAGS, NOT_PLACED, kindOf, nameOf } from './kinds.js';
import {
  editorDoc, selected, select, currentLayer, showLayer, countByTag, onChange, pendingCount,
  currentTool, setTool, TOOL, isSelectable, selectableLayers, setSelectable, moreLayers, setMoreLayers, LAYER_GROUPS,
  currentPick, startPick, cancelPick,
} from './session.js';
import { setAttr, deleteElement, duplicateElement, undo, redo, notLiveReason } from './edit.js';
import { canUndo, canRedo } from './history.js';
import {
  PALETTE, FONT, FONT_SIZE, panel, caption, icon, button, listRow, paramRow, onClick, scrolling, useEditorStyles,
} from './style.js';
import { drawTriggerActions } from './trigger-panel.js';
import { isActionAttr } from './actions.js';
import { editField } from './fields.js';
import { paramsOf, paramInfo, defaultOf, shownValue, pickKindsOf, dropdownItems } from './params.js';
import { openDropdown, closeDropdown } from './dropdown.js';
import { referenceTo } from './kinds.js';

const OBJECTS_SHOWN = 400; // rows in the object box; a long list says how many more
const TOOL_SIZE = 22; // a tool button, square (.tool_sm)
const LEFT_W = 52;
const RIGHT_W = 124;
const OBJECTS_H = 110;

const PLACE = Object.freeze({
  left: { left: '0', top: '0', width: `${LEFT_W}px`, height: '400px', borderRight: `0.5px solid ${PALETTE.panelEdge}` },
  right: { left: `${800 - RIGHT_W}px`, top: '0', width: `${RIGHT_W}px`, height: '400px', borderLeft: `0.5px solid ${PALETTE.panelEdge}` },
  status: { left: `${LEFT_W}px`, top: '2px', width: `${800 - LEFT_W - RIGHT_W}px` },
});

let nodes = null; // { left: { tools, layers }, right: { objects, params }, status }
let unsubscribe = null;

const tryIt = (fn) => () => { try { fn(); } catch (err) { say(`error: ${err.message}`, COLOR.error); } };

function drawTools() {
  const sel = selected();
  const tool = currentTool();
  const box = nodes.tools;
  box.textContent = '';
  box.append(caption('Tools:'));
  const grid = el('div', { display: 'grid', gridTemplateColumns: `repeat(2, ${TOOL_SIZE}px)`, justifyContent: 'center' });
  const square = { width: `${TOOL_SIZE}px`, height: `${TOOL_SIZE}px` };
  grid.append(button(icon('edit'), { active: tool === TOOL.SELECT, title: 'Select, move and resize', style: square, onPress: () => setTool(TOOL.SELECT) }));
  for (const tag of KIND_TAGS.filter((t) => !NOT_PLACED.has(t))) {
    const active = tool === TOOL.PLACE && currentLayer() === tag;
    grid.append(button(icon(tag), {
      active, title: `Place ${KINDS[tag].title}`, style: square, onPress: () => { showLayer(tag); setTool(TOOL.PLACE); },
    }));
  }
  box.append(grid);
  const acts = el('div', { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2px' });
  const small = { width: `${TOOL_SIZE}px`, height: '8px' };
  acts.append(
    button('Copy', { enabled: !!sel, title: 'Copy the selection (Ctrl+D)', style: small, onPress: tryIt(() => duplicateElement(sel)) }),
    button('Del', { enabled: !!sel, title: 'Delete the selection (Del)', style: small, onPress: tryIt(() => deleteElement(sel)) }),
    button('Undo', { enabled: canUndo(), title: 'Ctrl+Z', style: small, onPress: tryIt(undo) }),
    button('Redo', { enabled: canRedo(), title: 'Ctrl+Y', style: small, onPress: tryIt(redo) }),
  );
  box.append(acts);
}

const sameSet = (a, b) => a.length === b.length && a.every((t) => b.includes(t));

function drawLayers() {
  const counts = countByTag();
  const active = selectableLayers();
  const box = nodes.layers;
  box.textContent = '';
  box.append(caption('Layers:'));
  const wide = { width: `${LEFT_W - 4}px`, height: '9px' };
  const group = (label, tags) => button(label, { active: sameSet(active, tags), style: wide, onPress: () => setSelectable(tags) });
  box.append(button(moreLayers() ? '[ Less ]' : '[ More ]', { style: wide, onPress: () => setMoreLayers(!moreLayers()) }));
  if (moreLayers()) {
    for (const tag of KIND_TAGS) {
      box.append(button([icon(tag), `${KINDS[tag].title} (${counts[tag]})`], {
        active: isSelectable(tag), title: 'Click: only this. Ctrl+click: add it. Alt+click: take it away.',
        style: { ...wide, justifyContent: 'flex-start' },
        onPress: (e) => {
          if (e.ctrlKey && !e.altKey) setSelectable([...active, tag]);
          else if (e.altKey && !e.ctrlKey) setSelectable(active.filter((t) => t !== tag));
          else setSelectable([tag]);
        },
      }));
    }
  }
  box.append(group('All', KIND_TAGS), group('Nothing', []));
  if (!moreLayers()) box.append(group('Statics', LAYER_GROUPS.statics), group('Logics', LAYER_GROUPS.logics), group('Entities', LAYER_GROUPS.entities));
}

// The objects of the active layers, in map order.
function drawObjects() {
  const doc = editorDoc();
  const list = doc ? doc.elements.filter((e) => kindOf(e.tag) && isSelectable(e.tag)) : [];
  const sel = selected();
  const box = nodes.objects;
  box.textContent = '';
  for (const e of list.slice(0, OBJECTS_SHOWN)) box.append(listRow(e.tag, nameOf(doc, e), e === sel, () => select(e)));
  if (list.length > OBJECTS_SHOWN) box.append(el('div', { color: PALETTE.muted }, `+${list.length - OBJECTS_SHOWN} more`));
  nodes.objectsCaption.textContent = `Objects (${list.length}):`;
}

// A value is edited as in the map editor: a parameter whose kind offers choices opens
// its drop-down (dropdown.js), one that names an object can also be clicked in the
// world (the quick pick), and any other turns into a text box (fields.js).
function editValue(cell, span, sel, attr, valueKind) {
  const set = (text) => {
    try {
      const { live, why } = setAttr(sel, attr, text);
      if (!live) say(`${attr}: not in the running level (${why})`, COLOR.notice);
    } catch (err) { say(`error: ${err.message}`, COLOR.error); }
  };
  const doc = editorDoc();
  const kinds = pickKindsOf(valueKind);
  const items = dropdownItems(valueKind, doc, referenceTo, nameOf);
  // The drop-down first: opening it closes any other, and with it that one's pick.
  if (items.length) {
    openDropdown(cell, {
      items, current: sel.attrs[attr] ?? defaultOf(sel.tag, attr),
      onPick: (value) => { cancelPick(); set(value); drawParams(); },
      onClose: () => { if (currentPick()?.what === attr) cancelPick(); },
    });
  }
  if (kinds) startPick(kinds, attr, (target) => { closeDropdown(); set(referenceTo(doc, target)); drawParams(); });
  if (items.length) return;
  editField(span, {
    initial: sel.attrs[attr] ?? defaultOf(sel.tag, attr) ?? '',
    onDone: () => { cancelPick(); drawParams(); }, // typed instead, or left: no pick
    onCommit: set,
  });
}

// Every parameter of the kind (params.js), then whatever else the map gives it; a
// parameter the map leaves out shows the editor's default, dimmed. A trigger's actions
// are listed after them (trigger-panel.js).
function drawParams() {
  const doc = editorDoc();
  const sel = selected();
  const box = nodes.params;
  box.textContent = '';
  if (!sel) { box.append(caption('Nothing selected')); return; }
  const head = el('div', { display: 'flex', alignItems: 'center', gap: '2px', margin: '2px 2px 3px', color: PALETTE.title });
  head.append(icon(sel.tag), el('span', {}, `1 ${kindOf(sel.tag)?.title || sel.tag} selected: ${nameOf(doc, sel)}`));
  box.append(head);
  const known = paramsOf(sel.tag);
  const extra = Object.keys(sel.attrs).filter((a) => !known.includes(a) && !(sel.tag === 'trigger' && isActionAttr(a)));
  for (const attr of [...known, ...extra]) {
    const info = paramInfo(sel.tag, attr, sel.attrs);
    const set = attr in sel.attrs;
    const value = set ? sel.attrs[attr] : defaultOf(sel.tag, attr) ?? '';
    const span = el('span', {}, shownValue(info?.kind, value));
    const { row, value: cell } = paramRow(info?.title || attr, span, { hint: `${attr}${info?.desc ? `: ${info.desc}` : ''}${set ? '' : ' (not in the map: the default)'}` });
    if (!set) cell.style.opacity = '0.55';
    onClick(cell, () => editValue(cell, span, sel, attr, info?.kind));
    box.append(row);
  }
  if (sel.tag === 'trigger') drawTriggerActions(box, sel, { redraw: drawParams, say });
}

// The top line: what the mouse does, edits the running level does not have, the last
// reason an edit was not live, and a short message.
let keyShown = '';
let message = null; // { text, color, until }
const MESSAGE_MS = 4000;

export function say(text, color = COLOR.plain) {
  message = { text, color, until: performance.now() + MESSAGE_MS };
  if (nodes) drawStatus();
  setTimeout(() => { if (nodes) drawStatus(); }, MESSAGE_MS + 50);
}

function drawStatus() {
  const s = nodes.status;
  s.textContent = '';
  const pick = currentPick();
  const how = pick
    ? `${pick.what}: click a ${pick.kinds.map((t) => KINDS[t].title).join(' or ')} in the world  ·  Esc: cancel`
    : currentTool() === TOOL.PLACE
    ? `click: add a ${KINDS[currentLayer()].title}${KINDS[currentLayer()].shape === 'rect' ? ', or drag one out' : ''} (Alt: no snap)  ·  Esc: back to select`
    : 'click: select, again: the one below  ·  drag the selection: move, its edge: resize (Alt: no snap)  ·  Del, Ctrl+D copy, Ctrl+Z / Ctrl+Y';
  s.append(el('span', {}, `EDITOR${keyShown ? ` (${keyShown} closes)` : ''}  ·  ${how}`));
  const n = pendingCount();
  if (n) s.append(el('span', { color: COLOR.notice }, `  ·  ${n} edited object${n === 1 ? ' is' : 's are'} not in the running level (kept for "editor save")`));
  const why = notLiveReason();
  if (why) s.append(el('div', { color: COLOR.notice }, `last edit not live: ${why}`));
  if (message && performance.now() < message.until) s.append(el('div', { color: message.color }, message.text));
}

const REDRAW = Object.freeze({
  doc: ['tools', 'layers', 'objects', 'params', 'status'], layer: ['tools', 'layers', 'objects', 'status'],
  layers: ['layers', 'objects', 'params'], selection: ['tools', 'objects', 'params'],
  edit: ['tools', 'layers', 'objects', 'params', 'status'], tool: ['tools', 'status'], reloaded: ['status'],
  pick: ['status'],
});
const DRAW = Object.freeze({ tools: drawTools, layers: drawLayers, objects: drawObjects, params: drawParams, status: drawStatus });

// For "editor status".
export const panelsOnPage = () => (!nodes ? 'none' : nodes.left.isConnected === false ? 'made, but not on the page' : 'on the page');

export function showPanels(on, keyName) {
  useEditorStyles(on);
  if (!on) {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (nodes) for (const n of [nodes.left, nodes.right, nodes.status]) n.remove();
    nodes = null;
    return;
  }
  if (nodes) return;
  keyShown = keyName;
  const left = panel(PLACE.left);
  const right = panel(PLACE.right);
  const section = () => el('div', {});
  nodes = { left, right, tools: section(), layers: section(), objectsCaption: caption(''), params: section() };
  nodes.objects = scrolling(el('div', {
    height: `${OBJECTS_H}px`, overflowY: 'auto', margin: '0 2px', padding: '1px', background: PALETTE.box, borderRadius: '2.5px',
  }));
  left.append(nodes.tools, el('div', { height: '4px' }), nodes.layers);
  right.append(nodes.objectsCaption, nodes.objects, el('div', { height: '4px' }), nodes.params);
  nodes.status = el('div', {
    ...IN_OVERLAY, position: 'absolute', ...PLACE.status, zIndex: '45', textAlign: 'center', pointerEvents: 'none',
    fontFamily: FONT, fontSize: `${FONT_SIZE}px`, color: PALETTE.title, textShadow: '0 0 1px #000',
  });
  for (const n of [left, right, nodes.status]) game.overlay().append(n);
  for (const draw of Object.values(DRAW)) draw();
  unsubscribe = onChange((what) => { for (const part of REDRAW[what] || []) DRAW[part](); });
}
