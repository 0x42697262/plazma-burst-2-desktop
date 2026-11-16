import { IPC_CHANNEL, URL_HASH } from '../keys.ts';
import { ROUTE_TEXT } from '../text.ts';
import type { AccountRequest, ServerListService } from '../services/server-list.ts';

type IpcEvent = { senderFrame?: { url: string } | null };
export type IpcMainLike = { handle(channel: string, listener: (event: IpcEvent, ...args: unknown[]) => unknown): void };
type Action = (...args: unknown[]) => unknown;

export function registerServerListIpc(ipcMain: IpcMainLike, launcherUrl: string, service: ServerListService): void {
  const isFromLauncher = (event: IpcEvent): boolean => event.senderFrame?.url.split(URL_HASH)[0] === launcherUrl;
  const handle = (channel: string, action: Action): void => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isFromLauncher(event)) return Promise.reject(new Error(ROUTE_TEXT.notAllowed));
      return Promise.resolve(action(...args));
    });
  };
  const { operations } = service;
  handle(IPC_CHANNEL.list, (client) => operations.list(client));
  handle(IPC_CHANNEL.save, (entry) => operations.save(entry as Parameters<typeof operations.save>[0]));
  handle(IPC_CHANNEL.remove, (id) => operations.remove(id));
  handle(IPC_CHANNEL.check, (id, client) => operations.check(id, client));
  handle(IPC_CHANNEL.fingerprint, (address) => operations.fingerprint(address));
  handle(IPC_CHANNEL.play, (id, client) => operations.play(id, client));
  const { accountOperations } = service;
  handle(IPC_CHANNEL.accounts, (client) => accountOperations.accountsOf(client));
  handle(IPC_CHANNEL.useAccount, (request) => accountOperations.useAccount(request as AccountRequest));
  handle(IPC_CHANNEL.removeAccount, (request) => accountOperations.removeAccount(request as AccountRequest));
  handle(IPC_CHANNEL.logIn, (request) => accountOperations.logIn(request as AccountRequest));
}
