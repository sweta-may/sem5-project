const mongoose = require('mongoose');
const { FSM_STATES, TRAFFIC_DIRECTIONS } = require('../config/constants');

const hostSchema = new mongoose.Schema(
  {
    hostId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    hostname: {
      type: String,
      trim: true,
      default: ''
    },
    currentState: {
      type: String,
      enum: Object.values(FSM_STATES),
      default: FSM_STATES.NORMAL,
      index: true
    },
    lastBandwidthUsage: {
      type: Number,
      default: 0.0,
      min: 0.0
    },
    lastDirection: {
      type: String,
      enum: [...Object.values(TRAFFIC_DIRECTIONS), 'NONE'],
      default: 'NONE'
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    consecutiveAbnormalCount: {
      type: Number,
      default: 0,
      min: 0
    },
    consecutiveSafeCount: {
      type: Number,
      default: 0,
      min: 0
    },
    suspiciousViolationCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRecordsProcessed: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAbnormalEvents: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Host', hostSchema);
