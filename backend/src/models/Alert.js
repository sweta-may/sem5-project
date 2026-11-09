const mongoose = require('mongoose');
const { ALERT_TYPES, ALERT_SEVERITIES } = require('../config/constants');

const alertSchema = new mongoose.Schema(
  {
    alertId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    hostId: {
      type: String,
      required: true,
      uppercase: true,
      index: true
    },
    alertType: {
      type: String,
      enum: Object.values(ALERT_TYPES),
      required: true
    },
    severity: {
      type: String,
      enum: Object.values(ALERT_SEVERITIES),
      required: true
    },
    description: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    acknowledged: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Alert', alertSchema);
