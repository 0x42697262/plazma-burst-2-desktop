// A trigger in the params panel, as the map editor shows one: its actions as a list
// (each action's name, then its A and B), with an action added, removed or changed in
// place; or, after "Edit triggers as text", the whole trigger as the editor's text view
// (the format "triggers exec" reads), applied in one go.
import { el } from '../ui/dom.js';
import { COLOR } from '../core/colors.js';
import { actionInfo, opcodeName, opcodeNames, opcodeType } from '../triggers/script.js';
import { actionsOf, actionValues, triggerText, valuesFromText } from './actions.js';
import { setAttrs } from './edit.js';
import { editField } from './fields.js';
import { choicesOf, shownValue } from './params.js';
import { PALETTE, FONT, FONT_SIZE, caption, button, paramRow, onClick } from './style.js';

const NEW_ACTION_TYPE = 100; // "set variable A to value B": an action that does something harmless
let asText = false; // the map editor's "Edit triggers as text"

// box: where to draw; redraw(): draw the params again; say(text, color): a message.
export function drawTriggerActions(box, trigger, { redraw, say }) {
  const run = (values, what) => {
    try {
      const { live, why } = setAttrs(trigger, values);
      if (!live) say(`${what}: not in the running level (${why})`, COLOR.notice);
    } catch (err) { say(`error: ${err.message}`, COLOR.error); }
    redraw();
  };
  if (asText) { drawText(box, trigger, run, redraw); return; }

  const list = actionsOf(trigger.attrs);
  box.append(caption(`Actions (${list.length}):`));
  list.forEach((a, i) => {
    const info = actionInfo(Number(a.type));
    const name = el('span', {}, `${i + 1}. ${opcodeName(Number(a.type))}`);
    const { row, value } = paramRow(`type ${a.type}`, name, { hint: info?.desc || '' });
    onClick(value, () => editField(name, {
      initial: opcodeName(Number(a.type)), choices: opcodeNames(), onDone: redraw,
      onCommit: (text) => {
        const type = /^-?\d+$/.test(text.trim()) ? Number(text) : opcodeType(text.trim());
        if (type === null) { say(`error: unknown action "${text}"`, COLOR.error); return; }
        run(actionValues(trigger.attrs, list.map((b, k) => (k === i ? { ...b, type } : b))), `action ${i + 1}`);
      },
    }));
    const remove = button('×', { title: 'Remove this action', style: { width: '8px', height: '8px', flex: 'none' },
      onPress: () => run(actionValues(trigger.attrs, list.filter((_, k) => k !== i)), `action ${i + 1}`) });
    row.append(remove);
    box.append(row);
    for (const side of ['A', 'B']) {
      const kind = side === 'A' ? info?.a : info?.b;
      const span = el('span', {}, shownValue(kind, a[side]));
      const { row: r, value: v } = paramRow(`${side}${kind && kind !== 'nochange' ? ` (${kind})` : ''}`, span);
      if (kind === 'nochange') v.style.opacity = '0.5';
      onClick(v, () => editField(span, {
        initial: a[side], onDone: redraw, choices: choicesOf(kind),
        onCommit: (text) => run(actionValues(trigger.attrs, list.map((b, k) => (k === i ? { ...b, [side]: text } : b))), `action ${i + 1} ${side}`),
      }));
      box.append(r);
    }
  });
  const acts = el('div', { display: 'flex', flexWrap: 'wrap', margin: '2px' });
  acts.append(
    button('+ Add action', { title: 'A new action at the end; click its name to pick the action', onPress: () => run(actionValues(trigger.attrs, [...list, { type: NEW_ACTION_TYPE, A: '', B: '' }]), 'new action') }),
    button('Edit triggers as text', { onPress: () => { asText = true; redraw(); } }),
  );
  box.append(acts);
}

function drawText(box, trigger, run, redraw) {
  box.append(caption('Edit triggers as text:'));
  const area = el('textarea', {
    width: 'calc(100% - 4px)', height: '160px', margin: '0 2px', boxSizing: 'border-box', resize: 'vertical',
    fontFamily: 'monospace', fontSize: `${FONT_SIZE}px`, color: PALETTE.title, background: PALETTE.box,
    border: `0.5px solid ${PALETTE.activeEdge}`, whiteSpace: 'pre', overflow: 'auto',
  });
  area.value = triggerText(trigger.attrs);
  area.spellcheck = false;
  area.addEventListener('keydown', (e) => e.stopPropagation());
  const acts = el('div', { display: 'flex', flexWrap: 'wrap', margin: '2px' });
  acts.append(
    button('Apply', { title: 'Replace the trigger with this text', onPress: () => {
      let values;
      try { values = valuesFromText(trigger.attrs, area.value); } catch (err) { box.append(el('div', { color: COLOR.error, fontFamily: FONT }, `error: ${err.message}`)); return; }
      run(values, 'trigger');
    } }),
    button('Edit triggers as param list', { onPress: () => { asText = false; redraw(); } }),
  );
  box.append(area, acts);
}

// For tests.
export const setTriggersAsText = (on) => { asText = on; };
