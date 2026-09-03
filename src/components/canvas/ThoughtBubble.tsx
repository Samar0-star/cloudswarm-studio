import React from 'react';
import type { AgentPresenceState } from '../../types/swarm';
import { getAgentPersona } from '../../types/swarm';
import { MessageSquareCode } from 'lucide-react';

export interface ThoughtBubbleProps {
  presence: AgentPresenceState;
}

export const ThoughtBubble: React.FC<ThoughtBubbleProps> = ({ presence }) => {
  if (!presence.thoughtText) return null;

  const persona = getAgentPersona(presence.agentId);
  const rawX = presence.targetX ?? presence.currentX;
  const rawY = presence.targetY ?? presence.currentY;

  // Stagger offsets per agent persona to prevent thought bubble collisions across 4 quadrants
  let offsetX = 28;
  let offsetY = -56;
  if (presence.agentId === 'beta') {
    offsetX = 28;
    offsetY = 32;
  } else if (presence.agentId === 'gamma') {
    offsetX = -290;
    offsetY = -56;
  } else if (presence.agentId === 'delta') {
    offsetX = -290;
    offsetY = 32;
  } else if (presence.agentId === 'director' || presence.agentId === 'human') {
    offsetX = 28;
    offsetY = -24;
  }

  const posX = rawX + offsetX;
  const posY = rawY + offsetY;

  return (
    <div
      style={{
        transform: `translate3d(${posX}px, ${posY}px, 0)`,
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        borderColor: `${persona.hexCode}40`,
      }}
      className="absolute top-0 left-0 pointer-events-none z-30 max-w-[210px] p-2 rounded-xl bg-white/95 dark:bg-[#0D0E12]/95 border shadow-md backdrop-blur-md text-zinc-900 dark:text-[#F7F8F8] animate-in fade-in zoom-in-95 duration-200 will-change-transform ring-1 ring-zinc-200 dark:ring-white/10"
      data-testid={`thought-bubble-${presence.agentId}`}
    >
      <div className="flex items-center space-x-1.5 mb-1 pb-1 border-b border-zinc-200 dark:border-white/[0.06]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: persona.hexCode }} />
        <span className="text-[10px] font-bold tracking-tight" style={{ color: persona.hexCode }}>
          {persona.name}
        </span>
        <span className="text-[8px] font-mono text-zinc-500 dark:text-[#8A8F98] ml-auto px-1 py-0.2 rounded bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.04]">
          WebMCP
        </span>
      </div>
      <p className="text-[10px] text-zinc-700 dark:text-[#C2C6CC] font-mono leading-tight break-words font-medium">
        {presence.thoughtText}
      </p>
    </div>
  );
};
