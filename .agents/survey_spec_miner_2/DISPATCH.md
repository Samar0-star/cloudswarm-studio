# Survey Spec Miner 2 Dispatch

## 2026-08-26T10:40:55Z
Task:
1. Read the user request at /Users/samaraldico/webmcp/.agents/ORIGINAL_REQUEST.md and analyze the authoritative specification requirements for WebMCP integration (R2):
   - `document.modelContext` client-side WebMCP registration conforming to official Web Model Context Protocol specification.
   - Client-side auto-detecting polyfill fallback when browser environment lacks native WebMCP.
   - Tool declaration schemas for:
     a) Topology generation / AWS cloud resource orchestration (VPC, Subnets, EC2, ECS, EKS, RDS, S3, ALB, SecurityGroups, IAM Roles).
     b) Zero-Trust IAM security hardening & least-privilege policy generation.
     c) FinOps live pricing queries (calculating real-time monthly $/mo estimates for cloud resources).
2. Define precise JSON Schema definitions, tool execution contracts, and polyfill interface specifications.
3. Write your complete findings to `/Users/samaraldico/webmcp/.agents/survey_spec_miner_2/spec_report.md` and complete a self-contained `/Users/samaraldico/webmcp/.agents/survey_spec_miner_2/handoff.md`.
4. Send a message to orchestrator with a summary of your report and confirmation.
