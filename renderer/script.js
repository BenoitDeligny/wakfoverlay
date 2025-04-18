const closeBtn = document.getElementById('close-btn');
const selectFileBtn = document.getElementById('select-file-btn');
const logContent = document.getElementById('logContent');
const currentFightTotalDamageElement = document.getElementById('current-fight-total-damage');
const lastFightTotalDamageElement = document.getElementById('last-fight-total-damage');
const currentFightersListElement = document.getElementById('current-fighters-list');
const lastFightersListElement = document.getElementById('last-fighters-list');
const alwaysOnTopCheckbox = document.getElementById('always-on-top-checkbox');
const sessionSummaryContentElement = document.getElementById('session-summary-content');

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

async function fetchSessionData() {
  if (!selectedFilePath) return;
  try {
    const sessionData = await window.electronAPI.getSessionData(selectedFilePath);
    updateSessionSummaryDisplay(sessionData);
  } catch (error) {
    if (sessionSummaryContentElement) sessionSummaryContentElement.innerHTML = `<p>Error loading session data: ${error.message}</p>`;
    console.error('Error fetching session data:', error);
  }
}

function updateSessionSummaryDisplay(sessions) {
  const screenTitleElement = document.querySelector('#session-summary-screen h2');
  if (!sessionSummaryContentElement || !screenTitleElement) return;
  const totalDamageElement = document.getElementById('session-total-damage');

  if (!sessions || sessions.length === 0) {
    sessionSummaryContentElement.innerHTML = '<p>No completed sessions found.</p>';
    if (totalDamageElement) totalDamageElement.textContent = '0';
    if (screenTitleElement) screenTitleElement.textContent = 'Session Summary';
    return;
  }

  const lastSession = sessions[sessions.length - 1];

  const formatDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return '??-??-??:??';
    const dateParts = dateStr.split('-');
    const timeParts = timeStr.split(':');
    if (dateParts.length < 3 || timeParts.length < 2) return '??-??-??:??';
    const day = dateParts[2];
    const month = dateParts[1];
    const hour = timeParts[0];
    const minute = timeParts[1];
    return `${day}/${month} at ${hour}:${minute}`;
  };

  const startTimeFormatted = formatDateTime(lastSession.startDate, lastSession.startTime);
  const endTimeFormatted = formatDateTime(lastSession.endDate, lastSession.endTime);
  const totalDamage = lastSession.totalDamage || 0;

  screenTitleElement.textContent = `Last session: ${startTimeFormatted} - ${endTimeFormatted}`;

  sessionSummaryContentElement.innerHTML = `<ul><li>Session processed: ${startTimeFormatted} to ${endTimeFormatted}</li></ul>`;

  if (totalDamageElement) {
    totalDamageElement.textContent = totalDamage.toLocaleString();
  }
}

async function fetchLogContent() {
  if (!selectedFilePath) return;
  try {
    const fightData = await window.electronAPI.getFightIds(selectedFilePath);
    updateFightDisplays(fightData);

    fetchSessionData(); 

    const currentLogContent = await window.electronAPI.readFileContent(selectedFilePath);
    updateLogScreen(currentLogContent);

  } catch (error) {
    if (currentFightTotalDamageElement) currentFightTotalDamageElement.textContent = 'Error';
    if (lastFightTotalDamageElement) lastFightTotalDamageElement.textContent = 'Error';
    if (currentFightersListElement) currentFightersListElement.innerHTML = '<p>Error loading data.</p>';
    if (lastFightersListElement) lastFightersListElement.innerHTML = '<p>Error loading data.</p>';
    updateLogScreen(`Error fetching data: ${error.message}`);

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
        const initialContent = await window.electronAPI.readFileContent(selectedFilePath);
        updateLogScreen(initialContent);
        startPolling();
        fetchSessionData();
    } catch (error) {
        updateLogScreen(`Error reading initial file: ${error.message}`);
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
