/**
 * Creates HTML for spell-specific damage details
 */
function createSpellDamageDetailsHTML(fighter) {
  if (!fighter || !fighter.spellDamage || typeof fighter.spellDamage !== 'object' || Object.keys(fighter.spellDamage).length === 0) {
    return `
      <div class="spell-item">
        <span class="spell-name">No spell data available</span>
        <span class="spell-damage">0</span>
        <span class="spell-percent">(0.0%)</span>
      </div>
    `;
  }

  // Helper function to get color variable based on element
  const getElementColor = (element) => {
    switch(element) {
      case 'fire': return 'var(--color-element-fire)';
      case 'water': return 'var(--color-element-water)';
      case 'earth': return 'var(--color-element-earth)';
      case 'air': return 'var(--color-element-air)';
      case 'status': return 'var(--color-element-status)';
      default: return 'var(--color-element-neutral)';
    }
  };

  // Extract and format spell data
  const spellData = Object.entries(fighter.spellDamage)
    .map(([spellName, spellInfo]) => {
      // Handle both new and old data format
      const damage = typeof spellInfo === 'object' ? (spellInfo.damage || 0) : spellInfo || 0;
      const element = typeof spellInfo === 'object' ? (spellInfo.element || 'neutral') : 'neutral';
      
      return {
        name: spellName,
        damage: damage,
        element: element
      };
    })
    .filter(spell => spell.damage > 0)
    .sort((a, b) => b.damage - a.damage);
  
  if (spellData.length === 0) {
    return `
      <div class="spell-item">
        <span class="spell-name">No damage spells recorded</span>
        <span class="spell-damage">0</span>
        <span class="spell-percent">(0.0%)</span>
      </div>
    `;
  }
  
  const fighterDamage = fighter.damageDealt || spellData.reduce((sum, spell) => sum + spell.damage, 0);
  
  let html = '';
  spellData.forEach(spell => {
    const percentage = fighterDamage > 0 ? ((spell.damage / fighterDamage) * 100).toFixed(1) : 0;
    const elementColor = getElementColor(spell.element);
    
    html += `
      <div class="spell-item">
        <span class="spell-name" style="color: ${elementColor}">${spell.name || 'Unknown Spell'}</span>
        <span class="spell-damage" style="color: ${elementColor}">${spell.damage.toLocaleString()}</span>
        <span class="spell-percent">(${percentage}%)</span>
      </div>
    `;
  });
  
  return html;
}

/**
 * Creates HTML for the fighter list display
 */
export function createFighterListHTML(fighters, totalFightDamage) {
  // Safety check for input data
  if (!fighters || !Array.isArray(fighters) || fighters.length === 0) {
    return '<p>No fighter data available.</p>';
  }

  // Filter out fighters with no damage and ensure they have the expected properties
  const validFighters = fighters.filter(fighter => 
    fighter && 
    typeof fighter === 'object' && 
    (fighter.damageDealt || 0) > 0
  );
  
  if (validFighters.length === 0) {
    return '<p>No damage dealt by players.</p>';
  }

  // Ensure totalFightDamage is a number
  const safeTotalDamage = typeof totalFightDamage === 'number' ? totalFightDamage : 
    validFighters.reduce((sum, fighter) => sum + (fighter.damageDealt || 0), 0);

  // Sort fighters by damage
  validFighters.sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));

  let html = '';
  validFighters.forEach((fighter, index) => {
    const damage = fighter.damageDealt || 0;
    const percentage = (safeTotalDamage > 0) ? ((damage / safeTotalDamage) * 100).toFixed(1) : 0;
    const name = fighter.name || `Fighter ${index+1}`;
    const fighterId = fighter.fighterId || `fighter-${index}`;
    
    let damageClass = 'damage-normal';
    
    html += `<li class="fighter-item" data-fighter-id="${fighterId}">
      <div class="fighter-content">
        <div class="fighter-info">
          <span class="expand-icon">▶</span>
          <span class="fighter-name-row">${name}</span>
        </div>
        <div class="damage-row">
          <span class="${damageClass}">${damage.toLocaleString()}</span>
          <span class="damage-percent">(${percentage}%)</span>
        </div>
      </div>
      <div class="fighter-details">
        <div class="spell-damage-info">
          <div class="spell-list">
            ${createSpellDamageDetailsHTML(fighter)}
          </div>
        </div>
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
  
  // Ensure data is properly structured or provide defaults
  const safeData = {
    currentFightTotalDamage: fightData && fightData.currentFightTotalDamage !== undefined ? fightData.currentFightTotalDamage : 0,
    lastCompletedFightTotalDamage: fightData && fightData.lastCompletedFightTotalDamage !== undefined ? fightData.lastCompletedFightTotalDamage : 0,
    currentFightFighters: fightData && Array.isArray(fightData.currentFightFighters) ? fightData.currentFightFighters : [],
    lastCompletedFightFighters: fightData && Array.isArray(fightData.lastCompletedFightFighters) ? fightData.lastCompletedFightFighters : []
  };
  
  if (currentFightTotalDamageElement) {
    currentFightTotalDamageElement.textContent = safeData.currentFightTotalDamage !== null ? safeData.currentFightTotalDamage.toLocaleString() : '0';
  }
  
  if (lastFightTotalDamageElement) {
    lastFightTotalDamageElement.textContent = safeData.lastCompletedFightTotalDamage !== null ? safeData.lastCompletedFightTotalDamage.toLocaleString() : '0';
  }
  
  if (currentFightersListElement) {
    currentFightersListElement.innerHTML = createFighterListHTML(safeData.currentFightFighters, safeData.currentFightTotalDamage);
  }
  
  if (lastFightersListElement) {
    lastFightersListElement.innerHTML = createFighterListHTML(safeData.lastCompletedFightFighters, safeData.lastCompletedFightTotalDamage);
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