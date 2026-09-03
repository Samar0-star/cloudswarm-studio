import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  GitFork,
  Columns,
  Terminal,
  ChevronUp,
  ChevronDown,
  DollarSign,
  ShieldCheck,
  Layers,
  History,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { AGENT_PERSONAS } from '../../types/swarm';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { clsx } from 'clsx';

export const DagTimelineBar: React.FC = () => {
  const {
    dagTimeline,
    activeCommitId,
    activeBranchName,
    branches,
    scrubDagTimeline,
    checkoutDagCommit,
    forkDagBranch,
    switchDagBranch,
    openSplitComparison,
    isDrawerOpen,
    setIsDrawerOpen,
    auditReport,
    topologyState,
    setIsCostModalOpen,
    setIsSecurityModalOpen,
  } = useCloudSwarmStore();

  const [isForkModalOpen, setIsForkModalOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  const currentCommitIndex = Math.max(
    0,
    dagTimeline.findIndex((c) => c.id === activeCommitId)
  );

  // Auto-replay timeline through commits
  useEffect(() => {
    if (!isPlaying) return;
    if (dagTimeline.length <= 1) {
      setIsPlaying(false);
      return;
    }
    const interval = setInterval(() => {
      const idx = dagTimeline.findIndex((c) => c.id === activeCommitId);
      const nextIdx = (idx + 1) % dagTimeline.length;
      checkoutDagCommit(dagTimeline[nextIdx]!.id);
      if (nextIdx === dagTimeline.length - 1) {
        setIsPlaying(false);
      }
    }, 850);
    return () => clearInterval(interval);
  }, [isPlaying, dagTimeline, activeCommitId, checkoutDagCommit]);

  const handleStepBack = () => {
    if (currentCommitIndex > 0) {
      checkoutDagCommit(dagTimeline[currentCommitIndex - 1]!.id);
    }
  };

  const handleStepForward = () => {
    if (currentCommitIndex < dagTimeline.length - 1) {
      checkoutDagCommit(dagTimeline[currentCommitIndex + 1]!.id);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    scrubDagTimeline(val);
  };

  const handleForkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    forkDagBranch(newBranchName.trim(), activeCommitId);
    setNewBranchName('');
    setIsForkModalOpen(false);
  };

  const totalCost = auditReport.totalMonthlyCostUsd ?? 0;
  const cisScore = auditReport.securityScore ?? 100;
  const nodeCount = Object.keys(topologyState.nodes).length;
  const activeCommit = dagTimeline[currentCommitIndex];
  const activePersona = activeCommit ? (AGENT_PERSONAS[activeCommit.author] ?? AGENT_PERSONAS.director) : AGENT_PERSONAS.director;

  return (
    <div
      className="flex flex-col w-full bg-white/95 dark:bg-[#090A0C] border-t border-zinc-200 dark:border-zinc-800/80 px-4 py-2 select-none z-20 backdrop-blur-xl text-zinc-700 dark:text-zinc-300 transition-colors duration-200 shadow-xs"
      data-testid="dag-timeline-bar"
      onWheel={(e) => {
        e.stopPropagation();
        if (dagTimeline.length > 1) {
          if (e.deltaY > 0 || e.deltaX > 0) {
            const nextIdx = Math.min(dagTimeline.length - 1, currentCommitIndex + 1);
            if (dagTimeline[nextIdx]?.id) checkoutDagCommit(dagTimeline[nextIdx].id);
          } else if (e.deltaY < 0 || e.deltaX < 0) {
            const prevIdx = Math.max(0, currentCommitIndex - 1);
            if (dagTimeline[prevIdx]?.id) checkoutDagCommit(dagTimeline[prevIdx].id);
          }
        }
      }}
    >
      {/* Time Travel Banner & Controls */}
      <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
        {/* Left: Time Travel Badge & Stepping Controls */}
        <div className="flex items-center space-x-2">
          {/* Subtle Time Travel Badge */}
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300">
            <History className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="font-semibold text-[11px]">Time Travel DAG</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {currentCommitIndex + 1}/{dagTimeline.length}
            </span>
          </div>

          {/* Replay & Step Buttons */}
          <div className="flex items-center space-x-0.5 bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-md p-0.5">
            <button
              onClick={handleStepBack}
              disabled={currentCommitIndex === 0}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Step Backward (Previous Commit)"
              data-testid="time-travel-step-back-btn"
            >
              <SkipBack className="h-3 w-3" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 border border-zinc-900 dark:border-zinc-700/60 text-[10px] font-medium cursor-pointer transition-colors"
              title={isPlaying ? 'Pause Replay' : 'Auto-Replay Architecture Evolution'}
              data-testid="time-travel-play-btn"
            >
              {isPlaying ? <Pause className="h-2.5 w-2.5 fill-current" /> : <Play className="h-2.5 w-2.5 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Replay'}</span>
            </button>

            <button
              onClick={handleStepForward}
              disabled={currentCommitIndex >= dagTimeline.length - 1}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Step Forward (Next Commit)"
              data-testid="time-travel-step-forward-btn"
            >
              <SkipForward className="h-3 w-3" />
            </button>
          </div>

          {/* Branch Dropdown */}
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300">
            <GitBranch className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <select
              value={activeBranchName}
              onChange={(e) => switchDagBranch(e.target.value)}
              className="bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-200 cursor-pointer text-xs font-mono"
              data-testid="branch-select"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fork Button */}
          <button
            onClick={() => setIsForkModalOpen(true)}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer text-xs font-medium"
            title="Fork an experimental architecture branch"
            data-testid="fork-branch-btn"
          >
            <GitFork className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span>Fork</span>
          </button>

          {/* A/B Split Comparison Button */}
          <button
            onClick={() => openSplitComparison()}
            className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer text-xs font-medium"
            title="Open side-by-side A/B Split architecture diff"
            data-testid="split-compare-btn"
          >
            <Columns className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span>A/B Split</span>
          </button>
        </div>

        {/* Center: Active Commit Details */}
        {activeCommit && (
          <div className="hidden lg:flex items-center space-x-2 text-[11px] text-zinc-600 dark:text-zinc-400 max-w-[340px] truncate">
            <span
              className="px-1.5 py-0.2 rounded text-[9px] font-medium"
              style={{
                backgroundColor: `${activePersona.hexCode}15`,
                color: activePersona.hexCode,
                border: `1px solid ${activePersona.hexCode}30`,
              }}
            >
              {activePersona.id === 'director' || activePersona.id === 'human' ? '👤 You' : `${activePersona.glyph} ${activePersona.name}`}
            </span>
            <span className="truncate text-zinc-800 dark:text-zinc-300 font-medium">{activeCommit.message}</span>
          </div>
        )}

        {/* Right: Live Aggregate Metrics & Activity Log Drawer Toggle */}
        <div className="flex items-center space-x-3 text-[11px] text-zinc-600 dark:text-zinc-400">
          <button
            onClick={() => setIsCostModalOpen(true)}
            className="flex items-center space-x-1 hover:text-emerald-600 dark:hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            <span className="text-zinc-900 dark:text-zinc-200 font-semibold">${totalCost.toFixed(2)}/mo</span>
          </button>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>
          <button
            onClick={() => setIsSecurityModalOpen(true)}
            className="flex items-center space-x-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <ShieldCheck className="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
            <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{cisScore}/100</span>
          </button>
          <span className="text-zinc-300 dark:text-zinc-700">•</span>

          {/* Activity Log Toggle */}
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md border transition-colors cursor-pointer ${
              isDrawerOpen
                ? 'bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 font-semibold'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700'
            }`}
            title="Toggle Activity & Terminal Log Drawer"
            data-testid="activity-log-toggle-btn"
          >
            <Terminal className="h-3 w-3" />
            <span>Activity Log</span>
            {isDrawerOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Scrubbing Slider with Minimalist Sleek Neutral Track */}
      <div className="relative flex items-center space-x-3 my-1">
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={dagTimeline.length > 1 ? currentCommitIndex / (dagTimeline.length - 1) : 0}
          onChange={handleSliderChange}
          className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-zinc-800 dark:accent-zinc-300 transition-all"
          title={`Scrub timeline: Commit ${currentCommitIndex + 1} of ${dagTimeline.length}`}
          data-testid="timeline-scrubber"
        />
      </div>

      {/* Lineage Commits */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {dagTimeline.map((node) => {
          const persona = AGENT_PERSONAS[node.author] ?? AGENT_PERSONAS.director;
          const isActive = node.id === activeCommitId;

          return (
            <button
              key={node.id}
              onClick={() => checkoutDagCommit(node.id)}
              className={clsx(
                'flex items-center space-x-1.5 px-2 py-0.5 rounded-lg text-[10px] font-mono shrink-0 transition-all border cursor-pointer',
                isActive
                  ? 'bg-zinc-900 dark:bg-[#1C1D26] text-white dark:text-[#F7F8F8] border-zinc-950 dark:border-[#5E6AD2]/60 shadow-xs font-semibold'
                  : 'bg-zinc-100 dark:bg-[#141517] text-zinc-700 dark:text-[#8A8F98] border-zinc-200 dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/[0.14] hover:text-zinc-950 dark:hover:text-[#F7F8F8]'
              )}
              title={`${persona.name}: ${node.message}`}
              data-testid={`commit-pill-${node.id}`}
            >
              <span
                className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold"
                style={{
                  backgroundColor: `${persona.hexCode}20`,
                  color: persona.hexCode,
                }}
              >
                {persona.glyph}
              </span>
              <span className="truncate max-w-[130px]">{node.message}</span>
            </button>
          );
        })}
      </div>

      {/* Fork Branch Modal */}
      <Modal
        isOpen={isForkModalOpen}
        onClose={() => setIsForkModalOpen(false)}
        title="Fork Infrastructure Branch"
        description="Create an isolated branching timeline to test changes without altering main."
        size="sm"
        dataTestId="fork-modal"
        footer={
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" size="sm" onClick={() => setIsForkModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleForkSubmit}>
              Create Branch
            </Button>
          </div>
        }
      >
        <form onSubmit={handleForkSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#C2C6CC] mb-1">
              Branch Identifier
            </label>
            <input
              type="text"
              placeholder="e.g. staging-experiment"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full px-3 py-1.5 bg-[#141517] border border-white/[0.08] rounded-lg text-xs text-[#F7F8F8] font-mono outline-none focus:border-[#5E6AD2]"
              autoFocus
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
