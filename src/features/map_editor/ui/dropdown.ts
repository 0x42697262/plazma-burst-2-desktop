import { el } from '#console/kernel/ui/dom.ts';
import { swallow, markUi } from '#console/kernel/ui/theme.ts';
import { game, GAME_WIDTH, GAME_HEIGHT } from '#console/kernel/game/bindings.ts';
import { actionCategories, type DropdownItem } from '../domain/params.ts';
import type { Picture } from '../domain/keys.ts';
import { icon, scrolling } from './style.ts';
import { DROPDOWN } from './constants.ts';
import {
  CATEGORY_TAG_STYLE, CATEGORY_BAR_STYLE, DO_NOTHING, DROPDOWN_BOX_STYLE, DROPDOWN_FIELD_STYLE, DROPDOWN_LIST_STYLE, DROPDOWN_TEXT, HOVER_EVENTS,
  INPUT_EVENT, KEY_DOWN_EVENT, KEY_NAME, LEADING_MINUS, MOUSE_DOWN_EVENT, NEGATIVE_PREFIX, POINTER_DOWN_EVENT, ROW_COLOR, ROW_LABEL_STYLE, ROW_SEPARATOR_STYLE,
  ROW_STYLE, TRANSPARENT, WHITE, actionsBoxPlace, dropdownPlace, pictureStyle,
} from './keys.ts';

type Place = { x: number; y: number; w: number; h: number };
type Measured = { getBoundingClientRect?: () => DOMRect };
type Overlay = HTMLElement & Measured;
type Walked = { text?: string; childNodes?: unknown[]; parentElement?: Walked | null; parent?: Walked | null };
type Take = (item: DropdownItem) => void;
type DropdownOptions = {
  items: readonly DropdownItem[];
  current: string | undefined;
  onPick: (value: string) => void;
  onClose?: () => void;
  actions?: boolean;
};
export type OpenDropdown = { box: HTMLDivElement; close: () => void; take: Take; input: HTMLInputElement };

let open: OpenDropdown | null = null;

export const dropdownOpen = (): boolean => !!open;
export function closeDropdown(): void {
  if (open) open.close();
}

function placeOf(cell: Measured): Place | null {
  const overlay = game.overlay() as Overlay | null | undefined;
  const cellBox = cell.getBoundingClientRect?.();
  const overlayBox = overlay?.getBoundingClientRect?.();
  if (!cellBox || !overlayBox || !overlayBox.width) return null;
  const unit = overlayBox.width / GAME_WIDTH;
  return { x: (cellBox.left - overlayBox.left) / unit, y: (cellBox.top - overlayBox.top) / unit, w: cellBox.width / unit, h: cellBox.height / unit };
}

const pictureOf = ({ src, head }: Picture): HTMLSpanElement => el('span', pictureStyle(src, !!head));

function rowOf(item: DropdownItem, current: string | undefined, take: Take): HTMLDivElement {
  const row = el('div', ROW_STYLE(item.value === current));
  if (item.icon) row.append(icon(item.icon));
  if (item.picture) row.append(pictureOf(item.picture));
  if (item.category) {
    row.append(el('span', { color: item.color ?? '' }, item.category), el('span', ROW_SEPARATOR_STYLE, DROPDOWN_TEXT.separator), el('span', {}, item.text));
  } else {
    row.append(el('span', ROW_LABEL_STYLE, item.label));
  }
  const rest = row.style.background;
  row.addEventListener(HOVER_EVENTS.enter, () => { row.style.background = ROW_COLOR.hover; });
  row.addEventListener(HOVER_EVENTS.leave, () => { row.style.background = rest; });
  row.addEventListener(MOUSE_DOWN_EVENT, (event) => {
    event.preventDefault();
    row.style.background = ROW_COLOR.pressed;
    take(item);
  });
  return row;
}

function placeFor(cell: Measured, actions: boolean): Readonly<Record<string, string>> {
  if (actions) return actionsBoxPlace(GAME_WIDTH - DROPDOWN.rightPanel - DROPDOWN.actionsWidth, DROPDOWN.actionsWidth, GAME_HEIGHT);
  const at = placeOf(cell);
  const left = at ? Math.min(at.x, GAME_WIDTH - DROPDOWN.width) : GAME_WIDTH - DROPDOWN.rightPanel - DROPDOWN.width;
  const top = at ? at.y + at.h : DROPDOWN.defaultTop;
  const height = Math.max(DROPDOWN.minHeight, Math.min(DROPDOWN.maxHeight, GAME_HEIGHT - top));
  return dropdownPlace(left, top, Math.max(DROPDOWN.width, at ? at.w : 0), height);
}

export function openDropdown(cell: Measured, { items, current, onPick, onClose = () => undefined, actions = false }: DropdownOptions): OpenDropdown {
  closeDropdown();
  const box = markUi(el('div', DROPDOWN_BOX_STYLE(placeFor(cell, actions))));
  swallow(box);
  const input = el('input', DROPDOWN_FIELD_STYLE);
  input.spellcheck = false;
  const list = scrolling(el('div', DROPDOWN_LIST_STYLE));
  let filter = { text: '', category: '' };
  let custom: DropdownItem | null = null;

  const outside = (event: Event): void => {
    let node = event.target as Walked | null;
    while (node && node !== (box as unknown as Walked)) node = node.parentElement || node.parent || null;
    if (!node) close();
  };
  const close = (): void => {
    if (open?.box !== box) return;
    open = null;
    box.remove();
    globalThis.document?.removeEventListener?.(POINTER_DOWN_EVENT, outside, true);
    onClose();
  };
  const take = (item: DropdownItem): void => {
    if (item.custom) {
      custom = item;
      input.value = '';
      input.placeholder = item.label ?? '';
      input.focus?.();
      return;
    }
    close();
    onPick(item.value as string);
  };
  const shown = (): DropdownItem[] => items.filter((item) => !item.custom || !filter.text)
    .filter((item) => !filter.category || item.category === filter.category)
    .filter((item) => !filter.text || DROPDOWN_TEXT.searched(item.label, item.value).toLowerCase().includes(filter.text));
  const draw = (): void => {
    list.textContent = '';
    for (const item of shown()) list.append(rowOf(item, current, take));
  };

  if (actions) {
    const bar = el('div', CATEGORY_BAR_STYLE);
    const tag = (label: string, color: string, handler: () => void): HTMLSpanElement => {
      const node = el('span', CATEGORY_TAG_STYLE(color), label);
      node.addEventListener(HOVER_EVENTS.enter, () => { node.style.background = ROW_COLOR.hover; });
      node.addEventListener(HOVER_EVENTS.leave, () => { node.style.background = TRANSPARENT; });
      node.addEventListener(MOUSE_DOWN_EVENT, (event) => {
        event.preventDefault();
        handler();
      });
      return node;
    };
    bar.append(tag(DROPDOWN_TEXT.everything, WHITE, () => {
      filter = { ...filter, category: '' };
      draw();
    }));
    for (const category of actionCategories()) {
      bar.append(tag(category.name, category.color, () => {
        filter = { ...filter, category: category.name };
        draw();
      }));
    }
    bar.append(tag(DROPDOWN_TEXT.doNothing, WHITE, () => { take({ value: DO_NOTHING }); }));
    box.append(bar);
  }
  box.append(input, list);
  input.addEventListener(INPUT_EVENT, () => {
    if (!custom) {
      filter = { ...filter, text: input.value.trim().toLowerCase() };
      draw();
    }
  });
  input.addEventListener(KEY_DOWN_EVENT, (event) => {
    event.stopPropagation();
    if (event.key === KEY_NAME.escape) close();
    else if (event.key === KEY_NAME.enter) {
      const text = input.value.trim();
      if (custom) {
        const digits = text.replace(LEADING_MINUS, '');
        if (digits) take({ value: custom.negative ? NEGATIVE_PREFIX + digits : digits });
        return;
      }
      if (actions) {
        const first = shown()[0];
        if (first) take(first);
        return;
      }
      take({ value: text });
    }
  });
  globalThis.document?.addEventListener?.(POINTER_DOWN_EVENT, outside, true);

  draw();
  (game.overlay() as HTMLElement).append(box);
  open = { box, close, take, input };
  input.focus?.();
  return open;
}

type FakeInput = HTMLInputElement & { on?: { input?: ((event: object) => void)[] } };

export function dropdownState(): { texts: string[]; type: (text: string) => void; take: Take } | null {
  if (!open) return null;
  const rows: string[] = [];
  const walk = (node: Walked): void => {
    if (node.text !== undefined && node.text !== '') rows.push(node.text);
    for (const child of node.childNodes || []) if (typeof child === 'object' && child) walk(child);
  };
  walk(open.box as unknown as Walked);
  return {
    texts: rows,
    type: (text: string) => {
      const current = open as OpenDropdown;
      current.input.value = text;
      (current.input as FakeInput).on?.input?.forEach((handler) => { handler({}); });
    },
    take: (item: DropdownItem) => { (open as OpenDropdown).take(item); },
  };
}
