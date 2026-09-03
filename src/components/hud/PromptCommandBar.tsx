import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Zap,
  RotateCcw,
  ArrowRight,
  ShieldAlert,
  FileCode2,
  Terminal,
  Layers,
  Cpu,
  CornerDownLeft,
  GripHorizontal,
} from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { HCLSyncEngine } from '../../core/sync/HCLSyncEngine';

interface PromptTemplate {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly prompt: string;
}

const ENTERPRISE_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'banking_core',
    label: 'Banking Core',
    category: 'FinTech',
    prompt: 'Deploy multi-region AWS banking core with EKS cluster, Aurora Global DB, and KMS Zero-Trust encryption',
  },
  {
    id: 'ecommerce_ha',
    label: 'E-Commerce HA',
    category: 'High-Avail',
    prompt: 'Architect high-availability e-commerce platform with ALB, auto-scaling ECS, and Multi-AZ RDS Postgres',
  },
  {
    id: 'multicloud_mesh',
    label: 'Multi-Cloud Mesh',
    category: 'Cross-Cloud',
    prompt: 'Provision AWS VPC + Azure VNet + GCP Cloud Interconnect with unified peering and global DNS routing',
  },
  {
    id: 'aiml_cluster',
    label: 'AI/ML GPU Mesh',
    category: 'AI / LLM',
    prompt: 'Deploy high-throughput Ray/PyTorch cluster on AWS EC2 GPU instances with S3 data lake and SageMaker endpoints',
  },
  {
    id: 'zerotrust_shield',
    label: 'Zero-Trust Shield',
    category: 'SecOps',
    prompt: 'Configure sovereign 3-tier VPC with WAFv2 Web ACL, private isolated subnets, and CloudFront CDN',
  },
];

export const PromptCommandBar: React.FC = () => {
  const {
    isSimulating,
    executeSwarmPrompt,
    resetCanvasView,
    triggerChaosScenario,
    isChaosActive,
    triggerThreatScenario,
    isThreatSimActive,
    setIsHclEditorOpen,
    isHclEditorOpen,
    isPaletteOpen,
  } = useCloudSwarmStore();

  const [promptText, setPromptText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Movable Prompt Bar state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const containerBoxRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerBoxRef.current) return;
    const rect = containerBoxRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = rect.left;
    const initialY = rect.top;
    setIsDragging(true);

    const onMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const nextX = Math.max(16, Math.min(window.innerWidth - rect.width - 16, initialX + dx));
      const nextY = Math.max(16, Math.min(window.innerHeight - rect.height - 16, initialY + dy));
      setPosition({ x: nextX, y: nextY });
    };

    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Auto-expand textarea from min-height 38px up to max-height 160px with sleek overflow scrolling
  const autoExpandTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to calculate new scrollHeight accurately
    textarea.style.height = 'auto';
    const computedHeight = Math.min(Math.max(textarea.scrollHeight, 38), 160);
    textarea.style.height = `${computedHeight}px`;
  };

  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    autoExpandTextarea();
  }, [promptText]);

  const handleExecutePrompt = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSimulating || !promptText.trim()) return;

    const textToRun = promptText.trim();

    // Check if the prompt has genuine cloud infrastructure intent before executing
    const { liveOrchestrator } = useCloudSwarmStore.getState();
    if (liveOrchestrator && !liveOrchestrator.hasInfrastructureIntent(textToRun)) {
      setWarningMessage(
        `⚠️ Unrecognized prompt. Please describe cloud resources (e.g. 'Deploy AWS VPC with EKS and RDS') or choose a template.`
      );
      setTimeout(() => setWarningMessage(null), 5000);
      return;
    }

    setWarningMessage(null);
    setPromptText('');

    // Reset height to baseline 38px after execution
    if (textareaRef.current) {
      textareaRef.current.style.height = '38px';
    }

    await executeSwarmPrompt(textToRun, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift submits the prompt; Shift+Enter inserts a newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleExecutePrompt();
    }
  };

  const handleSelectTemplate = (templatePrompt: string) => {
    if (isSimulating) return;
    setWarningMessage(null);
    setPromptText(templatePrompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleClearCanvas = () => {
    const { dag, auditor, stateEngine } = useCloudSwarmStore.getState();
    const emptyState = { nodes: {}, edges: {}, version: 0 };
    stateEngine.setState(emptyState);
    const emptyReport = auditor.auditTopology(emptyState);
    const emptyHcl = HCLSyncEngine.canvasToHcl(emptyState);
    dag.addCommit({
      message: 'Cleared Canvas State',
      author: 'director',
      state: emptyState,
      patches: [],
    });
    useCloudSwarmStore.setState({
      topologyState: emptyState,
      auditReport: emptyReport,
      hclCode: emptyHcl,
      selectedNodeId: null,
      selectedEdgeId: null,
      dagTimeline: dag.getTimeline(),
      activeCommitId: dag.getActiveCommitId(),
      isSummaryCardVisible: false,
    });
    resetCanvasView();
  };

  return (
    <div
      ref={containerBoxRef}
      style={
        position
          ? {
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              transform: 'none',
              zIndex: 40,
            }
          : undefined
      }
      className={
        position
          ? 'w-full max-w-xl px-4 pointer-events-none select-none'
          : `absolute bottom-5 ${
              isPaletteOpen ? 'left-[calc(50%+9rem)]' : 'left-1/2'
            } -translate-x-1/2 z-30 w-full max-w-xl px-4 pointer-events-none select-none transition-all duration-300`
      }
      data-testid="prompt-command-bar"
    >
      <div className="bg-white/95 dark:bg-[#0A0B0E]/95 border border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700/80 rounded-2xl p-3 shadow-xl dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] backdrop-blur-2xl pointer-events-auto transition-all space-y-2 group">
        {/* Grip Handle for Moving the Prompt Box */}
        <div
          data-testid="prompt-drag-handle"
          onMouseDown={handleDragStart}
          onDoubleClick={() => setPosition(null)}
          title="Drag to reposition prompt box (Double-click to reset dock)"
          className="flex items-center justify-between pb-1 -mt-0.5 cursor-grab active:cursor-grabbing group/grip border-b border-zinc-200 dark:border-zinc-800/50 select-none"
        >
          <div className="flex items-center space-x-1.5 opacity-60 group-hover/grip:opacity-100 transition-opacity">
            <GripHorizontal className="h-3 w-3 text-zinc-500 dark:text-zinc-400 group-hover/grip:text-zinc-800 dark:group-hover/grip:text-zinc-200" />
            <span className="text-[9px] font-mono text-zinc-600 dark:text-zinc-400 group-hover/grip:text-zinc-900 dark:group-hover/grip:text-zinc-200 font-medium">
              {position ? 'Repositioned Prompt Box • Double-click to dock' : 'Drag to reposition'}
            </span>
          </div>
          {position && (
            <button
              type="button"
              onClick={() => setPosition(null)}
              title="Reset to default bottom dock"
              className="text-[9px] font-mono text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 px-1.5 py-0.2 rounded hover:bg-cyan-50 dark:hover:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-500/30 transition-colors cursor-pointer"
            >
              Reset Dock
            </button>
          )}
        </div>

        {/* Warning Banner for invalid non-infrastructure prompt */}
        {warningMessage && (
          <div className="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] font-medium animate-in fade-in slide-in-from-top-1 flex items-center justify-between">
            <span>{warningMessage}</span>
            <button
              onClick={() => setWarningMessage(null)}
              className="text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 text-xs px-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
        {/* Template / Suggestion Chips Bar */}
        <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none pb-0.5 pt-0.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 shrink-0 flex items-center space-x-1 pl-1">
            <span>Templates</span>
            <span className="text-zinc-400 dark:text-zinc-600">:</span>
          </span>

          {ENTERPRISE_PROMPT_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleSelectTemplate(tmpl.prompt)}
              disabled={isSimulating}
              className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all text-[11px] font-medium shrink-0 cursor-pointer disabled:opacity-40"
              title={tmpl.prompt}
            >
              <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 font-semibold">{tmpl.category}</span>
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
              <span>{tmpl.label}</span>
            </button>
          ))}
        </div>

        {/* Form Container with Auto-Expanding Textarea */}
        <form onSubmit={handleExecutePrompt} className="flex items-start space-x-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900/90 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800/80 shadow-xs mt-0.5">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="relative flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              id="prompt-input"
              name="prompt-input"
              aria-label="Infrastructure Prompt Input"
              rows={1}
              placeholder="Describe your infrastructure (e.g. 'Deploy secure 3-tier VPC with EKS and RDS Postgres')..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSimulating}
              data-testid="prompt-input"
              className="w-full bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none font-sans font-medium resize-none min-h-[38px] max-h-[160px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent py-2 px-1 leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={isSimulating || !promptText.trim()}
            data-testid="prompt-send-btn"
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 disabled:opacity-40 text-xs font-semibold shadow-sm border border-transparent transition-all shrink-0 cursor-pointer active:scale-98 mt-0.5"
          >
            {isSimulating ? (
              <>
                <Zap className="h-3.5 w-3.5 animate-spin text-zinc-400 dark:text-zinc-600" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <span>Synthesize</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Quick Action Shortcuts & Workstation Utilities */}
        <div className="flex items-center justify-between px-1 text-[11px] text-zinc-500 dark:text-zinc-400 gap-2 border-t border-zinc-200 dark:border-zinc-800/50 pt-2">
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-0.5">
            {/* Chaos Gorilla Quick-Trigger */}
            <button
              type="button"
              onClick={() => triggerChaosScenario()}
              disabled={isChaosActive || isSimulating}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50 font-medium text-[11px]"
              title="Inject Multi-AZ simulated power outage & watch 4 agents auto-heal"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isChaosActive ? 'bg-rose-500' : 'bg-rose-500/80'}`} />
              <span>{isChaosActive ? 'Healing...' : 'Chaos Outage'}</span>
            </button>

            {/* Red-Team Attack Quick-Trigger */}
            <button
              type="button"
              onClick={() => triggerThreatScenario()}
              disabled={isThreatSimActive || isSimulating}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50 font-medium text-[11px]"
              title="Simulate adversarial ingress attack and deploy Zero-Trust Quantum Shield"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isThreatSimActive ? 'bg-amber-500' : 'bg-amber-500/80'}`} />
              <span>{isThreatSimActive ? 'Defending...' : 'Red-Team Attack'}</span>
            </button>

            {/* Live HCL Code Shortcut */}
            <button
              type="button"
              data-testid="prompt-hcl-btn"
              onClick={() => setIsHclEditorOpen(!isHclEditorOpen)}
              className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer shrink-0 font-medium text-[11px]"
              title="View live bi-directional Terraform HCL code"
            >
              <FileCode2 className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
              <span>HCL Code</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* Keyboard helper tag */}
            <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] font-mono text-zinc-600 dark:text-zinc-500 font-medium">
              <CornerDownLeft className="h-2.5 w-2.5 text-zinc-500" />
              <span>↵ Submit</span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span>⇧↵ Newline</span>
            </span>

            {/* Clear Canvas */}
            <button
              type="button"
              onClick={handleClearCanvas}
              disabled={isSimulating}
              className="flex items-center space-x-1 text-zinc-600 hover:text-zinc-950 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors text-[10px] font-mono cursor-pointer shrink-0 font-medium"
              title="Clear canvas"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
