const closeBtn = document.getElementById('close-btn');
const selectFileBtn = document.getElementById('select-file-btn');
const logContent = document.getElementById('logContent');

let selectedFilePath = null;
let pollInterval = null;

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    window.electronAPI.sendCloseWindow();
  });
}

if (selectFileBtn) {
  selectFileBtn.addEventListener('click', async () => {
    selectedFilePath = await window.electronAPI.selectFile();
    if (selectedFilePath) {
      console.log('Selected file path:', selectedFilePath);
      startPolling();
    }
  });
}

function startPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
  fetchLogContent();
  pollInterval = setInterval(fetchLogContent, 2000);
}

async function fetchLogContent() {
  if (!selectedFilePath) return;
  try {
    const content = await window.electronAPI.readFileContent(selectedFilePath);
    logContent.textContent = content; 
    logContent.scrollTop = logContent.scrollHeight;
  } catch (error) {
    console.error('Error fetching log content:', error);
    logContent.textContent = `Error reading file: ${error.message}`;
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }
}

window.electronAPI.onLoadFile((filePath) => {
  console.log('Received file path to auto-load:', filePath);
  if (filePath) {
    selectedFilePath = filePath;
    startPolling();
  }
}); 