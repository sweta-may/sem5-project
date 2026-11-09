const express = require('express');
const router = express.Router();
const Host = require('../models/Host');
const BandwidthRecord = require('../models/BandwidthRecord');
const Alert = require('../models/Alert');
const { FSM_STATES } = require('../config/constants');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Aggregate statistics across hosts, bandwidth, and alerts
 * @access  Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalHosts,
      normalHosts,
      highUsageHosts,
      suspiciousHosts,
      blockedHosts,
      recentAlerts,
      bandwidthAgg
    ] = await Promise.all([
      Host.countDocuments(),
      Host.countDocuments({ currentState: FSM_STATES.NORMAL }),
      Host.countDocuments({ currentState: FSM_STATES.HIGH_USAGE }),
      Host.countDocuments({ currentState: FSM_STATES.SUSPICIOUS }),
      Host.countDocuments({ currentState: FSM_STATES.BLOCKED }),
      Alert.find().sort({ timestamp: -1 }).limit(10),
      BandwidthRecord.aggregate([
        {
          $group: {
            _id: null,
            totalBandwidth: { $sum: '$bandwidth' },
            totalRecords: { $sum: 1 }
          }
        }
      ])
    ]);

    const totalBandwidth = bandwidthAgg.length > 0 ? bandwidthAgg[0].totalBandwidth : 0;
    const totalRecords = bandwidthAgg.length > 0 ? bandwidthAgg[0].totalRecords : 0;

    res.status(200).json({
      success: true,
      data: {
        hosts: {
          total: totalHosts,
          normal: normalHosts,
          highUsage: highUsageHosts,
          suspicious: suspiciousHosts,
          blocked: blockedHosts
        },
        bandwidth: {
          totalBandwidthMbps: Number(totalBandwidth.toFixed(2)),
          totalRecordsProcessed: totalRecords
        },
        alerts: {
          recent: recentAlerts,
          unacknowledgedCount: await Alert.countDocuments({ acknowledged: false })
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
