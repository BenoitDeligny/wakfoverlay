const fs = require('fs').promises;
const fsSync = require('fs');
const { app } = require('electron');
const path = require('path');

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');

/**
 * Format a date to YYYY-MM-DD format
 */
const formatDate = (date) => {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Check if time1 is earlier than time2
 */
const isTimeEarlier = (time1, time2) => {
  return time1 < time2;
};

/**
 * Save the last opened file path to config
 */
async function saveLastFile(filePath) {
  try {
    const config = { lastFilePath: filePath };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
  }
}

/**
 * Load the last opened file path from config
 */
async function loadLastFile() {
  try {
    await fs.access(configPath); 
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    if (config && config.lastFilePath) {
        try {
            await fs.access(config.lastFilePath);
            return config.lastFilePath;
        } catch (accessError) {
            return null;
        }
    }
    return null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  formatDate,
  isTimeEarlier,
  saveLastFile,
  loadLastFile
}; 