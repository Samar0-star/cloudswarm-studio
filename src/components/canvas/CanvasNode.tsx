import React from 'react';
import { clsx } from 'clsx';
import {
  Server,
  Database,
  HardDrive,
  Shield,
  Network,
  Layers,
  Cpu,
  KeyRound,
  Globe,
  Radio,
  Lock,
  Plus,
  Link2,
  Trash2,
} from 'lucide-react';
import type { CloudResourceNode, AWSResourceType } from '../../types/topology';
import type { AgentId } from '../../types/swarm';
import { AGENT_PERSONAS, getAgentPersona } from '../../types/swarm';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';

export interface CanvasNodeProps {
  node: CloudResourceNode;
  isSelected?: boolean;
  isHovered?: boolean;
  isDragging?: boolean;
  lockedByAgent?: AgentId | null;
  inspectedByAgent?: AgentId | null;
  isConnecting?: boolean;
  isConnectSource?: boolean;
  isConnectTarget?: boolean;
  isClickConnectSource?: boolean;
  onSelect?: (nodeId: string) => void;
  onDoubleClick?: (nodeId: string) => void;
  onDragStart?: (e: React.MouseEvent, nodeId: string) => void;
  onHover?: (nodeId: string | null) => void;
  onStartConnect?: (nodeId: string, e: React.MouseEvent) => void;
  onCompleteConnect?: (nodeId: string) => void;
  onToggleClickConnect?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({
  node,
  isSelected = false,
  isHovered = false,
  isDragging = false,
  lockedByAgent,
  inspectedByAgent,
  isConnecting = false,
  isConnectSource = false,
  isConnectTarget = false,
  isClickConnectSource = false,
  onSelect,
  onDoubleClick,
  onDragStart,
  onHover,
  onStartConnect,
  onCompleteConnect,
  onToggleClickConnect,
  onDeleteNode,
}) => {
  const summonAgent = useCloudSwarmStore((state) => state.summonAgent);

  const getResourceIcon = (type: AWSResourceType) => {
    switch (type) {
      case 'aws_vpc':
        return <Globe className="h-3.5 w-3.5 text-cyan-400" />;
      case 'aws_subnet':
        return <Network className="h-3.5 w-3.5 text-sky-400" />;
      case 'aws_instance':
        return <Server className="h-3.5 w-3.5 text-emerald-400" />;
      case 'aws_ecs_cluster':
        return <Layers className="h-3.5 w-3.5 text-teal-400" />;
      case 'aws_eks_cluster':
        return <Cpu className="h-3.5 w-3.5 text-[#818CF8]" />;
      case 'aws_db_instance':
        return <Database className="h-3.5 w-3.5 text-purple-400" />;
      case 'aws_s3_bucket':
        return <HardDrive className="h-3.5 w-3.5 text-amber-400" />;
      case 'aws_lb':
        return <Radio className="h-3.5 w-3.5 text-blue-400" />;
      case 'aws_security_group':
        return <Shield className="h-3.5 w-3.5 text-rose-400" />;
      case 'aws_iam_role':
        return <KeyRound className="h-3.5 w-3.5 text-orange-400" />;
      default:
        return <Server className="h-3.5 w-3.5 text-[#8A8F98]" />;
    }
  };

  const getSummaryLine = (node: CloudResourceNode): string => {
    const cfg = node.config;
    switch (node.type) {
      case 'aws_vpc':
        return String(cfg['cidr_block'] || '10.0.0.0/16');
      case 'aws_subnet':
        return `${cfg['cidr_block'] || '10.0.1.0/24'} • ${cfg['availability_zone'] || 'us-east-1a'}`;
      case 'aws_instance':
        return `${cfg['instance_type'] || 't3.micro'} • ${cfg['root_volume_type'] || 'gp3'}`;
      case 'aws_db_instance':
        return `${cfg['engine'] || 'postgres'} • ${cfg['instance_class'] || 'db.t3.medium'}`;
      case 'aws_s3_bucket':
        return `${cfg['bucket_name'] || node.id}`;
      case 'aws_lb':
        return `${cfg['load_balancer_type'] || 'application'} • HTTPS`;
      case 'aws_security_group':
        return `Security Group • ${cfg['vpc_id'] || 'vpc'}`;
      case 'aws_ecs_cluster':
        return `ECS Fargate • ${cfg['desired_count'] || 1} tasks`;
      case 'aws_eks_cluster':
        return `EKS Kubernetes v${cfg['kubernetes_version'] || '1.30'}`;
      default:
        return node.type;
    }
  };

  const lockedPersona = lockedByAgent ? getAgentPersona(lockedByAgent) : null;
  const statusColor = node.metadata?.status === 'warning' ? '#F59E0B' : node.metadata?.status === 'error' ? '#EF4444' : '#22C55E';

  // Detect provider from type prefix for micro-badge
  const provider = node.type.startsWith('azurerm_') ? 'Azure' : node.type.startsWith('google_') ? 'GCP' : 'AWS';

  return (
    <div
      style={{
        transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
      }}
      data-id={node.id} className={clsx(
        'absolute top-0 left-0 w-[285px] rounded-xl group select-none',
        !isDragging && 'transition-all duration-200',
        isSelected
          ? 'z-30 scale-[1.01]'
          : isConnectTarget
          ? 'z-30 ring-1 ring-emerald-500/90 scale-[1.02]'
          : isClickConnectSource
          ? 'z-30 ring-1 ring-sky-500/90'
          : isHovered
          ? 'z-20'
          : 'z-10'
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (isClickConnectSource) {
          onToggleClickConnect?.(node.id);
        } else if (isConnecting) {
          onCompleteConnect?.(node.id);
        } else {
          onSelect?.(node.id);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(node.id);
      }}
      onMouseUp={(e) => {
        // Magnetic snap: releasing wire anywhere on target card completes connection
        if (isConnecting) {
          e.stopPropagation();
          onCompleteConnect?.(node.id);
        }
      }}
      onMouseDown={(e) => {
        if (!lockedPersona) {
          onDragStart?.(e, node.id);
        }
      }}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={() => onHover?.(null)}
      data-testid={`canvas-node-${node.id}`}
    >
      {/* Sleek Node Action Controls on selection */}
      {isSelected && (
        <div
          data-testid={`node-actions-${node.id}`}
          className="absolute -top-8 right-0 z-50 flex items-center space-x-1 px-2 py-1 rounded-lg bg-white/95 dark:bg-[#090A0C]/95 border border-zinc-200 dark:border-zinc-700/80 shadow-md backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 text-zinc-700 dark:text-zinc-300"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            title="Inspect Resource Configuration"
            onClick={(e) => {
              e.stopPropagation();
              onDoubleClick?.(node.id);
            }}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <span>Config</span>
          </button>
          <button
            title="Connect / Link to another resource"
            onClick={(e) => {
              e.stopPropagation();
              onToggleClickConnect?.(node.id);
            }}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[10px] font-mono text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
          >
            <Link2 className="h-3 w-3 text-sky-400" />
            <span>Link</span>
          </button>
          <button
            title="Delete Node (Backspace)"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode?.(node.id);
            }}
            className="flex items-center px-1.5 py-0.5 rounded hover:bg-rose-500/10 text-[10px] font-mono text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Output Port Handle (Right) — Drag from here to connect */}
      <div
        data-testid={`connect-handle-${node.id}`}
        title="Drag to connect this node to another resource"
        className={clsx(
          "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-crosshair z-40 transition-all duration-150 border",
          isConnectSource
            ? "bg-zinc-800 border-sky-400 text-sky-400 scale-110"
            : "bg-zinc-950 border-zinc-700 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 hover:border-zinc-500 opacity-80 group-hover:opacity-100"
        )}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartConnect?.(node.id, e);
        }}
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
      </div>

      {/* Input Port Handle (Left) — Drop wire here to connect */}
      <div
        data-testid={`input-port-${node.id}`}
        title="Drop wire here to connect"
        className={clsx(
          "absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center z-40 transition-all duration-150 border",
          isConnectTarget
            ? "bg-zinc-800 border-emerald-400 text-emerald-400 scale-110"
            : isConnecting
            ? "bg-zinc-900 border-zinc-600 text-zinc-400 opacity-100"
            : "bg-zinc-950 border-zinc-800 text-zinc-500 opacity-0 group-hover:opacity-70"
        )}
        onMouseUp={(e) => {
          if (isConnecting) {
            e.stopPropagation();
            onCompleteConnect?.(node.id);
          }
        }}
      >
        <div className="w-2 h-2 rounded-full bg-current" />
      </div>

      {/* Outer Ring & Shadow */}
      <div data-id={node.id} className={clsx(
        "absolute inset-0 rounded-xl transition-all duration-200 pointer-events-none",
        isSelected ? "shadow-[0_0_0_2px_rgba(255,255,255,0.95),0_24px_48px_-12px_rgba(0,0,0,0.95)]" :
        isHovered ? "shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_20px_36px_-10px_rgba(0,0,0,0.85)]" :
        "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_28px_-12px_rgba(0,0,0,0.85)]"
      )} />

      {/* Main Card */}
      <div className={clsx(
        "relative h-full w-full bg-white/98 dark:bg-[#111214]/98 backdrop-blur-2xl rounded-xl overflow-hidden transition-all duration-300 shadow-sm",
        ((node.metadata?.status as string) === 'degraded' || node.config?._chaosStatus === 'degraded')
          ? "border border-rose-500/70 bg-rose-50/50 dark:bg-[#140D0E]"
          : ((node.metadata?.status as string) === 'compromised' || node.config?._threatStatus === 'compromised')
          ? "border border-amber-500/70 bg-amber-50/50 dark:bg-[#141008]"
          : "border border-zinc-200 dark:border-zinc-800/70"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center space-x-2.5 truncate min-w-0">
            <div data-id={node.id} className={clsx(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all",
              isSelected ? "bg-zinc-200 dark:bg-zinc-800 border-zinc-400 dark:border-zinc-500 text-zinc-900 dark:text-zinc-100" : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
            )}>
              {getResourceIcon(node.type)}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center space-x-1.5 truncate">
                <span data-id={node.id} className={clsx(
                  "text-xs font-bold tracking-tight truncate leading-tight",
                  isSelected ? "text-zinc-950 dark:text-white" : "text-zinc-900 dark:text-zinc-100"
                )}>
                  {node.name}
                </span>
                {((node.metadata?.status as string) === 'degraded' || node.config?._chaosStatus === 'degraded') && (
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-medium uppercase bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                    AZ Outage
                  </span>
                )}
                {((node.metadata?.status as string) === 'compromised' || node.config?._threatStatus === 'compromised') && (
                  <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-medium uppercase bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Breach
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 leading-tight truncate font-medium mt-0.5">
                {node.type}
              </span>
            </div>
          </div>

          {/* Right: Actions & Status */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Quick Connect & Delete buttons */}
            <div className="flex items-center space-x-0.5">
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleClickConnect?.(node.id);
                }}
                title={isClickConnectSource ? "Cancel connection mode" : "Click to connect to another node"}
                data-testid={`node-connect-btn-${node.id}`}
                className={clsx(
                  "p-1 rounded transition-colors cursor-pointer",
                  isClickConnectSource
                    ? "bg-zinc-200 dark:bg-zinc-800 text-sky-500 dark:text-sky-400 ring-1 ring-sky-500/80"
                    : "text-zinc-400 hover:text-zinc-800 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
                )}
              >
                <Link2 className="h-3 w-3" />
              </button>
              {onDeleteNode && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNode(node.id);
                  }}
                  title="Delete resource node"
                  data-testid={`node-delete-btn-${node.id}`}
                  className="p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            {lockedPersona ? (
              <div
                className="flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[8px] font-mono font-bold tracking-wider border animate-in zoom-in duration-200"
                style={{
                  borderColor: `${lockedPersona.hexCode}40`,
                  backgroundColor: `${lockedPersona.hexCode}12`,
                  color: lockedPersona.hexCode,
                }}
              >
                <Lock className="h-2 w-2" />
                <span>{lockedByAgent?.toUpperCase()}</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
                <span className="text-[8px] font-mono text-zinc-500 font-semibold">{provider}</span>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-3.5 py-2.5 space-y-1.5">
          <div className="flex items-center px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-[#0A0B0D] border border-zinc-200 dark:border-zinc-800/60 shadow-inner">
            <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 font-medium truncate">
              {getSummaryLine(node)}
            </span>
          </div>
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-mono text-zinc-500 font-medium">status: {node.metadata?.status ?? 'healthy'}</span>
            <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">v{node.version}</span>
          </div>
        </div>

        {/* Active Inspection Line */}
        {inspectedByAgent && !lockedPersona && (
          <div
            className="absolute bottom-0 left-0 h-[2px] w-full opacity-90"
            style={{ backgroundColor: getAgentPersona(inspectedByAgent).hexCode }}
          />
        )}
      </div>
    </div>
  );
};
