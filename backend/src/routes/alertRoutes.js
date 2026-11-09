const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { ApiError } = require('../middleware/errorHandler');

/**
 * @route   GET /api/alerts
 * @desc    Get alerts with optional filtering (hostId, severity, acknowledged)
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const { hostId, severity, acknowledged, limit = 100 } = req.query;
    const filter = {};

    if (hostId) {
      filter.hostId = hostId.toUpperCase();
    }

    if (severity) {
      filter.severity = severity.toUpperCase();
    }

    if (acknowledged !== undefined) {
      filter.acknowledged = acknowledged === 'true';
    }

    const alerts = await Alert.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PATCH /api/alerts/:alertId/ack
 * @desc    Acknowledge an alert
 * @access  Public
 */
router.patch('/:alertId/ack', async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const alert = await Alert.findOne({ alertId });

    if (!alert) {
      throw new ApiError(404, `Alert not found: ${alertId}`);
    }

    alert.acknowledged = true;
    await alert.save();

    res.status(200).json({
      success: true,
      message: `Alert ${alertId} acknowledged.`,
      data: alert
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
