import { el } from '#console/kernel/ui/dom.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { KINDS, KIND_TAGS, NOT_PLACED, SHAPE, kindOf, nameOf, referenceTo, type Kind } from '../domain/kinds.ts';
import { isActionAttr } from '../domain/actions.ts';
import { paramsOf, paramInfo, defaultOf, shownValue, pickKindsOf, dropdownItems } from '../domain/params.ts';
import { canUndo, canRedo } from '../domain/history.ts';
import { TAG } from '../domain/keys.ts';
import { isEmptyQuery, matchesQuery, parseQuery, sortedByName } from '../domain/search.ts';
import type { MapElement } from '../domain/doc.ts';
import {
  editorDoc, selected, select, currentLayer, showLayer, countByTag, onChange, pendingCount,
  currentTool, setTool, TOOL, NOTICE, isSelectable, selectableLayers, setSelectable, moreLayers, setMoreLayers, LAYER_GROUPS,
  currentPick, startPick, cancelPick, type Notice,
} from '../services/session.ts';
import { setAttr, deleteElement, duplicateElement, undo, redo, notLiveReason } from '../services/edit.ts';
import { panel, caption, icon, button, listRow, paramRow, onClick, scrolling, useEditorStyles } from './style.ts';
import { drawTriggerActions } from './trigger-panel.ts';
import { editField } from './fields.ts';
import { openDropdown, closeDropdown } from './dropdown.ts';
import { MESSAGE_MS, MESSAGE_SLACK_MS, OBJECTS_SHOWN } from './constants.ts';
import {
  ACTIONS_STYLE, DIMMED_OPACITY, ICON_NAME, INPUT_EVENT, KEY_DOWN_EVENT, KEY_NAME, KEY_UP_EVENT, LAYERS_BUTTON, OBJECT_SEARCH_ROW_STYLE, OBJECT_SEARCH_STYLE, SORT_BUTTON, LAYER_LIST_BUTTON, MUTED_STYLE, NOTICE_STYLE, OBJECTS_BOX_STYLE, PANEL_PLACE, PARAMS_HEAD_STYLE,
  SECTION_GAP_STYLE, SMALL_TOOL, STATUS_STYLE, TOOL_GRID_STYLE, TOOL_SQUARE, PANEL_STATE,
} from './keys.ts';
import { PANELS_TEXT as TEXT } from './text.ts';

type Nodes = {
  left: HTMLDivElement;
  right: HTMLDivElement;
  tools: HTMLDivElement;
  layers: HTMLDivElement;
  objectsCaption: HTMLDivElement;
  objectSearch: HTMLInputElement;
  objectSort: HTMLDivElement;
  objects: HTMLDivElement;
  params: HTMLDivElement;
  status: HTMLDivElement;
};
type Part = 'tools' | 'layers' | 'objects' | 'params' | 'status';
type Message = { text: string; color: string; until: number };

let nodes: Nodes | null = null;
let unsubscribe: (() => boolean) | null = null;
let keyShown = '';
let message: Message | null = null;
let objectQuery = '';
let objectsByName = false;

const currentNodes = (): Nodes => nodes as Nodes;

export function say(text: string, color: string = COLOR.plain): void {
  message = { text, color, until: performance.now() + MESSAGE_MS };
  if (nodes) drawStatus();
  setTimeout(() => {
    if (nodes) drawStatus();
  }, MESSAGE_MS + MESSAGE_SLACK_MS);
}

const tryIt = (action: () => unknown) => (): void => {
  try {
    action();
  } catch (error) {
    say(TEXT.error((error as Error).message), COLOR.error);
  }
};

function drawTools(): void {
  const current = selected();
  const tool = currentTool();
  const box = currentNodes().tools;
  box.textContent = '';
  box.append(caption(TEXT.tools));
  const grid = el('div', TOOL_GRID_STYLE);
  grid.append(button(icon(ICON_NAME.select), { active: tool === TOOL.SELECT, title: TEXT.selectTool, style: TOOL_SQUARE, onPress: () => { setTool(TOOL.SELECT); } }));
  for (const tag of KIND_TAGS.filter((kindTag) => !NOT_PLACED.has(kindTag))) {
    const active = tool === TOOL.PLACE && currentLayer() === tag;
    grid.append(button(icon(tag), {
      active,
      title: TEXT.placeTool((KINDS[tag] as Kind).title),
      style: TOOL_SQUARE,
      onPress: () => {
        showLayer(tag);
        setTool(TOOL.PLACE);
      },
    }));
  }
  box.append(grid);
  const acts = el('div', ACTIONS_STYLE);
  acts.append(
    button(TEXT.copy, { enabled: !!current, title: TEXT.copyTitle, style: SMALL_TOOL, onPress: tryIt(() => duplicateElement(current as MapElement)) }),
    button(TEXT.delete, { enabled: !!current, title: TEXT.deleteTitle, style: SMALL_TOOL, onPress: tryIt(() => { deleteElement(current as MapElement); }) }),
    button(TEXT.undo, { enabled: canUndo(), title: TEXT.undoTitle, style: SMALL_TOOL, onPress: tryIt(undo) }),
    button(TEXT.redo, { enabled: canRedo(), title: TEXT.redoTitle, style: SMALL_TOOL, onPress: tryIt(redo) }),
  );
  box.append(acts);
}

const sameSet = (first: readonly string[], second: readonly string[]): boolean => first.length === second.length && first.every((tag) => second.includes(tag));

function drawLayers(): void {
  const counts = countByTag();
  const active = selectableLayers();
  const box = currentNodes().layers;
  box.textContent = '';
  box.append(caption(TEXT.layers));
  const group = (label: string, tags: readonly string[]): HTMLDivElement => button(label, {
    active: sameSet(active, tags), style: LAYERS_BUTTON, onPress: () => { setSelectable(tags); },
  });
  box.append(button(moreLayers() ? TEXT.less : TEXT.more, { style: LAYERS_BUTTON, onPress: () => { setMoreLayers(!moreLayers()); } }));
  if (moreLayers()) {
    for (const tag of KIND_TAGS) {
      box.append(button([icon(tag), TEXT.layerCount((KINDS[tag] as Kind).title, counts[tag] ?? 0)], {
        active: isSelectable(tag),
        title: TEXT.layerHint,
        style: LAYER_LIST_BUTTON,
        onPress: (event) => {
          if (event.ctrlKey && !event.altKey) setSelectable([...active, tag]);
          else if (event.altKey && !event.ctrlKey) setSelectable(active.filter((kindTag) => kindTag !== tag));
          else setSelectable([tag]);
        },
      }));
    }
  }
  box.append(group(TEXT.all, KIND_TAGS), group(TEXT.nothing, []));
  if (!moreLayers()) {
    box.append(
      group(TEXT.statics, LAYER_GROUPS.statics ?? []), group(TEXT.logics, LAYER_GROUPS.logics ?? []), group(TEXT.entities, LAYER_GROUPS.entities ?? []),
    );
  }
}

function drawObjectSort(): void {
  const box = currentNodes().objectSort;
  box.textContent = '';
  box.append(button(objectsByName ? TEXT.sortByName : TEXT.sortMapOrder, {
    active: objectsByName,
    title: TEXT.sortHint(objectsByName),
    style: SORT_BUTTON,
    onPress: () => {
      objectsByName = !objectsByName;
      drawObjectSort();
      drawObjects();
    },
  }));
}

function drawObjects(): void {
  const doc = editorDoc();
  const visible = doc ? doc.elements.filter((item) => kindOf(item.tag) && isSelectable(item.tag)) : [];
  const query = parseQuery(objectQuery);
  const found = doc ? visible.filter((item) => matchesQuery(doc, item, query)) : [];
  const list = doc && objectsByName ? sortedByName(doc, found) : found;
  const current = selected();
  const all = currentNodes();
  const box = all.objects;
  box.textContent = '';
  for (const item of list.slice(0, OBJECTS_SHOWN)) box.append(listRow(item.tag, nameOf(doc as NonNullable<typeof doc>, item), item === current, () => { select(item); }));
  if (list.length > OBJECTS_SHOWN) box.append(el('div', MUTED_STYLE, TEXT.moreObjects(list.length - OBJECTS_SHOWN)));
  const searching = !isEmptyQuery(query);
  if (searching && !list.length && visible.length) box.append(el('div', MUTED_STYLE, TEXT.noMatches));
  all.objectsCaption.textContent = searching ? TEXT.objectsFound(list.length, visible.length) : TEXT.objects(list.length);
}

function objectSearchField(): HTMLInputElement {
  const input = el('input', OBJECT_SEARCH_STYLE);
  input.value = objectQuery;
  input.placeholder = TEXT.searchObjects;
  input.title = TEXT.searchHint;
  input.spellcheck = false;
  input.addEventListener(INPUT_EVENT, () => {
    objectQuery = input.value;
    drawObjects();
  });
  input.addEventListener(KEY_DOWN_EVENT, (event) => {
    event.stopPropagation();
    if (event.key !== KEY_NAME.escape) return;
    input.value = '';
    objectQuery = '';
    input.blur();
    drawObjects();
  });
  input.addEventListener(KEY_UP_EVENT, (event) => { event.stopPropagation(); });
  return input;
}

function editValue(cell: HTMLElement, span: HTMLElement, current: MapElement, attr: string, valueKind: string | undefined): void {
  const set = (text: string): void => {
    try {
      const result = setAttr(current, attr, text);
      if (!result.live) say(TEXT.notLiveAttr(attr, result.why), COLOR.notice);
    } catch (error) {
      say(TEXT.error((error as Error).message), COLOR.error);
    }
  };
  const doc = editorDoc();
  const kinds = pickKindsOf(valueKind);
  const items = dropdownItems(valueKind, doc, referenceTo, nameOf);
  if (items.length) {
    openDropdown(cell, {
      items,
      current: current.attrs[attr] ?? defaultOf(current.tag, attr),
      onPick: (value) => {
        cancelPick();
        set(value);
        drawParams();
      },
      onClose: () => {
        if (currentPick()?.what === attr) cancelPick();
      },
    });
  }
  if (kinds) {
    startPick(kinds, attr, (target) => {
      closeDropdown();
      set(referenceTo(doc as NonNullable<typeof doc>, target));
      drawParams();
    });
  }
  if (items.length) return;
  editField(span, {
    initial: current.attrs[attr] ?? defaultOf(current.tag, attr) ?? '',
    onDone: () => {
      cancelPick();
      drawParams();
    },
    onCommit: set,
  });
}

function drawParams(): void {
  const doc = editorDoc();
  const current = selected();
  const box = currentNodes().params;
  box.textContent = '';
  if (!current || !doc) {
    box.append(caption(TEXT.nothingSelected));
    return;
  }
  const head = el('div', PARAMS_HEAD_STYLE);
  head.append(icon(current.tag), el('span', {}, TEXT.selectedHead(kindOf(current.tag)?.title || current.tag, nameOf(doc, current))));
  box.append(head);
  const known = paramsOf(current.tag);
  const extra = Object.keys(current.attrs).filter((attr) => !known.includes(attr) && !(current.tag === TAG.trigger && isActionAttr(attr)));
  for (const attr of [...known, ...extra]) {
    const info = paramInfo(current.tag, attr, current.attrs);
    const isSet = attr in current.attrs;
    const value = isSet ? current.attrs[attr] as string : defaultOf(current.tag, attr) ?? '';
    const span = el('span', {}, shownValue(info?.kind, value));
    const { row, value: cell } = paramRow(info?.title || attr, span, { hint: TEXT.paramHint(attr, info?.desc, isSet) });
    if (!isSet) cell.style.opacity = DIMMED_OPACITY;
    onClick(cell, () => { editValue(cell, span, current, attr, info?.kind); });
    box.append(row);
  }
  if (current.tag === TAG.trigger) drawTriggerActions(box, current, { redraw: drawParams, say });
}

function drawStatus(): void {
  const status = currentNodes().status;
  status.textContent = '';
  const pick = currentPick();
  const layer = KINDS[currentLayer()] as Kind;
  const how = pick
    ? TEXT.pickHow(pick.what, pick.kinds.map((tag) => (KINDS[tag] as Kind).title))
    : currentTool() === TOOL.PLACE
      ? TEXT.placeHow(layer.title, layer.shape === SHAPE.RECT)
      : TEXT.selectHow;
  status.append(el('span', {}, TEXT.statusLine(keyShown, how)));
  const count = pendingCount();
  if (count) status.append(el('span', NOTICE_STYLE, TEXT.pending(count)));
  const why = notLiveReason();
  if (why) status.append(el('div', NOTICE_STYLE, TEXT.lastNotLive(why)));
  if (message && performance.now() < message.until) status.append(el('div', { color: message.color }, message.text));
}

const DRAW: Readonly<Record<Part, () => void>> = Object.freeze({ tools: drawTools, layers: drawLayers, objects: drawObjects, params: drawParams, status: drawStatus });
const REDRAW: Readonly<Partial<Record<Notice, readonly Part[]>>> = Object.freeze({
  [NOTICE.doc]: ['tools', 'layers', 'objects', 'params', 'status'],
  [NOTICE.layer]: ['tools', 'layers', 'objects', 'status'],
  [NOTICE.layers]: ['layers', 'objects', 'params'],
  [NOTICE.selection]: ['tools', 'objects', 'params'],
  [NOTICE.edit]: ['tools', 'layers', 'objects', 'params', 'status'],
  [NOTICE.tool]: ['tools', 'status'],
  [NOTICE.reloaded]: ['status'],
  [NOTICE.pick]: ['status'],
});

export const panelsOnPage = (): string => (!nodes ? PANEL_STATE.none : nodes.left.isConnected === false ? PANEL_STATE.detached : PANEL_STATE.onPage);

export function showPanels(on: boolean, keyName: string): void {
  useEditorStyles(on);
  if (!on) {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    if (nodes) for (const node of [nodes.left, nodes.right, nodes.status]) node.remove();
    nodes = null;
    return;
  }
  if (nodes) return;
  keyShown = keyName;
  const left = panel(PANEL_PLACE.left);
  const right = panel(PANEL_PLACE.right);
  const section = (): HTMLDivElement => el('div', {});
  const built: Nodes = {
    left, right, tools: section(), layers: section(), objectsCaption: caption(''), params: section(),
    objectSearch: objectSearchField(), objectSort: el('div', {}),
    objects: scrolling(el('div', OBJECTS_BOX_STYLE)),
    status: el('div', STATUS_STYLE),
  };
  nodes = built;
  left.append(built.tools, el('div', SECTION_GAP_STYLE), built.layers);
  const searchRow = el('div', OBJECT_SEARCH_ROW_STYLE);
  searchRow.append(built.objectSearch, built.objectSort);
  right.append(built.objectsCaption, searchRow, built.objects, el('div', SECTION_GAP_STYLE), built.params);
  for (const node of [left, right, built.status]) (game.overlay() as HTMLElement).append(node);
  for (const draw of Object.values(DRAW)) draw();
  drawObjectSort();
  unsubscribe = onChange((what) => {
    for (const part of REDRAW[what] || []) DRAW[part]();
  });
}
