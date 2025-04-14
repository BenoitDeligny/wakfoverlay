const closeBtn = document.getElementById('close-btn');
const selectFileBtn = document.getElementById('select-file-btn');
const logContent = document.getElementById('logContent');
const currentFightIdElement = document.getElementById('current-fight-id');
const lastFightIdElement = document.getElementById('last-fight-id');
const currentFightTotalDamageElement = document.getElementById('current-fight-total-damage');
const lastFightTotalDamageElement = document.getElementById('last-fight-total-damage');
const currentFightersListElement = document.getElementById('current-fighters-list');
const lastFightersListElement = document.getElementById('last-fighters-list');

let selectedFilePath = null;
let pollInterval = null;

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    window.electronAPI.sendCloseWindow();
  });
}

if (selectFileBtn) {
  selectFileBtn.addEventListener('click', async () => {
    selectedFilePath = await window.electronAPI.selectFile();
    if (selectedFilePath) {
      startPolling();
    }
  });
}

function startPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  fetchLogContent();
  pollInterval = setInterval(fetchLogContent, 2000);
}

function createFighterListHTML(fighters) {
  if (!fighters || fighters.length === 0) {
    return '<p>No fighter data available.</p>';
  }
  let html = '<ul>';
  fighters.forEach(fighter => {
    html += `<li>${fighter.name} (ID: ${fighter.fighterId})${fighter.isAI ? ' [AI]' : ''}</li>`;
  });
  html += '</ul>';
  return html;
}

function updateFightDisplays(fightData) {
  if (currentFightIdElement) {
    currentFightIdElement.textContent = fightData.currentFightId !== null ? fightData.currentFightId : 'N/A';
  }
  if (lastFightIdElement) {
    lastFightIdElement.textContent = fightData.lastCompletedFightId !== null ? fightData.lastCompletedFightId : 'N/A';
  }
  if (currentFightTotalDamageElement) {
    currentFightTotalDamageElement.textContent = fightData.currentFightTotalDamage !== null ? fightData.currentFightTotalDamage.toLocaleString() : '0';
  }
  if (lastFightTotalDamageElement) {
    lastFightTotalDamageElement.textContent = fightData.lastCompletedFightTotalDamage !== null ? fightData.lastCompletedFightTotalDamage.toLocaleString() : '0';
  }
  if (currentFightersListElement) {
    currentFightersListElement.innerHTML = createFighterListHTML(fightData.currentFightFighters);
  }
  if (lastFightersListElement) {
    lastFightersListElement.innerHTML = createFighterListHTML(fightData.lastCompletedFightFighters);
  }
}

async function fetchLogContent() {
  if (!selectedFilePath) return;
  try {
    const fightData = await window.electronAPI.getFightIds(selectedFilePath);
    updateFightDisplays(fightData);
  } catch (error) {
    if (currentFightIdElement) currentFightIdElement.textContent = 'Error';
    if (lastFightIdElement) lastFightIdElement.textContent = 'Error';
    if (currentFightTotalDamageElement) currentFightTotalDamageElement.textContent = 'Error';
    if (lastFightTotalDamageElement) lastFightTotalDamageElement.textContent = 'Error';
    if (currentFightersListElement) currentFightersListElement.innerHTML = '<p>Error loading data.</p>';
    if (lastFightersListElement) lastFightersListElement.innerHTML = '<p>Error loading data.</p>';

    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }
}

window.electronAPI.onLoadFile((filePath) => {
  if (filePath) {
    selectedFilePath = filePath;
    startPolling();
  }
});

function updateLogScreen(logData) {
  const logContent = document.getElementById('logs-content');
  if (logContent) {
    logContent.textContent = logData;
    logContent.scrollTop = logContent.scrollHeight;
  }
}

window.electronAPI.onUpdateLog((_event, logData) => {
  updateLogScreen(logData);
});
