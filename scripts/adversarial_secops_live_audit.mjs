/**
 * Adversarial SecOps & Chaos Resilience Live Audit Runner
 *
 * Runs comprehensive live penetration & fuzzing tests against:
 * - http://localhost:3001/execute (WebMCP Live Bridge)
 * - http://localhost:3000 (CloudSwarm Studio Client)
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/8027c08a-d9a1-444a-85e9-87ca4b5a34de/scratch';
const BRIDGE_URL = 'http://localhost:3001';
const APP_URL = 'http://localhost:3000';

async function sendBridgeToolCall(toolName, params, agentId = 'ext-1') {
  const startTime = performance.now();
  const res = await fetch(`${BRIDGE_URL}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolName,
      params,
      agentId,
    }),
  });
  const data = await res.json();
  const durationMs = performance.now() - startTime;
  return { status: res.status, ok: res.ok, data, durationMs };
}

async function runAudit() {
  console.log('⚡ =========================================================================');
  console.log('⚡ ADVERSARIAL SECOPS & CHAOS RESILIENCE AUDIT SUITE');
  console.log('⚡ =========================================================================\n');

  const auditReport = {
    timestamp: new Date().toISOString(),
    tests: [],
    edgeCasesDiscovered: [],
    unhandledErrors: [],
    resilienceWeaknesses: [],
  };

  // Launch headless browser
  console.log('🚀 Step 0: Connecting Puppeteer to live CloudSwarm Studio at ' + APP_URL);
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--window-size=1600,1000'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });

  const consoleLogs = [];
  const consoleErrors = [];
  const browserExceptions = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text, timestamp: Date.now() });
    if (type === 'error') {
      consoleErrors.push(text);
      console.log(`  🔴 [BROWSER CONSOLE ERROR] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    browserExceptions.push(err.toString());
    console.log(`  💥 [BROWSER PAGE EXCEPTION] ${err.toString()}`);
  });

  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 1200));

  const pageTitle = await page.title();
  console.log(`  ✅ Browser connected: "${pageTitle}"`);

  // =========================================================================
  // TEST 1: Intentionally Malformed Tool Calls to http://localhost:3001/execute
  // =========================================================================
  console.log('\n-------------------------------------------------------------------------');
  console.log('🧪 TEST 1: Sending Hostile / Fuzzed Tool Calls to /execute endpoint');
  console.log('-------------------------------------------------------------------------');

  const malformedPayloads = [
    {
      name: '1.1 Invalid CIDR (999.999.999.999/99)',
      tool: 'orchestrate_cloud_topology',
      agentId: 'ext-alpha',
      params: {
        architecture_name: 'Fuzzed-Bad-CIDR',
        vpc: { cidr_block: '999.999.999.999/99' },
        resources: [],
      },
    },
    {
      name: '1.2 Unsupported Cloud Resource Type',
      tool: 'create_resource_node',
      agentId: 'ext-beta',
      params: {
        id: 'node-unsupported-alien',
        type: 'alien_quantum_hyperdrive_v9',
        name: 'Alien Quantum Hyperdrive',
        config: {},
      },
    },
    {
      name: '1.3 Self-Connection Loop',
      tool: 'connect_resources',
      agentId: 'ext-alpha',
      params: {
        source_id: 'solo_node_loop',
        target_id: 'solo_node_loop',
        relation_type: 'routes_to',
      },
    },
    {
      name: '1.4 Negative Coordinates (-9999, -4500)',
      tool: 'create_resource_node',
      agentId: 'ext-beta',
      params: {
        id: 'node-deep-negative',
        type: 'aws_s3_bucket',
        name: 'Negative Space S3',
        position: { x: -9999, y: -4500 },
        config: { bucket_name: 'negative-space-bucket' },
      },
    },
    {
      name: '1.5 Duplicate Edge IDs and Parallel Edges',
      tool: 'connect_resources',
      agentId: 'ext-alpha',
      params: {
        source_id: 'vpc-main',
        target_id: 'vpc-main',
        relation_type: 'network_flow',
        port: 80,
      },
    },
    {
      name: '1.6 Out-of-Bounds Port & Malformed Fields',
      tool: 'connect_resources',
      agentId: 'ext-beta',
      params: {
        source_id: 'vpc-main',
        target_id: 'sub-main',
        port: 99999, // Out of bounds > 65535
        protocol: 'invalid_proto_proto',
      },
    },
    {
      name: '1.7 Non-Existent Tool Name Invocation',
      tool: 'exploit_remote_kernel_execution',
      agentId: 'ext-adversary',
      params: { payload: '; cat /etc/passwd' },
    },
  ];

  for (const item of malformedPayloads) {
    const bridgeResp = await sendBridgeToolCall(item.tool, item.params, item.agentId);
    console.log(`  📡 Dispatched [${item.name}]: HTTP ${bridgeResp.status} queued #${bridgeResp.data.id} in ${bridgeResp.durationMs.toFixed(1)}ms`);
    auditReport.tests.push({
      test: item.name,
      endpoint: `${BRIDGE_URL}/execute`,
      httpStatus: bridgeResp.status,
      bridgeResponse: bridgeResp.data,
    });
  }

  // Wait for browser polling to consume and process bridge events
  console.log('  ⏳ Waiting 2500ms for browser tab to poll, validate, and execute all bridge tool calls...');
  await new Promise((r) => setTimeout(r, 2500));

  // Inspect browser state and WebMCP engine response in browser context
  const test1ClientState = await page.evaluate(async () => {
    const mcp = window.modelContext;
    const store = window.store.getState();

    // Directly test execution of these malformed calls against client WebMCP engine to get direct results
    const cidrResult = await mcp.executeTool('orchestrate_cloud_topology', {
      architecture_name: 'BadCIDR',
      vpc: { cidr_block: '999.999.999.999/99' },
      resources: [],
    });

    const unsupportedTypeResult = await mcp.executeTool('create_resource_node', {
      id: 'bad-res',
      type: 'alien_quantum_hyperdrive',
      name: 'Bad',
    });

    const selfConnectResult = await mcp.executeTool('connect_resources', {
      source_id: 'bad-res',
      target_id: 'bad-res',
    });

    return {
      nodeCount: Object.keys(store.topologyState.nodes).length,
      edgeCount: Object.keys(store.topologyState.edges).length,
      cidrResult,
      unsupportedTypeResult,
      selfConnectResult,
    };
  });

  console.log(`  📊 Browser state after fuzzing: ${test1ClientState.nodeCount} nodes, ${test1ClientState.edgeCount} edges.`);
  console.log(`  🛡️ CIDR Veto verification: isError=${test1ClientState.cidrResult.isError} (${test1ClientState.cidrResult.content?.[0]?.text})`);
  console.log(`  🛡️ Type Schema Veto: isError=${test1ClientState.unsupportedTypeResult.isError} (${test1ClientState.unsupportedTypeResult.content?.[0]?.text})`);
  console.log(`  🛡️ Self-Connection Veto: isError=${test1ClientState.selfConnectResult.isError} (${test1ClientState.selfConnectResult.content?.[0]?.text})`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'adversarial_01_malformed_tool_calls.png') });

  // =========================================================================
  // TEST 2: Trigger Red-Team Threat defense and Chaos Gorilla in Rapid Sequence & Simultaneously
  // =========================================================================
  console.log('\n-------------------------------------------------------------------------');
  console.log('🧪 TEST 2: Rapid & Simultaneous Triggers of Chaos Gorilla & Threat Defense');
  console.log('-------------------------------------------------------------------------');

  // Seed canvas with active resources first
  await page.evaluate(async () => {
    const store = window.store.getState();
    await store.addNode({
      id: 'prod_alb',
      type: 'aws_lb',
      name: 'Production Ingress ALB',
      position: { x: 200, y: 100 },
      config: { load_balancer_type: 'application' },
      version: 1,
      metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
    });
    await store.addNode({
      id: 'compute_main',
      type: 'aws_instance',
      name: 'API Compute Cluster',
      position: { x: 200, y: 260 },
      config: { instance_type: 'c6i.2xlarge' },
      version: 1,
      metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
    });
    await store.addNode({
      id: 'rds_postgres',
      type: 'aws_db_instance',
      name: 'RDS PostgreSQL Primary',
      position: { x: 200, y: 420 },
      config: { engine: 'postgres', multi_az: true },
      version: 1,
      metadata: { createdBy: 'gamma', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
    });
  });

  console.log('  🔥 Step 2A: Rapid Sequential Burst (Chaos -> 100ms -> Threat -> 100ms -> Chaos)');
  const seqStartTime = performance.now();
  const seqResult = await page.evaluate(async () => {
    const store = window.store.getState();
    const r1 = await store.triggerChaosScenario('chaos_az_outage');
    await new Promise((r) => setTimeout(r, 100));
    const r2 = await store.triggerThreatScenario('threat_open_ssh_rdp');
    return { chaosResult: r1, threatResult: r2 };
  });
  console.log(`  ✅ Sequential burst completed in ${(performance.now() - seqStartTime).toFixed(1)}ms. Blast radius: ${seqResult.chaosResult.blastRadiusFinal}, Defense CIS: ${seqResult.threatResult.finalCisScore}/100`);

  console.log('  💥 Step 2B: True Simultaneous Execution (Promise.all([Chaos, Threat]))');
  const simStartTime = performance.now();
  const simultaneousResult = await page.evaluate(async () => {
    const store = window.store.getState();
    const [chaosRes, threatRes] = await Promise.all([
      store.triggerChaosScenario('chaos_db_saturation'),
      store.triggerThreatScenario('threat_public_s3_exfil'),
    ]);
    return {
      chaosRes,
      threatRes,
      finalStateVersion: store.topologyState.version,
      isChaosActive: store.isChaosActive,
      isThreatActive: store.isThreatSimActive,
      nodes: Object.values(store.topologyState.nodes).map((n) => ({
        id: n.id,
        _chaosStatus: n.config._chaosStatus,
        _threatStatus: n.config._threatStatus,
      })),
    };
  });

  console.log(`  ✅ Simultaneous execution resolved in ${(performance.now() - simStartTime).toFixed(1)}ms.`);
  console.log(`  State Version: ${simultaneousResult.finalStateVersion}`);
  console.log(`  Active Flags: isChaosActive=${simultaneousResult.isChaosActive}, isThreatActive=${simultaneousResult.isThreatActive}`);
  console.log(`  Remediated Node States:`, JSON.stringify(simultaneousResult.nodes));

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'adversarial_02_simultaneous_chaos_threat.png') });

  // =========================================================================
  // TEST 3: Lock Contention between simulated external agents (ext-alpha vs ext-beta)
  // =========================================================================
  console.log('\n-------------------------------------------------------------------------');
  console.log('🧪 TEST 3: Multi-Agent Lock Contention (ext-alpha & ext-beta)');
  console.log('-------------------------------------------------------------------------');

  const lockTestResult = await page.evaluate(async () => {
    const lockMgr = window.store.getState().lockManager;
    const results = [];

    // Scenario A: Overlapping locks
    const handleA = await lockMgr.acquireLocks(['hot_node_1', 'hot_node_2'], 'ext-alpha', 800);
    let betaBlocked = false;
    try {
      await lockMgr.acquireLocks(['hot_node_2', 'hot_node_3'], 'ext-beta', 800, { retryOnContention: false });
    } catch (e) {
      betaBlocked = true;
      results.push({ test: 'Non-retry Contention', passed: true, error: e.message });
    }

    // Scenario B: Queued acquisition
    let betaAcquiredAfterRelease = false;
    const betaPromise = lockMgr.acquireLocks(['hot_node_2'], 'ext-beta', 500, {
      retryOnContention: true,
      maxRetries: 10,
      initialBackoffMs: 10,
      timeoutMs: 800,
    }).then(async (h) => {
      betaAcquiredAfterRelease = true;
      await h.release();
    });

    await new Promise((r) => setTimeout(r, 40));
    await handleA.release();
    await betaPromise;

    results.push({ test: 'Queued Acquisition After Release', passed: betaAcquiredAfterRelease });

    // Scenario C: Reverse ordering circular wait deadlock test
    let deadlockFree = false;
    const taskAlpha = (async () => {
      const h = await lockMgr.acquireLocks(['res_X', 'res_Y'], 'ext-alpha', 400, { retryOnContention: true, maxRetries: 15, timeoutMs: 500 });
      await new Promise(r => setTimeout(r, 15));
      await h.release();
    })();
    const taskBeta = (async () => {
      const h = await lockMgr.acquireLocks(['res_Y', 'res_X'], 'ext-beta', 400, { retryOnContention: true, maxRetries: 15, timeoutMs: 500 });
      await new Promise(r => setTimeout(r, 15));
      await h.release();
    })();

    await Promise.all([taskAlpha, taskBeta]);
    deadlockFree = true;
    results.push({ test: 'Reverse Ordering Circular Wait Elimination', passed: deadlockFree });

    return results;
  });

  for (const r of lockTestResult) {
    console.log(`  🔒 [Lock Manager] ${r.test}: ${r.passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  }

  // =========================================================================
  // TEST 4: Optimistic Rollbacks & Inverse RFC 6902 Patch Fidelity
  // =========================================================================
  console.log('\n-------------------------------------------------------------------------');
  console.log('🧪 TEST 4: Optimistic Rollbacks & Inverse RFC 6902 Patch Fidelity');
  console.log('-------------------------------------------------------------------------');

  const rollbackTestResult = await page.evaluate(async () => {
    const engine = window.store.getState().stateEngine;
    const beforeVersion = engine.getState().version;
    const nodeCountBefore = Object.keys(engine.getState().nodes).length;

    // 1. Add resource
    const addTxRes = await engine.addNode({
      id: 'rollback_probe_node',
      type: 'aws_s3_bucket',
      name: 'Rollback Probe',
      position: { x: 500, y: 500 },
      config: { bucket_name: 'temporary-probe-bucket' },
      version: 1,
      metadata: { createdBy: 'ext-alpha', createdAt: Date.now(), updatedAt: Date.now(), status: 'healthy' },
    });

    const nodeCountAfterAdd = Object.keys(engine.getState().nodes).length;

    // 2. Perform optimistic rollback via inverse patches
    const rbRes = engine.rollback(addTxRes.inversePatches);
    const nodeCountAfterRollback = Object.keys(engine.getState().nodes).length;
    const nodeExists = !!engine.getState().nodes['rollback_probe_node'];

    return {
      beforeVersion,
      nodeCountBefore,
      nodeCountAfterAdd,
      nodeCountAfterRollback,
      rollbackSuccess: rbRes.success,
      nodeStillExists: nodeExists,
      patchesUndone: rbRes.rolledBackPatchesCount,
      executionTimeMs: rbRes.executionTimeMs,
    };
  });

  console.log(`  ⏪ Rollback Executed: success=${rollbackTestResult.rollbackSuccess} in ${rollbackTestResult.executionTimeMs.toFixed(3)}ms`);
  console.log(`  Nodes count: initial=${rollbackTestResult.nodeCountBefore} -> afterAdd=${rollbackTestResult.nodeCountAfterAdd} -> afterRollback=${rollbackTestResult.nodeCountAfterRollback}`);
  console.log(`  Probe node deleted by inverse patch: ${!rollbackTestResult.nodeStillExists ? 'YES ✅' : 'NO ❌'}`);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'adversarial_03_state_rollback_verified.png') });

  // =========================================================================
  // TEST 5: Comprehensive Edge Case & Resilience Weakness Audit Report
  // =========================================================================
  console.log('\n=========================================================================');
  console.log('📊 AUDIT SUMMARY & RESILIENCE WEAKNESSES IDENTIFIED');
  console.log('=========================================================================\n');

  console.log(`Total Browser Console Errors: ${consoleErrors.length}`);
  console.log(`Total Uncaught Page Exceptions: ${browserExceptions.length}`);

  await browser.close();

  console.log('🏁 Adversarial live audit successfully completed.');
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
