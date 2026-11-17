import { DEBUGGING_SWITCHES, DEVTOOLS_OPENED_EVENT, WEB_CONTENTS_CREATED_EVENT } from './keys.ts';

type LockableContents = { on(name: string, listener: () => void): void; closeDevTools(): void };
export type LockdownApp = {
  isPackaged: boolean;
  commandLine: { removeSwitch(name: string): void };
  on(name: string, listener: (event: unknown, contents: LockableContents) => void): void;
};

export function lockDownRelease(app: LockdownApp, edition: Readonly<{ devtools?: boolean }>): boolean {
  if (!app.isPackaged || edition.devtools === true) return false;
  for (const name of DEBUGGING_SWITCHES) app.commandLine.removeSwitch(name);
  app.on(WEB_CONTENTS_CREATED_EVENT, (_event, contents) => {
    contents.on(DEVTOOLS_OPENED_EVENT, () => { contents.closeDevTools(); });
  });
  return true;
}
