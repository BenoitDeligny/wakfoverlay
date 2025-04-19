const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const readline = require('readline');

const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');

// Global state for the current session
let currentSessionFighterDamage = {};
let currentSessionInfo = {
  startDate: null,
  startTime: null,
  endDate: null,
  endTime: null,
  totalDamage: 0
};
let fileLastProcessedDate = null; // To handle date changes across log lines

// Helper function to format date (moved here for broader use)
const formatDate = (date) => {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Helper function to check time order (moved here for broader use)
const isTimeEarlier = (time1, time2) => {
    return time1 < time2;
};

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
    sessionStart: /^\s*INFO\s+([\d:,\.]+)\s+\[Net-Cnx-wakfu-(?!dispatcher).*\.ankama-games\.com:.*>0\]\s+\(.*\)\s+-\s+onNewConnection ChannelHandlerContext/,
    sessionEnd: /^\s*INFO\s+([\d:,\.]+)\s+\[AWT-EventQueue-0\]\s+\(.*\)\s+-\s+Sending DisconnectionMessage to Servers\. Reason : {UI Closed}\s*$/,
    timeMarker: /^\s*INFO\s+([\d:,\.]+)\s+.*/, // Generic line with timestamp
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
    // Also return empty session data structure initially
    return {
      lastCompletedFightId: null,
      lastCompletedFightTotalDamage: 0,
      lastCompletedFightFighters: [],
      currentFightId: null,
      currentFightStartTime: null,
      currentFightTotalDamage: 0,
      currentFightFighters: [],
      sessionInfo: { ...currentSessionInfo }, // Return copy of current state
      sessionFighters: [] // Initially empty
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
    // Increment session total damage if a session is active
    if (currentSessionInfo.startTime) {
        currentSessionInfo.totalDamage += damageAmount;
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

    // Accumulate damage into session totals if session is active
    if (currentSessionInfo.startTime && lastCompletedFight.fighters) {
        lastCompletedFight.fighters.forEach(fighter => {
            const name = fighter.name;
            const damage = fighter.damageDealt || 0;
            if (damage > 0) {
                if (!currentSessionFighterDamage[name]) {
                    currentSessionFighterDamage[name] = { name: name, damageDealt: 0 };
                }
                currentSessionFighterDamage[name].damageDealt += damage;
            }
        });
    }

    activeFight = null;
    currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };
    lastAttackerName = null;
  }

  // Initialize date tracking for this analysis run
  let currentDate = new Date();
  try {
      const stats = fsSync.statSync(filePath);
      currentDate = stats.mtime;
      // Use file mtime as the initial date if it's the first time processing or different from last time
      if (!fileLastProcessedDate || fileLastProcessedDate.toDateString() !== currentDate.toDateString()) {
          fileLastProcessedDate = new Date(currentDate); // Store the date component
      }
  } catch (statError) {
      console.error("Error getting file stats, using current date:", statError);
      fileLastProcessedDate = new Date(); // Fallback
  }
  let lastTimeString = '00:00:00,000';

  return new Promise((resolve, reject) => {
    rl.on('line', (line) => {
      lineNumber++;

      // --- Date Tracking Logic ---
      const timeMatch = line.match(regexPatterns.timeMarker);
      let currentTimeString = null;
      if (timeMatch) {
        currentTimeString = timeMatch[1].trim();
        // Check if time wrapped around (e.g., past midnight)
        if (isTimeEarlier(currentTimeString, lastTimeString)) {
          fileLastProcessedDate.setDate(fileLastProcessedDate.getDate() + 1); // Increment the date
        }
        lastTimeString = currentTimeString;
      }
      // --- End Date Tracking ---

      const sessionStartMatch = line.match(regexPatterns.sessionStart);
      const sessionEndMatch = line.match(regexPatterns.sessionEnd);
      const fightStartMatch = line.match(regexPatterns.fightStart);
      const fightEndMatch = line.match(regexPatterns.fightEnd);
      const fighterMatch = line.match(regexPatterns.fighterJoin);
      const damageMatch = line.match(regexPatterns.damage);
      const spellCastMatch = line.match(regexPatterns.spellCast);
      const statusMatch = line.match(regexPatterns.status);
      // const statusRemovalMatch = line.match(regexPatterns.statusRemoval); // Not currently used

      // Process session markers first
      if (sessionStartMatch) {
          currentSessionInfo.startDate = formatDate(fileLastProcessedDate);
          currentSessionInfo.startTime = sessionStartMatch[1].trim();
          currentSessionInfo.endDate = null; // Reset end date
          currentSessionInfo.endTime = null;
          currentSessionInfo.totalDamage = 0; // Reset session damage
          currentSessionFighterDamage = {}; // Reset session fighters
      } else if (sessionEndMatch && currentSessionInfo.startTime) {
          currentSessionInfo.endDate = formatDate(fileLastProcessedDate);
          currentSessionInfo.endTime = sessionEndMatch[1].trim();
          // Optionally, could snapshot the session here if needed later
          // Resetting happens on next sessionStart
      }

      // Process fight/damage markers only if within an active session or for general fight tracking
      if (fightStartMatch) {
        handleFightStart(fightStartMatch);
      } else if (fighterMatch) {
        handleFighterJoin(fighterMatch);
      } else if (spellCastMatch && activeFight) {
        lastAttackerName = spellCastMatch[1].trim();
      } else if (statusMatch && activeFight) {
        handleStatus(statusMatch);
      } else if (damageMatch && activeFight) {
        handleDamage(damageMatch);
      } else if (fightEndMatch) {
        handleFightEnd(fightEndMatch);
      }
    });

    rl.on('close', () => {
      const finalLastCompletedFighters = lastCompletedFight.fighters ? [...lastCompletedFight.fighters] : [];
      const finalCurrentFighters = currentFight.id && activeFight ? [...activeFight.fighters] : (currentFight.fighters || []);
      // Sort session fighters by damage
      const sortedSessionFighters = Object.values(currentSessionFighterDamage).sort((a, b) => b.damageDealt - a.damageDealt);


      resolve({
        // Fight Data
        lastCompletedFightId: lastCompletedFight.id,
        lastCompletedFightTotalDamage: lastCompletedFight.totalDamage,
        lastCompletedFightFighters: finalLastCompletedFighters,
        currentFightId: currentFight.id,
        currentFightStartTime: currentFight.startTime,
        currentFightTotalDamage: currentFight.totalDamage,
        currentFightFighters: finalCurrentFighters,
        // Session Data
        sessionInfo: { ...currentSessionInfo },
        sessionFighters: sortedSessionFighters
      });
    });

    rl.on('error', (err) => {
      // Include session data in rejection potentially
      reject({ error: err, sessionInfo: { ...currentSessionInfo }, sessionFighters: Object.values(currentSessionFighterDamage) });
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
      // analyzeLogFile now returns combined fight and session data
      const combinedData = await analyzeLogFile(filePath);
      return combinedData;
    } catch (error) {
        // Log the detailed error object if it exists
        console.error("Error in get-fight-ids handler:", error);
        const errorMessage = error.error ? error.error.message : error.message; // Extract message if wrapped
        throw new Error(`Failed to analyze log file: ${errorMessage}`);
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