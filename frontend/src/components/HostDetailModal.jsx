import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Unlock, ShieldAlert, History, Activity, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { api } from '../api/client';

export default function HostDetailModal({ hostId, onClose, onResetHost }) {
  const [details, setDetails] = useState(null);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('chart');

  const loadHostData = async () => {
    setIsLoading(true);
    try {
      const [hostRes, recordsRes] = await Promise.all([
        api.getHostDetails(hostId),
        api.getRecords({ hostId, limit: 30 })
      ]);
      setDetails(hostRes.data);
      // Reverse records so oldest is first for the time-series chart
      setRecords((recordsRes.data || []).slice().reverse());
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load host telemetry');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (hostId) {
      loadHostData();
    }
  }, [hostId]);

  if (!hostId) return null;

  const host = details?.host;
  const transitions = details?.recentTransitions || [];
  const isBlocked = host?.currentState === 'BLOCKED';

  // Format records for Recharts
  const chartData = records.map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    bandwidth: r.bandwidth,
    direction: r.direction,
    state: r.resultingState,
    isAnomaly: r.isAnomaly
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold font-mono text-slate-100">{hostId}</h2>
                {host && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${
                      host.currentState === 'NORMAL'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : host.currentState === 'HIGH_USAGE'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : host.currentState === 'SUSPICIOUS'
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/40 animate-pulse'
                    }`}
                  >
                    {host.currentState}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono">
                {host?.hostname || 'simulated.endpoint.local'} • Last active:{' '}
                {host ? new Date(host.lastSeenAt).toLocaleTimeString() : '...'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isBlocked && (
              <button
                onClick={() => {
                  onResetHost(hostId);
                  loadHostData();
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Admin Reset</span>
              </button>
            )}

            <button
              onClick={loadHostData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading && !details ? (
            <div className="py-20 text-center font-mono text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
              Loading host telemetry and transition records...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800 text-rose-300 text-xs font-mono">
              {error}
            </div>
          ) : (
            <>
              {/* Host Quick Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-mono">Latest Usage</div>
                  <div className="text-xl font-bold font-mono text-slate-100">
                    {host.lastBandwidthUsage.toFixed(2)} <span className="text-xs font-normal text-slate-400">Mbps</span>
                  </div>
                  <div className="text-[10px] text-indigo-400 font-mono mt-0.5">{host.lastDirection}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-mono">Total Records</div>
                  <div className="text-xl font-bold font-mono text-slate-100">
                    {host.totalRecordsProcessed}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ingested via pipeline</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-mono">Abnormal Events</div>
                  <div className={`text-xl font-bold font-mono ${host.totalAbnormalEvents > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                    {host.totalAbnormalEvents}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Streak: {host.consecutiveAbnormalCount} bursts
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[11px] text-slate-400 font-mono">FSM Transitions</div>
                  <div className="text-xl font-bold font-mono text-slate-100">
                    {transitions.length}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Audited state changes</div>
                </div>
              </div>

              {/* View Switcher Tabs */}
              <div className="flex border-b border-slate-800 space-x-4">
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`pb-2.5 text-xs font-semibold flex items-center space-x-1.5 transition-colors border-b-2 ${
                    activeTab === 'chart'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-4 h-4" />
                  <span>Bandwidth Trend Telemetry</span>
                </button>
                <button
                  onClick={() => setActiveTab('transitions')}
                  className={`pb-2.5 text-xs font-semibold flex items-center space-x-1.5 transition-colors border-b-2 ${
                    activeTab === 'transitions'
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <History className="w-4 h-4" />
                  <span>FSM State Transition Audit Log ({transitions.length})</span>
                </button>
              </div>

              {/* Tab 1: Recharts Interactive Area Chart */}
              {activeTab === 'chart' && (
                <div className="space-y-2">
                  <div className="h-64 w-full bg-slate-950/40 rounded-2xl p-3 border border-slate-800">
                    {chartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
                        No recorded telemetry points for this host yet.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="bandwidthGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={10} tickLine={false} unit="M" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0f172a',
                              borderColor: '#334155',
                              borderRadius: '0.75rem',
                              fontSize: '11px',
                              fontFamily: 'monospace'
                            }}
                          />
                          {/* Visual Reference Lines for FSM Thresholds */}
                          <ReferenceLine
                            y={100}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            label={{ value: 'High Threshold (100 Mbps)', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }}
                          />
                          <ReferenceLine
                            y={250}
                            stroke="#ef4444"
                            strokeDasharray="4 4"
                            label={{ value: 'Critical Threshold (250 Mbps)', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="bandwidth"
                            stroke="#818cf8"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#bandwidthGradient)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
                    <span>Showing last {chartData.length} records</span>
                    <span className="flex items-center space-x-3">
                      <span className="text-amber-400">-- High: 100 Mbps</span>
                      <span className="text-rose-400">-- Critical: 250 Mbps</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 2: State Transition History Audit Trail */}
              {activeTab === 'transitions' && (
                <div className="border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">State Transition</th>
                        <th className="py-2.5 px-3">Trigger Usage</th>
                        <th className="py-2.5 px-3">Causal Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {transitions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No state transitions recorded yet for {hostId}.
                          </td>
                        </tr>
                      ) : (
                        transitions.map((tr) => (
                          <tr key={tr.transitionId} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {new Date(tr.timestamp).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-slate-400">{tr.previousState}</span>
                              <span className="text-indigo-400 mx-1.5">&rarr;</span>
                              <span className="font-bold text-slate-100">{tr.nextState}</span>
                            </td>
                            <td className="py-2.5 px-3 text-indigo-300">
                              {tr.triggeringBandwidth.toFixed(2)} Mbps
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {tr.triggeringReason}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
