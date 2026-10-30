// The editor's panels, laid out like the browser map editor's: a panel down each side
// of the game, so the level stays in view between them.
// - Left: Tools (select, then one place tool per kind, as the editor's icons; copy,
//   delete, undo, redo), and Layers: clicking a kind lists it in the object box,
//   clicking its icon hides or shows it in the world.
// - Right: the object box (the listed layer's objects), then the selection's params as
//   title / value rows; click a value to edit it.
// - The top line, between them: how the mouse works, edits the running level does not
//   have, messages.
// They are drawn from the session and drawn again when it changes. The look is style.js.
import { el } from '../ui/dom.js';
import { IN_OVERLAY } from '../ui/theme.js';
import { COLOR } from '../core/colors.js';
import { game } from '../game/bindings.js';
import { KINDS, KIND_TAGS, kindOf, nameOf } from './kinds.js';
import {
  editorDoc, selected, select, currentLayer, showLayer, isHidden, setHidden, countByTag, onChange, pendingCount,
  currentTool, setTool, TOOL,
} from './session.js';
import { setAttr, deleteElement, duplicateElement, undo, redo, notLiveReason } from './edit.js';
import { canUndo, canRedo } from './history.js';
import { PALETTE, FONT, FONT_SIZE, panel, caption, icon, button, listRow, paramRow, onClick } from './style.js';
import { drawTriggerActions } from './trigger-panel.js';
import { isActionAttr } from './actions.js';
import { editField } from './fields.js';

const OBJECTS_SHOWN = 400; // rows in the object box; a long layer says how many more
const HIDDEN_ALPHA = '0.35';
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
  for (const tag of KIND_TAGS) {
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

function drawLayers() {
  const counts = countByTag();
  const box = nodes.layers;
  box.textContent = '';
  box.append(caption('Layers:'));
  for (const tag of KIND_TAGS) {
    const eye = icon(tag);
    eye.title = isHidden(tag) ? 'Show in the world' : 'Hide in the world';
    onClick(eye, (e) => { e.stopPropagation(); setHidden(tag, !isHidden(tag)); });
    const b = button([eye, `${KINDS[tag].title} (${counts[tag]})`], {
      active: tag === currentLayer(), title: 'List in the object box', onPress: () => showLayer(tag),
      style: { width: `${LEFT_W - 4}px`, height: '9px', justifyContent: 'flex-start' },
    });
    if (isHidden(tag)) b.style.opacity = HIDDEN_ALPHA;
    box.append(b);
  }
}

function drawObjects() {
  const doc = editorDoc();
  const tag = currentLayer();
  const list = doc ? doc.byTag(tag) : [];
  const sel = selected();
  const box = nodes.objects;
  box.textContent = '';
  for (const e of list.slice(0, OBJECTS_SHOWN)) box.append(listRow(e.tag, nameOf(doc, e), e === sel, () => select(e)));
  if (list.length > OBJECTS_SHOWN) box.append(el('div', { color: PALETTE.muted }, `+${list.length - OBJECTS_SHOWN} more`));
  nodes.objectsCaption.textContent = `Objects: ${kindOf(tag).title} (${list.length})`;
}

// A value turns into a text box when clicked (fields.js).
function editValue(span, sel, attr) {
  editField(span, {
    initial: sel.attrs[attr], onDone: drawParams,
    onCommit: (text) => {
      try {
        const { live, why } = setAttr(sel, attr, text);
        if (!live) say(`${attr}: not in the running level (${why})`, COLOR.notice);
      } catch (err) { say(`error: ${err.message}`, COLOR.error); }
    },
  });
}

function drawParams() {
  const doc = editorDoc();
  const sel = selected();
  const box = nodes.params;
  box.textContent = '';
  if (!sel) { box.append(caption('Nothing selected')); return; }
  const head = el('div', { display: 'flex', alignItems: 'center', gap: '2px', margin: '2px 2px 3px', color: PALETTE.title });
  head.append(icon(sel.tag), el('span', {}, `1 ${kindOf(sel.tag)?.title || sel.tag} selected: ${nameOf(doc, sel)}`));
  box.append(head);
  for (const [attr, value] of Object.entries(sel.attrs)) {
    if (sel.tag === 'trigger' && isActionAttr(attr)) continue; // listed as actions below
    const span = el('span', {}, value);
    const { row, value: cell } = paramRow(attr, span);
    onClick(cell, () => editValue(span, sel, attr));
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
  const how = currentTool() === TOOL.PLACE
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
});
const DRAW = Object.freeze({ tools: drawTools, layers: drawLayers, objects: drawObjects, params: drawParams, status: drawStatus });

// For "editor status".
export const panelsOnPage = () => (!nodes ? 'none' : nodes.left.isConnected === false ? 'made, but not on the page' : 'on the page');

export function showPanels(on, keyName) {
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
  nodes.objects = el('div', {
    height: `${OBJECTS_H}px`, overflowY: 'auto', margin: '0 2px', padding: '1px', background: PALETTE.box,
    borderRadius: '2.5px', scrollbarWidth: 'thin',
  });
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
