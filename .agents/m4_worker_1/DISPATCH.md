## 2026-08-29T16:54:21Z

Scope & Exclusive File Ownership:
- `src/core/audit/CostCalculator.ts`
- `src/core/pricing/rateCards.ts` (if needed/created)
- `src/components/editor/CostBreakdownModal.tsx`

Mission: Implement Milestone M4 (Requirement R4):
1. **Multi-Cloud FinOps Engine (`CostCalculator.ts`)**:
   - Expand rate cards to cover AWS, Azure, and GCP rate cards based on 730 hours/month.
   - Compute pricing by vCPU/RAM/GPU hours (NVIDIA A100/H100/A10G/T4, General, Compute, Memory).
   - Storage pricing per GB-month across tiers (Standard, Infrequent, Archive, Provisioned IOPS).
   - Database and container pricing across providers (RDS/Aurora, Azure SQL/Cosmos DB, Cloud SQL/BigQuery, EKS/AKS/GKE).
   - Generate automated multi-cloud rightsizing recommendations (Graviton, gp3, Azure B-series/Premium SSD, GCP E2/Balanced PD).
2. **Cost Breakdown Modal (`CostBreakdownModal.tsx`)**:
   - Interactive provider filtering (`All`, `AWS`, `Azure`, `GCP`).
   - Monthly budget threshold input with real-time progress meter and dynamic color status (Emerald -> Amber -> Rose alert banner when budget exceeded).
   - Line-item breakdown table by provider, resource name, type, and monthly run-rate.
   - 1-Click CSV export routine (`exportCostBreakdownCsv`) formatting RFC 4180 CSV with headers, line items, category subtotals, and total monthly spend.
3. Verify `npm test` and `npm run build` pass with 100% clean compilation.
