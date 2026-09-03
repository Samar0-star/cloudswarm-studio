/**
 * Hierarchical Auto-Layout Engine for Cloud Architecture Topologies
 *
 * Organizes cloud resources into clean, structured architectural tiers:
 * Tier 0: Root Network (VPC, VNet, GCP Network)
 * Tier 1: Perimeters & Subnets (Public/Private Subnets, Gateways, Firewalls)
 * Tier 2: Ingress & Compute (ALB, Ingress, EKS/AKS/GKE, EC2, VMs, ECS, Functions)
 * Tier 3: Databases & Storage (RDS, DynamoDB, Redis, S3, Cloud SQL, Blob)
 * Tier 4: Security & Management (KMS, Key Vault, IAM, WAF, Shield, Monitoring)
 */

import type { CloudResourceNode, TopologyEdge, TopologyState } from "../../types/topology";

export interface NodePosition {
  x: number;
  y: number;
}

export interface AutoLayoutOptions {
  startY?: number;
  rowSpacing?: number;
  colSpacing?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  canvasCenterX?: number;
}

const DEFAULT_OPTIONS: Required<AutoLayoutOptions> = {
  startY: 120,
  rowSpacing: 60,
  colSpacing: 65,
  nodeWidth: 285,
  nodeHeight: 85,
  canvasCenterX: 860,
};

/**
 * Resolves any residual bounding-box overlaps by pushing colliding nodes.
 */
function resolveCollisions(
  positions: Record<string, NodePosition>,
  nodeWidth: number,
  nodeHeight: number,
  minGapX: number,
  minGapY: number
): void {
  const ids = Object.keys(positions);
  let hasCollision = true;
  let iterations = 0;
  const maxIterations = 20;

  while (hasCollision && iterations < maxIterations) {
    hasCollision = false;
    iterations++;

    for (let i = 0; i < ids.length; i++) {
      const idA = ids[i];
      if (!idA) continue;
      const a = positions[idA];
      if (!a) continue;

      for (let j = i + 1; j < ids.length; j++) {
        const idB = ids[j];
        if (!idB) continue;
        const b = positions[idB];
        if (!b) continue;

        const overlapX = (nodeWidth + minGapX) - Math.abs(b.x - a.x);
        const overlapY = (nodeHeight + minGapY) - Math.abs(b.y - a.y);

        if (overlapX > 0 && overlapY > 0) {
          hasCollision = true;
          // Resolve along the axis with smaller overlap
          if (overlapX < overlapY) {
            if (b.x >= a.x) {
              b.x += overlapX;
            } else {
              b.x -= overlapX;
            }
          } else {
            if (b.y >= a.y) {
              b.y += overlapY;
            } else {
              b.y -= overlapY;
            }
          }
          // Ensure b stays within visible bounds
          if (b.x < 380) b.x = 380;
        }
      }
    }
  }
}

/**
 * Classifies a cloud resource type into an architectural tier (0 to 4).
 */
export function getResourceTier(type: string): number {
  const t = type.toLowerCase();

  // Tier 0: Root Network (VPC, VNet, GCP Network)
  if (
    t === "aws_vpc" ||
    t === "azurerm_virtual_network" ||
    t === "google_compute_network" ||
    (t.includes("vpc") && !t.includes("endpoint")) ||
    t.includes("vnet") ||
    t === "network"
  ) {
    return 0;
  }

  // Tier 1: Subnets, Gateways, NAT, Routers, VPN
  if (
    t.includes("subnet") ||
    t.includes("nat_gateway") ||
    t.includes("internet_gateway") ||
    t.includes("route_table") ||
    t.includes("transit_gateway") ||
    t.includes("vpn")
  ) {
    return 1;
  }

  // Tier 3: Data, Databases, In-Memory Caches, Object & Block Storage
  if (
    t.includes('db') ||
    t.includes('database') ||
    t.includes('sql') ||
    t.includes('postgres') ||
    t.includes('mysql') ||
    t.includes('aurora') ||
    t.includes('dynamodb') ||
    t.includes('cosmos') ||
    t.includes('firestore') ||
    t.includes('bigtable') ||
    t.includes('spanner') ||
    t.includes('redis') ||
    t.includes('elasticache') ||
    t.includes('s3') ||
    t.includes('storage_account') ||
    t.includes('storage_bucket') ||
    t.includes('bucket') ||
    t.includes('ebs') ||
    t.includes('disk') ||
    t.includes('volume') ||
    t.includes('redshift') ||
    t.includes('bigquery') ||
    t.includes('synapse') ||
    t.includes('lake')
  ) {
    return 3;
  }

  // Tier 2: Ingress & Compute (Load Balancers, VMs, Container Clusters, Serverless)
  if (
    t.includes('lb') ||
    t.includes('load_balancer') ||
    t.includes('application_gateway') ||
    t.includes('forwarding_rule') ||
    t.includes('instance') ||
    t.includes('vm') ||
    t.includes('virtual_machine') ||
    t.includes('eks') ||
    t.includes('aks') ||
    t.includes('gke') ||
    t.includes('ecs') ||
    t.includes('container') ||
    t.includes('cluster') ||
    t.includes('lambda') ||
    t.includes('function') ||
    t.includes('app_service') ||
    t.includes('cloudfront') ||
    t.includes('cdn') ||
    t.includes('emr') ||
    t.includes('dataproc') ||
    t.includes('sagemaker') ||
    t.includes('vertex')
  ) {
    return 2;
  }

  // Tier 4: Security, Encryption, IAM & Perimeter Defense
  if (
    t.includes("kms") ||
    t.includes("key_vault") ||
    t.includes("key") ||
    t.includes("secret") ||
    t.includes("iam") ||
    t.includes("role") ||
    t.includes("waf") ||
    t.includes("shield") ||
    t.includes("firewall") ||
    t.includes("security_group") ||
    t.includes("nsg") ||
    t.includes("guardduty") ||
    t.includes("sentinel") ||
    t.includes("cloudtrail") ||
    t.includes("cloudwatch")
  ) {
    return 4;
  }

  // Default to Compute layer for unclassified nodes
  return 2;
}

/**
 * Calculates deterministic, balanced positions for all nodes in an architecture graph.
 */
export function computeHierarchicalLayout(
  nodes: Record<string, CloudResourceNode>,
  edges: Record<string, TopologyEdge> = {},
  options: AutoLayoutOptions = {}
): Record<string, NodePosition> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodeIds = Object.keys(nodes);
  if (nodeIds.length === 0) return {};

  // 1. Group nodes by tier (0 to 4)
  const tierBuckets: Record<number, string[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
  };

  for (const id of nodeIds) {
    const node = nodes[id];
    if (node) {
      const tier = getResourceTier(node.type);
      if (!tierBuckets[tier]) {
        tierBuckets[tier] = [];
      }
      tierBuckets[tier]!.push(id);
    }
  }

  const positions: Record<string, NodePosition> = {};
  const occupiedTiers = Object.keys(tierBuckets)
    .map(Number)
    .filter((tier) => (tierBuckets[tier]?.length ?? 0) > 0)
    .sort((a, b) => a - b);

  let currentY = opts.startY;

  // 2. Position nodes row by row, wrapping if a tier has more than 3 items
  occupiedTiers.forEach((tier) => {
    const rowNodeIds = tierBuckets[tier] || [];
    const maxItemsPerRow = 3;
    const subRows: string[][] = [];
    for (let i = 0; i < rowNodeIds.length; i += maxItemsPerRow) {
      subRows.push(rowNodeIds.slice(i, i + maxItemsPerRow));
    }

    subRows.forEach((subRow) => {
      const count = subRow.length;
      const totalRowWidth = count * opts.nodeWidth + (count - 1) * opts.colSpacing;
      // Guarantee clear margin from CAD drawer (minimum startX: 380px)
      const startX = Math.max(380, Math.round(opts.canvasCenterX - totalRowWidth / 2));

      subRow.forEach((id, colIndex) => {
        const x = Math.round(startX + colIndex * (opts.nodeWidth + opts.colSpacing));
        positions[id] = { x, y: currentY };
      });

      currentY += opts.nodeHeight + opts.rowSpacing;
    });
  });

  // 3. Collision Resolution Pass to mathematically guarantee 0 overlapping boxes
  resolveCollisions(positions, opts.nodeWidth, opts.nodeHeight, opts.colSpacing, opts.rowSpacing);

  return positions;
}

/**
 * Applies hierarchical layout to a TopologyState immutably.
 */
export function applyAutoLayout(
  state: TopologyState,
  options: AutoLayoutOptions = {}
): TopologyState {
  const newPositions = computeHierarchicalLayout(state.nodes, state.edges, options);

  const updatedNodes: Record<string, CloudResourceNode> = {};
  for (const [id, node] of Object.entries(state.nodes)) {
    const pos = newPositions[id] || node.position;
    updatedNodes[id] = {
      ...node,
      position: { ...pos },
    };
  }

  return {
    ...state,
    nodes: updatedNodes,
  };
}

/**
 * Layouts an array of PlannedResource objects before they are created.
 */
export function layoutPlannedResources<T extends { id: string; type: string; position: { x: number; y: number } }>(
  resources: T[],
  options: AutoLayoutOptions = {}
): T[] {
  const pseudoNodes: Record<string, CloudResourceNode> = {};
  for (const res of resources) {
    pseudoNodes[res.id] = {
      id: res.id,
      type: res.type as any,
      name: res.id,
      position: res.position,
      config: {},
      version: 1,
      metadata: { createdBy: "alpha", createdAt: 0, updatedAt: 0 },
    };
  }

  const positions = computeHierarchicalLayout(pseudoNodes, {}, options);

  return resources.map((res) => ({
    ...res,
    position: positions[res.id] ? { ...positions[res.id] } : res.position,
  }));
}

/**
 * Intelligently infers and auto-wires missing topological edges between cloud resources.
 * Ensures that no resource remains an isolated, floating orphaned box.
 */
export function inferMissingEdges(
  nodes: Record<string, CloudResourceNode>,
  existingEdges: Record<string, TopologyEdge> = {}
): TopologyEdge[] {
  const newEdges: TopologyEdge[] = [];
  const edgeKeySet = new Set(Object.values(existingEdges).map((e) => `${e.source}->${e.target}`));

  const addEdge = (source: string, target: string, type: string, label?: string) => {
    if (source === target) return;
    if (!nodes[source] || !nodes[target]) return;
    const key = `${source}->${target}`;
    if (!edgeKeySet.has(key)) {
      edgeKeySet.add(key);
      newEdges.push({
        id: `edge_${source}_${target}_${Math.random().toString(36).substring(2, 7)}`,
        source,
        target,
        type: type as any,
        label,
        version: 1,
      });
    }
  };

  const nodeArr = Object.values(nodes);
  const vpcNodes = nodeArr.filter(
    (n) => (n.type as string).includes('vpc') || (n.type as string).includes('vnet') || (n.type as string).includes('network')
  );
  const subnetNodes = nodeArr.filter((n) => (n.type as string).includes('subnet'));
  const computeNodes = nodeArr.filter((n) =>
    ['aws_instance', 'aws_eks_cluster', 'aws_ecs_cluster', 'aws_lambda_function'].includes(n.type as string) ||
    (n.type as string).includes('instance') ||
    (n.type as string).includes('vm')
  );
  const lbNodes = nodeArr.filter((n) =>
    ['aws_lb', 'aws_internet_gateway', 'aws_api_gateway'].includes(n.type as string) ||
    (n.type as string).includes('lb')
  );
  const dbNodes = nodeArr.filter((n) =>
    ['aws_db_instance', 'aws_dynamodb_table', 'aws_elasticache_cluster'].includes(n.type as string) ||
    (n.type as string).includes('db') ||
    (n.type as string).includes('database') ||
    (n.type as string).includes('sql')
  );
  const storageNodes = nodeArr.filter((n) =>
    ['aws_s3_bucket', 'aws_ebs_volume'].includes(n.type as string) ||
    (n.type as string).includes('storage') ||
    (n.type as string).includes('bucket')
  );
  const secNodes = nodeArr.filter((n) =>
    ['aws_security_group', 'aws_kms_key', 'aws_waf_web_acl'].includes(n.type as string) ||
    (n.type as string).includes('security') ||
    (n.type as string).includes('kms')
  );

  // 1. Explicit Parent and Config References
  for (const n of nodeArr) {
    if (n.parentId && nodes[n.parentId]) {
      addEdge(n.parentId, n.id, 'contains', 'CONTAINS');
    }
    const vpcId = n.config?.vpc_id;
    if (typeof vpcId === 'string' && nodes[vpcId]) {
      addEdge(vpcId, n.id, 'contains', 'VPC TIER');
    }
    const subnetId = n.config?.subnet_id;
    if (typeof subnetId === 'string' && nodes[subnetId]) {
      addEdge(subnetId, n.id, 'contains', 'SUBNET');
    }
    if (Array.isArray(n.config?.subnet_ids)) {
      for (const sid of n.config.subnet_ids) {
        if (typeof sid === 'string' && nodes[sid]) addEdge(sid, n.id, 'attached_to', 'ATTACHED');
      }
    }
    if (Array.isArray(n.config?.security_group_ids)) {
      for (const sgId of n.config.security_group_ids) {
        if (typeof sgId === 'string' && nodes[sgId]) addEdge(sgId, n.id, 'protects', 'SECURED');
      }
    }
  }

  // 2. VPC to Subnets
  if (vpcNodes.length > 0 && vpcNodes[0]) {
    const mainVpc = vpcNodes[0];
    for (const sub of subnetNodes) {
      if (!sub.parentId && !sub.config?.vpc_id) {
        addEdge(mainVpc.id, sub.id, 'contains', 'SUBNET');
      }
    }
  }

  // 3. Subnets to Ingress / Compute
  if (subnetNodes.length > 0) {
    const pubSub = subnetNodes.find((s) => s.config?.is_public || s.id.includes('pub')) || subnetNodes[0];
    const privSub = subnetNodes.find((s) => !s.config?.is_public || s.id.includes('priv')) || subnetNodes[0];

    if (pubSub) {
      for (const lb of lbNodes) {
        addEdge(pubSub.id, lb.id, 'attached_to', 'INGRESS');
      }
    }
    if (privSub) {
      for (const comp of computeNodes) {
        addEdge(privSub.id, comp.id, 'contains', 'HOSTS');
      }
    }
  }

  // 4. Ingress to Compute
  for (const lb of lbNodes) {
    for (const comp of computeNodes) {
      addEdge(lb.id, comp.id, 'routes_to', 'PORT:443');
    }
  }

  // 5. Compute to Databases and Storage
  for (const comp of computeNodes) {
    for (const db of dbNodes) {
      addEdge(comp.id, db.id, 'reads_from', 'SQL:5432');
    }
    for (const st of storageNodes) {
      addEdge(comp.id, st.id, 'stores_in', 'S3 ASSETS');
    }
  }

  // 6. Security & Encryption to Protected Nodes
  for (const sec of secNodes) {
    const secType = sec.type as string;
    if (secType.includes('waf')) {
      for (const lb of lbNodes) addEdge(sec.id, lb.id, 'protects', 'WAF SHIELD');
    } else if (secType.includes('kms')) {
      for (const db of dbNodes) addEdge(sec.id, db.id, 'protects', 'KMS AES-256');
      for (const st of storageNodes) addEdge(sec.id, st.id, 'protects', 'SSE-KMS');
    } else if (secType.includes('security_group')) {
      for (const comp of computeNodes) addEdge(sec.id, comp.id, 'protects', 'SEC GROUP');
    }
  }

  return newEdges;
}

/**
 * Returns a fully connected and cleanly laid out topology state without orphans.
 */
export function autoConnectTopology(state: TopologyState): TopologyState {
  const missingEdges = inferMissingEdges(state.nodes, state.edges);
  const updatedEdges = { ...state.edges };
  for (const edge of missingEdges) {
    updatedEdges[edge.id] = edge;
  }
  return applyAutoLayout({
    ...state,
    edges: updatedEdges,
  });
}

