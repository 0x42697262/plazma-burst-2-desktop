import { PAGE_HIDE_EVENT } from '../keys.ts';

export function onPageHide(handler: () => void): void {
  try {
    const canListen = typeof window !== 'undefined' && typeof EventTarget !== 'undefined';
    if (canListen) EventTarget.prototype.addEventListener.call(window, PAGE_HIDE_EVENT, handler);
  } catch {
    return;
  }
}
