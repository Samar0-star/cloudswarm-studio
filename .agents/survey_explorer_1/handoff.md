# Technical Survey Report: CloudSwarm Studio Agent Orchestration & State Management Architecture

**Author**: `survey_explorer_1`  
**Date**: 2026-08-29  
**Working Directory**: `/Users/samaraldico/webmcp/.agents/survey_explorer_1`  
**Target Architecture**: Enterprise-Grade Multi-Cloud Agent Swarm with WebMCP & RFC 6902 CAS Concurrency

---

## 1. Observation

Direct investigation of the codebase revealed the following core architectural components, code paths, and execution flows:

### 1.1 Multi-Agent Orchestration & Swarm Pipeline
- **Store Orchestrator Entrypoint**: `src/store/useCloudSwarmStore.ts:384-391`
  - In `useCloudSwarmStore`, `executeSwarmPrompt(userPrompt, singleAgentOnly)` branches between live LLM execution (`liveOrchestrator.executeLivePrompt(userPrompt, singleAgentOnly)`) and deterministic simulation (`runSwarmDemo()`).
- **Live LLM Orchestration Engine**: `src/core/swarm/LiveSwarmOrchestrator.ts:788-823`
  - Inspects user prompt to determine whether to execute incremental hardware scaling (`executeIncrementalUpgrade`) or full parallel swarm topology synthesis (`executeParallelSwarm`).
  - Calls `Promise.all` across agents to stream LLM reasoning chunks (`streamLlm` at `LiveSwarmOrchestrator.ts:63-125`) and dispatches WebMCP tool calls:
    - `create_resource_node` (`LiveSwarmOrchestrator.ts:613-620`)
    - `update_node_config` (`LiveSwarmOrchestrator.ts:380-389`, `683-687`, `708-712`)
    - `apply_security_hardening` (`LiveSwarmOrchestrator.ts:714-718`)
    - `calculate_topology_cost` (`LiveSwarmOrchestrator.ts:420`, `720`)
    - `optimize_cost_allocation` (`LiveSwarmOrchestrator.ts:721`)
- **LLM Clients & Key Rotation**:
  - `GeminiClient` (`src/core/swarm/GeminiClient.ts:30-238`): Multi-key pool rotation on HTTP 429/403 with SSE chunk streaming and OpenAI-compatible tool call formatting.
  - `NvidiaNimClient` (`src/core/swarm/NvidiaNimClient.ts:50-220`): Frontier reasoning and OpenAI/NVIDIA function schema transformation.
- **Deterministic Swarm Simulator**: `src/core/simulation/DeterministicSwarmSim.ts:94-201`
  - Zero-key, client-side simulation running full 3-agent orchestration (Alpha $\rightarrow$ Beta $\rightarrow$ Gamma) in $<100\text{ ms}$ across preset scenarios in `src/core/simulation/scenarios.ts` (e.g. `ecommerce_ha`, `fintech_zerotrust`, `microservices_mesh`, `global_banking_core`).

### 1.2 WebMCP Tool Execution Engine & Registry
- **WebModelContextEngine Protocol Core**: `src/core/webmcp/WebModelContextEngine.ts:19-371`
  - Implements the WebMCP browser standard (`document.modelContext` / `window.modelContext` via `src/core/webmcp/polyfill.ts`).
  - Strict JSON schema parameter validation (`WebModelContextEngine.ts:85-194`) verifying types, minimums, maximums, enums, regex patterns, and required fields.
  - Lifecycle DOM `CustomEvent` dispatching for telemetry:
    - `webmcp:tool-call` (`WebModelContextEngine.ts:240-244`)
    - `webmcp:tool-success` (`WebModelContextEngine.ts:278-282`)
    - `webmcp:tool-error` (`WebModelContextEngine.ts:257-261`, `297-301`)
    - `webmcp:registered` & `webmcp:unregistered` (`WebModelContextEngine.ts:41-46`, `59`)
- **Tool Domain Modules**:
  - `src/core/webmcp/tools/topologyTools.ts`: `orchestrate_cloud_topology`, `create_resource_node`, `update_resource_node`, `connect_resources`, `remove_resource_node`. Includes CIDR validation (`isValidCIDR`, `checkCIDROverlap`).
  - `src/core/webmcp/tools/securityTools.ts`: `audit_iam_zero_trust`, `generate_least_privilege_policy`, `apply_security_hardening`. Scans 7 core CIS/OWASP rules.
  - `src/core/webmcp/tools/finopsTools.ts`: `query_resource_pricing`, `calculate_topology_cost`, `optimize_cost_allocation`. Computes hourly and monthly AWS rate card items based on 730 hours/month.

### 1.3 Concurrency, Locking & State Management
- **StripedLockManager**: `src/core/lock/StripedLockManager.ts:50-341`
  - Mathematical Deadlock Elimination: Deduplicates and sorts all requested entity IDs in strict lexicographical order (`StripedLockManager.ts:90`) to prevent Coffman Circular Wait.
  - 64 stripe hash buckets, 3000ms TTL leases with automatic expiration sweeping (`sweepExpiredLeases` at line 301).
  - Exponential backoff with random jitter on lock contention (`StripedLockManager.ts:161-165`).
- **OptimisticStateEngine**: `src/core/state/OptimisticStateEngine.ts:79-417`
  - RFC 6902 CAS Operations: Evaluates `baseVersion`, per-node `expectedVersions`, and RFC 6902 `test` operations (`OptimisticStateEngine.ts:115-157`).
  - Immutable state updates using Immer `produceWithPatches` (`OptimisticStateEngine.ts:204-230`), producing forward RFC 6902 patches and inverse patches ($\Delta^{-1}$).
  - Microsecond deterministic rollbacks applying inverse patches (`rollback` at line 276-309).
  - Monotonic Lamport state versioning incremented on every transaction.
- **DecisionDAG Time-Travel**: `src/core/dag/DecisionDAG.ts`
  - In-memory commit DAG supporting timeline scrubbing, LCA (Lowest Common Ancestor) calculation, branch forking (`forkBranch`), commit checkout (`checkout`), and A/B split diffs (`getDiff`).
- **SentinelAuditor Memoization**: `src/core/audit/SentinelAuditor.ts:212-352`
  - Continuous 60 FPS auditing combining `CostCalculator` and `SecurityScanner`.
  - Computes deterministic pure TypeScript SHA-256 state signatures (`computeTopologySignature` at `SentinelAuditor.ts:173-207`) to memoize audit reports.

---

## 2. Logic Chain & Gap Analysis for 4-Agent Multi-Cloud Expansion

Tracing the architectural flow from the current baseline to the requirements specified in `ORIGINAL_REQUEST.md`:

```
User Prompt
    │
    ▼
[Planner LLM Decomposition] ─── (Parses requirements into non-overlapping JSON sub-tasks)
    │
    ├──► Agent Alpha (Compute & Infrastructure: EC2, Azure VM, GCE, EKS, AKS, GKE, ECS, GPUs, LBs)
    ├──► Agent Beta  (Networking & Security: VPCs/VNets, Subnets, Route Tables, SGs, Firewalls, IAM, KMS, WAF)
    ├──► Agent Gamma (Storage & Databases: RDS, Azure SQL, Cloud SQL, DynamoDB, Cosmos DB, S3, Blob, GCS, EBS, Data Lakes)
    └──► Agent Delta (Cost & FinOps Auditor: Multi-cloud run-rates, budget thresholds, rightsizing)
    │
    ▼
[WebMCP Tool Registry & Promise.all Concurrency]
    │  (orchestrate_multi_cloud_topology, create_resource_node, update_node_config, audit_security, finops_pricing)
    ▼
[StripedLockManager & Lexicographical Locking] ─── (Deadlock-free sorted entity locking with 3000ms TTL)
    │
    ▼
[OptimisticStateEngine (RFC 6902 CAS + Immer Patches)] ─── (Atomic state mutation + microsecond Delta^-1 rollback)
    │
    ▼
[Zustand Topology State Store & DecisionDAG Commit History] ─── (60 FPS Canvas, Reactive HUD, HCL Bi-directional Sync)
```

### Gap Analysis:

| Architectural Domain | Current Implementation | Target Multi-Cloud Specification (R1-R5) |
|---|---|---|
| **Agent Roles & Decomposition** | 3 agents (Alpha Topology, Beta SecOps, Gamma FinOps). Heuristic keyword prompt planning. | **4 Specialized Agents**: Alpha (Compute/Infra), Beta (Networking/Security), Gamma (Storage/Databases), Delta (FinOps Auditor). Master Planner LLM JSON decomposition step generating explicit sub-tasks. |
| **Resource Catalog** | 10 AWS Primitives (`aws_vpc`, `aws_subnet`, `aws_instance`, `aws_ecs_cluster`, `aws_eks_cluster`, `aws_db_instance`, `aws_s3_bucket`, `aws_lb`, `aws_security_group`, `aws_iam_role`). | **100+ Cloud Primitives across AWS, Azure, and GCP** spanning Compute, Storage, Databases, Networking, Security & IAM, AI/ML & Analytics (`src/core/catalog/resourceCatalog.ts`). |
| **WebMCP Tools** | AWS-only tool schemas in `topologyTools.ts`, `securityTools.ts`, `finopsTools.ts`. | **Multi-Cloud Tool Suite** supporting AWS, Azure (`azurerm`), and GCP (`google`) primitives, multi-provider property configurations, and unified pricing calls. |
| **FinOps Pricing Engine** | AWS rate cards (`AWS_PRICING_CATALOG` in `finopsTools.ts` and `CostCalculator.ts`). | **Expanded Multi-Cloud FinOps Engine** covering AWS, Azure, and GCP compute/storage rate cards, multi-tier storage, budget threshold alerts, and CSV export. |
| **UI & Dynamic Inspector** | Hardcoded resource inspector forms in `NodeInspector.tsx`; basic palette with 9 AWS items. | **Enterprise SaaS Palette & Dynamic Inspector**: Provider filter tabs (AWS, Azure, GCP), category search for 100+ primitives, dynamic property schema forms, and interactive Cost Breakdown Modal. |
| **IaC Sync & Exporter** | AWS-specific Terraform generator in `HCLSyncEngine.ts` and `ProductionMaterializer.ts`. | **Multi-Cloud Terraform / OpenTofu Sync**: Multi-provider blocks (`aws`, `azurerm`, `google`), Dockerfiles, and compliance export bundles. |

---

## 3. Caveats

1. **Test Environment Network Isolation**: External LLM endpoints (Gemini / NVIDIA NIM / Groq) rely on runtime environment API keys or local proxies. In CI/test environments without live keys, `DeterministicSwarmSim` and mock tools provide zero-key offline deterministic execution.
2. **Provider Scope**: All multi-cloud primitives across AWS, Azure, and GCP must maintain deterministic RFC 6902 CAS schema representations so that `OptimisticStateEngine` and `StripedLockManager` remain cloud-agnostic.
3. **Multi-Agent Lock Granularity**: When 4 agents execute tool calls concurrently via `Promise.all`, fine-grained resource IDs (e.g. `subnet_ids`, `vpc_id`, `security_group_ids`) must be locked in lexicographical order to prevent cross-provider contention.

---

## 4. Conclusion & Feature Inventory

The core concurrency, locking, RFC 6902 state mutation, WebMCP protocol compliance, and reactive auditing engines are fully functional and pass 100% of unit and integration tests.

### Detailed Feature Inventory:

1. **Planner LLM & 4-Agent Pipeline**:
   - Master Planner decomposition module that parses user prompts into a structured execution DAG with non-overlapping tasks.
   - Dedicated agent executors:
     - **Agent Alpha**: Compute & Infrastructure (VMs, Kubernetes, Containers, GPUs, Load Balancers).
     - **Agent Beta**: Networking & Security (VPCs/VNets, Subnets, Route Tables, Security Groups, IAM, KMS, WAF).
     - **Agent Gamma**: Storage & Databases (Relational DBs, NoSQL, Object Storage, Block Storage, Data Lakes).
     - **Agent Delta**: Cost & FinOps Auditor (Multi-cloud run-rate pricing, budget alerts, rightsizing recommendations).
2. **100+ Multi-Cloud Resource Catalog**:
   - Central catalog module (`src/core/catalog/resourceCatalog.ts`) containing $\ge 100$ typed primitives across AWS, Azure, and GCP.
3. **WebMCP Protocol & Concurrency Engine**:
   - `WebModelContextEngine` with JSON Schema validation, `Promise.all` concurrent execution, and DOM `CustomEvent` telemetry.
4. **Deterministic State & Concurrency Core**:
   - `OptimisticStateEngine` with RFC 6902 CAS verification, Immer forward/inverse patches ($\Delta^{-1}$), and microsecond rollbacks.
   - `StripedLockManager` with 64 stripes, 3000ms TTL leases, and lexicographical sort ordering.
   - `DecisionDAG` with time-travel scrubbing, branch forking, and A/B diff comparison.
5. **SentinelAuditor & Multi-Cloud FinOps**:
   - Real-time 60 FPS audit engine with pure TypeScript SHA-256 state signature caching.
   - Multi-cloud pricing engine for AWS, Azure, and GCP with budget alert notifications and CSV export.
6. **Enterprise SaaS UI & Dynamic Inspector**:
   - Multi-cloud palette with instant search and provider filters (AWS, Azure, GCP).
   - Dynamic node inspector rendering context-aware configuration controls and real-time cost updates.
   - Multi-agent spatial presence with cursors, bounding halos, thought streams, and tri-terminal execution HUD.

---

## 5. Verification Method

To independently verify all findings and test suites:

### 5.1 Run Complete Test Suite
```bash
npm test
```
**Observed Result**: 21 passed test suites, 371 passed tests, 0 failures.
- `src/tests/nim_orchestrator.test.ts`: PASS
- `src/tests/ui.test.ts`: PASS
- `src/tests/webmcp_adversarial_challenge.test.ts`: PASS
- `src/tests/dag.test.ts`: PASS
- `src/tests/hclSync.test.ts`: PASS
- `src/tests/e2e_swarm_presence_stress.test.ts`: PASS
- `src/tests/simulation.test.ts`: PASS
- `src/tests/gemini_client.test.ts`: PASS
- `src/tests/auditor.test.ts`: PASS
- `src/tests/security.test.ts`: PASS
- `src/tests/state.test.ts`: PASS
- `src/tests/e2e/tier3_cross_feature.test.ts`: PASS
- `src/tests/materializer.test.ts`: PASS
- `src/tests/webmcp.test.ts`: PASS
- `src/tests/pricing.test.ts`: PASS
- `src/tests/e2e/tier4_workloads.test.ts`: PASS
- `src/tests/e2e/tier2_boundaries.test.ts`: PASS
- `src/tests/tier5_adversarial_hardening.test.ts`: PASS
- `src/tests/e2e/tier1_features.test.ts`: PASS
- `src/tests/lock.test.ts`: PASS
- `src/tests/concurrency_stress.test.ts`: PASS

### 5.2 Compile TypeScript & Production Build
```bash
npm run build
```
**Observed Result**: `tsc -b && vite build` compiled with 0 errors, generated production assets in `dist/`.

### 5.3 Files to Inspect for Verification
- `src/core/swarm/LiveSwarmOrchestrator.ts`
- `src/core/lock/StripedLockManager.ts`
- `src/core/state/OptimisticStateEngine.ts`
- `src/core/webmcp/WebModelContextEngine.ts`
- `src/core/audit/SentinelAuditor.ts`
- `src/store/useCloudSwarmStore.ts`
