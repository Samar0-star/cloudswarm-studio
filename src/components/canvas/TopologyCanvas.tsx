import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { CanvasNode } from './CanvasNode';
import { CanvasEdge } from './CanvasEdge';
import { AgentCursor } from './AgentCursor';
import { BoundingHalo } from './BoundingHalo';
import { ThoughtBubble } from './ThoughtBubble';
import { Minimap } from './Minimap';
import { ResourcePalette } from './ResourcePalette';
import { NodeInspector } from './NodeInspector';
import { SummaryCard } from '../hud/SummaryCard';
import { JudgeTourSpotlight } from './JudgeTourSpotlight';
import { ChaosThreatOverlay } from './ChaosThreatOverlay';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import type { AgentId } from '../../types/swarm';
import type { CloudResourceType, CloudResourceNode } from '../../types/topology';
import { getResourceSchema } from '../../core/catalog/resourceCatalog';

export const TopologyCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    topologyState,
    selectedNodeId,
    hoveredNodeId,
    selectedEdgeId,
    agentPresences,
    activeLocks,
    canvasZoom,
    canvasPan,
    selectNode,
    openInspector,
    closeInspector,
    setHoveredNode,
    selectEdge,
    moveNode,
    addNode,
    addEdge,
    removeEdge,
    removeNode,
    setCanvasZoom,
    setCanvasPan,
    resetCanvasView,
    updateAgentPresence,
    isSimulating,
  } = useCloudSwarmStore();

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Interactive connection wire state for human users
  const connectionStateRef = useRef({
    connectingSourceNodeId: null as string | null,
    currentPos: { x: 0, y: 0 },
    hoverTargetNodeId: null as string | null,
  });
  const [connectingWire, setConnectingWire] = useState<{
    sourceNodeId: string;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [connectHoverTargetId, setConnectHoverTargetId] = useState<string | null>(null);
  const [clickConnectSourceId, setClickConnectSourceId] = useState<string | null>(null);

  const [containerDimensions, setContainerDimensions] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDims();
    window.addEventListener('resize', updateDims);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  // Handle Mouse Wheel: Deterministic Smooth Zoom & Horizontal Pan
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // Never zoom or pan the canvas when scrolling inside palettes, drawers, inspectors, or overlays
      if (
        target.closest(
          '[data-testid="resource-palette"], [data-testid="palette-expanded-menu"], [data-testid="node-inspector"], [data-testid="dag-timeline-bar"], [data-testid="minimap"], .nopan, .nodrag'
        )
      ) {
        return;
      }

      e.preventDefault();

      // Case 1: Shift + Scroll -> Pan horizontally
      if (e.shiftKey || Math.abs(e.deltaX) > 10) {
        setCanvasPan({
          x: canvasPan.x - (e.shiftKey ? e.deltaY : e.deltaX),
          y: canvasPan.y,
        });
        return;
      }

      // Case 2: Smooth CAD Zoom (pinch-to-zoom on trackpad or mouse wheel)
      const zoomFactor = e.deltaY > 0 ? 0.93 : 1.07;
      const nextZoom = Math.max(0.25, Math.min(2.5, canvasZoom * zoomFactor));
      setCanvasZoom(nextZoom);
    },
    [canvasZoom, setCanvasZoom, canvasPan, setCanvasPan]
  );

  const dragStateRef = useRef({
    draggingNodeId: null as string | null,
    isPanning: false,
    panStart: { x: 0, y: 0 },
    dragOffset: { x: 0, y: 0 },
    lastDragPos: null as { x: number; y: number } | null,
  });

  // Keep latest zoom/pan in refs so the persistent listener can read them
  const canvasPanRef = useRef(canvasPan);
  canvasPanRef.current = canvasPan;
  const canvasZoomRef = useRef(canvasZoom);
  canvasZoomRef.current = canvasZoom;
  const moveNodeRef = useRef(moveNode);
  moveNodeRef.current = moveNode;
  const setCanvasPanRef = useRef(setCanvasPan);
  setCanvasPanRef.current = setCanvasPan;

  const createAutoEdge = useCallback(
    (sourceId: string, targetId: string) => {
      const sNode = topologyState.nodes[sourceId];
      const tNode = topologyState.nodes[targetId];
      if (!sNode || !tNode || sourceId === targetId) return;

      // Idempotency: prevent duplicate edges between the same source and target
      const existingEdge = Object.values(topologyState.edges).find(
        (e) => e.source === sourceId && e.target === targetId
      );
      if (existingEdge) return;

      let edgeType = 'routes_to';
      let label = 'CONNECTED';
      let port: number | undefined = undefined;

      const sType = String(sNode.type);
      const tType = String(tNode.type);

      if (sType.includes('vpc') || sType.includes('vnet')) {
        edgeType = 'contains';
        label = 'CONTAINS';
      } else if (sType.includes('subnet')) {
        edgeType = 'contains';
        label = 'HOSTS';
      } else if (
        tType.includes('db') ||
        tType.includes('sql') ||
        tType.includes('postgres') ||
        tType.includes('aurora') ||
        tType.includes('rds')
      ) {
        edgeType = 'reads_from';
        label = 'TCP:5432';
        port = 5432;
      } else if (
        tType.includes('s3') ||
        tType.includes('bucket') ||
        tType.includes('storage') ||
        tType.includes('blob')
      ) {
        edgeType = 'stores_in';
        label = 'STORES IN';
      } else if (sType.includes('security') || sType.includes('waf') || sType.includes('kms')) {
        edgeType = 'protects';
        label = 'PROTECTS';
      } else if (sType.includes('lb') || sType.includes('load_balancer')) {
        edgeType = 'routes_to';
        label = 'PORT:443';
        port = 443;
      }

      addEdge({
        id: `edge_${sourceId}_${targetId}_${Date.now()}`,
        source: sourceId,
        target: targetId,
        type: edgeType,
        label,
        port,
        protocol: port ? 'tcp' : undefined,
        version: 1,
      }, 'director');
    },
    [topologyState.nodes, topologyState.edges, addEdge]
  );

  const createAutoEdgeRef = useRef(createAutoEdge);
  createAutoEdgeRef.current = createAutoEdge;

  // One-time global listener registration — never tears down during drag
  useEffect(() => {
    const onGlobalMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      const cs = connectionStateRef.current;
      if (!ds.draggingNodeId && !ds.isPanning && !cs.connectingSourceNodeId) return;
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const zoom = canvasZoomRef.current;
      const pan = canvasPanRef.current;
      const canvasX = (rawX - pan.x) / zoom;
      const canvasY = (rawY - pan.y) / zoom;

      if (cs.connectingSourceNodeId) {
        cs.currentPos = { x: canvasX, y: canvasY };
        setConnectingWire({
          sourceNodeId: cs.connectingSourceNodeId,
          currentX: canvasX,
          currentY: canvasY,
        });
        return;
      }

      if (ds.isPanning) {
        setCanvasPanRef.current({
          x: e.clientX - ds.panStart.x,
          y: e.clientY - ds.panStart.y,
        });
        return;
      }

      if (ds.draggingNodeId) {
        const nextX = Math.round(canvasX - ds.dragOffset.x);
        const nextY = Math.round(canvasY - ds.dragOffset.y);
        ds.lastDragPos = { x: nextX, y: nextY };
        
        moveNodeRef.current(ds.draggingNodeId, { x: nextX, y: nextY });
      }
    };

    const onGlobalMouseUp = () => {
      const ds = dragStateRef.current;
      const cs = connectionStateRef.current;

      if (cs.connectingSourceNodeId) {
        const sId = cs.connectingSourceNodeId;
        const tId = cs.hoverTargetNodeId;
        if (sId && tId && sId !== tId) {
          createAutoEdgeRef.current(sId, tId);
        }
        cs.connectingSourceNodeId = null;
        cs.hoverTargetNodeId = null;
        setConnectingWire(null);
        setConnectHoverTargetId(null);
      }

      if (ds.isPanning) {
        ds.isPanning = false;
        setIsPanning(false);
      }
      if (ds.draggingNodeId) {
        if (ds.lastDragPos) {
          moveNodeRef.current(ds.draggingNodeId, ds.lastDragPos);
        }
        ds.draggingNodeId = null;
        ds.lastDragPos = null;
        setDraggingNodeId(null);
      }
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, []); // Empty deps — registered once, never re-registered

  // Keyboard shortcut listener: Delete, Backspace, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Escape') {
        setClickConnectSourceId(null);
        if (connectionStateRef.current.connectingSourceNodeId) {
          connectionStateRef.current.connectingSourceNodeId = null;
          setConnectingWire(null);
        }
        selectNode(null);
        closeInspector();
        selectEdge(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) {
          removeEdge(selectedEdgeId);
          selectEdge(null);
        } else if (selectedNodeId) {
          removeNode(selectedNodeId);
          selectNode(null);
          closeInspector();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId, selectedNodeId, removeEdge, removeNode, selectEdge, selectNode, closeInspector]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // Allow panning when clicking anywhere on canvas background (not inside a node card, button, input, etc.)
      const isInteractive = Boolean(
        target.closest('[data-testid^="node-"], [data-testid^="agent-cursor-"], button, input, textarea, select, .nodrag')
      );

      if (!isInteractive && (e.button === 0 || e.button === 1)) {
        dragStateRef.current.isPanning = true;
        dragStateRef.current.panStart = { x: e.clientX - canvasPan.x, y: e.clientY - canvasPan.y };
        setIsPanning(true);
        selectNode(null);
        closeInspector();
        selectEdge(null);
        setClickConnectSourceId(null);
      }
    },
    [canvasPan, selectNode, selectEdge, closeInspector]
  );

  const handleNodeDragStart = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      if (connectionStateRef.current.connectingSourceNodeId || clickConnectSourceId) return;
      const node = topologyState.nodes[nodeId];
      if (!node) return;

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const canvasX = (rawX - canvasPan.x) / canvasZoom;
      const canvasY = (rawY - canvasPan.y) / canvasZoom;

      dragStateRef.current.draggingNodeId = nodeId;
      dragStateRef.current.dragOffset = {
        x: canvasX - node.position.x,
        y: canvasY - node.position.y,
      };
      setDraggingNodeId(nodeId);
      selectNode(nodeId);
    },
    [topologyState.nodes, canvasPan, canvasZoom, selectNode]
  );

  const handleStartConnect = useCallback(
    (sourceNodeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const canvasX = (rawX - canvasPanRef.current.x) / canvasZoomRef.current;
      const canvasY = (rawY - canvasPanRef.current.y) / canvasZoomRef.current;

      connectionStateRef.current.connectingSourceNodeId = sourceNodeId;
      connectionStateRef.current.currentPos = { x: canvasX, y: canvasY };
      connectionStateRef.current.hoverTargetNodeId = null;

      setConnectingWire({
        sourceNodeId,
        currentX: canvasX,
        currentY: canvasY,
      });
      setConnectHoverTargetId(null);
    },
    []
  );

  const handleCompleteConnect = useCallback(
    (targetNodeId: string) => {
      const sourceId = connectingWire?.sourceNodeId || clickConnectSourceId;
      if (sourceId && sourceId !== targetNodeId) {
        createAutoEdge(sourceId, targetNodeId);
      }
      connectionStateRef.current.connectingSourceNodeId = null;
      connectionStateRef.current.hoverTargetNodeId = null;
      setConnectingWire(null);
      setConnectHoverTargetId(null);
      setClickConnectSourceId(null);
    },
    [connectingWire, clickConnectSourceId, createAutoEdge]
  );

  const handleToggleClickConnect = useCallback((nodeId: string) => {
    setClickConnectSourceId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (clickConnectSourceId) {
        if (clickConnectSourceId !== nodeId) {
          createAutoEdge(clickConnectSourceId, nodeId);
        }
        setClickConnectSourceId(null);
      } else {
        selectNode(nodeId);
      }
    },
    [clickConnectSourceId, createAutoEdge, selectNode]
  );

  const renderPendingWire = (sourceNode: CloudResourceNode, curX: number, curY: number) => {
    const sw = sourceNode.width ?? 285;
    const sh = sourceNode.height ?? 92;
    const sx = sourceNode.position.x + sw;
    const sy = sourceNode.position.y + sh / 2;
    const tx = curX;
    const ty = curY;

    const dx = tx - sx;
    const curvature = Math.max(40, Math.abs(dx) * 0.4);

    return `M ${sx} ${sy} C ${sx + curvature} ${sy}, ${tx - curvature} ${ty}, ${tx} ${ty}`;
  };

  // Handle Drag-and-Drop from ResourcePalette onto Canvas
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!containerRef.current) return;

      let itemData: { type: CloudResourceType; name?: string; defaultConfig?: Record<string, unknown> } | null = null;
      try {
        const jsonStr = e.dataTransfer.getData('application/json');
        if (jsonStr) {
          itemData = JSON.parse(jsonStr);
        }
      } catch {
        // fallback to text/plain
      }

      const rawType = e.dataTransfer.getData('text/plain') || itemData?.type;
      if (!rawType) return;

      const resourceType = rawType as CloudResourceType;
      const schema = getResourceSchema(resourceType);
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      // Center the 285x92 node card directly under the mouse pointer (clamped to positive coordinates)
      const dropX = Math.max(40, Math.round((rawX - canvasPan.x) / canvasZoom) - 143);
      const dropY = Math.max(40, Math.round((rawY - canvasPan.y) / canvasZoom) - 46);

      const existingCount = Object.values(topologyState.nodes).filter(
        (n) => n.type === resourceType
      ).length;
      const cleanPrefix = resourceType
        .replace(/^aws_/, '')
        .replace(/^azurerm_/, '')
        .replace(/^google_/, '');
      const nodeId = `${cleanPrefix}_${existingCount + 1}`;
      const name = itemData?.name || schema?.name || `${resourceType} ${existingCount + 1}`;
      const defaultConfig = itemData?.defaultConfig || schema?.defaultConfig || {};

      // Check if dropped inside a container node (VPC or Subnet)
      let parentId: string | undefined = undefined;
      for (const pNode of Object.values(topologyState.nodes)) {
        if (pNode.type.includes('vpc') || pNode.type.includes('vnet') || pNode.type.includes('subnet')) {
          const pw = pNode.width ?? (pNode.type.includes('vpc') ? 800 : 400);
          const ph = pNode.height ?? (pNode.type.includes('vpc') ? 600 : 300);
          if (
            dropX >= pNode.position.x &&
            dropX <= pNode.position.x + pw &&
            dropY >= pNode.position.y &&
            dropY <= pNode.position.y + ph
          ) {
            parentId = pNode.id;
            break;
          }
        }
      }

      addNode({
        id: nodeId,
        type: resourceType,
        name: `${name} ${existingCount + 1}`,
        position: { x: dropX, y: dropY },
        parentId,
        config: { ...defaultConfig },
        metadata: {
          createdBy: 'director',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          status: 'healthy',
        },
        version: 1,
      });

      if (parentId) {
        addEdge({
          id: `edge_${parentId}_${nodeId}_${Date.now()}`,
          source: parentId,
          target: nodeId,
          type: 'contains',
          label: 'CONTAINS',
          version: 1,
        });
      }

      selectNode(nodeId);

      updateAgentPresence('director', {
        isDragging: false,
        draggedItemType: undefined,
        draggedItemName: undefined,
      });
    },
    [canvasPan, canvasZoom, topologyState.nodes, addNode, addEdge, selectNode, updateAgentPresence]
  );

  // Map active locks by entity ID
  const locksMap = new Map<string, AgentId>();
  for (const lock of activeLocks) {
    locksMap.set(lock.entityId, lock.agentId);
  }

  // Active Multi-Agent swarm personas on canvas (Alpha, Beta, Gamma, Delta, External 1-4)
  const activeAgentIds = (['alpha', 'beta', 'gamma', 'delta', 'ext-1', 'ext-2', 'ext-3', 'ext-4'] as AgentId[]).filter((id) => {
    const p = agentPresences[id];
    return Boolean(p && p.isVisible && (p.opacity ?? 0) > 0);
  });

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full h-full bg-slate-50 dark:bg-[#090A0C] transition-colors duration-200 overflow-hidden select-none cursor-grab active:cursor-grabbing"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid="topology-canvas"
    >
      {/* Background Dot Grid for Depth (Dark & Light responsive) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50 dark:opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle at center, currentColor 1px, transparent 1px)',
          backgroundSize: `${24 * canvasZoom}px ${24 * canvasZoom}px`,
          backgroundPosition: `${canvasPan.x}px ${canvasPan.y}px`,
          color: 'var(--canvas-grid-dot, #CBD5E1)',
        }}
      />
      
      {/* Subtle Vignette for Depth in Dark Mode only */}
      <div className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-100 dark:shadow-[inset_0_0_150px_rgba(0,0,0,0.6)] z-[5] transition-opacity duration-200" />

      {/* Interactive Connection Mode HUD Banner */}
      {(clickConnectSourceId || connectingWire) && (
        <div
          data-testid="connection-mode-hud"
          className="absolute top-14 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-3 px-4 py-2 rounded-xl bg-[#090A0C]/95 border border-zinc-700 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2"
        >
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-xs font-mono text-zinc-200">
            {clickConnectSourceId
              ? `Linking from "${topologyState.nodes[clickConnectSourceId]?.name || clickConnectSourceId}": Click any target node to connect`
              : `Dragging connection wire: Release over any node to connect`}
          </span>
          <button
            onClick={() => {
              setClickConnectSourceId(null);
              setConnectingWire(null);
              connectionStateRef.current.connectingSourceNodeId = null;
            }}
            className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
          >
            Cancel (Esc)
          </button>
        </div>
      )}

      {/* Main Transform Container for 60 FPS Zoom/Pan */}
      <div
        style={{
          transform: `translate3d(${canvasPan.x}px, ${canvasPan.y}px, 0) scale(${canvasZoom})`,
          transformOrigin: '0 0',
        }}
        className="absolute top-0 left-0 w-full h-full pointer-events-auto"
      >
        {/* SVG Edges Layer */}
        <svg
          className="absolute inset-0 overflow-visible w-full h-full pointer-events-none"
          style={{ width: '4000px', height: '4000px' }}
        >
          {Object.values(topologyState.edges)
            .filter((edge) => topologyState.nodes[edge.source] && topologyState.nodes[edge.target])
            .map((edge) => (
              <CanvasEdge
                key={edge.id}
                edge={edge}
                sourceNode={topologyState.nodes[edge.source]}
                targetNode={topologyState.nodes[edge.target]}
                isSelected={selectedEdgeId === edge.id}
                onSelect={selectEdge}
                onDelete={(edgeId) => {
                  removeEdge(edgeId);
                  selectEdge(null);
                }}
              />
            ))}

          {/* Pending Connection Wire while dragging */}
          {connectingWire && topologyState.nodes[connectingWire.sourceNodeId] && (
            <g className="pointer-events-none">
              <path
                d={renderPendingWire(
                  topologyState.nodes[connectingWire.sourceNodeId]!,
                  connectingWire.currentX,
                  connectingWire.currentY
                )}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              <circle
                cx={connectingWire.currentX}
                cy={connectingWire.currentY}
                r={4}
                fill="#38bdf8"
              />
              <circle
                cx={connectingWire.currentX}
                cy={connectingWire.currentY}
                r={4}
                fill="#FFFFFF"
              />
            </g>
          )}
        </svg>

        {/* Bounding Halos for Active Multi-Agent Locks */}
        {Object.values(topologyState.nodes).map((node) => {
          const lockedAgent = locksMap.get(node.id);
          if (!lockedAgent) return null;
          return <BoundingHalo key={`halo-${node.id}`} node={node} agentId={lockedAgent} />;
        })}

        {/* Nodes Layer */}
        {Object.values(topologyState.nodes).map((node) => (
          <CanvasNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            isHovered={hoveredNodeId === node.id}
            isDragging={draggingNodeId === node.id}
            lockedByAgent={locksMap.get(node.id) ?? null}
            inspectedByAgent={
              Object.values(agentPresences).find((p) => p.activeNodeId === node.id)?.agentId ?? null
            }
            isConnecting={Boolean(connectingWire || clickConnectSourceId)}
            isConnectSource={connectingWire?.sourceNodeId === node.id || clickConnectSourceId === node.id}
            isConnectTarget={
              connectHoverTargetId === node.id ||
              (clickConnectSourceId !== null && clickConnectSourceId !== node.id && hoveredNodeId === node.id)
            }
            isClickConnectSource={clickConnectSourceId === node.id}
            onSelect={handleNodeClick}
            onDoubleClick={openInspector}
            onDragStart={handleNodeDragStart}
            onHover={(id) => {
              setHoveredNode(id);
              if (connectionStateRef.current.connectingSourceNodeId) {
                connectionStateRef.current.hoverTargetNodeId = id;
                setConnectHoverTargetId(id);
              }
            }}
            onStartConnect={handleStartConnect}
            onCompleteConnect={handleCompleteConnect}
            onToggleClickConnect={handleToggleClickConnect}
            onDeleteNode={(id) => {
              removeNode(id);
              if (selectedNodeId === id) selectNode(null);
            }}
          />
        ))}

        {/* Multi-Agent Presence Layer: 4-Agent Sleek Cursors & Real-Time Thought Bubbles */}
        {activeAgentIds.map((agentId) => {
          const presence = agentPresences[agentId];
          if (!presence) return null;
          return (
            <React.Fragment key={agentId}>
              <AgentCursor presence={presence} />
              {isSimulating && presence.thoughtText && (presence.isClicking || presence.isInspecting) && (
                <ThoughtBubble presence={presence} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Resource Palette (Left Toolbar) */}
      <ResourcePalette />

      {/* Floating Architecture Result Summary Card */}
      <SummaryCard />

      {/* Chaos Gorilla & Cyber Threat Defense Overlay */}
      <ChaosThreatOverlay />

      {/* VIP Guided Judge Tour Spotlight */}
      <JudgeTourSpotlight />

      {/* Node Inspector (Right Sidebar Drawer) */}
      <NodeInspector />

      {/* Floating Canvas Controls (Zoom / Pan / Fit) */}
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-1 p-1 bg-[#0F1011]/95 border border-white/[0.08] rounded-xl shadow-2xl backdrop-blur-xl">
        <button
          onClick={() => setCanvasZoom(Math.min(2.5, canvasZoom + 0.15))}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#8A8F98] hover:text-[#F7F8F8] transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setCanvasZoom(Math.max(0.2, canvasZoom - 0.15))}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#8A8F98] hover:text-[#F7F8F8] transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <div className="h-3 w-[1px] bg-white/[0.08] mx-0.5" />
        <button
          onClick={resetCanvasView}
          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-[#8A8F98] hover:text-[#F7F8F8] transition-colors cursor-pointer"
          title="Reset View (100%)"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <span className="text-[10px] font-mono text-[#8A8F98] px-1.5 select-none">
          {Math.round(canvasZoom * 100)}%
        </span>
      </div>

      {/* Canvas Minimap */}
      <Minimap
        topologyState={topologyState}
        pan={canvasPan}
        zoom={canvasZoom}
        containerWidth={containerDimensions.width}
        containerHeight={containerDimensions.height}
        onNavigate={setCanvasPan}
      />
    </div>
  );
};
