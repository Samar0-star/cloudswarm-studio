# Project: CloudSwarm Studio Multi-Cloud Transformation

## Architecture
CloudSwarm Studio is an enterprise-grade multi-cloud architecture and management platform featuring:
- **Planner & 4-Agent Swarm**: Master Planner LLM JSON decomposition with 4 specialized agents (Alpha: Compute & Infra, Beta: Networking & Security, Gamma: Storage & Databases, Delta: Cost & FinOps Auditor).
- **WebMCP Tool Engine & Concurrency**: Real WebMCP browser protocol tool calls executed concurrently via `Promise.all` with `StripedLockManager` (lexicographical entity locking) and `OptimisticStateEngine` (RFC 6902 CAS Immer state mutations with microsecond $\Delta^{-1}$ rollbacks).
- **100+ Multi-Cloud Resource Catalog**: 108 distinct cloud primitives across AWS, Azure, and GCP spanning Compute, Storage, Databases, Networking, Security & IAM, and AI/ML & Analytics.
- **Enterprise SaaS UI & Dynamic Inspector**: High-performance canvas with 4-agent spatial presence, resource palette with multi-provider filters (AWS/Azure/GCP), category search, and dynamic context-aware node inspector with live cost recalculation.
- **Multi-Cloud FinOps Engine**: AWS, Azure, and GCP rate cards (730 hrs/mo), compute vCPU/RAM/GPU hourly pricing, storage tier pricing, monthly budget alerts, and CSV export.
- **Multi-Cloud IaC Sync & Exporter**: Bi-directional AST Terraform/OpenTofu HCL synchronization and 1-click export of production ZIP bundles containing `main.tf` (`aws`, `azurerm`, `google`), `variables.tf`, `outputs.tf`, `terraform.tfvars.example`, hardened Dockerfile, and SHA-256 audit certificate.

## Code Layout
- `src/core/agents/` & `src/core/swarm/`: LiveSwarmOrchestrator, GeminiClient, NvidiaNimClient, agent persona definitions.
- `src/core/catalog/`: `resourceCatalog.ts` (108 cloud primitives, schemas, default configs, pricing models).
- `src/types/`: `topology.ts`, `swarm.ts`, `webmcp.ts` (CloudResourceType, AgentId, Node schemas).
- `src/core/webmcp/`: `WebModelContextEngine.ts`, `tools/topologyTools.ts`, `tools/securityTools.ts`, `tools/finopsTools.ts`.
- `src/core/lock/` & `src/core/state/`: `StripedLockManager.ts`, `OptimisticStateEngine.ts`, `DecisionDAG.ts`.
- `src/core/audit/` & `src/core/pricing/`: `CostCalculator.ts`, `SentinelAuditor.ts`, `rateCards.ts`.
- `src/components/canvas/`: `ResourcePalette.tsx`, `NodeInspector.tsx`, `TopologyCanvas.tsx`, `AgentCursor.tsx`, `ThoughtBubble.tsx`, `BoundingHalo.tsx`.
- `src/components/editor/`: `CostBreakdownModal.tsx`, `HCLPreviewModal.tsx`.
- `src/core/export/` & `src/core/sync/`: `ProductionMaterializer.ts`, `HCLSyncEngine.ts`.
- `src/tests/`: Unit test suites and E2E test suites (Tier 1-4).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | 4 Specialized AI Agents | Implement Agent Alpha (Compute/Infra), Beta (Network/Sec), Gamma (Storage/DB), Delta (FinOps) | M1 | R1 |
| 2 | Master Planner LLM Decomposition | Break user prompts into non-overlapping JSON sub-tasks for the 4 agents | M1 | R1 |
| 3 | Concurrent WebMCP Tool Calls | Execute real WebMCP tool calls with `Promise.all` and immutable CAS mutations | M1 | R1 |
| 4 | Fine-Grained Striped Lock Coordination | Lexicographical entity lock acquisition preventing circular wait | M1 | R1 |
| 5 | Global Execution Log & State Diffs | Audit agent attribution, tool params, latency, and RFC 6902 patch diffs | M1 | R1 |
| 6 | 100+ Cloud Primitives Catalog | 108 primitives across AWS (36), Azure (36), and GCP (36) | M2 | R2 |
| 7 | Multi-Cloud Type System & Schemas | Expand `CloudResourceType`, schemas, default configs, and validation rules | M2 | R2 |
| 8 | Multi-Cloud WebMCP Tool Schemas | Multi-cloud parameters for `topologyTools`, `securityTools`, `finopsTools` | M2 | R2 |
| 9 | Resource Palette Multi-Select Filters | Provider pills (AWS, Azure, GCP), category tabs, instant search, drag-and-drop | M3 | R3 |
| 10 | Dynamic Node Inspector Forms | Context-aware dynamic forms for AWS, Azure, and GCP with sizing dropdowns & sliders | M3 | R3 |
| 11 | 4-Agent Interactive Canvas Presence | 60 FPS viewport, 4 agent cursors, thought streams, and lock halos (including Delta) | M3 | R3 |
| 12 | Multi-Cloud FinOps Rate Cards | AWS, Azure, GCP rate cards (730 hrs/mo) for Compute (vCPU/RAM/GPU) & Storage tiers | M4 | R4 |
| 13 | Interactive Cost Breakdown Modal | Provider filtering, budget threshold alerts, and real-time category totals | M4 | R4 |
| 14 | FinOps CSV Export Routine | 1-click export of line-item cost breakdown to standard CSV format | M4 | R4 |
| 15 | Multi-Cloud Terraform Provider Blocks | Support `aws`, `azurerm`, `google` provider configurations in `main.tf` | M5 | R5 |
| 16 | Multi-Cloud Variables & Outputs | Dynamic `variables.tf`, `outputs.tf`, `terraform.tfvars.example` for all 3 clouds | M5 | R5 |
| 17 | Multi-Cloud Bi-directional HCL AST Sync | AST parsing and edge generation for `azurerm_*` and `google_*` blocks | M5 | R5 |
| 18 | 1-Click Production Bundle & Dockerfile | 8-artifact PKZIP export with SHA-256 audit certificate and hardened Dockerfile | M5 | R5 |
| 19 | E2E Testing Suite (Tiers 1-4) | Comprehensive opaque-box test suite covering all features, boundaries, and workloads | E2E-Track | Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Comprehensive 4-Tier Test Suite & `TEST_READY.md` publishing | None | IN_PROGRESS |
| M1 | 4-Agent Orchestration & Planner Pipeline | Agent Alpha, Beta, Gamma, Delta, Planner decomposition, WebMCP concurrency | None | PLANNED |
| M2 | 100+ Multi-Cloud Resource Catalog | 108 primitives across AWS/Azure/GCP, type system, catalog schemas | None | PLANNED |
| M3 | SaaS UI, Palette Filters & Dynamic Inspector | Resource Palette, Dynamic Node Inspector, 4-agent canvas presence | M1, M2 | PLANNED |
| M4 | Multi-Cloud FinOps Engine & Budget Alerts | Rate cards (AWS/Azure/GCP), Cost Modal, budget alerts, CSV export | M2 | PLANNED |
| M5 | Multi-Cloud IaC Export & E2E Verification | Terraform/OpenTofu multi-cloud materializer, HCL sync, 100% E2E pass | M1, M2, M3, M4, E2E | PLANNED |

## Interface Contracts
### Orchestration (`src/core/swarm/LiveSwarmOrchestrator.ts`) ↔ WebMCP (`src/core/webmcp/`)
- Planner decomposes prompt into `{ agentId: 'alpha' | 'beta' | 'gamma' | 'delta', tool: string, params: Record<string, unknown> }[]`.
- Concurrent dispatch via `Promise.all(tasks.map(t => webmcp.executeTool(t.tool, t.params)))`.

### Catalog (`src/core/catalog/resourceCatalog.ts`) ↔ UI (`ResourcePalette`, `NodeInspector`)
- Catalog exports `CLOUD_RESOURCE_CATALOG: ResourceCatalogItem[]` and helper `getResourceSchema(type: CloudResourceType)`.
- UI renders palette items and dynamic inspector property controls based on catalog item schema.

### FinOps (`src/core/audit/CostCalculator.ts`) ↔ UI (`CostBreakdownModal`, `NodeInspector`)
- `calculateNodeCost(node: CloudResourceNode): CostItem` supports AWS, Azure, and GCP rate cards.
- `calculateTopologyCostBreakdown(state: TopologyState)` returns multi-cloud cost breakdown and potential savings.
- `exportCostBreakdownCsv(breakdown: TopologyCostBreakdown): string` generates valid RFC 4180 CSV.

### Export (`src/core/export/ProductionMaterializer.ts`) ↔ Multi-Cloud Providers
- `generateProductionZip(state: TopologyState, auditReport: AuditReport): Promise<Blob>` packages multi-cloud Terraform files (`main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars.example`, `Dockerfile`, `audit_certificate.json`, `README.md`).
