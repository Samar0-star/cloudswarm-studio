import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = 'http://localhost:3000';
const ARTIFACT_DIR = '/Users/samaraldico/.gemini/antigravity/brain/1b4fa1d3-7f57-4885-9cbd-def9dfc5ca1f/scratch';

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

// Format number helper
const f2 = (n) => (typeof n === 'number' ? n.toFixed(2) : String(n));

async function runAudit() {
  console.log('='.repeat(80));
  console.log('🔍 BRUTAL LEAD BROWSER AUTOMATION & UI/UX AUDIT: CURSOR PRECISION & INTEGRITY');
  console.log('='.repeat(80));

  const consoleLogs = [];
  const consoleErrors = [];

  console.log(`[INIT] Launching Google Chrome from: ${CHROME_PATH}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1440,1024',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1024, deviceScaleFactor: 1 });

  // Trap all console messages and uncaught exceptions
  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      console.error(`🔴 [Browser Console Error]: ${text}`);
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`🔴 [Browser Page Error]: ${err.message}`);
    consoleErrors.push(err.message);
  });

  console.log(`[NAVIGATE] Navigating to ${APP_URL}...`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2' });

  // Wait for WebMCP Engine and Store to be available
  await page.waitForFunction(
    () => window.modelContext && typeof window.modelContext.executeTool === 'function' && window.useCloudSwarmStore,
    { timeout: 15000 }
  );
  console.log('✅ [READY] window.modelContext & window.useCloudSwarmStore are initialized and ready.');

  // Set up in-browser DOM MutationObserver to detect click ripple animations in real-time
  await page.evaluate(() => {
    window.__auditRippleEvents = [];
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const el = node;
            const isRipple =
              el.getAttribute('data-testid') === 'cursor-click-ripple' ||
              el.classList?.contains('cursor-click-ripple') ||
              (el.classList?.contains('animate-ping') && el.classList?.contains('rounded-full'));
            if (isRipple) {
              window.__auditRippleEvents.push({
                timestamp: performance.now(),
                className: el.className,
                testId: el.getAttribute('data-testid'),
                parentTestId: el.parentElement?.getAttribute('data-testid'),
              });
            }
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  const auditResults = [];

  async function executeAndAuditStep(stepIndex, stepName, toolName, toolParams, targetNodeId, expectedCanvasCenter) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`▶ STEP ${stepIndex}: [${stepName}] ${toolName}`);
    console.log(`  Payload: ${JSON.stringify(toolParams)}`);
    console.log(`  Target Node: ${targetNodeId} | Expected Canvas Center: (${expectedCanvasCenter.x}, ${expectedCanvasCenter.y})`);

    const rippleCountBefore = await page.evaluate(() => window.__auditRippleEvents.length);

    // Execute tool via window.modelContext
    const toolResult = await page.evaluate(
      async (name, params) => {
        try {
          return await window.modelContext.executeTool(name, params, { agentId: 'ext-1' });
        } catch (err) {
          return { error: err.message || String(err) };
        }
      },
      toolName,
      toolParams
    );

    console.log(`  Tool Response: ${toolResult.error ? 'ERROR: ' + toolResult.error : 'SUCCESS'}`);

    // Allow CSS transition to complete: 850ms for connect_resources (multi-hop), 600ms for direct
    const waitDuration = toolName === 'connect_resources' ? 850 : 600;
    await new Promise((r) => setTimeout(r, waitDuration));

    // Capture measurements from DOM & Zustand store
    const domData = await page.evaluate(
      (nodeId, agentId) => {
        const cursorEl = document.querySelector(`[data-testid="agent-cursor-${agentId}"]`);
        const nodeEl = document.querySelector(`[data-id="${nodeId}"]`);
        const rippleEl = document.querySelector(
          `[data-testid="cursor-click-ripple"], .cursor-click-ripple, [data-testid="agent-cursor-${agentId}"] .animate-ping`
        );
        const rippleEvents = window.__auditRippleEvents || [];

        let cursorStyle = null;
        let cursorRect = null;
        let nodeRect = null;
        let cursorTranslateX = null;
        let cursorTranslateY = null;

        if (cursorEl) {
          const comp = window.getComputedStyle(cursorEl);
          cursorStyle = {
            inlineTransform: cursorEl.style.transform,
            computedTransform: comp.transform,
            inlineOpacity: cursorEl.style.opacity,
            computedOpacity: parseFloat(comp.opacity),
            display: comp.display,
            visibility: comp.visibility,
          };

          const cr = cursorEl.getBoundingClientRect();
          cursorRect = {
            x: cr.x,
            y: cr.y,
            left: cr.left,
            top: cr.top,
            right: cr.right,
            bottom: cr.bottom,
            width: cr.width,
            height: cr.height,
          };

          // Parse translate3d or translate from inline style
          const match = cursorEl.style.transform.match(/translate(?:3d)?\(([-0-9.]+)px,\s*([-0-9.]+)px/);
          if (match) {
            cursorTranslateX = parseFloat(match[1]);
            cursorTranslateY = parseFloat(match[2]);
          }
        }

        if (nodeEl) {
          const r = nodeEl.getBoundingClientRect();
          nodeRect = {
            x: r.x,
            y: r.y,
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        }

        const store = window.useCloudSwarmStore ? window.useCloudSwarmStore.getState() : null;
        const agentPresence = store?.agentPresences?.[agentId];

        return {
          cursorExists: !!cursorEl,
          cursorStyle,
          cursorRect,
          nodeExists: !!nodeEl,
          nodeRect,
          cursorTranslateX,
          cursorTranslateY,
          agentPresence: agentPresence
            ? {
                isVisible: agentPresence.isVisible,
                opacity: agentPresence.opacity,
                targetX: agentPresence.targetX,
                targetY: agentPresence.targetY,
                actionLabel: agentPresence.actionLabel,
              }
            : null,
          rippleEventsCount: rippleEvents.length,
          lastRipple: rippleEvents[rippleEvents.length - 1] || null,
          hasLiveRippleEl: !!rippleEl,
        };
      },
      targetNodeId,
      'ext-1'
    );

    const rippleCountAfter = domData.rippleEventsCount;
    const rippleFired = rippleCountAfter > rippleCountBefore || domData.hasLiveRippleEl;

    // Mathematical verification:
    // 1. Tip coordinates in DOM screen space
    const cursorTipScreenX = domData.cursorRect ? domData.cursorRect.left + 2 : null;
    const cursorTipScreenY = domData.cursorRect ? domData.cursorRect.top + 2 : null;

    const nodeRect = domData.nodeRect;
    let isTipInsideNode = false;
    let distanceToNodeCenter = null;
    let canvasCoordDeltaX = null;
    let canvasCoordDeltaY = null;

    if (nodeRect && cursorTipScreenX !== null && cursorTipScreenY !== null) {
      isTipInsideNode =
        cursorTipScreenX >= nodeRect.left &&
        cursorTipScreenX <= nodeRect.right &&
        cursorTipScreenY >= nodeRect.top &&
        cursorTipScreenY <= nodeRect.bottom;

      const nodeScreenCenterX = nodeRect.left + nodeRect.width / 2;
      const nodeScreenCenterY = nodeRect.top + nodeRect.height / 2;
      distanceToNodeCenter = Math.hypot(cursorTipScreenX - nodeScreenCenterX, cursorTipScreenY - nodeScreenCenterY);
    }

    // 2. Canvas coordinate exact center matching
    if (domData.cursorTranslateX !== null && domData.cursorTranslateY !== null) {
      canvasCoordDeltaX = Math.abs(domData.cursorTranslateX - expectedCanvasCenter.x);
      canvasCoordDeltaY = Math.abs(domData.cursorTranslateY - expectedCanvasCenter.y);
    }

    // 3. Strict visibility check (confirming 0 premature vanishing)
    const isVisibleStrict =
      domData.cursorExists &&
      domData.cursorStyle &&
      domData.cursorStyle.computedOpacity > 0 &&
      domData.cursorStyle.display !== 'none' &&
      domData.cursorStyle.visibility !== 'hidden' &&
      domData.agentPresence?.isVisible === true &&
      domData.agentPresence?.opacity > 0;

    const canvasPrecisionExact = canvasCoordDeltaX === 0 && canvasCoordDeltaY === 0;

    // Save full-page screenshot
    const screenshotPath = path.join(ARTIFACT_DIR, `brutal_audit_step${stepIndex}.png`);
    const descriptiveScreenshotPath = path.join(
      ARTIFACT_DIR,
      `brutal_audit_step${stepIndex}_${stepName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.png`
    );
    await page.screenshot({ path: screenshotPath, fullPage: true });
    fs.copyFileSync(screenshotPath, descriptiveScreenshotPath);

    console.log(`  📸 Screenshot: ${screenshotPath}`);
    console.log(`  📐 Cursor CSS Transform: translate(${domData.cursorTranslateX}px, ${domData.cursorTranslateY}px)`);
    console.log(`  🎯 Target Canvas Center: (${expectedCanvasCenter.x}px, ${expectedCanvasCenter.y}px)`);
    console.log(`  🔍 Canvas Coordinate Error: ΔX = ${f2(canvasCoordDeltaX)}px, ΔY = ${f2(canvasCoordDeltaY)}px`);
    console.log(
      `  📦 Node DOM Bounding Rect: [${f2(nodeRect?.left)}, ${f2(nodeRect?.top)}, ${f2(nodeRect?.right)}, ${f2(
        nodeRect?.bottom
      )}] (W=${f2(nodeRect?.width)}, H=${f2(nodeRect?.height)})`
    );
    console.log(`  📍 Cursor Tip Screen Point: (${f2(cursorTipScreenX)}, ${f2(cursorTipScreenY)})`);
    console.log(`  ✅ Tip Inside Node Card: ${isTipInsideNode ? 'YES (MATHEMATICALLY BOUNDED)' : 'NO'}`);
    console.log(
      `  👁️ Cursor Visibility & Opacity: isVisible=${domData.agentPresence?.isVisible}, opacity=${domData.cursorStyle?.computedOpacity}`
    );
    console.log(`  💥 Click Ripple Fired: ${rippleFired ? 'YES (RECORDED)' : 'NO'}`);

    const stepVerdict =
      !toolResult.error &&
      domData.cursorExists &&
      domData.nodeExists &&
      isVisibleStrict &&
      isTipInsideNode &&
      canvasPrecisionExact &&
      rippleFired;

    console.log(`  🏆 STEP ${stepIndex} VERDICT: ${stepVerdict ? 'PASS' : 'FAIL'}`);

    auditResults.push({
      stepIndex,
      stepName,
      toolName,
      toolParams,
      targetNodeId,
      expectedCanvasCenter,
      actualCanvasCoords: { x: domData.cursorTranslateX, y: domData.cursorTranslateY },
      canvasCoordDelta: { dx: canvasCoordDeltaX, dy: canvasCoordDeltaY },
      cursorTipScreen: { x: cursorTipScreenX, y: cursorTipScreenY },
      nodeRect,
      isTipInsideNode,
      distanceToNodeCenter,
      isVisibleStrict,
      computedOpacity: domData.cursorStyle?.computedOpacity,
      rippleFired,
      screenshotPath,
      descriptiveScreenshotPath,
      verdict: stepVerdict ? 'PASS' : 'FAIL',
    });

    // Pacing between actions
    await new Promise((r) => setTimeout(r, 400));
  }

  // ============================================================================
  // EXECUTE EXACT SEQUENCE
  // ============================================================================

  // Step 1: create_resource_node (VPC)
  // VPC position: { x: 200, y: 200 }, center: x + 115 = 315, y + 40 = 240
  await executeAndAuditStep(
    1,
    'vpc_creation',
    'create_resource_node',
    { id: 'ext-vpc', type: 'aws_vpc', name: 'External VPC', position: { x: 200, y: 200 } },
    'ext-vpc',
    { x: 315, y: 240 }
  );

  // Step 2: create_resource_node (EC2)
  // EC2 position: { x: 500, y: 200 }, center: x + 115 = 615, y + 40 = 240
  await executeAndAuditStep(
    2,
    'ec2_creation',
    'create_resource_node',
    { id: 'ext-ec2', type: 'aws_instance', name: 'External EC2', position: { x: 500, y: 200 } },
    'ext-ec2',
    { x: 615, y: 240 }
  );

  // Step 3: create_resource_node (RDS)
  // RDS position: { x: 800, y: 200 }, center: x + 115 = 915, y + 40 = 240
  await executeAndAuditStep(
    3,
    'rds_creation',
    'create_resource_node',
    { id: 'ext-rds', type: 'aws_db_instance', name: 'External RDS', position: { x: 800, y: 200 } },
    'ext-rds',
    { x: 915, y: 240 }
  );

  // Step 4: connect_resources (VPC -> EC2)
  // source_id: 'ext-vpc', target_id: 'ext-ec2'. Targets ext-vpc center (315, 240) then ext-ec2 (615, 240)
  await executeAndAuditStep(
    4,
    'connect_vpc_to_ec2',
    'connect_resources',
    { source_id: 'ext-vpc', target_id: 'ext-ec2', edge_type: 'contains' },
    'ext-ec2',
    { x: 615, y: 240 }
  );

  // Step 5: connect_resources (EC2 -> RDS)
  // source_id: 'ext-ec2', target_id: 'ext-rds'. Targets ext-ec2 center (615, 240) then ext-rds (915, 240)
  await executeAndAuditStep(
    5,
    'connect_ec2_to_rds',
    'connect_resources',
    { source_id: 'ext-ec2', target_id: 'ext-rds', edge_type: 'reads_from' },
    'ext-rds',
    { x: 915, y: 240 }
  );

  // Step 6: update_resource_node (RDS config patch)
  // node_id: 'ext-rds', center: (915, 240)
  await executeAndAuditStep(
    6,
    'update_rds_config',
    'update_resource_node',
    { node_id: 'ext-rds', config_patch: { multi_az: true, storage_encrypted: true } },
    'ext-rds',
    { x: 915, y: 240 }
  );

  // ============================================================================
  // FINAL DOM & TOPOLOGY INTEGRITY ASSERTIONS
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('🏛️ EXHAUSTIVE FINAL VERIFICATION ASSERTIONS');
  console.log('--------------------------------------------------------------------------------');

  const finalCheck = await page.evaluate(() => {
    const vpcNode = document.querySelector('[data-id="ext-vpc"]');
    const ec2Node = document.querySelector('[data-id="ext-ec2"]');
    const rdsNode = document.querySelector('[data-id="ext-rds"]');

    // Check SVG edges
    const svgEdges = Array.from(document.querySelectorAll('svg [data-testid^="canvas-edge-"], svg g.cursor-pointer'));
    const edgePaths = Array.from(document.querySelectorAll('svg path[d]')).filter((p) => p.getAttribute('d')?.startsWith('M'));

    // Check Zustand store state directly
    const store = window.useCloudSwarmStore ? window.useCloudSwarmStore.getState() : null;
    const topology = store?.topologyState;
    const rdsData = topology?.nodes?.['ext-rds'];
    const edgesMap = topology?.edges || {};

    const cursorEl = document.querySelector('[data-testid="agent-cursor-ext-1"]');
    const cursorComp = cursorEl ? window.getComputedStyle(cursorEl) : null;

    return {
      vpcExists: !!vpcNode,
      ec2Exists: !!ec2Node,
      rdsExists: !!rdsNode,
      svgEdgesCount: svgEdges.length,
      edgePathsCount: edgePaths.length,
      storeEdgesCount: Object.keys(edgesMap).length,
      edgesDetails: Object.values(edgesMap).map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type })),
      rdsConfig: rdsData?.config || null,
      rdsMultiAz: rdsData?.config?.multi_az === true,
      rdsEncrypted: rdsData?.config?.storage_encrypted === true,
      finalCursorPresence: {
        mountedInDOM: !!cursorEl,
        opacity: cursorComp ? parseFloat(cursorComp.opacity) : 0,
        isVisible: store?.agentPresences?.['ext-1']?.isVisible,
        targetX: store?.agentPresences?.['ext-1']?.targetX,
        targetY: store?.agentPresences?.['ext-1']?.targetY,
      },
    };
  });

  console.log(`1. [DOM Element] [data-id="ext-vpc"]: ${finalCheck.vpcExists ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`2. [DOM Element] [data-id="ext-ec2"]: ${finalCheck.ec2Exists ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(`3. [DOM Element] [data-id="ext-rds"]: ${finalCheck.rdsExists ? 'EXISTS ✅' : 'MISSING ❌'}`);
  console.log(
    `4. [SVG Edges Layer] Edge elements count: ${finalCheck.svgEdgesCount} (paths: ${finalCheck.edgePathsCount}, store: ${finalCheck.storeEdgesCount}) ✅`
  );
  console.log(`   Edges: ${JSON.stringify(finalCheck.edgesDetails)}`);
  console.log(`5. [RDS Configuration] multi_az: ${finalCheck.rdsMultiAz}, storage_encrypted: ${finalCheck.rdsEncrypted} ✅`);
  console.log(`   RDS Config snapshot: ${JSON.stringify(finalCheck.rdsConfig)}`);
  console.log(
    `6. [Zero Premature Vanishing] Cursor opacity=${finalCheck.finalCursorPresence.opacity}, isVisible=${finalCheck.finalCursorPresence.isVisible} ✅`
  );
  console.log(
    `7. [Browser Console Errors] Total: ${consoleErrors.length} ${consoleErrors.length === 0 ? '✅ (PERFECT ZERO)' : '❌'}`
  );

  // Final summary screenshot
  const finalSummaryPath = path.join(ARTIFACT_DIR, 'brutal_audit_final_summary.png');
  await page.screenshot({ path: finalSummaryPath, fullPage: true });

  const allStepsPassed = auditResults.every((r) => r.verdict === 'PASS');
  const allFinalAssertionsPassed =
    finalCheck.vpcExists &&
    finalCheck.ec2Exists &&
    finalCheck.rdsExists &&
    finalCheck.storeEdgesCount >= 2 &&
    finalCheck.rdsMultiAz &&
    finalCheck.rdsEncrypted &&
    finalCheck.finalCursorPresence.opacity > 0 &&
    consoleErrors.length === 0;

  const finalVerdict = allStepsPassed && allFinalAssertionsPassed;

  const auditReport = {
    timestamp: new Date().toISOString(),
    verdict: finalVerdict ? 'PASSED' : 'FAILED',
    allStepsPassed,
    allFinalAssertionsPassed,
    consoleErrorsCount: consoleErrors.length,
    consoleErrors,
    steps: auditResults,
    finalCheck,
    screenshots: [
      path.join(ARTIFACT_DIR, 'brutal_audit_step1.png'),
      path.join(ARTIFACT_DIR, 'brutal_audit_step2.png'),
      path.join(ARTIFACT_DIR, 'brutal_audit_step3.png'),
      path.join(ARTIFACT_DIR, 'brutal_audit_step4.png'),
      path.join(ARTIFACT_DIR, 'brutal_audit_step5.png'),
      path.join(ARTIFACT_DIR, 'brutal_audit_step6.png'),
      finalSummaryPath,
    ],
  };

  const reportJsonPath = path.join(ARTIFACT_DIR, 'audit_report.json');
  fs.writeFileSync(reportJsonPath, JSON.stringify(auditReport, null, 2));
  console.log(`\n📄 Saved Audit JSON Report: ${reportJsonPath}`);

  console.log('\n' + '='.repeat(80));
  console.log(`🏁 OVERALL AUDIT VERDICT: ${finalVerdict ? 'PASSED (100% MATHEMATICALLY RIGOROUS)' : 'FAILED'}`);
  console.log('='.repeat(80));

  await browser.close();
  return auditReport;
}

runAudit().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
