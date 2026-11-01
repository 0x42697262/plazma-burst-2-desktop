import { CHAT_PANEL_ITEMS, NO_TRIGGER, TEXT_WALK_DEPTH } from '../constants.ts';
import { NOT_FOUND, PANEL_FIELDS, TEXT_FIELDS, panelItemName } from '../keys.ts';
import { TEXT } from '../text.ts';
import type { ChatClip, GameChat } from '../adapters/game-chat.ts';

type PanelItem = { item: ChatClip; text: string | undefined; saved: Record<string, unknown> };
type ChatSnapshot = { popups: ChatClip[]; popupY: number[]; panel: PanelItem[] | null };

export type GameCommandDeps = { chat: GameChat; say: (line: string, failed: boolean) => void; done: (text: string) => void };

function textOf(clip: ChatClip): string {
  const found: string[] = [];
  const walk = (node: ChatClip | undefined, depth: number): void => {
    if (!node || depth > TEXT_WALK_DEPTH) return;
    const hasText = typeof node[TEXT_FIELDS.html] === 'string' || typeof node[TEXT_FIELDS.plain] === 'string';
    if (hasText) found.push(node.htmlText ?? '');
    for (const child of node.children ?? []) walk(child, depth + 1);
  };
  walk(clip, 0);
  return found.join(TEXT.textSeparator);
}

export function createGameCommands({ chat, say, done }: GameCommandDeps) {
  const textField = (item: ChatClip): ChatClip | undefined => item[chat.chatTextField] as ChatClip | undefined;

  function snapshot(): ChatSnapshot {
    const popups = chat.chatPopups();
    const panel = chat.chatPanel();
    const taken: ChatSnapshot = { popups: popups.slice(), popupY: popups.map((popup) => popup.y), panel: null };
    if (!panel || panel.isRemoved) return taken;
    taken.panel = [];
    for (let index = 0; index < CHAT_PANEL_ITEMS; index++) {
      const item = panel[panelItemName(index)] as ChatClip | undefined;
      if (!item) continue;
      taken.panel.push({ item, text: textField(item)?.htmlText, saved: Object.fromEntries(PANEL_FIELDS.map((field) => [field, item[field]])) });
    }
    return taken;
  }

  function restore(taken: ChatSnapshot): string[] {
    const added: string[] = [];
    const popups = chat.chatPopups();
    for (const popup of popups) {
      if (taken.popups.includes(popup)) continue;
      added.push(chat.stripHtml(textOf(popup)));
      popup.visible = false;
    }
    taken.popups.forEach((popup, index) => { if (popups.includes(popup)) popup.y = taken.popupY[index] ?? popup.y; });
    for (const entry of taken.panel ?? []) {
      const now = textField(entry.item)?.htmlText;
      if (now !== entry.text || entry.item.timer !== entry.saved.timer) added.push(chat.stripHtml(now ?? ''));
      Object.assign(entry.item, entry.saved);
      const field = textField(entry.item);
      if (field) field.htmlText = entry.text;
    }
    return added.filter(Boolean);
  }

  function typeAndEnter(text: string): void {
    chat.openChat(text);
    chat.pressEnter();
  }

  function runSilent(text: string): void {
    const wasMultiplayer = chat.isMP();
    const wasCustomMap = chat.isCustomMap();
    const sayTrigger = chat.sayTrigger();
    const taken = snapshot();
    let lines: string[];
    try {
      chat.setMP(false);
      chat.setCustomMap(false);
      chat.setSayTrigger(NO_TRIGGER);
      typeAndEnter(text);
    } finally {
      chat.setMP(wasMultiplayer);
      chat.setCustomMap(wasCustomMap);
      chat.setSayTrigger(sayTrigger);
      lines = restore(taken);
    }
    chat.releaseEnter();
    if (lines[0]?.endsWith(text)) lines.shift();
    const failed = lines.some((line) => line.includes(NOT_FOUND));
    for (const line of lines) say(line, failed);
    if (!failed) done(TEXT.ran(text));
  }

  function run(text: string): void {
    if (!text) throw new Error(TEXT.usageError);
    const why = chat.heldBack(text);
    if (why) throw chat.refusal(TEXT.refusedSubject(text), why);
    if (!chat.inLevelFrame()) throw new Error(chat.levelRequired);
    if (chat.builtinOn()) {
      runSilent(text);
      return;
    }
    const isCustomMap = chat.isCustomMap();
    try {
      if (isCustomMap) chat.setCustomMap(false);
      typeAndEnter(text);
    } finally {
      if (isCustomMap) chat.setCustomMap(true);
    }
    chat.releaseEnter();
    done(TEXT.sent(text));
  }

  return { run };
}
