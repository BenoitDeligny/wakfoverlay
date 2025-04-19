const closeBtn = document.getElementById('close-btn');
const selectFileBtn = document.getElementById('select-file-btn');
const logContent = document.getElementById('logContent');
const currentFightTotalDamageElement = document.getElementById('current-fight-total-damage');
const lastFightTotalDamageElement = document.getElementById('last-fight-total-damage');
const currentFightersListElement = document.getElementById('current-fighters-list');
const lastFightersListElement = document.getElementById('last-fighters-list');
const alwaysOnTopCheckbox = document.getElementById('always-on-top-checkbox');

let selectedFilePath = null;
let pollInterval = null;

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    window.electronAPI.sendCloseWindow();
  });
}

if (selectFileBtn) {
  selectFileBtn.addEventListener('click', async () => {
    try {
      selectedFilePath = await window.electronAPI.selectFile();
      if (selectedFilePath) {
        const initialContent = await window.electronAPI.readFileContent(selectedFilePath);
        updateLogScreen(initialContent);
        startPolling();
      }
    } catch (error) {
        updateLogScreen(`Error selecting or reading file: ${error.message}`);
        if (pollInterval) clearInterval(pollInterval);
    }
  });
}

if (alwaysOnTopCheckbox) {
  alwaysOnTopCheckbox.addEventListener('change', (event) => {
    const isChecked = event.target.checked;
    window.electronAPI.toggleAlwaysOnTop(isChecked);
  });
}

function startPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  fetchLogContent();
  pollInterval = setInterval(fetchLogContent, 2000);
}

function createFighterListHTML(fighters, totalFightDamage) {
  if (!fighters || fighters.length === 0) {
    return '<p>No fighter data available.</p>';
  }

  fighters.sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));

  let html = '';
  fighters.forEach(fighter => {
    const damage = fighter.damageDealt || 0;
    const percentage = (totalFightDamage > 0) ? ((damage / totalFightDamage) * 100).toFixed(1) : 0;
    html += `<li>${fighter.name}: ${damage.toLocaleString()} (${percentage}%)</li>`;
  });
  return html;
}

function updateFightDisplays(fightData) {
  if (currentFightTotalDamageElement) {
    currentFightTotalDamageElement.textContent = fightData.currentFightTotalDamage !== null ? fightData.currentFightTotalDamage.toLocaleString() : '0';
  }
  if (lastFightTotalDamageElement) {
    lastFightTotalDamageElement.textContent = fightData.lastCompletedFightTotalDamage !== null ? fightData.lastCompletedFightTotalDamage.toLocaleString() : '0';
  }
  if (currentFightersListElement) {
    currentFightersListElement.innerHTML = createFighterListHTML(fightData.currentFightFighters, fightData.currentFightTotalDamage);
  }
  if (lastFightersListElement) {
    lastFightersListElement.innerHTML = createFighterListHTML(fightData.lastCompletedFightFighters, fightData.lastCompletedFightTotalDamage);
  }
}

function updateSessionSummaryDisplay(sessionData) {
  const screenTitleElement = document.querySelector('#session-summary-screen h2');
  const sessionSummaryScreen = document.getElementById('session-summary-screen');
  if (!sessionSummaryScreen || !screenTitleElement) return;
  
  const totalDamageElement = document.getElementById('session-total-damage');
  const fightersListElement = document.getElementById('session-fighters-list');

  const sessionInfo = sessionData.sessionInfo || { startTime: null, totalDamage: 0 }; 
  const sessionFighters = sessionData.sessionFighters || [];
  const totalDamage = sessionInfo.totalDamage || 0;

  if (!sessionInfo.startTime) {
    if (fightersListElement) fightersListElement.innerHTML = '<p>No active session detected.</p>';
    if (totalDamageElement) totalDamageElement.textContent = '0';
    if (screenTitleElement) screenTitleElement.textContent = 'Session Summary';
    return;
  }

  screenTitleElement.textContent = `Last Session Summary`;

  if (fightersListElement) {
    fightersListElement.innerHTML = createFighterListHTML(sessionFighters, totalDamage);
  } else {
      console.error("Could not find session fighters list element (#session-fighters-list).");
  }

  if (totalDamageElement) {
    totalDamageElement.textContent = totalDamage.toLocaleString();
  }
}

async function fetchLogContent() {
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
    
    console.error('Error fetching combined data:', error);

    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }
}

window.electronAPI.onLoadFile(async (filePath) => {
  if (filePath) {
    selectedFilePath = filePath;
    try {
        startPolling();
    } catch (error) {
        updateLogScreen(`Error processing initial file load: ${error.message}`);
        if (pollInterval) clearInterval(pollInterval);
    }
  }
});

function updateLogScreen(logData) {
  if (logContent) {
    logContent.textContent = logData;
    logContent.scrollTop = logContent.scrollHeight;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const navigationContainer = document.querySelector('.navigation');
  const screens = document.querySelectorAll('.screen');
  const navButtons = document.querySelectorAll('.nav-button');

  if (navigationContainer) {
    navigationContainer.addEventListener('click', (event) => {
      if (event.target.matches('.nav-button')) {
        const targetScreenId = event.target.dataset.target;

        screens.forEach(screen => screen.classList.remove('active'));
        navButtons.forEach(button => button.classList.remove('active'));

        const targetScreen = document.getElementById(targetScreenId);
        if (targetScreen) {
          targetScreen.classList.add('active');
        }
        event.target.classList.add('active');
      }
    });
  }
});
