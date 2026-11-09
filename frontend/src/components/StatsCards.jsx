import React from 'react';
import { Server, CheckCircle2, AlertTriangle, AlertOctagon, ShieldX, HardDrive, Bell } from 'lucide-react';

export default function StatsCards({ stats, onSelectStateFilter, activeStateFilter }) {
  const hosts = stats?.hosts || { total: 0, normal: 0, highUsage: 0, suspicious: 0, blocked: 0 };
  const bandwidth = stats?.bandwidth || { totalBandwidthMbps: 0, totalRecordsProcessed: 0 };
  const alerts = stats?.alerts || { recent: [], unacknowledgedCount: 0 };

  const cards = [
    {
      id: 'TOTAL',
      label: 'Monitored Hosts',
      value: hosts.total,
      subtitle: `${bandwidth.totalRecordsProcessed} total records processed`,
      icon: Server,
      color: 'text-slate-100',
      bgColor: 'bg-slate-900/80',
      borderColor: activeStateFilter === '' ? 'border-indigo-500/80 shadow-md shadow-indigo-500/10' : 'border-slate-800',
      filterValue: ''
    },
    {
      id: 'NORMAL',
      label: 'Normal Hosts',
      value: hosts.normal,
      subtitle: 'Usage < 100 Mbps',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/20',
      borderColor: activeStateFilter === 'NORMAL' ? 'border-emerald-500 ring-1 ring-emerald-500/40' : 'border-emerald-900/40 hover:border-emerald-700/60',
      filterValue: 'NORMAL'
    },
    {
      id: 'HIGH_USAGE',
      label: 'High Usage',
      value: hosts.highUsage,
      subtitle: 'Usage >= 100 Mbps',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/20',
      borderColor: activeStateFilter === 'HIGH_USAGE' ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-amber-900/40 hover:border-amber-700/60',
      filterValue: 'HIGH_USAGE'
    },
    {
      id: 'SUSPICIOUS',
      label: 'Suspicious',
      value: hosts.suspicious,
      subtitle: '>= 3 bursts / abnormal',
      icon: AlertOctagon,
      color: 'text-orange-400',
      bgColor: 'bg-orange-950/20',
      borderColor: activeStateFilter === 'SUSPICIOUS' ? 'border-orange-500 ring-1 ring-orange-500/40' : 'border-orange-900/40 hover:border-orange-700/60',
      filterValue: 'SUSPICIOUS'
    },
    {
      id: 'BLOCKED',
      label: 'Blocked (Quarantine)',
      value: hosts.blocked,
      subtitle: 'Persistent or critical spike',
      icon: ShieldX,
      color: 'text-rose-400',
      bgColor: 'bg-rose-950/20',
      borderColor: activeStateFilter === 'BLOCKED' ? 'border-rose-500 ring-1 ring-rose-500/40' : 'border-rose-900/40 hover:border-rose-700/60',
      filterValue: 'BLOCKED'
    },
    {
      id: 'BANDWIDTH',
      label: 'Total Bandwidth',
      value: `${bandwidth.totalBandwidthMbps >= 1000 ? (bandwidth.totalBandwidthMbps / 1000).toFixed(2) + ' Gbps' : bandwidth.totalBandwidthMbps.toFixed(1) + ' Mbps'}`,
      subtitle: 'Aggregate network payload',
      icon: HardDrive,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-950/20',
      borderColor: 'border-cyan-900/40',
      filterValue: null
    },
    {
      id: 'ALERTS',
      label: 'Active Alerts',
      value: alerts.unacknowledgedCount,
      subtitle: `${alerts.recent.length} recent anomaly logs`,
      icon: Bell,
      color: 'text-purple-400',
      bgColor: 'bg-purple-950/20',
      borderColor: 'border-purple-900/40',
      filterValue: null
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isClickable = card.filterValue !== null;

        return (
          <div
            key={card.id}
            onClick={() => isClickable && onSelectStateFilter(card.filterValue)}
            className={`p-3.5 rounded-2xl border transition-all duration-200 backdrop-blur-sm ${card.bgColor} ${card.borderColor} ${
              isClickable ? 'cursor-pointer hover:scale-[1.02]' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider truncate">
                {card.label}
              </span>
              <Icon className={`w-4 h-4 ${card.color} shrink-0`} />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-slate-100">
              {card.value}
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </div>
  );
}
