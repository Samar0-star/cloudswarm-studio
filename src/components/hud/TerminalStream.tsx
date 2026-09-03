import React, { useRef, useEffect } from 'react';
import type { ExecutionLogEntry, AgentId } from '../../types/swarm';
import { AGENT_PERSONAS } from '../../types/swarm';
import { clsx } from 'clsx';

export interface TerminalStreamProps {
  logs: readonly ExecutionLogEntry[];
  filterAgent?: AgentId | 'all';
}

export const TerminalStream: React.FC<TerminalStreamProps> = ({
  logs,
  filterAgent = 'all',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filterAgent === 'all'
    ? logs
    : logs.filter((log) => log.agentId === filterAgent);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  const getActionBadgeColor = (type: string) => {
    switch (type) {
      case 'CAS_APPLY':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40';
      case 'CAS_ROLLBACK':
        return 'bg-rose-950/80 text-rose-300 border-rose-500/40';
      case 'LOCK':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/40';
      case 'UNLOCK':
        return 'bg-slate-800 text-slate-400 border-slate-700';
      case 'MCP_CALL':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/40';
      case 'AUDIT_VETO':
        return 'bg-rose-950/80 text-rose-300 border-rose-500/40';
      case 'FINOPS_EVAL':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40';
      case 'BRANCH_FORK':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 w-full h-full overflow-y-auto font-mono text-xs p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 select-text"
      data-testid="terminal-stream"
    >
      {filteredLogs.length === 0 ? (
        <div className="flex items-center justify-center h-full text-slate-500 italic text-xs">
          No execution telemetry in this channel yet.
        </div>
      ) : (
        filteredLogs.map((log) => {
          const persona = AGENT_PERSONAS[log.agentId] ?? AGENT_PERSONAS.alpha;
          const timeString = new Date(log.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div
              key={log.id}
              className="flex items-start space-x-2 py-1 px-2 rounded hover:bg-slate-900/60 transition-colors border border-transparent hover:border-slate-800/80"
            >
              {/* Timestamp */}
              <span className="text-[10px] text-slate-500 shrink-0 pt-0.5">{timeString}</span>

              {/* Latency Badge */}
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-950/80 border border-slate-800 px-1 py-0.2 rounded shrink-0">
                {log.latencyMs.toFixed(2)}ms
              </span>

              {/* Agent Pill */}
              <span
                className="text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0"
                style={{
                  backgroundColor: `${persona.hexCode}15`,
                  borderColor: `${persona.hexCode}40`,
                  color: persona.hexCode,
                }}
              >
                {persona.glyph} {persona.name.split(' ')[1] || persona.name}
              </span>

              {/* Action Type Badge */}
              <span
                className={clsx(
                  'text-[9px] font-semibold px-1 py-0.2 rounded border uppercase tracking-wider shrink-0',
                  getActionBadgeColor(log.actionType)
                )}
              >
                {log.actionType}
              </span>

              {/* Message */}
              <span className="text-slate-300 leading-snug break-words flex-1">
                {log.message}
                {log.targetResourceId && (
                  <span className="ml-1.5 text-cyan-400 opacity-80 text-[11px]">
                    [{log.targetResourceId}]
                  </span>
                )}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};
