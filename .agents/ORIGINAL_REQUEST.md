# Original User Request

## 2026-08-29T16:40:57Z

Transform CloudSwarm Studio into an enterprise-grade, production-ready multi-cloud architecture and management platform where 4 specialized AI agents (Compute/Infra, Networking/Security, Storage/Databases, Cost/Monitoring) execute real tool calls in parallel with a 100+ resource catalog across AWS, Azure, and GCP.

Working directory: /Users/samaraldico/webmcp
Integrity mode: development

## Requirements

### R1. True Multi-Agent Orchestration & Planner Pipeline
Implement a multi-agent orchestration pipeline with a master Planner LLM decomposition step that breaks user requests into distinct, non-overlapping JSON sub-tasks for 4 specialized agents:
- **Agent Alpha (Compute & Infrastructure)**: Provisions VMs (EC2, Azure VM, GCE), Kubernetes/Containers (EKS, AKS, GKE, ECS), GPU clusters (p4d, g5, NDv4, A2), and Load Balancers.
- **Agent Beta (Networking & Security)**: Provisions VPCs/VNets, subnets, route tables, security groups, firewalls, IAM roles, KMS/Key Vault, and WAF rules.
- **Agent Gamma (Storage & Databases)**: Provisions relational DBs (RDS, Azure SQL, Cloud SQL), NoSQL (DynamoDB, Cosmos DB, Firestore), Object storage (S3, Azure Blob, GCS), Block storage (EBS, Managed Disks), and Data Lakes.
- **Agent Delta (Cost & FinOps Auditor)**: Calculates real-time multi-cloud run-rate pricing ($/mo), generates budget alerts, and executes rightsizing recommendations.
All agents must execute real WebMCP tool calls concurrently using `Promise.all` with immutable Zustand state mutations and fine-grained lock coordination.

### R2. Massive Multi-Cloud Resource Catalog (100+ Primitives)
Expand the resource library (`src/core/catalog/resourceCatalog.ts`) to 100+ cloud primitives across **AWS, Azure, and Google Cloud Platform (GCP)**:
- **Compute**: General purpose, Compute-optimized, Memory-optimized, GPU instances (NVIDIA A100/H100/A10G/T4), Containers (EKS, ECS, AKS, GKE), Serverless (Lambda, Azure Functions, Cloud Functions).
- **Storage**: Object (S3, Azure Blob, GCS), Block (EBS gp3/io2, Azure Managed Disks, GCE Persistent Disks), File (EFS, Azure Files, Filestore), Archive (Glacier, Azure Archive, Coldline).
- **Databases**: Relational (RDS Postgres/MySQL/Aurora, Azure SQL, Cloud SQL), NoSQL (DynamoDB, Cosmos DB, Firestore, Bigtable), Data Warehouses (Redshift, Synapse, BigQuery), In-Memory Caches (ElastiCache Redis, Azure Cache, Memorystore).
- **Networking**: VPCs, VNets, Subnets, NAT Gateways, Transit Gateways, ALBs, NLBs, Azure LB, Cloud Load Balancing, CDN (CloudFront, Azure CDN, Cloud CDN).
- **Security & IAM**: IAM Roles, Service Accounts, Key Vault / KMS, WAF, Shield, Security Groups, NSGs, Azure Defender.
- **AI/ML & Analytics**: SageMaker, Azure ML, Vertex AI, GPU Clusters, Databricks, EMR, Synapse, BigQuery.

### R3. Enterprise SaaS Interface & Rich Filtering
Redesign the studio interface to match top-tier cloud consoles (Azure, AWS, Vercel, Linear):
- **Resource Palette**: Fast instant search, multi-select provider filters (AWS, Azure, GCP), category tabs, and drag-and-drop capability for all 100+ primitives.
- **Dynamic Node Inspector**: Context-aware property forms generated dynamically per resource type (instance sizing dropdowns, vCPU/RAM/GPU selectors, storage sliders, region/zone selectors, security toggles).
- **Interactive Multi-Agent Canvas**: Clean 60 FPS graph viewport with distinct agent presence cues, smooth cursor paths, thought streams, and bounding lock halos.

### R4. Multi-Cloud FinOps Engine & Budget Alerts
Implement an expanded pricing calculation engine covering AWS, Azure, and GCP rate cards:
- Compute pricing by vCPU/RAM/GPU hours (730 hrs/mo).
- Storage pricing per GB-month across tiers (Standard, Infrequent, Archive, IOPS).
- Interactive Cost Breakdown Modal with provider filtering, CSV export, and monthly budget threshold alerts.

### R5. Full System Verification & Production Export
Ensure bi-directional Terraform/OpenTofu HCL sync supports multi-cloud provider blocks (`aws`, `azurerm`, `google`). Verify 1-click export of complete infrastructure bundles, Dockerfiles, and compliance audit reports.

---

## Acceptance Criteria

### Automated Verification
- [ ] `npm test` runs with 100% passing unit tests across all test suites with zero failures.
- [ ] `npm run build` compiles clean TypeScript (strict mode) with zero type errors.

### Orchestration & Concurrency
- [ ] Complex multi-cloud prompt execution triggers real WebMCP tool calls from all agents (Alpha, Beta, Gamma, Delta).
- [ ] All agent tool calls mutate the shared Zustand topology state deterministically with zero race conditions or clobbered nodes.
- [ ] Global execution log records agent attribution, tool parameters, latency, and state diffs.

### Resource Catalog & UI
- [ ] Resource catalog contains at least 100 distinct cloud primitives across AWS, Azure, and GCP.
- [ ] Palette search and provider filters instantly narrow down catalog items.
- [ ] Selecting any node opens a dynamic Node Inspector with resource-specific form fields and live cost recalculation.
- [ ] Cost breakdown modal shows line-item breakdown by provider and category with budget progress and CSV export.
