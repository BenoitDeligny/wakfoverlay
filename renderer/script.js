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
  // Set initial state based on a potential stored preference (optional)
  // const isAlwaysOnTop = localStorage.getItem('alwaysOnTop') === 'true';
  // alwaysOnTopCheckbox.checked = isAlwaysOnTop;
  // window.electronAPI.toggleAlwaysOnTop(isAlwaysOnTop);

  alwaysOnTopCheckbox.addEventListener('change', (event) => {
    const isChecked = event.target.checked;
    window.electronAPI.toggleAlwaysOnTop(isChecked);
    // Store preference (optional)
    // localStorage.setItem('alwaysOnTop', isChecked);
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

async function fetchLogContent() {
  if (!selectedFilePath) return;
  try {
    const fightData = await window.electronAPI.getFightIds(selectedFilePath);
    updateFightDisplays(fightData);

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
