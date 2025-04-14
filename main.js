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
    console.error(`Log file not accessible at: ${filePath}`, error);
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
          console.warn(`WARN: Found new fight start at line ${lineNumber} while processing fight ID ${activeFight.id}. Previous fight marked incomplete.`);
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
              } else {
                  console.warn(`WARN: Fighter join line ${lineNumber} has ID ${joinFightId} which does not match active fight ID ${activeFight.id}.`);
              }
          } else {
              console.warn(`WARN: Fighter join line ${lineNumber} found outside of an active fight context.`);
          }

      } else if (damageMatch && activeFight) {
          const damageString = damageMatch[2].replace(/\s/g, '');
          const damageAmount = parseInt(damageString, 10);
          if (!isNaN(damageAmount)) {
              activeFight.totalDamage += damageAmount;
              if (currentFight.id === activeFight.id) {
                  currentFight.totalDamage = activeFight.totalDamage;
              }
          } else {
              console.warn(`WARN: Failed to parse damage amount from string "${damageMatch[2]}" at line ${lineNumber}`);
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
          console.warn(`WARN: Fight ID mismatch at end line ${lineNumber}. Active fight ID ${activeFight.id}, ended ID ${endedFightId}. Ending active fight.`);
          endedFightDamage = activeFight.totalDamage;
          endedFightFighters = [...activeFight.fighters];
          lastCompletedFight = { id: endedFightId, totalDamage: endedFightDamage, fighters: endedFightFighters };
          activeFight = null;
          currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };
        } else {
          console.warn(`WARN: Found fight end at line ${lineNumber} (ID: ${endedFightId}) without a tracked start. Damage/fighters cannot be associated.`);
          lastCompletedFight = { id: endedFightId, totalDamage: 0, fighters: [] };
        }
      }
    });

    rl.on('close', () => {
      console.log(`Analysis complete: Last=${lastCompletedFight.id} (Dmg: ${lastCompletedFight.totalDamage}, Fighters: ${lastCompletedFight.fighters.length}), Current=${currentFight.id} (Dmg: ${currentFight.totalDamage}, Fighters: ${currentFight.fighters.length})`);
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
      console.error(`Error reading log file stream: ${filePath}`, err);
      reject(err);
    });

    fileStream.on('error', (err) => {
        console.error(`Error opening file stream: ${filePath}`, err);
        reject(err);
    });
  });
}

async function saveLastFile(filePath) {
  try {
    const config = { lastFilePath: filePath };
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('Saved last file path:', filePath);
  } catch (error) {
    console.error('Error saving last file path:', error);
  }
}

async function loadLastFile() {
  try {
    await fs.access(configPath); 
    const data = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(data);
    if (config && config.lastFilePath) {
        console.log('Loaded last file path:', config.lastFilePath);
        try {
            await fs.access(config.lastFilePath);
            return config.lastFilePath;
        } catch (accessError) {
            console.warn(`Last opened file not found: ${config.lastFilePath}`);
            return null;
        }
    }
    return null;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('Config file not found, no last file path loaded.');
    } else {
      console.error('Error loading last file path:', error);
    }
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
      console.log('Selected file:', filePath);
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
      console.error(`Error reading file ${filePath}:`, error);
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      } else {
        throw new Error(`Failed to read file: ${error.message}`);
      }
    }
  });

  ipcMain.handle('get-fight-ids', async (event, filePath) => {
    if (!filePath) {
      console.warn('Request to get fight data without providing a file path.');
      throw new Error('Log file path is required.');
    }
    try {
      console.log(`Analyzing log file for fight data: ${filePath}`);
      const fightData = await analyzeLogFile(filePath);
      return fightData;
    } catch (error) {
      console.error(`Error analyzing log file ${filePath} for fight data:`, error);
      throw new Error(`Failed to analyze log file: ${error.message}`);
    }
  });

  const createdWindow = createWindow();

  const lastFilePath = await loadLastFile();
  if (lastFilePath) {
    createdWindow.webContents.on('did-finish-load', () => {
      console.log(`Sending load-file event for: ${lastFilePath}`);
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