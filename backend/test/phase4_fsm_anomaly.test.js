const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const HostFSM = require('../src/fsm/HostFSM');
const Host = require('../src/models/Host');
const BandwidthRecord = require('../src/models/BandwidthRecord');
const Alert = require('../src/models/Alert');
const StateTransitionHistory = require('../src/models/StateTransitionHistory');
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

describe('PHASE 4: Finite-State Machine and Anomaly Classification Tests', () => {
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
  // UNIT TESTS: Core HostFSM Transition Logic
  // -------------------------------------------------------------
  describe('Deterministic HostFSM Logic', () => {
    const fsm = new HostFSM();

    test('Initial host state is strictly NORMAL', () => {
      assert.strictEqual(HostFSM.INITIAL_STATE, FSM_STATES.NORMAL);
    });

    test('Transition 1: NORMAL -> HIGH_USAGE upon usage >= 100 Mbps', () => {
      const result = fsm.evaluate(FSM_STATES.NORMAL, {}, 120.0);
      assert.strictEqual(result.nextState, FSM_STATES.HIGH_USAGE);
      assert.strictEqual(result.stateChanged, true);
      assert.strictEqual(result.isAnomaly, true);
      assert.strictEqual(result.updatedContext.consecutiveAbnormal, 1);
      assert.strictEqual(result.alert.severity, ALERT_SEVERITIES.WARNING);
    });

    test('Transition 2: HIGH_USAGE -> NORMAL upon usage < 60 Mbps recovery threshold', () => {
      const result = fsm.evaluate(FSM_STATES.HIGH_USAGE, { consecutiveAbnormal: 1 }, 45.0);
      assert.strictEqual(result.nextState, FSM_STATES.NORMAL);
      assert.strictEqual(result.stateChanged, true);
      assert.strictEqual(result.isAnomaly, false);
      assert.strictEqual(result.updatedContext.consecutiveAbnormal, 0);
      assert.strictEqual(result.alert.severity, ALERT_SEVERITIES.INFO);
    });

    test('Transition 3: Repeated abnormal usage triggers HIGH_USAGE -> SUSPICIOUS (3 consecutive spikes)', () => {
      // 1st spike
      let res = fsm.evaluate(FSM_STATES.NORMAL, {}, 110.0);
      assert.strictEqual(res.nextState, FSM_STATES.HIGH_USAGE);
      assert.strictEqual(res.updatedContext.consecutiveAbnormal, 1);

      // 2nd spike
      res = fsm.evaluate(FSM_STATES.HIGH_USAGE, res.updatedContext, 115.0);
      assert.strictEqual(res.nextState, FSM_STATES.HIGH_USAGE);
      assert.strictEqual(res.updatedContext.consecutiveAbnormal, 2);
      assert.strictEqual(res.stateChanged, false);

      // 3rd spike -> Reaches SUSPICIOUS_BURST_COUNT (3)
      res = fsm.evaluate(FSM_STATES.HIGH_USAGE, res.updatedContext, 130.0);
      assert.strictEqual(res.nextState, FSM_STATES.SUSPICIOUS);
      assert.strictEqual(res.stateChanged, true);
      assert.strictEqual(res.alert.severity, ALERT_SEVERITIES.HIGH);
    });

    test('Transition 4: SUSPICIOUS -> BLOCKED when repeated violations exceed limit', () => {
      // 1st violation in SUSPICIOUS
      let res = fsm.evaluate(FSM_STATES.SUSPICIOUS, { suspiciousViolations: 0 }, 140.0);
      assert.strictEqual(res.nextState, FSM_STATES.SUSPICIOUS);
      assert.strictEqual(res.updatedContext.suspiciousViolations, 1);

      // 2nd violation in SUSPICIOUS -> Reaches BLOCK_VIOLATION_LIMIT (2)
      res = fsm.evaluate(FSM_STATES.SUSPICIOUS, res.updatedContext, 145.0);
      assert.strictEqual(res.nextState, FSM_STATES.BLOCKED);
      assert.strictEqual(res.stateChanged, true);
      assert.strictEqual(res.alert.severity, ALERT_SEVERITIES.CRITICAL);
    });

    test('Transition 5: SUSPICIOUS -> NORMAL after 3 consecutive safe readings (< 60 Mbps)', () => {
      let ctx = { consecutiveSafe: 0 };

      // Safe reading 1
      let res = fsm.evaluate(FSM_STATES.SUSPICIOUS, ctx, 50.0);
      assert.strictEqual(res.nextState, FSM_STATES.SUSPICIOUS);
      assert.strictEqual(res.updatedContext.consecutiveSafe, 1);

      // Safe reading 2
      res = fsm.evaluate(FSM_STATES.SUSPICIOUS, res.updatedContext, 40.0);
      assert.strictEqual(res.nextState, FSM_STATES.SUSPICIOUS);
      assert.strictEqual(res.updatedContext.consecutiveSafe, 2);

      // Safe reading 3 -> Reaches RECOVERY_CONSECUTIVE_REQUIRED (3)
      res = fsm.evaluate(FSM_STATES.SUSPICIOUS, res.updatedContext, 30.0);
      assert.strictEqual(res.nextState, FSM_STATES.NORMAL);
      assert.strictEqual(res.stateChanged, true);
      assert.strictEqual(res.alert.severity, ALERT_SEVERITIES.INFO);
    });

    test('Transition 6: Immediate NORMAL -> BLOCKED upon critical spike >= 250 Mbps', () => {
      const res = fsm.evaluate(FSM_STATES.NORMAL, {}, 320.0);
      assert.strictEqual(res.nextState, FSM_STATES.BLOCKED);
      assert.strictEqual(res.stateChanged, true);
      assert.strictEqual(res.alert.severity, ALERT_SEVERITIES.CRITICAL);
    });

    test('Transition 7: BLOCKED host remains quarantined upon receiving new traffic', () => {
      const res = fsm.evaluate(FSM_STATES.BLOCKED, {}, 50.0);
      assert.strictEqual(res.nextState, FSM_STATES.BLOCKED);
      assert.strictEqual(res.stateChanged, false);
      assert.ok(res.reason.includes('quarantined'));
    });

    test('Transition 8: BLOCKED -> NORMAL via authorized administrative reset', () => {
      const res = fsm.adminReset('HOST-BLOCKED-01');
      assert.strictEqual(res.nextState, FSM_STATES.NORMAL);
      assert.strictEqual(res.stateChanged, true);
      assert.strictEqual(res.alert.severity, ALERT_SEVERITIES.INFO);
      assert.strictEqual(res.updatedContext.consecutiveAbnormal, 0);
    });
  });

  // -------------------------------------------------------------
  // INTEGRATION TESTS: Multi-Host Isolation & Ingestion Pipeline
  // -------------------------------------------------------------
  describe('Multi-Host State Isolation & Pipeline Integration', () => {
    // 3-16 chars compliant host IDs
    const hostA = `HSTA_${Date.now() % 100000}`;
    const hostB = `HSTB_${Date.now() % 100000}`;

    test('Multiple hosts maintain completely independent FSM states', async () => {
      // Ingest nominal traffic for Host B
      const resB1 = await request('POST', '/api/records', {
        rawRecord: `2026-11-09T14:00:00,${hostB},40.00,DOWNLOAD`
      });
      assert.strictEqual(resB1.status, 201);
      assert.strictEqual(resB1.body.hostState, FSM_STATES.NORMAL);

      // Ingest 3 consecutive high-usage spikes for Host A
      await request('POST', '/api/records', { rawRecord: `2026-11-09T14:00:01,${hostA},120.00,UPLOAD` });
      await request('POST', '/api/records', { rawRecord: `2026-11-09T14:00:02,${hostA},130.00,UPLOAD` });
      const resA3 = await request('POST', '/api/records', {
        rawRecord: `2026-11-09T14:00:03,${hostA},140.00,UPLOAD`
      });
      assert.strictEqual(resA3.status, 201);
      assert.strictEqual(resA3.body.hostState, FSM_STATES.SUSPICIOUS);

      // Verify Host B remains in NORMAL despite Host A escalating to SUSPICIOUS
      const hostBDoc = await Host.findOne({ hostId: hostB });
      const hostADoc = await Host.findOne({ hostId: hostA });
      assert.strictEqual(hostBDoc.currentState, FSM_STATES.NORMAL, 'Host B must remain NORMAL');
      assert.strictEqual(hostADoc.currentState, FSM_STATES.SUSPICIOUS, 'Host A must be SUSPICIOUS');

      // Escalate Host A to BLOCKED
      await request('POST', '/api/records', { rawRecord: `2026-11-09T14:00:04,${hostA},150.00,UPLOAD` });
      const resA5 = await request('POST', '/api/records', {
        rawRecord: `2026-11-09T14:00:05,${hostA},160.00,UPLOAD`
      });
      assert.strictEqual(resA5.body.hostState, FSM_STATES.BLOCKED);

      // Verify Host A transitions are logged in StateTransitionHistory
      const transitions = await StateTransitionHistory.find({ hostId: hostA }).sort({ timestamp: 1 });
      assert.ok(transitions.length >= 3, 'Host A should have recorded at least 3 state transitions');
      assert.strictEqual(transitions[0].nextState, FSM_STATES.HIGH_USAGE);
      assert.strictEqual(transitions[1].nextState, FSM_STATES.SUSPICIOUS);
      assert.strictEqual(transitions[2].nextState, FSM_STATES.BLOCKED);

      // Verify alerts were generated for Host A
      const alerts = await Alert.find({ hostId: hostA }).sort({ timestamp: 1 });
      assert.ok(alerts.length >= 3, 'Host A should have generated at least 3 alerts');
      assert.ok(alerts.some(a => a.severity === ALERT_SEVERITIES.CRITICAL));

      // Test Administrative Reset of Host A
      const resetRes = await request('POST', `/api/hosts/${hostA}/reset`);
      assert.strictEqual(resetRes.status, 200);
      assert.strictEqual(resetRes.body.success, true);
      assert.strictEqual(resetRes.body.data.host.currentState, FSM_STATES.NORMAL);
    });

    test('GET /api/hosts/fsm/table returns FSM transition matrix', async () => {
      const res = await request('GET', '/api/hosts/fsm/table');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.initialState, FSM_STATES.NORMAL);
      assert.ok(res.body.transitions.length >= 9);
    });
  });
});
