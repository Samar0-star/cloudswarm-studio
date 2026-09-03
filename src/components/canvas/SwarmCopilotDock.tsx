import clsx from 'clsx';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { AGENT_PERSONAS, AgentId } from '../../types/swarm';
import { Bot, Shield, Database, DollarSign, Crosshair } from 'lucide-react';

const AGENT_ICONS: Partial<Record<AgentId, React.ElementType>> = {
  alpha: Bot,
  beta: Shield,
  gamma: Database,
  delta: DollarSign,
  director: Bot,
  human: Bot,
};

const AGENT_SHORTCUTS: Partial<Record<AgentId, string>> = {
  alpha: '1',
  beta: '2',
  gamma: '3',
  delta: '4',
  director: 'D',
  human: 'H',
};

export const SwarmCopilotDock: React.FC = () => {
  const { agentPresences, selectedNodeId, topologyState, summonAgent, isPaletteOpen } = useCloudSwarmStore();
  const selectedNode = selectedNodeId ? topologyState.nodes[selectedNodeId] : null;

  const coreAgents: AgentId[] = ['alpha', 'beta', 'gamma', 'delta'];

  return (
    <div
      data-testid="swarm-copilot-dock"
      className={clsx(
        "absolute bottom-16 z-40 flex flex-col space-y-2 select-none transition-all duration-200",
        (isPaletteOpen ?? true) ? "left-[340px]" : "left-6"
      )}
    >
      {/* Contextual Target Banner when node is selected */}
      {selectedNode && (
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#090A0C]/95 border border-zinc-700/80 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Crosshair className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px] font-mono text-zinc-300">
            Selected: <span className="text-zinc-100 font-semibold">{selectedNode.name}</span>
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">• Summon agent to pair</span>
        </div>
      )}

      {/* Main Co-Pilot Roster Bar */}
      <div className="flex items-center space-x-2 p-1.5 rounded-xl bg-[#090A0C]/95 border border-zinc-800 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center space-x-1.5 px-2 py-1 border-r border-zinc-800/80">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
            Swarm
          </span>
        </div>

        {coreAgents.map((agentId) => {
          const persona = AGENT_PERSONAS[agentId];
          const presence = agentPresences[agentId];
          const Icon = AGENT_ICONS[agentId] || Bot;
          const shortcut = AGENT_SHORTCUTS[agentId];
          const isBusy = presence?.isClicking || presence?.isInspecting;

          return (
            <button
              key={agentId}
              data-testid={`summon-agent-${agentId}`}
              onClick={() => summonAgent(agentId, selectedNodeId ?? undefined)}
              title={`Summon ${persona.name} (${persona.role}) to assist [Press ${shortcut}]`}
              className={`group flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                isBusy
                  ? 'bg-zinc-800/80 border-zinc-600'
                  : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/70 hover:border-zinc-700'
              }`}
            >
              {/* Persona Avatar Dot */}
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center border text-[10px] font-bold"
                style={{
                  backgroundColor: `${persona.hexCode}20`,
                  borderColor: `${persona.hexCode}50`,
                  color: persona.hexCode,
                }}
              >
                <Icon className="w-3 h-3" />
              </div>

              {/* Agent Name & Action Pill */}
              <div className="flex flex-col text-left">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] font-mono font-semibold text-zinc-200 group-hover:text-white">
                    {persona.name}
                  </span>
                  <span className="text-[9px] font-mono text-zinc-500 bg-zinc-800/60 px-1 py-0.2 rounded border border-zinc-700/40">
                    {shortcut}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-zinc-400 truncate max-w-[90px]">
                  {presence?.actionLabel || 'Standing by'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
