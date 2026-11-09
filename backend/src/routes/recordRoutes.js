const express = require('express');
const router = express.Router();
const BandwidthRecord = require('../models/BandwidthRecord');
const InvalidRecord = require('../models/InvalidRecord');
const { validateRecord, validateBatch } = require('../validators/recordValidator');
const { processRecord, processBatch } = require('../services/recordProcessingService');

/**
 * @route   GET /api/records
 * @desc    Get recent bandwidth usage records with optional host filtering
 * @access  Public
 */
router.get('/', async (req, res, next) => {
  try {
    const { hostId, limit = 100 } = req.query;
    const filter = {};

    if (hostId) {
      filter.hostId = hostId.toUpperCase();
    }

    const records = await BandwidthRecord.find(filter)
      .sort({ timestamp: -1 })
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/records/invalid
 * @desc    Get logged invalid records that failed Regex validation
 * @access  Public
 */
router.get('/invalid', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const invalidRecords = await InvalidRecord.find()
      .sort({ receivedAt: -1 })
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      count: invalidRecords.length,
      data: invalidRecords
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/records/validate-only
 * @desc    Test validation of a record string or batch without saving to DB
 * @access  Public
 */
router.post('/validate-only', (req, res) => {
  const { rawRecord, records } = req.body;

  if (Array.isArray(records)) {
    const result = validateBatch(records);
    return res.status(200).json({
      success: true,
      batch: true,
      ...result
    });
  }

  if (typeof rawRecord === 'string') {
    const result = validateRecord(rawRecord);
    return res.status(200).json({
      success: true,
      batch: false,
      result
    });
  }

  return res.status(400).json({
    success: false,
    error: "Provide either 'rawRecord' (string) or 'records' (array of strings)."
  });
});

/**
 * @route   POST /api/records
 * @desc    Ingest raw bandwidth record(s) with strict Regex validation
 *          and complete FSM state transition & anomaly classification.
 * @access  Public
 */
router.post('/', async (req, res, next) => {
  try {
    const { rawRecord, records } = req.body;

    // Handle Batch Record Ingestion
    if (Array.isArray(records)) {
      const batchResult = validateBatch(records);
      const invalidEntries = [];

      // Persist invalid records for audit trail
      for (const inv of batchResult.invalid) {
        invalidEntries.push({
          rawRecord: inv.rawRecord,
          failureReason: inv.errors.join('; '),
          errorDetails: inv.errors
        });
      }

      if (invalidEntries.length > 0) {
        await InvalidRecord.insertMany(invalidEntries);
      }

      // Process all valid records through FSM pipeline
      const processedOutcomes = await processBatch(batchResult.valid);

      return res.status(batchResult.invalidCount > 0 ? 207 : 200).json({
        success: true,
        batch: true,
        summary: {
          total: batchResult.total,
          validCount: batchResult.validCount,
          invalidCount: batchResult.invalidCount
        },
        processed: processedOutcomes,
        invalid: batchResult.invalid
      });
    }

    // Handle Single Record Ingestion
    if (typeof rawRecord !== 'string') {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid 'rawRecord' in request body. Expected format: YYYY-MM-DDTHH:mm:ss,HOST_ID,BANDWIDTH,DIRECTION"
      });
    }

    const validation = validateRecord(rawRecord);

    if (!validation.isValid) {
      // Store rejected record in database for audit logging
      const loggedInvalid = await InvalidRecord.create({
        rawRecord: validation.rawRecord,
        failureReason: validation.errors[0] || 'Regex syntax validation failure',
        errorDetails: validation.errors
      });

      return res.status(400).json({
        success: false,
        error: 'Record failed Regex validation and was rejected.',
        validationErrors: validation.errors,
        rawRecord: validation.rawRecord,
        loggedAuditId: loggedInvalid._id
      });
    }

    // Pass valid record into the FSM processing pipeline
    const fsmOutcome = await processRecord({
      ...validation.data,
      rawRecord: validation.rawRecord
    });

    res.status(201).json({
      success: true,
      message: 'Record successfully validated and classified through FSM.',
      rawRecord: validation.rawRecord,
      hostState: fsmOutcome.currentState,
      stateChanged: fsmOutcome.stateChanged,
      fsmOutcome,
      data: validation.data
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
