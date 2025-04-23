const fs = require('fs').promises;
const fsSync = require('fs');
const readline = require('readline');
const { formatDate, isTimeEarlier } = require('./utils');

/**
 * Analyzes a Wakfu log file to extract fight data
 */
async function analyzeLogFile(filePath) {
  let lastCompletedFight = { id: null, totalDamage: 0, fighters: [] };
  let currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };
  let activeFight = null;
  let lineNumber = 0;
  let lastAttackerName = null;
  let lastSpellCast = null;

  let sessionList = [];
  let currentSessionData = null;

  let currentDateForRun = new Date();
  let lastTimeStringInRun = '00:00:00,000';
  let isDateInitialized = false;

  try {
    await fs.access(filePath);
  } catch (error) {
    return {
      lastCompletedFightId: null, lastCompletedFightTotalDamage: 0, lastCompletedFightFighters: [],
      currentFightId: null, currentFightStartTime: null, currentFightTotalDamage: 0, currentFightFighters: [],
      sessionInfo: { totalDamage: 0 }, sessionFighters: []
    };
  }

  const fileStream = fsSync.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const regexPatterns = {
    sessionStart: /^\s*INFO\s+([\d:,\.]+)\s+\[Net-Cnx-wakfu-(?!dispatcher).*\.ankama-games\.com:.*>0\]\s+\(.*\)\s+-\s+onNewConnection ChannelHandlerContext/,
    sessionEnd: /^\s*INFO\s+([\d:,\.]+)\s+\[AWT-EventQueue-0\]\s+\(.*\)\s+-\s+Sending DisconnectionMessage to Servers\. Reason : {UI Closed}\s*$/,
    timeMarker: /^\s*INFO\s+([\d:,\.]+)\s+.*/, 
    fightStart: /^\s*INFO\s+([\d:,\.]+)\s+\[.*\]\s+\(.*\)\s+-\s+CREATION DU COMBAT\s*$/,
    fightEnd: /^\s*INFO\s+([\d:,\.]+)\s+\[.*\]\s+\(.*\)\s+-\s+\[FIGHT\] End fight with id (\d+)\s*$/,
    fighterJoin: /\[_FL_\]\s+fightId=(\d+)\s+(.+?)\s+breed\s+:\s+\d+\s+\[(-?\d+)\]\s+isControlledByAI=(true|false)/,
    damage: /\[Information \(jeu\)\]\s+(.+?):\s+-([\d\s]+)\s+PV\s+(\(.+\))/,
    spellCast: /\[Information \(jeu\)\]\s+(.+?)\s+lance le sort\s+(.*?)(?:\s+\(|\s*$)/,
    status: /\[Information \(jeu\)\]\s+(.+?):\s+(\w+)\s+\(\+(\d+)\s+Niv\.\)(?:\s+\((.+)\))?/
  };

  const statusDamageSourceMap = {
    'Tétatoxine': 'Toxines',
    'Maudit': 'Maudit',
  };

  const getStatusNameFromContext = (context) => {
    for (const key in statusDamageSourceMap) {
      if (context.includes(`(${key})`)) {
        return statusDamageSourceMap[key];
      }
    }
    return null;
  };

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
    lastSpellCast = null;
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
          spellDamage: {},
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

    if (currentSessionData) {
        currentSessionData.totalDamage += damageAmount;
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
            // Attribute status damage to "Status Effects" category
            if (!caster.spellDamage["Status Effects"]) {
              caster.spellDamage["Status Effects"] = 0;
            }
            caster.spellDamage["Status Effects"] += damageAmount;
            damageAttributed = true;
          }
        }
      }
    }
    if (!damageAttributed && lastAttackerName) {
      const attacker = activeFight.fighters.find(f => f.name === lastAttackerName);
      if (attacker && attacker.name !== targetName) {
        attacker.damageDealt += damageAmount;
        
        // Attribute damage to the last spell cast by this attacker
        const spellName = lastSpellCast || "Unknown Spell";
        if (!attacker.spellDamage[spellName]) {
          attacker.spellDamage[spellName] = 0;
        }
        attacker.spellDamage[spellName] += damageAmount;
      }
    }
  }

  function handleFightEnd(endMatch) {
    const endedFightId = parseInt(endMatch[2], 10);
    if (activeFight && activeFight.id === endedFightId) {
      lastCompletedFight = { 
        id: endedFightId, 
        totalDamage: activeFight.totalDamage || 0, 
        fighters: activeFight.fighters ? [...activeFight.fighters] : [] 
      };
    } else if (activeFight) {
      lastCompletedFight = { 
        id: endedFightId, 
        totalDamage: activeFight.totalDamage || 0, 
        fighters: activeFight.fighters ? [...activeFight.fighters] : [] 
      };
    } else {
      lastCompletedFight = { id: endedFightId, totalDamage: 0, fighters: [] };
    }

    if (currentSessionData && lastCompletedFight.fighters) {
      lastCompletedFight.fighters.forEach(fighter => {
          const name = fighter.name;
          const damage = fighter.damageDealt || 0;
          if (damage > 0) {
              if (!currentSessionData.fighters[name]) {
                  currentSessionData.fighters[name] = { 
                    name: name, 
                    damageDealt: 0,
                    spellDamage: {}
                  };
              }
              currentSessionData.fighters[name].damageDealt += damage;
              
              // Add spell damage data to session fighter
              if (fighter.spellDamage) {
                Object.entries(fighter.spellDamage).forEach(([spellName, spellDamage]) => {
                  if (!currentSessionData.fighters[name].spellDamage[spellName]) {
                    currentSessionData.fighters[name].spellDamage[spellName] = 0;
                  }
                  currentSessionData.fighters[name].spellDamage[spellName] += spellDamage;
                });
              }
          }
      });
    }

    activeFight = null;
    currentFight = { id: null, startTime: null, totalDamage: 0, fighters: [] };
    lastAttackerName = null;
    lastSpellCast = null;
  }

  return new Promise((resolve, reject) => {
    rl.on('line', (line) => {
      lineNumber++;
      let timestamp = null;
      const timeMatch = line.match(regexPatterns.timeMarker);
      if (timeMatch) {
          timestamp = timeMatch[1].trim();

          if (!isDateInitialized) {
              try {
                  const stats = fsSync.statSync(filePath);
                  currentDateForRun = new Date(stats.mtime);
                  isDateInitialized = true;
              } catch (statError) {
                  currentDateForRun = new Date();
                  isDateInitialized = true;
              }
          } else {
              if (isTimeEarlier(timestamp, lastTimeStringInRun)) {
                  currentDateForRun.setDate(currentDateForRun.getDate() + 1);
              }
          }
          lastTimeStringInRun = timestamp;
      }

      const sessionStartMatch = line.match(regexPatterns.sessionStart);
      const sessionEndMatch = line.match(regexPatterns.sessionEnd);
      const fightStartMatch = line.match(regexPatterns.fightStart);
      const fightEndMatch = line.match(regexPatterns.fightEnd);
      const fighterMatch = line.match(regexPatterns.fighterJoin);
      const damageMatch = line.match(regexPatterns.damage);
      const spellCastMatch = line.match(regexPatterns.spellCast);
      const statusMatch = line.match(regexPatterns.status);

      if (sessionStartMatch) {
          if (currentSessionData) {
              sessionList.push(currentSessionData);
          }
          currentSessionData = {
              startDate: formatDate(currentDateForRun),
              startTime: sessionStartMatch[1].trim(),
              fighters: {},
              totalDamage: 0,
              endDate: null,
              endTime: null
          };
      } else if (sessionEndMatch && currentSessionData) {
          currentSessionData.endDate = formatDate(currentDateForRun);
          currentSessionData.endTime = sessionEndMatch[1].trim();
          sessionList.push(currentSessionData);
          currentSessionData = null;
      }

      if (fightStartMatch) {
          handleFightStart(fightStartMatch);
      } else if (fighterMatch) {
          handleFighterJoin(fighterMatch);
      } else if (spellCastMatch && activeFight) {
          lastAttackerName = spellCastMatch[1].trim();
          lastSpellCast = spellCastMatch[2].trim();
      } else if (statusMatch && activeFight) {
          handleStatus(statusMatch);
      } else if (damageMatch) {
          handleDamage(damageMatch);
      } else if (fightEndMatch) {
          handleFightEnd(fightEndMatch);
      }
    });

    rl.on('close', () => {
      if (currentSessionData) {
        sessionList.push(currentSessionData);
      }

      const lastSession = sessionList.length > 0 ? sessionList[sessionList.length - 1] : null;
      const sessionInfo = lastSession ? {
           startDate: lastSession.startDate,
           startTime: lastSession.startTime,
           endDate: lastSession.endDate,
           endTime: lastSession.endTime,
           totalDamage: lastSession.totalDamage
      } : { totalDamage: 0 };

      const sessionFighters = lastSession ? Object.values(lastSession.fighters).map(fighter => ({
        name: fighter.name,
        damageDealt: fighter.damageDealt || 0,
        spellDamage: fighter.spellDamage || {}
      })).sort((a, b) => b.damageDealt - a.damageDealt) : [];

      // Ensure last completed fight data is properly formatted
      const finalLastCompletedFighters = lastCompletedFight && lastCompletedFight.fighters ? 
        lastCompletedFight.fighters.filter(f => f && typeof f === 'object') : [];
      
      const finalCurrentFighters = currentFight && currentFight.id && activeFight ? 
        activeFight.fighters.filter(f => f && typeof f === 'object') : 
        (currentFight && currentFight.fighters ? currentFight.fighters.filter(f => f && typeof f === 'object') : []);

      resolve({
        lastCompletedFightId: lastCompletedFight.id,
        lastCompletedFightTotalDamage: lastCompletedFight.totalDamage || 0,
        lastCompletedFightFighters: finalLastCompletedFighters,
        currentFightId: currentFight.id,
        currentFightStartTime: currentFight.startTime,
        currentFightTotalDamage: currentFight.totalDamage || 0,
        currentFightFighters: finalCurrentFighters,
        sessionInfo: sessionInfo,
        sessionFighters: sessionFighters
      });
    });

    rl.on('error', (err) => reject(err));
    fileStream.on('error', (err) => reject(err));
  });
}

module.exports = {
  analyzeLogFile
}; 