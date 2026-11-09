import React, { useState } from 'react';
import { Bell, ShieldAlert, Check, CheckCheck, Filter, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

export default function AlertFeed({ alerts, onAckAlert, isLoading }) {
  const [severityFilter, setSeverityFilter] = useState('');
  const [showUnackOnly, setShowUnackOnly] = useState(false);

  const filteredAlerts = alerts.filter((a) => {
    const matchesSev = !severityFilter || a.severity === severityFilter;
    const matchesAck = !showUnackOnly || !a.acknowledged;
    return matchesSev && matchesAck;
  });

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <AlertOctagon className="w-3 h-3 mr-1" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-orange-500/20 text-orange-300 border border-orange-500/40">
            <AlertTriangle className="w-3 h-3 mr-1" />
            HIGH
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3 h-3 mr-1" />
            WARNING
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Info className="w-3 h-3 mr-1" />
            INFO
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center space-x-2">
          <Bell className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
            Live Anomaly Alert Feed
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
            {alerts.filter(a => !a.acknowledged).length} unacked
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-2 text-[11px] font-mono">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Info</option>
          </select>

          <label className="flex items-center space-x-1 cursor-pointer text-slate-400 hover:text-slate-200">
            <input
              type="checkbox"
              checked={showUnackOnly}
              onChange={(e) => setShowUnackOnly(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
            />
            <span>Unacked</span>
          </label>
        </div>
      </div>

      {/* Alert Items List */}
      <div className="p-3 divide-y divide-slate-800/60 overflow-y-auto max-h-[360px] space-y-2">
        {filteredAlerts.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-slate-500">
            No alerts matching current filter.
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.alertId}
              className={`p-3 rounded-xl border transition-all ${
                alert.acknowledged
                  ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                  : 'bg-slate-900/90 border-slate-700/60 hover:border-slate-600 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center space-x-2">
                  {getSeverityBadge(alert.severity)}
                  <span className="font-mono font-bold text-xs text-slate-200">
                    {alert.hostId}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                  {!alert.acknowledged && (
                    <button
                      onClick={() => onAckAlert(alert.alertId)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Acknowledge Alert"
                    >
                      <Check className="w-3 h-3 text-indigo-400" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                {alert.description}
              </p>

              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Type: {alert.alertType}</span>
                {alert.acknowledged && (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <CheckCheck className="w-3 h-3" />
                    <span>Acknowledged</span>
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
