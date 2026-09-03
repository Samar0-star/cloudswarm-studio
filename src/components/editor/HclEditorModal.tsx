import React, { useState, useEffect } from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { HCLSyncEngine } from '../../core/sync/HCLSyncEngine';
import {
  FileCode2,
  Play,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';

export const HclEditorModal: React.FC = () => {
  const {
    isHclEditorOpen,
    setIsHclEditorOpen,
    hclCode,
    setHclCode,
    syncHclToCanvas,
    syncCanvasToHcl,
    topologyState,
  } = useCloudSwarmStore();

  const [localHcl, setLocalHcl] = useState(hclCode);
  const [parseError, setParseError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nodeCountPreview, setNodeCountPreview] = useState(0);

  useEffect(() => {
    setLocalHcl(hclCode);
  }, [hclCode]);

  // Live syntax & AST verification
  useEffect(() => {
    try {
      const parsed = HCLSyncEngine.hclToCanvas(localHcl);
      const count = Object.keys(parsed.nodes).length;
      setNodeCountPreview(count);
      setParseError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setParseError(msg);
    }
  }, [localHcl]);

  const handleApply = () => {
    syncHclToCanvas(localHcl);
    setIsHclEditorOpen(false);
  };

  const handleReset = () => {
    syncCanvasToHcl();
    setLocalHcl(HCLSyncEngine.canvasToHcl(topologyState));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localHcl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isHclEditorOpen}
      onClose={() => setIsHclEditorOpen(false)}
      dataTestId="hcl-editor-modal"
      title={
        <div className="flex items-center space-x-2">
          <FileCode2 className="h-5 w-5 text-cyan-400" />
          <span className="font-mono text-sm font-bold">
            Live Bi-Directional Terraform HCL2 Sync Editor
          </span>
        </div>
      }
      description="Edit infrastructure as code in real-time. Changes instantly compile through the AST parser and update the visual topology canvas."
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            {parseError ? (
              <span className="flex items-center space-x-1 text-rose-400">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Syntax Error: {parseError}</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                <span>Valid HCL2 AST • {nodeCountPreview} cloud resources parsed</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Reset from Canvas
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              leftIcon={<Play className="h-3.5 w-3.5 fill-current" />}
              data-testid="apply-hcl-btn"
            >
              Apply to Canvas
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-[520px] rounded-lg border border-slate-800 bg-[#070A11] overflow-hidden">
        {/* Editor Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/80">
          <span className="text-[11px] font-mono text-slate-400">main.tf (Terraform / OpenTofu 1.5+)</span>
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
                <span>Copy Manifest</span>
              </>
            )}
          </button>
        </div>

        {/* Editor Textarea */}
        <textarea
          value={localHcl}
          onChange={(e) => {
            setLocalHcl(e.target.value);
            setHclCode(e.target.value);
          }}
          className="flex-1 w-full p-4 bg-transparent font-mono text-xs text-slate-200 resize-none outline-none leading-relaxed scrollbar-thin scrollbar-thumb-slate-800 select-text"
          placeholder="# Paste or type Terraform HCL code here..."
          spellCheck={false}
          data-testid="hcl-code-editor"
        />
      </div>
    </Modal>
  );
};
