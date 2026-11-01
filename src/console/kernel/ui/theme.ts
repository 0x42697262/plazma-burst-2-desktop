import { IN_OVERLAY, SWALLOWED_EVENTS, THEME, UI_MARK } from './keys.ts';

export { IN_OVERLAY, SWALLOWED_EVENTS, THEME };

type Marked = { [UI_MARK]?: boolean; parentElement?: Marked | null; parent?: Marked | null };

export function swallow(node: EventTarget): void {
  for (const type of SWALLOWED_EVENTS) node.addEventListener(type, (event) => { event.stopPropagation(); });
}

export function markUi<Node extends object>(node: Node): Node {
  (node as Marked)[UI_MARK] = true;
  return node;
}

export function isUi(target: unknown): boolean {
  for (let node = target as Marked | null | undefined; node; node = node.parentElement || node.parent) if (node[UI_MARK]) return true;
  return false;
}
