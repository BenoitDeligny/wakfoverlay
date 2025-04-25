import { showScreen, updateBodyOpacity, setupFighterItemClickHandlers, toggleDamageStatsWindow, updateDamageStatsWindow } from './ui-manager.js';
import { startPolling, selectAndProcessFile, setSelectedFilePath, fetchLogContent } from './data-fetcher.js';

/**
 * Sets up all event handlers for the application
 */
export function setupEventHandlers() {
  // Close button
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.electronAPI.sendCloseWindow();
    });
  }

  // Menu button
  const menuBtn = document.getElementById('menu-btn');
  const menuPopup = document.getElementById('menu-popup');
  if (menuBtn && menuPopup) {
    menuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      menuPopup.classList.toggle('hidden');
    });

    document.addEventListener('click', (event) => {
      if (!menuPopup.classList.contains('hidden') && !menuPopup.contains(event.target)) {
        menuPopup.classList.add('hidden');
      }
    });

    menuPopup.addEventListener('click', (event) => {
      if (event.target.classList.contains('menu-nav-link')) {
        menuPopup.classList.add('hidden');
      }
    });
  }

  // Navigation links
  const menuNavLinks = document.querySelectorAll('.menu-nav-link');
  menuNavLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = link.getAttribute('data-target');
      showScreen(targetId);
      
      // Update damage stats window if it's visible
      if (!document.getElementById('damage-stats-window').classList.contains('hidden')) {
        // Re-fetch content to update the damage stats window
        fetchLogContent();
      }
    });
  });

  // Always on top toggle
  const alwaysOnTopCheckbox = document.getElementById('always-on-top-checkbox');
  if (alwaysOnTopCheckbox) {
    alwaysOnTopCheckbox.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      window.electronAPI.toggleAlwaysOnTop(isChecked);
    });
  }
  
  // Damage stats toggle
  const damageStatsCheckbox = document.getElementById('damage-stats-checkbox');
  if (damageStatsCheckbox) {
    damageStatsCheckbox.addEventListener('change', (event) => {
      const isChecked = event.target.checked;
      toggleDamageStatsWindow(isChecked);
      
      // Update damage stats window content when toggled on
      if (isChecked) {
        fetchLogContent();
      }
    });
    
    // Update checkbox when damage stats window is closed externally
    window.electronAPI.onDamageStatsWindowClosed(() => {
      damageStatsCheckbox.checked = false;
    });
  }

  // File selection
  const selectFileMenu = document.getElementById('select-file-menu');
  if (selectFileMenu) {
    selectFileMenu.addEventListener('click', async () => {
      if (menuPopup) menuPopup.classList.add('hidden');
      await selectAndProcessFile();
    });
  }

  // Opacity slider
  const opacitySlider = document.getElementById('opacity-slider');
  if (opacitySlider) {
    opacitySlider.addEventListener('input', (event) => {
      updateBodyOpacity(event.target.value);
    });
  }

  // Listen for file load from main process
  window.electronAPI.onLoadFile((filePath) => {
    if (filePath) {
      setSelectedFilePath(filePath);
      startPolling(filePath);
    }
  });

  // Initialize default screen
  showScreen('fight-screen');

  // Initialize opacity if slider exists
  if (opacitySlider) {
    updateBodyOpacity(opacitySlider.value);
  }

  // Fighter list item click handlers
  setupFighterItemClickHandlers();
}

/**
 * Sets up draggable functionality for an element
 */
function setupDraggableElement(element, handleElement) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  if (handleElement) {
    // If a handle is provided, attach mousedown event to the handle only
    handleElement.onmousedown = dragMouseDown;
  } else {
    // Otherwise, attach mousedown event to the element itself
    element.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Attach the mousemove and mouseup events to document
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
} 