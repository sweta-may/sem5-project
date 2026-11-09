const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const { SimulationEngine, simulatorInstance, SIMULATION_MODES } = require('../src/simulator/SimulationEngine');
const { validateRecord } = require('../src/validators/recordValidator');
const BandwidthRecord = require('../src/models/BandwidthRecord');
const InvalidRecord = require('../src/models/InvalidRecord');

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

describe('PHASE 5: Simulated Bandwidth Data Engine Tests', () => {
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

  // -------------------------------------------------------------
  // UNIT TESTS: SimulationEngine Core
  // -------------------------------------------------------------
  describe('SimulationEngine Generation and Control Logic', () => {
    const engine = new SimulationEngine();

    test('Engine initializes with stopped status and default host pool', () => {
      const status = engine.getStatus();
      assert.strictEqual(status.isRunning, false);
      assert.ok(status.hostCount >= 5);
      assert.ok(status.availableModes.includes('BALANCED'));
      assert.ok(status.availableModes.includes('ATTACK_SURGE'));
      assert.ok(status.availableModes.includes('MALFORMED_FUZZER'));
    });

    test('generateRecordString produces syntactically valid record for BALANCED mode', () => {
      const raw = engine.generateRecordString(engine.hosts[0], SIMULATION_MODES.BALANCED);
      const val = validateRecord(raw);
      assert.strictEqual(val.isValid, true, `Generated record should be valid: ${raw}`);
      assert.strictEqual(val.data.hostId, engine.hosts[0].hostId);
    });

    test('generateRecordString produces syntactically valid record for ATTACK_SURGE mode', () => {
      const raw = engine.generateRecordString(engine.hosts[0], SIMULATION_MODES.ATTACK_SURGE);
      const val = validateRecord(raw);
      assert.strictEqual(val.isValid, true);
      assert.ok(val.data.bandwidth >= 100.0, `Attack bandwidth should be >= 100 Mbps, got: ${val.data.bandwidth}`);
    });

    test('generateRecordString produces malformed record for MALFORMED_FUZZER mode', () => {
      const raw = engine.generateRecordString(engine.hosts[0], SIMULATION_MODES.MALFORMED_FUZZER);
      const val = validateRecord(raw);
      assert.strictEqual(val.isValid, false, `Fuzzer record should be invalid: ${raw}`);
      assert.ok(val.errors.length > 0);
    });

    test('tick() successfully processes a record through the full validation and FSM pipeline', async () => {
      const outcome = await engine.tick('HOST001', SIMULATION_MODES.BALANCED);
      assert.strictEqual(outcome.accepted, true);
      assert.strictEqual(outcome.hostId, 'HOST001');
      assert.ok(outcome.currentState);
      assert.strictEqual(engine.stats.totalGenerated, 1);
    });

    test('tick() with MALFORMED_FUZZER mode logs rejection to InvalidRecords collection', async () => {
      const outcome = await engine.tick('HOST001', SIMULATION_MODES.MALFORMED_FUZZER);
      assert.strictEqual(outcome.accepted, false);
      assert.ok(outcome.errors.length > 0);
      assert.ok(outcome.loggedAuditId);

      const invalidDoc = await InvalidRecord.findById(outcome.loggedAuditId);
      assert.ok(invalidDoc);
    });

    test('addHost() adds a new compliant host to the simulation pool', () => {
      const res = engine.addHost('SIM-SRV-99', 'Database Cluster', 'occasional_spikes');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.host.hostId, 'SIM-SRV-99');
      assert.ok(engine.hosts.some(h => h.hostId === 'SIM-SRV-99'));
    });

    test('start() and stop() properly manage the simulation timer', () => {
      engine.start(500, SIMULATION_MODES.BALANCED);
      assert.strictEqual(engine.isRunning, true);
      assert.ok(engine.timer !== null);

      engine.stop();
      assert.strictEqual(engine.isRunning, false);
      assert.strictEqual(engine.timer, null);
    });
  });

  // -------------------------------------------------------------
  // API INTEGRATION TESTS: Simulation Control Endpoints
  // -------------------------------------------------------------
  describe('Simulation REST API Endpoints', () => {
    test('GET /api/simulation/status returns live status', async () => {
      const res = await request('GET', '/api/simulation/status');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(typeof res.body.data.isRunning, 'boolean');
      assert.ok(res.body.data.hosts.length >= 5);
    });

    test('POST /api/simulation/tick executes single simulated event', async () => {
      const res = await request('POST', '/api/simulation/tick', {
        hostId: 'HOST002',
        mode: 'BALANCED'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.accepted, true);
      assert.strictEqual(res.body.data.hostId, 'HOST002');
    });

    test('POST /api/simulation/start and POST /api/simulation/stop manage background generation', async () => {
      const startRes = await request('POST', '/api/simulation/start', {
        intervalMs: 1500,
        mode: 'BALANCED'
      });
      assert.strictEqual(startRes.status, 200);
      assert.strictEqual(startRes.body.data.isRunning, true);
      assert.strictEqual(startRes.body.data.intervalMs, 1500);

      const stopRes = await request('POST', '/api/simulation/stop');
      assert.strictEqual(stopRes.status, 200);
      assert.strictEqual(stopRes.body.data.isRunning, false);
    });

    test('POST /api/simulation/config updates settings dynamically', async () => {
      const res = await request('POST', '/api/simulation/config', {
        intervalMs: 3000,
        mode: 'ATTACK_SURGE'
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.intervalMs, 3000);
      assert.strictEqual(res.body.data.mode, 'ATTACK_SURGE');
    });

    test('POST /api/simulation/inject runs burst scenario and updates dashboard statistics', async () => {
      const preStats = await request('GET', '/api/dashboard/stats');
      const initialRecords = preStats.body.data.bandwidth.totalRecordsProcessed;

      const injectRes = await request('POST', '/api/simulation/inject', {
        scenario: 'ddos_burst',
        count: 4
      });
      assert.strictEqual(injectRes.status, 200);
      assert.strictEqual(injectRes.body.data.injectedCount, 4);
      assert.strictEqual(injectRes.body.data.results.length, 4);

      // Verify dashboard statistics increased by 4
      const postStats = await request('GET', '/api/dashboard/stats');
      const finalRecords = postStats.body.data.bandwidth.totalRecordsProcessed;
      assert.strictEqual(finalRecords, initialRecords + 4, 'Dashboard total records should reflect injected records');
    });

    test('GET /api/simulation/hosts and POST /api/simulation/hosts manages host fleet', async () => {
      const listRes = await request('GET', '/api/simulation/hosts');
      assert.strictEqual(listRes.status, 200);
      assert.ok(listRes.body.count >= 5);

      const addRes = await request('POST', '/api/simulation/hosts', {
        hostId: 'API-HOST-01',
        role: 'Ingress Proxy',
        behavior: 'mostly_normal'
      });
      assert.strictEqual(addRes.status, 201);
      assert.strictEqual(addRes.body.data.host.hostId, 'API-HOST-01');
    });
  });
});
