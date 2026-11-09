import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import HostMonitoringTable from './components/HostMonitoringTable';
import HostDetailModal from './components/HostDetailModal';
import AlertFeed from './components/AlertFeed';
import SimulationControls from './components/SimulationControls';
import RegexSandbox from './components/RegexSandbox';
import FsmDiagramModal from './components/FsmDiagramModal';
import { api } from './api/client';
import { Activity, ShieldCheck, RefreshCw } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [systemOnline, setSystemOnline] = useState(true);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [simulationStatus, setSimulationStatus] = useState(null);
  const [selectedHostId, setSelectedHostId] = useState(null);
  const [activeStateFilter, setActiveStateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Poll dashboard metrics, hosts, alerts, and simulation state
  const refreshAllData = async () => {
    try {
      const [statsRes, hostsRes, alertsRes, simRes] = await Promise.all([
        api.getDashboardStats(),
        api.getHosts(),
        api.getAlerts({ limit: 40 }),
        api.getSimulationStatus()
      ]);

      setDashboardStats(statsRes.data);
      setHosts(hostsRes.data || []);
      setAlerts(alertsRes.data || []);
      setSimulationStatus(simRes.data);
      setSystemOnline(true);
    } catch (err) {
      console.warn('[Telemetry Poll Warning]', err.message);
      setSystemOnline(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
    // Live update interval: 2500ms
    const interval = setInterval(refreshAllData, 2500);
    return () => clearInterval(interval);
  }, []);

  // Administrative Reset of a Blocked Host
  const handleResetHost = async (hostId) => {
    try {
      const res = await api.resetHost(hostId);
      showToast(`Host ${hostId} successfully reset to NORMAL!`, 'success');
      refreshAllData();
    } catch (err) {
      showToast(`Reset failed: ${err.message}`, 'error');
    }
  };

  // Acknowledge Alert
  const handleAckAlert = async (alertId) => {
    try {
      await api.ackAlert(alertId);
      refreshAllData();
    } catch (err) {
      console.error(err);
    }
  };

  // Simulation Controls Handlers
  const handleStartSimulation = async (intervalMs, mode) => {
    try {
      await api.startSimulation(intervalMs, mode);
      refreshAllData();
      showToast('Live traffic stream started!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleStopSimulation = async () => {
    try {
      await api.stopSimulation();
      refreshAllData();
      showToast('Live traffic stream stopped.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleToggleSimulation = () => {
    if (simulationStatus?.isRunning) {
      handleStopSimulation();
    } else {
      handleStartSimulation(simulationStatus?.intervalMs || 2000, simulationStatus?.mode || 'BALANCED');
    }
  };

  const handleTickSimulation = async () => {
    try {
      const res = await api.tickSimulation();
      refreshAllData();
      showToast(`Simulated event for ${res.data?.hostId || 'record'} processed!`, 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleConfigSimulation = async (intervalMs, mode) => {
    try {
      await api.configSimulation(intervalMs, mode);
      refreshAllData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleInjectScenario = async (scenario, count) => {
    try {
      const res = await api.injectScenario(scenario, count);
      refreshAllData();
      showToast(`Scenario '${scenario}' injected successfully!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddHost = async (hostData) => {
    try {
      await api.addSimulatedHost(hostData);
      refreshAllData();
      showToast(`Host ${hostData.hostId} added to simulation fleet!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-mono flex items-center space-x-2 backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : toastMessage.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{toastMessage.message}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        simulationRunning={simulationStatus?.isRunning || false}
        onToggleSimulation={handleToggleSimulation}
        systemOnline={systemOnline}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        
        {/* Tab 1: Primary Monitoring Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Top Metric Cards */}
            <StatsCards
              stats={dashboardStats}
              activeStateFilter={activeStateFilter}
              onSelectStateFilter={(state) => {
                setActiveStateFilter(state === activeStateFilter ? '' : state);
              }}
            />

            {/* Split Grid: Host Table & Live Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Host Table (Takes 2 Columns on LG screens) */}
              <div className="lg:col-span-2">
                <HostMonitoringTable
                  hosts={hosts}
                  onSelectHost={setSelectedHostId}
                  onResetHost={handleResetHost}
                  activeStateFilter={activeStateFilter}
                  setActiveStateFilter={setActiveStateFilter}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  isLoading={isLoading}
                />
              </div>

              {/* Alert Feed (Takes 1 Column) */}
              <div className="lg:col-span-1">
                <AlertFeed
                  alerts={alerts}
                  onAckAlert={handleAckAlert}
                  isLoading={isLoading}
                />
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Traffic Simulator Controls */}
        {activeTab === 'simulator' && (
          <SimulationControls
            simulationStatus={simulationStatus}
            onStart={handleStartSimulation}
            onStop={handleStopSimulation}
            onTick={handleTickSimulation}
            onConfig={handleConfigSimulation}
            onInject={handleInjectScenario}
            onAddHost={handleAddHost}
          />
        )}

        {/* Tab 3: Regex Validation Sandbox */}
        {activeTab === 'regex' && <RegexSandbox />}

        {/* Tab 4: FSM Theory & State Transition Matrix */}
        {activeTab === 'fsm' && <FsmDiagramModal />}

      </main>

      {/* Host Detail & Telemetry Modal */}
      {selectedHostId && (
        <HostDetailModal
          hostId={selectedHostId}
          onClose={() => setSelectedHostId(null)}
          onResetHost={handleResetHost}
        />
      )}

      {/* Global Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
        Network Bandwidth Usage Monitoring & Threshold Alert System • Academic Full-Stack Prototype
      </footer>

    </div>
  );
}
