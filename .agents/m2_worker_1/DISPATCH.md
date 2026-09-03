## 2026-08-29T16:46:13Z
You are m2_worker_1.
Your working directory is /Users/samaraldico/webmcp/.agents/m2_worker_1.
Read /Users/samaraldico/webmcp/.agents/ORIGINAL_REQUEST.md (MANDATORY).
Read /Users/samaraldico/webmcp/PROJECT.md.
Read survey report at /Users/samaraldico/webmcp/.agents/survey_explorer_2/handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Exclusive File Ownership:
- `src/core/catalog/resourceCatalog.ts` (NEW)
- `src/types/topology.ts`
- `src/core/webmcp/tools/topologyTools.ts`
- `src/core/webmcp/tools/securityTools.ts`
- `src/core/webmcp/tools/finopsTools.ts`

Mission: Implement Milestone M2 (Requirement R2):
1. Create `src/core/catalog/resourceCatalog.ts` containing 108 distinct cloud primitives (36 AWS, 36 Azure, 36 GCP) spanning:
   - Compute: General purpose, Compute-optimized, Memory-optimized, GPU instances (NVIDIA A100/H100/A10G/T4), Containers (EKS, ECS, AKS, GKE), Serverless (Lambda, Azure Functions, Cloud Functions).
   - Storage: Object (S3, Azure Blob, GCS), Block (EBS gp3/io2, Azure Managed Disks, GCE Persistent Disks), File (EFS, Azure Files, Filestore), Archive (Glacier, Azure Archive, Coldline).
   - Databases: Relational (RDS Postgres/MySQL/Aurora, Azure SQL, Cloud SQL), NoSQL (DynamoDB, Cosmos DB, Firestore, Bigtable), Data Warehouses (Redshift, Synapse, BigQuery), In-Memory Caches (ElastiCache Redis, Azure Cache, Memorystore).
   - Networking: VPCs, VNets, Subnets, NAT Gateways, Transit Gateways, ALBs, NLBs, Azure LB, Cloud Load Balancing, CDN (CloudFront, Azure CDN, Cloud CDN).
   - Security & IAM: IAM Roles, Service Accounts, Key Vault / KMS, WAF, Shield, Security Groups, NSGs, Azure Defender.
   - AI/ML & Analytics: SageMaker, Azure ML, Vertex AI, GPU Clusters, Databricks, EMR, Synapse, BigQuery.
   Each item must have type, provider ('aws'|'azure'|'google'), category, name, description, iconName, defaultConfig, pricingModel, and validationRules.
2. Update `src/types/topology.ts` to support unified `CloudResourceType` (union of all AWS, Azure, GCP primitives) while maintaining backwards compatibility.
3. Update WebMCP tool parameter schemas in `topologyTools.ts`, `securityTools.ts`, `finopsTools.ts` to support multi-cloud resource types and properties.
4. Run `npm test` and `npm run build` to verify 100% clean compilation and passing tests.

Write your completion report to /Users/samaraldico/webmcp/.agents/m2_worker_1/handoff.md and send a message when done.
