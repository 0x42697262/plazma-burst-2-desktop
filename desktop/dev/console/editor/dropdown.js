// The map editor's drop-down for a parameter (its "parambox", e_css.css and
// lib_letediting.js): a black box under the value with a row per choice. A row is
// green under the pointer and blue when it is the value now. On top, a field: typing
// narrows the rows, Enter takes what is typed (a "# calls" row asks for that number).
// Trigger actions get the editor's big box instead: a full-height list left of the
// params, the categories along the top in their colours (Everything, ..., Do Nothing),
// and a search field.
// It closes on a choice, Esc, or a press anywhere else.
import { el } from '../ui/dom.js';
import { IN_OVERLAY, swallow, markUi } from '../ui/theme.js';
import { game, GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { FONT, FONT_SIZE, PALETTE, icon, scrolling } from './style.js';
import { actionCategories } from './params.js';

const BOX = Object.freeze({ background: 'rgba(0,0,0,0.8)', border: '0.5px solid #000', padding: '1.3px' });
const ROW = Object.freeze({ hover: 'rgba(144,255,0,0.4)', current: 'rgba(100,150,255,0.4)', pressed: 'rgba(144,255,0,0.7)' });
const WIDTH = 124; // a normal box, at least as wide as the params
const MAX_HEIGHT = 150;
const ACTIONS_WIDTH = 300; // the editor's 700 px trigger action box
const RIGHT_PANEL = 124;
const SEPARATOR = 'rgba(255,255,255,0.4)';
const DO_NOTHING = '-1';

let open = null; // { box, close }

export const dropdownOpen = () => !!open;
export function closeDropdown() { if (open) open.close(); }

// Where a cell is, in overlay units: { x, y, w, h }, or null when the page cannot say.
function placeOf(cell) {
  const overlay = game.overlay();
  const a = cell.getBoundingClientRect?.();
  const o = overlay?.getBoundingClientRect?.();
  if (!a || !o || !o.width) return null;
  const unit = o.width / GAME_WIDTH;
  return { x: (a.left - o.left) / unit, y: (a.top - o.top) / unit, w: a.width / unit, h: a.height / unit };
}

const field = (style) => el('input', {
  width: '100%', boxSizing: 'border-box', height: '9px', padding: '0 1px', fontFamily: FONT, fontSize: `${FONT_SIZE}px`,
  color: '#ffffff', background: '#000', border: `0.5px solid ${PALETTE.activeEdge}`, ...style,
});

function rowOf(item, current, take) {
  const r = el('div', {
    display: 'flex', alignItems: 'center', gap: '2px', padding: '1.3px', whiteSpace: 'nowrap', overflow: 'hidden',
    textOverflow: 'ellipsis', color: '#ffffff', cursor: 'pointer', background: item.value === current ? ROW.current : 'transparent',
  });
  if (item.icon) r.append(icon(item.icon));
  if (item.category) {
    r.append(el('span', { color: item.color }, item.category), el('span', { color: SEPARATOR }, '›'), el('span', {}, item.text));
  } else {
    r.append(el('span', { overflow: 'hidden', textOverflow: 'ellipsis' }, item.label));
  }
  const rest = r.style.background;
  r.addEventListener('mouseenter', () => { r.style.background = ROW.hover; });
  r.addEventListener('mouseleave', () => { r.style.background = rest; });
  // On the press, before the field loses focus to it.
  r.addEventListener('mousedown', (e) => { e.preventDefault(); r.style.background = ROW.pressed; take(item); });
  return r;
}

// items: params.js dropdownItems. current: the value now. onPick(value): a choice.
// onClose(): it went away, chosen or not. actions: the trigger action box.
export function openDropdown(cell, { items, current, onPick, onClose = () => {}, actions = false }) {
  closeDropdown();
  const at = placeOf(cell);
  const place = actions
    ? { left: `${GAME_WIDTH - RIGHT_PANEL - ACTIONS_WIDTH}px`, top: '0', width: `${ACTIONS_WIDTH}px`, height: `${GAME_HEIGHT}px` }
    : (() => {
      const x = at ? Math.min(at.x, GAME_WIDTH - WIDTH) : GAME_WIDTH - RIGHT_PANEL - WIDTH;
      const y = at ? at.y + at.h : 40;
      const h = Math.max(30, Math.min(MAX_HEIGHT, GAME_HEIGHT - y));
      return { left: `${x}px`, top: `${y}px`, width: `${Math.max(WIDTH, at ? at.w : 0)}px`, maxHeight: `${h}px` };
    })();
  const box = markUi(el('div', {
    ...IN_OVERLAY, position: 'absolute', ...place, zIndex: '48', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    background: BOX.background, border: BOX.border, padding: BOX.padding, fontFamily: FONT, fontSize: `${FONT_SIZE}px`,
    pointerEvents: 'auto', userSelect: 'none',
  }));
  swallow(box);
  const input = field({});
  input.spellcheck = false;
  const list = scrolling(el('div', { overflowY: 'auto', flex: '1', minHeight: '0' }));
  let filter = { text: '', category: '' };
  let custom = null; // the "# calls" row being typed

  const close = () => {
    if (open?.box !== box) return;
    open = null;
    box.remove();
    globalThis.document?.removeEventListener?.('pointerdown', outside, true);
    onClose();
  };
  const take = (item) => {
    if (item.custom) { custom = item; input.value = ''; input.placeholder = item.label; input.focus?.(); return; }
    close();
    onPick(item.value);
  };
  const shown = () => items.filter((it) => !it.custom || !filter.text)
    .filter((it) => !filter.category || it.category === filter.category)
    .filter((it) => !filter.text || `${it.label} ${it.value ?? ''}`.toLowerCase().includes(filter.text));
  const draw = () => {
    list.textContent = '';
    for (const it of shown()) list.append(rowOf(it, current, take));
  };

  if (actions) {
    const bar = el('div', { display: 'flex', flexWrap: 'wrap', background: '#000', marginBottom: '1px' });
    const tag = (label, color, fn) => {
      const t = el('span', { padding: '1.3px 3px', color, cursor: 'pointer' }, label);
      t.addEventListener('mouseenter', () => { t.style.background = ROW.hover; });
      t.addEventListener('mouseleave', () => { t.style.background = 'transparent'; });
      t.addEventListener('mousedown', (e) => { e.preventDefault(); fn(); });
      return t;
    };
    bar.append(tag('Everything', '#ffffff', () => { filter = { ...filter, category: '' }; draw(); }));
    for (const c of actionCategories()) bar.append(tag(c.name, c.color, () => { filter = { ...filter, category: c.name }; draw(); }));
    bar.append(tag('Do Nothing', '#ffffff', () => take({ value: DO_NOTHING })));
    box.append(bar);
  }
  box.append(input, list);
  input.addEventListener('input', () => { if (!custom) { filter = { ...filter, text: input.value.trim().toLowerCase() }; draw(); } });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter') {
      const text = input.value.trim();
      if (custom) { const n = text.replace(/^-/, ''); if (n) take({ value: custom.negative ? `-${n}` : n }); return; }
      if (actions) { const first = shown()[0]; if (first) take(first); return; }
      take({ value: text });
    }
  });
  // A press anywhere else closes it (the press still does what it does).
  const outside = (e) => { let n = e.target; while (n && n !== box) n = n.parentElement || n.parent; if (!n) close(); };
  globalThis.document?.addEventListener?.('pointerdown', outside, true);

  draw();
  game.overlay().append(box);
  open = { box, close, take, input };
  input.focus?.();
  return open;
}

// For tests: the choices shown now, and taking one by its label or value.
export function dropdownState() {
  if (!open) return null;
  const rows = [];
  const walk = (n) => { if (n.text !== undefined && n.text !== '') rows.push(n.text); for (const k of n.childNodes || []) if (typeof k === 'object') walk(k); };
  walk(open.box);
  return { texts: rows, type: (text) => { open.input.value = text; open.input.on?.input?.forEach((fn) => fn({})); }, take: (item) => open.take(item) };
}
