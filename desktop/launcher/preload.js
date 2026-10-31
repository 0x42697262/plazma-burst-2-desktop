// The server list's bridge to the main process (desktop/main.js, serveServerList). The
// window loads this for every page, the game's too: the bridge is only made on the
// list page, a local file, and the main process also answers only that page.
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('pb2servers', {
    list: () => ipcRenderer.invoke('servers:list'),
    save: (entry) => ipcRenderer.invoke('servers:save', entry),
    remove: (id) => ipcRenderer.invoke('servers:remove', id),
    check: (id) => ipcRenderer.invoke('servers:check', id),
    fingerprint: (address) => ipcRenderer.invoke('servers:fingerprint', address),
    play: (id) => ipcRenderer.invoke('servers:play', id),
  });
}
