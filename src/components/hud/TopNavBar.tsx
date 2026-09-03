import React from 'react';
import {
  Play,
  Square,
  FileCode2,
  Download,
  ShieldCheck,
  DollarSign,
  Layers,
  Clock,
  ChevronDown,
  Award,
  Zap,
  ShieldAlert,
  LayoutGrid,
  History,
  Sun,
  Moon,
  Laptop,
  RotateCcw,
} from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { Button } from '../common/Button';
import { themeManager, ThemeMode, ResolvedTheme } from '../../core/theme/ThemeManager';

export const TopNavBar: React.FC = () => {
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(themeManager.getMode());
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(themeManager.getResolvedTheme());

  React.useEffect(() => {
    return themeManager.subscribe((resolved, mode) => {
      setResolvedTheme(resolved);
      setThemeMode(mode);
    });
  }, []);
  const {
    isSimulating,
    simulationProgress,
    runSwarmDemo,
    stopSwarmDemo,
    setIsHclEditorOpen,
    isHclEditorOpen,
    setIsExportModalOpen,
    setIsCostModalOpen,
    setIsSecurityModalOpen,
    isHclDirty,
    stepDelayMs,
    setStepDelayMs,
    auditReport,
    topologyState,
    isTourOpen,
    setIsTourOpen,
    isChaosActive,
    triggerChaosScenario,
    isThreatSimActive,
    triggerThreatScenario,
    applyAutoLayoutToCanvas,
    resetTopology,
  } = useCloudSwarmStore();

  const totalCost = auditReport.totalMonthlyCostUsd ?? 0;
  const cisScore = auditReport.securityScore ?? 100;

  return (
    <header
      className="flex h-13 w-full items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-[#090A0C]/95 px-4 backdrop-blur-xl z-40 select-none text-zinc-800 dark:text-zinc-300 transition-colors duration-200 shadow-xs"
      data-testid="top-navbar"
    >
      {/* Brand & Status Indicator */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700/70 text-zinc-100 font-bold text-xs shadow-sm">
          CS
        </div>
        <div className="flex items-center space-x-2">
          <h1 className="text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-sans">
            CloudSwarm
          </h1>
          <span className="text-zinc-400 dark:text-zinc-600 font-mono text-xs">/</span>
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">Studio Mesh</span>
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-700 dark:text-zinc-400 font-mono">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isSimulating ? 'bg-sky-500 dark:bg-sky-400' : 'bg-emerald-500 dark:bg-emerald-400'
              }`}
            />
            <span className="font-semibold">{isSimulating ? `Synthesizing (${simulationProgress}%)` : 'Ready'}</span>
          </div>
        </div>
      </div>

      {/* Execution Controls: Swarm Orchestration & Clear */}
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1.5 bg-zinc-100 dark:bg-zinc-900/90 rounded-lg p-1 border border-zinc-200 dark:border-zinc-800 shadow-xs">

          {/* Reset / Clear Canvas Button */}
          <button
            onClick={() => {
              resetTopology();
              fetch('/api/webmcp/clear').catch(() => {});
              fetch('/api/webmcp/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nodes: {}, edges: {}, version: 0 }),
              }).catch(() => {});
            }}
            data-testid="clear-canvas-btn"
            title="Reset to Fresh Empty Canvas"
            className="flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Clear Canvas</span>
          </button>
        </div>

        {/* Separator */}
        <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

        {/* Showcase Feature Buttons */}
        <div className="flex items-center space-x-1">
          {/* VIP Guided Tour Button */}
          <button
            onClick={() => setIsTourOpen(!isTourOpen)}
            data-testid="vip-tour-btn"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
              isTourOpen
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-400 dark:border-zinc-600 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <Award className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span>Tour</span>
          </button>

          {/* Chaos Monkey Outage Simulator */}
          <button
            onClick={() => triggerChaosScenario()}
            disabled={isChaosActive || isSimulating}
            data-testid="chaos-monkey-btn"
            title="Inject simulated Multi-AZ outage and watch 4 agents autonomously self-heal"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border disabled:opacity-50 disabled:cursor-not-allowed ${
              isChaosActive
                ? 'bg-zinc-200 dark:bg-zinc-800 text-rose-600 dark:text-rose-200 border-rose-400 dark:border-rose-500/50 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-rose-400/40 hover:text-rose-600 dark:hover:text-rose-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isChaosActive ? 'bg-rose-500 dark:bg-rose-400' : 'bg-rose-500/80 dark:bg-rose-400/80'}`} />
            <span>{isChaosActive ? 'Healing...' : 'Chaos'}</span>
          </button>

          {/* Red-Team Threat Simulator */}
          <button
            onClick={() => triggerThreatScenario()}
            disabled={isThreatSimActive || isSimulating}
            data-testid="threat-sim-btn"
            title="Simulate external adversary intrusion and watch Agent Beta deploy Zero-Trust shield"
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border disabled:opacity-50 disabled:cursor-not-allowed ${
              isThreatSimActive
                ? 'bg-zinc-200 dark:bg-zinc-800 text-amber-700 dark:text-amber-200 border-amber-400 dark:border-amber-500/50 shadow-xs'
                : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-amber-400/40 hover:text-amber-700 dark:hover:text-amber-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isThreatSimActive ? 'bg-amber-500 dark:bg-amber-400' : 'bg-amber-500/80 dark:bg-amber-400/80'}`} />
            <span>{isThreatSimActive ? 'Defending...' : 'Threat'}</span>
          </button>

          {/* Hierarchical Auto-Layout Button */}
          <button
            onClick={() => applyAutoLayoutToCanvas()}
            data-testid="auto-layout-btn"
            title="Auto-organize architecture topology into clean tiered layers"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border bg-zinc-100 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <LayoutGrid className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span>Layout</span>
          </button>

          {/* Time Travel / Decision DAG Showcase Button */}
          <button
            onClick={() => {
              const el = document.querySelector('[data-testid="dag-timeline-bar"]');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
                el.classList.add('border-zinc-600');
                setTimeout(() => el.classList.remove('border-zinc-600'), 2000);
              }
            }}
            data-testid="time-travel-nav-btn"
            title="Inspect Git-style Time Travel Decision DAG & Timeline Scrubbing (Press T)"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border bg-zinc-100 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <History className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span>Time Travel</span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-zinc-600 dark:text-zinc-400">T</span>
          </button>
        </div>
      </div>

      {/* Metrics Tickers & Production Actions */}
      <div className="flex items-center space-x-1.5 shrink-0">
        {/* Cost Pill */}
        <button
          onClick={() => setIsCostModalOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors text-xs font-mono"
          title="Open Cost & Budget Breakdown"
          data-testid="hud-cost-ticker"
        >
          <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          <span className="text-zinc-900 dark:text-zinc-100 font-semibold">${totalCost.toFixed(2)}</span>
          <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">/mo</span>
        </button>

        {/* Security Pill */}
        <button
          onClick={() => setIsSecurityModalOpen(true)}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors text-xs font-mono"
          title="Open Security & CIS Posture"
          data-testid="hud-auditor-badge"
        >
          <ShieldCheck className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
          <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{cisScore}/100</span>
          <span className={`text-[10px] ${cisScore >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            ({cisScore >= 90 ? 'A+' : 'F'})
          </span>
        </button>

        <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-0.5" />

        {/* Live Terraform HCL Toggle */}
        <button
          onClick={() => setIsHclEditorOpen(!isHclEditorOpen)}
          data-testid="hcl-toggle-btn"
          title="Toggle Terraform HCL Editor"
          className={`flex items-center space-x-1.5 p-1.5 rounded-lg border transition-colors ${
            isHclEditorOpen
              ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-400 dark:border-zinc-600'
              : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <FileCode2 className="h-3.5 w-3.5" />
          {isHclDirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
        </button>

        {/* 1-Click Production Export */}
        <button
          onClick={() => setIsExportModalOpen(true)}
          data-testid="export-modal-btn"
          title="Export Infrastructure Bundle"
          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </button>

        {/* Dynamic Light/Dark/System Device Theme Toggle */}
        <button
          onClick={() => themeManager.cycleMode()}
          data-testid="theme-toggle-btn"
          className="flex items-center space-x-1 p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all cursor-pointer shadow-sm"
          title={`Theme: ${themeMode === 'system' ? `System Default (${resolvedTheme})` : themeMode === 'light' ? 'Light Mode' : 'Dark Mode'} [Click to cycle]`}
        >
          {themeMode === 'system' ? (
            <div className="flex items-center space-x-1">
              <Laptop className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="text-[9px] font-mono uppercase font-bold text-zinc-500 dark:text-zinc-400">Auto</span>
            </div>
          ) : themeMode === 'light' ? (
            <Sun className="h-3.5 w-3.5 text-amber-500" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
          )}
        </button>
      </div>
    </header>
  );
};
