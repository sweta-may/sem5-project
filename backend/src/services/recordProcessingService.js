const Host = require('../models/Host');
const BandwidthRecord = require('../models/BandwidthRecord');
const StateTransitionHistory = require('../models/StateTransitionHistory');
const Alert = require('../models/Alert');
const HostFSM = require('../fsm/HostFSM');
const { FSM_STATES } = require('../config/constants');

// Singleton default FSM instance
const defaultFSM = new HostFSM();

/**
 * Service to process a single validated bandwidth record through the FSM pipeline.
 * Manages database persistence for Host, BandwidthRecord, StateTransitionHistory, and Alert.
 * 
 * @param {Object} parsedRecord Validated record data from recordValidator
 * @returns {Promise<Object>} Processing outcome including host state, transition, and alerts
 */
async function processRecord(parsedRecord) {
  const { timestamp, hostId, bandwidth, direction, rawRecord } = parsedRecord;

  // 1. Retrieve or provision Host document
  let host = await Host.findOne({ hostId });

  if (!host) {
    host = new Host({
      hostId,
      hostname: `${hostId.toLowerCase()}.network.local`,
      currentState: HostFSM.INITIAL_STATE,
      lastBandwidthUsage: bandwidth,
      lastDirection: direction,
      lastSeenAt: timestamp || new Date()
    });
  }

  // 2. Evaluate FSM transition
  const context = {
    consecutiveAbnormal: host.consecutiveAbnormalCount,
    consecutiveSafe: host.consecutiveSafeCount,
    suspiciousViolations: host.suspiciousViolationCount
  };

  const fsmResult = defaultFSM.evaluate(host.currentState, context, bandwidth);

  // 3. Update host metrics & context
  const previousState = host.currentState;
  host.currentState = fsmResult.nextState;
  host.lastBandwidthUsage = bandwidth;
  host.lastDirection = direction;
  host.lastSeenAt = timestamp || new Date();
  host.totalRecordsProcessed += 1;

  if (fsmResult.isAnomaly) {
    host.totalAbnormalEvents += 1;
  }

  host.consecutiveAbnormalCount = fsmResult.updatedContext.consecutiveAbnormal;
  host.consecutiveSafeCount = fsmResult.updatedContext.consecutiveSafe;
  host.suspiciousViolationCount = fsmResult.updatedContext.suspiciousViolations;

  await host.save();

  // 4. Persist BandwidthRecord
  const recordDoc = await BandwidthRecord.create({
    recordId: `REC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    hostId,
    timestamp: timestamp || new Date(),
    bandwidth,
    direction,
    rawRecord,
    resultingState: fsmResult.nextState,
    isAnomaly: fsmResult.isAnomaly
  });

  // 5. If state changed, persist in StateTransitionHistory
  let transitionDoc = null;
  if (fsmResult.stateChanged) {
    transitionDoc = await StateTransitionHistory.create({
      transitionId: `TR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      hostId,
      previousState: fsmResult.previousState,
      nextState: fsmResult.nextState,
      triggeringBandwidth: bandwidth,
      triggeringReason: fsmResult.reason,
      timestamp: timestamp || new Date()
    });
  }

  // 6. If alert generated, persist in Alert collection
  let alertDoc = null;
  if (fsmResult.alert) {
    alertDoc = await Alert.create({
      alertId: `ALT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      hostId,
      alertType: fsmResult.alert.type,
      severity: fsmResult.alert.severity,
      description: fsmResult.alert.description,
      timestamp: timestamp || new Date()
    });
  }

  return {
    hostId,
    previousState,
    currentState: fsmResult.nextState,
    stateChanged: fsmResult.stateChanged,
    reason: fsmResult.reason,
    isAnomaly: fsmResult.isAnomaly,
    record: recordDoc,
    transition: transitionDoc,
    alert: alertDoc
  };
}

/**
 * Service to process a batch of validated records sequentially per host
 * @param {Array<Object>} validatedRecords List of valid record objects from recordValidator
 * @returns {Promise<Array<Object>>}
 */
async function processBatch(validatedRecords) {
  const results = [];
  for (const item of validatedRecords) {
    const outcome = await processRecord({
      ...item.data,
      rawRecord: item.rawRecord
    });
    results.push(outcome);
  }
  return results;
}

/**
 * Execute authorized administrative reset on a host
 */
async function resetBlockedHost(hostId) {
  const host = await Host.findOne({ hostId: hostId.toUpperCase() });

  if (!host) {
    throw new Error(`Host not found: ${hostId}`);
  }

  const previousState = host.currentState;
  const resetResult = defaultFSM.adminReset(host.hostId);

  host.currentState = resetResult.nextState;
  host.consecutiveAbnormalCount = resetResult.updatedContext.consecutiveAbnormal;
  host.consecutiveSafeCount = resetResult.updatedContext.consecutiveSafe;
  host.suspiciousViolationCount = resetResult.updatedContext.suspiciousViolations;
  await host.save();

  const transitionDoc = await StateTransitionHistory.create({
    transitionId: `TR-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    hostId: host.hostId,
    previousState,
    nextState: resetResult.nextState,
    triggeringBandwidth: host.lastBandwidthUsage,
    triggeringReason: resetResult.reason,
    timestamp: new Date()
  });

  const alertDoc = await Alert.create({
    alertId: `ALT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    hostId: host.hostId,
    alertType: resetResult.alert.type,
    severity: resetResult.alert.severity,
    description: resetResult.alert.description,
    timestamp: new Date()
  });

  return {
    host,
    transition: transitionDoc,
    alert: alertDoc
  };
}

module.exports = {
  processRecord,
  processBatch,
  resetBlockedHost,
  defaultFSM
};
