import { dialog, type BrowserWindow, type MessageBoxOptions } from 'electron';
import type { RequestContext } from '#wrapper/feature-types.ts';
import { DIALOG_BUTTON } from '../constants.ts';
import { DIALOG_TYPE } from '../keys.ts';
import { TEXT } from '../text.ts';
import type { RiskyCommand } from '../domain/risky.ts';

export async function askInDialog(commands: readonly RiskyCommand[], context: RequestContext): Promise<boolean> {
  const window = context.window as BrowserWindow | null | undefined;
  const options: MessageBoxOptions = {
    type: DIALOG_TYPE,
    title: TEXT.dialogTitle,
    message: TEXT.dialogMessage,
    detail: TEXT.dialogDetail(commands.map((entry) => TEXT.dialogLine(entry.where, entry.command))),
    buttons: [...TEXT.buttons],
    defaultId: DIALOG_BUTTON.refuse,
    cancelId: DIALOG_BUTTON.refuse,
    noLink: true,
  };
  const answer = window && !window.isDestroyed() ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options);
  return answer.response === DIALOG_BUTTON.keep;
}
