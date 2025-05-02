const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const { createDamageStatsWindow, getDamageStatsWindow, sendToDamageStatsWindow, ensureOnTop } = require('./window-manager');
const { analyzeLogFile } = require('./log-analyzer');
const { saveLastFile, loadLastFile } = require('./utils');

app.whenReady().then(async () => {
  ipcMain.on('close-window', (event) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    if (win) {
      win.close();
    }
  });

  ipcMain.on('toggle-always-on-top', (event, isAlwaysOnTop) => {
    const damageStatsWindow = getDamageStatsWindow();
    if (damageStatsWindow) {
      if (isAlwaysOnTop) {
        damageStatsWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      } else {
        damageStatsWindow.setAlwaysOnTop(false);
      }
    }
  });

  // Handle updating the damage stats window
  ipcMain.on('update-damage-stats', (event, data) => {
    sendToDamageStatsWindow('damage-stats-update', data);
  });

  ipcMain.handle('select-file', async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      await saveLastFile(filePath);
      return filePath;
    }
    return null;
  });

  ipcMain.handle('read-file-content', async (event, filePath) => {
    if (!filePath) {
      throw new Error('File path is not provided.');
    }
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      } else {
        throw new Error(`Failed to read file: ${error.message}`);
      }
    }
  });

  ipcMain.handle('get-fight-ids', async (event, filePath) => {
    if (!filePath) {
      throw new Error('Log file path is required.');
    }
    try {
      const combinedData = await analyzeLogFile(filePath);
      return combinedData;
    } catch (error) {
        throw new Error(`Failed to analyze log file: ${error.message}`);
    }
  });

  // Create the damage stats window as the main window
  const window = createDamageStatsWindow();
  
  // Register a global shortcut to bring the window to front
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    ensureOnTop();
  });
  
  const lastFilePath = await loadLastFile();
  if (lastFilePath) {
    window.webContents.on('did-finish-load', () => {
      window.webContents.send('load-file', lastFilePath);
    });
  }
});

app.on('will-quit', () => {
  // Unregister the shortcut before quitting
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 