/**
 * Creates HTML for the fighter list display
 */
export function createFighterListHTML(fighters, totalFightDamage) {
  if (!fighters || fighters.length === 0) {
    return '<p>No fighter data available.</p>';
  }

  fighters = fighters.filter(fighter => (fighter.damageDealt || 0) > 0);
  
  if (fighters.length === 0) {
    return '<p>No damage dealt by players.</p>';
  }

  fighters.sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));

  let html = '';
  fighters.forEach((fighter, index) => {
    const damage = fighter.damageDealt || 0;
    const percentage = (totalFightDamage > 0) ? ((damage / totalFightDamage) * 100).toFixed(1) : 0;
    
    let damageClass = '';
    if (index === 0) damageClass = 'damage-gold';
    else if (index === 1) damageClass = 'damage-silver';
    else if (index === 2) damageClass = 'damage-bronze';
    else damageClass = 'damage-normal';
    
    html += `<li class="fighter-item" data-fighter-id="${fighter.fighterId || index}">
      <div class="fighter-content">
        <div class="fighter-info">
          <span class="expand-icon">▶</span>
          <span class="fighter-name-row">${fighter.name}</span>
        </div>
        <div class="damage-row">
          <span class="${damageClass}">${damage.toLocaleString()}</span>
          <span class="damage-percent">(${percentage}%)</span>
        </div>
      </div>
      <div class="fighter-details">
        DETAILS
      </div>
    </li>`;
  });
  return html;
}

/**
 * Updates the fight displays with the latest data
 */
export function updateFightDisplays(fightData) {
  const currentFightTotalDamageElement = document.getElementById('current-fight-total-damage');
  const lastFightTotalDamageElement = document.getElementById('last-fight-total-damage');
  const currentFightersListElement = document.getElementById('current-fighters-list');
  const lastFightersListElement = document.getElementById('last-fighters-list');
  
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
  
  // Re-attach event handlers
  setupFighterItemClickHandlers();
}

/**
 * Updates the session summary display with the latest data
 */
export function updateSessionSummaryDisplay(sessionData) {
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
  }

  if (totalDamageElement) {
    totalDamageElement.textContent = totalDamage.toLocaleString();
  }
  
  // Re-attach event handlers
  setupFighterItemClickHandlers();
}

/**
 * Shows a screen by its ID and updates the active state of nav links
 */
export function showScreen(targetId) {
  const screens = document.querySelectorAll('.screen');
  const menuNavLinks = document.querySelectorAll('.menu-nav-link');
  
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

/**
 * Updates the body opacity based on slider value
 */
export function updateBodyOpacity(value) {
  const bodyRgbColor = '25, 25, 35';
  const percentage = parseInt(value, 10);
  const alpha = (percentage / 100).toFixed(2);
  document.body.style.backgroundColor = `rgba(${bodyRgbColor}, ${alpha})`;
  
  const opacityValueSpan = document.getElementById('opacity-value');
  if (opacityValueSpan) {
    opacityValueSpan.textContent = `${percentage}%`;
  }
}

/**
 * Updates the log content display
 */
export function updateLogScreen(logData) {
  const logContent = document.getElementById('logContent');
  if (logContent) {
    logContent.textContent = logData;
    logContent.scrollTop = logContent.scrollHeight;
  }
}

/**
 * Sets up click handlers for fighter list items
 * Needs to be called after each time the fighter list is updated
 */
export function setupFighterItemClickHandlers() {
  // Store expanded fighter IDs to preserve state across updates
  if (!window.expandedFighters) {
    window.expandedFighters = new Set();
  }

  // Apply expanded class to any fighters that were previously expanded
  document.querySelectorAll('.fighter-item').forEach(item => {
    const fighterId = item.getAttribute('data-fighter-id');
    if (window.expandedFighters.has(fighterId)) {
      item.classList.add('expanded');
    }
  });

  const fighterLists = [
    document.getElementById('current-fighters-list'),
    document.getElementById('last-fighters-list'),
    document.getElementById('session-fighters-list')
  ];
  
  fighterLists.forEach(list => {
    if (list) {
      // Remove existing event listener to prevent duplicates
      const newList = list.cloneNode(true);
      list.parentNode.replaceChild(newList, list);
      
      newList.addEventListener('click', (event) => {
        const fighterItem = event.target.closest('.fighter-item');
        if (fighterItem) {
          const fighterId = fighterItem.getAttribute('data-fighter-id');
          
          // Force layout recalculation to prevent any animation or resize issues
          document.body.offsetHeight;
          
          // Toggle expanded state immediately
          if (fighterItem.classList.contains('expanded')) {
            fighterItem.classList.remove('expanded');
            window.expandedFighters.delete(fighterId);
          } else {
            fighterItem.classList.add('expanded');
            window.expandedFighters.add(fighterId);
          }
        }
      });
    }
  });
} 