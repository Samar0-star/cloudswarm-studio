import React, { useState } from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { ProductionMaterializer } from '../../core/export/ProductionMaterializer';
import {
  Download,
  FileCode,
  ShieldCheck,
  DollarSign,
  Container,
  CheckCircle2,
  Lock,
  Copy,
  Check,
} from 'lucide-react';
import { clsx } from 'clsx';

export const ExportModal: React.FC = () => {
  const {
    isExportModalOpen,
    setIsExportModalOpen,
    topologyState,
    auditReport,
    exportProductionBundle,
    isExporting,
  } = useCloudSwarmStore();

  const [activeFileTab, setActiveFileTab] = useState<
    'main.tf' | 'variables.tf' | 'Dockerfile' | 'audit_certificate.json' | 'README.md'
  >('main.tf');
  const [copied, setCopied] = useState(false);

  const bundle = ProductionMaterializer.materializeBundle(topologyState, auditReport);
  const activeContent = bundle[activeFileTab] ?? '';

  const handleDownload = async () => {
    try {
      const blob = await exportProductionBundle();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cloudswarm-production-bundle-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isExportModalOpen}
      onClose={() => setIsExportModalOpen(false)}
      dataTestId="export-modal"
      title={
        <div className="flex items-center space-x-2">
          <Download className="h-5 w-5 text-cyan-400" />
          <span className="font-mono text-sm font-bold">
            1-Click Production Materializer & Deployment Bundle
          </span>
        </div>
      }
      description="Materialize clean, certified infrastructure as code, hardened Docker containers, and signed SecOps audit artifacts."
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span className="flex items-center space-x-1 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>{auditReport.securityScore}/100 Certified</span>
            </span>
            <span>•</span>
            <span className="text-slate-300 font-bold">
              ${auditReport.totalMonthlyCostUsd.toFixed(2)}/mo
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={isExporting}
              onClick={handleDownload}
              leftIcon={<Download className="h-4 w-4" />}
              data-testid="download-zip-btn"
            >
              Download ZIP Bundle
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Quality Certification Card */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
              {auditReport.grade}
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">
                SentinelAuditor Certified Release
              </h4>
              <p className="text-[11px] text-slate-400">
                Zero-Trust IAM • IMDSv2 Enforced • SHA-256 Integrity Verified
              </p>
            </div>
          </div>
          <div className="text-right font-mono text-xs">
            <span className="text-slate-400 block text-[10px]">Cloud Run-Rate</span>
            <span className="font-bold text-emerald-400">
              ${auditReport.totalMonthlyCostUsd.toFixed(2)}/mo
            </span>
          </div>
        </div>

        {/* File Tabs & Preview */}
        <div className="flex flex-col h-[400px] rounded-lg border border-slate-800 bg-[#070A11] overflow-hidden">
          {/* File Switcher Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-2 py-1">
            <div className="flex items-center space-x-1">
              {(
                [
                  'main.tf',
                  'variables.tf',
                  'Dockerfile',
                  'audit_certificate.json',
                  'README.md',
                ] as const
              ).map((fileName) => (
                <button
                  key={fileName}
                  onClick={() => setActiveFileTab(fileName)}
                  className={clsx(
                    'px-2.5 py-1 text-xs font-mono rounded transition-colors',
                    activeFileTab === fileName
                      ? 'bg-slate-800 text-cyan-300 font-semibold border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  )}
                >
                  {fileName}
                </button>
              ))}
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 text-[11px] font-mono text-slate-300 hover:text-slate-100 px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Code Content */}
          <pre className="flex-1 p-4 font-mono text-xs text-slate-200 overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 select-text whitespace-pre-wrap">
            {activeContent}
          </pre>
        </div>
      </div>
    </Modal>
  );
};
