const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendCloseWindow: () => ipcRenderer.send('close-window'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
  onLoadFile: (callback) => ipcRenderer.on('load-file', (_event, value) => callback(value)),
  getFightIds: (filePath) => ipcRenderer.invoke('get-fight-ids', filePath)
}); 