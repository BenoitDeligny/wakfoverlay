const { BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;

/**
 * Creates the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 760,
    transparent: true, 
    frame: false, 
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false 
    }
  });

  mainWindow.loadFile('renderer/index.html');
  
  return mainWindow;
}

/**
 * Get the main window instance
 */
function getMainWindow() {
  return mainWindow;
}

module.exports = {
  createWindow,
  getMainWindow
}; 