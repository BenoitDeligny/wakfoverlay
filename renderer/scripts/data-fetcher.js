import { updateFightDisplays, updateSessionSummaryDisplay, updateDamageStatsWindow } from './ui-manager.js';

let pollInterval = null;
let selectedFilePath = null;

/**
 * Starts polling for log file updates
 */
export function startPolling(filePath) {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  
  selectedFilePath = filePath;
  fetchLogContent();
  pollInterval = setInterval(fetchLogContent, 2000);
}

/**
 * Stops the polling interval
 */
export function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

/**
 * Fetches and processes log content from the selected file
 */
export async function fetchLogContent() {
  if (!selectedFilePath) return;
  
  try {
    const combinedData = await window.electronAPI.getFightIds(selectedFilePath);
    
    // Validate data before updating UI
    const validData = {
      currentFightTotalDamage: combinedData.currentFightTotalDamage || 0,
      lastCompletedFightTotalDamage: combinedData.lastCompletedFightTotalDamage || 0,
      currentFightFighters: Array.isArray(combinedData.currentFightFighters) ? combinedData.currentFightFighters : [],
      lastCompletedFightFighters: Array.isArray(combinedData.lastCompletedFightFighters) ? combinedData.lastCompletedFightFighters : [],
      sessionFighters: Array.isArray(combinedData.sessionFighters) ? combinedData.sessionFighters : [],
      sessionInfo: combinedData.sessionInfo || { totalDamage: 0 }
    };
    
    updateFightDisplays(validData);

    const sessionData = {
      sessionInfo: validData.sessionInfo,
      sessionFighters: validData.sessionFighters
    };
    
    updateSessionSummaryDisplay(sessionData);
    
    // Always update the damage stats window if it exists
    // The window-manager will take care of checking if the window exists
    updateDamageStatsWindow(validData);

  } catch (error) {
    console.error(`Error fetching log content: ${error.message}`);
    
    // Try to keep UI responsive even with error - update with empty/default data
    const defaultData = {
      currentFightTotalDamage: 0,
      lastCompletedFightTotalDamage: 0,
      currentFightFighters: [],
      lastCompletedFightFighters: [],
      sessionFighters: [],
      sessionInfo: { totalDamage: 0 }
    };
    
    updateFightDisplays(defaultData);
    
    const defaultSessionData = {
      sessionInfo: { totalDamage: 0 },
      sessionFighters: []
    };
    
    updateSessionSummaryDisplay(defaultSessionData);
    
    // Update damage stats window with default data
    updateDamageStatsWindow(defaultData);
  }
}

/**
 * Selects a log file and starts processing
 */
export async function selectAndProcessFile() {
  try {
    const filePath = await window.electronAPI.selectFile();
    if (filePath) {
      selectedFilePath = filePath;
      await window.electronAPI.readFileContent(filePath);
      startPolling(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error selecting or reading file: ${error.message}`);
    stopPolling();
    return false;
  }
}

/**
 * Gets the currently selected file path
 */
export function getSelectedFilePath() {
  return selectedFilePath;
}

/**
 * Sets the currently selected file path
 */
export function setSelectedFilePath(filePath) {
  selectedFilePath = filePath;
}