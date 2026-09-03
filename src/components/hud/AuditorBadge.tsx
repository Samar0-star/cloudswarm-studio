import React from 'react';
import { ShieldCheck, ShieldAlert, Wrench } from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { Tooltip } from '../common/Tooltip';
import { clsx } from 'clsx';

export const AuditorBadge: React.FC = () => {
  const { auditReport, autoRemediateSecurity, isSimulating } = useCloudSwarmStore();

  const score = auditReport.securityScore;
  const grade = auditReport.grade;
  const findingCount = auditReport.findings.length;

  const getBadgeColors = (scoreVal: number) => {
    if (scoreVal >= 95) {
      return {
        bg: 'bg-slate-900 border-slate-700 text-emerald-400',
        icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />,
      };
    }
    if (scoreVal >= 85) {
      return {
        bg: 'bg-slate-900 border-slate-700 text-sky-400',
        icon: <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />,
      };
    }
    if (scoreVal >= 70) {
      return {
        bg: 'bg-slate-900 border-slate-700 text-amber-400',
        icon: <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />,
      };
    }
    return {
      bg: 'bg-slate-900 border-slate-700 text-rose-400',
      icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />,
    };
  };

  const colors = getBadgeColors(score);

  return (
    <div className="flex items-center space-x-2" data-testid="hud-auditor-badge">
      <Tooltip
        content={
          <div className="space-y-1">
            <p className="font-semibold text-slate-100">CIS Benchmark & OWASP Top 10</p>
            <p className="text-slate-300">Grade: {grade} ({score}/100 points)</p>
            <p className="text-slate-400">
              {findingCount === 0
                ? 'All security guardrails verified'
                : `${findingCount} security findings detected`}
            </p>
          </div>
        }
      >
        <div
          className={clsx(
            'flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-colors cursor-help',
            colors.bg
          )}
        >
          {colors.icon}
          <span className="font-semibold text-slate-200">{score}/100</span>
          <span className="text-[10px] opacity-75">({grade})</span>
        </div>
      </Tooltip>

      {/* 1-Click Auto-Remediate Button */}
      {findingCount > 0 && !isSimulating && (
        <button
          onClick={() => autoRemediateSecurity()}
          className="flex items-center space-x-1 px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-indigo-300 transition-all active:scale-95 cursor-pointer"
          title="1-Click Auto-Remediate all CIS/OWASP findings"
        >
          <Wrench className="h-3 w-3 text-indigo-400" />
          <span>Harden ({findingCount})</span>
        </button>
      )}
    </div>
  );
};
