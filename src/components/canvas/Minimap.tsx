import React from 'react';
import type { TopologyState } from '../../types/topology';

export interface MinimapProps {
  topologyState: TopologyState;
  pan: { x: number; y: number };
  zoom: number;
  containerWidth: number;
  containerHeight: number;
  onNavigate?: (newPan: { x: number; y: number }) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  topologyState,
  pan,
  zoom,
  containerWidth,
  containerHeight,
  onNavigate,
}) => {
  const mapWidth = 160;
  const mapHeight = 110;
  const scale = 0.08;

  const nodes = Object.values(topologyState.nodes);

  // Compute viewport rectangle in minimap coordinates
  const vpX = Math.max(0, (-pan.x * scale) / zoom);
  const vpY = Math.max(0, (-pan.y * scale) / zoom);
  const vpW = Math.min(mapWidth, (containerWidth * scale) / zoom);
  const vpH = Math.min(mapHeight, (containerHeight * scale) / zoom);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const targetX = -(clickX / scale) * zoom + containerWidth / 2;
    const targetY = -(clickY / scale) * zoom + containerHeight / 2;

    onNavigate?.({ x: targetX, y: targetY });
  };

  return (
    <div
      className="absolute bottom-4 right-4 z-20 w-[160px] h-[110px] bg-white/95 dark:bg-[#0F1011]/95 border border-zinc-200 dark:border-white/[0.08] rounded-xl shadow-xl backdrop-blur-xl overflow-hidden cursor-pointer select-none group"
      onClick={handleClick}
      title="Canvas Overview — Click to pan"
      data-testid="canvas-minimap"
    >
      {/* Top Header */}
      <div className="absolute top-1.5 left-2 z-10 flex items-center space-x-1 pointer-events-none">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
        <span className="text-[8px] font-mono text-zinc-500 dark:text-[#8A8F98] font-bold uppercase tracking-widest">MAP</span>
      </div>

      <svg width={mapWidth} height={mapHeight} className="w-full h-full p-1">

        {/* Render Mini Edges */}
        {Object.values(topologyState.edges).map((edge) => {
          const src = topologyState.nodes[edge.source];
          const tgt = topologyState.nodes[edge.target];
          if (!src || !tgt) return null;
          return (
            <line
              key={edge.id}
              x1={(src.position.x + 115) * scale}
              y1={(src.position.y + 40) * scale}
              x2={(tgt.position.x + 115) * scale}
              y2={(tgt.position.y + 40) * scale}
              stroke="currentColor"
              className="text-zinc-400 dark:text-zinc-600"
              strokeWidth={1}
              opacity={0.6}
            />
          );
        })}

        {/* Render Mini Nodes with Category Colors */}
        {nodes.map((node) => {
          let nodeColor = '#0284C7';
          if (node.type.includes('db') || node.type.includes('database') || node.type.includes('sql')) {
            nodeColor = '#9333EA';
          } else if (node.type.includes('instance') || node.type.includes('vm') || node.type.includes('compute')) {
            nodeColor = '#16A34A';
          } else if (node.type.includes('security') || node.type.includes('iam') || node.type.includes('waf')) {
            nodeColor = '#E11D48';
          } else if (node.type.includes('s3') || node.type.includes('storage') || node.type.includes('blob')) {
            nodeColor = '#D97706';
          }

          return (
            <rect
              key={node.id}
              x={node.position.x * scale}
              y={node.position.y * scale}
              width={Math.max(12, 230 * scale)}
              height={Math.max(6, 80 * scale)}
              rx={1.5}
              className="fill-white dark:fill-[#17181A]"
              stroke={nodeColor}
              strokeWidth={1}
            />
          );
        })}

        {/* Viewport Camera Box */}
        <rect
          x={vpX}
          y={vpY}
          width={Math.max(14, vpW)}
          height={Math.max(10, vpH)}
          fill="rgba(94, 106, 210, 0.15)"
          stroke="#4F46E5"
          strokeWidth={1.2}
          rx={2}
        />
      </svg>
    </div>
  );
};
