import React from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import {
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Layers,
  Clock,
  Download,
  SlidersHorizontal,
  X,
} from 'lucide-react';

export const SummaryCard: React.FC = () => {
  const {
    lastExecutionSummary,
    isSummaryCardVisible,
    setIsSummaryCardVisible,
    setIsExportModalOpen,
    setIsCostModalOpen,
    selectNode,
    topologyState,
  } = useCloudSwarmStore();

  if (!isSummaryCardVisible || !lastExecutionSummary) return null;

  const handleInspect = () => {
    const nodeIds = Object.keys(topologyState.nodes);
    const firstId = nodeIds[0];
    if (firstId) {
      selectNode(firstId);
    }
  };

  return (
    <div
      data-testid="summary-card"
      className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-5 py-3 rounded-2xl bg-white/98 dark:bg-[#0D0E10]/98 border border-zinc-200 dark:border-zinc-800/90 shadow-xl dark:shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200 text-zinc-900 dark:text-zinc-100 max-w-2xl w-[92%]"
    >
      {/* Icon Badge */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Title & Metadata */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
            {lastExecutionSummary.title || 'Architecture Provisioned'}
          </h4>
          <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 px-1.5 py-0.2 rounded font-semibold">
            Live
          </span>
        </div>

        {/* Metrics Row */}
        <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setIsCostModalOpen(true)}
            className="flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-zinc-900 dark:text-zinc-100 font-bold">
              ${lastExecutionSummary.costUsd.toFixed(2)}/mo
            </span>
          </button>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <div className="flex items-center gap-1 font-medium">
            <ShieldCheck className="h-3 w-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <span>CIS: {lastExecutionSummary.cisScore}/100</span>
          </div>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <div className="flex items-center gap-1 font-medium">
            <Layers className="h-3 w-3 text-zinc-500 dark:text-zinc-400 shrink-0" />
            <span>{lastExecutionSummary.nodeCount} Nodes</span>
          </div>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 font-medium">
            <Clock className="h-3 w-3" />
            <span>{lastExecutionSummary.durationSec}s</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleInspect}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
          <span>Inspect</span>
        </button>
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-semibold shadow-xs transition-all cursor-pointer border border-transparent"
        >
          <Download className="h-3 w-3" />
          <span>Export</span>
        </button>
        <button
          onClick={() => setIsSummaryCardVisible(false)}
          className="p-1 text-zinc-400 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
