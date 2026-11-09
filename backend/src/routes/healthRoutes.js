const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * @route   GET /api/health
 * @desc    Get system health status, DB connectivity, and runtime metrics
 * @access  Public
 */
router.get('/', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    success: true,
    status: 'ONLINE',
    service: 'Network Bandwidth Usage Monitoring and Threshold Alert System',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      readyState: mongoose.connection.readyState,
      name: mongoose.connection.name || 'bandwidth_monitor'
    },
    version: '1.0.0'
  });
});

module.exports = router;
