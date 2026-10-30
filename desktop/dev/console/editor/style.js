// The editor's look, after the browser map editor's (level_editor/e_css.css): its panel
// and button colours, its 16x16 object icons (level_editor/icons16/<kind>.gif, loaded
// from the site like the rest of the game), and small builders for its elements. Sizes
// are game units (the overlay is 800 x 400 of them).
import { el } from '../ui/dom.js';
import { IN_OVERLAY, swallow, markUi } from '../ui/theme.js';

export const PALETTE = Object.freeze({
  panel: '#2e405a', // .leftui / .rightui
  panelEdge: '#152e4e',
  box: '#26354a', // .objbox
  button: '#26354a', // .tool_btn
  buttonText: '#adc6e8',
  buttonHover: '#202d3f',
  active: '#415b80', // .tool_btn2
  activeEdge: '#6887b4',
  rowSelected: '#3c506e', // .selline1
  label: '#819cc0', // .pa1
  labelBack: '#3c506e',
  value: '#adc6e8', // .pa2
  valueBack: '#4a6489',
  valueEdge: '#40577a', // .p_u2
  title: '#ffffff', // .gui_sel_info
  muted: '#7f93ad',
});

export const FONT = 'Tahoma, Verdana, sans-serif';
export const FONT_SIZE = 5; // the editor's 10px at the overlay's usual scale
export const ICON = 8; // a 16px icon
export const ICON_URL = (kind) => `/level_editor/icons16/${kind}.gif`;

const px = (n) => `${n}px`;

// A panel that takes its clicks (the game never sees them).
export function panel(place) {
  const p = el('div', {
    ...IN_OVERLAY, position: 'absolute', ...place, boxSizing: 'border-box', zIndex: '45',
    background: PALETTE.panel, fontFamily: FONT, fontSize: px(FONT_SIZE), color: PALETTE.value,
    overflowX: 'hidden', overflowY: 'auto', scrollbarWidth: 'thin', pointerEvents: 'auto', cursor: 'default', userSelect: 'none',
  });
  swallow(p);
  return markUi(p);
}

export const caption = (text) => el('div', { color: PALETTE.title, margin: '2px 2px 1px', whiteSpace: 'nowrap' }, text);

export function icon(kind) {
  const img = el('img', { width: px(ICON), height: px(ICON), verticalAlign: 'middle', imageRendering: 'pixelated', flex: 'none' });
  img.src = ICON_URL(kind);
  img.draggable = false;
  return img;
}

// "click": it fires even where the game cancels the press itself.
export const onClick = (node, fn) => node.addEventListener('click', (e) => { if (!e.button) fn(e); });

// A .tool_btn: dim and inert when it cannot do anything now, highlighted (.tool_btn2)
// when it is the active one.
export function button(content, { active = false, enabled = true, title = '', onPress, style = {} } = {}) {
  const b = el('div', {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '1px', boxSizing: 'border-box',
    margin: '1px', padding: '0 1px', borderRadius: '1.5px', whiteSpace: 'nowrap', overflow: 'hidden',
    border: `0.5px solid ${active ? PALETTE.activeEdge : PALETTE.button}`, background: active ? PALETTE.active : PALETTE.button,
    color: PALETTE.buttonText, opacity: enabled ? '1' : '0.4', cursor: enabled ? 'pointer' : 'default', ...style,
  });
  for (const c of [].concat(content)) b.append(typeof c === 'string' ? el('span', {}, c) : c);
  if (title) b.title = title;
  if (enabled && onPress) onClick(b, (e) => onPress(e));
  if (enabled && !active) {
    b.addEventListener('mouseenter', () => { b.style.background = PALETTE.buttonHover; });
    b.addEventListener('mouseleave', () => { b.style.background = PALETTE.button; });
  }
  return b;
}

// A row of the object box (.selline1 when selected): icon and name.
export function listRow(kind, text, selected, onPress) {
  const r = el('div', {
    display: 'flex', alignItems: 'center', gap: '2px', height: px(ICON + 1), padding: '0 1px', whiteSpace: 'nowrap',
    overflow: 'hidden', background: selected ? PALETTE.rowSelected : 'transparent', cursor: 'pointer',
  });
  r.append(icon(kind), el('span', { overflow: 'hidden', textOverflow: 'ellipsis' }, text));
  onClick(r, onPress);
  return r;
}

// A params row (.pa1 / .pa2): the title on the left, the value on the right.
export function paramRow(label, valueNode, { hint = '' } = {}) {
  const r = el('div', { display: 'flex', height: '9px', lineHeight: '9px', marginBottom: '0.5px' });
  const l = el('div', {
    width: '46px', flex: 'none', textAlign: 'right', paddingRight: '2px', boxSizing: 'border-box', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: PALETTE.label, background: PALETTE.labelBack,
    borderBottom: `0.5px solid ${PALETTE.labelBack}`,
  }, label);
  if (hint) l.title = hint;
  const v = el('div', {
    flex: '1', minWidth: '0', paddingLeft: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    color: PALETTE.value, background: PALETTE.valueBack, borderBottom: `0.5px solid ${PALETTE.valueEdge}`, cursor: 'text',
  });
  v.append(valueNode);
  r.append(l, v);
  return { row: r, value: v };
}
