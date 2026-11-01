import { el } from '#console/kernel/ui/dom.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { actionInfo, opcodeName, opcodeType } from '#features/triggers/script.ts';
import { actionsOf, actionValues, triggerText, valuesFromText, type TriggerAction } from '../domain/actions.ts';
import { shownValue, pickKindsOf, dropdownItems } from '../domain/params.ts';
import { referenceTo, nameOf } from '../domain/kinds.ts';
import { TRIGGER_TYPE_KIND, UNPAIRED } from '../domain/keys.ts';
import type { AttrValues, MapDoc, MapElement } from '../domain/doc.ts';
import { setAttrs } from '../services/edit.ts';
import { editorDoc, startPick, cancelPick, currentPick } from '../services/session.ts';
import { editField } from './fields.ts';
import { openDropdown, closeDropdown } from './dropdown.ts';
import { caption, button, paramRow, onClick, scrolling } from './style.ts';
import { NEW_ACTION_TYPE, NO_ACTION_TYPE } from './constants.ts';
import {
  ACTION_SIDES, ERROR_LINE_STYLE, INTEGER_TEXT, KEY_DOWN_EVENT, NOCHANGE_OPACITY, REMOVE_BUTTON_STYLE, TRIGGER_ACTS_STYLE, TRIGGER_TEXT_STYLE,
} from './keys.ts';
import { TRIGGER_PANEL_TEXT as TEXT } from './text.ts';

type Say = (text: string, color?: string) => void;
type Run = (values: AttrValues, what: string) => void;

let asText = false;

function drawText(box: HTMLElement, trigger: MapElement, run: Run, redraw: () => void): void {
  box.append(caption(TEXT.asTextCaption));
  const area = scrolling(el('textarea', TRIGGER_TEXT_STYLE));
  area.value = triggerText(trigger.attrs);
  area.spellcheck = false;
  area.addEventListener(KEY_DOWN_EVENT, (event) => { event.stopPropagation(); });
  const acts = el('div', TRIGGER_ACTS_STYLE);
  acts.append(
    button(TEXT.apply, {
      title: TEXT.applyTitle,
      onPress: () => {
        let values: AttrValues;
        try {
          values = valuesFromText(trigger.attrs, area.value);
        } catch (error) {
          box.append(el('div', ERROR_LINE_STYLE, TEXT.error((error as Error).message)));
          return;
        }
        run(values, TEXT.triggerWhat);
      },
    }),
    button(TEXT.asList, {
      onPress: () => {
        asText = false;
        redraw();
      },
    }),
  );
  box.append(area, acts);
}

export function drawTriggerActions(box: HTMLElement, trigger: MapElement, { redraw, say }: { redraw: () => void; say: Say }): void {
  const run: Run = (values, what) => {
    try {
      const result = setAttrs(trigger, values);
      if (!result.live) say(TEXT.notLive(what, result.why), COLOR.notice);
    } catch (error) {
      say(TEXT.error((error as Error).message), COLOR.error);
    }
    redraw();
  };
  if (asText) {
    drawText(box, trigger, run, redraw);
    return;
  }

  const list = actionsOf(trigger.attrs);
  box.append(caption(TEXT.actionsCaption(list.length)));
  list.forEach((action, index) => {
    const info = actionInfo(Number(action.type));
    const name = el('span', {}, TEXT.actionName(index + 1, opcodeName(Number(action.type))));
    const { row, value } = paramRow(TEXT.typeLabel(action.type), name, { hint: info?.desc || '' });
    onClick(value, () => {
      openDropdown(value, {
        actions: true,
        items: dropdownItems(TRIGGER_TYPE_KIND),
        current: String(action.type),
        onPick: (text) => {
          const trimmed = String(text).trim();
          const type = INTEGER_TEXT.test(trimmed) ? Number(trimmed) : opcodeType(trimmed);
          if (type === null) {
            say(TEXT.unknownAction(text), COLOR.error);
            return;
          }
          const next: TriggerAction[] = type === NO_ACTION_TYPE
            ? list.filter((_, other) => other !== index)
            : list.map((each, other) => (other === index ? { ...each, type } : each));
          run(actionValues(trigger.attrs, next), TEXT.actionWhat(index + 1));
        },
      });
    });
    const remove = button(TEXT.remove, {
      title: TEXT.removeTitle,
      style: REMOVE_BUTTON_STYLE,
      onPress: () => { run(actionValues(trigger.attrs, list.filter((_, other) => other !== index)), TEXT.actionWhat(index + 1)); },
    });
    row.append(remove);
    box.append(row);
    for (const side of ACTION_SIDES) {
      const kind = side === ACTION_SIDES[0] ? info?.a : info?.b;
      const span = el('span', {}, shownValue(kind, action[side]));
      const { row: sideRow, value: sideValue } = paramRow(TEXT.sideLabel(side, kind && kind !== UNPAIRED ? kind : ''), span);
      if (kind === UNPAIRED) sideValue.style.opacity = NOCHANGE_OPACITY;
      const setSide = (text: string): void => {
        run(actionValues(trigger.attrs, list.map((each, other) => (other === index ? { ...each, [side]: text } : each))), TEXT.sideWhat(index + 1, side));
      };
      const what = TEXT.sideWhat(index + 1, side);
      onClick(sideValue, () => {
        const kinds = pickKindsOf(kind);
        const items = dropdownItems(kind, editorDoc(), referenceTo, nameOf);
        if (items.length) {
          openDropdown(sideValue, {
            items,
            current: action[side],
            onPick: (picked) => {
              cancelPick();
              setSide(picked);
            },
            onClose: () => {
              if (currentPick()?.what === what) cancelPick();
            },
          });
        }
        if (kinds) {
          startPick(kinds, what, (target) => {
            closeDropdown();
            setSide(referenceTo(editorDoc() as MapDoc, target));
          });
        }
        if (items.length) return;
        editField(span, {
          initial: action[side],
          onDone: () => {
            cancelPick();
            redraw();
          },
          onCommit: setSide,
        });
      });
      box.append(sideRow);
    }
  });
  const acts = el('div', TRIGGER_ACTS_STYLE);
  acts.append(
    button(TEXT.addAction, {
      title: TEXT.addActionTitle,
      onPress: () => { run(actionValues(trigger.attrs, [...list, { type: NEW_ACTION_TYPE, A: '', B: '' }]), TEXT.newActionWhat); },
    }),
    button(TEXT.asTextButton, {
      onPress: () => {
        asText = true;
        redraw();
      },
    }),
  );
  box.append(acts);
}

export const setTriggersAsText = (on: boolean): void => {
  asText = on;
};
