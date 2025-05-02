/**
 * Damage Statistics Window Script
 */

let pollInterval = null;
let selectedFilePath = null;
let alwaysOnTop = true;
let lastValidFighters = [];
let lastTotalDamage = 0;
let combatActive = false;

// When the DOM is loaded, set up event listeners
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  // Add a class to indicate the content is scrollable when needed
  const contentEl = document.getElementById('damage-stats-content');
  if (contentEl) {
    // Make sure the content area is scrollable
    contentEl.style.overflowY = 'auto';
    contentEl.style.webkitAppRegion = 'no-drag';
  }
});

// Set up event listeners for the damage stats window
function setupEventListeners() {
  // Close button event
  const closeButton = document.getElementById('damage-stats-close');
  if (closeButton) {
    console.log('Close button found:', closeButton);
    
    closeButton.addEventListener('click', (event) => {
      console.log('Close button clicked');
      // Prevent event propagation to ensure the click doesn't get absorbed by parent elements
      event.stopPropagation();
      window.electronAPI.sendCloseWindow();
    });
  } else {
    console.error('Close button not found in damage-stats.js!');
  }
  
  // File select button
  const fileSelectBtn = document.getElementById('file-select-btn');
  if (fileSelectBtn) {
    console.log('File select button found:', fileSelectBtn);
    
    fileSelectBtn.addEventListener('click', async (event) => {
      console.log('File select button clicked');
      event.stopPropagation();
      await selectAndProcessFile();
    });
  } else {
    console.error('File select button not found!');
  }
  
  // Toggle on top button
  const toggleTopBtn = document.getElementById('toggle-top-btn');
  if (toggleTopBtn) {
    console.log('Toggle top button found:', toggleTopBtn);
    
    toggleTopBtn.addEventListener('click', (event) => {
      console.log('Toggle top button clicked');
      event.stopPropagation();
      alwaysOnTop = !alwaysOnTop;
      window.electronAPI.toggleAlwaysOnTop(alwaysOnTop);
      toggleTopBtn.classList.toggle('active', alwaysOnTop);
      
      // Show a notification if always-on-top is disabled
      if (!alwaysOnTop) {
        const notification = document.createElement('div');
        notification.className = 'overlay-notification';
        notification.textContent = 'Always on top disabled. Press Ctrl+Shift+D to bring back to front.';
        document.body.appendChild(notification);
        
        // Remove the notification after a few seconds
        setTimeout(() => {
          notification.classList.add('fade-out');
          setTimeout(() => {
            if (notification && notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 1000);
        }, 5000);
      }
    });
    // Initialize with active class
    toggleTopBtn.classList.add('active');
  } else {
    console.error('Toggle top button not found!');
  }
  
  // Make header draggable but ensure controls are clickable
  const header = document.querySelector('.damage-stats-header');
  if (header) {
    header.style.webkitAppRegion = 'drag';
    
    // Ensure all control buttons are not draggable
    const controlButtons = document.querySelectorAll('.control-btn');
    controlButtons.forEach(btn => {
      btn.style.webkitAppRegion = 'no-drag';
    });
  }
  
  // Prevent drag behavior on content area to enable scrolling
  const content = document.getElementById('damage-stats-content');
  if (content) {
    content.addEventListener('mousedown', (event) => {
      // Allow native events for scrolling
      event.stopPropagation();
    });
  }
  
  // Listen for file load from main process
  window.electronAPI.onLoadFile((filePath) => {
    if (filePath) {
      selectedFilePath = filePath;
      startPolling(filePath);
    }
  });
}

/**
 * Selects a log file and starts processing
 */
async function selectAndProcessFile() {
  try {
    const filePath = await window.electronAPI.selectFile();
    if (filePath) {
      selectedFilePath = filePath;
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
 * Starts polling for log file updates
 */
function startPolling(filePath) {
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
function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

/**
 * Fetches and processes log content from the selected file
 */
async function fetchLogContent() {
  if (!selectedFilePath) return;
  
  try {
    const combinedData = await window.electronAPI.getFightIds(selectedFilePath);
    
    // Extract current fight data
    const fighters = combinedData.currentFightFighters || [];
    const totalDamage = combinedData.currentFightTotalDamage || 0;
    
    // Keep track of combat state for persistence
    const newCombatActive = fighters.length > 0 && totalDamage > 0;
    
    // Update combat status indicator
    updateCombatStatusIndicator(newCombatActive);
    
    // If we have valid data, store it for persistence
    if (fighters.length > 0 && totalDamage > 0) {
      lastValidFighters = fighters;
      lastTotalDamage = totalDamage;
      combatActive = true;
    } 
    // If we were in combat but now there's no data, keep showing the last combat
    else if (combatActive && (fighters.length === 0 || totalDamage === 0)) {
      // Combat just ended, don't clear the display
      combatActive = false;
    }
    
    // Determine which fighters to display
    const displayFighters = fighters.length > 0 ? fighters : lastValidFighters;
    const displayTotalDamage = fighters.length > 0 ? totalDamage : lastTotalDamage;
    
    // Update the UI
    const damageStatsContent = document.getElementById('damage-stats-content');
    if (damageStatsContent) {
      damageStatsContent.innerHTML = createDamageStatsHTML(displayFighters, displayTotalDamage);
    }
  } catch (error) {
    console.error(`Error fetching log content: ${error.message}`);
    
    // On error, show last valid data if available
    if (lastValidFighters.length > 0) {
      const damageStatsContent = document.getElementById('damage-stats-content');
      if (damageStatsContent) {
        damageStatsContent.innerHTML = createDamageStatsHTML(lastValidFighters, lastTotalDamage);
      }
    } else {
      // Show error in UI if no valid data is available
      const damageStatsContent = document.getElementById('damage-stats-content');
      if (damageStatsContent) {
        damageStatsContent.innerHTML = `<p>Error: Unable to read log file.</p>`;
      }
    }
  }
}

/**
 * Updates the combat status indicator
 */
function updateCombatStatusIndicator(isActive) {
  const indicator = document.getElementById('combat-status');
  if (indicator) {
    if (isActive) {
      indicator.className = 'combat-active';
      indicator.title = 'Combat Active';
    } else {
      indicator.className = 'combat-inactive';
      indicator.title = 'Combat Inactive - Stats Preserved';
    }
  }
}

// Create HTML for damage statistics display
function createDamageStatsHTML(fighters, totalDamage) {
  // Safety check for input data
  if (!fighters || !Array.isArray(fighters) || fighters.length === 0) {
    return '<p style="font-size: 0.6em;">No fighter data available.</p>';
  }

  // Filter out fighters with no damage and ensure they have the expected properties
  const validFighters = fighters.filter(fighter => 
    fighter && 
    typeof fighter === 'object' && 
    (fighter.damageDealt || 0) > 0
  );
  
  if (validFighters.length === 0) {
    return '<p style="font-size: 0.6em;">No damage dealt by players.</p>';
  }

  // Ensure totalDamage is a number
  const safeTotalDamage = typeof totalDamage === 'number' ? totalDamage : 
    validFighters.reduce((sum, fighter) => sum + (fighter.damageDealt || 0), 0);

  // Sort fighters by damage
  validFighters.sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));

  // Find the highest damage to calculate relative bar widths
  const highestDamage = validFighters[0].damageDealt || 0;

  // Show all fighters instead of limiting since we support scrolling now
  const displayFighters = validFighters;

  let html = '';
  displayFighters.forEach((fighter, index) => {
    const damage = fighter.damageDealt || 0;
    const name = fighter.name || `Fighter ${index+1}`;
    const rank = index + 1;
    const barWidth = highestDamage > 0 ? (damage / highestDamage) * 100 : 0;
    
    html += `
      <div class="damage-stat-row rank-${rank}">
        <div class="damage-stat-bar" style="width: ${barWidth}%"></div>
        <div class="damage-stat-icon">${rank}</div>
        <div class="damage-stat-info">
          <div class="damage-stat-name">${name}</div>
        </div>
        <div class="damage-stat-number">${damage.toLocaleString()}</div>
      </div>
    `;
  });
  
  return html;
}

// When damage data is received via IPC
window.electronAPI.onDamageStatsUpdate((data) => {
  const damageStatsContent = document.getElementById('damage-stats-content');
  if (!damageStatsContent) return;
  
  let fighters = [];
  let totalDamage = 0;
  
  // Determine which fighters to display based on the data source
  if (data.source === 'current') {
    fighters = data.fighters || [];
    totalDamage = data.totalDamage || 0;
    
    // Store valid data for persistence
    if (fighters.length > 0 && totalDamage > 0) {
      lastValidFighters = fighters;
      lastTotalDamage = totalDamage;
    }
  } else if (data.source === 'last') {
    fighters = data.fighters || [];
    totalDamage = data.totalDamage || 0;
  } else if (data.source === 'session') {
    fighters = data.fighters || [];
    totalDamage = data.totalDamage || 0;
  }
  
  damageStatsContent.innerHTML = createDamageStatsHTML(fighters, totalDamage);
}); 