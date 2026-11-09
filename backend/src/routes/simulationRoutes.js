const express = require('express');
const router = express.Router();
const { simulatorInstance, SIMULATION_MODES } = require('../simulator/SimulationEngine');

/**
 * @route   GET /api/simulation/status
 * @desc    Get current simulation status, running state, and statistics
 * @access  Public
 */
router.get('/status', (req, res) => {
  res.status(200).json({
    success: true,
    data: simulatorInstance.getStatus()
  });
});

/**
 * @route   POST /api/simulation/start
 * @desc    Start automated simulated traffic generation
 * @access  Public
 */
router.post('/start', (req, res) => {
  const { intervalMs, mode } = req.body;
  const status = simulatorInstance.start(intervalMs, mode);

  res.status(200).json({
    success: true,
    message: `Simulation started in ${status.mode} mode (${status.intervalMs}ms interval).`,
    data: status
  });
});

/**
 * @route   POST /api/simulation/stop
 * @desc    Stop automated simulated traffic generation
 * @access  Public
 */
router.post('/stop', (req, res) => {
  const status = simulatorInstance.stop();

  res.status(200).json({
    success: true,
    message: 'Simulation stopped.',
    data: status
  });
});

/**
 * @route   POST /api/simulation/tick
 * @desc    Trigger a single simulated record tick on demand
 * @access  Public
 */
router.post('/tick', async (req, res, next) => {
  try {
    const { hostId, mode } = req.body;
    const outcome = await simulatorInstance.tick(hostId, mode);

    res.status(200).json({
      success: true,
      message: 'Simulation tick executed and processed through pipeline.',
      data: outcome
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/simulation/config
 * @desc    Update simulation interval or mode dynamically
 * @access  Public
 */
router.post('/config', (req, res) => {
  const { intervalMs, mode } = req.body;

  if (intervalMs) {
    simulatorInstance.intervalMs = Math.max(250, Number(intervalMs));
  }
  if (mode && Object.values(SIMULATION_MODES).includes(mode)) {
    simulatorInstance.mode = mode;
  }

  // If running, restart timer with new interval
  if (simulatorInstance.isRunning) {
    simulatorInstance.start(simulatorInstance.intervalMs, simulatorInstance.mode);
  }

  res.status(200).json({
    success: true,
    message: 'Simulation configuration updated.',
    data: simulatorInstance.getStatus()
  });
});

/**
 * @route   POST /api/simulation/inject
 * @desc    Inject a batch scenario (ddos_burst, recovery_drill, malformed_test)
 * @access  Public
 */
router.post('/inject', async (req, res, next) => {
  try {
    const { scenario = 'ddos_burst', count = 5 } = req.body;
    const report = await simulatorInstance.injectScenario(scenario, Math.min(25, Number(count) || 5));

    res.status(200).json({
      success: true,
      message: `Scenario '${scenario}' injected (${report.injectedCount} records).`,
      data: report
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/simulation/hosts
 * @desc    Get list of simulated host configurations
 * @access  Public
 */
router.get('/hosts', (req, res) => {
  res.status(200).json({
    success: true,
    count: simulatorInstance.hosts.length,
    data: simulatorInstance.hosts
  });
});

/**
 * @route   POST /api/simulation/hosts
 * @desc    Add a new simulated host to the pool
 * @access  Public
 */
router.post('/hosts', (req, res) => {
  const { hostId, role, behavior } = req.body;

  if (!hostId) {
    return res.status(400).json({
      success: false,
      error: "'hostId' is required."
    });
  }

  const result = simulatorInstance.addHost(hostId, role, behavior);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.status(201).json({
    success: true,
    message: `Host ${hostId.toUpperCase()} added to simulation pool.`,
    data: result
  });
});

module.exports = router;
