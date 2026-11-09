const mongoose = require('mongoose');

const invalidRecordSchema = new mongoose.Schema(
  {
    rawRecord: {
      type: String,
      required: true
    },
    failureReason: {
      type: String,
      required: true
    },
    errorDetails: {
      type: Array,
      default: []
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('InvalidRecord', invalidRecordSchema);
