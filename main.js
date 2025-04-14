const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const readline = require('readline');

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');

async function analyzeLogFile(filePath) {
  let lastCompletedFight = { id: null, totalDamage: 0, fighters: [] };
  let currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };

  let activeFight = null;
  let lineNumber = 0;

  try {
    await fs.access(filePath);
  } catch (error) {
    return { lastCompletedFightId: null, lastCompletedFightTotalDamage: 0, lastCompletedFightFighters: [], currentFightId: null, currentFightStartTime: null, currentFightTotalDamage: 0, currentFightFighters: [] };
  }

  const fileStream = fsSync.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const fightStartRegex = /^\s*INFO\s+([\d:,\.]+)\s+\[.*\]\s+\(.*\)\s+-\s+CREATION DU COMBAT\s*$/;
  const fightEndRegex = /^\s*INFO\s+([\d:,\.]+)\s+\[.*\]\s+\(.*\)\s+-\s+\[FIGHT\] End fight with id (\d+)\s*$/;
  const fighterJoinRegex = /\[_FL_\]\s+fightId=(\d+)\s+(.+?)\s+breed\s+:\s+\d+\s+\[(-?\d+)\]\s+isControlledByAI=(true|false)/;
  const damageRegex = /\[Information \(jeu\)\]\s+(.+):\s+-([\d\s]+)\s+PV\s+(\(.+\))/;

  return new Promise((resolve, reject) => {
    rl.on('line', (line) => {
      lineNumber++;
      const startMatch = line.match(fightStartRegex);
      const endMatch = line.match(fightEndRegex);
      const fighterMatch = line.match(fighterJoinRegex);
      const damageMatch = line.match(damageRegex);

      if (startMatch) {
        if (activeFight) {
          if (activeFight.id) {
              currentFight.id = activeFight.id;
              currentFight.startTime = activeFight.startTime;
              currentFight.totalDamage = activeFight.totalDamage;
              currentFight.fighters = [...activeFight.fighters];
          }
        }
        activeFight = {
          startLine: lineNumber,
          startTime: startMatch[1].trim(),
          id: null,
          totalDamage: 0,
          fighters: [],
        };
        currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };

      } else if (fighterMatch) {
          const joinFightId = parseInt(fighterMatch[1], 10);
          const fighterName = fighterMatch[2].trim();
          const fighterId = parseInt(fighterMatch[3], 10);
          const isAI = fighterMatch[4] === 'true';

          if (activeFight) {
              if (!activeFight.id) {
                  activeFight.id = joinFightId;
                  currentFight.id = activeFight.id;
                  currentFight.startTime = activeFight.startTime;
                  currentFight.totalDamage = activeFight.totalDamage;
                  currentFight.fighters = activeFight.fighters;
              }

              if (activeFight.id === joinFightId) {
                  if (!activeFight.fighters.some(f => f.fighterId === fighterId)) {
                      activeFight.fighters.push({ name: fighterName, fighterId: fighterId, isAI: isAI });
                      currentFight.fighters = [...activeFight.fighters];
                  }
              }
          }

      } else if (damageMatch && activeFight) {
          const damageString = damageMatch[2].replace(/\s/g, '');
          const damageAmount = parseInt(damageString, 10);
          if (!isNaN(damageAmount)) {
              activeFight.totalDamage += damageAmount;
              if (currentFight.id === activeFight.id) {
                  currentFight.totalDamage = activeFight.totalDamage;
              }
          }

      } else if (endMatch) {
        const endedFightId = parseInt(endMatch[2], 10);
        let endedFightDamage = 0;
        let endedFightFighters = [];

        if (activeFight && activeFight.id === endedFightId) {
          endedFightDamage = activeFight.totalDamage;
          endedFightFighters = [...activeFight.fighters];
          lastCompletedFight = { id: endedFightId, totalDamage: endedFightDamage, fighters: endedFightFighters };
          activeFight = null;
          currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };
        } else if (activeFight && activeFight.id !== endedFightId) {
          endedFightDamage = activeFight.totalDamage;
          endedFightFighters = [...activeFight.fighters];
          lastCompletedFight = { id: endedFightId, totalDamage: endedFightDamage, fighters: endedFightFighters };
          activeFight = null;
          currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };
        } else {
          lastCompletedFight = { id: endedFightId, totalDamage: 0, fighters: [] };
        }
      }
    });

    rl.on('close', () => {
      resolve({
          lastCompletedFightId: lastCompletedFight.id,
          lastCompletedFightTotalDamage: lastCompletedFight.totalDamage,
          lastCompletedFightFighters: lastCompletedFight.fighters,
          currentFightId: currentFight.id,
          currentFightStartTime: currentFight.startTime,
          currentFightTotalDamage: currentFight.totalDamage,
          currentFightFighters: currentFight.fighters
      });
    });

    rl.on('error', (err) => {
      reject(err);
    });

    fileStream.on('error', (err) => {
        reject(err);
    });
  });
}

async function saveLastFile(filePath) {
  try {
    const config = { lastFilePath: filePath };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    // Error handling without console.log
  }
}

async function loadLastFile() {
  try {
    await fs.access(configPath); 
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    if (config && config.lastFilePath) {
        try {
            await fs.access(config.lastFilePath);
            return config.lastFilePath;
        } catch (accessError) {
            return null;
        }
    }
    return null;
  } catch (error) {
    return null;
  }
}

let mainWindow;

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    transparent: true, 
    frame: false, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false 
    }
  });

  mainWindow.loadFile('renderer/index.html');

  return mainWindow;
}

app.whenReady().then(async () => {
  ipcMain.on('close-window', (event) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    if (win) {
      win.close();
    }
  });

  ipcMain.handle('select-file', async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      await saveLastFile(filePath);
      return filePath;
    }
    return null;
  });

  ipcMain.handle('read-file-content', async (event, filePath) => {
    if (!filePath) {
      throw new Error('File path is not provided.');
    }
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      } else {
        throw new Error(`Failed to read file: ${error.message}`);
      }
    }
  });

  ipcMain.handle('get-fight-ids', async (event, filePath) => {
    if (!filePath) {
      throw new Error('Log file path is required.');
    }
    try {
      const fightData = await analyzeLogFile(filePath);
      return fightData;
    } catch (error) {
      throw new Error(`Failed to analyze log file: ${error.message}`);
    }
  });

  const createdWindow = createWindow();

  const lastFilePath = await loadLastFile();
  if (lastFilePath) {
    createdWindow.webContents.on('did-finish-load', () => {
      createdWindow.webContents.send('load-file', lastFilePath);
    });
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
}); 