const mongoose = require('mongoose');
const { TRAFFIC_DIRECTIONS, FSM_STATES } = require('../config/constants');

const bandwidthRecordSchema = new mongoose.Schema(
  {
    recordId: {
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
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    bandwidth: {
      type: Number,
      required: true,
      min: 0.0
    },
    direction: {
      type: String,
      enum: Object.values(TRAFFIC_DIRECTIONS),
      required: true
    },
    rawRecord: {
      type: String,
      required: true
    },
    resultingState: {
      type: String,
      enum: Object.values(FSM_STATES),
      required: true
    },
    isAnomaly: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('BandwidthRecord', bandwidthRecordSchema);
