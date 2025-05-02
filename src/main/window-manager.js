const { BrowserWindow } = require('electron');
const path = require('path');

let damageStatsWindow = null;

/**
 * Creates a damage stats window as the main application window
 */
function createDamageStatsWindow() {
  // If the window already exists, just show it
  if (damageStatsWindow) {
    damageStatsWindow.show();
    damageStatsWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    return damageStatsWindow;
  }
  
  // Create a new window
  damageStatsWindow = new BrowserWindow({
    width: 350,
    height: 200,
    transparent: true,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  
  // Make sure the window stays on top of all other windows with highest priority level
  damageStatsWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  
  // Enable scrolling in the window
  damageStatsWindow.webContents.on('did-finish-load', () => {
    damageStatsWindow.webContents.setVisualZoomLevelLimits(1, 3); // Allow zooming for better visibility
  });
  
  damageStatsWindow.loadFile('renderer/damage-stats.html');
  
  // Show the window when it's ready
  damageStatsWindow.once('ready-to-show', () => {
    damageStatsWindow.show();
    // Apply always on top again, to be sure
    damageStatsWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  });
  
  // Restore always-on-top when the window gains focus
  damageStatsWindow.on('focus', () => {
    damageStatsWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  });
  
  return damageStatsWindow;
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

/**
 * Ensures the damage stats window is visible and on top
 */
function ensureOnTop() {
  if (damageStatsWindow && !damageStatsWindow.isDestroyed()) {
    damageStatsWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    damageStatsWindow.show();
    damageStatsWindow.focus();
  }
}

module.exports = {
  createDamageStatsWindow,
  getDamageStatsWindow,
  sendToDamageStatsWindow,
  ensureOnTop
}; 