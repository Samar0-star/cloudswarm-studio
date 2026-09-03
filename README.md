# CloudSwarm Studio ⚡

> **The World's First Agent-Native Cloud Architecture CAD Workstation — Powered by the Web Model Context Protocol (WebMCP).**
> 
> *Built for the Model Context Protocol (WebMCP) Hackathon in partnership with OpenAI, Google Chrome, Cloudflare, and Vercel.*

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict_Mode-blue?logo=typescript)](https://www.typescriptlang.org/)
[![WebMCP Standard](https://img.shields.io/badge/WebMCP-window.modelContext-cyan)](https://github.com/webmcp)
[![Tests Passing](https://img.shields.io/badge/Unit_Tests-510%2F510_Passed-emerald?logo=jest)](https://jestjs.io/)
[![CIS Benchmark](https://img.shields.io/badge/CIS_Benchmark_1.5-100%2F100_A%2B-green)](https://www.cisecurity.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📖 Project Story & Hackathon Submission

### 💡 Inspiration
Modern cloud architecture is trapped between two disconnected worlds:
1. **The Human Drawing Board:** Solutions architects sketch static boxes on visual whiteboards (Miro, Lucidchart, draw.io). These diagrams are visual-only, drift within days of deployment, have zero cost awareness, and cannot be programmatically audited.
2. **The Infrastructure Codebase:** DevOps engineers spend weeks manually authoring thousands of lines of Terraform or OpenTofu HCL code. Reviewing complex pull requests in plain text is slow and error-prone, leading to silent security misconfigurations and unexpected budget blowouts.

When OpenAI and Google Chrome introduced **WebMCP** (`window.modelContext` / `navigator.modelContext`), the missing bridge became obvious: **What if the web browser itself became an intelligent, agent-native cloud workstation where a human engineer and external LLMs co-architect multi-cloud infrastructure in real time?**

Instead of an AI relying on brittle DOM scraping, computer-vision coordinate guessing, or slow sequential click-bots, **WebMCP enables external LLMs (ChatGPT Desktop, Claude Desktop, Cursor) to directly discover typed tools, execute structured mutations, and stream live resource state over standard JSON-RPC**. CloudSwarm Studio was engineered from the ground up to turn the browser canvas into a first-class Model Context Protocol environment.

---

### 🚀 What It Does
**CloudSwarm Studio** is an enterprise-grade multi-cloud architecture CAD workstation:

1. **Simultaneous Human + External LLM Co-Editing:**
   - **External LLM Control via WebMCP:** External models connect over the local WebMCP bridge (`http://localhost:3001/mcp`) or in-browser `window.modelContext`. The AI invokes structured tools to inspect the canvas, provision multi-tier resources, wire directed network flows, and audit security.
   - **Simultaneous Human CAD Interaction:** The human architect uses the mouse to drag primitives from the 108-item catalog, connect magnetic dependency wires, inspect configurations, or wipe the canvas with 1-click **Clear**.
   - **Clean Precision Visual Cursors:** When an external LLM executes a tool, a precision colored cursor glides to the target location displaying a concise action popup (**under 4 words**, e.g., `Linking WAF Shield`, `Synthesizing DB`, `Auditing Security`). The cursor **immediately vanishes** the millisecond the action completes—zero lingering ghost cursors.
   - **Zero Leaked API Keys:** The workstation operates fully sovereignly without requiring any API keys stored in the frontend. The external LLM provides its own intelligence over the protocol.

2. **Git-like Time Travel Decision DAG:**
   - Every architectural change—whether made by human drag-and-drop or an external LLM tool call—is an immutable cryptographic commit in an in-memory Directed Acyclic Graph (DAG).
   - **Timeline Scrubber:** Slide backward and forward in time to replay any architectural decision step-by-step.
   - **Branching & A/B Split Comparison:** Fork experimental topologies and render side-by-side visual, security, and economic diffs ($\Delta\$$ / $\Delta\text{CIS}$) before deploying.

3. **Bidirectional Terraform HCL2 Synchronization:**
   - Visual canvas mutations instantly generate production-ready HashiCorp Configuration Language (Terraform/OpenTofu) code with variables, outputs, and tags.
   - Pressing **`E`** opens the live HCL editor: editing the code directly parses the AST and updates the visual canvas in real time.

4. **108 Multi-Cloud CAD Primitives:**
   - Comprehensive multi-cloud catalog across **AWS (36)**, **Azure (36)**, and **GCP (36)** + Kubernetes.
   - Intelligent spatial auto-containment: Dropping compute nodes into a VPC or Subnet automatically provisions boundary parent-child relationships.

5. **Real-Time FinOps & Zero-Trust SecOps:**
   - **Live Spend Engine:** Computes real-time monthly run-rates (`$ /mo`) using AWS, Azure, and GCP rate cards with 1-click Graviton/gp3 cost optimization.
   - **CIS Benchmark 1.5 Auditor:** Live security posture scoring (`100/100 A+`) with 1-click auto-remediation (IMDSv2 enforcement, S3 public block, KMS encryption).

6. **Chaos Monkey Outage & Threat Simulators:**
   - In-browser resilience testing: Simulate multi-AZ datacenter outages and active lateral movement attacks to verify automated self-healing.

---

### ⚙️ How It Works & WebMCP Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       External LLM                          │
│        (ChatGPT Desktop / Claude Desktop / MCP Client)       │
└──────────────────────────────┬──────────────────────────────┘
                               │  JSON-RPC 2.0 / SSE
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             WebMCP Bridge (:3001/mcp, /poll)                │
└──────────────────────────────┬──────────────────────────────┘
                               │  Bi-directional Sync
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 CloudSwarm Studio (:3000)                   │
│                                                             │
│   ┌─────────────────────┐       ┌───────────────────────┐   │
│   │   Visual Canvas     │◄─────►│    Human Architect    │   │
│   │ (108 CAD Primitives)│       │  (Mouse / Wire Drag)  │   │
│   └──────────┬──────────┘       └───────────────────────┘   │
│              │                                              │
│              ▼                                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │        64-Stripe Entity Lock Manager                │   │
│   │        Optimistic State Engine (RFC 6902 CAS)       │   │
│   │        Bidirectional AST Terraform Compiler         │   │
│   │        Git-Style Decision DAG Timeline              │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 1. The WebMCP Protocol Layer (`window.modelContext` & `:3001/mcp`)
CloudSwarm Studio implements the proposed WebMCP specification directly in the browser DOM and over a local HTTP/SSE bridge:
- **35 Registered WebMCP Tools:**
  - `orchestrate_cloud_topology`: Master multi-cloud architectural synthesis.
  - `create_resource_node`, `update_resource_node`, `update_node_config`: Precise primitive provisioning across AWS, Azure, and GCP.
  - `connect_resources`: Establishes directed network flows, IAM bindings, or storage pipes.
  - `remove_resource_node`: Cascading deletion of orphan dependencies.
  - `get_canvas_state`: Read-only snapshot of all nodes, edges, and active selections.
  - `clear_canvas`: Resets the workspace to an empty pristine state.
  - `audit_iam_zero_trust`: Real-time CIS compliance scanner.
  - `apply_security_hardening`: 1-click Zero-Trust remediation.
  - `calculate_topology_cost`, `query_resource_pricing`: FinOps spend calculation.
  - `export_terraform_hcl`: Compiles the visual topology into Terraform HCL2.
  - `time_travel_to_step`, `fork_architecture_branch`, `switch_architecture_branch`: Decision DAG controls.
- **Bi-Directional State Broadcast:**
  - The browser tab continuously broadcasts its canvas state and human node selections to `/api/webmcp/state`.
  - External LLMs can inspect what the human is selecting, reading, or building and assist collaboratively.

#### 2. Fine-Grained Striped Locking (`StripedLockManager.ts`)
JavaScript is single-threaded. When an external LLM and a human interact simultaneously, traditional state machines suffer from race conditions and "last-write-wins" corruption.
- We implemented **64-stripe lexicographical entity locking**.
- The AI acquires locks specifically on the entity IDs it modifies. The human can simultaneously move adjacent nodes or connect wires without deadlock, node squeezing, or UI blocking.

#### 3. Optimistic State Engine & CAS Rollback (`OptimisticStateEngine.ts`)
- State mutations are processed as atomic transactions using RFC 6902 JSON-Patches.
- Every forward patch generates an exact inverse patch. If a tool call fails or violates a security policy, the state rolls back in microseconds without interrupting human work.

---

### 🏆 Accomplishments & Verification
- **35 fully functioning WebMCP tools** with strict recursive JSON Schema validation.
- **38 test suites, 510/510 unit tests passing (100% green)** across all core layers.
- **Real enterprise naming standards**: Zero cheesy `"ChatGPT Deployed..."` labels; all primitives map to production cloud standards.
- True **Git-style Time Travel Decision DAG** with instant visual timeline scrubbing and A/B split diffing.
- Sub-millisecond bidirectional synchronization between the visual canvas and Terraform HCL2.

---

## 🛠️ Quick Start

### 1. Installation
```bash
git clone https://github.com/your-username/cloudswarm-studio.git
cd webmcp
npm install
```

### 2. Start the CAD Studio
```bash
npm run dev
# Studio opens at http://localhost:3000
```

### 3. Start the WebMCP Bridge (For External LLMs)
```bash
node bridge.mjs
# WebMCP JSON-RPC & SSE Bridge active on http://127.0.0.1:3001
```

### 4. Connect ChatGPT Desktop or Any MCP Client
Add the server to your MCP configuration (e.g. `claude_desktop_config.json` or ChatGPT Desktop tools):
```json
{
  "mcpServers": {
    "cloudswarm": {
      "command": "node",
      "args": ["/absolute/path/to/webmcp/bridge.mjs"]
    }
  }
}
```
Or interact via standard HTTP POST to `http://localhost:3001/mcp`:
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_resource_node",
      "arguments": {
        "id": "alb_ingress",
        "type": "aws_lb",
        "name": "Dual-Stack Application Load Balancer",
        "position": { "x": 450, "y": 160 }
      }
    }
  }'
```

### 5. Run Test Suite (510 Unit Tests)
```bash
npm test
```

### 6. Production Build
```bash
npm run build
```

---

## ⌨️ Pro-Tip Keyboard Shortcuts
* **`D`**: Toggle 108-Primitive CAD Palette Drawer
* **`E`**: Open/Close Live Terraform HCL2 Editor
* **`L`**: Auto-Layout and Align Canvas
* **`T`**: Scroll to Decision DAG Timeline
* **`Esc`**: Cancel Connection / Close Modals
* **`Delete / Backspace`**: Delete Selected Node or Edge
* **Double-Click any Card**: Open Compact Resource Inspector

---

## 📄 License
MIT License — see the [LICENSE](LICENSE) file for details.
