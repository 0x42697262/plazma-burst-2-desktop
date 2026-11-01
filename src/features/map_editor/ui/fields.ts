import { el } from '#console/kernel/ui/dom.ts';
import { BLUR_EVENT, CHOICE_LIST_ATTRIBUTE, EDIT_FIELD_STYLE, KEY_DOWN_EVENT, KEY_NAME, choicesId } from './keys.ts';

export type Choice = string | { value: string; label?: string };
type FieldOptions = { initial?: string | undefined; onCommit: (text: string) => void; onDone: () => void; choices?: readonly Choice[] };

let lists = 0;

export function editField(span: Element, { initial, onCommit, onDone, choices = [] }: FieldOptions): HTMLInputElement {
  const input = el('input', EDIT_FIELD_STYLE);
  input.value = initial ?? '';
  input.spellcheck = false;
  let list: HTMLDataListElement | null = null;
  if (choices.length && typeof input.setAttribute === 'function') {
    const choiceList = el('datalist', {});
    choiceList.id = choicesId(++lists);
    for (const choice of choices) {
      const option = el('option', {});
      option.value = typeof choice === 'string' ? choice : choice.value;
      if (typeof choice !== 'string' && choice.label) option.label = choice.label;
      choiceList.append(option);
    }
    input.setAttribute(CHOICE_LIST_ATTRIBUTE, choiceList.id);
    list = choiceList;
  }
  let finished = false;
  const finish = (commit: boolean): void => {
    if (finished) return;
    finished = true;
    if (commit) onCommit(input.value);
    if (list) list.remove();
    onDone();
  };
  input.addEventListener(KEY_DOWN_EVENT, (event) => {
    event.stopPropagation();
    if (event.key === KEY_NAME.enter) finish(true);
    else if (event.key === KEY_NAME.escape) finish(false);
  });
  input.addEventListener(BLUR_EVENT, () => { finish(false); });
  span.replaceWith(input);
  if (list) input.after(list);
  input.focus();
  input.select();
  return input;
}
