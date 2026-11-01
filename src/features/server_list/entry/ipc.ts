import { IPC_CHANNEL, URL_HASH } from '../keys.ts';
import { ROUTE_TEXT } from '../text.ts';
import type { ServerListService } from '../services/server-list.ts';

type IpcEvent = { senderFrame?: { url: string } | null };
export type IpcMainLike = { handle(channel: string, listener: (event: IpcEvent, ...args: unknown[]) => unknown): void };

export function registerServerListIpc(ipcMain: IpcMainLike, launcherUrl: string, service: ServerListService): void {
  const isFromLauncher = (event: IpcEvent): boolean => event.senderFrame?.url.split(URL_HASH)[0] === launcherUrl;
  const handle = (channel: string, action: (argument: unknown) => unknown): void => {
    ipcMain.handle(channel, (event, argument) => {
      if (!isFromLauncher(event)) return Promise.reject(new Error(ROUTE_TEXT.notAllowed));
      return Promise.resolve(action(argument));
    });
  };
  const { operations } = service;
  handle(IPC_CHANNEL.list, () => operations.list());
  handle(IPC_CHANNEL.save, (entry) => operations.save(entry as Parameters<typeof operations.save>[0]));
  handle(IPC_CHANNEL.remove, (id) => operations.remove(id));
  handle(IPC_CHANNEL.check, (id) => operations.check(id));
  handle(IPC_CHANNEL.fingerprint, (address) => operations.fingerprint(address));
  handle(IPC_CHANNEL.play, (id) => operations.play(id));
}
