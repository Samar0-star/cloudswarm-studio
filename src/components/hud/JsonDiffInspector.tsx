import React from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { PlusCircle, MinusCircle, RefreshCw, CheckCircle, Columns, X, GitCommit, ArrowRight, DollarSign, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';
import type { RFC6902Patch } from '../../types/patch';

export interface JsonDiffInspectorProps {
  customPatches?: readonly RFC6902Patch[];
}

export const JsonDiffInspector: React.FC<JsonDiffInspectorProps> = ({ customPatches }) => {
  const { dag, activeCommitId, splitDiffResult, isSplitComparisonOpen, closeSplitComparison } = useCloudSwarmStore();

  const activeCommit = dag.getCommit(activeCommitId);
  const patches = customPatches ?? activeCommit?.patches ?? [];

  // If A/B Split comparison is active, render the dedicated comparative diff view
  if (splitDiffResult) {
    return (
      <div
        className="flex-1 w-full h-full overflow-y-auto p-4 font-mono text-xs space-y-3 scrollbar-thin scrollbar-thumb-slate-800 select-text"
        data-testid="split-diff-inspector"
      >
        {/* A/B Comparison Header */}
        <div className="flex items-center justify-between pb-2 border-b border-indigo-500/30">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/40 text-indigo-300">
              <Columns className="h-3.5 w-3.5" />
              <span className="font-bold text-[11px] uppercase tracking-wider">A/B Architecture Split Comparison</span>
            </div>
            <span className="text-zinc-500 text-[10px]">
              LCA: {splitDiffResult.lcaId ? splitDiffResult.lcaId.substring(0, 12) : 'Root Genesis'}
            </span>
          </div>

          <button
            onClick={() => closeSplitComparison()}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer text-[10px]"
            title="Exit Split Comparison"
          >
            <X className="h-3 w-3" />
            <span>Close Diff</span>
          </button>
        </div>

        {/* Aggregate Diff Metric Cards */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
            <div className="text-[10px] text-emerald-400 font-bold uppercase">Nodes Added</div>
            <div className="text-lg font-bold text-emerald-300">+{splitDiffResult.addedNodes.length}</div>
          </div>
          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/30">
            <div className="text-[10px] text-rose-400 font-bold uppercase">Nodes Removed</div>
            <div className="text-lg font-bold text-rose-300">-{splitDiffResult.removedNodes.length}</div>
          </div>
          <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
            <div className="text-[10px] text-cyan-400 font-bold uppercase">Nodes Modified</div>
            <div className="text-lg font-bold text-cyan-300">~{splitDiffResult.modifiedNodes.length}</div>
          </div>
          <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30">
            <div className="text-[10px] text-indigo-400 font-bold uppercase">Total Delta</div>
            <div className="text-lg font-bold text-indigo-300">
              {splitDiffResult.addedNodes.length + splitDiffResult.removedNodes.length + splitDiffResult.modifiedNodes.length} mutations
            </div>
          </div>
        </div>

        {/* Detailed Modified Nodes List */}
        {splitDiffResult.modifiedNodes.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Modified Cloud Entities:</h4>
            {splitDiffResult.modifiedNodes.map((mod) => (
              <div key={mod.id} className="p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 space-y-1">
                <div className="flex items-center justify-between text-zinc-200">
                  <span className="font-semibold text-cyan-400">{mod.id}</span>
                  <span className="text-[10px] text-zinc-400">Keys: {mod.changedKeys.join(', ')}</span>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">
                  {mod.before?.name ?? 'Node'} → <span className="text-zinc-100 font-semibold">{mod.after?.name ?? 'Node'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Added Nodes */}
        {splitDiffResult.addedNodes.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Added Resources in Canary Branch:</h4>
            <div className="grid grid-cols-2 gap-2">
              {splitDiffResult.addedNodes.map((node) => (
                <div key={node.id} className="p-2 rounded bg-emerald-950/30 border border-emerald-500/20 text-emerald-200 flex items-center justify-between">
                  <span>{node.name}</span>
                  <span className="text-[10px] font-mono opacity-75">{node.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const getOpBadge = (op: string) => {
    switch (op) {
      case 'add':
        return (
          <span className="flex items-center space-x-1 text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono">
            <PlusCircle className="h-3 w-3" />
            <span>ADD</span>
          </span>
        );
      case 'remove':
        return (
          <span className="flex items-center space-x-1 text-rose-400 bg-rose-950/70 border border-rose-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono">
            <MinusCircle className="h-3 w-3" />
            <span>REMOVE</span>
          </span>
        );
      case 'replace':
        return (
          <span className="flex items-center space-x-1 text-cyan-400 bg-cyan-950/70 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono">
            <RefreshCw className="h-3 w-3" />
            <span>REPLACE</span>
          </span>
        );
      case 'test':
        return (
          <span className="flex items-center space-x-1 text-amber-400 bg-amber-950/70 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono">
            <CheckCircle className="h-3 w-3" />
            <span>CAS TEST</span>
          </span>
        );
      default:
        return (
          <span className="text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
            {op.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div
      className="flex-1 w-full h-full overflow-y-auto p-4 font-mono text-xs space-y-2 scrollbar-thin scrollbar-thumb-slate-800 select-text"
      data-testid="json-diff-inspector"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
        <span>
          Commit: <span className="text-cyan-400 font-semibold">{activeCommit?.id ?? 'Root'}</span> — {activeCommit?.message ?? 'Initial State'}
        </span>
        <span>{patches.length} RFC 6902 Mutations</span>
      </div>

      {patches.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-slate-500 italic text-xs">
          No JSON patch mutations in current commit snapshot.
        </div>
      ) : (
        <div className="space-y-1.5">
          {patches.map((patch, idx) => (
            <div
              key={`patch-${idx}-${patch.path}`}
              className="flex flex-col p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  {getOpBadge(patch.op)}
                  <span className="text-slate-200 font-semibold">{patch.path}</span>
                </div>
                {patch.from && (
                  <span className="text-slate-500 text-[10px]">from: {patch.from}</span>
                )}
              </div>

              {patch.value !== undefined && (
                <div className="mt-1 bg-[#070A11] p-2 rounded border border-slate-900 overflow-x-auto text-[11px] text-slate-300">
                  <pre className="whitespace-pre-wrap">
                    {typeof patch.value === 'object'
                      ? JSON.stringify(patch.value, null, 2)
                      : String(patch.value)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
