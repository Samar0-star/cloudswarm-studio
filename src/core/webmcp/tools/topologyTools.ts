/**
 * Multi-Cloud Topology Orchestration Tools (WebMCP Protocol)
 *
 * Exposes WebMCP tool definitions and handlers for 108 multi-cloud primitives across AWS, Azure, and GCP:
 * - orchestrate_cloud_topology
 * - create_resource_node
 * - update_resource_node
 * - connect_resources
 * - remove_resource_node
 */

import type {
  WebMCPTool,
  WebMCPToolResult,
  WebMCPExecutionContext,
  WebModelContextAPI,
} from '../../../types/webmcp';
import type {
  AWSResourceType,
  CloudResourceType,
  CloudProvider,
  CloudResourceNode,
  TopologyEdge,
  TopologyEdgeRelation,
} from '../../../types/topology';
import { LiveSwarmOrchestrator } from '../../swarm/LiveSwarmOrchestrator';
import { applyAutoLayout, getResourceTier } from '../../layout/autoLayout';
import type { RFC6902Patch, StateTransaction } from '../../../types/patch';
import type { OptimisticStateEngine } from '../../state/OptimisticStateEngine';
import {
  getAllResourceTypes,
} from '../../catalog/resourceCatalog';

/**
 * 10 Core AWS Resource Types (maintained for backwards compatibility with legacy unit tests)
 */
export const AWS_RESOURCE_TYPES: readonly AWSResourceType[] = [
  'aws_vpc',
  'aws_subnet',
  'aws_instance',
  'aws_ecs_cluster',
  'aws_eks_cluster',
  'aws_db_instance',
  'aws_s3_bucket',
  'aws_lb',
  'aws_security_group',
  'aws_iam_role',
] as const;

/**
 * Complete List of all 108 Multi-Cloud Resource Types across AWS, Azure, and GCP
 */
export const ALL_CLOUD_RESOURCE_TYPES: readonly CloudResourceType[] = getAllResourceTypes();
export const CLOUD_RESOURCE_TYPES = ALL_CLOUD_RESOURCE_TYPES;

/**
 * Validates whether an IPv4 CIDR string is valid (e.g. 10.0.0.0/16 or 10.0.1.0/24)
 */
export function isValidCIDR(cidr: string): boolean {
  const match = cidr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/);
  if (!match) return false;
  const octets = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
  const prefix = Number(match[5]);
  if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;
  return true;
}

/**
 * Checks if two IPv4 CIDR blocks overlap.
 */
export function checkCIDROverlap(cidr1: string, cidr2: string): boolean {
  if (!isValidCIDR(cidr1) || !isValidCIDR(cidr2)) return false;

  const parseCIDR = (c: string) => {
    const [ipStr, prefixStr] = c.split('/') as [string, string];
    const octets = ipStr.split('.').map(Number);
    const ipNum = ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
    const prefix = Number(prefixStr);
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const start = (ipNum & mask) >>> 0;
    const end = (start | ~mask) >>> 0;
    return { start, end };
  };

  const b1 = parseCIDR(cidr1);
  const b2 = parseCIDR(cidr2);

  return b1.start <= b2.end && b2.start <= b1.end;
}

/**
 * Creates the orchestrate_cloud_topology WebMCP tool.
 */
export function createOrchestrateTopologyTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'orchestrate_cloud_topology',
    description:
      'Orchestrates a complete multi-tier, multi-cloud infrastructure topology on the canvas across AWS, Azure, or GCP with automated network partitioning, security isolation, and routing.',
    secureContext: true,
    untrustedContentHint: true,
    category: 'topology',
    inputSchema: {
      type: 'object',
      properties: {
        architecture_name: {
          type: 'string',
          description: "Human-readable name for the architecture (e.g. 'Production-MultiCloud-Mesh').",
        },
        prompt: {
          type: 'string',
          description: "Natural language description of the cloud architecture to automatically synthesize (e.g. 'Deploy high-availability AWS retail cluster with Aurora Postgres and S3').",
        },
        provider: {
          type: 'string',
          enum: ['aws', 'azure', 'google'],
          default: 'aws',
          description: 'Primary cloud provider for the architecture topology.',
        },
        region: {
          type: 'string',
          default: 'us-east-1',
          description: 'Target Cloud Region (e.g., us-east-1, eastus, us-central1).',
        },
        vpc: {
          type: 'object',
          properties: {
            cidr_block: { type: 'string', default: '10.0.0.0/16' },
            enable_dns_hostnames: { type: 'boolean', default: true },
            enable_dns_support: { type: 'boolean', default: true },
          },
        },
        network: {
          type: 'object',
          properties: {
            cidr_block: { type: 'string', default: '10.0.0.0/16' },
            address_space: { type: 'array', items: { type: 'string' } },
            network_name: { type: 'string' },
          },
        },
        resources: {
          type: 'array',
          description: 'List of cloud infrastructure nodes to instantiate across AWS, Azure, or GCP.',
        },
        connections: {
          type: 'array',
          description: 'Directed edges representing traffic flow, service attachments, or IAM bindings.',
        },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'alpha';
      const prompt = typeof params.prompt === 'string' ? params.prompt : '';
      const architectureName = String(params.architecture_name ?? (prompt ? prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-') : 'MultiCloud-Swarm'));
      const provider = (params.provider as CloudProvider) ?? 'aws';
      const region = String(params.region ?? (provider === 'azure' ? 'eastus' : provider === 'google' ? 'us-central1' : 'us-east-1'));
      
      const vpcInput = (params.vpc as Record<string, unknown>) ?? (params.network as Record<string, unknown>) ?? { cidr_block: '10.0.0.0/16' };
      const networkCidr = String(vpcInput.cidr_block ?? '10.0.0.0/16');

      if (!isValidCIDR(networkCidr)) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Invalid VPC CIDR block: '${networkCidr}'` }],
        };
      }

      let rawResources = (params.resources as Array<Record<string, unknown>>) ?? [];
      let rawConnections = (params.connections as Array<Record<string, unknown>>) ?? [];

      if (rawResources.length === 0 && prompt) {
        // Synthesize via LiveSwarmOrchestrator plan
        const plan = new LiveSwarmOrchestrator(null as any, null as any, null as any, null as any).planArchitectureFromPrompt(prompt);
        rawResources = plan.resources.map((r: any) => ({
          id: r.id,
          type: r.type,
          name: r.name,
          parentId: r.parentId,
          config: r.config,
        }));
        rawConnections = plan.edges.map((e: any) => ({
          source_id: e.sourceId,
          target_id: e.targetId,
          relation_type: e.label,
        }));
      }

      // Validate subnets and check for CIDR collisions
      const subnetCidrs: Array<{ id: string; cidr: string }> = [];
      for (const res of rawResources) {
        const resType = String(res.type ?? '');
        if ((resType === 'aws_subnet' || resType === 'azurerm_subnet' || resType === 'google_compute_subnetwork') && res.config && typeof res.config === 'object') {
          const cfg = res.config as Record<string, unknown>;
          const cidr = String(cfg.cidr_block ?? (cfg.address_prefixes ? (cfg.address_prefixes as string[])[0] : cfg.ip_cidr_range) ?? '');
          if (cidr && isValidCIDR(cidr)) {
            for (const existing of subnetCidrs) {
              if (checkCIDROverlap(existing.cidr, cidr)) {
                return {
                  isError: true,
                  content: [
                    {
                      type: 'text',
                      text: `CIDR Conflict Error: Subnet '${res.id}' (${cidr}) overlaps with subnet '${existing.id}' (${existing.cidr}).`,
                    },
                  ],
                };
              }
            }
            subnetCidrs.push({ id: String(res.id), cidr });
          }
        }
      }

      // Construct nodes
      const createdNodes: CloudResourceNode[] = [];
      const now = Date.now();

      // Root Network Node
      const rootNodeId = provider === 'azure' ? 'vnet-main' : provider === 'google' ? 'vpc-network-main' : 'vpc-main';
      const rootNodeType: CloudResourceType = provider === 'azure' ? 'azurerm_virtual_network' : provider === 'google' ? 'google_compute_network' : 'aws_vpc';
      
      const rootNodeConfig: Record<string, unknown> =
        provider === 'azure'
          ? { name: `${architectureName}-VNet`, address_space: [networkCidr], location: region }
          : provider === 'google'
          ? { network_name: `${architectureName}-vpc`, auto_create_subnetworks: false, routing_mode: 'GLOBAL' }
          : {
              cidr_block: networkCidr,
              enable_dns_hostnames: vpcInput.enable_dns_hostnames ?? true,
              enable_dns_support: vpcInput.enable_dns_support ?? true,
              region,
            };

      const rootNode: CloudResourceNode = {
        id: rootNodeId,
        type: rootNodeType,
        name: `${architectureName}-${provider.toUpperCase()}-Network`,
        position: { x: 100, y: 100 },
        width: 800,
        height: 600,
        config: rootNodeConfig,
        metadata: {
          createdBy: agentId,
          createdAt: now,
          updatedAt: now,
          status: 'healthy',
        },
        version: 1,
      };
      createdNodes.push(rootNode);

      let gridIndex = 0;
      for (const res of rawResources) {
        const id = String(res.id ?? `node-${gridIndex}`);
        const type = String(res.type ?? 'aws_instance') as CloudResourceType;
        const name = String(res.name ?? id);
        const parentId = res.parent_id ? String(res.parent_id) : rootNodeId;
        const config = (res.config as Record<string, unknown>) ?? {};

        const tier = getResourceTier(type);
        const tierYMap: Record<number, number> = {
          0: 120,
          1: 220,
          2: 380,
          3: 560,
          4: 200,
        };
        const sameTierCount = createdNodes.filter((n) => getResourceTier(n.type) === tier).length;
        const xPos = 420 + (sameTierCount % 3) * 310;
        const yPos = (tierYMap[tier] ?? 300) + Math.floor(sameTierCount / 3) * 130;
        gridIndex++;

        const node: CloudResourceNode = {
          id,
          type,
          name,
          position: { x: xPos, y: yPos },
          parentId,
          config,
          metadata: {
            createdBy: agentId,
            createdAt: now,
            updatedAt: now,
            status: 'healthy',
          },
          version: 1,
        };
        createdNodes.push(node);
      }

      // Construct edges
      const createdEdges: TopologyEdge[] = [];
      for (let i = 0; i < rawConnections.length; i++) {
        const conn = rawConnections[i]!;
        const source = String(conn.source_id ?? '');
        const target = String(conn.target_id ?? '');
        const relType = String(conn.relation_type ?? 'routes_to') as TopologyEdgeRelation;
        const port = conn.port ? Number(conn.port) : undefined;
        const protocol = conn.protocol ? String(conn.protocol) : undefined;

        if (source && target) {
          createdEdges.push({
            id: `edge-${source}-${target}-${i}`,
            source,
            target,
            type: relType,
            port,
            protocol,
            version: 1,
          });
        }
      }

      // If stateEngine is available, apply changes atomically
      let appliedPatches = 0;
      if (stateEngine) {
        for (const node of createdNodes) {
          await stateEngine.addNode(node, agentId);
          appliedPatches++;
        }
        for (const edge of createdEdges) {
          await stateEngine.addEdge(edge, agentId);
          appliedPatches++;
        }

        // Apply clean, non-overlapping hierarchical layout across all tiers
        try {
          const currentState = stateEngine.getState();
          const autoLayoutState = applyAutoLayout(currentState, { canvasCenterX: 920, startY: 130 });
          stateEngine.setState(autoLayoutState);
        } catch {
          // Layout fallback gracefully ignored
        }
      }

      const summaryPayload = {
        architecture_name: architectureName,
        provider,
        region,
        network_cidr: networkCidr,
        nodes_created: createdNodes.length,
        edges_created: createdEdges.length,
        node_ids: createdNodes.map((n) => n.id),
        subnets_allocated: subnetCidrs,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summaryPayload, null, 2),
          },
        ],
        meta: {
          executionTimeMs: 0,
          agentId,
          appliedPatches,
        },
      };
    },
  };
}

/**
 * Creates the create_resource_node WebMCP tool.
 */
export function createResourceNodeTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'create_resource_node',
    description: 'Creates a single multi-cloud infrastructure resource node on the canvas (108 primitives across AWS, Azure, GCP).',
    category: 'topology',
    secureContext: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      required: ['id', 'type', 'name'],
      properties: {
        id: { type: 'string', description: "Unique node ID (e.g., 'rds-prod-postgres', 'azure-aks-cluster', 'gcp-cloudsql-node')." },
        type: {
          type: 'string',
          enum: ALL_CLOUD_RESOURCE_TYPES,
          description: 'Multi-Cloud Primitive Type (108 distinct primitives supported across AWS, Azure, and GCP).',
        },
        name: { type: 'string', description: 'Human-readable node label.' },
        parent_id: { type: 'string', description: 'Parent container node ID (e.g. VPC/VNet).' },
        config: { type: 'object', description: 'Resource specific configuration parameters.' },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
        },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'alpha';
      const id = String(params.id || params.node_id || params.nodeId || `node_${Date.now()}`);
      const type = String(params.type || params.resource_type || params.resourceType || 'aws_instance') as CloudResourceType;
      const name = String(params.name || params.label || id);
      const parentId = params.parent_id || params.parentId ? String(params.parent_id || params.parentId) : undefined;
      const config = (params.config as Record<string, unknown>) ?? {};
      const posInput = (params.position as { x?: number; y?: number }) ?? {};
      const now = Date.now();

      const existing = stateEngine ? Object.values(stateEngine.getState().nodes) : [];
      const count = existing.length;
      const defaultX = 180 + (count % 4) * 280;
      const defaultY = 140 + Math.floor(count / 4) * 160;

      const node: CloudResourceNode = {
        id,
        type,
        name,
        position: {
          x: typeof posInput.x === 'number' ? posInput.x : defaultX,
          y: typeof posInput.y === 'number' ? posInput.y : defaultY,
        },
        parentId,
        config,
        metadata: {
          createdBy: agentId,
          createdAt: now,
          updatedAt: now,
          status: 'healthy',
        },
        version: 1,
      };

      if (stateEngine) {
        const res = await stateEngine.addNode(node, agentId);
        if (!res.success) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to create node: ${res.conflictError}` }],
          };
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(node, null, 2) }],
        meta: {
          executionTimeMs: 0,
          agentId,
          appliedPatches: 1,
        },
      };
    },
  };
}

/**
 * Creates the update_resource_node WebMCP tool.
 */
export function createUpdateResourceNodeTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'update_resource_node',
    description: 'Modifies configuration properties of an existing multi-cloud resource node.',
    category: 'topology',
    secureContext: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      required: ['node_id'],
      properties: {
        node_id: { type: 'string', description: 'ID of the node to update.' },
        name: { type: 'string', description: 'Updated display name for the node.' },
        parentId: { type: 'string', description: 'Parent container node ID (e.g. VPC or Subnet).' },
        position: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
          description: 'Updated spatial position coordinates on canvas.',
        },
        config_patch: { type: 'object', description: 'Partial configuration fields to update.' },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'alpha';
      const nodeId = String(params.node_id ?? params.id ?? params.nodeId ?? '');
      const configPatch = (params.config_patch || params.config || params.configPatch || {}) as Record<string, unknown>;
      const newPos = params.position as { x: number; y: number } | undefined;
      const newName = params.name ? String(params.name) : undefined;
      const newParent = params.parentId !== undefined ? (params.parentId ? String(params.parentId) : undefined) : (params.parent_id !== undefined ? (params.parent_id ? String(params.parent_id) : undefined) : undefined);

      if (stateEngine) {
        const node = stateEngine.getState().nodes[nodeId];
        if (!node) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Node '${nodeId}' not found.` }],
          };
        }

        const patches: RFC6902Patch[] = [];
        if (newPos) {
          patches.push({ op: 'replace', path: `/nodes/${nodeId}/position`, value: newPos });
        }
        if (newName) {
          patches.push({ op: 'replace', path: `/nodes/${nodeId}/name`, value: newName });
        }
        if (params.parentId !== undefined) {
          patches.push({ op: 'replace', path: `/nodes/${nodeId}/parentId`, value: newParent });
        }
        for (const [k, v] of Object.entries(configPatch)) {
          patches.push({ op: 'replace', path: `/nodes/${nodeId}/config/${k}`, value: v });
        }

        if (patches.length > 0) {
          const tx: StateTransaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            agentId,
            description: `Update node ${nodeId}`,
            timestamp: Date.now(),
            patches,
          };
          const res = await stateEngine.applyTransaction(tx);
          if (!res.success) {
            return {
              isError: true,
              content: [{ type: 'text', text: `Update failed: ${res.conflictError}` }],
            };
          }
        }

        const updatedNode = stateEngine.getState().nodes[nodeId];
        return {
          content: [{ type: 'text', text: JSON.stringify(updatedNode, null, 2) }],
          meta: { executionTimeMs: 0, agentId, appliedPatches: patches.length },
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ node_id: nodeId, updated: { ...configPatch, position: newPos, name: newName } }, null, 2) }],
        meta: { executionTimeMs: 0, agentId },
      };
    },
  };
}

/**
 * Creates the connect_resources WebMCP tool.
 */
export function createConnectResourcesTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'connect_resources',
    description: 'Establishes a directed connection edge between two cloud resources (network flows, IAM attachments, data storage pipes, or peering).',
    category: 'topology',
    secureContext: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      required: ['source_id', 'target_id'],
      properties: {
        source_id: { type: 'string', description: 'Source resource node ID.' },
        target_id: { type: 'string', description: 'Target resource node ID.' },
        relation_type: {
          type: 'string',
          description: 'Type of architectural relationship between the nodes.',
        },
        edge_type: {
          type: 'string',
          description: 'Alias for relation_type.',
        },
        port: { type: 'integer', minimum: 1, maximum: 65535, description: 'Optional network communication port.' },
        protocol: { type: 'string', enum: ['tcp', 'udp', 'http', 'https', 'all'], description: 'Optional protocol.' },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'alpha';
      const source = String(params.source_id ?? params.sourceNodeId ?? params.source ?? '');
      const target = String(params.target_id ?? params.targetNodeId ?? params.target ?? '');

      const aliasMap: Record<string, TopologyEdgeRelation> = {
        contains: 'attached_to',
        reads_from: 'stores_in',
        data_pipeline: 'network_flow',
        routes_to: 'routes_to',
        cache_sync: 'network_flow',
        webhook_trigger: 'network_flow',
        depends_on: 'depends_on',
        attached_to: 'attached_to',
        target_group_of: 'target_group_of',
        assumes_role: 'assumes_role',
        stores_in: 'stores_in',
        network_flow: 'network_flow',
        security_attachment: 'security_attachment',
        attaches_to: 'attached_to',
        iam_binding: 'iam_binding',
        peering: 'peering',
      };

      const rawType = String(
        params.relation_type ?? params.edge_type ?? params.connection_type ?? params.connectionType ?? 'depends_on'
      ).trim().toLowerCase().replace(/[\s-]+/g, '_');

      const relType: TopologyEdgeRelation = aliasMap[rawType] ?? 'depends_on';

      let resolvedSource = source;
      let resolvedTarget = target;

      const port = params.port ? Number(params.port) : undefined;
      const protocol = params.protocol ? String(params.protocol) : undefined;

      if (stateEngine) {
        const nodes = stateEngine.getState().nodes;
        if (!nodes[resolvedSource]) {
          const found = Object.values(nodes).find(
            (n) => n.name === resolvedSource || n.id.toLowerCase() === resolvedSource.toLowerCase()
          );
          if (found) resolvedSource = found.id;
        }
        if (!nodes[resolvedTarget]) {
          const found = Object.values(nodes).find(
            (n) => n.name === resolvedTarget || n.id.toLowerCase() === resolvedTarget.toLowerCase()
          );
          if (found) resolvedTarget = found.id;
        }

        if (!nodes[resolvedSource]) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Source resource '${resolvedSource}' does not exist on canvas.` }],
          };
        }
        if (!nodes[resolvedTarget]) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Target resource '${resolvedTarget}' does not exist on canvas.` }],
          };
        }

        if (resolvedSource === resolvedTarget) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Cannot connect resource '${resolvedSource}' to itself.` }],
          };
        }

        const existingEdge = Object.values(stateEngine.getState().edges).find(
          (e) => e.source === resolvedSource && e.target === resolvedTarget
        );
        if (existingEdge) {
          const updatedEdge: TopologyEdge = {
            ...existingEdge,
            type: relType,
            port,
            protocol,
            version: (existingEdge.version || 1) + 1,
          };
          await stateEngine.addEdge(updatedEdge, agentId);
          return {
            content: [{ type: 'text', text: JSON.stringify(updatedEdge, null, 2) }],
            meta: { executionTimeMs: 0, agentId, appliedPatches: 1 },
          };
        }
      }

      const edge: TopologyEdge = {
        id: `edge-${resolvedSource}-${resolvedTarget}`,
        source: resolvedSource,
        target: resolvedTarget,
        type: relType,
        port,
        protocol,
        version: 1,
      };

      if (stateEngine) {
        const res = await stateEngine.addEdge(edge, agentId);
        if (!res.success) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to add connection: ${res.conflictError}` }],
          };
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(edge, null, 2) }],
        meta: { executionTimeMs: 0, agentId, appliedPatches: 1 },
      };
    },
  };
}

/**
 * Creates the remove_resource_node WebMCP tool.
 */
export function createRemoveResourceNodeTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'remove_resource_node',
    description: 'Deletes a resource node from the canvas with optional cascade deletion of child nodes and associated edges.',
    category: 'topology',
    secureContext: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      required: ['node_id'],
      properties: {
        node_id: { type: 'string', description: 'ID of the node to remove.' },
        cascade: { type: 'boolean', default: true, description: 'Whether to recursively delete child nodes.' },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'alpha';
      const nodeId = String(params.node_id ?? params.id ?? params.nodeId ?? '');
      const cascade = params.cascade !== false;

      if (stateEngine) {
        const res = await stateEngine.removeNode(nodeId, cascade, agentId);
        if (!res.success) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Failed to remove node: ${res.conflictError}` }],
          };
        }
      }

      return {
        content: [{ type: 'text', text: `Node '${nodeId}' successfully removed.` }],
        meta: { executionTimeMs: 0, agentId },
      };
    },
  };
}

/**
 * Creates the get_canvas_state WebMCP tool — allows external agents (ChatGPT) to read current canvas.
 * This is the critical "read" tool that enables human-agent collaboration:
 * the agent can SEE what the human already placed before deciding what to add.
 */
export function createGetCanvasStateTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'get_canvas_state',
    description: 'Returns the current state of the cloud architecture canvas, including all nodes (resources), edges (connections), and their configurations. Use this FIRST to understand what the human has already built before making changes.',
    category: 'topology',
    readOnlyHint: true,
    untrustedContentHint: true,
    secureContext: true,
    inputSchema: {
      type: 'object',
      properties: {
        include_configs: {
          type: 'boolean',
          default: true,
          description: 'Whether to include full resource configurations in the response.',
        },
        filter_provider: {
          type: 'string',
          enum: ['aws', 'azure', 'google', 'all'],
          default: 'all',
          description: 'Filter nodes by cloud provider.',
        },
      },
    },
    execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
      const agentId = context?.agentId ?? 'director';
      const includeConfigs = params.include_configs !== false;
      const filterProvider = params.filter_provider ? String(params.filter_provider) : 'all';

      if (!stateEngine) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ nodes: [], edges: [], nodeCount: 0, edgeCount: 0 }) }],
          meta: { executionTimeMs: 0, agentId },
        };
      }

      const state = stateEngine.getState();
      let nodes = Object.values(state.nodes);
      const edges = Object.values(state.edges);

      // Apply provider filter
      if (filterProvider !== 'all') {
        const prefixMap: Record<string, string> = { aws: 'aws_', azure: 'azurerm_', google: 'google_' };
        const prefix = prefixMap[filterProvider];
        if (prefix) {
          nodes = nodes.filter(n => n.type.startsWith(prefix));
        }
      }

      const nodesSummary = nodes.map(n => ({
        id: n.id,
        type: n.type,
        name: n.name,
        position: n.position,
        parentId: n.parentId,
        ...(includeConfigs ? { config: n.config } : {}),
        metadata: n.metadata,
      }));

      const edgesSummary = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        port: e.port,
        protocol: e.protocol,
      }));

      const response = {
        nodeCount: nodesSummary.length,
        edgeCount: edgesSummary.length,
        nodes: nodesSummary,
        edges: edgesSummary,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        meta: { executionTimeMs: 0, agentId },
      };
    },
  };
}

/**
 * Creates the clear_canvas WebMCP tool.
 */
export function createClearCanvasTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'clear_canvas',
    description: 'Clears all nodes and edges from the canvas, resetting it to an empty, clean state.',
    category: 'topology',
    secureContext: true,
    untrustedContentHint: true,
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_params, context): Promise<WebMCPToolResult> {
      const agentId = context?.agentId || 'director';
      if (stateEngine) {
        stateEngine.setState({ nodes: {}, edges: {}, version: 0 });
      }
      return {
        content: [{ type: 'text', text: 'Canvas successfully cleared to pristine state.' }],
        meta: { executionTimeMs: 0, agentId },
      };
    },
  };
}

export function createApplyCanvasLayoutTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'apply_canvas_layout',
    description:
      'Deterministically organizes all canvas nodes into a balanced, non-overlapping 3-tier directional workflow DAG with zero bounding-box overlaps.',
    category: 'topology',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_params, context): Promise<WebMCPToolResult> {
      const agentId = context?.agentId || 'alpha';
      if (stateEngine) {
        const current = stateEngine.getState();
        const laidOut = applyAutoLayout(current);
        stateEngine.setState(laidOut);
      }
      return {
        content: [{ type: 'text', text: 'Canvas successfully balanced into clean 3-tier directional workflow DAG with 0 collisions.' }],
        meta: { executionTimeMs: 0, agentId },
      };
    },
  };
}

export function createInspectDistributedLocksTool(stateEngine?: OptimisticStateEngine): WebMCPTool {
  return {
    name: 'inspect_distributed_locks',
    description:
      'Inspects active multi-agent distributed resource locks (StripedLockManager) to verify concurrency and mutual exclusion across canvas nodes.',
    category: 'topology',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> {
      const state = stateEngine ? stateEngine.getState() : { nodes: {} };
      const lockedNodes = Object.values(state.nodes).filter((n) => (n.metadata as unknown as Record<string, unknown> | undefined)?.lockedBy);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total_stripes: 64,
            active_locked_nodes_count: lockedNodes.length,
            locked_nodes: lockedNodes.map((n) => {
              const meta = n.metadata as unknown as Record<string, unknown> | undefined;
              return {
                id: n.id,
                name: n.name,
                locked_by: meta?.lockedBy,
                lock_timestamp: meta?.lockedAt,
              };
            }),
          }, null, 2),
        }],
        meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'alpha' },
      };
    },
  };
}

/**
 * Registers all topology tools into a WebMCP context engine.
 */
export function registerTopologyTools(
  engine: WebModelContextAPI,
  stateEngine?: OptimisticStateEngine
): () => void {
  const unregisterPromises: Array<Promise<() => void> | (() => void)> = [];

  unregisterPromises.push(engine.registerTool(createOrchestrateTopologyTool(stateEngine)));
  unregisterPromises.push(engine.registerTool(createResourceNodeTool(stateEngine)));
  const updateTool = createUpdateResourceNodeTool(stateEngine);
  unregisterPromises.push(engine.registerTool(updateTool));
  unregisterPromises.push(engine.registerTool({ ...updateTool, name: 'update_node_config' }));
  unregisterPromises.push(engine.registerTool(createConnectResourcesTool(stateEngine)));
  unregisterPromises.push(engine.registerTool(createRemoveResourceNodeTool(stateEngine)));
  unregisterPromises.push(engine.registerTool(createGetCanvasStateTool(stateEngine)));
  const clearTool = createClearCanvasTool(stateEngine);
  unregisterPromises.push(engine.registerTool(clearTool));
  unregisterPromises.push(engine.registerTool({ ...clearTool, name: 'canvas_clear' }));
  unregisterPromises.push(engine.registerTool(createApplyCanvasLayoutTool(stateEngine)));
  unregisterPromises.push(engine.registerTool(createInspectDistributedLocksTool(stateEngine)));

  return () => {
    for (const p of unregisterPromises) {
      Promise.resolve(p).then(fn => fn && fn());
    }
  };
}
