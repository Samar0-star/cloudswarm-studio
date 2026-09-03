import React, { useEffect, useRef } from 'react';
import { useCloudSwarmStore } from './store/useCloudSwarmStore';
import { TopNavBar } from './components/hud/TopNavBar';
import { TopologyCanvas } from './components/canvas/TopologyCanvas';
import { DagTimelineBar } from './components/editor/DagTimelineBar';
import { TriTerminalDrawer } from './components/hud/TriTerminalDrawer';
import { HclEditorModal } from './components/editor/HclEditorModal';
import { ExportModal } from './components/editor/ExportModal';
import { CostBreakdownModal } from './components/editor/CostBreakdownModal';
import { SecurityStatusModal } from './components/editor/SecurityStatusModal';

export const App: React.FC = () => {
  const {
    isHclEditorOpen,
    setIsHclEditorOpen,
    isExportModalOpen,
    setIsExportModalOpen,
    isDrawerOpen,
    setIsDrawerOpen,
    setActiveHudTab,
    runSwarmDemo,
    isSimulating,
    applyAutoLayoutToCanvas,
    summonAgent,
    selectedNodeId,
  } = useCloudSwarmStore();

  // Global Keyboard Shortcuts
  useEffect(() => {
    (window as any).store = useCloudSwarmStore;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is typing in an input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') {
        return;
      }

      if (e.key === 'Escape') {
        fetch('/api/webmcp/stop').catch(() => {});
        useCloudSwarmStore.getState().stopSwarmDemo();
      } else if (e.code === 'Space' && !isSimulating) {
        e.preventDefault();
        runSwarmDemo();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setIsHclEditorOpen(!isHclEditorOpen);
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setIsDrawerOpen(!isDrawerOpen);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        applyAutoLayoutToCanvas();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const el = document.querySelector('[data-testid="dag-timeline-bar"]');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          el.classList.add('ring-1', 'ring-zinc-400');
          setTimeout(() => el.classList.remove('ring-1', 'ring-zinc-400'), 1500);
        }
      } else if (e.key === '1') {
        if (selectedNodeId) {
          summonAgent('alpha', selectedNodeId);
        } else {
          setActiveHudTab('terminal');
        }
      } else if (e.key === '2') {
        if (selectedNodeId) {
          summonAgent('beta', selectedNodeId);
        } else {
          setActiveHudTab('diff');
        }
      } else if (e.key === '3') {
        if (selectedNodeId) {
          summonAgent('gamma', selectedNodeId);
        } else {
          setActiveHudTab('auditor');
        }
      } else if (e.key === '4') {
        summonAgent('delta', selectedNodeId ?? undefined);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isHclEditorOpen,
    isDrawerOpen,
    isSimulating,
    runSwarmDemo,
    setIsHclEditorOpen,
    setIsDrawerOpen,
    setActiveHudTab,
    applyAutoLayoutToCanvas,
  ]);

  // Real-Time WebMCP Terminal Bridge: Continuous Polling for Terminal Agent executions
  useEffect(() => {
    let isPolling = true;
    let lastSeenId = -1;
    const pollTerminalBridge = async () => {
      let consecutiveErrors = 0;
      while (isPolling) {
        if (consecutiveErrors >= 2) {
          await new Promise((r) => setTimeout(r, 2000));
          if (!isPolling) break;
        }

        try {
          const url = lastSeenId === -1 ? '/api/webmcp/poll?since=latest' : `/api/webmcp/poll?since=${lastSeenId}`;
          const res = await fetch(url).catch(() => null);
          if (res && res.ok) {
            consecutiveErrors = 0;
            const data = await res.json();

            // On initial page load / refresh: sync pointer to latestId and hydrate current state
            if (lastSeenId === -1) {
              lastSeenId = typeof data.latestId === 'number' ? data.latestId : 0;
              try {
                const stateRes = await fetch('/api/webmcp/state').catch(() => null);
                if (stateRes && stateRes.ok) {
                  const savedState = await stateRes.json();
                  if (savedState && savedState.nodes && Object.keys(savedState.nodes).length > 0) {
                    useCloudSwarmStore.getState().loadSavedTopology(savedState);
                  }
                }
              } catch {}
              await new Promise((r) => setTimeout(r, 150));
            }

            if (typeof data.latestId === 'number' && data.latestId < lastSeenId) {
              console.log(`🔄 [WebMCP Bridge] Server restart detected (latestId: ${data.latestId} < lastSeenId: ${lastSeenId}). Resetting pointer.`);
              lastSeenId = 0;
            }

            if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
              const store = useCloudSwarmStore.getState();
              const mcp = store.mcpEngine || (typeof window !== 'undefined' ? (window as any).modelContext : null);

              if (mcp && typeof mcp.executeTool === 'function') {
                for (const act of data.actions) {
                  if (!isPolling) break;
                  if (typeof act._id === 'number' && act._id > lastSeenId) {
                    lastSeenId = act._id;
                  }
                  try {
                    const toolName = act.toolName || act.method || act.tool || act.name;
                    if (!toolName) continue;
                    const params = act.params || act.args || act.parameters || {};
                    const agentId = act.agentId || params.agentId || 'alpha';
                    console.log(`🤖 [WebMCP Bridge] Executing Tool (#${act._id || '?'}): ${toolName} [${agentId}]`, params);
                    await mcp.executeTool(toolName, params, { agentId });
                  } catch (toolErr) {
                    console.error(`[WebMCP Bridge] Execution error:`, toolErr);
                  }
                  const pacingDelay = Math.max(200, Math.min(350, 600 / (data.actions.length || 1)));
                  await new Promise((r) => setTimeout(r, pacingDelay));
                }
              }
            } else if (typeof data.latestId === 'number' && data.latestId > lastSeenId) {
              lastSeenId = data.latestId;
            }
          } else {
            consecutiveErrors++;
            await new Promise((r) => setTimeout(r, 1000));
          }
        } catch {
          consecutiveErrors++;
          await new Promise((r) => setTimeout(r, 1000));
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    };

    pollTerminalBridge();

    return () => {
      isPolling = false;
    };
  }, []);

  // Bi-directional Canvas State Sync: Broadcast active user & agent mutations to bridge
  const topologyState = useCloudSwarmStore((state) => state.topologyState);
  const inspectedNodeId = useCloudSwarmStore((state) => state.inspectedNodeId);
  const isInitialMountRef = useRef(true);

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    fetch('/api/webmcp/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...topologyState,
        selectedNodeId,
        inspectedNodeId,
      }),
    }).catch(() => {});
  }, [topologyState, selectedNodeId, inspectedNodeId]);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-100 dark:bg-[#08090A] text-zinc-900 dark:text-[#F7F8F8] font-sans select-none overflow-hidden antialiased transition-colors duration-200">
      {/* Top HUD Navigation Bar */}
      <TopNavBar />

      {/* Main Studio Viewport: Visual Canvas */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <TopologyCanvas />

        {/* Scrubbable Time-Travel Decision DAG Timeline Bar */}
        <DagTimelineBar />
      </main>

      {/* Tri-Terminal Execution Drawer */}
      <TriTerminalDrawer />

      {/* Modals */}
      <HclEditorModal />
      <ExportModal />
      <CostBreakdownModal />
      <SecurityStatusModal />
    </div>
  );
};

export default App;
