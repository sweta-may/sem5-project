# Demonstration Walkthrough Script
## Network Bandwidth Usage Monitoring and Threshold Alert System

This script guides presenters, evaluators, and students through a step-by-step demonstration of the full-stack system, emphasizing the application of **Formal Regular Expressions** and **Deterministic Finite-State Machines**.

---

### Step 1: Launch and System Overview
1. Start the application:
   ```powershell
   npm start
   ```
2. Open your browser at `http://localhost:5000` (or `http://localhost:5173` in development mode).
3. Observe the Top Metric Cards:
   - Notice live counts of **Monitored Hosts**, broken down by **Normal**, **High Usage**, **Suspicious**, and **Blocked**.
   - Notice aggregate metrics: **Total Bandwidth** and **Active Alerts**.
4. Point out the Host Monitoring Table:
   - Notice the distinct visual badges for the four FSM states: Emerald (Normal), Amber (High Usage), Orange (Suspicious), and Rose with pulse animation (Blocked).

---

### Step 2: Demonstrating Academic Concept A (Regular Expression Validation)
1. Navigate to the **Regex Sandbox** tab in the top navigation.
2. Review the Master Regular Expression breakdown shown on screen:
   ```regex
   ^(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d),([A-Z0-9_-]{3,16}),(\d+(?:\.\d{1,2})?),(UPLOAD|DOWNLOAD)$
   ```
3. Test a valid record:
   - Click the preset button: `Valid Standard Record`.
   - Click **Validate Only**; observe the green `SYNTACTICALLY VALID` confirmation and parsed field tokens.
4. Test syntax rejection with granular field diagnostics:
   - Click `Invalid Month (13)`: Observe the error indicating the month out of range.
   - Click `Negative Bandwidth`: Observe rejection due to negative sign.
   - Click `Alphabetic Bandwidth`: Observe rejection due to non-numeric characters.
   - Click `Excess Decimal Precision`: Observe rejection due to >2 decimal places.
5. Ingest an invalid record:
   - Click **Submit to Pipeline**.
   - Note the immediate HTTP 400 rejection and scroll down to the **Forensic Log of Rejected Malformed Records** to show that the bad record was securely stored for audit without contaminating host telemetry.

---

### Step 3: Demonstrating Academic Concept B (Finite-State Machine Classification)
1. Navigate to the **FSM Theory & Matrix** tab.
2. Show the formal mathematical definition:
   $$M = (Q, \Sigma, \delta, q_0, F)$$
   Where $Q = \{\text{NORMAL}, \text{HIGH\_USAGE}, \text{SUSPICIOUS}, \text{BLOCKED}\}$ and $q_0 = \text{NORMAL}$.
3. Navigate back to **Traffic Simulator**.
4. Demonstrate State Escalation:
   - Under **One-Click Demonstration Scenarios**, click **Inject DDoS Attack Surge**.
   - Return to the **Dashboard** tab.
   - Observe that hosts experiencing high bandwidth ($\ge 100\text{ Mbps}$) transition from `NORMAL` $\to$ `HIGH_USAGE`.
   - With repeated bursts ($\ge 3$ consecutive spikes), watch hosts escalate into `SUSPICIOUS`.
   - With sustained violations, observe hosts transition into `BLOCKED` (quarantined).
5. Demonstrate Alert Generation:
   - View the **Live Anomaly Alert Feed** on the right side of the dashboard.
   - Show how alerts are dispatched with `WARNING`, `HIGH`, and `CRITICAL` severities matching state changes.
   - Click the checkmark icon on an alert to acknowledge it in real time.

---

### Step 4: Multi-Host State Isolation
1. In the Host Monitoring Table, filter or search for two different hosts (e.g. `HOST001` vs `HOST003`).
2. Show that `HOST003` entering `SUSPICIOUS` or `BLOCKED` does **not** alter `HOST001`'s state.
3. Emphasize to the review committee that each host maintains its own isolated FSM context and counters.

---

### Step 5: Host Detail Telemetry & Historical Trends
1. Click the **Details** button on any host in the monitoring table.
2. The modal drawer opens:
   - **Bandwidth Trend Telemetry:** View the interactive Recharts time-series area chart displaying historical usage, with reference threshold lines at $100\text{ Mbps}$ (High) and $250\text{ Mbps}$ (Critical).
   - Switch to **FSM State Transition Audit Log**: Show the exact timestamped history of previous state $\to$ next state with triggering bandwidth and causal reasons.

---

### Step 6: Demonstrating Recovery & Administrative Intervention
1. Auto-Recovery:
   - In the **Traffic Simulator**, click **Inject Recovery Drill**.
   - Observe hosts in `HIGH_USAGE` or `SUSPICIOUS` receiving safe traffic ($< 60\text{ Mbps}$) automatically recovering to `NORMAL`.
2. Administrative Unlock:
   - Locate any quarantined host in state `BLOCKED`.
   - Click the red **Reset** button in the table or host detail view.
   - Observe the immediate unlock confirmation toast; the host restores to `NORMAL`, all violation counters reset to 0, and an administrative audit record is written.

---

### Step 7: Continuous Live Traffic Generation
1. In the top navbar, click **Live Sim** (or in the Traffic Simulator tab, click **Start Stream**).
2. Adjust the speed slider (e.g., $1000\text{ms}$).
3. Observe live records flowing through the pipeline in real time, updating the dashboard counters and charts smoothly every $2.5\text{ seconds}$.
