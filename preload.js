// Runs before the page loads. It gives the page a small, fixed set of abilities (cover search and
// image download) without exposing Node.js or the rest of Electron to the page.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('beastApi', {
  search: (kind, q) => ipcRenderer.invoke('search', kind, q),
  image: (url) => ipcRenderer.invoke('image', url),
  // Saving to the library folder (used by src/disk.js)
  disk: {
    load: () => ipcRenderer.invoke('disk:load'),
    set: (key, text) => ipcRenderer.invoke('disk:set', key, text),
    putCover: (dataUrl) => ipcRenderer.invoke('disk:putCover', dataUrl),
    putFile: (name, bytes, mime) => ipcRenderer.invoke('disk:putFile', name, bytes, mime),
    getFile: (name) => ipcRenderer.invoke('disk:getFile', name),
    delFile: (name) => ipcRenderer.invoke('disk:delFile', name),
    openFolder: () => ipcRenderer.invoke('disk:openFolder')
  }
});
