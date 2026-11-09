import React, { useState } from 'react';
import { Play, Square, FastForward, Radio, ShieldAlert, Cpu, Plus, Sparkles, RefreshCw, Zap } from 'lucide-react';

export default function SimulationControls({ simulationStatus, onStart, onStop, onTick, onConfig, onInject, onAddHost }) {
  const [newHostId, setNewHostId] = useState('');
  const [newHostRole, setNewHostRole] = useState('');
  const [isInjecting, setIsInjecting] = useState(false);

  const isRunning = simulationStatus?.isRunning || false;
  const currentMode = simulationStatus?.mode || 'BALANCED';
  const currentInterval = simulationStatus?.intervalMs || 2000;
  const stats = simulationStatus?.stats || { totalGenerated: 0, totalValid: 0, totalInvalid: 0 };

  const modes = [
    { id: 'BALANCED', label: 'Balanced Fleet', desc: 'Real-world nominal & occasional spikes' },
    { id: 'ATTACK_SURGE', label: 'Attack Surge', desc: 'Forces HIGH_USAGE & BLOCKED states' },
    { id: 'RECOVERY', label: 'Recovery Drill', desc: 'Safe bandwidth restoring to NORMAL' },
    { id: 'MALFORMED_FUZZER', label: 'Malformed Fuzzer', desc: 'Fuzzes Regex validator with syntax errors' },
    { id: 'RANDOM', label: 'Stochastic Mix', desc: 'Randomized traffic across all profiles' }
  ];

  const handleAddHostSubmit = (e) => {
    e.preventDefault();
    if (!newHostId.trim()) return;
    onAddHost({
      hostId: newHostId.trim().toUpperCase(),
      role: newHostRole.trim() || 'Custom Host',
      behavior: 'mostly_normal'
    });
    setNewHostId('');
    setNewHostRole('');
  };

  const handleInjectScenario = async (scenario) => {
    setIsInjecting(true);
    try {
      await onInject(scenario, 5);
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Simulation Command Center */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-slate-100 font-mono">
                Real-Time Traffic Simulator Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Every simulated record is formatted into canonical CSV and passes through the full Regex Validator and FSM Engine.
            </p>
          </div>

          {/* Primary Controls */}
          <div className="flex items-center space-x-2.5">
            {isRunning ? (
              <button
                onClick={onStop}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Stop Stream</span>
              </button>
            ) : (
              <button
                onClick={() => onStart(currentInterval, currentMode)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Stream</span>
              </button>
            )}

            <button
              onClick={onTick}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 transition-all"
              title="Generate single record and evaluate through pipeline"
            >
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Manual Tick</span>
            </button>
          </div>
        </div>

        {/* Telemetry Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-400">Stream Status</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span className="font-mono font-bold text-sm text-slate-100">
                {isRunning ? 'ACTIVE GENERATION' : 'IDLE / STOPPED'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-400">Interval Speed</span>
            <div className="font-mono font-bold text-sm text-indigo-300 mt-1">
              {currentInterval}ms <span className="text-xs text-slate-400 font-normal">({(1000 / currentInterval).toFixed(1)} rec/s)</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-400">Valid Pipeline Ingested</span>
            <div className="font-mono font-bold text-sm text-emerald-400 mt-1">
              {stats.totalValid} records
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="text-[10px] font-mono uppercase text-slate-400">Regex Fuzzer Rejected</span>
            <div className="font-mono font-bold text-sm text-rose-400 mt-1">
              {stats.totalInvalid} rejected
            </div>
          </div>
        </div>

        {/* Speed Adjustment Buttons */}
        <div className="mb-6">
          <label className="text-xs font-mono font-bold uppercase text-slate-400 mb-2 block">
            Stream Speed / Frequency:
          </label>
          <div className="flex flex-wrap gap-2">
            {[500, 1000, 2000, 3000, 5000].map((ms) => (
              <button
                key={ms}
                onClick={() => onConfig(ms, currentMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all ${
                  currentInterval === ms
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                {ms}ms {ms === 500 ? '(Fast)' : ms === 2000 ? '(Default)' : ms === 5000 ? '(Slow)' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Mode Selector */}
        <div className="mb-6">
          <label className="text-xs font-mono font-bold uppercase text-slate-400 mb-2 block">
            Select Traffic Generation Profile:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => onConfig(currentInterval, m.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  currentMode === m.id
                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-bold font-mono text-slate-100 flex items-center justify-between">
                  <span>{m.label}</span>
                  {currentMode === m.id && <span className="text-[10px] text-indigo-400">ACTIVE</span>}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Scenario Injectors */}
        <div>
          <label className="text-xs font-mono font-bold uppercase text-slate-400 mb-2 block">
            One-Click Demonstration Scenarios (Inject 5 Records):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => handleInjectScenario('ddos_burst')}
              disabled={isInjecting}
              className="p-3 rounded-xl border border-rose-900/60 bg-rose-950/20 hover:bg-rose-900/30 text-rose-300 text-left transition-all group"
            >
              <div className="flex items-center space-x-1.5 font-bold font-mono text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                <span>Inject DDoS Attack Surge</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Fires 5 high bursts (&ge;120 Mbps) to trigger SUSPICIOUS and BLOCKED states.
              </div>
            </button>

            <button
              onClick={() => handleInjectScenario('recovery_drill')}
              disabled={isInjecting}
              className="p-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-300 text-left transition-all group"
            >
              <div className="flex items-center space-x-1.5 font-bold font-mono text-xs">
                <Sparkles className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Inject Recovery Drill</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Fires 5 safe bandwidth records (&lt;60 Mbps) restoring hosts back to NORMAL.
              </div>
            </button>

            <button
              onClick={() => handleInjectScenario('malformed_test')}
              disabled={isInjecting}
              className="p-3 rounded-xl border border-purple-900/60 bg-purple-950/20 hover:bg-purple-900/30 text-purple-300 text-left transition-all group"
            >
              <div className="flex items-center space-x-1.5 font-bold font-mono text-xs">
                <Radio className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                <span>Inject Malformed Fuzzer</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Fires 5 syntactically illegal records to demonstrate Regex rejection logs.
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Provision Simulated Host Form */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200 mb-3">
          Provision Additional Simulated Host
        </h3>
        <form onSubmit={handleAddHostSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Host Identifier (e.g. SRV-NODE-07)"
            value={newHostId}
            onChange={(e) => setNewHostId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Role Description (e.g. Primary Edge Gateway)"
            value={newHostRole}
            onChange={(e) => setNewHostRole(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Host</span>
          </button>
        </form>
      </div>

    </div>
  );
}
