// The editor's panels, small and at the screen edges so the game stays in view:
// - Layers (left): every kind with its count. Clicking a name lists that layer in
//   Objects; clicking its colour square hides or shows it in the world.
// - Objects (right, top): the elements of that layer; clicking one selects it.
// - Params (right, below): the selected element's attributes; click a value to edit it.
// - The top line: how the mouse works, edits waiting for a reload, messages.
// They are drawn from the session and drawn again when it changes.
import { el } from '../ui/dom.js';
import { THEME, swallow } from '../ui/theme.js';
import { COLOR } from '../core/colors.js';
import { game } from '../game/bindings.js';
import { KINDS, KIND_TAGS, kindOf, nameOf } from './kinds.js';
import {
  editorDoc, selected, select, currentLayer, showLayer, isHidden, setHidden, countByTag, onChange, pendingCount,
} from './session.js';
import { setAttr, reloadLevel } from './edit.js';

const Z_INDEX = '45'; // over the editor's click layer, under the console (50)
const FONT_SIZE = '6px';
const ROW_HEIGHT = '8px';
const OBJECTS_SHOWN = 400; // rows in the objects list; a long layer says how many more
const HIDDEN_ALPHA = '0.35';

const PLACE = Object.freeze({
  layers: { left: '4px', top: '24px', width: '96px', height: '300px' },
  objects: { left: '696px', top: '24px', width: '100px', height: '150px' },
  params: { left: '696px', top: '178px', width: '100px', height: '200px' },
  status: { left: '0', top: '2px', width: '800px', height: '18px' },
});

const box = (place) => {
  const b = el('div', {
    position: 'absolute', ...place, background: THEME.background, zIndex: Z_INDEX, boxSizing: 'border-box',
    padding: '2px 3px', fontFamily: THEME.font, fontSize: FONT_SIZE, color: COLOR.plain, overflowY: 'auto',
    scrollbarWidth: 'thin', scrollbarColor: `${THEME.scrollThumb} ${THEME.scrollTrack}`, pointerEvents: 'auto',
    cursor: 'default', userSelect: 'none',
  });
  swallow(b);
  return b;
};
const title = (text) => el('div', { color: COLOR.title, lineHeight: '9px', whiteSpace: 'nowrap' }, text);
const row = (style, text) => el('div', {
  lineHeight: ROW_HEIGHT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...style,
}, text);
const onClick = (node, fn) => node.addEventListener('mousedown', (e) => { if (e.button === 0) fn(e); });

let nodes = null; // { layers, objects, params, status }
let unsubscribe = null;

function drawLayers() {
  const counts = countByTag();
  nodes.layers.textContent = '';
  nodes.layers.append(title('Layers'));
  for (const tag of KIND_TAGS) {
    const kind = KINDS[tag];
    const r = row({ display: 'flex', gap: '3px', alignItems: 'center', color: tag === currentLayer() ? COLOR.bright : COLOR.plain });
    if (isHidden(tag)) r.style.opacity = HIDDEN_ALPHA;
    const swatch = el('div', { width: '5px', height: '5px', flex: 'none', background: kind.color });
    onClick(swatch, (e) => { e.stopPropagation(); setHidden(tag, !isHidden(tag)); });
    r.append(swatch, el('span', {}, `${kind.title} (${counts[tag]})`));
    onClick(r, () => showLayer(tag));
    nodes.layers.append(r);
  }
}

function drawObjects() {
  const doc = editorDoc();
  const tag = currentLayer();
  const list = doc ? doc.byTag(tag) : [];
  const sel = selected();
  nodes.objects.textContent = '';
  nodes.objects.append(title(`${kindOf(tag).title} (${list.length})`));
  for (const e of list.slice(0, OBJECTS_SHOWN)) {
    const r = row({ color: e === sel ? COLOR.bright : COLOR.plain, background: e === sel ? '#3C9DFF44' : 'none' }, nameOf(doc, e));
    onClick(r, () => select(e));
    nodes.objects.append(r);
  }
  if (list.length > OBJECTS_SHOWN) nodes.objects.append(row({ color: COLOR.muted }, `+${list.length - OBJECTS_SHOWN} more`));
}

// A value turns into a text box when clicked: Enter applies it, Esc or clicking
// elsewhere leaves it as it was.
function editValue(span, sel, attr) {
  const input = el('input', {
    flex: '1', minWidth: '0', fontFamily: THEME.font, fontSize: FONT_SIZE, color: COLOR.bright,
    background: THEME.inputBackground, border: THEME.inputBorder, padding: '0 1px', height: ROW_HEIGHT,
  });
  input.value = sel.attrs[attr];
  input.spellcheck = false;
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      try {
        const { live } = setAttr(sel, attr, input.value);
        if (!live) say(game.isMP() ? `${attr}: not live in multiplayer; kept for "editor save"` : `${attr}: shows after a reload`, COLOR.notice);
      } catch (err) { say(`error: ${err.message}`, COLOR.error); }
      drawParams();
    } else if (e.key === 'Escape') drawParams();
  });
  input.addEventListener('blur', () => { if (input.parentNode) drawParams(); });
  span.replaceWith(input);
  input.focus();
  input.select();
}

function drawParams() {
  const doc = editorDoc();
  const sel = selected();
  nodes.params.textContent = '';
  if (!sel) { nodes.params.append(title('Params'), row({ color: COLOR.muted }, 'click an object')); return; }
  nodes.params.append(title(`${kindOf(sel.tag)?.title || sel.tag} #${doc.ordinal(sel)}`));
  for (const [attr, value] of Object.entries(sel.attrs)) {
    const r = row({ display: 'flex', gap: '3px' });
    const span = el('span', { overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'text', flex: '1' }, value);
    onClick(span, () => editValue(span, sel, attr));
    r.append(el('span', { color: COLOR.muted, flex: 'none' }, attr), span);
    nodes.params.append(r);
  }
}

// The top line: what the mouse does, edits waiting for a reload, and a short message.
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
  s.append(el('span', {}, `EDITOR${keyShown ? ` (${keyShown} closes)` : ''}  ·  click: select, again: the one below  ·  drag the selection: move, its edge: resize (Alt: no snap)  ·  Esc: deselect`));
  const n = pendingCount();
  if (n) {
    const what = `  ·  ${n} edited object${n === 1 ? '' : 's'} not live yet`;
    s.append(el('span', { color: COLOR.notice }, what));
    if (!game.isMP()) {
      const button = el('span', { color: COLOR.bright, textDecoration: 'underline', cursor: 'pointer', pointerEvents: 'auto', marginLeft: '4px' }, 'reload level');
      swallow(button);
      onClick(button, () => { try { reloadLevel(); } catch (err) { say(`error: ${err.message}`, COLOR.error); } });
      s.append(button);
    }
  }
  if (message && performance.now() < message.until) s.append(el('div', { color: message.color }, message.text));
}

const REDRAW = Object.freeze({
  doc: ['layers', 'objects', 'params', 'status'], layer: ['layers', 'objects'],
  layers: ['layers', 'objects', 'params'], selection: ['objects', 'params'], edit: ['objects', 'params', 'status'],
});
const DRAW = Object.freeze({ layers: drawLayers, objects: drawObjects, params: drawParams, status: drawStatus });

export function showPanels(on, keyName) {
  if (!on) {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (nodes) for (const n of Object.values(nodes)) n.remove();
    nodes = null;
    return;
  }
  if (nodes) return;
  keyShown = keyName;
  nodes = {
    layers: box(PLACE.layers), objects: box(PLACE.objects), params: box(PLACE.params),
    status: el('div', {
      position: 'absolute', ...PLACE.status, zIndex: Z_INDEX, textAlign: 'center', pointerEvents: 'none',
      fontFamily: THEME.font, fontSize: FONT_SIZE, color: COLOR.title,
    }),
  };
  for (const n of Object.values(nodes)) game.overlay().append(n);
  for (const draw of Object.values(DRAW)) draw();
  unsubscribe = onChange((what) => { for (const part of REDRAW[what] || []) DRAW[part](); });
}
