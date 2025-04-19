const closeBtn = document.getElementById('close-btn');
const selectFileBtn = document.getElementById('select-file-btn');
const logContent = document.getElementById('logContent');
const currentFightTotalDamageElement = document.getElementById('current-fight-total-damage');
const lastFightTotalDamageElement = document.getElementById('last-fight-total-damage');
const currentFightersListElement = document.getElementById('current-fighters-list');
const lastFightersListElement = document.getElementById('last-fighters-list');
const alwaysOnTopCheckbox = document.getElementById('always-on-top-checkbox');
const menuBtn = document.getElementById('menu-btn');
const menuPopup = document.getElementById('menu-popup');
const menuNavLinks = document.querySelectorAll('.menu-nav-link');
const sessionTotalDamageElem = document.getElementById('session-total-damage');
const sessionFightersList = document.getElementById('session-fighters-list');

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
  const alwaysOnTopCheckbox = document.getElementById('always-on-top-checkbox');
  const closeBtn = document.getElementById('close-btn');
  const menuBtn = document.getElementById('menu-btn');
  const menuPopup = document.getElementById('menu-popup');
  const menuNavLinks = document.querySelectorAll('.menu-nav-link');
  const screens = document.querySelectorAll('.screen');
  const currentFightTotalDamageElem = document.getElementById('current-fight-total-damage');
  const lastFightTotalDamageElem = document.getElementById('last-fight-total-damage');
  const sessionTotalDamageElem = document.getElementById('session-total-damage');
  const currentFightersList = document.getElementById('current-fighters-list');
  const lastFightersList = document.getElementById('last-fighters-list');
  const sessionFightersList = document.getElementById('session-fighters-list');

  let currentFilePath = null;
  let intervalId = null;

  // --- Menu Logic --- 
  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation(); // Prevent click from immediately closing menu
    menuPopup.classList.toggle('hidden');
  });

  document.addEventListener('click', (event) => {
    if (!menuPopup.classList.contains('hidden') && !menuPopup.contains(event.target)) {
      menuPopup.classList.add('hidden');
    }
  });

  menuPopup.addEventListener('click', (event) => {
    // Close menu if a nav link is clicked
    if (event.target.classList.contains('menu-nav-link')) {
      menuPopup.classList.add('hidden');
    }
  });
  // --- End Menu Logic ---

  // --- Navigation Logic --- 
  function showScreen(targetId) {
    screens.forEach(screen => {
      screen.classList.remove('active');
    });
    menuNavLinks.forEach(link => {
      link.classList.remove('active');
    });

    const targetScreen = document.getElementById(targetId);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }
    const targetLink = document.querySelector(`.menu-nav-link[data-target="${targetId}"]`);
    if (targetLink) {
      targetLink.classList.add('active');
    }
  }

  menuNavLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = link.getAttribute('data-target');
      showScreen(targetId);
    });
  });

  // Show default screen
  showScreen('fight-screen');
  // --- End Navigation Logic ---

  // --- Window Controls ---
  closeBtn.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });

  alwaysOnTopCheckbox.addEventListener('change', () => {
    window.electronAPI.toggleAlwaysOnTop(alwaysOnTopCheckbox.checked);
  });
  // --- End Window Controls ---

  // --- File Handling and Data Update --- 
  const formatDamage = (damage) => {
      return damage.toLocaleString('en-US');
  };

  const updateFighterList = (listElement, fighters, fightType) => {
    if (!listElement) return;
    listElement.innerHTML = ''; 

    if (!fighters || fighters.length === 0) {
      listElement.innerHTML = '<div class="no-data">No fighter data available.</div>';
      return;
    }

    // Sort fighters by damage dealt, descending
    const sortedFighters = fighters.filter(f => !f.isAI && f.damageDealt > 0)
                                  .sort((a, b) => b.damageDealt - a.damageDealt);

    if (sortedFighters.length === 0) {
        listElement.innerHTML = '<div class="no-data">No damage dealt by players.</div>';
        return;
    }

    sortedFighters.forEach(fighter => {
      const fighterDiv = document.createElement('div');
      fighterDiv.className = 'fighter-row';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'fighter-name';
      nameSpan.textContent = fighter.name;

      const damageSpan = document.createElement('span');
      damageSpan.className = 'fighter-damage';
      damageSpan.textContent = formatDamage(fighter.damageDealt);

      fighterDiv.appendChild(nameSpan);
      fighterDiv.appendChild(damageSpan);
      listElement.appendChild(fighterDiv);
    });
  };

  async function updateFightData() {
    if (!currentFilePath) return;
    try {
      const data = await window.electronAPI.getFightData(currentFilePath);

      // Update Current Fight
      if (currentFightTotalDamageElem) {
          currentFightTotalDamageElem.textContent = formatDamage(data.currentFightTotalDamage || 0);
      }
      updateFighterList(currentFightersList, data.currentFightFighters, 'current');

      // Update Last Completed Fight
      if (lastFightTotalDamageElem) {
          lastFightTotalDamageElem.textContent = formatDamage(data.lastCompletedFightTotalDamage || 0);
      }
      updateFighterList(lastFightersList, data.lastCompletedFightFighters, 'last');
      
      // Update Session Summary
      if (sessionTotalDamageElem) {
          sessionTotalDamageElem.textContent = formatDamage(data.sessionInfo?.totalDamage || 0);
      }
      updateFighterList(sessionFightersList, data.sessionFighters, 'session');

    } catch (error) {
      console.error('Failed to update fight data:', error);
      // Optionally display an error to the user
      if (currentFightersList) currentFightersList.innerHTML = `<div class="no-data error">Error loading data: ${error.message}</div>`;
      if (lastFightersList) lastFightersList.innerHTML = '';
      if (sessionFightersList) sessionFightersList.innerHTML = '';
      if (currentFightTotalDamageElem) currentFightTotalDamageElem.textContent = 'Error';
      if (lastFightTotalDamageElem) lastFightTotalDamageElem.textContent = 'Error';
      if (sessionTotalDamageElem) sessionTotalDamageElem.textContent = 'Error';
      stopAutoUpdate(); // Stop polling if there's an error
    }
  }

  function startAutoUpdate() {
    stopAutoUpdate(); // Clear existing interval if any
    if (currentFilePath) {
      updateFightData(); // Initial update
      intervalId = setInterval(updateFightData, 2000); // Update every 2 seconds
    }
  }

  function stopAutoUpdate() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  window.electronAPI.onLoadFile((filePath) => {
    currentFilePath = filePath;
    startAutoUpdate();
  });

});
