/**
 * Network Bandwidth Record Regex Validation Module
 * 
 * Formal Definition:
 * Format: <Timestamp>,<HostID>,<BandwidthMbps>,<Direction>
 * Example: "2026-11-09T10:30:00,HOST001,125.50,UPLOAD"
 */

const { TRAFFIC_DIRECTIONS } = require('../config/constants');

// Master Regular Expression strictly validating the entire record string
const MASTER_RECORD_REGEX = /^(?<timestamp>\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d),(?<hostId>[A-Z0-9_-]{3,16}),(?<bandwidth>\d+(?:\.\d{1,2})?),(?<direction>UPLOAD|DOWNLOAD)$/;

// Individual field Regex subpatterns for surgical diagnostic reporting
const FIELD_PATTERNS = {
  timestamp: /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/,
  hostId: /^[A-Z0-9_-]{3,16}$/,
  bandwidth: /^\d+(?:\.\d{1,2})?$/,
  direction: /^(UPLOAD|DOWNLOAD)$/
};

/**
 * Validates a single bandwidth record string against the formal Regular Expression.
 * Provides granular diagnostic errors when the record fails validation.
 * 
 * @param {string} rawRecord - The raw CSV record string to validate
 * @returns {Object} { isValid: boolean, data?: Object, errors: string[], rawRecord: string }
 */
function validateRecord(rawRecord) {
  if (typeof rawRecord !== 'string') {
    return {
      isValid: false,
      rawRecord: String(rawRecord || ''),
      errors: ['Record must be a non-empty string.']
    };
  }

  const trimmed = rawRecord.trim();

  if (!trimmed) {
    return {
      isValid: false,
      rawRecord: trimmed,
      errors: ['Record cannot be empty.']
    };
  }

  // Fast-path: Check against the Master Regex
  const match = trimmed.match(MASTER_RECORD_REGEX);

  if (match && match.groups) {
    const { timestamp, hostId, bandwidth, direction } = match.groups;
    const parsedBandwidth = parseFloat(bandwidth);

    // Additional semantic check: ensure parsed Date is valid
    const dateObj = new Date(timestamp);
    if (isNaN(dateObj.getTime())) {
      return {
        isValid: false,
        rawRecord: trimmed,
        errors: [`Timestamp '${timestamp}' produces an invalid calendar date.`]
      };
    }

    return {
      isValid: true,
      rawRecord: trimmed,
      errors: [],
      data: {
        timestamp: dateObj,
        timestampString: timestamp,
        hostId: hostId.toUpperCase(),
        bandwidth: parsedBandwidth,
        direction: direction
      }
    };
  }

  // Diagnostic Path: Master Regex did not match. Diagnose exact field failures.
  const errors = [];
  const parts = trimmed.split(',');

  if (parts.length < 4) {
    errors.push(`Missing fields: expected 4 comma-separated values (Timestamp, HostID, Bandwidth, Direction), but found ${parts.length}.`);
  } else if (parts.length > 4) {
    errors.push(`Extra fields detected: expected 4 comma-separated values, but found ${parts.length}.`);
  }

  const [rawTimestamp, rawHostId, rawBandwidth, rawDirection] = parts;

  // 1. Timestamp validation
  if (!rawTimestamp) {
    errors.push("Field 1 (Timestamp) is missing.");
  } else if (!FIELD_PATTERNS.timestamp.test(rawTimestamp)) {
    errors.push(`Field 1 (Timestamp) '${rawTimestamp}' is invalid. Expected ISO format: YYYY-MM-DDTHH:mm:ss.`);
  } else {
    const d = new Date(rawTimestamp);
    if (isNaN(d.getTime())) {
      errors.push(`Field 1 (Timestamp) '${rawTimestamp}' represents an invalid calendar date.`);
    }
  }

  // 2. Host ID validation
  if (!rawHostId) {
    errors.push("Field 2 (HostID) is missing.");
  } else if (!FIELD_PATTERNS.hostId.test(rawHostId)) {
    if (rawHostId.length < 3 || rawHostId.length > 16) {
      errors.push(`Field 2 (HostID) '${rawHostId}' has invalid length (${rawHostId.length}). Must be 3-16 characters.`);
    } else {
      errors.push(`Field 2 (HostID) '${rawHostId}' contains forbidden characters. Must only contain uppercase letters, numbers, hyphens, and underscores.`);
    }
  }

  // 3. Bandwidth validation
  if (!rawBandwidth) {
    errors.push("Field 3 (Bandwidth) is missing.");
  } else if (!FIELD_PATTERNS.bandwidth.test(rawBandwidth)) {
    if (rawBandwidth.startsWith('-')) {
      errors.push(`Field 3 (Bandwidth) '${rawBandwidth}' cannot be negative.`);
    } else if (/[a-zA-Z]/.test(rawBandwidth)) {
      errors.push(`Field 3 (Bandwidth) '${rawBandwidth}' contains alphabetic characters. Must be a numeric value in Mbps.`);
    } else {
      errors.push(`Field 3 (Bandwidth) '${rawBandwidth}' is invalid. Must be a positive number with at most 2 decimal places.`);
    }
  }

  // 4. Direction validation
  if (!rawDirection) {
    errors.push("Field 4 (Direction) is missing.");
  } else if (!FIELD_PATTERNS.direction.test(rawDirection)) {
    errors.push(`Field 4 (Direction) '${rawDirection}' is invalid. Allowed values: UPLOAD or DOWNLOAD.`);
  }

  if (errors.length === 0) {
    errors.push("Record failed master syntax verification.");
  }

  return {
    isValid: false,
    rawRecord: trimmed,
    errors
  };
}

/**
 * Validates a batch of record strings
 * @param {Array<string>} recordsList 
 * @returns {Object} { total: number, validCount: number, invalidCount: number, valid: Array, invalid: Array }
 */
function validateBatch(recordsList) {
  if (!Array.isArray(recordsList)) {
    return {
      total: 0,
      validCount: 0,
      invalidCount: 0,
      valid: [],
      invalid: [{ rawRecord: '', errors: ['Payload must be an array of record strings.'] }]
    };
  }

  const valid = [];
  const invalid = [];

  for (const raw of recordsList) {
    const result = validateRecord(raw);
    if (result.isValid) {
      valid.push(result);
    } else {
      invalid.push(result);
    }
  }

  return {
    total: recordsList.length,
    validCount: valid.length,
    invalidCount: invalid.length,
    valid,
    invalid
  };
}

module.exports = {
  MASTER_RECORD_REGEX,
  FIELD_PATTERNS,
  validateRecord,
  validateBatch
};
