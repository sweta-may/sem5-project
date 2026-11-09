const express = require('express');
const router = express.Router();
const Host = require('../models/Host');
const StateTransitionHistory = require('../models/StateTransitionHistory');
const { ApiError } = require('../middleware/errorHandler');
const { FSM_STATES } = require('../config/constants');
const { resetBlockedHost, defaultFSM } = require('../services/recordProcessingService');

/**
 * @route   GET /api/hosts/fsm/table
 * @desc    Get the FSM transition matrix and threshold rules
 * @access  Public
 */
router.get('/fsm/table', (req, res) => {
  res.status(200).json({
    success: true,
    initialState: HostFSM_InitialState(),
    thresholds: defaultFSM.thresholds,
    transitions: defaultFSM.getTransitionTable()
  });
});

function HostFSM_InitialState() {
  return FSM_STATES.NORMAL;
}

/**
 * @route   GET /api/hosts
 * @desc    Get all monitored hosts with optional filtering by state
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const { state, search } = req.query;
    const filter = {};

    if (state && Object.values(FSM_STATES).includes(state.toUpperCase())) {
      filter.currentState = state.toUpperCase();
    }

    if (search) {
      filter.$or = [
        { hostId: { $regex: search, $options: 'i' } },
        { hostname: { $regex: search, $options: 'i' } }
      ];
    }

    const hosts = await Host.find(filter).sort({ lastSeenAt: -1 });

    res.status(200).json({
      success: true,
      count: hosts.length,
      data: hosts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/hosts/:hostId
 * @desc    Get a specific host by hostId including transition history
 * @access  Public
 */
router.get('/:hostId', async (req, res, next) => {
  try {
    const hostId = req.params.hostId.toUpperCase();
    const host = await Host.findOne({ hostId });

    if (!host) {
      throw new ApiError(404, `Host not found: ${hostId}`);
    }

    const transitions = await StateTransitionHistory.find({ hostId })
      .sort({ timestamp: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: {
        host,
        recentTransitions: transitions
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/hosts/:hostId/reset
 * @desc    Authorized Administrative action to reset a BLOCKED host to NORMAL
 * @access  Public (Simulated Admin)
 */
router.post('/:hostId/reset', async (req, res, next) => {
  try {
    const hostId = req.params.hostId.toUpperCase();
    const result = await resetBlockedHost(hostId);

    res.status(200).json({
      success: true,
      message: `Host ${hostId} successfully reset to NORMAL.`,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
