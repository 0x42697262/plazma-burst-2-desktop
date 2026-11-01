// A value that turns into a text box when clicked, as in the map editor's params: Enter
// applies it, Esc or clicking elsewhere leaves it as it was. `choices` offers
// completions (a datalist): strings, or { value, label }.
import { el } from '../../../../src/console/kernel/ui/dom.ts';
import { PALETTE, FONT, FONT_SIZE } from './style.js';

let lists = 0;

export function editField(span, { initial, onCommit, onDone, choices = [] }) {
  const input = el('input', {
    width: '100%', boxSizing: 'border-box', fontFamily: FONT, fontSize: `${FONT_SIZE}px`, color: PALETTE.title,
    background: PALETTE.box, border: `0.5px solid ${PALETTE.activeEdge}`, padding: '0 1px', height: '9px',
  });
  input.value = initial ?? '';
  input.spellcheck = false;
  let list = null;
  if (choices.length && input.setAttribute) {
    list = el('datalist', {});
    list.id = `pb2dev-choices-${++lists}`;
    for (const c of choices) {
      const o = el('option', {});
      o.value = typeof c === 'string' ? c : c.value;
      if (typeof c !== 'string' && c.label) o.label = c.label;
      list.append(o);
    }
    input.setAttribute('list', list.id);
  }
  let finished = false;
  const finish = (commit) => {
    if (finished) return;
    finished = true;
    if (commit) onCommit(input.value);
    if (list) list.remove();
    onDone();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(false));
  span.replaceWith(input);
  if (list) input.after(list);
  input.focus();
  input.select();
  return input;
}
