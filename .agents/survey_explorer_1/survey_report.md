# Codebase & Tooling Survey Report — CloudSwarm Studio

**Author**: Survey Explorer 1 (Codebase & Tooling Specialist)  
**Date**: 2026-08-26  
**Repository Root**: `/Users/samaraldico/webmcp`  
**Working Directory**: `/Users/samaraldico/webmcp/.agents/survey_explorer_1`

---

## 1. Executive Summary

A comprehensive investigation of the `/Users/samaraldico/webmcp` repository was conducted to inspect the existing file structure, build systems, TypeScript configurations, styling infrastructure, testing harness, and dependency graph.

The repository is initialized as a greenfield **React 19 + TypeScript + Vite + Tailwind CSS** project targeting modern ES2022. All foundational tooling configuration files (`package.json`, `tsconfig.json`, `vite.config.ts`, `jest.config.ts`, `tailwind.config.js`, `postcss.config.js`, `index.html`) are present in root. The `node_modules` dependency tree has been installed (441 packages audited, 0 vulnerabilities). The `src/` directory is not yet populated and will be constructed during the implementation milestones.

---

## 2. Existing File Structure

```
/Users/samaraldico/webmcp
├── .agents/
│   ├── ORIGINAL_REQUEST.md
│   ├── orchestrator/
│   ├── sentinel/
│   ├── survey_explorer_1/
│   ├── survey_spec_miner_2/
│   └── survey_explorer_3/
├── index.html
├── jest.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 3. Environment & Runtime Specifications

- **Node.js**: `v22.22.3`
- **npm**: `10.9.8`
- **ECMAScript Target**: `ES2022`
- **Module Format**: ES Modules (`"type": "module"`)
- **Frontend Framework**: React 19 (`react` 19.0.0, `react-dom` 19.0.0)
- **Bundler & Dev Server**: Vite 6.0.5 (`@vitejs/plugin-react` 4.3.4)
- **Type Checker**: TypeScript ~5.7.2
- **Unit Testing**: Jest 29.7.0 + `ts-jest` 29.2.5 + `jest-environment-jsdom` 29.7.0
- **CSS Preprocessor**: Tailwind CSS 3.4.17 + PostCSS 8.4.49 + Autoprefixer 10.4.20

---

## 4. Dependency Inventory & Analysis

### 4.1 Production Dependencies (`dependencies`)

| Package | Version | Purpose in CloudSwarm Studio |
|---|---|---|
| `react` | `^19.0.0` | UI rendering engine |
| `react-dom` | `^19.0.0` | DOM bindings for React 19 |
| `zustand` | `^5.0.3` | High-performance reactive state store for swarm state, DAG, and UI controls |
| `immer` | `^10.1.1` | RFC 6902 inverse patch calculation ($\Delta^{-1}$) & immutable state transitions |
| `zod` | `^3.24.1` | WebMCP client-side tool schema validation, RFC 6902 patch schema parsing |
| `lucide-react` | `^0.469.0` | Iconography for HUD, terminals, node types, agent avatars, status badges |
| `clsx` | `^2.1.1` | Conditional className concatenation |
| `tailwind-merge` | `^2.6.0` | Conflict-free Tailwind class resolution |
| `three` | `^0.170.0` | 3D visual canvas rendering engine / particle & spatial effects |
| `@types/three` | `^0.170.0` | TypeScript definitions for Three.js |

### 4.2 Development Dependencies (`devDependencies`)

| Package | Version | Purpose |
|---|---|---|
| `typescript` | `~5.7.2` | Static type checker |
| `vite` | `^6.0.5` | Next-generation frontend tooling and HMR dev server |
| `@vitejs/plugin-react` | `^4.3.4` | Fast Refresh and JSX transformation |
| `jest` | `^29.7.0` | Unit test execution runner |
| `ts-jest` | `^29.2.5` | TypeScript preprocessor for Jest |
| `jest-environment-jsdom` | `^29.7.0` | Browser DOM simulation for Jest tests |
| `@types/jest` | `^29.5.14` | Type definitions for Jest |
| `@types/node` | `^22.10.2` | Type definitions for Node runtime APIs |
| `@types/react` | `^19.0.2` | Type definitions for React 19 |
| `@types/react-dom` | `^19.0.2` | Type definitions for ReactDOM 19 |
| `tailwindcss` | `^3.4.17` | Utility-first CSS framework |
| `postcss` | `^8.4.49` | CSS transformation pipeline |
| `autoprefixer` | `^10.4.20` | Vendor prefix automation |
| `ts-node` | `^10.9.2` | TypeScript execution in Node |

---

## 5. TypeScript Configuration Analysis (`tsconfig.json`)

The TypeScript compiler configuration enforces ultra-strict type-checking:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"]
}
```

### Critical Type-Checking Directives:
1. **`noUncheckedIndexedAccess: true`**: Array and dictionary lookups return `T | undefined`. All array indexing or map access must guard for `undefined` (e.g. `const item = arr[0]; if (!item) ...`).
2. **`noUnusedLocals` & `noUnusedParameters`**: Dead variables or unused function parameters will cause compilation failure.
3. **`moduleResolution: "bundler"`**: Resolves packages cleanly with Vite and ESM standards.

---

## 6. Tailwind CSS & UI Design System (`tailwind.config.js`)

Tailwind is configured with custom color tokens and animations tailored specifically for CloudSwarm Studio:

### 6.1 Agent Color Tokens
- **`agent.alpha`**: `#00F0FF` (Electric Cyan — Topology & Network Specialist)
- **`agent.beta`**: `#FF007F` (Neon Magenta — SecOps & Zero-Trust IAM Specialist)
- **`agent.gamma`**: `#39FF14` (Cyber Lime — FinOps & Cost Estimation Specialist)
- **`agent.human`**: `#FFE600` (Radiant Gold — Human Director)

### 6.2 Cyberpunk Dark Theme Palette
- **`cyber.900`**: `#070B14` (Main background)
- **`cyber.800`**: `#0D1424` (Surface panels & cards)
- **`cyber.700`**: `#142036` (Hover surfaces & active cards)
- **`cyber.600`**: `#1F2E4D` (Dividers & elevated borders)
- **`cyber.border`**: `rgba(255, 255, 255, 0.08)` (Subtle glassmorphic border)

### 6.3 Custom Keyframes & Animations
- **`pulse-glow`**: 2s cyclic opacity and drop-shadow pulsation (`drop-shadow(0 0 8px currentColor)`).
- **`dash`**: 1.5s linear SVG stroke-dashoffset animation for live sync data cables and active locking indicators.

### 6.4 Typography (`index.html`)
- Code / Monospace: **JetBrains Mono**
- UI / Sans: **Plus Jakarta Sans**

---

## 7. Build, Dev, and Test Commands

### 7.1 Defined Scripts in `package.json`
- `npm run dev`: Starts Vite dev server at `http://localhost:3000` (configured with `open: true`).
- `npm run build`: Executes `tsc -b && vite build` (Strict type check + production bundle).
- `npm test`: Runs `jest` with `ts-jest` preprocessor.

### 7.2 Jest Configuration (`jest.config.ts`)
```ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/src/tests/**/*.test.ts'],
};
```
- **Test Pattern**: `src/tests/**/*.test.ts` (All unit tests must be located under `src/tests/` matching `.test.ts`).
- **Environment**: `'node'` (Ideal for fast headless unit testing of concurrency locks, CAS rollback engines, WebMCP schemas, and FinOps/SecOps logic).

---

## 8. Recommended Project Layout (`src/`)

To support clean separation of concerns across requirements R1–R6:

```
src/
├── main.tsx                         # Entry point rendering App
├── App.tsx                          # Top-level application container & HUD layout
├── index.css                        # Tailwind directives (@tailwind base/components/utilities) & custom scrollbars
├── types/                           # Core TypeScript interfaces & WebMCP schemas
│   ├── webmcp.ts                    # document.modelContext types, tool signatures, JSON schema defs
│   ├── swarm.ts                     # Agent personas (Alpha, Beta, Gamma, Human), states, locks
│   ├── topology.ts                  # Cloud resource nodes (VPC, Subnet, EC2, RDS, IAM, etc.), edges, ports
│   ├── patch.ts                     # RFC 6902 CAS operations & Immer inverse patch Delta^-1
│   └── audit.ts                     # Cost breakdown $/mo & OWASP security rules
├── core/                            # Core engines (R1, R2, R5)
│   ├── lock-manager.ts              # StripedLockManager with lexicographical sorting (Deadlock-Free)
│   ├── optimistic-state.ts          # OptimisticStateEngine (CAS validation, applyPatch, rollback)
│   ├── webmcp-client.ts             # WebMCP client, tool registry & browser polyfill fallback
│   ├── time-travel-dag.ts           # Reversible DAG timeline, branch forking, 60 FPS scrub engine
│   └── hcl-sync-engine.ts           # Bi-directional Terraform/OpenTofu HCL parser & serializer
├── personas/                        # Agent intelligence & deterministic swarm simulation (R3, R6)
│   ├── agent-alpha.ts               # Topology Specialist (VPC, subnets, gateways, route tables)
│   ├── agent-beta.ts                # SecOps Specialist (IAM, KMS, WAF, Security Groups, OWASP)
│   ├── agent-gamma.ts               # FinOps Specialist (AWS pricing formulas, rightsizing, budgets)
│   └── swarm-orchestrator.ts        # Concurrent swarm coordinator (<100ms deterministic simulation)
├── components/                      # React UI Components (R3, R4, R5, R6)
│   ├── canvas/                      # 60 FPS Canvas (Three.js / SVG hybrid, cursors, halos, thought bubbles)
│   │   ├── InteractiveCanvas.tsx
│   │   ├── AgentCursorPresence.tsx
│   │   └── BoundingBoxHalo.tsx
│   ├── hud/                         # Top bar, Swarm status, metrics, 1-Click Demo launcher
│   │   ├── SwarmHUD.tsx
│   │   └── AgentBadge.tsx
│   ├── terminal/                    # Tri-Terminal Execution Drawer (R4)
│   │   ├── TriTerminalDrawer.tsx
│   │   ├── AgentTerminalChannel.tsx
│   │   └── JsonDiffInspector.tsx
│   ├── auditor/                     # Sentinel Auditor (R4: $/mo FinOps & OWASP compliance)
│   │   ├── SentinelAuditorPanel.tsx
│   │   └── SecurityViolationBadge.tsx
│   ├── timeline/                    # Time-Travel DAG scrubber & branch comparison (R5)
│   │   ├── DagScrubber.tsx
│   │   └── BranchComparator.tsx
│   ├── editor/                      # Bi-directional HCL Editor (R5)
│   │   └── HclLiveEditor.tsx
│   └── materializer/                # 1-Click Production Materializer & Export Modal (R6)
│       ├── ProductionMaterializerModal.tsx
│       └── ExportBundleGenerator.ts
├── store/                           # Zustand Store
│   └── useSwarmStore.ts             # Unified reactive store
└── tests/                           # Unit test suite for 100% Jest pass (Acceptance Criteria)
    ├── lock-manager.test.ts         # Striped lock concurrency & deadlock avoidance tests
    ├── optimistic-state.test.ts     # CAS patch & Immer Delta^-1 microsecond rollback tests
    ├── webmcp-tools.test.ts         # WebMCP schema validation & tool execution tests
    ├── hcl-sync.test.ts             # Bi-directional node <-> HCL sync tests
    ├── finops-secops.test.ts        # FinOps pricing calculations & OWASP rule audit tests
    └── time-travel-dag.test.ts      # DAG branching and time-travel state recovery tests
```

---

## 9. Downstream Worker Recommendations & Guidelines

1. **Strict Null Checks**: When writing helper functions, always handle `undefined` from arrays or maps because `"noUncheckedIndexedAccess": true` is active.
2. **Tailwind Usage**: Use `agent-alpha`, `agent-beta`, `agent-gamma`, `agent-human`, `cyber-900`, `cyber-800`, `cyber-700`, `cyber-border`, `animate-pulse-glow`, and `animate-dash` directly in component JSX.
3. **Jest Location**: All unit tests must be authored inside `src/tests/` with `.test.ts` extensions so that `npm test` matches and executes them.
4. **Deterministic Zero-Key Simulation**: For offline evaluation, agent executors must execute against the mock WebMCP tool registry in `<100ms` without external network dependencies.
5. **No API Key Storage**: Use browser memory or simulated deterministic engine; never hardcode credentials.

---
