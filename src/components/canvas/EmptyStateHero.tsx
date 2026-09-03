import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  Layers,
  ShieldCheck,
  DollarSign,
  ArrowRight,
  Plus,
  Globe,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
} from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { AGENT_PERSONAS } from '../../types/swarm';

export const EmptyStateHero: React.FC = () => {
  const { topologyState, runSwarmDemo, isSimulating, setSelectedScenarioId, addNode, selectNode } =
    useCloudSwarmStore();

  const [isMinimized, setIsMinimized] = useState(false);

  const nodeCount = Object.keys(topologyState.nodes).length;
  if (nodeCount > 0) return null;

  const handleStartWithScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    runSwarmDemo();
  };

  const handleStartBlank = () => {
    addNode({
      id: 'vpc_main',
      type: 'aws_vpc',
      name: 'Primary VPC',
      position: { x: 300, y: 180 },
      config: { cidr_block: '10.0.0.0/16', enable_dns_hostnames: true, enable_dns_support: true },
      metadata: { createdBy: 'director', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
      version: 1,
    });
    selectNode('vpc_main');
  };

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-full max-w-4xl px-4 pointer-events-none select-none"
      data-testid="empty-state-hero"
    >
      {isMinimized ? (
        /* Collapsed / Minimized Pill Dock */
        <div className="flex items-center justify-between mx-auto max-w-md px-3.5 py-2 rounded-full bg-white/95 dark:bg-[#0A0B0E]/95 border border-zinc-200 dark:border-zinc-800/90 shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-2xl pointer-events-auto transition-all animate-in fade-in duration-200">
          <div className="flex items-center space-x-2">
            <LayoutGrid className="h-3.5 w-3.5 text-zinc-600 dark:text-indigo-400" />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Reference Blueprints</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">4</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => runSwarmDemo()}
              disabled={isSimulating}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 font-semibold text-[11px] shadow-sm transition-all cursor-pointer flex items-center space-x-1"
              data-testid="hero-run-demo-btn"
            >
              <Play className="h-2.5 w-2.5 fill-current" />
              <span>Launch</span>
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              title="Expand Blueprints Dock"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Expanded Architectural Dock Banner */
        <div className="bg-white/95 dark:bg-[#0A0B0E]/95 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl p-3 shadow-xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.03)_inset] backdrop-blur-2xl pointer-events-auto transition-all animate-in fade-in slide-in-from-top-2 duration-250 text-zinc-900 dark:text-zinc-100">
          {/* Header Row: Standard Badge, 4 Agent Micro-Dots & Quick Actions */}
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-zinc-800/60">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 dark:bg-indigo-950/60 border border-zinc-200 dark:border-indigo-500/30 text-zinc-700 dark:text-indigo-400">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-wide">Enterprise Blueprints</h3>
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                    W3C WebMCP
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 hidden sm:block">
                  Select a reference architecture or drag primitives from the CAD palette to begin.
                </p>
              </div>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => runSwarmDemo()}
                disabled={isSimulating}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-gradient-to-b dark:from-white dark:to-zinc-200 text-white dark:text-zinc-950 font-semibold text-xs shadow-sm transition-all cursor-pointer"
                data-testid="hero-run-demo-btn"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Launch Swarm</span>
              </button>

              <button
                onClick={handleStartBlank}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium text-xs transition-colors cursor-pointer"
                data-testid="hero-start-blank-btn"
              >
                <Plus className="h-3 w-3" />
                <span>Blank</span>
              </button>

              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                title="Minimize Blueprints Dock"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Blueprint Cards Horizontal Strip (Non-Intrusive, Compact) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2.5">
            {/* Card 1: Global Banking */}
            <div
              onClick={() => handleStartWithScenario('global_banking_core')}
              className="group p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer transition-all shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-indigo-950/60 text-zinc-700 dark:text-indigo-400 border border-zinc-200 dark:border-indigo-500/30">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] font-mono text-zinc-500 dark:text-indigo-400 flex items-center space-x-0.5 group-hover:text-zinc-800 dark:group-hover:text-indigo-300">
                  <span>24-Step</span>
                  <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white">Global Banking</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">Multi-Region EKS + Aurora</div>
              </div>
            </div>

            {/* Card 2: E-Commerce HA */}
            <div
              onClick={() => handleStartWithScenario('ecommerce_ha')}
              className="group p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer transition-all shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center space-x-0.5 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
                  <span>Run</span>
                  <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white">E-Commerce HA</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">ALB + Multi-AZ RDS</div>
              </div>
            </div>

            {/* Card 3: Fintech Zero-Trust */}
            <div
              onClick={() => handleStartWithScenario('fintech_zerotrust')}
              className="group p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer transition-all shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center space-x-0.5 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
                  <span>Run</span>
                  <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white">Fintech Zero-Trust</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">EKS + KMS Shield</div>
              </div>
            </div>

            {/* Card 4: Microservices Mesh */}
            <div
              onClick={() => handleStartWithScenario('microservices_mesh')}
              className="group p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-850 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer transition-all shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/50">
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 flex items-center space-x-0.5 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
                  <span>Run</span>
                  <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white">Microservices</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">ECS + DynamoDB</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
