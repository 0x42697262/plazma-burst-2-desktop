import { contextBridge, ipcRenderer } from 'electron';
import { FILE_PROTOCOL, IPC_CHANNEL, LAUNCHER_BRIDGE } from '../keys.ts';

if (location.protocol === FILE_PROTOCOL) {
  contextBridge.exposeInMainWorld(LAUNCHER_BRIDGE, {
    list: () => ipcRenderer.invoke(IPC_CHANNEL.list),
    save: (entry: unknown) => ipcRenderer.invoke(IPC_CHANNEL.save, entry),
    remove: (id: string) => ipcRenderer.invoke(IPC_CHANNEL.remove, id),
    check: (id: string) => ipcRenderer.invoke(IPC_CHANNEL.check, id),
    fingerprint: (address: string) => ipcRenderer.invoke(IPC_CHANNEL.fingerprint, address),
    play: (id: string) => ipcRenderer.invoke(IPC_CHANNEL.play, id),
    switchClient: (id: string) => ipcRenderer.invoke(IPC_CHANNEL.switchClient, id),
  });
}
