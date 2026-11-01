import { el } from '#console/kernel/ui/dom.ts';
import { swallow, markUi } from '#console/kernel/ui/theme.ts';
import { FONT_SIZE, ICON } from './constants.ts';
import {
  BUTTON_STYLE, CAPTION_STYLE, CLICK_EVENT, FONT, HOVER_EVENTS, ICON_STYLE, LIST_ROW_STYLE, LIST_ROW_TEXT_STYLE, PALETTE, PANEL_STYLE, PARAM_LABEL_STYLE,
  PARAM_ROW_STYLE, PARAM_VALUE_STYLE, SCROLLS, STYLESHEET, STYLESHEET_ID, iconUrl,
} from './keys.ts';

export { PALETTE, FONT, FONT_SIZE, ICON, SCROLLS };

type Content = string | Node;
type ButtonOptions = { active?: boolean; enabled?: boolean; title?: string; onPress?: (event: MouseEvent) => void; style?: Readonly<Record<string, string>> };

export function useEditorStyles(on: boolean): void {
  const doc = globalThis.document as Document | undefined;
  const old = doc?.getElementById?.(STYLESHEET_ID);
  if (!on) {
    if (old) old.remove();
    return;
  }
  if (old || !doc?.head) return;
  const sheet = el('style', {}, STYLESHEET);
  sheet.id = STYLESHEET_ID;
  doc.head.append(sheet);
}

export function scrolling<Element extends HTMLElement>(node: Element): Element {
  node.className = SCROLLS;
  return node;
}

export function panel(place: Readonly<Record<string, string>>): HTMLDivElement {
  const box = el('div', PANEL_STYLE(place));
  swallow(box);
  return markUi(scrolling(box));
}

export const caption = (text: string): HTMLDivElement => el('div', CAPTION_STYLE, text);

export function icon(kind: string): HTMLImageElement {
  const image = el('img', ICON_STYLE);
  image.src = iconUrl(kind);
  image.draggable = false;
  return image;
}

export const onClick = (node: EventTarget, handler: (event: MouseEvent) => void): void => {
  node.addEventListener(CLICK_EVENT, (event) => {
    const mouse = event as MouseEvent;
    if (!mouse.button) handler(mouse);
  });
};

export function button(content: Content | readonly Content[], { active = false, enabled = true, title = '', onPress, style = {} }: ButtonOptions = {}): HTMLDivElement {
  const box = el('div', BUTTON_STYLE(active, enabled, style));
  for (const part of ([] as Content[]).concat(content)) box.append(typeof part === 'string' ? el('span', {}, part) : part);
  if (title) box.title = title;
  if (enabled && onPress) onClick(box, (event) => { onPress(event); });
  if (enabled && !active) {
    box.addEventListener(HOVER_EVENTS.enter, () => { box.style.background = PALETTE.buttonHover; });
    box.addEventListener(HOVER_EVENTS.leave, () => { box.style.background = PALETTE.button; });
  }
  return box;
}

export function listRow(kind: string, text: string, isSelected: boolean, onPress: (event: MouseEvent) => void): HTMLDivElement {
  const row = el('div', LIST_ROW_STYLE(isSelected));
  row.append(icon(kind), el('span', LIST_ROW_TEXT_STYLE, text));
  onClick(row, onPress);
  return row;
}

export function paramRow(label: string, valueNode: Node, { hint = '' }: { hint?: string } = {}): { row: HTMLDivElement; value: HTMLDivElement } {
  const row = el('div', PARAM_ROW_STYLE);
  const labelBox = el('div', PARAM_LABEL_STYLE, label);
  if (hint) labelBox.title = hint;
  const valueBox = el('div', PARAM_VALUE_STYLE);
  valueBox.append(valueNode);
  row.append(labelBox, valueBox);
  return { row, value: valueBox };
}
