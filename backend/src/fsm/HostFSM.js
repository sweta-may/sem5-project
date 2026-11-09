/**
 * Deterministic Finite-State Machine (FSM) for Host Bandwidth Classification
 * 
 * Formal Definition:
 * M = (Q, Sigma, delta, q0, F)
 * 
 * Q = { NORMAL, HIGH_USAGE, SUSPICIOUS, BLOCKED }
 * q0 = NORMAL
 * F = { BLOCKED }
 */

const { FSM_STATES, ALERT_TYPES, ALERT_SEVERITIES, DEFAULT_THRESHOLDS } = require('../config/constants');

class HostFSM {
  /**
   * @param {Object} customThresholds Optional override of default thresholds
   */
  constructor(customThresholds = {}) {
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...customThresholds
    };
  }

  /**
   * Returns the canonical initial state for newly provisioned hosts
   */
  static get INITIAL_STATE() {
    return FSM_STATES.NORMAL;
  }

  /**
   * Evaluates the next state based on current host state, context counters, and incoming bandwidth.
   * Pure deterministic function without database side effects.
   * 
   * @param {string} currentState Current FSM state of the host
   * @param {Object} context Host context counters { consecutiveAbnormal, consecutiveSafe, suspiciousViolations }
   * @param {number} bandwidth Bandwidth value in Mbps
   * @returns {Object} Transition evaluation result
   */
  evaluate(currentState, context = {}, bandwidth) {
    const {
      HIGH_USAGE_THRESHOLD_MBPS,
      CRITICAL_THRESHOLD_MBPS,
      RECOVERY_THRESHOLD_MBPS,
      SUSPICIOUS_BURST_COUNT,
      BLOCK_VIOLATION_LIMIT,
      RECOVERY_CONSECUTIVE_REQUIRED
    } = this.thresholds;

    const ctx = {
      consecutiveAbnormal: context.consecutiveAbnormal || 0,
      consecutiveSafe: context.consecutiveSafe || 0,
      suspiciousViolations: context.suspiciousViolations || 0
    };

    let nextState = currentState;
    let stateChanged = false;
    let reason = 'Nominal bandwidth reading; state retained.';
    let alert = null;
    let isAnomaly = false;

    switch (currentState) {
      case FSM_STATES.NORMAL: {
        if (bandwidth >= CRITICAL_THRESHOLD_MBPS) {
          nextState = FSM_STATES.BLOCKED;
          stateChanged = true;
          isAnomaly = true;
          reason = `Critical bandwidth surge (${bandwidth.toFixed(2)} Mbps >= ${CRITICAL_THRESHOLD_MBPS} Mbps) detected. Immediate quarantine.`;
          alert = {
            type: ALERT_TYPES.HOST_BLOCKED,
            severity: ALERT_SEVERITIES.CRITICAL,
            description: reason
          };
        } else if (bandwidth >= HIGH_USAGE_THRESHOLD_MBPS) {
          nextState = FSM_STATES.HIGH_USAGE;
          stateChanged = true;
          isAnomaly = true;
          ctx.consecutiveAbnormal = 1;
          ctx.consecutiveSafe = 0;
          reason = `Bandwidth usage (${bandwidth.toFixed(2)} Mbps) crossed high threshold (${HIGH_USAGE_THRESHOLD_MBPS} Mbps).`;
          alert = {
            type: ALERT_TYPES.HIGH_USAGE,
            severity: ALERT_SEVERITIES.WARNING,
            description: reason
          };
        } else {
          // Nominal traffic in NORMAL
          ctx.consecutiveAbnormal = 0;
          ctx.consecutiveSafe += 1;
        }
        break;
      }

      case FSM_STATES.HIGH_USAGE: {
        isAnomaly = true;
        if (bandwidth >= CRITICAL_THRESHOLD_MBPS) {
          nextState = FSM_STATES.BLOCKED;
          stateChanged = true;
          reason = `Critical bandwidth surge (${bandwidth.toFixed(2)} Mbps >= ${CRITICAL_THRESHOLD_MBPS} Mbps) while in HIGH_USAGE. Host quarantined.`;
          alert = {
            type: ALERT_TYPES.HOST_BLOCKED,
            severity: ALERT_SEVERITIES.CRITICAL,
            description: reason
          };
        } else if (bandwidth >= HIGH_USAGE_THRESHOLD_MBPS) {
          ctx.consecutiveAbnormal += 1;
          if (ctx.consecutiveAbnormal >= SUSPICIOUS_BURST_COUNT) {
            nextState = FSM_STATES.SUSPICIOUS;
            stateChanged = true;
            ctx.suspiciousViolations = 1;
            ctx.consecutiveSafe = 0;
            reason = `Repeated abnormal usage: ${ctx.consecutiveAbnormal} consecutive spikes >= ${HIGH_USAGE_THRESHOLD_MBPS} Mbps. Host classified as SUSPICIOUS.`;
            alert = {
              type: ALERT_TYPES.SUSPICIOUS_PATTERN,
              severity: ALERT_SEVERITIES.HIGH,
              description: reason
            };
          } else {
            reason = `High usage continues (${ctx.consecutiveAbnormal}/${SUSPICIOUS_BURST_COUNT} consecutive spikes).`;
          }
        } else if (bandwidth < RECOVERY_THRESHOLD_MBPS) {
          nextState = FSM_STATES.NORMAL;
          stateChanged = true;
          isAnomaly = false;
          ctx.consecutiveAbnormal = 0;
          ctx.consecutiveSafe = 1;
          reason = `Bandwidth (${bandwidth.toFixed(2)} Mbps) dropped below recovery threshold (< ${RECOVERY_THRESHOLD_MBPS} Mbps). Host recovered to NORMAL.`;
          alert = {
            type: ALERT_TYPES.HOST_RECOVERED,
            severity: ALERT_SEVERITIES.INFO,
            description: reason
          };
        } else {
          // Moderate usage between recovery threshold and high threshold
          reason = `Moderate usage (${bandwidth.toFixed(2)} Mbps); awaiting safe recovery below ${RECOVERY_THRESHOLD_MBPS} Mbps.`;
        }
        break;
      }

      case FSM_STATES.SUSPICIOUS: {
        isAnomaly = true;
        if (bandwidth >= CRITICAL_THRESHOLD_MBPS) {
          nextState = FSM_STATES.BLOCKED;
          stateChanged = true;
          reason = `Critical surge (${bandwidth.toFixed(2)} Mbps >= ${CRITICAL_THRESHOLD_MBPS} Mbps) while SUSPICIOUS. Host quarantined.`;
          alert = {
            type: ALERT_TYPES.HOST_BLOCKED,
            severity: ALERT_SEVERITIES.CRITICAL,
            description: reason
          };
        } else if (bandwidth >= HIGH_USAGE_THRESHOLD_MBPS) {
          ctx.suspiciousViolations += 1;
          ctx.consecutiveSafe = 0;
          if (ctx.suspiciousViolations >= BLOCK_VIOLATION_LIMIT) {
            nextState = FSM_STATES.BLOCKED;
            stateChanged = true;
            reason = `Host in SUSPICIOUS state committed ${ctx.suspiciousViolations} repeated violations. Tolerance threshold reached. Host BLOCKED.`;
            alert = {
              type: ALERT_TYPES.HOST_BLOCKED,
              severity: ALERT_SEVERITIES.CRITICAL,
              description: reason
            };
          } else {
            reason = `Abnormal spike while SUSPICIOUS (violation ${ctx.suspiciousViolations}/${BLOCK_VIOLATION_LIMIT}).`;
          }
        } else if (bandwidth < RECOVERY_THRESHOLD_MBPS) {
          ctx.consecutiveSafe += 1;
          if (ctx.consecutiveSafe >= RECOVERY_CONSECUTIVE_REQUIRED) {
            nextState = FSM_STATES.NORMAL;
            stateChanged = true;
            isAnomaly = false;
            ctx.consecutiveAbnormal = 0;
            ctx.consecutiveSafe = 0;
            ctx.suspiciousViolations = 0;
            reason = `Host maintained safe bandwidth (< ${RECOVERY_THRESHOLD_MBPS} Mbps) for ${RECOVERY_CONSECUTIVE_REQUIRED} consecutive records. Restored to NORMAL.`;
            alert = {
              type: ALERT_TYPES.HOST_RECOVERED,
              severity: ALERT_SEVERITIES.INFO,
              description: reason
            };
          } else {
            reason = `Safe traffic observed (${ctx.consecutiveSafe}/${RECOVERY_CONSECUTIVE_REQUIRED} safe cycles needed for recovery).`;
          }
        } else {
          // Moderate traffic in SUSPICIOUS resets consecutive safe counter
          ctx.consecutiveSafe = 0;
          reason = `Traffic (${bandwidth.toFixed(2)} Mbps) remains above recovery threshold (${RECOVERY_THRESHOLD_MBPS} Mbps).`;
        }
        break;
      }

      case FSM_STATES.BLOCKED: {
        isAnomaly = true;
        // Blocked state is terminal until an authorized administrative action reset
        reason = `Host is BLOCKED. Record recorded for forensic audit, but host remains quarantined.`;
        break;
      }

      default: {
        nextState = FSM_STATES.NORMAL;
        stateChanged = true;
        reason = `Unknown state '${currentState}' detected. Reset to NORMAL.`;
        break;
      }
    }

    return {
      previousState: currentState,
      nextState,
      stateChanged,
      reason,
      alert,
      isAnomaly,
      updatedContext: ctx
    };
  }

  /**
   * Authorized administrative reset from BLOCKED to NORMAL
   */
  adminReset(hostId, reason = 'Authorized Administrative Action: Host manually unlocked') {
    return {
      previousState: FSM_STATES.BLOCKED,
      nextState: FSM_STATES.NORMAL,
      stateChanged: true,
      reason,
      alert: {
        type: ALERT_TYPES.HOST_RECOVERED,
        severity: ALERT_SEVERITIES.INFO,
        description: `Admin reset executed for host ${hostId}. State restored to NORMAL.`
      },
      updatedContext: {
        consecutiveAbnormal: 0,
        consecutiveSafe: 0,
        suspiciousViolations: 0
      }
    };
  }

  /**
   * Returns human-readable transition matrix documentation
   */
  getTransitionTable() {
    return [
      { from: FSM_STATES.NORMAL, condition: 'Usage >= 250 Mbps (Critical)', to: FSM_STATES.BLOCKED },
      { from: FSM_STATES.NORMAL, condition: 'Usage >= 100 Mbps (High)', to: FSM_STATES.HIGH_USAGE },
      { from: FSM_STATES.NORMAL, condition: 'Usage < 100 Mbps', to: FSM_STATES.NORMAL },
      { from: FSM_STATES.HIGH_USAGE, condition: 'Usage >= 250 Mbps (Critical)', to: FSM_STATES.BLOCKED },
      { from: FSM_STATES.HIGH_USAGE, condition: 'Usage >= 100 Mbps for 3 consecutive spikes', to: FSM_STATES.SUSPICIOUS },
      { from: FSM_STATES.HIGH_USAGE, condition: 'Usage < 60 Mbps (Recovery)', to: FSM_STATES.NORMAL },
      { from: FSM_STATES.SUSPICIOUS, condition: 'Usage >= 250 Mbps (Critical)', to: FSM_STATES.BLOCKED },
      { from: FSM_STATES.SUSPICIOUS, condition: 'Usage >= 100 Mbps (2 extra violations)', to: FSM_STATES.BLOCKED },
      { from: FSM_STATES.SUSPICIOUS, condition: 'Usage < 60 Mbps for 3 consecutive records', to: FSM_STATES.NORMAL },
      { from: FSM_STATES.BLOCKED, condition: 'Authorized Admin Reset', to: FSM_STATES.NORMAL }
    ];
  }
}

module.exports = HostFSM;
