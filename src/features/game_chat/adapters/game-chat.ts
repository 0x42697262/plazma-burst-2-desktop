import { game } from '#console/kernel/game/bindings.ts';
import { LEVEL_REQUIRED } from '#console/kernel/game/level.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { gameCommandHeldBack, refusal } from '../../../../desktop/dev/console/overrides/server-checks.js';
import { stripHtml } from '#console/kernel/core/words.ts';

export type ChatClip = { y: number; visible: boolean; alpha?: number; timer?: number; htmlText?: string; isRemoved?: boolean; children?: ChatClip[]; [field: string]: unknown };

type ChatBindings = {
  openChat(text: string): void; pressEnter(): void; releaseEnter(): void;
  chatPopups(): ChatClip[]; chatPanel(): ChatClip | null;
  isMP(): boolean; setMP(on: boolean): void; isCustomMap(): boolean; setCustomMap(on: boolean): void;
  sayTrigger(): number; setSayTrigger(trigger: number): void; inLevelFrame(): boolean;
};

const bindings = game as unknown as ChatBindings;

export const gameChat = {
  openChat: (text: string) => bindings.openChat(text),
  pressEnter: () => bindings.pressEnter(),
  releaseEnter: () => bindings.releaseEnter(),
  chatPopups: () => bindings.chatPopups(),
  chatPanel: () => bindings.chatPanel(),
  isMP: () => bindings.isMP(),
  setMP: (on: boolean) => bindings.setMP(on),
  isCustomMap: () => bindings.isCustomMap(),
  setCustomMap: (on: boolean) => bindings.setCustomMap(on),
  sayTrigger: () => bindings.sayTrigger(),
  setSayTrigger: (trigger: number) => bindings.setSayTrigger(trigger),
  inLevelFrame: () => bindings.inLevelFrame(),
  chatTextField: (GAME_FIELDS as { CHAT_TEXT: string }).CHAT_TEXT,
  levelRequired: LEVEL_REQUIRED as string,
  builtinOn: () => (settings as { get(key: string): unknown }).get((KEY as { BUILTIN: string }).BUILTIN) === true,
  heldBack: (text: string) => (gameCommandHeldBack as (text: string) => string | false)(text),
  refusal: (subject: string, why: string) => (refusal as (subject: string, why: string) => Error)(subject, why),
  stripHtml: (text: string) => (stripHtml as (text: string) => string)(text),
};

export type GameChat = typeof gameChat;
