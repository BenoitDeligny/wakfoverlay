const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendCloseWindow: () => ipcRenderer.send('close-window'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
  onLoadFile: (callback) => ipcRenderer.on('load-file', (_event, value) => callback(value)),
  getFightIds: (filePath) => ipcRenderer.invoke('get-fight-ids', filePath),
  toggleAlwaysOnTop: (isAlwaysOnTop) => ipcRenderer.send('toggle-always-on-top', isAlwaysOnTop),
  openDamageStatsWindow: () => ipcRenderer.send('open-damage-stats-window'),
  closeDamageStatsWindow: () => ipcRenderer.send('close-damage-stats-window'),
  updateDamageStats: (data) => ipcRenderer.send('update-damage-stats', data),
  onDamageStatsUpdate: (callback) => ipcRenderer.on('damage-stats-update', (_event, data) => callback(data)),
  onDamageStatsWindowClosed: (callback) => ipcRenderer.on('damage-stats-window-closed', (_event) => callback()),
}); 