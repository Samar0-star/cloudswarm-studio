import React from 'react';
import { clsx } from 'clsx';
import type { TopologyEdge, CloudResourceNode } from '../../types/topology';

export interface CanvasEdgeProps {
  edge: TopologyEdge;
  sourceNode?: CloudResourceNode;
  targetNode?: CloudResourceNode;
  isSelected?: boolean;
  onSelect?: (edgeId: string) => void;
  onDelete?: (edgeId: string) => void;
}

export const CanvasEdge: React.FC<CanvasEdgeProps> = ({
  edge,
  sourceNode,
  targetNode,
  isSelected = false,
  onSelect,
  onDelete,
}) => {
  if (!sourceNode || !targetNode) return null;

  // Compute node dimensions (matches 285px cards)
  const sw = sourceNode.width ?? 285;
  const sh = sourceNode.height ?? 92;
  const tw = targetNode.width ?? 285;
  const th = targetNode.height ?? 92;

  // Source and target center points
  const sCx = sourceNode.position.x + sw / 2;
  const sCy = sourceNode.position.y + sh / 2;
  const tCx = targetNode.position.x + tw / 2;
  const tCy = targetNode.position.y + th / 2;

  // Determine best connection ports based on relative position
  const dx = tCx - sCx;
  const dy = tCy - sCy;

  let sx: number, sy: number, tx: number, ty: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal dominant — connect right/left
    if (dx >= 0) {
      // Target is to the right
      sx = sourceNode.position.x + sw;
      sy = sCy;
      tx = targetNode.position.x;
      ty = tCy;
    } else {
      // Target is to the left
      sx = sourceNode.position.x;
      sy = sCy;
      tx = targetNode.position.x + tw;
      ty = tCy;
    }
  } else {
    // Vertical dominant — connect bottom/top
    if (dy >= 0) {
      // Target is below
      sx = sCx;
      sy = sourceNode.position.y + sh;
      tx = tCx;
      ty = targetNode.position.y;
    } else {
      // Target is above
      sx = sCx;
      sy = sourceNode.position.y;
      tx = tCx;
      ty = targetNode.position.y + th;
    }
  }

  // Smooth cubic Bezier control points adjusted for direction
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);
  const curvature = Math.max(40, (isHorizontal ? Math.abs(tx - sx) : Math.abs(ty - sy)) * 0.4);

  let pathData: string;
  if (isHorizontal) {
    pathData = `M ${sx} ${sy} C ${sx + (dx >= 0 ? curvature : -curvature)} ${sy}, ${tx + (dx >= 0 ? -curvature : curvature)} ${ty}, ${tx} ${ty}`;
  } else {
    pathData = `M ${sx} ${sy} C ${sx} ${sy + (dy >= 0 ? curvature : -curvature)}, ${tx} ${ty + (dy >= 0 ? -curvature : curvature)}, ${tx} ${ty}`;
  }

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  const label = edge.port
    ? `${edge.protocol || 'TCP'}:${edge.port}`
    : edge.type.replace(/_/g, ' ');

  return (
    <g
      className="cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(edge.id);
      }}
      data-testid={`canvas-edge-${edge.id}`}
    >
      {/* Invisible wider hit area for easy clicking */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
      />

      <path
        d={pathData}
        fill="none"
        stroke={isSelected ? '#F4F4F5' : 'rgba(255,255,255,0.14)'}
        strokeWidth={isSelected ? 2 : 1.5}
        className={clsx(
          'transition-colors duration-200',
          isSelected ? 'opacity-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]' : 'group-hover:stroke-white/30'
        )}
      />

      {/* Animated Subtle Data Stream */}
      <path
        d={pathData}
        fill="none"
        stroke={isSelected ? '#FFFFFF' : '#A1A1AA'}
        strokeWidth={1.5}
        strokeDasharray="6 14"
        className="animate-subtle-dash opacity-60 group-hover:opacity-100"
      />

      {/* Connection Endpoint Dots */}
      <circle cx={sx} cy={sy} r={2.5} fill="#D4D4D8" className="drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]" />
      <circle cx={tx} cy={ty} r={2.5} fill="#A1A1AA" className="drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]" />

      {/* Connection Label Pill with optional Delete button */}
      <foreignObject
        x={midX - 60}
        y={midY - 12}
        width={120}
        height={24}
        className="overflow-visible pointer-events-auto"
      >
        <div className="flex items-center justify-center h-full">
          <span
            className={clsx(
              'inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-mono rounded border uppercase tracking-wider select-none truncate transition-colors duration-200 shadow-sm backdrop-blur-md',
              isSelected
                ? 'bg-zinc-800 text-zinc-100 border-zinc-500 ring-1 ring-zinc-500/50'
                : 'bg-white/95 dark:bg-[#090A0C]/95 text-zinc-700 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 group-hover:border-zinc-300 dark:group-hover:border-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-zinc-200'
            )}
          >
            <span>{label}</span>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(edge.id);
                }}
                title="Delete connection"
                data-testid={`delete-edge-${edge.id}`}
                className="ml-1 text-zinc-500 hover:text-rose-400 font-bold px-0.5 rounded transition-colors cursor-pointer"
              >
                ×
              </button>
            )}
          </span>
        </div>
      </foreignObject>
    </g>
  );
};
