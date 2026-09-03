import React from 'react';
import type { CloudResourceNode } from '../../types/topology';
import type { AgentId } from '../../types/swarm';
import { AGENT_PERSONAS } from '../../types/swarm';

export interface BoundingHaloProps {
  node: CloudResourceNode;
  agentId: AgentId;
  label?: string;
}

export const BoundingHalo: React.FC<BoundingHaloProps> = ({
  node,
  agentId,
  label,
}) => {
  const persona = AGENT_PERSONAS[agentId] ?? AGENT_PERSONAS.alpha;
  const width = node.width ?? 240;
  const height = node.height ?? 90;

  const padding = 6;
  const haloX = node.position.x - padding;
  const haloY = node.position.y - padding;
  const haloWidth = width + padding * 2;
  const haloHeight = height + padding * 2;

  return (
    <div
      style={{
        transform: `translate3d(${haloX}px, ${haloY}px, 0)`,
        width: `${haloWidth}px`,
        height: `${haloHeight}px`,
        borderColor: persona.hexCode,
      }}
      className="absolute top-0 left-0 pointer-events-none z-20 rounded-2xl border-[1.5px] border-dashed animate-soft-pulse transition-transform duration-150"
      data-testid={`bounding-halo-${node.id}`}
    >
      {/* Mini agent activity tag */}
      <div
        className="absolute -top-3 left-3 px-1.5 py-0.2 text-[9px] font-mono font-medium rounded border shadow-sm backdrop-blur-md"
        style={{
          backgroundColor: '#070A11F0',
          borderColor: `${persona.hexCode}80`,
          color: persona.hexCode,
        }}
      >
        <span>{persona.glyph} {label || 'Locking Resource'}</span>
      </div>
    </div>
  );
};
