const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const InvalidRecord = require('../src/models/InvalidRecord');
const {
  MASTER_RECORD_REGEX,
  validateRecord,
  validateBatch
} = require('../src/validators/recordValidator');

let server;
let baseUrl;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

describe('PHASE 3: Regex Record Validation Module Tests', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      server.close();
    }
    await disconnectDB();
  });

  // -------------------------------------------------------------
  // UNIT TESTS: Positive Validation Cases
  // -------------------------------------------------------------
  describe('Positive Regex Validation Cases', () => {
    test('Valid standard record with 2 decimal places and UPLOAD', () => {
      const record = '2026-11-09T10:30:00,HOST001,125.50,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
      assert.strictEqual(result.data.hostId, 'HOST001');
      assert.strictEqual(result.data.bandwidth, 125.5);
      assert.strictEqual(result.data.direction, 'UPLOAD');
      assert.strictEqual(result.data.timestampString, '2026-11-09T10:30:00');
    });

    test('Valid standard record with integer bandwidth and DOWNLOAD', () => {
      const record = '2026-05-15T23:59:59,SRV-GATEWAY-99,80,DOWNLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.data.hostId, 'SRV-GATEWAY-99');
      assert.strictEqual(result.data.bandwidth, 80);
      assert.strictEqual(result.data.direction, 'DOWNLOAD');
    });

    test('Valid record with 1 decimal place and zero bandwidth', () => {
      const record = '2026-01-01T00:00:00,HOST_NODE_1,0.0,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.data.bandwidth, 0);
    });

    test('Valid record with boundary host ID (3 chars and 16 chars)', () => {
      const minHost = '2026-11-09T12:00:00,H01,50.00,UPLOAD';
      const maxHost = '2026-11-09T12:00:00,NODE-SERVER-9999,50.00,DOWNLOAD';
      assert.strictEqual(validateRecord(minHost).isValid, true);
      assert.strictEqual(validateRecord(maxHost).isValid, true);
    });
  });

  // -------------------------------------------------------------
  // UNIT TESTS: Negative Validation Cases
  // -------------------------------------------------------------
  describe('Negative Regex Validation Cases (Malformed Inputs)', () => {
    test('Rejects invalid timestamp: month out of range (13)', () => {
      const record = '2026-13-09T10:30:00,HOST001,100.00,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('Timestamp')));
    });

    test('Rejects invalid timestamp: day out of range (32)', () => {
      const record = '2026-11-32T10:30:00,HOST001,100.00,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('Timestamp')));
    });

    test('Rejects invalid timestamp: hours out of range (25:00:00)', () => {
      const record = '2026-11-09T25:00:00,HOST001,100.00,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('Timestamp')));
    });

    test('Rejects invalid host ID: contains special characters (@, !)', () => {
      const record = '2026-11-09T10:30:00,HOST@01!,100.00,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('HostID')));
    });

    test('Rejects invalid host ID: too short (<3 chars) and too long (>16 chars)', () => {
      const shortHost = '2026-11-09T10:30:00,H1,100.00,UPLOAD';
      const longHost = '2026-11-09T10:30:00,HOST-VERY-LONG-IDENTIFIER-EXCEEDS-16,100.00,UPLOAD';
      assert.strictEqual(validateRecord(shortHost).isValid, false);
      assert.strictEqual(validateRecord(longHost).isValid, false);
    });

    test('Rejects negative bandwidth value', () => {
      const record = '2026-11-09T10:30:00,HOST001,-45.50,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('negative')));
    });

    test('Rejects alphabetic bandwidth value', () => {
      const record = '2026-11-09T10:30:00,HOST001,UNLIMITED,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('alphabetic') || e.includes('numeric')));
    });

    test('Rejects bandwidth with excessive decimal places (>2 decimals)', () => {
      const record = '2026-11-09T10:30:00,HOST001,12.3456,UPLOAD';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('decimal')));
    });

    test('Rejects invalid traffic direction (not UPLOAD or DOWNLOAD)', () => {
      const record = '2026-11-09T10:30:00,HOST001,100.00,INBOUND';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('Direction')));
    });

    test('Rejects lowercase traffic direction (strict case sensitivity)', () => {
      const record = '2026-11-09T10:30:00,HOST001,100.00,upload';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('Direction')));
    });

    test('Rejects missing fields (3 fields instead of 4)', () => {
      const record = '2026-11-09T10:30:00,HOST001,100.00';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('Missing fields')));
    });

    test('Rejects extra fields (5 fields instead of 4)', () => {
      const record = '2026-11-09T10:30:00,HOST001,100.00,UPLOAD,EXTRA_DATA';
      const result = validateRecord(record);
      assert.strictEqual(result.isValid, false);
      assert.ok(result.errors.some(e => e.includes('Extra fields')));
    });

    test('Rejects empty record string and whitespace', () => {
      const emptyResult = validateRecord('');
      const spaceResult = validateRecord('   ');
      assert.strictEqual(emptyResult.isValid, false);
      assert.strictEqual(spaceResult.isValid, false);
      assert.ok(emptyResult.errors.some(e => e.includes('empty')));
    });
  });

  // -------------------------------------------------------------
  // UNIT TESTS: Batch Validation
  // -------------------------------------------------------------
  describe('Batch Validation Logic', () => {
    test('Correctly separates valid and invalid records in batch', () => {
      const batch = [
        '2026-11-09T10:00:00,HOST001,50.00,UPLOAD',
        'MALFORMED_RECORD_HERE',
        '2026-11-09T10:01:00,HOST002,120.00,DOWNLOAD',
        '2026-11-09T10:02:00,HOST003,-20.00,UPLOAD'
      ];
      const result = validateBatch(batch);
      assert.strictEqual(result.total, 4);
      assert.strictEqual(result.validCount, 2);
      assert.strictEqual(result.invalidCount, 2);
    });
  });

  // -------------------------------------------------------------
  // API INTEGRATION TESTS: Record Ingestion Endpoints
  // -------------------------------------------------------------
  describe('API Endpoints for Record Validation and Ingestion', () => {
    test('POST /api/records/validate-only returns analysis without saving to DB', async () => {
      const res = await request('POST', '/api/records/validate-only', {
        rawRecord: '2026-11-09T10:30:00,HOST001,125.50,UPLOAD'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.result.isValid, true);
      assert.strictEqual(res.body.result.data.bandwidth, 125.5);
    });

    test('POST /api/records accepts valid record with 201 Created', async () => {
      const res = await request('POST', '/api/records', {
        rawRecord: '2026-11-09T11:00:00,HOST005,95.20,DOWNLOAD'
      });
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.hostId, 'HOST005');
      assert.strictEqual(res.body.data.bandwidth, 95.2);
    });

    test('POST /api/records rejects malformed record with 400 Bad Request and logs to DB', async () => {
      const malformedPayload = '2026-11-09T99:99:99,HOST_BAD,-999,INVALID_DIR';
      const res = await request('POST', '/api/records', {
        rawRecord: malformedPayload
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.validationErrors.length > 0);
      assert.ok(res.body.loggedAuditId, 'Should return logged audit ID');

      // Verify that the record was stored in InvalidRecord collection
      const stored = await InvalidRecord.findById(res.body.loggedAuditId);
      assert.ok(stored);
      assert.strictEqual(stored.rawRecord, malformedPayload);
    });

    test('GET /api/records/invalid returns list of logged invalid records', async () => {
      const res = await request('GET', '/api/records/invalid');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.count >= 1);
    });

    test('POST /api/records with batch input returns 207 Multi-Status when mixed', async () => {
      const res = await request('POST', '/api/records', {
        records: [
          '2026-11-09T12:00:00,HOST010,40.00,UPLOAD',
          'INVALID,BATCH,RECORD'
        ]
      });
      assert.strictEqual(res.status, 207);
      assert.strictEqual(res.body.summary.validCount, 1);
      assert.strictEqual(res.body.summary.invalidCount, 1);
    });
  });
});
