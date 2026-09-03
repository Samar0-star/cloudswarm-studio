# WebMCP Protocol & Tool Schema Specification Report

**Document ID**: SPEC-WEBMCP-2026-R2  
**Author**: Survey Spec Miner 2 (WebMCP Protocol & Schema Specialist)  
**Target Codebase**: `/Users/samaraldico/webmcp`  
**Target Milestone**: R2 (WebMCP Protocol Integration, `document.modelContext`, Polyfill Fallback, AWS Topology / Zero-Trust IAM / FinOps Tool Schemas)  
**Date**: 2026-08-26  

---

## 1. Executive Summary & Objective

CloudSwarm Studio requires an in-browser, agent-native cloud architecture and security operations platform where a human director commands a swarm of 3 specialized AI agents (Alpha: Topology Architect, Beta: Zero-Trust SecOps, Gamma: FinOps Live Auditor) directly on a real-time 60 FPS interactive canvas. 

This specification establishes the authoritative standard for **Requirement 2 (R2)**:
1. **`document.modelContext` Standard Integration**: Native client-side registration adhering to the Web Model Context Protocol (WebMCP) specification.
2. **Auto-Detecting Client-Side Polyfill Fallback**: Robust, zero-dependency browser polyfill that detects native browser WebMCP capability and falls back seamlessly to an in-memory event-driven runtime.
3. **Exhaustive Tool Declaration Schemas**: Strict JSON Schema (Draft-07 / 2020-12) & TypeScript definitions for:
   - **AWS Topology Orchestration**: Covering all 10 core AWS primitives (VPC, Subnets, EC2, ECS, EKS, RDS, S3, ALB, SecurityGroups, IAM Roles).
   - **Zero-Trust IAM Security Hardening**: CIS Benchmark compliance, least-privilege JSON policy generation, wildcard elimination, IMDSv2 enforcement, S3 TLS bucket policies.
   - **FinOps Live Pricing Queries**: Deterministic real-time AWS pricing rate cards, monthly cost calculations ($/mo), LCU / IOPS formulas, and cost-saving optimizations.
4. **Execution Contracts & Error Handling**: JSON-RPC 2.0 error mapping, transaction rollbacks, deterministic validation, and multi-agent concurrency compatibility.

---

## 2. WebMCP Protocol Standard & Browser Integration Architecture

### 2.1 Native WebMCP Protocol Model
WebMCP extends the Model Context Protocol (MCP) into standard web application runtimes. It standardizes how web applications expose capabilities (tools), stateful contexts (resources), and structured instructions (prompts) to autonomous agent swarms running inside the browser or extension host.

```
+-----------------------------------------------------------------------------------+
| Browser Document Context (`window` / `document`)                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | `document.modelContext` / `window.modelContext` (Native or Polyfill)        |  |
|  |                                                                             |  |
|  |  [Tool Registry]             [Resource Registry]       [Event Dispatcher]   |  |
|  |  - orchestrate_topology      - state://canvas/dag      - webmcp:tool-call   |  |
|  |  - audit_iam_zero_trust      - state://cost/breakdown  - webmcp:tool-result |  |
|  |  - query_finops_pricing      - state://iam/compliance  - webmcp:error       |  |
|  |  - generate_least_privilege  - state://terraform/hcl   - webmcp:state-sync  |  |
|  +-----------------------------------------------------------------------------+  |
|         ▲                                                 ▲                       |
|         │ Tool Registration / Calls                       │ Observation / Context |
|  +------┴-------------------------------------------------┴--------------------+  |
|  | CloudSwarm Studio Multi-Agent Engine (Alpha, Beta, Gamma)                  |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### 2.2 Standard Client-Side Interface Definitions

```typescript
/**
 * Core JSON Schema definition conforming to Draft-07 / 2020-12
 */
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number | boolean)[];
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  required?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  default?: unknown;
  additionalProperties?: boolean | JSONSchemaProperty;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface WebMCPTool {
  name: string;
  description: string;
  category?: 'topology' | 'security' | 'finops' | 'orchestration';
  inputSchema: ToolInputSchema;
  handler: (params: Record<string, unknown>, context: WebMCPExecutionContext) => Promise<WebMCPToolResult>;
}

export interface WebMCPResource {
  uri: string;
  name: string;
  mimeType: string;
  description?: string;
  read: () => Promise<{ contents: Array<{ uri: string; mimeType: string; text?: string; blob?: string }> }>;
}

export interface WebMCPExecutionContext {
  agentId: 'alpha' | 'beta' | 'gamma' | 'director';
  timestamp: number;
  requestId: string;
  signal?: AbortSignal;
}

export interface WebMCPContentItem {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: {
    uri: string;
    text?: string;
  };
}

export interface WebMCPToolResult {
  content: WebMCPContentItem[];
  isError?: boolean;
  meta?: {
    executionTimeMs: number;
    agentId: string;
    appliedPatches?: number;
    costDeltaMonthlyUsd?: number;
    securityScoreDelta?: number;
  };
}

export interface WebModelContextAPI {
  version: string;
  isPolyfill: boolean;
  registerTool(tool: WebMCPTool): () => void;
  unregisterTool(name: string): boolean;
  listTools(): WebMCPTool[];
  getTool(name: string): WebMCPTool | undefined;
  callTool(name: string, params: Record<string, unknown>, context?: Partial<WebMCPExecutionContext>): Promise<WebMCPToolResult>;
  registerResource(resource: WebMCPResource): () => void;
  listResources(): WebMCPResource[];
  readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType: string; text?: string }> }>;
  addEventListener(event: string, listener: (e: CustomEvent) => void): void;
  removeEventListener(event: string, listener: (e: CustomEvent) => void): void;
}
```

### 2.3 Auto-Detecting Polyfill Architecture

When running in standard modern browsers (Chrome, Firefox, Safari, Edge) without experimental native WebMCP flags, the application must install an auto-detecting polyfill on `window.modelContext` and `document.modelContext`.

#### Polyfill Lifecycle:
1. **Inspection**: Checks if `window.modelContext` or `document.modelContext` exists.
2. **Installation**: If undefined, instantiates `WebModelContextPolyfillEngine` and binds it with `Object.defineProperty` (enumerable, non-configurable, non-writable properties).
3. **Schema Validation**: Validates parameters against JSON Schema specifications before passing them to tool handlers using deterministic validation.
4. **Telemetry & Event Bus**: Emits DOM `CustomEvent` instances (`webmcp:registered`, `webmcp:tool-call`, `webmcp:tool-success`, `webmcp:tool-error`) for 60 FPS UI HUD integration.
5. **Execution Sandboxing**: Catches unhandled exceptions, enforces timeouts (default 5000ms), and formats standard JSON-RPC 2.0 error payloads.

---

## 3. Features Discovered & Analyzed

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | WebMCP Core | `document.modelContext` API | Standardized browser context object for tool/resource registration | Tool/Resource descriptors | Tool unregister handle / Resource map | Throws on duplicate registration without override flag | WebMCP Standard Spec & R2 Request |
| 2 | WebMCP Core | Client Polyfill Fallback | Zero-dependency fallback engine when `modelContext` is not native | Window / Document object | Instantiated `WebModelContextAPI` singleton | Graceful fallback, logs warning on duplicate init | R2 Spec Analysis |
| 3 | WebMCP Eventing | DOM CustomEvent Telemetry | Real-time event notifications for tool invocations and state changes | Event names & payload data | Dispatched `CustomEvent` on `document` | Silently dropped if listener throws exception | R2 / R4 Real-time HUD integration |
| 4 | Topology Tool | `orchestrate_cloud_topology` | Batch creation of interconnected AWS cloud architecture | Graph spec with nodes (VPC, Subnets, EC2, RDS, ALB, S3, etc.) and edges | Complete DAG node list, CIDR allocation map, total cost | Returns error if CIDR overlaps or cyclic deps exist | AWS Architecture Standard & R2 |
| 5 | Topology Tool | `create_resource_node` | Adds a single configured AWS resource node into canvas | Resource type, name, tier/config, parent container ID | Created Node ID, assigned IP/CIDR, initial cost | Validates missing required fields, returns 400 schema error | R2 Resource Orchestration |
| 6 | Topology Tool | `update_resource_node` | Modifies resource properties (e.g. instance type, Multi-AZ, storage) | Node ID, patch property dictionary | Updated Node struct, delta cost, updated security tags | Returns 404 if Node ID not found, 422 if invalid config | R2 & R5 Bi-directional sync |
| 7 | Topology Tool | `connect_resources` | Establishes directed dependency edge (e.g. ALB -> TG -> EC2, IAM -> Role) | Source Node ID, Target Node ID, Edge Type, Port/Protocol | Edge struct, route table entry / SG rule mapping | Returns error on invalid cross-VPC connection without peering | R2 Topology Graph Spec |
| 8 | Topology Tool | `remove_resource_node` | Deletes a node with cascading dependency validation | Node ID, cascade flag | Deleted Node IDs, orphan cleanup report | Returns error if dependent nodes exist and cascade is false | R2 / R1 Concurrency Spec |
| 9 | IAM Hardening | `audit_iam_zero_trust` | Scans canvas for wildcards, open ingress, plain S3, and missing IMDSv2 | Topology Node graph | List of CVE/OWASP findings, CIS compliance score (0-100%) | None (always succeeds, returns empty array if pristine) | R2 & R4 SecOps Auditor Spec |
| 10 | IAM Hardening | `generate_least_privilege_policy` | Synthesizes minimal IAM JSON policy tailored to node workload | Target Node ID, allowed services, required operations | Valid AWS IAM Policy Document JSON string | Returns error if resource type does not support IAM attachment | R2 Zero-Trust Security Spec |
| 11 | IAM Hardening | `apply_security_hardening` | Automatically remediates all detected security vulnerabilities | Target Node IDs or 'all', auto-remediate flags | List of applied patches, updated security score, diff log | Returns rollback status if patching conflicts with connectivity | R2 Automated SecOps Spec |
| 12 | FinOps Pricing | `query_resource_pricing` | Computes monthly cost breakdown for individual AWS resource config | Resource type, tier/instance_type, storage GB, multi-AZ, region | Monthly USD, hourly USD, breakdown items | Returns fallback estimate if unknown instance type | R2 FinOps Engine Spec |
| 13 | FinOps Pricing | `calculate_topology_cost` | Aggregates full real-time monthly infrastructure cost across all nodes | Full node graph, traffic estimates, region | Total monthly USD, category breakdown, itemized node table | Tolerates partial node specs, returns zero for base primitives | R2 & R4 60 FPS Auditor |
| 14 | FinOps Pricing | `optimize_cost_allocation` | Recommends actionable savings (Graviton, Spot, gp2->gp3, idle ALBs) | Full topology DAG, risk tolerance (low/medium/high) | Array of recommendations with estimated monthly $ savings | Returns empty recommendations if already optimized | R2 FinOps Specialist Spec |

---

## 4. Edge Cases & Robustness Analysis

| # | Feature | Edge Case Input | Observed / Expected Behavior |
|---|---------|-----------------|------------------------------|
| 1 | Polyfill Init | Native `window.modelContext` already defined by browser extension | Polyfill detects existing object, leaves native object intact, registers proxy hooks if missing methods. |
| 2 | Polyfill Tool Call | Tool execution throws uncaught JS error or timeout | Wrapped in standard WebMCP error response `{ isError: true, content: [{ type: 'text', text: error.message }] }`. |
| 3 | Tool Registration | Registering a tool with the same name twice | If overwrite=false, throws `Error("Tool 'xyz' is already registered")`. If overwrite=true, safely replaces handler. |
| 4 | Topology Orchestration | Overlapping Subnet CIDR blocks (e.g. two `10.0.1.0/24` subnets in same VPC) | Schema validator / handler detects CIDR collision, returns detailed error with suggested non-overlapping CIDR block. |
| 5 | Topology Orchestration | Cyclic network dependency (e.g. VPC peering loop or circular route tables) | DAG cycle detection flags cycle, rejects edge creation with `CYCLIC_DEPENDENCY_ERROR`. |
| 6 | IAM Policy Synthesis | Service requires S3 write access without specifying bucket ARN | Fails least-privilege test; tool generates wildcard-free policy scoped to explicit resource ARN or placeholder ARN. |
| 7 | Zero-Trust Audit | Security Group with 0.0.0.0/0 ingress on port 22 (SSH) or 3389 (RDP) | Flagged as CRITICAL severity; compliance score docked by 25 points; automated fix replaces with bastion or prefix list. |
| 8 | S3 Bucket Hardening | S3 Bucket created without encryption or public access block | Auto-hardener injects `aws:kms` SSE configuration and sets `block_public_acls = true`, `block_public_policy = true`. |
| 9 | FinOps Calculation | Extreme storage scale (e.g. 500,000 GB io2 with 64,000 IOPS) | Correctly calculates multi-tier IOPS pricing ($0.065/provisioned IOPS-mo) without numeric overflow. |
| 10 | FinOps Calculation | Free tier / zero-cost primitives (VPC, Security Groups, IAM Roles, Subnets) | Correctly evaluates to `$0.00/mo` with explicit description "Included in AWS Base Fabric". |
| 11 | Multi-Agent Invocation | Two agents invoking `update_resource_node` on the same node simultaneously | Handled via optimistic locking / CAS tokens, rejecting stale revision with `VERSION_CONFLICT_ERROR`. |
| 12 | Tool Execution Cancellation | In-flight tool invocation aborted via `AbortSignal` | Execution immediately halts, releases locks, and returns `{ isError: true, content: [{ type: 'text', text: 'Operation aborted' }] }`. |

---

## 5. Exhaustive Tool Declaration Schemas & Execution Contracts

### 5.1 Tool Family A: AWS Cloud Topology Orchestration

#### 1. `orchestrate_cloud_topology`
Batch generates or modifies an entire topology architecture on the interactive canvas.

```json
{
  "name": "orchestrate_cloud_topology",
  "description": "Orchestrates a complete multi-tier AWS cloud infrastructure topology on the canvas with automated subnet partitioning, security group assignment, and routing.",
  "category": "topology",
  "inputSchema": {
    "type": "object",
    "required": ["architecture_name", "region", "vpc", "resources"],
    "properties": {
      "architecture_name": {
        "type": "string",
        "description": "Human-readable name for the architecture (e.g., 'Production-EKS-Microservices')."
      },
      "region": {
        "type": "string",
        "enum": ["us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-southeast-1", "ap-northeast-1"],
        "default": "us-east-1",
        "description": "AWS Target Region."
      },
      "vpc": {
        "type": "object",
        "required": ["cidr_block"],
        "properties": {
          "cidr_block": { "type": "string", "pattern": "^(10|172\\.(1[6-9]|2[0-9]|3[0-1])|192\\.168)\\.[0-9]{1,3}\\.[0-9]{1,3}\\/(16|20|24)$", "default": "10.0.0.0/16" },
          "enable_dns_hostnames": { "type": "boolean", "default": true },
          "enable_dns_support": { "type": "boolean", "default": true },
          "tags": { "type": "object", "additionalProperties": { "type": "string" } }
        }
      },
      "resources": {
        "type": "array",
        "description": "List of AWS infrastructure nodes to instantiate.",
        "items": {
          "type": "object",
          "required": ["id", "type", "name", "config"],
          "properties": {
            "id": { "type": "string", "description": "Unique deterministic node identifier (e.g., 'subnet-public-1a', 'rds-main-postgres')." },
            "type": {
              "type": "string",
              "enum": [
                "aws_vpc",
                "aws_subnet",
                "aws_instance",
                "aws_ecs_cluster",
                "aws_eks_cluster",
                "aws_db_instance",
                "aws_s3_bucket",
                "aws_lb",
                "aws_security_group",
                "aws_iam_role"
              ]
            },
            "name": { "type": "string" },
            "parent_id": { "type": "string", "description": "ID of parent container (VPC ID or Subnet ID)." },
            "config": {
              "type": "object",
              "description": "Resource-specific configuration parameters."
            }
          }
        }
      },
      "connections": {
        "type": "array",
        "description": "Directed edges representing traffic flow or IAM attachment.",
        "items": {
          "type": "object",
          "required": ["source_id", "target_id", "relation_type"],
          "properties": {
            "source_id": { "type": "string" },
            "target_id": { "type": "string" },
            "relation_type": {
              "type": "string",
              "enum": ["routes_to", "attached_to", "target_group_of", "assumes_role", "stores_in", "depends_on"]
            },
            "port": { "type": "integer", "minimum": 1, "maximum": 65535 },
            "protocol": { "type": "string", "enum": ["tcp", "udp", "http", "https", "all"] }
          }
        }
      }
    }
  }
}
```

#### Detailed Schemas for 10 AWS Primitives:

1. **`aws_vpc` Configuration Schema**:
```json
{
  "type": "object",
  "required": ["cidr_block"],
  "properties": {
    "cidr_block": { "type": "string", "default": "10.0.0.0/16" },
    "enable_dns_hostnames": { "type": "boolean", "default": true },
    "enable_dns_support": { "type": "boolean", "default": true },
    "instance_tenancy": { "type": "string", "enum": ["default", "dedicated"], "default": "default" }
  }
}
```

2. **`aws_subnet` Configuration Schema**:
```json
{
  "type": "object",
  "required": ["vpc_id", "cidr_block", "availability_zone", "is_public"],
  "properties": {
    "vpc_id": { "type": "string" },
    "cidr_block": { "type": "string" },
    "availability_zone": { "type": "string", "enum": ["us-east-1a", "us-east-1b", "us-east-1c", "us-west-2a", "us-west-2b", "eu-west-1a", "eu-west-1b"] },
    "is_public": { "type": "boolean", "default": false },
    "map_public_ip_on_launch": { "type": "boolean", "default": false }
  }
}
```

3. **`aws_instance` (EC2) Configuration Schema**:
```json
{
  "type": "object",
  "required": ["instance_type", "subnet_id"],
  "properties": {
    "instance_type": { "type": "string", "enum": ["t3.micro", "t3.small", "t3.medium", "t3.large", "c6i.large", "c6i.xlarge", "c7g.large", "m6i.large", "m6i.xlarge", "r6i.large"], "default": "t3.medium" },
    "subnet_id": { "type": "string" },
    "ami": { "type": "string", "default": "ami-amazon-linux-2023" },
    "root_volume_gb": { "type": "integer", "minimum": 8, "maximum": 16384, "default": 30 },
    "root_volume_type": { "type": "string", "enum": ["gp3", "gp2", "io2"], "default": "gp3" },
    "http_tokens": { "type": "string", "enum": ["optional", "required"], "default": "required", "description": "IMDSv2 enforcement" },
    "security_group_ids": { "type": "array", "items": { "type": "string" } },
    "iam_instance_profile": { "type": "string" }
  }
}
```

4. **`aws_ecs_cluster` Configuration Schema**:
```json
{
  "type": "object",
  "required": ["cluster_name", "launch_type"],
  "properties": {
    "cluster_name": { "type": "string" },
    "launch_type": { "type": "string", "enum": ["FARGATE", "EC2"], "default": "FARGATE" },
    "cpu": { "type": "integer", "enum": [256, 512, 1024, 2048, 4096], "default": 1024 },
    "memory_mb": { "type": "integer", "enum": [512, 1024, 2048, 4096, 8192, 16384], "default": 2048 },
    "desired_count": { "type": "integer", "minimum": 1, "maximum": 50, "default": 2 },
    "subnet_ids": { "type": "array", "items": { "type": "string" } },
    "container_image": { "type": "string", "default": "nginx:alpine" },
    "container_port": { "type": "integer", "default": 80 }
  }
}
```

5. **`aws_eks_cluster` Configuration Schema**:
```json
{
  "type": "object",
  "required": ["cluster_name", "kubernetes_version", "subnet_ids"],
  "properties": {
    "cluster_name": { "type": "string" },
    "kubernetes_version": { "type": "string", "enum": ["1.28", "1.29", "1.30", "1.31"], "default": "1.30" },
    "subnet_ids": { "type": "array", "items": { "type": "string" } },
    "node_groups": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "instance_type", "desired_size"],
        "properties": {
          "name": { "type": "string" },
          "instance_type": { "type": "string", "default": "t3.medium" },
          "capacity_type": { "type": "string", "enum": ["ON_DEMAND", "SPOT"], "default": "ON_DEMAND" },
          "desired_size": { "type": "integer", "minimum": 1, "maximum": 20, "default": 3 },
          "min_size": { "type": "integer", "minimum": 1, "default": 1 },
          "max_size": { "type": "integer", "maximum": 50, "default": 6 }
        }
      }
    },
    "endpoint_private_access": { "type": "boolean", "default": true },
    "endpoint_public_access": { "type": "boolean", "default": false }
  }
}
```

6. **`aws_db_instance` (RDS) Configuration Schema**:
```json
{
  "type": "object",
  "required": ["engine", "instance_class", "allocated_storage_gb"],
  "properties": {
    "engine": { "type": "string", "enum": ["postgres", "mysql", "aurora-postgresql", "aurora-mysql", "mariadb"], "default": "postgres" },
    "engine_version": { "type": "string", "default": "16.1" },
    "instance_class": { "type": "string", "enum": ["db.t4g.micro", "db.t4g.medium", "db.r6g.large", "db.r6g.xlarge", "db.m6g.large"], "default": "db.t4g.medium" },
    "allocated_storage_gb": { "type": "integer", "minimum": 20, "maximum": 65536, "default": 50 },
    "storage_type": { "type": "string", "enum": ["gp3", "io2"], "default": "gp3" },
    "multi_az": { "type": "boolean", "default": true },
    "storage_encrypted": { "type": "boolean", "default": true },
    "kms_key_id": { "type": "string", "default": "alias/aws/rds" },
    "backup_retention_period": { "type": "integer", "minimum": 1, "maximum": 35, "default": 7 },
    "publicly_accessible": { "type": "boolean", "default": false },
    "subnet_ids": { "type": "array", "items": { "type": "string" } }
  }
}
```

7. **`aws_s3_bucket` Configuration Schema**:
```json
{
  "type": "object",
  "required": ["bucket_name"],
  "properties": {
    "bucket_name": { "type": "string", "pattern": "^[a-z0-9.-]{3,63}$" },
    "versioning_enabled": { "type": "boolean", "default": true },
    "encryption": {
      "type": "object",
      "properties": {
        "sse_algorithm": { "type": "string", "enum": ["AES256", "aws:kms"], "default": "aws:kms" },
        "kms_key_id": { "type": "string", "default": "alias/aws/s3" }
      }
    },
    "block_public_access": {
      "type": "object",
      "properties": {
        "block_public_acls": { "type": "boolean", "default": true },
        "block_public_policy": { "type": "boolean", "default": true },
        "ignore_public_acls": { "type": "boolean", "default": true },
        "restrict_public_buckets": { "type": "boolean", "default": true }
      }
    },
    "enforce_ssl_tls_requests": { "type": "boolean", "default": true }
  }
}
```

8. **`aws_lb` (Application Load Balancer) Configuration Schema**:
```json
{
  "type": "object",
  "required": ["name", "subnet_ids"],
  "properties": {
    "name": { "type": "string" },
    "internal": { "type": "boolean", "default": false },
    "load_balancer_type": { "type": "string", "enum": ["application", "network"], "default": "application" },
    "subnet_ids": { "type": "array", "items": { "type": "string" }, "minItems": 2 },
    "security_group_ids": { "type": "array", "items": { "type": "string" } },
    "listeners": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["port", "protocol"],
        "properties": {
          "port": { "type": "integer", "enum": [80, 443, 8080], "default": 443 },
          "protocol": { "type": "string", "enum": ["HTTP", "HTTPS"], "default": "HTTPS" },
          "ssl_policy": { "type": "string", "default": "ELBSecurityPolicy-TLS13-1-2-2021-06" },
          "certificate_arn": { "type": "string" }
        }
      }
    }
  }
}
```

9. **`aws_security_group` Configuration Schema**:
```json
{
  "type": "object",
  "required": ["name", "vpc_id"],
  "properties": {
    "name": { "type": "string" },
    "description": { "type": "string" },
    "vpc_id": { "type": "string" },
    "ingress_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["protocol", "from_port", "to_port"],
        "properties": {
          "protocol": { "type": "string", "enum": ["tcp", "udp", "icmp", "-1"] },
          "from_port": { "type": "integer", "minimum": 0, "maximum": 65535 },
          "to_port": { "type": "integer", "minimum": 0, "maximum": 65535 },
          "cidr_blocks": { "type": "array", "items": { "type": "string" } },
          "source_security_group_id": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    },
    "egress_rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["protocol", "from_port", "to_port", "cidr_blocks"],
        "properties": {
          "protocol": { "type": "string", "default": "-1" },
          "from_port": { "type": "integer", "default": 0 },
          "to_port": { "type": "integer", "default": 0 },
          "cidr_blocks": { "type": "array", "items": { "type": "string" }, "default": ["0.0.0.0/0"] }
        }
      }
    }
  }
}
```

10. **`aws_iam_role` Configuration Schema**:
```json
{
  "type": "object",
  "required": ["role_name", "trusted_service"],
  "properties": {
    "role_name": { "type": "string", "pattern": "^[a-zA-Z0-9+=,.@_-]{1,64}$" },
    "trusted_service": {
      "type": "string",
      "enum": ["ec2.amazonaws.com", "ecs-tasks.amazonaws.com", "eks.amazonaws.com", "lambda.amazonaws.com"],
      "default": "ecs-tasks.amazonaws.com"
    },
    "managed_policy_arns": { "type": "array", "items": { "type": "string" } },
    "inline_policy": {
      "type": "object",
      "properties": {
        "policy_name": { "type": "string" },
        "policy_document": { "type": "string", "description": "Raw JSON IAM Policy Document" }
      }
    }
  }
}
```

---

### 5.2 Tool Family B: Zero-Trust IAM Security Hardening

#### 1. `audit_iam_zero_trust`
Audits the current infrastructure against CIS AWS Benchmarks and OWASP Cloud Top 10.

```json
{
  "name": "audit_iam_zero_trust",
  "description": "Performs a deep Zero-Trust security and IAM least-privilege audit across all topology nodes, checking for wildcard permissions, unencrypted storage, open ingress, and missing IMDSv2.",
  "category": "security",
  "inputSchema": {
    "type": "object",
    "properties": {
      "severity_threshold": {
        "type": "string",
        "enum": ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        "default": "LOW"
      },
      "target_node_ids": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Optional list of node IDs to restrict audit scope."
      }
    }
  }
}
```

**Output Contract**:
```json
{
  "overall_compliance_score": 94.5,
  "status": "PASS_WITH_WARNINGS",
  "total_findings": 3,
  "findings": [
    {
      "id": "SEC-001",
      "severity": "CRITICAL",
      "category": "NETWORK_SECURITY",
      "target_node_id": "sg-public-web",
      "rule": "CIS-AWS-4.1-NO-UNRESTRICTED-SSH",
      "message": "Security Group 'sg-public-web' allows ingress from 0.0.0.0/0 on Port 22 (SSH).",
      "remediation": "Restrict Port 22 to internal bastion or VPC CIDR block."
    },
    {
      "id": "SEC-002",
      "severity": "HIGH",
      "category": "DATA_PROTECTION",
      "target_node_id": "s3-app-assets",
      "rule": "CIS-AWS-2.1.1-S3-ENCRYPTION",
      "message": "S3 bucket 's3-app-assets' is missing default KMS encryption.",
      "remediation": "Enable aws:kms server-side encryption."
    },
    {
      "id": "SEC-003",
      "severity": "HIGH",
      "category": "IAM_LEAST_PRIVILEGE",
      "target_node_id": "role-ecs-task",
      "rule": "OWASP-CLOUD-01-WILDCARD-ACTIONS",
      "message": "IAM Role 'role-ecs-task' contains wildcard action 's3:*' on resource '*'.",
      "remediation": "Generate least-privilege policy restricting to s3:GetObject and s3:PutObject on specific bucket ARN."
    }
  ]
}
```

#### 2. `generate_least_privilege_policy`
Synthesizes a minimal JSON IAM Policy document.

```json
{
  "name": "generate_least_privilege_policy",
  "description": "Generates a strict least-privilege AWS IAM Policy document JSON with zero wildcards, mandatory condition keys (e.g., aws:SecureTransport), and pinpoint resource ARNs.",
  "category": "security",
  "inputSchema": {
    "type": "object",
    "required": ["workload_type", "resource_arn", "allowed_operations"],
    "properties": {
      "workload_type": {
        "type": "string",
        "enum": ["s3_read_write", "s3_read_only", "dynamodb_crud", "sqs_producer_consumer", "secrets_manager_read", "kms_decrypt"]
      },
      "resource_arn": {
        "type": "string",
        "description": "Target AWS Resource ARN (e.g., 'arn:aws:s3:::company-app-data-prod/*')."
      },
      "allowed_operations": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Explicit AWS actions allowed (e.g. ['s3:GetObject', 's3:PutObject'])."
      },
      "enforce_mfa": { "type": "boolean", "default": false },
      "enforce_tls_version": { "type": "string", "enum": ["1.2", "1.3"], "default": "1.2" }
    }
  }
}
```

#### 3. `apply_security_hardening`
Remediates discovered vulnerabilities automatically.

```json
{
  "name": "apply_security_hardening",
  "description": "Applies automated Zero-Trust security patches across all or selected topology nodes, replacing open security groups, enforcing IMDSv2, enabling KMS encryption, and locking S3 buckets.",
  "category": "security",
  "inputSchema": {
    "type": "object",
    "properties": {
      "target_node_ids": { "type": "array", "items": { "type": "string" } },
      "auto_enforce_kms": { "type": "boolean", "default": true },
      "auto_enforce_imdsv2": { "type": "boolean", "default": true },
      "auto_close_public_db": { "type": "boolean", "default": true },
      "auto_block_s3_public": { "type": "boolean", "default": true }
    }
  }
}
```

---

### 5.3 Tool Family C: FinOps Live Pricing & Cost Engine

#### 1. `query_resource_pricing`
Queries the real-time hourly and monthly rate for an individual node.

```json
{
  "name": "query_resource_pricing",
  "description": "Calculates real-time monthly and hourly AWS cost breakdown for a specific AWS resource specification.",
  "category": "finops",
  "inputSchema": {
    "type": "object",
    "required": ["resource_type", "region", "config"],
    "properties": {
      "resource_type": {
        "type": "string",
        "enum": ["aws_instance", "aws_ecs_cluster", "aws_eks_cluster", "aws_db_instance", "aws_s3_bucket", "aws_lb", "aws_nat_gateway"]
      },
      "region": {
        "type": "string",
        "default": "us-east-1"
      },
      "config": {
        "type": "object",
        "description": "Resource-specific sizing parameters (e.g., instance_type, storage_gb, multi_az, vcpu, memory_gb)."
      }
    }
  }
}
```

**AWS Deterministic Pricing Matrix Reference**:
```typescript
export const AWS_PRICING_CATALOG = {
  // EC2 On-Demand Hourly Rates (us-east-1)
  ec2: {
    't3.micro': 0.0104,   // $7.59/mo
    't3.small': 0.0208,   // $15.18/mo
    't3.medium': 0.0416,  // $30.37/mo
    't3.large': 0.0832,   // $60.74/mo
    'c6i.large': 0.0850,  // $62.05/mo
    'c6i.xlarge': 0.1700, // $124.10/mo
    'c7g.large': 0.0723,  // $52.78/mo (Graviton -15%)
    'm6i.large': 0.0960,  // $70.08/mo
    'm6i.xlarge': 0.1920, // $140.16/mo
    'r6i.large': 0.1260,  // $91.98/mo
  },
  // RDS Hourly Rates (Single-AZ us-east-1, Multi-AZ is 2.0x)
  rds: {
    'db.t4g.micro': 0.0180, // $13.14/mo
    'db.t4g.medium': 0.0730,// $53.29/mo
    'db.m6g.large': 0.1820, // $132.86/mo
    'db.r6g.large': 0.2400, // $175.20/mo
    'db.r6g.xlarge': 0.4800,// $350.40/mo
  },
  // EBS & S3 Storage Rates ($/GB-mo)
  storage: {
    'ebs_gp3': 0.08,
    'ebs_io2': 0.125,
    'ebs_io2_iops': 0.065, // per provisioned IOPS-mo above 3000
    's3_standard': 0.023,
    'rds_storage_gp3': 0.115,
  },
  // ECS Fargate per unit per hour
  fargate: {
    'vcpu_per_hr': 0.04048,  // $29.55/vCPU-mo
    'gb_per_hr': 0.004445,   // $3.245/GB-mo
  },
  // EKS & Fabric fixed costs ($/mo)
  fabric: {
    'eks_cluster_fee_monthly': 73.00,
    'alb_base_monthly': 16.20,
    'nat_gateway_monthly': 32.85,
  }
};
```

#### 2. `calculate_topology_cost`
Aggregates live monthly infrastructure cost across the entire topology.

```json
{
  "name": "calculate_topology_cost",
  "description": "Calculates complete real-time aggregated monthly and hourly infrastructure cost across all nodes in the canvas DAG, with category breakdowns.",
  "category": "finops",
  "inputSchema": {
    "type": "object",
    "properties": {
      "currency": { "type": "string", "enum": ["USD", "EUR", "GBP"], "default": "USD" },
      "include_recommendations": { "type": "boolean", "default": true }
    }
  }
}
```

**Output Contract**:
```json
{
  "total_monthly_usd": 384.25,
  "total_hourly_usd": 0.5264,
  "breakdown_by_category": {
    "Compute": 124.10,
    "Database": 159.87,
    "Storage": 11.23,
    "Networking": 89.05,
    "Security": 0.00
  },
  "itemized_nodes": [
    { "node_id": "eks-cluster-prod", "type": "aws_eks_cluster", "monthly_usd": 164.11 },
    { "node_id": "rds-postgres-primary", "type": "aws_db_instance", "monthly_usd": 119.89 },
    { "node_id": "alb-external", "type": "aws_lb", "monthly_usd": 22.40 },
    { "node_id": "nat-gw-public-1a", "type": "aws_nat_gateway", "monthly_usd": 45.25 },
    { "node_id": "s3-static-assets", "type": "aws_s3_bucket", "monthly_usd": 2.60 },
    { "node_id": "vpc-main", "type": "aws_vpc", "monthly_usd": 0.00 }
  ],
  "potential_monthly_savings_usd": 68.40
}
```

#### 3. `optimize_cost_allocation`
Identifies and generates actionable architectural optimizations.

```json
{
  "name": "optimize_cost_allocation",
  "description": "Analyzes the topology for FinOps optimization opportunities (e.g., converting x86 instances to Graviton ARM64, Spot instances for non-critical workloads, gp2 to gp3 storage upgrades).",
  "category": "finops",
  "inputSchema": {
    "type": "object",
    "properties": {
      "strategy": {
        "type": "string",
        "enum": ["AGGRESSIVE", "BALANCED", "CONSERVATIVE"],
        "default": "BALANCED"
      }
    }
  }
}
```

---

## 6. Polyfill Complete Implementation & Integration Spec

### 6.1 `WebModelContextPolyfill` Specification

The polyfill must implement the standard `WebModelContextAPI` contract and expose auto-detection:

```typescript
export class WebModelContextPolyfill implements WebModelContextAPI {
  public readonly version = '1.0.0-draft';
  public readonly isPolyfill = true;

  private tools: Map<string, WebMCPTool> = new Map();
  private resources: Map<string, WebMCPResource> = new Map();
  private eventTarget = new EventTarget();

  public registerTool(tool: WebMCPTool): () => void {
    if (!tool.name || typeof tool.handler !== 'function') {
      throw new Error('WebMCP: Invalid tool registration. Name and handler are required.');
    }
    this.tools.set(tool.name, tool);
    this.dispatchEvent('webmcp:registered', { type: 'tool', name: tool.name, category: tool.category });
    return () => this.unregisterTool(tool.name);
  }

  public unregisterTool(name: string): boolean {
    const existed = this.tools.delete(name);
    if (existed) {
      this.dispatchEvent('webmcp:unregistered', { type: 'tool', name });
    }
    return existed;
  }

  public listTools(): WebMCPTool[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): WebMCPTool | undefined {
    return this.tools.get(name);
  }

  public async callTool(
    name: string,
    params: Record<string, unknown> = {},
    context?: Partial<WebMCPExecutionContext>
  ): Promise<WebMCPToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `WebMCP Error: Tool '${name}' not found.` }],
        meta: { executionTimeMs: 0, agentId: context?.agentId || 'unknown' }
      };
    }

    const execContext: WebMCPExecutionContext = {
      agentId: context?.agentId || 'director',
      timestamp: Date.now(),
      requestId: context?.requestId || `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      signal: context?.signal
    };

    const startTime = performance.now();
    this.dispatchEvent('webmcp:tool-call', { toolName: name, params, context: execContext });

    try {
      // Validate schema if required fields specified
      if (tool.inputSchema.required) {
        for (const reqField of tool.inputSchema.required) {
          if (params[reqField] === undefined || params[reqField] === null) {
            throw new Error(`Validation Error: Missing required parameter '${reqField}' for tool '${name}'.`);
          }
        }
      }

      const result = await tool.handler(params, execContext);
      const executionTimeMs = performance.now() - startTime;
      
      const enrichedResult: WebMCPToolResult = {
        ...result,
        meta: {
          ...result.meta,
          executionTimeMs,
          agentId: execContext.agentId
        }
      };

      this.dispatchEvent('webmcp:tool-success', { toolName: name, result: enrichedResult, context: execContext });
      return enrichedResult;
    } catch (err: unknown) {
      const executionTimeMs = performance.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorResult: WebMCPToolResult = {
        isError: true,
        content: [{ type: 'text', text: `Tool Execution Failed: ${errorMessage}` }],
        meta: { executionTimeMs, agentId: execContext.agentId }
      };
      this.dispatchEvent('webmcp:tool-error', { toolName: name, error: errorMessage, context: execContext });
      return errorResult;
    }
  }

  public registerResource(resource: WebMCPResource): () => void {
    this.resources.set(resource.uri, resource);
    this.dispatchEvent('webmcp:registered', { type: 'resource', uri: resource.uri });
    return () => { this.resources.delete(resource.uri); };
  }

  public listResources(): WebMCPResource[] {
    return Array.from(this.resources.values());
  }

  public async readResource(uri: string) {
    const res = this.resources.get(uri);
    if (!res) throw new Error(`Resource '${uri}' not found`);
    return res.read();
  }

  public addEventListener(event: string, listener: (e: CustomEvent) => void) {
    this.eventTarget.addEventListener(event, listener as EventListener);
  }

  public removeEventListener(event: string, listener: (e: CustomEvent) => void) {
    this.eventTarget.removeEventListener(event, listener as EventListener);
  }

  private dispatchEvent(name: string, detail: unknown) {
    const event = new CustomEvent(name, { detail, bubbles: true });
    this.eventTarget.dispatchEvent(event);
    if (typeof document !== 'undefined') {
      document.dispatchEvent(event);
    }
  }
}
```

### 6.2 Browser Auto-Detection & Initialization Helper

```typescript
/**
 * Ensures document.modelContext and window.modelContext are available
 */
export function ensureWebModelContext(): WebModelContextAPI {
  if (typeof window !== 'undefined') {
    if ((window as unknown as { modelContext?: WebModelContextAPI }).modelContext) {
      return (window as unknown as { modelContext: WebModelContextAPI }).modelContext;
    }
  }
  if (typeof document !== 'undefined') {
    if ((document as unknown as { modelContext?: WebModelContextAPI }).modelContext) {
      return (document as unknown as { modelContext: WebModelContextAPI }).modelContext;
    }
  }

  const polyfill = new WebModelContextPolyfill();

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'modelContext', {
      value: polyfill,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  }

  if (typeof document !== 'undefined') {
    Object.defineProperty(document, 'modelContext', {
      value: polyfill,
      writable: false,
      configurable: true,
      enumerable: true,
    });
  }

  return polyfill;
}
```

---

## 7. Security & OWASP Verification Standard

In accordance with strict security rules and OWASP Top 10 for Cloud & LLM Agents:
1. **No Hardcoded API Keys**: All pricing and cloud simulations operate deterministically in-browser with zero external API credentials required.
2. **Strict Parameter Sanitization**: Prevents prompt injection, malicious script payloads in tag fields, and CIDR buffer boundary overflows.
3. **Deterministic Rollbacks**: If any tool encounters validation or lock failure during multi-agent execution, state changes are rolled back using inverse JSON patches (RFC 6902 / Immer).
4. **Least-Privilege Enforcement**: Security auditing tool scores any `"Action": "*"` or `"Resource": "*"` as a high-severity security risk.

---

## 8. Verification & Test Suite Matrix

To guarantee 100% test pass rate with Jest (`npm test`) and clean TypeScript build (`npm run build`):

| Test Suite | File Path | Test Cases |
|------------|-----------|------------|
| WebMCP Polyfill Registration | `src/tests/webmcp/polyfill.test.ts` | 1. Auto-detection & singleton injection on `window` and `document`.<br>2. Tool registration & duplicate rejection.<br>3. Listing tools & category filtering.<br>4. CustomEvent dispatching and listener triggers. |
| WebMCP Tool Execution Contracts | `src/tests/webmcp/execution.test.ts` | 1. Parameter validation & missing required fields.<br>2. Execution timing (`executionTimeMs`) metadata validation.<br>3. Error wrapping on handler exceptions.<br>4. Signal abort handling. |
| AWS Topology Tool Schemas | `src/tests/webmcp/topology_schemas.test.ts` | 1. Validates all 10 AWS resource configurations against JSON Schemas.<br>2. Rejects invalid CIDR strings and illegal instance types.<br>3. DAG edge validation (cross-VPC / invalid port ranges). |
| Zero-Trust IAM & SecOps Tools | `src/tests/webmcp/iam_hardening.test.ts` | 1. CIS benchmark compliance scoring calculation.<br>2. Wildcard permission detection.<br>3. Least-privilege policy generation with TLS 1.2+ conditions.<br>4. Automated patch application. |
| FinOps Live Pricing Engine | `src/tests/webmcp/finops_pricing.test.ts` | 1. Accurate calculation for EC2, RDS (Single vs Multi-AZ), EKS, ECS, and ALB.<br>2. Storage calculations (gp3 vs io2 IOPS).<br>3. Graviton & Spot savings recommendation algorithms. |

---

## 9. Conclusion & Next Steps

This specification establishes the comprehensive blueprint for Requirement R2 in CloudSwarm Studio. All tool schemas, polyfill interfaces, error behaviors, and testing contracts are precisely delineated. The engineering sub-orchestrators and workers can directly implement the TypeScript types, WebMCP registry, and Jest test suites without ambiguity.
