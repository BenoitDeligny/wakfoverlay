import { showScreen, updateBodyOpacity, setupFighterItemClickHandlers } from './ui-manager.js';
import { startPolling, selectAndProcessFile, setSelectedFilePath } from './data-fetcher.js';

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