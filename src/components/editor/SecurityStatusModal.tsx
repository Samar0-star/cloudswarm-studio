import React from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  ShieldCheck,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  AlertOctagon,
} from 'lucide-react';

export const SecurityStatusModal: React.FC = () => {
  const {
    isSecurityModalOpen,
    setIsSecurityModalOpen,
    auditReport,
    autoRemediateSecurity,
  } = useCloudSwarmStore();

  const cisScore = auditReport.securityScore ?? 100;
  const findings = auditReport.findings ?? [];

  const getSeverityBadge = (severity: string) => {
    const upper = severity.toUpperCase();
    switch (upper) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
            HIGH
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400">
            MEDIUM
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={isSecurityModalOpen}
      onClose={() => setIsSecurityModalOpen(false)}
      dataTestId="security-status-modal"
      size="lg"
      title={
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-sm">CIS AWS Benchmark & Zero-Trust Posture</span>
        </div>
      }
      description="Continuous compliance scanning checking IMDSv2 tokens, AES-256 KMS encryption, and public access blocks."
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-mono text-slate-400">
            Compliance Score:{' '}
            <span className={`font-bold ${cisScore >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {cisScore}/100 ({cisScore >= 90 ? 'A+' : cisScore >= 70 ? 'B' : 'F'})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {findings.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => autoRemediateSecurity()}
                leftIcon={<Wrench className="h-3.5 w-3.5" />}
              >
                Remediate All ({findings.length})
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setIsSecurityModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Score Overview Card */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-[#14161E] border border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold font-mono text-lg border ${
                cisScore >= 90
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {cisScore}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-100">
                {cisScore >= 90 ? 'Zero-Trust Hardened' : `${findings.length} Active Finding(s)`}
              </div>
              <div className="text-[11px] text-slate-400">
                {cisScore >= 90
                  ? 'All CIS AWS Foundations Benchmark checks passing.'
                  : 'Action required to meet SOC2 / CIS compliance.'}
              </div>
            </div>
          </div>

          {findings.length === 0 ? (
            <div className="flex items-center space-x-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
              <span>Compliant</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-xs font-mono text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
              <AlertOctagon className="h-4 w-4" />
              <span>Hardening Needed</span>
            </div>
          )}
        </div>

        {/* Findings List */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-300">Security Invariant Evaluations</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {findings.length > 0 ? (
              findings.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-xl bg-[#11131A] border border-slate-800/80 flex items-start justify-between space-x-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      {getSeverityBadge(f.severity)}
                      <span className="font-semibold text-slate-200">{f.rule}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{f.message}</p>
                    <div className="text-[10px] font-mono text-slate-500">Target: {f.target_node_id}</div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => autoRemediateSecurity([f.id])}
                    className="text-[11px] shrink-0"
                  >
                    Fix
                  </Button>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-slate-400">
                No active security findings. Infrastructure is 100% compliant.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
