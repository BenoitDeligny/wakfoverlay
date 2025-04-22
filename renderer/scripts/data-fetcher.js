import { updateFightDisplays, updateSessionSummaryDisplay, updateLogScreen } from './ui-manager.js';

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
    
    updateFightDisplays({
      currentFightTotalDamage: combinedData.currentFightTotalDamage,
      lastCompletedFightTotalDamage: combinedData.lastCompletedFightTotalDamage,
      currentFightFighters: combinedData.currentFightFighters,
      lastCompletedFightFighters: combinedData.lastCompletedFightFighters
    });

    updateSessionSummaryDisplay({
      sessionInfo: combinedData.sessionInfo,
      sessionFighters: combinedData.sessionFighters
    }); 

  } catch (error) {
    const currentFightTotalDamageElement = document.getElementById('current-fight-total-damage');
    const lastFightTotalDamageElement = document.getElementById('last-fight-total-damage');
    const currentFightersListElement = document.getElementById('current-fighters-list');
    const lastFightersListElement = document.getElementById('last-fighters-list');
    
    if (currentFightTotalDamageElement) currentFightTotalDamageElement.textContent = 'Error';
    if (lastFightTotalDamageElement) lastFightTotalDamageElement.textContent = 'Error';
    if (currentFightersListElement) currentFightersListElement.innerHTML = '<p>Error loading fight data.</p>';
    if (lastFightersListElement) lastFightersListElement.innerHTML = '<p>Error loading fight data.</p>';
    
    const screenTitleElement = document.querySelector('#session-summary-screen h2');
    const totalDamageElement = document.getElementById('session-total-damage');
    const fightersListElement = document.getElementById('session-fighters-list');
    
    if(screenTitleElement) screenTitleElement.textContent = 'Session Summary - Error';
    if(totalDamageElement) totalDamageElement.textContent = 'Error';
    if(fightersListElement) fightersListElement.innerHTML = `<p>Error loading session data: ${error.message}</p>`;

    stopPolling();
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
      const initialContent = await window.electronAPI.readFileContent(filePath);
      updateLogScreen(initialContent);
      startPolling(filePath);
      return true;
    }
    return false;
  } catch (error) {
    updateLogScreen(`Error selecting or reading file: ${error.message}`);
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