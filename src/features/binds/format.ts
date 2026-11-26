import { formatToggleChoices } from '#console/kernel/commands/toggle.ts';
import { bindStore, keyNames } from './adapters/keys.ts';
import { TEXT } from './text.ts';

export const markedKey = (key: string, isHeld: boolean, isPass: boolean, isToggle: boolean): string => TEXT.marked(
  keyNames.show(key),
  [isHeld ? TEXT.holdMark : '', isToggle ? TEXT.toggleMark : '', isPass ? TEXT.passMark : ''].filter(Boolean),
);

export const shownKey = (key: string): string => markedKey(key, bindStore.isHeld(key), bindStore.isPass(key), bindStore.isToggle(key));

export const shownCommand = (key: string, command: string): string => (bindStore.isToggle(key) ? formatToggleChoices(command) : command);
