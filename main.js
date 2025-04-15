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
  let lastAttackerName = null;

  try {
    await fs.access(filePath);
  } catch (error) {
    return createEmptyFightData();
  }

  const fileStream = fsSync.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const regexPatterns = {
    fightStart: /^\s*INFO\s+([\d:,\.]+)\s+\[.*\]\s+\(.*\)\s+-\s+CREATION DU COMBAT\s*$/,
    fightEnd: /^\s*INFO\s+([\d:,\.]+)\s+\[.*\]\s+\(.*\)\s+-\s+\[FIGHT\] End fight with id (\d+)\s*$/,
    fighterJoin: /\[_FL_\]\s+fightId=(\d+)\s+(.+?)\s+breed\s+:\s+\d+\s+\[(-?\d+)\]\s+isControlledByAI=(true|false)/,
    damage: /\[Information \(jeu\)\]\s+(.+?):\s+-([\d\s]+)\s+PV\s+(\(.+\))/,
    spellCast: /\[Information \(jeu\)\]\s+(.+?)\s+lance le sort\s+.*/,
    status: /\[Information \(jeu\)\]\s+(.+?):\s+(\w+)\s+\(\+(\d+)\s+Niv\.\)(?:\s+\((.+)\))?/,
    statusRemoval: /\[Information \(jeu\)\]\s+(.+?):\\s+n'est plus sous l'emprise '(.+?)'/
  };

  const statusDamageSourceMap = {
    'Tétatoxine': 'Toxines',
    'Maudit': 'Maudit',
  };

  function getStatusNameFromContext(context) {
    for (const key in statusDamageSourceMap) {
      if (context.includes(`(${key})`)) {
        return statusDamageSourceMap[key];
      }
    }
    return null;
  }

  function createEmptyFightData() {
    return {
      lastCompletedFightId: null,
      lastCompletedFightTotalDamage: 0,
      lastCompletedFightFighters: [],
      currentFightId: null,
      currentFightStartTime: null,
      currentFightTotalDamage: 0,
      currentFightFighters: []
    };
  }

  function handleFightStart(startMatch) {
    if (activeFight && activeFight.id) {
      currentFight = { ...activeFight };
    }
    
    activeFight = {
      startLine: lineNumber,
      startTime: startMatch[1].trim(),
      id: null,
      totalDamage: 0,
      fighters: [],
    };
    currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };
    lastAttackerName = null;
  }

  function handleFighterJoin(fighterMatch) {
    const joinFightId = parseInt(fighterMatch[1], 10);
    const fighterName = fighterMatch[2].trim();
    const fighterId = parseInt(fighterMatch[3], 10);
    const isAI = fighterMatch[4] === 'true';

    if (!activeFight) return;

    if (!activeFight.id) {
      activeFight.id = joinFightId;
      currentFight.id = activeFight.id;
      currentFight.startTime = activeFight.startTime;
    }

    if (activeFight.id === joinFightId) {
      if (!activeFight.fighters.some(f => f.fighterId === fighterId)) {
        const newFighter = {
          name: fighterName,
          fighterId: fighterId,
          isAI: isAI,
          damageDealt: 0,
          activeStatuses: []
        };
        activeFight.fighters.push(newFighter);
        currentFight.fighters = [...activeFight.fighters];
      }
    }
  }

  function handleStatus(statusMatch) {
    if (!activeFight) return;
    
    const targetName = statusMatch[1].trim();
    const statusName = statusMatch[2];
    const statusLevel = parseInt(statusMatch[3], 10);
    const statusContext = statusMatch[4];

    const targetFighter = activeFight.fighters.find(f => f.name === targetName);
    if (!targetFighter) return;
    
    const existingStatusIndex = targetFighter.activeStatuses.findIndex(s => s.name === statusName);
    let appliedBy = lastAttackerName;

    if (existingStatusIndex !== -1 && statusContext) {
      appliedBy = targetFighter.activeStatuses[existingStatusIndex].appliedBy;
    }

    targetFighter.activeStatuses = targetFighter.activeStatuses.filter(s => s.name !== statusName);
    targetFighter.activeStatuses.push({
      name: statusName,
      level: statusLevel,
      appliedBy: appliedBy
    });
  }

  function handleDamage(damageMatch) {
    if (!activeFight) return;
    
    const targetName = damageMatch[1].trim();
    const damageString = damageMatch[2].replace(/\s/g, '');
    const damageAmount = parseInt(damageString, 10);
    const damageSourceContext = damageMatch[3];

    if (isNaN(damageAmount)) return;
    
    activeFight.totalDamage += damageAmount;
    if (currentFight.id === activeFight.id) {
      currentFight.totalDamage = activeFight.totalDamage;
    }

    let damageAttributed = false;

    const statusSourceName = getStatusNameFromContext(damageSourceContext);
    if (statusSourceName) {
      const targetFighter = activeFight.fighters.find(f => f.name === targetName);
      if (targetFighter) {
        const causingStatus = targetFighter.activeStatuses.find(s => s.name === statusSourceName);
        if (causingStatus && causingStatus.appliedBy) {
          const caster = activeFight.fighters.find(f => f.name === causingStatus.appliedBy);
          if (caster) {
            caster.damageDealt += damageAmount;
            damageAttributed = true;
          }
        }
      }
    }

    if (!damageAttributed && lastAttackerName) {
      const attacker = activeFight.fighters.find(f => f.name === lastAttackerName);
      if (attacker && attacker.name !== targetName) {
        attacker.damageDealt += damageAmount;
        damageAttributed = true;
      }
    }
  }

  function handleFightEnd(endMatch) {
    const endedFightId = parseInt(endMatch[2], 10);

    if (activeFight && activeFight.id === endedFightId) {
      lastCompletedFight = { ...activeFight, fighters: [...activeFight.fighters] };
    } else if (activeFight) {
      lastCompletedFight = { ...activeFight, id: endedFightId, fighters: [...(activeFight.fighters || [])] };
    } else {
      lastCompletedFight = { id: endedFightId, totalDamage: 0, fighters: [] };
    }

    activeFight = null;
    currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };
    lastAttackerName = null;
  }

  return new Promise((resolve, reject) => {
    rl.on('line', (line) => {
      lineNumber++;
      const matches = {
        startMatch: line.match(regexPatterns.fightStart),
        endMatch: line.match(regexPatterns.fightEnd),
        fighterMatch: line.match(regexPatterns.fighterJoin),
        damageMatch: line.match(regexPatterns.damage),
        spellCastMatch: line.match(regexPatterns.spellCast),
        statusMatch: line.match(regexPatterns.status),
        statusRemovalMatch: line.match(regexPatterns.statusRemoval)
      };

      if (matches.startMatch) {
        handleFightStart(matches.startMatch);
      } else if (matches.fighterMatch) {
        handleFighterJoin(matches.fighterMatch);
      } else if (matches.spellCastMatch && activeFight) {
        lastAttackerName = matches.spellCastMatch[1].trim();
      } else if (matches.statusMatch && activeFight) {
        handleStatus(matches.statusMatch);
      } else if (matches.damageMatch && activeFight) {
        handleDamage(matches.damageMatch);
      } else if (matches.endMatch) {
        handleFightEnd(matches.endMatch);
      }
    });

    rl.on('close', () => {
      const finalLastCompletedFighters = lastCompletedFight.fighters ? [...lastCompletedFight.fighters] : [];
      const finalCurrentFighters = currentFight.id && activeFight ? [...activeFight.fighters] : (currentFight.fighters || []);

      resolve({
        lastCompletedFightId: lastCompletedFight.id,
        lastCompletedFightTotalDamage: lastCompletedFight.totalDamage,
        lastCompletedFightFighters: finalLastCompletedFighters,
        currentFightId: currentFight.id,
        currentFightStartTime: currentFight.startTime,
        currentFightTotalDamage: currentFight.totalDamage,
        currentFightFighters: finalCurrentFighters
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
    width: 400,
    height: 550,
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

  ipcMain.on('toggle-always-on-top', (event, isAlwaysOnTop) => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(isAlwaysOnTop);
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