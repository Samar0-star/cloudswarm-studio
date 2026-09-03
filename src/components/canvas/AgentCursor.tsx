import React, { useEffect, useState } from 'react';
import type { AgentPresenceState } from '../../types/swarm';
import { getAgentPersona } from '../../types/swarm';

export interface AgentCursorProps {
  presence: AgentPresenceState;
}

export const AgentCursor: React.FC<AgentCursorProps> = ({ presence }) => {
  const persona = getAgentPersona(presence.agentId);
  const [clickRipple, setClickRipple] = useState(false);

  // Helper function to format action into strictly less than 4 words (< 4 words)
  const getConciseAction = (label?: string): string => {
    if (!label) return '';
    if (label === 'Standing by' || label === 'Ready (Synced)' || label === 'Success' || label === 'Done') {
      return label === 'Success' ? 'Synced' : label === 'Ready (Synced)' ? 'Ready' : '';
    }

    const cleaned = label
      .replace(/^Executing\s+/i, '')
      .replace(/^Connecting\s+/i, 'Linking ')
      .replace(/^Linking to\s+/i, 'Linking ')
      .replace(/_/g, ' ')
      .trim();

    const words = cleaned.split(/\s+/).filter(Boolean);
    return words.slice(0, 3).join(' ');
  };

  const displayAction = getConciseAction(presence.actionLabel);

  // An agent is actively working if it is clicking, inspecting, dragging, or has an active task label
  const isWorking = Boolean(
    presence.isClicking ||
    presence.isDragging ||
    presence.isInspecting ||
    displayAction
  );

  // When agents finish their job, hold visible gracefully for 3 seconds before smooth fade
  const [isIdleFaded, setIsIdleFaded] = useState(!presence.isVisible);

  useEffect(() => {
    if (isWorking || (presence.isVisible && (presence.opacity ?? 1) > 0)) {
      setIsIdleFaded(false);
    } else {
      const idleTimer = setTimeout(() => {
        setIsIdleFaded(true);
      }, 3000);
      return () => clearTimeout(idleTimer);
    }
  }, [isWorking, presence.isVisible, presence.opacity]);

  const fallbackPositions: Record<string, { x: number; y: number }> = {
    alpha: { x: 180, y: 90 },
    beta: { x: 860, y: 90 },
    gamma: { x: 180, y: 560 },
    delta: { x: 860, y: 560 },
  };

  const rawX = presence.targetX ?? presence.currentX;
  const rawY = presence.targetY ?? presence.currentY;
  const posX = typeof rawX === 'number' && rawX >= 0 ? rawX : (fallbackPositions[presence.agentId]?.x ?? 200);
  const posY = typeof rawY === 'number' && rawY >= 0 ? rawY : (fallbackPositions[presence.agentId]?.y ?? 200);
  const isVisible = Boolean(presence.isVisible) && presence.opacity !== 0 && !isIdleFaded;

  // Individual persona transition profiles for organic, asynchronous motion
  const transitionProfiles: Record<string, string> = {
    alpha: 'transform 0.42s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.4s ease-out, scale 0.4s ease-out',
    beta: 'transform 0.35s cubic-bezier(0.15, 0.85, 0.35, 1), opacity 0.4s ease-out, scale 0.4s ease-out',
    gamma: 'transform 0.48s cubic-bezier(0.25, 0.95, 0.4, 1), opacity 0.4s ease-out, scale 0.4s ease-out',
    delta: 'transform 0.38s cubic-bezier(0.18, 0.8, 0.25, 1), opacity 0.4s ease-out, scale 0.4s ease-out',
    'ext-1': 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out',
    'ext-2': 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out',
    'ext-3': 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out',
    'ext-4': 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out',
  };

  const transitionStyle = transitionProfiles[presence.agentId] || 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease-out';

  // Trigger subtle click pulse when executing an action
  useEffect(() => {
    if (presence.isClicking || presence.isInspecting) {
      setClickRipple(true);
      const timer = setTimeout(() => setClickRipple(false), 500);
      return () => clearTimeout(timer);
    }
  }, [presence.isClicking, presence.isInspecting, presence.targetX, presence.targetY]);

  return (
    <div
      style={{
        transform: `translate3d(${posX}px, ${posY}px, 0) scale(${isVisible ? 1 : 0.85})`,
        transition: transitionStyle,
        opacity: isVisible ? 1 : 0,
      }}
      className={`absolute top-0 left-0 pointer-events-none z-40 flex flex-col items-start select-none will-change-transform ${
        isVisible ? '' : 'pointer-events-none'
      }`}
      data-testid={`agent-cursor-${presence.agentId}`}
    >
      {/* Precision Click Focal Ring */}
      {clickRipple && (
        <div
          data-testid="cursor-click-ripple"
          className="cursor-click-ripple absolute h-6 w-6 rounded-full border border-zinc-400 pointer-events-none opacity-50 -translate-x-1/2 -translate-y-1/2 scale-110"
          style={{
            top: '2px',
            left: '2px',
          }}
        />
      )}

      {/* Modern Precision Pointer */}
      <div
        className="relative transition-transform duration-100 origin-top-left"
        style={{
          transform: presence.isClicking ? 'scale(0.85) translate(1px, 1px)' : 'scale(1)',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
        >
          <path
            d="M3 2L10.5 21L13.8 13.8L21 10.5L3 2Z"
            fill="#0F131F"
            stroke={persona.hexCode}
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
        </svg>

        {/* Distinctive Agent Colored Tip */}
        <span
          className="absolute top-0.5 left-0.5 h-2 w-2 rounded-full ring-1 ring-black/40"
          style={{
            backgroundColor: persona.hexCode,
            boxShadow: `0 0 8px ${persona.hexCode}`,
          }}
        />
      </div>

      {/* Live Tool Execution Popup (strictly < 4 words) with agent glyph and color badge */}
      {displayAction && (
        <div
          className="mt-1 px-2.5 py-1 rounded-full bg-[#090A0E]/95 border text-[10px] font-mono text-white shadow-xl backdrop-blur-md flex items-center space-x-1.5 whitespace-nowrap animate-in fade-in duration-200 transition-all ring-1 ring-white/5"
          style={{ borderColor: `${persona.hexCode}60` }}
        >
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: persona.hexCode, boxShadow: `0 0 8px ${persona.hexCode}` }}
          />
          <span className="font-semibold text-[9px] tracking-wider uppercase opacity-90 mr-0.5" style={{ color: persona.hexCode }}>
            {persona.glyph || persona.id.slice(0, 3)}
          </span>
          <span className="font-medium text-zinc-100">{displayAction}</span>
        </div>
      )}

      {/* Visual Drag-and-Drop Ghost Card */}
      {presence.isDragging && (
        <div
          className="mt-2 p-2 rounded-xl bg-[#0D1018]/95 border text-slate-100 shadow-2xl backdrop-blur-xl flex items-center space-x-2 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-white/10"
          style={{ borderColor: persona.hexCode }}
        >
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border text-slate-200"
            style={{ backgroundColor: `${persona.hexCode}20`, borderColor: `${persona.hexCode}50` }}
          >
            <span className="text-[10px] font-bold">+</span>
          </div>
          <div className="text-[10px] font-mono font-medium truncate max-w-[180px]">
            {presence.draggedItemName || presence.draggedItemType || 'Cloud Resource'}
          </div>
        </div>
      )}
    </div>
  );
};
