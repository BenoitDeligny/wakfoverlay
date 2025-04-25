const { BrowserWindow } = require('electron');
const path = require('path');

let mainWindow = null;
let damageStatsWindow = null;

/**
 * Creates the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
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
 * Creates a damage stats window
 */
function createDamageStatsWindow() {
  // If the window already exists, just show it
  if (damageStatsWindow) {
    damageStatsWindow.show();
    return damageStatsWindow;
  }
  
  // Create a new window
  damageStatsWindow = new BrowserWindow({
    width: 225,
    height: 150,
    transparent: true,
    frame: false,
    parent: mainWindow,
    show: false,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // Make sure the window stays on top of all other windows
  damageStatsWindow.setAlwaysOnTop(true, 'screen-saver');
  
  // Enable scrolling in the window
  damageStatsWindow.webContents.on('did-finish-load', () => {
    damageStatsWindow.webContents.setVisualZoomLevelLimits(1, 3); // Allow zooming for better visibility
  });
  
  damageStatsWindow.loadFile('renderer/damage-stats.html');
  
  // When the window is closed, remove the reference and notify the main window
  damageStatsWindow.on('closed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('damage-stats-window-closed');
    }
    damageStatsWindow = null;
  });
  
  // Show the window when it's ready
  damageStatsWindow.once('ready-to-show', () => {
    damageStatsWindow.show();
  });
  
  return damageStatsWindow;
}

/**
 * Get the main window instance
 */
function getMainWindow() {
  return mainWindow;
}

/**
 * Get the damage stats window instance
 */
function getDamageStatsWindow() {
  return damageStatsWindow;
}

/**
 * Send data to the damage stats window
 */
function sendToDamageStatsWindow(channel, data) {
  if (damageStatsWindow && !damageStatsWindow.isDestroyed()) {
    damageStatsWindow.webContents.send(channel, data);
  }
}

module.exports = {
  createWindow,
  getMainWindow,
  createDamageStatsWindow,
  getDamageStatsWindow,
  sendToDamageStatsWindow
}; 