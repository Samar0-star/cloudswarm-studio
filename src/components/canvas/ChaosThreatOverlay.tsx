import React from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { Shield, AlertTriangle, Zap, Crosshair } from 'lucide-react';

export const ChaosThreatOverlay: React.FC = () => {
  const {
    isChaosActive,
    activeChaosIncident,
    isThreatSimActive,
    activeThreatVector,
    topologyState,
    isShieldActive,
    canvasZoom,
    canvasPan,
  } = useCloudSwarmStore();

  if (!isChaosActive && !isThreatSimActive && !isShieldActive) return null;

  // Find target node coordinates for visual attack laser lock-on
  const targetIds = isChaosActive
    ? activeChaosIncident?.targetNodeIds || []
    : activeThreatVector?.targetNodeIds || [];

  const targetNode =
    Object.values(topologyState.nodes).find((n) => targetIds.includes(n.id)) ||
    Object.values(topologyState.nodes)[0];

  const targetX = targetNode
    ? targetNode.position.x * canvasZoom + canvasPan.x + (115 * canvasZoom)
    : typeof window !== 'undefined'
    ? window.innerWidth / 2
    : 500;

  const targetY = targetNode
    ? targetNode.position.y * canvasZoom + canvasPan.y + (40 * canvasZoom)
    : typeof window !== 'undefined'
    ? window.innerHeight / 2
    : 300;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none">

      {/* 1. Chaos Gorilla Outage Alert Banner */}
      {isChaosActive && activeChaosIncident && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-xl bg-white/98 dark:bg-[#0D0E10]/98 border border-zinc-200 dark:border-zinc-800 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 text-zinc-900 dark:text-zinc-100 max-w-xl w-[90%] pointer-events-auto">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-rose-500 border border-zinc-200 dark:border-zinc-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded font-bold border border-rose-500/20">
                P0 Incident
              </span>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {activeChaosIncident.name}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {activeChaosIncident.impactDescription}
            </p>
          </div>
          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-500/30 px-2 py-1 rounded-lg font-semibold shrink-0">
            Self-Healing...
          </span>
        </div>
      )}

      {/* 2. Red-Team Cyber Threat Ingress Alert Banner */}
      {isThreatSimActive && activeThreatVector && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-xl bg-white/98 dark:bg-[#0D0E10]/98 border border-zinc-200 dark:border-zinc-800 shadow-xl backdrop-blur-xl animate-in fade-in duration-300 text-zinc-900 dark:text-zinc-100 max-w-xl w-[90%] pointer-events-auto">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-amber-500 border border-zinc-200 dark:border-zinc-700">
            <Zap className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-500/20">
                Threat Detected
              </span>
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {activeThreatVector.name}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
              {activeThreatVector.attackDescription}
            </p>
          </div>
          <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-500/30 px-2 py-1 rounded-lg font-semibold shrink-0">
            Deploying Shield...
          </span>
        </div>
      )}

      {/* 3. Global Zero-Trust Quantum Shield Overlay */}
      {isShieldActive && (
        <div className="absolute inset-0 pointer-events-none border border-zinc-400/20 bg-zinc-900/10 backdrop-blur-[0.5px] transition-all duration-300 flex items-center justify-center z-30">
          <div className="flex items-center space-x-2.5 px-4 py-2 rounded-xl bg-white/98 dark:bg-[#0D0E10]/98 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs font-mono shadow-xl backdrop-blur-xl">
            <Shield className="h-4 w-4 text-emerald-500" />
            <span className="font-semibold tracking-wide text-zinc-800 dark:text-zinc-100">
              ZERO-TRUST SHIELD ENGAGED — INGRESS BLOCKED & DEFLECTED
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
