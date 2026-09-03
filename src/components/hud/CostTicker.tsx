import React from 'react';
import { DollarSign, TrendingDown, Sparkles } from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { Tooltip } from '../common/Tooltip';

export const CostTicker: React.FC = () => {
  const { auditReport, applyFinOpsOptimization, isSimulating } = useCloudSwarmStore();

  const totalMonthly = auditReport.totalMonthlyCostUsd;
  const totalHourly = auditReport.totalHourlyCostUsd || totalMonthly / 730;
  const potentialSavings = auditReport.potentialSavingsUsd || 0;

  return (
    <div className="flex items-center space-x-2" data-testid="hud-cost-ticker">
      <Tooltip
        content={
          <div className="space-y-1">
            <p className="font-semibold text-slate-100">FinOps 60 FPS Rate Engine</p>
            <p className="text-slate-300">Run-Rate: ${totalHourly.toFixed(3)}/hr</p>
            {potentialSavings > 0 && (
              <p className="text-emerald-400 font-semibold">
                Potential Savings: ${potentialSavings.toFixed(2)}/mo
              </p>
            )}
          </div>
        }
      >
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-xs font-mono text-emerald-400 shadow-sm cursor-help transition-colors hover:border-emerald-500/40">
          <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-200">
            ${totalMonthly.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 font-sans">/mo</span>
        </div>
      </Tooltip>

      {/* 1-Click FinOps Optimization Quick Button */}
      {potentialSavings > 0 && !isSimulating && (
        <button
          onClick={() => applyFinOpsOptimization()}
          className="flex items-center space-x-1 px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-emerald-400 transition-all active:scale-95 cursor-pointer"
          title="1-Click Apply FinOps Rightsizing Optimization"
        >
          <Sparkles className="h-3 w-3 text-emerald-400" />
          <span>Save ${potentialSavings.toFixed(0)}</span>
        </button>
      )}
    </div>
  );
};
