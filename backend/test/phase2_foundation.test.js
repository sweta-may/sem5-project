const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const http = require('http');

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const Host = require('../src/models/Host');
const BandwidthRecord = require('../src/models/BandwidthRecord');
const Alert = require('../src/models/Alert');
const StateTransitionHistory = require('../src/models/StateTransitionHistory');
const InvalidRecord = require('../src/models/InvalidRecord');
const { FSM_STATES, TRAFFIC_DIRECTIONS } = require('../src/config/constants');

let server;
let baseUrl;
const uniqueSuffix = Date.now();
const testHostId = `HOST-TEST-${uniqueSuffix}`;

// Helper to make HTTP GET/POST requests using native node http
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

describe('PHASE 2: Backend Foundation and Database Integration Tests', () => {
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

  test('Database is connected and readyState is 1 (connected)', () => {
    assert.strictEqual(mongoose.connection.readyState, 1, 'MongoDB connection readyState should be 1');
  });

  test('Mongoose Models can create, save, and query documents correctly', async () => {
    // 1. Host Model
    const testHost = await Host.create({
      hostId: testHostId,
      hostname: 'test-gateway.local',
      currentState: FSM_STATES.NORMAL,
      lastBandwidthUsage: 45.5,
      lastDirection: TRAFFIC_DIRECTIONS.DOWNLOAD
    });
    assert.strictEqual(testHost.hostId, testHostId);
    assert.strictEqual(testHost.currentState, FSM_STATES.NORMAL);

    // 2. BandwidthRecord Model
    const testRecord = await BandwidthRecord.create({
      recordId: `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hostId: testHost.hostId,
      timestamp: new Date(),
      bandwidth: 45.5,
      direction: TRAFFIC_DIRECTIONS.DOWNLOAD,
      rawRecord: `2026-11-09T18:00:00,${testHostId},45.50,DOWNLOAD`,
      resultingState: FSM_STATES.NORMAL,
      isAnomaly: false
    });
    assert.strictEqual(testRecord.bandwidth, 45.5);

    // 3. StateTransitionHistory Model
    const testHistory = await StateTransitionHistory.create({
      transitionId: `TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hostId: testHost.hostId,
      previousState: FSM_STATES.NORMAL,
      nextState: FSM_STATES.HIGH_USAGE,
      triggeringBandwidth: 120.0,
      triggeringReason: 'Usage exceeded 100 Mbps threshold'
    });
    assert.strictEqual(testHistory.nextState, FSM_STATES.HIGH_USAGE);

    // 4. Alert Model
    const testAlert = await Alert.create({
      alertId: `ALT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hostId: testHost.hostId,
      alertType: 'HIGH_USAGE',
      severity: 'WARNING',
      description: 'Host entered HIGH_USAGE state'
    });
    assert.strictEqual(testAlert.severity, 'WARNING');

    // 5. InvalidRecord Model
    const testInvalid = await InvalidRecord.create({
      rawRecord: 'INVALID,RECORD,DATA',
      failureReason: 'Syntactic regex mismatch'
    });
    assert.strictEqual(testInvalid.rawRecord, 'INVALID,RECORD,DATA');
  });

  test('GET /api/health returns online status and DB info', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.status, 'ONLINE');
    assert.strictEqual(res.body.database.status, 'connected');
  });

  test('GET /api/hosts returns host list including test host', async () => {
    const res = await request('GET', '/api/hosts');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.count >= 1);
    const found = res.body.data.find(h => h.hostId === testHostId);
    assert.ok(found, `${testHostId} should be present in host query`);
  });

  test('GET /api/hosts/:hostId returns host details', async () => {
    const res = await request('GET', `/api/hosts/${testHostId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.host.hostId, testHostId);
  });

  test('GET /api/dashboard/stats returns aggregated metrics', async () => {
    const res = await request('GET', '/api/dashboard/stats');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.hosts.total >= 1);
  });

  test('POST /api/records validates and accepts standard record', async () => {
    const res = await request('POST', '/api/records', {
      rawRecord: '2026-11-09T10:30:00,HOST001,125.50,UPLOAD'
    });
    assert.ok([200, 201].includes(res.status));
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.rawRecord, '2026-11-09T10:30:00,HOST001,125.50,UPLOAD');
  });

  test('404 Not Found returns structured error response', async () => {
    const res = await request('GET', '/api/non-existent-endpoint');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error.includes('Endpoint not found'));
  });
});
