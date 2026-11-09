import React from 'react';
import { Activity, ShieldAlert, Cpu, Terminal, RefreshCw, Radio } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, simulationRunning, onToggleSimulation, systemOnline }) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/40 rounded-xl text-indigo-400">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                Bandwidth Monitor & Threshold Alert System
              </h1>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                Formal Language (Regex) & Finite-State Machine (FSM) Engine
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Dashboard & Hosts
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'simulator'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Traffic Simulator
            </button>
            <button
              onClick={() => setActiveTab('regex')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'regex'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Regex Sandbox
            </button>
            <button
              onClick={() => setActiveTab('fsm')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'fsm'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              FSM Theory & Matrix
            </button>
          </nav>

          {/* Status Badges & Quick Controls */}
          <div className="flex items-center space-x-3">
            {/* System Online Badge */}
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800/80 border border-slate-700/60">
              <span className={`w-2 h-2 rounded-full ${systemOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-slate-300 hidden sm:inline">{systemOnline ? 'API Connected' : 'Offline'}</span>
            </div>

            {/* Quick Simulation Toggle Button */}
            <button
              onClick={onToggleSimulation}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-sm ${
                simulationRunning
                  ? 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-500/20'
                  : 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${simulationRunning ? 'animate-spin' : ''}`} />
              <span>{simulationRunning ? 'Stop Sim' : 'Live Sim'}</span>
            </button>
          </div>

        </div>

        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex overflow-x-auto space-x-1 py-2 border-t border-slate-800/60 text-xs font-medium">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              activeTab === 'simulator' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Simulator
          </button>
          <button
            onClick={() => setActiveTab('regex')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              activeTab === 'regex' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            Regex Sandbox
          </button>
          <button
            onClick={() => setActiveTab('fsm')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              activeTab === 'fsm' ? 'bg-indigo-600 text-white' : 'text-slate-400'
            }`}
          >
            FSM Theory
          </button>
        </div>

      </div>
    </header>
  );
}
