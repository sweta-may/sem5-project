import React, { useState, useEffect } from 'react';
import { GitBranch, ShieldAlert, CheckCircle2, AlertTriangle, AlertOctagon, ShieldX, ArrowRight, Settings } from 'lucide-react';
import { api } from '../api/client';

export default function FsmDiagramModal() {
  const [fsmData, setFsmData] = useState(null);

  useEffect(() => {
    api.getFsmTable().then((res) => {
      setFsmData(res);
    }).catch(() => {
      // Ignored
    });
  }, []);

  const states = [
    {
      name: 'NORMAL',
      color: 'border-emerald-500 bg-emerald-950/20 text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300',
      icon: CheckCircle2,
      desc: 'Nominal host operations. Bandwidth strictly < 100 Mbps. Initial state for all provisioned endpoints.'
    },
    {
      name: 'HIGH_USAGE',
      color: 'border-amber-500 bg-amber-950/20 text-amber-400',
      badge: 'bg-amber-500/20 text-amber-300',
      icon: AlertTriangle,
      desc: 'Single-event bandwidth spike (>= 100 Mbps). Recovers to NORMAL if usage < 60 Mbps, or escalates if repeated.'
    },
    {
      name: 'SUSPICIOUS',
      color: 'border-orange-500 bg-orange-950/20 text-orange-400',
      badge: 'bg-orange-500/20 text-orange-300',
      icon: AlertOctagon,
      desc: 'Repeated abnormal usage (>= 3 consecutive spikes). Potential attack or data exfiltration pattern.'
    },
    {
      name: 'BLOCKED',
      color: 'border-rose-500 bg-rose-950/20 text-rose-400',
      badge: 'bg-rose-500/20 text-rose-300',
      icon: ShieldX,
      desc: 'Quarantined terminal state reached via critical surge (>= 250 Mbps) or exceeding tolerance in SUSPICIOUS. Requires Admin Reset.'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Mathematical Automata Theory Header */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex items-center space-x-2.5 mb-2">
          <GitBranch className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-bold font-mono text-slate-100">
            Academic Concept B: Finite-State Machine (FSM) Formal Architecture
          </h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4">
          Each host's network classification is governed by an independent deterministic finite automaton:
          <span className="font-mono text-indigo-300 ml-1">M = (Q, &Sigma;, &delta;, q&#8320;, F)</span>.
          State transitions are deterministic, auditable, and traceably persisted with causal telemetry.
        </p>

        {/* State Visual Flow Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-4">
          {states.map((st, i) => {
            const Icon = st.icon;
            return (
              <div
                key={st.name}
                className={`p-4 rounded-xl border ${st.color} transition-all duration-200 backdrop-blur-sm flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${st.badge}`}>
                      State {i + 1}
                    </span>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-mono font-bold text-sm mb-1">{st.name}</h3>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">{st.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* State Transition Matrix Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200 mb-3 flex items-center justify-between">
          <span>Complete State Transition Matrix (&delta;)</span>
          <span className="text-[10px] text-slate-400 font-normal">Deterministic Transition Rules</span>
        </h3>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Current State (s)</th>
                <th className="py-2.5 px-3">Input Trigger / Condition (&sigma;)</th>
                <th className="py-2.5 px-3">Next State (s')</th>
                <th className="py-2.5 px-3">Operational Classification Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-emerald-400">NORMAL</td>
                <td className="py-2.5 px-3 text-amber-300">Usage &ge; 100 Mbps</td>
                <td className="py-2.5 px-3 font-bold text-amber-400">HIGH_USAGE</td>
                <td className="py-2.5 px-3 text-slate-400">Spike crosses high threshold; streak = 1</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-NORMAL text-emerald-400">NORMAL</td>
                <td className="py-2.5 px-3 text-rose-300">Usage &ge; 250 Mbps (Critical)</td>
                <td className="py-2.5 px-3 font-bold text-rose-400">BLOCKED</td>
                <td className="py-2.5 px-3 text-slate-400">Severe traffic surge; immediate isolation</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-amber-400">HIGH_USAGE</td>
                <td className="py-2.5 px-3 text-emerald-300">Usage &lt; 60 Mbps</td>
                <td className="py-2.5 px-3 font-bold text-emerald-400">NORMAL</td>
                <td className="py-2.5 px-3 text-slate-400">Traffic returns below recovery threshold</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-amber-400">HIGH_USAGE</td>
                <td className="py-2.5 px-3 text-orange-300">3 consecutive spikes &ge; 100 Mbps</td>
                <td className="py-2.5 px-3 font-bold text-orange-400">SUSPICIOUS</td>
                <td className="py-2.5 px-3 text-slate-400">Repeated abnormal traffic burst limit met</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-orange-400">SUSPICIOUS</td>
                <td className="py-2.5 px-3 text-rose-300">2 extra violations &ge; 100 Mbps</td>
                <td className="py-2.5 px-3 font-bold text-rose-400">BLOCKED</td>
                <td className="py-2.5 px-3 text-slate-400">Tolerance exhausted; host quarantined</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-orange-400">SUSPICIOUS</td>
                <td className="py-2.5 px-3 text-emerald-300">Safe traffic &lt; 60 Mbps for 3 records</td>
                <td className="py-2.5 px-3 font-bold text-emerald-400">NORMAL</td>
                <td className="py-2.5 px-3 text-slate-400">Stable nominal window completed; restored</td>
              </tr>
              <tr className="hover:bg-slate-800/30">
                <td className="py-2.5 px-3 font-bold text-rose-400">BLOCKED</td>
                <td className="py-2.5 px-3 text-indigo-300">Authorized Admin Reset Action</td>
                <td className="py-2.5 px-3 font-bold text-emerald-400">NORMAL</td>
                <td className="py-2.5 px-3 text-slate-400">Manual administrative unlock and counter reset</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
