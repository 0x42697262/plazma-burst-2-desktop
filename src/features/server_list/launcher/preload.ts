import { contextBridge, ipcRenderer } from 'electron';
import { FILE_PROTOCOL, IPC_CHANNEL, LAUNCHER_BRIDGE } from '../keys.ts';

if (location.protocol === FILE_PROTOCOL) {
  contextBridge.exposeInMainWorld(LAUNCHER_BRIDGE, {
    list: (client?: string) => ipcRenderer.invoke(IPC_CHANNEL.list, client),
    save: (entry: unknown) => ipcRenderer.invoke(IPC_CHANNEL.save, entry),
    remove: (id: string) => ipcRenderer.invoke(IPC_CHANNEL.remove, id),
    check: (id: string, client?: string) => ipcRenderer.invoke(IPC_CHANNEL.check, id, client),
    fingerprint: (address: string) => ipcRenderer.invoke(IPC_CHANNEL.fingerprint, address),
    play: (id: string, client?: string) => ipcRenderer.invoke(IPC_CHANNEL.play, id, client),
    accounts: (client: string) => ipcRenderer.invoke(IPC_CHANNEL.accounts, client),
    useAccount: (client: string, login: string) => ipcRenderer.invoke(IPC_CHANNEL.useAccount, { client, login }),
    removeAccount: (client: string, login: string) => ipcRenderer.invoke(IPC_CHANNEL.removeAccount, { client, login }),
    logIn: (client: string, login?: string, password?: string) => ipcRenderer.invoke(IPC_CHANNEL.logIn, { client, login, password }),
  });
}
