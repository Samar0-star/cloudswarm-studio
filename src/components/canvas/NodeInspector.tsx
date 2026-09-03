import React, { useState, useMemo } from 'react';
import {
  X,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  Wrench,
  Lock,
  Globe,
  Network,
  Server,
  Layers,
  Cpu,
  Database,
  HardDrive,
  Radio,
  Shield,
  KeyRound,
  Zap,
  Boxes,
  BrainCircuit,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import type { CloudResourceType, CloudProvider, ResourceCategory } from '../../types/topology';
import type { SecurityFinding } from '../../types/audit';
import { AGENT_PERSONAS, getAgentPersona } from '../../types/swarm';
import {
  getResourceSchema,
  getProviderForResourceType,
  getCategoryForResourceType,
} from '../../core/catalog/resourceCatalog';
import { calculateNodeCost } from '../../core/audit/CostCalculator';

interface NodeInspectorContentProps {
  nodeId: string;
}

const NodeInspectorContent: React.FC<NodeInspectorContentProps> = ({ nodeId }) => {
  const {
    selectNode,
    closeInspector,
    topologyState,
    updateNodeConfig,
    removeNode,
    addEdge,
    removeEdge,
    auditReport,
    activeLocks,
  } = useCloudSwarmStore();

  const node = topologyState.nodes[nodeId];
  if (!node) return null;

  const activeLock = activeLocks.find((l) => l.entityId === node.id);
  const lockedPersona = activeLock ? getAgentPersona(activeLock.agentId) : null;

  const schema = getResourceSchema(node.type);
  const provider: CloudProvider = getProviderForResourceType(node.type) || (node.type.startsWith('azure') ? 'azure' : node.type.startsWith('google') ? 'google' : 'aws');
  const category: ResourceCategory = getCategoryForResourceType(node.type) || 'Compute';

  // Filter security findings for this specific node
  const nodeFindings = (auditReport.findings || []).filter(
    (f: SecurityFinding) => f.target_node_id === node.id
  );

  // Compute real-time live node monthly cost dynamically
  const liveCost = useMemo(() => {
    // First try calculator
    const calcCost = calculateNodeCost(node);
    if (calcCost && calcCost.monthlyUsd > 0) {
      return calcCost.monthlyUsd;
    }
    // Fallback to catalog pricing model
    if (schema?.pricingModel) {
      let rate = schema.pricingModel.baseMonthlyRate || 0;
      // Variable pricing check
      const varPricing = schema.pricingModel.variablePricing;
      if (varPricing) {
        const instType = String(
          node.config['instance_type'] ||
            node.config['size'] ||
            node.config['machine_type'] ||
            node.config['sku_name'] ||
            node.config['tier'] ||
            ''
        );
        if (varPricing[instType]) {
          rate = varPricing[instType];
        }
      }
      return rate;
    }
    return 0;
  }, [node, schema]);

  // Connection management state
  const [targetConnectId, setTargetConnectId] = useState('');
  const [relationType, setRelationType] = useState('routes_to');

  const connectedEdges = useMemo(() => {
    return Object.values(topologyState.edges).filter(
      (e) => e.source === node.id || e.target === node.id
    );
  }, [topologyState.edges, node.id]);

  const availableTargetNodes = useMemo(() => {
    return Object.values(topologyState.nodes).filter((n) => n.id !== node.id);
  }, [topologyState.nodes, node.id]);

  const handleCreateEdgeFromInspector = () => {
    if (!targetConnectId) return;
    const tNode = topologyState.nodes[targetConnectId];
    if (!tNode) return;

    let port: number | undefined = undefined;
    if (
      relationType === 'reads_from' &&
      (tNode.type.includes('db') || tNode.type.includes('postgres') || tNode.type.includes('aurora'))
    ) {
      port = 5432;
    }

    addEdge({
      id: `edge_${node.id}_${targetConnectId}_${Date.now()}`,
      source: node.id,
      target: targetConnectId,
      type: relationType,
      label: relationType.replace(/_/g, ' ').toUpperCase(),
      port,
      protocol: port ? 'tcp' : undefined,
      version: 1,
    });
    setTargetConnectId('');
  };

  const getResourceIcon = (type: CloudResourceType) => {
    if (type.includes('instance') || type.includes('vm') || type.includes('virtual_machine')) {
      return <Server className="h-4 w-4 text-emerald-400" />;
    }
    if (type.includes('eks') || type.includes('aks') || type.includes('gke') || type.includes('container') || type.includes('ecs')) {
      return <Layers className="h-4 w-4 text-teal-400" />;
    }
    if (type.includes('db') || type.includes('sql') || type.includes('database') || type.includes('postgres') || type.includes('cosmos') || type.includes('firestore')) {
      return <Database className="h-4 w-4 text-violet-400" />;
    }
    if (type.includes('s3') || type.includes('storage') || type.includes('bucket') || type.includes('disk') || type.includes('ebs') || type.includes('vault')) {
      return <HardDrive className="h-4 w-4 text-amber-400" />;
    }
    if (type.includes('vpc') || type.includes('network') || type.includes('vnet') || type.includes('subnet') || type.includes('router')) {
      return <Network className="h-4 w-4 text-sky-400" />;
    }
    if (type.includes('lb') || type.includes('forwarding') || type.includes('cloudfront') || type.includes('cdn')) {
      return <Radio className="h-4 w-4 text-blue-400" />;
    }
    if (type.includes('security') || type.includes('firewall') || type.includes('nsg') || type.includes('waf') || type.includes('iam') || type.includes('role') || type.includes('kms') || type.includes('key')) {
      return <Shield className="h-4 w-4 text-rose-400" />;
    }
    if (type.includes('sagemaker') || type.includes('vertex') || type.includes('learning') || type.includes('dataproc') || type.includes('emr')) {
      return <BrainCircuit className="h-4 w-4 text-fuchsia-400" />;
    }
    return <Boxes className="h-4 w-4 text-slate-400" />;
  };

  const handleConfigChange = (key: string, value: unknown) => {
    updateNodeConfig(node.id, { [key]: value });
  };

  // 1-Click Auto-Remediation (Hardening across AWS, Azure, and GCP)
  const handleAutoRemediateNode = () => {
    const updates: Record<string, unknown> = {};

    // S3 / Storage Buckets
    if (node.type === 'aws_s3_bucket' || node.type.includes('storage_bucket') || node.type.includes('storage_account')) {
      updates.encryption = { enabled: true, sse_algorithm: 'AES256' };
      updates.block_public_access = {
        block_public_acls: true,
        block_public_policy: true,
        ignore_public_acls: true,
        restrict_public_buckets: true,
      };
      updates.versioning_enabled = true;
      updates.uniform_bucket_level_access = true;
      updates.enable_https_traffic_only = true;
      updates.allow_blob_public_access = false;
      updates.min_tls_version = 'TLS1_2';
    }

    // Databases (RDS, Azure DB, Cloud SQL)
    if (node.type.includes('db') || node.type.includes('sql') || node.type.includes('postgres')) {
      updates.publicly_accessible = false;
      updates.storage_encrypted = true;
      updates.multi_az = true;
      updates.ssl_enforcement = true;
      updates.require_ssl = true;
      updates.availability_type = 'REGIONAL';
      updates.public_network_access_enabled = false;
    }

    // VMs & Compute Instances
    if (node.type.includes('instance') || node.type.includes('vm') || node.type.includes('virtual_machine')) {
      updates.http_tokens = 'required';
      updates.enable_secure_boot = true;
      updates.enable_vtpm = true;
      updates.can_ip_forward = false;
    }

    // Firewalls, Security Groups, NSGs
    if (node.type.includes('security_group') || node.type.includes('firewall') || node.type.includes('nsg')) {
      const rawRules = node.config['ingress_rules'];
      const currentRules = Array.isArray(rawRules) ? rawRules : [];
      const hardenedRules = currentRules.filter(
        (r) => !(r.from_port === 22 || r.from_port === 3389 || (r.cidr_blocks && Array.isArray(r.cidr_blocks) && r.cidr_blocks.includes('0.0.0.0/0') && r.from_port !== 443 && r.from_port !== 80))
      );
      updates.ingress_rules = hardenedRules.length > 0 ? hardenedRules : [{ protocol: 'tcp', from_port: 443, to_port: 443, cidr_blocks: ['0.0.0.0/0'], description: 'HTTPS TLS' }];
      updates.allow_all_ingress = false;
      updates.allow_inbound_internet = false;
    }

    // Kubernetes Clusters
    if (node.type.includes('eks') || node.type.includes('aks') || node.type.includes('gke') || node.type.includes('kubernetes')) {
      updates.endpoint_private_access = true;
      updates.endpoint_public_access = false;
      updates.enable_private_cluster = true;
      updates.enable_private_nodes = true;
      updates.private_cluster_enabled = true;
    }

    // Load Balancers
    if (node.type.includes('lb') || node.type.includes('load_balancer')) {
      updates.enable_https = true;
      updates.ssl_policy = 'ELBSecurityPolicy-TLS13-1-2-2021-06';
    }

    updateNodeConfig(node.id, updates);
  };

  // 1-Click Rightsizing & Cost Optimization
  const handleOptimizeCost = () => {
    const updates: Record<string, unknown> = {};

    // AWS Compute Rightsizing (Migrate to Graviton3 / cost-effective SKUs)
    if (node.type === 'aws_instance') {
      updates.instance_type = 't4g.small';
      updates.root_volume_type = 'gp3';
    } else if (node.type === 'aws_instance_compute') {
      updates.instance_type = 'c7g.large';
      updates.root_volume_type = 'gp3';
    } else if (node.type === 'aws_db_instance') {
      updates.instance_class = 'db.t4g.medium';
      updates.storage_type = 'gp3';
    } else if (node.type === 'azurerm_linux_virtual_machine') {
      updates.size = 'Standard_B2s';
    } else if (node.type === 'google_compute_instance') {
      updates.machine_type = 'e2-medium';
    } else if (node.type.includes('disk') || node.type.includes('volume')) {
      updates.volume_type = 'gp3';
      updates.disk_type = 'pd-balanced';
    }

    updateNodeConfig(node.id, updates);
  };

  return (
    <aside
      className="absolute top-4 right-4 z-30 w-72 max-h-[60vh] flex flex-col bg-white/98 dark:bg-[#0D0E10]/98 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl dark:shadow-[0_16px_40px_rgba(0,0,0,0.85)] overflow-hidden select-none animate-in fade-in slide-in-from-right-3 duration-150 backdrop-blur-2xl text-xs text-zinc-900 dark:text-zinc-100"
      data-testid="node-inspector"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60">
        <div className="flex items-center space-x-2.5 truncate min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
            {getResourceIcon(node.type)}
          </div>
          <div className="truncate min-w-0">
            <div className="flex items-center space-x-1.5 truncate">
              <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{node.name}</h2>
              <span
                className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700"
              >
                {provider === 'google' ? 'GCP' : provider.toUpperCase()}
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate">{node.id} ({node.type})</p>
          </div>
        </div>
        <button
          onClick={() => closeInspector()}
          className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
          title="Close Inspector (Esc)"
          data-testid="close-inspector-btn"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Metrics Row: Live Run-Rate Cost & CIS Posture */}
      <div className="grid grid-cols-2 gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#08090A]">
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-xs" data-testid="inspector-cost-metric">
          <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="truncate">
            <div className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase font-sans font-bold tracking-wider">Run-Rate</div>
            <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate">
              ${liveCost.toFixed(2)}/mo
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 p-2 rounded-xl bg-white dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-xs" data-testid="inspector-security-metric">
          {nodeFindings.length === 0 ? (
            <ShieldCheck className="h-4 w-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
          )}
          <div className="truncate">
            <div className="text-[9px] text-zinc-500 dark:text-[#8A8F98] uppercase font-sans font-bold tracking-wider">CIS Security</div>
            <div
              className={`text-xs font-mono font-bold truncate ${
                nodeFindings.length === 0 ? 'text-[#A5B4FC]' : 'text-rose-400'
              }`}
            >
              {nodeFindings.length === 0 ? 'Secure' : `${nodeFindings.length} Alerts`}
            </div>
          </div>
        </div>
      </div>

      {/* Active Multi-Agent Lock Banner */}
      {lockedPersona && (
        <div
          className="mx-3 mt-2 flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border bg-slate-950/80"
          style={{ borderColor: `${lockedPersona.hexCode}40` }}
          data-testid="inspector-lock-banner"
        >
          <Lock className="h-3.5 w-3.5" style={{ color: lockedPersona.hexCode }} />
          <span className="text-[11px] font-medium" style={{ color: lockedPersona.hexCode }}>
            Locked by {lockedPersona.name} ({lockedPersona.glyph})
          </span>
        </div>
      )}

      {/* Configuration & Controls Section */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 max-h-[380px] scrollbar-thin scrollbar-thumb-slate-800">
        {/* Node Name input */}
        <div>
          <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Resource Name</label>
          <input
            type="text"
            value={node.name}
            onChange={(e) => {
              const { updateNode } = useCloudSwarmStore.getState();
              if (updateNode) updateNode(node.id, { name: e.target.value });
            }}
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-medium outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>

        {/* 1. AWS Sizing & Config Controls */}
        {node.type.startsWith('aws_instance') && (
          <>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                EC2 Instance Type (vCPU / RAM / GPU)
              </label>
              <select
                value={String(node.config['instance_type'] || 't3.medium')}
                onChange={(e) => handleConfigChange('instance_type', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-indigo-500/60 cursor-pointer"
                data-testid="ec2-instance-type-select"
              >
                <option value="t3.nano">t3.nano (2 vCPU, 0.5 GB) — $3.80/mo</option>
                <option value="t3.micro">t3.micro (2 vCPU, 1 GB) — $7.60/mo</option>
                <option value="t3.small">t3.small (2 vCPU, 2 GB) — $15.18/mo</option>
                <option value="t3.medium">t3.medium (2 vCPU, 4 GB) — $30.37/mo</option>
                <option value="t3.large">t3.large (2 vCPU, 8 GB) — $60.74/mo</option>
                <option value="t4g.micro">t4g.micro Graviton (2 vCPU, 1 GB) — $6.13/mo</option>
                <option value="t4g.small">t4g.small Graviton (2 vCPU, 2 GB) — $12.26/mo</option>
                <option value="t4g.medium">t4g.medium Graviton (2 vCPU, 4 GB) — $24.53/mo</option>
                <option value="c6i.large">c6i.large (2 vCPU, 4 GB) — $62.05/mo</option>
                <option value="c6i.xlarge">c6i.xlarge (4 vCPU, 8 GB) — $124.10/mo</option>
                <option value="c7g.large">c7g.large Graviton3 (2 vCPU, 4 GB) — $52.78/mo</option>
                <option value="c7g.xlarge">c7g.xlarge Graviton3 (4 vCPU, 8 GB) — $105.56/mo</option>
                <option value="m6i.large">m6i.large (2 vCPU, 8 GB) — $70.08/mo</option>
                <option value="m6i.xlarge">m6i.xlarge (4 vCPU, 16 GB) — $140.16/mo</option>
                <option value="g5.xlarge">g5.xlarge (1x A10G GPU, 4 vCPU, 16 GB) — $734.38/mo</option>
                <option value="p4d.24xlarge">p4d.24xlarge (8x A100 GPU, 96 vCPU, 1.1TB) — $23,922/mo</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">EBS Root Volume Size</label>
                <span className="text-[11px] font-mono text-indigo-300 font-semibold">
                  {Number(node.config['root_volume_gb'] || 30)} GB
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={Number(node.config['root_volume_gb'] || 30)}
                onChange={(e) => handleConfigChange('root_volume_gb', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                data-testid="storage-capacity-slider"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Volume Type</label>
              <select
                value={String(node.config['root_volume_type'] || 'gp3')}
                onChange={(e) => handleConfigChange('root_volume_type', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-indigo-500/60 cursor-pointer"
              >
                <option value="gp3">General Purpose SSD (gp3)</option>
                <option value="gp2">General Purpose SSD (gp2)</option>
                <option value="io2">Provisioned IOPS SSD (io2)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-300">IMDSv2 Enforced (Metadata Service)</span>
              <input
                type="checkbox"
                checked={node.config['http_tokens'] === 'required'}
                onChange={(e) => handleConfigChange('http_tokens', e.target.checked ? 'required' : 'optional')}
                className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0 cursor-pointer"
                data-testid="security-toggle-imdsv2"
              />
            </div>
          </>
        )}

        {/* 2. Azure Virtual Machine Controls */}
        {(node.type.startsWith('azurerm_linux_virtual_machine') || node.type.startsWith('azurerm_windows_virtual_machine') || node.type === 'azurerm_virtual_machine_gpu') && (
          <>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                Azure VM Size (vCPU / RAM / GPU)
              </label>
              <select
                value={String(node.config['size'] || node.config['vm_size'] || 'Standard_D2s_v5')}
                onChange={(e) => handleConfigChange('size', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-sky-500/60 cursor-pointer"
                data-testid="azure-vm-size-select"
              >
                <option value="Standard_B1s">Standard_B1s (1 vCPU, 1 GB) — $7.59/mo</option>
                <option value="Standard_B2s">Standard_B2s (2 vCPU, 4 GB) — $30.37/mo</option>
                <option value="Standard_D2s_v5">Standard_D2s_v5 (2 vCPU, 8 GB) — $70.08/mo</option>
                <option value="Standard_D4s_v5">Standard_D4s_v5 (4 vCPU, 16 GB) — $140.16/mo</option>
                <option value="Standard_D8s_v5">Standard_D8s_v5 (8 vCPU, 32 GB) — $280.32/mo</option>
                <option value="Standard_E4s_v5">Standard_E4s_v5 (4 vCPU, 32 GB Mem) — $183.96/mo</option>
                <option value="Standard_F4s_v2">Standard_F4s_v2 (4 vCPU, 8 GB Compute) — $122.64/mo</option>
                <option value="Standard_NC6s_v3">Standard_NC6s_v3 (1x V100 GPU, 6 vCPU, 112 GB) — $2,233/mo</option>
                <option value="Standard_ND96amsr_A100_v4">Standard_ND96amsr_A100_v4 (8x A100 GPU) — $23,500/mo</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">OS Managed Disk Size</label>
                <span className="text-[11px] font-mono text-sky-300 font-semibold">
                  {Number(node.config['disk_size_gb'] || 30)} GB
                </span>
              </div>
              <input
                type="range"
                min="30"
                max="2048"
                step="10"
                value={Number(node.config['disk_size_gb'] || 30)}
                onChange={(e) => handleConfigChange('disk_size_gb', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Storage Account Type</label>
              <select
                value={String(node.config['storage_account_type'] || 'Premium_LRS')}
                onChange={(e) => handleConfigChange('storage_account_type', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-sky-500/60 cursor-pointer"
              >
                <option value="Premium_LRS">Premium SSD (Premium_LRS)</option>
                <option value="StandardSSD_LRS">Standard SSD (StandardSSD_LRS)</option>
                <option value="Standard_LRS">Standard HDD (Standard_LRS)</option>
              </select>
            </div>
          </>
        )}

        {/* 3. GCP Compute Engine Controls */}
        {(node.type.startsWith('google_compute_instance') || node.type === 'google_compute_instance_gpu') && (
          <>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                GCP Machine Type (vCPU / RAM / GPU)
              </label>
              <select
                value={String(node.config['machine_type'] || 'e2-standard-4')}
                onChange={(e) => handleConfigChange('machine_type', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-emerald-500/60 cursor-pointer"
                data-testid="gcp-machine-type-select"
              >
                <option value="e2-micro">e2-micro (2 vCPU, 1 GB) — $6.13/mo</option>
                <option value="e2-small">e2-small (2 vCPU, 2 GB) — $12.26/mo</option>
                <option value="e2-medium">e2-medium (2 vCPU, 4 GB) — $24.53/mo</option>
                <option value="e2-standard-2">e2-standard-2 (2 vCPU, 8 GB) — $49.06/mo</option>
                <option value="e2-standard-4">e2-standard-4 (4 vCPU, 16 GB) — $98.11/mo</option>
                <option value="n2-standard-4">n2-standard-4 (4 vCPU, 16 GB) — $140.16/mo</option>
                <option value="c2-standard-4">c2-standard-4 (4 vCPU, 16 GB Compute) — $152.57/mo</option>
                <option value="a2-highgpu-1g">a2-highgpu-1g (1x A100 GPU, 12 vCPU, 85 GB) — $2,680/mo</option>
                <option value="a2-highgpu-8g">a2-highgpu-8g (8x A100 GPU, 96 vCPU, 680 GB) — $21,440/mo</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Persistent Disk Boot Size</label>
                <span className="text-[11px] font-mono text-emerald-300 font-semibold">
                  {Number(node.config['boot_disk_size_gb'] || node.config['disk_size_gb'] || 20)} GB
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="2000"
                step="10"
                value={Number(node.config['boot_disk_size_gb'] || node.config['disk_size_gb'] || 20)}
                onChange={(e) => handleConfigChange('boot_disk_size_gb', Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </>
        )}

        {/* 4. Databases: AWS RDS, Azure DB, GCP Cloud SQL */}
        {(node.type === 'aws_db_instance' || node.type.includes('rds') || node.type.includes('sql') || node.type.includes('database_instance') || node.type.includes('postgresql')) && (
          <>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                Database Tier / Instance Class
              </label>
              <select
                value={String(node.config['instance_class'] || node.config['sku_name'] || node.config['tier'] || 'db.t4g.medium')}
                onChange={(e) => {
                  if (node.type.startsWith('aws')) handleConfigChange('instance_class', e.target.value);
                  else if (node.type.startsWith('azure')) handleConfigChange('sku_name', e.target.value);
                  else handleConfigChange('tier', e.target.value);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-violet-500/60 cursor-pointer"
                data-testid="db-tier-select"
              >
                <option value="db.t4g.micro">db.t4g.micro (2 vCPU, 1 GB) — $13.14/mo</option>
                <option value="db.t4g.small">db.t4g.small (2 vCPU, 2 GB) — $26.28/mo</option>
                <option value="db.t4g.medium">db.t4g.medium (2 vCPU, 4 GB) — $53.29/mo</option>
                <option value="db.m6g.large">db.m6g.large (2 vCPU, 8 GB) — $132.86/mo</option>
                <option value="db.r6g.large">db.r6g.large (2 vCPU, 16 GB) — $175.20/mo</option>
                <option value="GP_Gen5_2">Azure General Purpose 2 vCPU — $140.00/mo</option>
                <option value="db-custom-2-7680">Cloud SQL (2 vCPU, 7.5 GB) — $75.00/mo</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase">Allocated Storage</label>
                <span className="text-[11px] font-mono text-violet-300 font-semibold">
                  {Number(node.config['allocated_storage_gb'] || node.config['disk_size'] || 50)} GB
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="5000"
                step="20"
                value={Number(node.config['allocated_storage_gb'] || node.config['disk_size'] || 50)}
                onChange={(e) => {
                  handleConfigChange('allocated_storage_gb', Number(e.target.value));
                  handleConfigChange('disk_size', Number(e.target.value));
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
                data-testid="db-storage-slider"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-300">Multi-AZ / High Availability</span>
              <input
                type="checkbox"
                checked={Boolean(node.config['multi_az'] ?? (node.config['availability_type'] === 'REGIONAL'))}
                onChange={(e) => {
                  handleConfigChange('multi_az', e.target.checked);
                  handleConfigChange('availability_type', e.target.checked ? 'REGIONAL' : 'ZONAL');
                }}
                className="rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-0 cursor-pointer"
                data-testid="db-multi-az-toggle"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-300">Storage Encryption (KMS/AES256)</span>
              <input
                type="checkbox"
                checked={Boolean(node.config['storage_encrypted'] ?? true)}
                onChange={(e) => handleConfigChange('storage_encrypted', e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-violet-500 focus:ring-0 cursor-pointer"
                data-testid="db-encryption-toggle"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-300">Public Accessibility</span>
              <input
                type="checkbox"
                checked={Boolean(node.config['publicly_accessible'] || node.config['public_network_access_enabled'])}
                onChange={(e) => {
                  handleConfigChange('publicly_accessible', e.target.checked);
                  handleConfigChange('public_network_access_enabled', e.target.checked);
                }}
                className="rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-0 cursor-pointer"
                data-testid="db-public-toggle"
              />
            </div>
          </>
        )}

        {/* 5. Object Storage (S3, Azure Blob, GCS) */}
        {(node.type === 'aws_s3_bucket' || node.type.includes('storage_account') || node.type.includes('storage_bucket') || node.type.includes('blob')) && (
          <>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-300">Server-Side Encryption</span>
              <input
                type="checkbox"
                checked={Boolean((node.config['encryption'] as { enabled?: boolean })?.enabled ?? true)}
                onChange={(e) =>
                  handleConfigChange('encryption', { enabled: e.target.checked, sse_algorithm: 'AES256' })
                }
                className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                data-testid="s3-encryption-toggle"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-300">Block Public Access</span>
              <input
                type="checkbox"
                checked={Boolean(
                  (node.config['block_public_access'] as { block_public_acls?: boolean })?.block_public_acls ??
                  node.config['uniform_bucket_level_access'] ??
                  !(node.config['allow_blob_public_access'] ?? false)
                )}
                onChange={(e) => {
                  handleConfigChange('block_public_access', {
                    block_public_acls: e.target.checked,
                    block_public_policy: e.target.checked,
                    ignore_public_acls: e.target.checked,
                    restrict_public_buckets: e.target.checked,
                  });
                  handleConfigChange('uniform_bucket_level_access', e.target.checked);
                  handleConfigChange('allow_blob_public_access', !e.target.checked);
                }}
                className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                data-testid="s3-block-public-toggle"
              />
            </div>
          </>
        )}

        {/* 6. VPC, VNet & Networking */}
        {(node.type.includes('vpc') || node.type.includes('vnet') || node.type.includes('network') || node.type.includes('subnet')) && (
          <>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">CIDR / Address Space</label>
              <input
                type="text"
                value={String(node.config['cidr_block'] || node.config['ip_cidr_range'] || node.config['address_space'] || '10.0.0.0/16')}
                onChange={(e) => {
                  handleConfigChange('cidr_block', e.target.value);
                  handleConfigChange('ip_cidr_range', e.target.value);
                }}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-cyan-500/60"
                data-testid="network-cidr-input"
              />
            </div>

            {node.type.includes('subnet') && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <span className="text-xs text-slate-300">Public Subnet</span>
                <input
                  type="checkbox"
                  checked={Boolean(node.config['is_public'])}
                  onChange={(e) => handleConfigChange('is_public', e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                />
              </div>
            )}
          </>
        )}

        {/* 7. Firewalls, Security Groups & NSGs */}
        {(node.type.includes('security_group') || node.type.includes('firewall') || node.type.includes('nsg')) && (
          <>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Description / Purpose</label>
              <input
                type="text"
                value={String(node.config['description'] || 'Stateful Zero-Trust Firewall')}
                onChange={(e) => handleConfigChange('description', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-rose-500/60"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-300">Allow Global Ingress (0.0.0.0/0)</span>
              <input
                type="checkbox"
                checked={Boolean(node.config['allow_all_ingress'] || node.config['allow_inbound_internet'])}
                onChange={(e) => {
                  handleConfigChange('allow_all_ingress', e.target.checked);
                  handleConfigChange('allow_inbound_internet', e.target.checked);
                }}
                className="rounded border-slate-700 bg-slate-800 text-rose-500 focus:ring-0 cursor-pointer"
                data-testid="security-allow-all-ingress-toggle"
              />
            </div>
          </>
        )}

        {/* 8. Load Balancers */}
        {(node.type.includes('lb') || node.type.includes('load_balancer') || node.type.includes('forwarding_rule')) && (
          <>
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Load Balancer Scheme</label>
              <select
                value={String(node.config['scheme'] || 'internet-facing')}
                onChange={(e) => handleConfigChange('scheme', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono outline-none focus:border-blue-500/60 cursor-pointer"
              >
                <option value="internet-facing">Internet-Facing (Public Ingress)</option>
                <option value="internal">Internal (Private Subnet)</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-xs text-slate-300">Enforce TLS 1.3 / HTTPS</span>
              <input
                type="checkbox"
                checked={Boolean(node.config['enable_https'] ?? true)}
                onChange={(e) => handleConfigChange('enable_https', e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0 cursor-pointer"
                data-testid="lb-tls-toggle"
              />
            </div>
          </>
        )}

        {/* Connections & Network Wiring Section */}
        <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-3" data-testid="node-inspector-connections">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-zinc-200">
              <Network className="h-3.5 w-3.5 text-cyan-400" />
              <span>Active Connections ({connectedEdges.length})</span>
            </div>
          </div>

          {/* List of active edges */}
          {connectedEdges.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
              {connectedEdges.map((edge) => {
                const isOutgoing = edge.source === node.id;
                const otherNodeId = isOutgoing ? edge.target : edge.source;
                const otherNode = topologyState.nodes[otherNodeId];
                return (
                  <div
                    key={edge.id}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800/60 text-xs"
                  >
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <span className="text-[10px] font-mono text-zinc-500 font-bold">
                        {isOutgoing ? '→' : '←'}
                      </span>
                      <span className="font-medium text-zinc-200 truncate max-w-[100px]">
                        {otherNode?.name || otherNodeId}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[8px] font-mono uppercase bg-zinc-800 text-zinc-400">
                        {edge.label || edge.type}
                      </span>
                    </div>
                    <button
                      onClick={() => removeEdge(edge.id)}
                      title="Disconnect edge"
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500 italic py-0.5">
              No active connections. Link this resource below.
            </div>
          )}

          {/* Add Connection Controls */}
          {availableTargetNodes.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/60 space-y-2">
              <div className="text-[10px] font-mono text-zinc-400 uppercase font-semibold">
                Connect to Another Resource
              </div>
              <div className="space-y-1.5">
                <select
                  value={targetConnectId}
                  onChange={(e) => setTargetConnectId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono outline-none focus:border-cyan-500/60 cursor-pointer"
                  data-testid="inspector-target-node-select"
                >
                  <option value="">Select target node...</option>
                  {availableTargetNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.type})
                    </option>
                  ))}
                </select>

                <div className="flex items-center space-x-2">
                  <select
                    value={relationType}
                    onChange={(e) => setRelationType(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 font-mono outline-none focus:border-cyan-500/60 cursor-pointer"
                    data-testid="inspector-relation-type-select"
                  >
                    <option value="routes_to">routes_to (Traffic Flow)</option>
                    <option value="contains">contains (Subnet / VPC Parent)</option>
                    <option value="reads_from">reads_from (Database Access)</option>
                    <option value="stores_in">stores_in (S3 Storage)</option>
                    <option value="protects">protects (Security / Firewall)</option>
                  </select>

                  <button
                    disabled={!targetConnectId}
                    onClick={handleCreateEdgeFromInspector}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black text-xs font-semibold transition-all shadow-sm cursor-pointer shrink-0"
                    data-testid="inspector-connect-edge-btn"
                  >
                    Connect
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Security Findings Banner if alerts present */}
        {nodeFindings.length > 0 && (
          <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-950/20 space-y-2 animate-in fade-in duration-150" data-testid="node-findings-list">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-400">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Security Alerts ({nodeFindings.length})</span>
              </div>
              <button
                onClick={handleAutoRemediateNode}
                className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-semibold border border-rose-500/40 transition-colors cursor-pointer"
                data-testid="1click-fix-btn"
              >
                <Zap className="h-3 w-3" />
                <span>1-Click Fix</span>
              </button>
            </div>
            <div className="space-y-1">
              {nodeFindings.map((finding: SecurityFinding) => (
                <div key={finding.id} className="text-[11px] text-rose-300/90 leading-tight">
                  • {finding.message || finding.rule}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions: Hardening, Rightsizing, Delete */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center space-x-2">
        <button
          onClick={handleAutoRemediateNode}
          className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 hover:border-zinc-600 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          title="Apply CIS & Zero-Trust Hardening"
          data-testid="inspector-remediate-btn"
        >
          <Wrench className="h-3.5 w-3.5 text-zinc-300" />
          <span>Hardening</span>
        </button>

        <button
          onClick={handleOptimizeCost}
          className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700/80 hover:border-zinc-600 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          title="Apply FinOps Rightsizing"
          data-testid="inspector-optimize-btn"
        >
          <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
          <span>Optimize</span>
        </button>

        <button
          onClick={() => {
            removeNode(node.id);
            selectNode(null);
          }}
          className="p-2 rounded-xl bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 transition-all cursor-pointer"
          title="Delete Node"
          data-testid="inspector-delete-btn"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
};

export const NodeInspector: React.FC = () => {
  const inspectedNodeId = useCloudSwarmStore((s) => s.inspectedNodeId);
  if (!inspectedNodeId) return null;
  return <NodeInspectorContent nodeId={inspectedNodeId} />;
};
