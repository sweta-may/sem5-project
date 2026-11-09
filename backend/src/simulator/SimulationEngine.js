/**
 * Multi-Host Bandwidth Simulation Engine
 * 
 * Generates realistic network bandwidth records across multiple hosts,
 * adhering strictly to the formal CSV format and routing every record through
 * the Regex Validation and FSM Processing pipeline.
 */

const { validateRecord } = require('../validators/recordValidator');
const { processRecord } = require('../services/recordProcessingService');
const InvalidRecord = require('../models/InvalidRecord');

const DEFAULT_HOST_POOL = [
  { hostId: 'HOST001', role: 'Main Gateway', behavior: 'mostly_normal' },
  { hostId: 'HOST002', role: 'App Server', behavior: 'occasional_spikes' },
  { hostId: 'HOST003', role: 'Workstation 03', behavior: 'sustained_bursts' },
  { hostId: 'HOST004', role: 'IoT Edge Device', behavior: 'critical_surges' },
  { hostId: 'HOST005', role: 'DB Backup Node', behavior: 'download_heavy' }
];

const SIMULATION_MODES = {
  BALANCED: 'BALANCED',         // Mixture of nominal, occasional spikes, and recoveries
  ATTACK_SURGE: 'ATTACK_SURGE', // Concentrated abnormal bursts to trigger SUSPICIOUS and BLOCKED
  RECOVERY: 'RECOVERY',         // Nominal traffic (< 60 Mbps) to demonstrate FSM self-recovery
  MALFORMED_FUZZER: 'MALFORMED_FUZZER', // Deliberate syntax errors to test Regex rejection
  RANDOM: 'RANDOM'              // Fully randomized dynamic traffic distribution
};

class SimulationEngine {
  constructor() {
    this.isRunning = false;
    this.intervalMs = 2000;
    this.mode = SIMULATION_MODES.BALANCED;
    this.timer = null;
    this.hosts = [...DEFAULT_HOST_POOL];
    this.stats = {
      totalGenerated: 0,
      totalValid: 0,
      totalInvalid: 0,
      lastGeneratedAt: null,
      lastRecord: null,
      lastOutcome: null
    };
  }

  /**
   * Generates a single timestamped record string based on current mode and target host
   * @param {Object} host Target host configuration
   * @param {string} mode Simulation mode
   * @returns {string} Raw record string
   */
  generateRecordString(host, mode) {
    const now = new Date();
    // Format timestamp as ISO string subset: YYYY-MM-DDTHH:mm:ss
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const direction = Math.random() > 0.45 ? 'UPLOAD' : 'DOWNLOAD';

    // Malformed Fuzzer Mode: Injects deliberately invalid syntax
    if (mode === SIMULATION_MODES.MALFORMED_FUZZER || (mode === SIMULATION_MODES.RANDOM && Math.random() < 0.2)) {
      const fuzzerTypes = [
        `${now.getFullYear()}-99-99T99:99:99,${host.hostId},120.00,UPLOAD`, // Bad timestamp
        `${timestamp},H@ST_!*,120.00,UPLOAD`,                                 // Bad host ID
        `${timestamp},${host.hostId},-75.50,UPLOAD`,                          // Negative bandwidth
        `${timestamp},${host.hostId},MAX_TRAFFIC,UPLOAD`,                     // Alphabetic bandwidth
        `${timestamp},${host.hostId},120.555,UPLOAD`,                         // Excess decimal places
        `${timestamp},${host.hostId},120.00,INBOUND`,                         // Bad direction
        `${timestamp},${host.hostId},120.00`,                                 // Missing field
        `${timestamp},${host.hostId},120.00,UPLOAD,EXTRA_FIELD`               // Extra field
      ];
      return fuzzerTypes[Math.floor(Math.random() * fuzzerTypes.length)];
    }

    let bandwidth = 35.0;

    switch (mode) {
      case SIMULATION_MODES.ATTACK_SURGE: {
        // High spikes (110-180) or critical surge (>250)
        bandwidth = Math.random() < 0.25 
          ? Number((260 + Math.random() * 80).toFixed(2)) 
          : Number((115 + Math.random() * 65).toFixed(2));
        break;
      }

      case SIMULATION_MODES.RECOVERY: {
        // Safe traffic strictly below recovery threshold (< 60 Mbps)
        bandwidth = Number((15 + Math.random() * 35).toFixed(2));
        break;
      }

      case SIMULATION_MODES.BALANCED:
      default: {
        // Behavioral distribution based on host role
        if (host.behavior === 'sustained_bursts') {
          bandwidth = Number((110 + Math.random() * 50).toFixed(2));
        } else if (host.behavior === 'critical_surges' && Math.random() < 0.3) {
          bandwidth = Number((260 + Math.random() * 70).toFixed(2));
        } else if (host.behavior === 'occasional_spikes' && Math.random() < 0.4) {
          bandwidth = Number((105 + Math.random() * 40).toFixed(2));
        } else {
          // Nominal traffic (10 to 65 Mbps)
          bandwidth = Number((12 + Math.random() * 48).toFixed(2));
        }
        break;
      }
    }

    return `${timestamp},${host.hostId},${bandwidth.toFixed(2)},${direction}`;
  }

  /**
   * Executes a single simulation tick:
   * 1. Generates record string
   * 2. Passes record string through Regex validation
   * 3. Dispatches to FSM processing pipeline or InvalidRecord store
   * @param {string} forcedHostId Optional host ID override
   * @param {string} forcedMode Optional mode override
   * @returns {Promise<Object>} Execution report
   */
  async tick(forcedHostId = null, forcedMode = null) {
    const activeMode = forcedMode || this.mode;
    const targetHost = forcedHostId 
      ? (this.hosts.find(h => h.hostId === forcedHostId.toUpperCase()) || { hostId: forcedHostId.toUpperCase(), behavior: 'dynamic' })
      : this.hosts[Math.floor(Math.random() * this.hosts.length)];

    const rawRecord = this.generateRecordString(targetHost, activeMode);
    this.stats.totalGenerated += 1;
    this.stats.lastGeneratedAt = new Date();
    this.stats.lastRecord = rawRecord;

    // Route through Regex Validator
    const validation = validateRecord(rawRecord);

    if (!validation.isValid) {
      this.stats.totalInvalid += 1;
      const invalidDoc = await InvalidRecord.create({
        rawRecord: validation.rawRecord,
        failureReason: validation.errors[0] || 'Regex validation rejection',
        errorDetails: validation.errors
      });

      const outcome = {
        accepted: false,
        rawRecord,
        errors: validation.errors,
        loggedAuditId: invalidDoc._id
      };
      this.stats.lastOutcome = outcome;
      return outcome;
    }

    // Record is valid -> Route through FSM Pipeline
    this.stats.totalValid += 1;
    const fsmOutcome = await processRecord({
      ...validation.data,
      rawRecord: validation.rawRecord
    });

    const outcome = {
      accepted: true,
      rawRecord,
      hostId: fsmOutcome.hostId,
      previousState: fsmOutcome.previousState,
      currentState: fsmOutcome.currentState,
      stateChanged: fsmOutcome.stateChanged,
      isAnomaly: fsmOutcome.isAnomaly,
      reason: fsmOutcome.reason,
      alertGenerated: Boolean(fsmOutcome.alert)
    };

    this.stats.lastOutcome = outcome;
    return outcome;
  }

  /**
   * Starts the background simulation timer
   * @param {number} intervalMs Generation interval in milliseconds
   * @param {string} mode Traffic scenario mode
   */
  start(intervalMs = 2000, mode = SIMULATION_MODES.BALANCED) {
    if (this.isRunning) {
      this.stop();
    }

    this.intervalMs = Math.max(250, Number(intervalMs) || 2000);
    this.mode = Object.values(SIMULATION_MODES).includes(mode) ? mode : SIMULATION_MODES.BALANCED;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      try {
        await this.tick();
      } catch (err) {
        console.error('[SimulationEngine] Error during simulation tick:', err.message);
      }
    }, this.intervalMs);

    console.log(`[SimulationEngine] Started in ${this.mode} mode (${this.intervalMs}ms interval)`);
    return this.getStatus();
  }

  /**
   * Stops the background simulation timer
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[SimulationEngine] Stopped.');
    return this.getStatus();
  }

  /**
   * Adds a new simulated host to the active host pool
   */
  addHost(hostId, role = 'Custom Host', behavior = 'mostly_normal') {
    const formattedId = hostId.toUpperCase().trim();
    if (this.hosts.some(h => h.hostId === formattedId)) {
      return { success: false, message: `Host ${formattedId} already exists in pool.` };
    }
    const newHost = { hostId: formattedId, role, behavior };
    this.hosts.push(newHost);
    return { success: true, host: newHost, totalHosts: this.hosts.length };
  }

  /**
   * Returns current simulation configuration, state, and metrics
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      mode: this.mode,
      availableModes: Object.values(SIMULATION_MODES),
      hostCount: this.hosts.length,
      hosts: this.hosts,
      stats: this.stats
    };
  }

  /**
   * Injects a quick scenario burst batch
   */
  async injectScenario(scenarioName, count = 5) {
    const validScenarios = ['ddos_burst', 'recovery_drill', 'malformed_test', 'normal_burst'];
    const results = [];

    let modeToUse = SIMULATION_MODES.BALANCED;
    if (scenarioName === 'ddos_burst') modeToUse = SIMULATION_MODES.ATTACK_SURGE;
    else if (scenarioName === 'recovery_drill') modeToUse = SIMULATION_MODES.RECOVERY;
    else if (scenarioName === 'malformed_test') modeToUse = SIMULATION_MODES.MALFORMED_FUZZER;

    for (let i = 0; i < count; i++) {
      const outcome = await this.tick(null, modeToUse);
      results.push(outcome);
    }

    return {
      scenario: scenarioName,
      injectedCount: count,
      results
    };
  }
}

// Export singleton instance
const simulatorInstance = new SimulationEngine();

module.exports = {
  SimulationEngine,
  simulatorInstance,
  SIMULATION_MODES
};
