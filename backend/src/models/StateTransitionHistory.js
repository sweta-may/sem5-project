const mongoose = require('mongoose');
const { FSM_STATES } = require('../config/constants');

const stateTransitionHistorySchema = new mongoose.Schema(
  {
    transitionId: {
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
    previousState: {
      type: String,
      enum: Object.values(FSM_STATES),
      required: true
    },
    nextState: {
      type: String,
      enum: Object.values(FSM_STATES),
      required: true
    },
    triggeringBandwidth: {
      type: Number,
      required: true
    },
    triggeringReason: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StateTransitionHistory', stateTransitionHistorySchema);
