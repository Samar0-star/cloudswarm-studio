import React, { useState } from 'react';
import {
  Terminal,
  FileDiff,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Cpu,
  Trash2,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { TerminalStream } from './TerminalStream';
import { JsonDiffInspector } from './JsonDiffInspector';
import { AGENT_PERSONAS, type AgentId } from '../../types/swarm';
import { clsx } from 'clsx';

export const TriTerminalDrawer: React.FC = () => {
  const {
    isDrawerOpen,
    setIsDrawerOpen,
    drawerHeight,
    setDrawerHeight,
    activeHudTab,
    setActiveHudTab,
    executionLogs,
    auditReport,
    autoRemediateSecurity,
    applyFinOpsOptimization,
  } = useCloudSwarmStore();

  const [filterAgent, setFilterAgent] = useState<AgentId | 'all'>('all');

  const handleDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = drawerHeight;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      setDrawerHeight(Math.max(100, Math.min(800, startHeight + deltaY)));
    };
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'row-resize';
  };

  if (!isDrawerOpen) {
    return (
      <div className="flex h-8 items-center justify-between border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#090A0C]/95 px-4 select-none transition-colors duration-200 shadow-xs">
        <div className="flex items-center space-x-2 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
          <Terminal className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-zinc-900 dark:text-zinc-100 font-semibold">Tri-Terminal Swarm HUD</span>
          <span className="text-[10px] text-zinc-500">({executionLogs.length} logs)</span>
        </div>
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="flex items-center space-x-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Open Swarm HUD Drawer"
        >
          <span>Expand</span>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ height: `${drawerHeight}px` }}
      className="flex flex-col w-full border-t border-zinc-200 dark:border-zinc-800 bg-white/98 dark:bg-[#090A0C]/98 backdrop-blur-xl shadow-2xl z-30 select-none relative transition-colors duration-200 text-zinc-800 dark:text-zinc-200"
      data-testid="tri-terminal-drawer"
    >
      <div 
        className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-indigo-500/50 transition-colors z-40" 
        onMouseDown={handleDrag}
      />
      {/* Drawer Tab Header Bar */}
      <div className="flex h-9 items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4">
        {/* Left: Tab Switchers */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveHudTab('terminal')}
            className={clsx(
              'flex items-center space-x-1.5 px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer',
              activeHudTab === 'terminal'
                ? 'bg-zinc-800 text-zinc-100 font-medium border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            )}
            data-testid="tab-terminal"
          >
            <Terminal className="h-3.5 w-3.5 text-zinc-400" />
            <span>Execution Streams</span>
            <span className="text-[10px] opacity-75">({executionLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveHudTab('diff')}
            className={clsx(
              'flex items-center space-x-1.5 px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer',
              activeHudTab === 'diff'
                ? 'bg-zinc-800 text-zinc-100 font-medium border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            )}
            data-testid="tab-diff"
          >
            <FileDiff className="h-3.5 w-3.5 text-zinc-400" />
            <span>RFC 6902 JSON Diff</span>
          </button>

          <button
            onClick={() => setActiveHudTab('auditor')}
            className={clsx(
              'flex items-center space-x-1.5 px-3 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer',
              activeHudTab === 'auditor'
                ? 'bg-zinc-800 text-zinc-100 font-medium border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            )}
            data-testid="tab-auditor"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
            <span>Sentinel Matrix</span>
            {auditReport.findings.length > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
            )}
          </button>
        </div>

        {/* Right: Controls & Channel Filters */}
        <div className="flex items-center space-x-3">
          {activeHudTab === 'terminal' && (
            <div className="flex items-center space-x-1 text-[11px] font-mono bg-[#0F1011] p-0.5 rounded-md border border-white/[0.07]">
              <button
                onClick={() => setFilterAgent('all')}
                className={clsx(
                  'px-2 py-0.5 rounded transition-colors cursor-pointer',
                  filterAgent === 'all'
                    ? 'bg-[#1E2026] text-[#F7F8F8] font-semibold'
                    : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                )}
              >
                All
              </button>
              {(['alpha', 'beta', 'gamma', 'delta'] as const).map((agentId) => {
                const persona = AGENT_PERSONAS[agentId];
                return (
                  <button
                    key={agentId}
                    onClick={() => setFilterAgent(agentId)}
                    className={clsx(
                      'px-2 py-0.5 rounded transition-colors cursor-pointer',
                      filterAgent === agentId
                        ? 'bg-[#1E2026] font-semibold'
                        : 'text-[#8A8F98] hover:text-[#F7F8F8]'
                    )}
                    style={{ color: filterAgent === agentId ? persona.hexCode : undefined }}
                  >
                    {persona.glyph} {persona.name.split(' ')[1]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Collapse Button */}
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-1 text-[#8A8F98] hover:text-[#F7F8F8] rounded hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Collapse Drawer"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Drawer Content Body */}
      <div className="flex-1 overflow-hidden">
        {activeHudTab === 'terminal' && (
          <TerminalStream logs={executionLogs} filterAgent={filterAgent} />
        )}

        {activeHudTab === 'diff' && <JsonDiffInspector />}

        {activeHudTab === 'auditor' && (
          <div
            className="flex h-full w-full divide-x divide-slate-800/80 overflow-y-auto font-sans"
            data-testid="auditor-matrix"
          >
            {/* Column 1: Security Findings */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <span>CIS Benchmark & OWASP Findings ({auditReport.findings.length})</span>
                </h4>
                {auditReport.findings.length > 0 && (
                  <button
                    onClick={() => autoRemediateSecurity()}
                    className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900 transition-colors"
                  >
                    1-Click Auto-Remediate
                  </button>
                )}
              </div>

              {auditReport.findings.length === 0 ? (
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-emerald-300 text-xs">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>100/100 CIS Security Posture Verified — Zero vulnerabilities detected.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditReport.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-rose-400 font-mono flex items-center space-x-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{finding.rule}</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-950/60 border border-rose-500/30 text-rose-300 uppercase">
                          {finding.severity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mb-1 leading-snug">{finding.message}</p>
                      <p className="text-[11px] text-cyan-400/90 font-mono">Remedy: {finding.remediation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: FinOps Cost Breakdown */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-400" />
                  <span>FinOps Rate Card Breakdown</span>
                </h4>
                {auditReport.potentialSavingsUsd && auditReport.potentialSavingsUsd > 0 ? (
                  <button
                    onClick={() => applyFinOpsOptimization()}
                    className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900 transition-colors"
                  >
                    Apply Rightsizing (Save ${auditReport.potentialSavingsUsd.toFixed(0)})
                  </button>
                ) : null}
              </div>

              {/* Cost Categories Summary */}
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(auditReport.categoryTotals).map(([cat, amount]) => (
                  <div
                    key={cat}
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                  >
                    <span className="text-[10px] text-slate-400 font-mono block">{cat}</span>
                    <span className="font-bold text-slate-100 font-mono">
                      ${(amount as number).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Node Level Breakdown */}
              <div className="space-y-1">
                {auditReport.costBreakdown.map((item) => (
                  <div
                    key={item.nodeId}
                    className="flex items-center justify-between p-2 rounded bg-slate-950/40 border border-slate-800/60 text-xs font-mono"
                  >
                    <span className="text-slate-300">{item.name}</span>
                    <span className="text-emerald-400 font-semibold">${item.monthlyUsd.toFixed(2)}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
