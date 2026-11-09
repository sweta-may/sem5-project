const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const Host = require('../src/models/Host');
const BandwidthRecord = require('../src/models/BandwidthRecord');
const Alert = require('../src/models/Alert');
const StateTransitionHistory = require('../src/models/StateTransitionHistory');
const InvalidRecord = require('../src/models/InvalidRecord');
const { simulatorInstance } = require('../src/simulator/SimulationEngine');
const { FSM_STATES, ALERT_SEVERITIES } = require('../src/config/constants');

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

describe('PHASE 7: Full System End-to-End Integration Tests', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    await connectDB();
    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    simulatorInstance.stop();
    if (server) {
      server.close();
    }
    await disconnectDB();
  });

  const testHostA = `E2E_A_${Date.now() % 100000}`;
  const testHostB = `E2E_B_${Date.now() % 100000}`;

  test('Step 1: Ingest nominal record -> Regex PASS -> FSM NORMAL -> DB Persist', async () => {
    const recordStr = `2026-11-09T18:00:00,${testHostA},45.50,UPLOAD`;
    const res = await request('POST', '/api/records', { rawRecord: recordStr });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.hostState, FSM_STATES.NORMAL);
    assert.strictEqual(res.body.data.bandwidth, 45.5);

    // Verify record in database
    const dbRecord = await BandwidthRecord.findOne({ hostId: testHostA, bandwidth: 45.5 });
    assert.ok(dbRecord, 'BandwidthRecord should be persisted');
    assert.strictEqual(dbRecord.resultingState, FSM_STATES.NORMAL);

    // Verify host document created in database
    const dbHost = await Host.findOne({ hostId: testHostA });
    assert.ok(dbHost);
    assert.strictEqual(dbHost.currentState, FSM_STATES.NORMAL);
    assert.strictEqual(dbHost.totalRecordsProcessed, 1);
  });

  test('Step 2: Ingest malformed record -> Regex FAIL -> Rejection 400 -> InvalidRecord logged', async () => {
    const malformedStr = `2026-13-99T99:99:99,${testHostA},-999.00,INVALID_DIRECTION`;
    const res = await request('POST', '/api/records', { rawRecord: malformedStr });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.validationErrors.length > 0);
    assert.ok(res.body.loggedAuditId);

    // Verify rejection record in InvalidRecord collection
    const invalidDoc = await InvalidRecord.findById(res.body.loggedAuditId);
    assert.ok(invalidDoc);
    assert.strictEqual(invalidDoc.rawRecord, malformedStr);
  });

  test('Step 3: Multi-Host Isolation -> Host B nominal traffic does not affect Host A', async () => {
    const resB = await request('POST', '/api/records', {
      rawRecord: `2026-11-09T18:00:01,${testHostB},35.00,DOWNLOAD`
    });
    assert.strictEqual(resB.status, 201);
    assert.strictEqual(resB.body.hostState, FSM_STATES.NORMAL);

    const hostBDoc = await Host.findOne({ hostId: testHostB });
    assert.strictEqual(hostBDoc.currentState, FSM_STATES.NORMAL);
  });

  test('Step 4: Transition NORMAL -> HIGH_USAGE (Single Burst >= 100 Mbps)', async () => {
    const res = await request('POST', '/api/records', {
      rawRecord: `2026-11-09T18:00:02,${testHostA},120.00,UPLOAD`
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.hostState, FSM_STATES.HIGH_USAGE);
    assert.strictEqual(res.body.stateChanged, true);

    // Verify transition history entry
    const transition = await StateTransitionHistory.findOne({
      hostId: testHostA,
      previousState: FSM_STATES.NORMAL,
      nextState: FSM_STATES.HIGH_USAGE
    });
    assert.ok(transition, 'StateTransitionHistory should record NORMAL -> HIGH_USAGE');

    // Verify warning alert created
    const alert = await Alert.findOne({ hostId: testHostA, severity: ALERT_SEVERITIES.WARNING });
    assert.ok(alert, 'Alert should be generated for HIGH_USAGE');
  });

  test('Step 5: Repeated abnormal bursts trigger HIGH_USAGE -> SUSPICIOUS (3 consecutive)', async () => {
    // 2nd burst
    await request('POST', '/api/records', {
      rawRecord: `2026-11-09T18:00:03,${testHostA},125.00,UPLOAD`
    });

    // 3rd burst -> triggers SUSPICIOUS
    const res3 = await request('POST', '/api/records', {
      rawRecord: `2026-11-09T18:00:04,${testHostA},130.00,UPLOAD`
    });

    assert.strictEqual(res3.status, 201);
    assert.strictEqual(res3.body.hostState, FSM_STATES.SUSPICIOUS);
    assert.strictEqual(res3.body.stateChanged, true);

    // Verify SUSPICIOUS transition history
    const transition = await StateTransitionHistory.findOne({
      hostId: testHostA,
      nextState: FSM_STATES.SUSPICIOUS
    });
    assert.ok(transition);

    // Verify Host B remained unaffected
    const hostBDoc = await Host.findOne({ hostId: testHostB });
    assert.strictEqual(hostBDoc.currentState, FSM_STATES.NORMAL, 'Host B must remain NORMAL');
  });

  test('Step 6: Escalate SUSPICIOUS -> BLOCKED (Repeated violations in SUSPICIOUS)', async () => {
    // 1st violation in SUSPICIOUS
    await request('POST', '/api/records', {
      rawRecord: `2026-11-09T18:00:05,${testHostA},140.00,UPLOAD`
    });

    // 2nd violation in SUSPICIOUS -> triggers BLOCKED
    const resBlocked = await request('POST', '/api/records', {
      rawRecord: `2026-11-09T18:00:06,${testHostA},145.00,UPLOAD`
    });

    assert.strictEqual(resBlocked.status, 201);
    assert.strictEqual(resBlocked.body.hostState, FSM_STATES.BLOCKED);

    // Verify critical alert in Alert collection
    const criticalAlert = await Alert.findOne({
      hostId: testHostA,
      severity: ALERT_SEVERITIES.CRITICAL
    });
    assert.ok(criticalAlert, 'Critical alert must be present for BLOCKED');

    // Verify quarantine enforcement: subsequent records keep state BLOCKED
    const resPostBlock = await request('POST', '/api/records', {
      rawRecord: `2026-11-09T18:00:07,${testHostA},20.00,UPLOAD`
    });
    assert.strictEqual(resPostBlock.body.hostState, FSM_STATES.BLOCKED);
    assert.strictEqual(resPostBlock.body.stateChanged, false);
  });

  test('Step 7: Authorized Administrative Action resets BLOCKED host back to NORMAL', async () => {
    const resReset = await request('POST', `/api/hosts/${testHostA}/reset`);
    assert.strictEqual(resReset.status, 200);
    assert.strictEqual(resReset.body.success, true);
    assert.strictEqual(resReset.body.data.host.currentState, FSM_STATES.NORMAL);

    // Verify reset audit trail in StateTransitionHistory
    const resetTransition = await StateTransitionHistory.findOne({
      hostId: testHostA,
      previousState: FSM_STATES.BLOCKED,
      nextState: FSM_STATES.NORMAL
    });
    assert.ok(resetTransition);
  });

  test('Step 8: Auto-Recovery flow: SUSPICIOUS -> NORMAL via 3 consecutive safe records', async () => {
    const recHost = `REC_H_${Date.now() % 100000}`;
    // Force 3 bursts to make host SUSPICIOUS
    await request('POST', '/api/records', { rawRecord: `2026-11-09T18:10:01,${recHost},110.00,UPLOAD` });
    await request('POST', '/api/records', { rawRecord: `2026-11-09T18:10:02,${recHost},115.00,UPLOAD` });
    const resSusp = await request('POST', '/api/records', { rawRecord: `2026-11-09T18:10:03,${recHost},120.00,UPLOAD` });
    assert.strictEqual(resSusp.body.hostState, FSM_STATES.SUSPICIOUS);

    // Ingest 3 consecutive safe records (< 60 Mbps)
    await request('POST', '/api/records', { rawRecord: `2026-11-09T18:10:04,${recHost},40.00,UPLOAD` });
    await request('POST', '/api/records', { rawRecord: `2026-11-09T18:10:05,${recHost},42.00,UPLOAD` });
    const resRestored = await request('POST', '/api/records', { rawRecord: `2026-11-09T18:10:06,${recHost},45.00,UPLOAD` });

    assert.strictEqual(resRestored.body.hostState, FSM_STATES.NORMAL, 'Host should self-recover to NORMAL');
    assert.strictEqual(resRestored.body.stateChanged, true);
  });

  test('Step 9: Simulation Engine integration and live Dashboard aggregation', async () => {
    // Read dashboard stats before simulation injection
    const preRes = await request('GET', '/api/dashboard/stats');
    const initialTotal = preRes.body.data.bandwidth.totalRecordsProcessed;

    // Trigger simulation injection
    const injectRes = await request('POST', '/api/simulation/inject', {
      scenario: 'normal_burst',
      count: 5
    });
    assert.strictEqual(injectRes.status, 200);
    assert.strictEqual(injectRes.body.data.injectedCount, 5);

    // Read dashboard stats after injection
    const postRes = await request('GET', '/api/dashboard/stats');
    assert.strictEqual(
      postRes.body.data.bandwidth.totalRecordsProcessed,
      initialTotal + 5,
      'Dashboard stats must reflect records processed by the simulation engine'
    );
  });

  test('Step 10: Root endpoint serves frontend HTML and /api/health responds correctly', async () => {
    const healthRes = await request('GET', '/api/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.body.status, 'ONLINE');

    const rootRes = await request('GET', '/');
    assert.strictEqual(rootRes.status, 200);
    assert.ok(typeof rootRes.body === 'string' || rootRes.body.message, 'Root should serve HTML or API root');
  });
});
