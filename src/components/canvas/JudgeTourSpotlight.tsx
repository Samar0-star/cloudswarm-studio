import React from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Play,
  ShieldCheck,
  DollarSign,
  FileCode2,
  Zap,
  Activity,
  Layers,
  Award,
} from 'lucide-react';
import { Button } from '../common/Button';

export interface TourStep {
  stepNumber: number;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  highlights: string[];
  cameraPan: { x: number; y: number };
  cameraZoom: number;
  actionButton?: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  };
}

export const JudgeTourSpotlight: React.FC = () => {
  const {
    isTourOpen,
    currentTourStep,
    setIsTourOpen,
    setCurrentTourStep,
    setCanvasPan,
    setCanvasZoom,
    setIsHclEditorOpen,
    setIsCostModalOpen,
    setIsSecurityModalOpen,
    runSwarmDemo,
  } = useCloudSwarmStore();

  if (!isTourOpen) return null;

  const TOUR_STEPS: TourStep[] = [
    {
      stepNumber: 1,
      title: '4-Agent Master Planner & WebMCP Protocol Concurrency',
      badge: 'Multi-Agent Core',
      badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      description:
        'A human director gives high-level commands; the Master Planner decomposes requests into non-overlapping tasks executed concurrently by 4 specialized agents using native WebMCP in-browser tool calls.',
      highlights: [
        'Agent Atlas (Compute & Infra) • Agent Breach (SecOps & IAM)',
        'Agent Forge (Databases & Lakes) • Agent Cost (FinOps Auditor)',
        'StripedLockManager: 64-stripe entity locking mathematically prevents deadlocks',
        'OptimisticStateEngine: RFC 6902 CAS Immer patches with sub-millisecond rollbacks',
      ],
      cameraPan: { x: 0, y: 0 },
      cameraZoom: 1.0,
      actionButton: {
        label: '1-Click Swarm Synthesis',
        icon: <Play className="h-3.5 w-3.5 fill-current" />,
        onClick: () => runSwarmDemo(),
      },
    },
    {
      stepNumber: 2,
      title: '60 FPS Sentinel Security Auditor & 1-Click Auto-Hardening',
      badge: 'Zero-Trust SecOps',
      badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      description:
        'Every single frame evaluates your multi-cloud infrastructure against official CIS Benchmarks (AWS, Azure, GCP). Detects open 0.0.0.0/0 ingress, unencrypted storage, and public database ports.',
      highlights: [
        'Live 0–100 / A+ Grade security compliance scoring',
        '1-Click "Hardening" generates instant remediation patches',
        'Zero-Trust IAM boundary generation with least-privilege scoping',
      ],
      cameraPan: { x: -80, y: 40 },
      cameraZoom: 1.15,
      actionButton: {
        label: 'Open Security Modal',
        icon: <ShieldCheck className="h-3.5 w-3.5" />,
        onClick: () => setIsSecurityModalOpen(true),
      },
    },
    {
      stepNumber: 3,
      title: 'Multi-Cloud FinOps Engine & 730hr Rate Cards',
      badge: 'FinOps Rate Cards',
      badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      description:
        'Calculates real-time run-rate pricing ($/mo) directly from 108 cloud primitive rate cards across AWS, Azure, and GCP for vCPUs, RAM, NVIDIA GPUs (A100/H100/A10G), and storage tiers.',
      highlights: [
        '730 hours/month compute, container, and storage pricing models',
        'Interactive Monthly Budget Threshold slider with over-budget warning system',
        '1-Click RFC 4180 CSV Financial Audit export',
      ],
      cameraPan: { x: 80, y: -40 },
      cameraZoom: 1.1,
      actionButton: {
        label: 'Open FinOps Rate Cards',
        icon: <DollarSign className="h-3.5 w-3.5" />,
        onClick: () => setIsCostModalOpen(true),
      },
    },
    {
      stepNumber: 4,
      title: 'Bi-Directional AST Code Sync & 1-Click Production Materializer',
      badge: 'IaC Bi-Directional Sync',
      badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      description:
        'Breaks the visual vs code barrier. Moving nodes on the canvas immediately writes production Terraform/OpenTofu HCL2; editing HCL code updates the visual topology in <1ms.',
      highlights: [
        'Multi-cloud provider blocks (aws, azurerm, google) synchronized live',
        'Downloadable Production ZIP bundle with main.tf, variables.tf, and Dockerfile',
        'Signed SHA-256 CIS Security & Cost Audit Certificate included',
      ],
      cameraPan: { x: 0, y: 0 },
      cameraZoom: 1.0,
      actionButton: {
        label: 'Inspect Live Terraform HCL',
        icon: <FileCode2 className="h-3.5 w-3.5" />,
        onClick: () => setIsHclEditorOpen(true),
      },
    },
    {
      stepNumber: 5,
      title: 'Autonomous Self-Healing & Live Threat Deflector',
      badge: 'Chaos & Self-Healing',
      badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      description:
        'Simulate catastrophic multi-AZ outages or live cyber intrusions. Watch the 4-agent swarm automatically detect failures, promote replicas, re-route traffic, and deflect adversary attacks in under 4 seconds.',
      highlights: [
        'Real-time AZ outage injection with automated compute failover',
        'Live CVE threat ingress detection with Zero-Trust shield deployment',
        'Automated incident post-mortem and blast radius reporting',
      ],
      cameraPan: { x: 0, y: 60 },
      cameraZoom: 1.05,
    },
  ];

  const currentStep = TOUR_STEPS[currentTourStep] || TOUR_STEPS[0]!;
  const totalSteps = TOUR_STEPS.length;

  const handleNext = () => {
    if (currentTourStep < totalSteps - 1) {
      const nextIdx = currentTourStep + 1;
      setCurrentTourStep(nextIdx);
      const nextStep = TOUR_STEPS[nextIdx];
      if (nextStep) {
        setCanvasPan(nextStep.cameraPan);
        setCanvasZoom(nextStep.cameraZoom);
      }
    } else {
      setIsTourOpen(false);
    }
  };

  const handlePrev = () => {
    if (currentTourStep > 0) {
      const prevIdx = currentTourStep - 1;
      setCurrentTourStep(prevIdx);
      const prevStep = TOUR_STEPS[prevIdx];
      if (prevStep) {
        setCanvasPan(prevStep.cameraPan);
        setCanvasZoom(prevStep.cameraZoom);
      }
    }
  };

  return (
    <div
      data-testid="judge-tour-spotlight-modal"
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-6 duration-300 pointer-events-auto"
    >
      <div className="rounded-2xl bg-[#0E111A]/95 border border-indigo-500/30 p-5 shadow-2xl backdrop-blur-2xl text-slate-100 relative">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-indigo-400">
                  VIP Judge & Executive Tour
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${currentStep.badgeColor}`}>
                  {currentStep.badge}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-100">{currentStep.title}</h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">
              Step <span className="text-indigo-400 font-bold">{currentStep.stepNumber}</span> of {totalSteps}
            </span>
            <button
              onClick={() => setIsTourOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Exit VIP Tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="py-3.5 space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">{currentStep.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-[#090B10] p-3 rounded-xl border border-slate-800/60">
            {currentStep.highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-slate-300">
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
          <div className="flex items-center gap-2">
            {currentStep.actionButton && (
              <Button
                variant="primary"
                size="sm"
                onClick={currentStep.actionButton.onClick}
                leftIcon={currentStep.actionButton.icon}
                className="text-xs bg-indigo-600 hover:bg-indigo-500"
              >
                {currentStep.actionButton.label}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrev}
              disabled={currentTourStep === 0}
              leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              Previous
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleNext}
              rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
              className="text-xs"
            >
              {currentTourStep === totalSteps - 1 ? 'Finish Tour' : 'Next Step'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
