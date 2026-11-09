import React, { useState } from 'react';
import { Search, Filter, ArrowUpDown, ArrowUpRight, ArrowDownRight, Unlock, Eye, AlertCircle, RefreshCw } from 'lucide-react';

export default function HostMonitoringTable({ hosts, onSelectHost, onResetHost, activeStateFilter, setActiveStateFilter, searchQuery, setSearchQuery, isLoading }) {
  const [sortField, setSortField] = useState('lastSeenAt');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredHosts = hosts
    .filter((h) => {
      const matchesState = !activeStateFilter || h.currentState === activeStateFilter;
      const matchesSearch =
        !searchQuery ||
        h.hostId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.hostname && h.hostname.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesState && matchesSearch;
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'lastSeenAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  const getStateBadge = (state) => {
    switch (state) {
      case 'NORMAL':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />
            NORMAL
          </span>
        );
      case 'HIGH_USAGE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5" />
            HIGH USAGE
          </span>
        );
      case 'SUSPICIOUS':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mr-1.5" />
            SUSPICIOUS
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/40 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5" />
            BLOCKED
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{state}</span>;
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
      
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Host ID / Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
            />
          </div>

          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* State Filter Buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveStateFilter('')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              !activeStateFilter ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            All ({hosts.length})
          </button>
          <button
            onClick={() => setActiveStateFilter('NORMAL')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeStateFilter === 'NORMAL' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setActiveStateFilter('HIGH_USAGE')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeStateFilter === 'HIGH_USAGE' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            High Usage
          </button>
          <button
            onClick={() => setActiveStateFilter('SUSPICIOUS')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeStateFilter === 'SUSPICIOUS' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            Suspicious
          </button>
          <button
            onClick={() => setActiveStateFilter('BLOCKED')}
            className={`px-2.5 py-1 rounded-lg transition-all ${
              activeStateFilter === 'BLOCKED' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            Blocked
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th
                onClick={() => handleSort('hostId')}
                className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Host Identifier</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('lastBandwidthUsage')}
                className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Latest Usage</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4">FSM State</th>
              <th
                onClick={() => handleSort('totalAbnormalEvents')}
                className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Abnormal Events</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('lastSeenAt')}
                className="py-3 px-4 cursor-pointer hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>Last Seen</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading && hosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading monitored hosts...
                </td>
              </tr>
            ) : filteredHosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-mono">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                  No hosts matching current filter criteria.
                </td>
              </tr>
            ) : (
              filteredHosts.map((host) => {
                const isBlocked = host.currentState === 'BLOCKED';
                const formattedTime = new Date(host.lastSeenAt).toLocaleTimeString();

                return (
                  <tr
                    key={host.hostId}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isBlocked ? 'bg-rose-950/10' : ''
                    }`}
                  >
                    {/* Host ID & Hostname */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-100 flex items-center space-x-2">
                        <span>{host.hostId}</span>
                        {isBlocked && (
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                        {host.hostname || 'simulated.endpoint.local'}
                      </div>
                    </td>

                    {/* Bandwidth Usage */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1.5 font-mono">
                        {host.lastDirection === 'UPLOAD' ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
                        ) : host.lastDirection === 'DOWNLOAD' ? (
                          <ArrowDownRight className="w-3.5 h-3.5 text-cyan-400" />
                        ) : null}
                        <span className="font-semibold text-slate-100 text-sm">
                          {host.lastBandwidthUsage.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-slate-400">Mbps</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase">
                        {host.lastDirection}
                      </div>
                    </td>

                    {/* FSM State Badge */}
                    <td className="py-3 px-4">
                      {getStateBadge(host.currentState)}
                    </td>

                    {/* Abnormal Counters */}
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-semibold ${
                            host.totalAbnormalEvents > 0 ? 'text-amber-400' : 'text-slate-400'
                          }`}
                        >
                          {host.totalAbnormalEvents}
                        </span>
                        {host.consecutiveAbnormalCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            {host.consecutiveAbnormalCount} streak
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {host.totalRecordsProcessed} records
                      </div>
                    </td>

                    {/* Last Seen */}
                    <td className="py-3 px-4 font-mono text-slate-400">
                      <div>{formattedTime}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(host.lastSeenAt).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => onSelectHost(host.hostId)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                        title="View Host Details & History"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="hidden sm:inline">Details</span>
                      </button>

                      {isBlocked && (
                        <button
                          onClick={() => onResetHost(host.hostId)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/30 transition-colors"
                          title="Authorized Admin Action: Reset Blocked Host"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Summary */}
      <div className="px-4 py-2.5 bg-slate-950/40 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
        <div>
          Showing {filteredHosts.length} of {hosts.length} monitored hosts
        </div>
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Normal: &lt;100 Mbps</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>High: &ge;100 Mbps</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Critical: &ge;250 Mbps</span>
          </span>
        </div>
      </div>

    </div>
  );
}
