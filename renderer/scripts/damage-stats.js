/**
 * Damage Statistics Window Script
 */

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
    // Add debugging to see if the button is found
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
  
  // Make sure content is scrollable but header isn't
  const header = document.querySelector('.damage-stats-header');
  if (header) {
    header.style.webkitAppRegion = 'drag';
  }
  
  // Prevent drag behavior on content area to enable scrolling
  const content = document.getElementById('damage-stats-content');
  if (content) {
    content.addEventListener('mousedown', (event) => {
      // Allow native events for scrolling
      event.stopPropagation();
    });
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
  } else if (data.source === 'last') {
    fighters = data.fighters || [];
    totalDamage = data.totalDamage || 0;
  } else if (data.source === 'session') {
    fighters = data.fighters || [];
    totalDamage = data.totalDamage || 0;
  }
  
  damageStatsContent.innerHTML = createDamageStatsHTML(fighters, totalDamage);
}); 