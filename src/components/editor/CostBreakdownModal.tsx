import React, { useState, useMemo } from 'react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  DollarSign,
  TrendingDown,
  AlertTriangle,
  Zap,
  Server,
  Database,
  Globe,
  HardDrive,
  Cpu,
  Download,
  Search,
  CheckCircle2,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { CloudProvider, CloudResourceType } from '../../types/topology';
import { exportCostBreakdownCsv, getProviderFromResourceType } from '../../core/audit/CostCalculator';

type ProviderFilter = 'all' | 'aws' | 'azure' | 'google';

export const CostBreakdownModal: React.FC = () => {
  const {
    isCostModalOpen,
    setIsCostModalOpen,
    auditReport,
    monthlyBudgetUsd,
    setMonthlyBudgetUsd,
    applyFinOpsOptimization,
    topologyState,
  } = useCloudSwarmStore();

  const [selectedProvider, setSelectedProvider] = useState<ProviderFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const totalMonthlyCost = auditReport.totalMonthlyCostUsd ?? 0;
  const costBreakdown = auditReport.costBreakdown ?? [];
  const potentialSavings = auditReport.potentialSavingsUsd ?? 0;
  const recommendations = auditReport.recommendations ?? [];

  // Budget calculations
  const rawUsagePercent = Math.round((totalMonthlyCost / Math.max(1, monthlyBudgetUsd)) * 100);
  const budgetUsagePercent = Math.min(100, rawUsagePercent);
  const isOverBudget = totalMonthlyCost > monthlyBudgetUsd;
  const isNearBudget = !isOverBudget && rawUsagePercent >= 80;

  // Provider spend breakdowns
  const providerStats = useMemo(() => {
    let aws = 0;
    let azure = 0;
    let google = 0;
    let awsCount = 0;
    let azureCount = 0;
    let googleCount = 0;

    for (const item of costBreakdown) {
      const p = item.provider || getProviderFromResourceType(item.type);
      if (p === 'aws') {
        aws += item.monthlyUsd;
        awsCount++;
      } else if (p === 'azure') {
        azure += item.monthlyUsd;
        azureCount++;
      } else if (p === 'google') {
        google += item.monthlyUsd;
        googleCount++;
      }
    }

    return {
      aws: { spend: Math.round(aws * 100) / 100, count: awsCount },
      azure: { spend: Math.round(azure * 100) / 100, count: azureCount },
      google: { spend: Math.round(google * 100) / 100, count: googleCount },
      totalCount: costBreakdown.length,
    };
  }, [costBreakdown]);

  // Filtered line items
  const filteredItems = useMemo(() => {
    return costBreakdown.filter((item) => {
      const p = item.provider || getProviderFromResourceType(item.type);
      if (selectedProvider !== 'all' && p !== selectedProvider) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const node = topologyState.nodes[item.nodeId];
        const matchName = (node?.name || item.name || '').toLowerCase().includes(q);
        const matchId = item.nodeId.toLowerCase().includes(q);
        const matchType = item.type.toLowerCase().includes(q);
        const matchCategory = item.category.toLowerCase().includes(q);
        return matchName || matchId || matchType || matchCategory;
      }
      return true;
    });
  }, [costBreakdown, selectedProvider, searchQuery, topologyState.nodes]);

  // 1-Click RFC 4180 CSV Export Routine
  const handleExportCsv = () => {
    const csvData = exportCostBreakdownCsv({
      items: costBreakdown as any,
      totalMonthlyUsd: totalMonthlyCost,
      totalHourlyUsd: auditReport.totalHourlyCostUsd ?? totalMonthlyCost / 730,
      categoryTotals: auditReport.categoryTotals,
      providerTotals: {
        aws: providerStats.aws.spend,
        azure: providerStats.azure.spend,
        google: providerStats.google.spend,
      },
      potentialSavingsUsd: potentialSavings,
    });

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cloudswarm-cost-breakdown-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getResourceIcon = (type: CloudResourceType) => {
    if (type.includes('vpc') || type.includes('vnet') || type.includes('network') || type.includes('subnet') || type.includes('lb') || type.includes('gateway')) {
      return <Globe className="h-4 w-4 text-cyan-400" />;
    }
    if (type.includes('instance') || type.includes('virtual_machine')) {
      return <Server className="h-4 w-4 text-emerald-400" />;
    }
    if (type.includes('cluster') || type.includes('container') || type.includes('app_service') || type.includes('run')) {
      return <Cpu className="h-4 w-4 text-indigo-400" />;
    }
    if (type.includes('db') || type.includes('sql') || type.includes('rds') || type.includes('cosmos') || type.includes('spanner') || type.includes('redis')) {
      return <Database className="h-4 w-4 text-violet-400" />;
    }
    if (type.includes('s3') || type.includes('blob') || type.includes('storage') || type.includes('bucket') || type.includes('disk') || type.includes('ebs')) {
      return <HardDrive className="h-4 w-4 text-amber-400" />;
    }
    return <Server className="h-4 w-4 text-slate-400" />;
  };

  const getProviderBadge = (provider: CloudProvider) => {
    switch (provider) {
      case 'aws':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            AWS
          </span>
        );
      case 'azure':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            AZURE
          </span>
        );
      case 'google':
        return (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            GCP
          </span>
        );
    }
  };

  return (
    <Modal
      isOpen={isCostModalOpen}
      onClose={() => setIsCostModalOpen(false)}
      dataTestId="cost-breakdown-modal"
      size="xl"
      title={
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <DollarSign className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-100 flex items-center space-x-2">
              <span>Multi-Cloud FinOps Engine & Budget Alerts</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                AWS • Azure • GCP
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-normal">
              730 hrs/mo rate card evaluations across vCPU, RAM, GPU, storage tiers, and serverless containers.
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="text-slate-400">
              Gross Monthly Spend:{' '}
              <span className="font-bold text-slate-100">${totalMonthlyCost.toFixed(2)}/mo</span>
            </div>
            {potentialSavings > 0 && (
              <div className="text-emerald-400 flex items-center space-x-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Save ~${potentialSavings.toFixed(2)}/mo</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              dataTestId="export-cost-csv-btn"
              leftIcon={<Download className="h-3.5 w-3.5 text-slate-300" />}
            >
              Export CSV
            </Button>
            {potentialSavings > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applyFinOpsOptimization()}
                dataTestId="apply-finops-opt-btn"
                leftIcon={<TrendingDown className="h-3.5 w-3.5 text-emerald-400" />}
              >
                Apply Rightsizing
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => setIsCostModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
        {/* Top Metric & Budget Cards */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Budget Meter Card (7 Cols) */}
          <div className="md:col-span-7 p-4 rounded-xl bg-[#14161E] border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 flex items-center space-x-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Monthly Cloud Budget Threshold</span>
              </span>
              <div className="flex items-center space-x-1.5 font-mono">
                <span className="text-slate-400">$</span>
                <input
                  type="number"
                  value={monthlyBudgetUsd}
                  data-testid="budget-input"
                  onChange={(e) => setMonthlyBudgetUsd(Math.max(10, Number(e.target.value)))}
                  className="w-24 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400">/mo</span>
              </div>
            </div>

            {/* Dynamic Progress Bar (Emerald -> Amber -> Rose) */}
            <div className="space-y-1.5">
              <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isOverBudget
                      ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
                      : isNearBudget
                      ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                      : 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                  }`}
                  style={{ width: `${budgetUsagePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono">
                <span
                  className={
                    isOverBudget
                      ? 'text-rose-400 font-bold'
                      : isNearBudget
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-400'
                  }
                >
                  {rawUsagePercent}% utilized {isOverBudget ? '(EXCEEDED)' : isNearBudget ? '(WARNING)' : '(HEALTHY)'}
                </span>
                <span className={isOverBudget ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                  ${totalMonthlyCost.toFixed(2)} of ${monthlyBudgetUsd}
                </span>
              </div>
            </div>

            {/* Dynamic Status Alert Banners */}
            {isOverBudget ? (
              <div
                data-testid="budget-alert-banner"
                className="flex items-center space-x-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <div className="text-[11px]">
                  <span className="font-semibold">Budget Exceeded Alert:</span> Projected run-rate exceeds budget by{' '}
                  <span className="font-mono font-bold">${(totalMonthlyCost - monthlyBudgetUsd).toFixed(2)}/mo</span>. Apply rightsizing recommendations below to reduce spend.
                </div>
              </div>
            ) : isNearBudget ? (
              <div className="flex items-center space-x-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <div className="text-[11px]">
                  <span className="font-semibold">Budget Warning:</span> Spend is at {rawUsagePercent}% of limit. ${(monthlyBudgetUsd - totalMonthlyCost).toFixed(2)} headroom remaining.
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-[11px]">Spend is healthy and well within allocated cloud budget.</span>
              </div>
            )}
          </div>

          {/* Provider Share Cards (5 Cols) */}
          <div className="md:col-span-5 grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-[#14161E] border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-400 font-semibold">AWS</span>
                <span className="text-[10px] text-slate-400 font-mono">{providerStats.aws.count} res</span>
              </div>
              <div className="mt-2">
                <div className="text-sm font-bold font-mono text-slate-100">${providerStats.aws.spend.toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">
                  {totalMonthlyCost > 0 ? ((providerStats.aws.spend / totalMonthlyCost) * 100).toFixed(0) : 0}% of spend
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#14161E] border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-sky-400 font-semibold">AZURE</span>
                <span className="text-[10px] text-slate-400 font-mono">{providerStats.azure.count} res</span>
              </div>
              <div className="mt-2">
                <div className="text-sm font-bold font-mono text-slate-100">${providerStats.azure.spend.toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">
                  {totalMonthlyCost > 0 ? ((providerStats.azure.spend / totalMonthlyCost) * 100).toFixed(0) : 0}% of spend
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#14161E] border border-slate-800/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 font-semibold">GCP</span>
                <span className="text-[10px] text-slate-400 font-mono">{providerStats.google.count} res</span>
              </div>
              <div className="mt-2">
                <div className="text-sm font-bold font-mono text-slate-100">${providerStats.google.spend.toFixed(2)}</div>
                <div className="text-[10px] text-slate-400">
                  {totalMonthlyCost > 0 ? ((providerStats.google.spend / totalMonthlyCost) * 100).toFixed(0) : 0}% of spend
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Cloud Rightsizing Recommendations (if any) */}
        {recommendations.length > 0 && (
          <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-indigo-300 font-semibold">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Automated Multi-Cloud Rightsizing Recommendations</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                  {recommendations.length} Active
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => applyFinOpsOptimization()}
                leftIcon={<TrendingDown className="h-3 w-3 text-emerald-400" />}
              >
                1-Click Optimize All (~${potentialSavings.toFixed(2)}/mo)
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/90 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 truncate pr-2">{rec.title}</span>
                    <span className="font-mono text-emerald-400 font-bold shrink-0">
                      +${rec.estimatedSavingsMonthlyUsd.toFixed(2)}/mo
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-2">{rec.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          {/* Provider Filter Tabs */}
          <div className="flex items-center space-x-1.5 p-1 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedProvider('all')}
              data-testid="filter-provider-all"
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedProvider === 'all'
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Clouds ({costBreakdown.length})
            </button>
            <button
              onClick={() => setSelectedProvider('aws')}
              data-testid="filter-provider-aws"
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedProvider === 'aws'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AWS (${providerStats.aws.spend.toFixed(0)})
            </button>
            <button
              onClick={() => setSelectedProvider('azure')}
              data-testid="filter-provider-azure"
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedProvider === 'azure'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Azure (${providerStats.azure.spend.toFixed(0)})
            </button>
            <button
              onClick={() => setSelectedProvider('google')}
              data-testid="filter-provider-gcp"
              className={`px-3 py-1 rounded font-medium transition-colors ${
                selectedProvider === 'google'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GCP (${providerStats.google.spend.toFixed(0)})
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search resource, node ID, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 w-full sm:w-64 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Line-Item Breakdown Table */}
        <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-[#11131A]">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/80 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            <div className="col-span-6 sm:col-span-5">Resource & Provider</div>
            <div className="col-span-2 hidden sm:block">Category</div>
            <div className="col-span-3 sm:col-span-2 text-right">Hourly Rate</div>
            <div className="col-span-3 sm:col-span-3 text-right">Monthly Spend</div>
          </div>

          <div className="divide-y divide-slate-800/40 max-h-72 overflow-y-auto">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const node = topologyState.nodes[item.nodeId];
                const provider = item.provider || getProviderFromResourceType(item.type);
                return (
                  <div
                    key={item.nodeId}
                    className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-xs hover:bg-slate-900/40 transition-colors"
                  >
                    <div className="col-span-6 sm:col-span-5 flex items-center space-x-2.5 truncate">
                      <div className="shrink-0">{getResourceIcon(item.type)}</div>
                      <div className="truncate">
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="font-medium text-slate-200 truncate">
                            {node?.name || item.name || item.nodeId}
                          </span>
                          {getProviderBadge(provider)}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {item.nodeId} • {item.details || item.type}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 hidden sm:block">
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {item.category}
                      </span>
                    </div>

                    <div className="col-span-3 sm:col-span-2 text-right font-mono text-slate-300">
                      ${item.hourlyUsd.toFixed(4)}/hr
                    </div>

                    <div className="col-span-3 sm:col-span-3 text-right font-mono font-semibold text-emerald-400">
                      ${item.monthlyUsd.toFixed(2)}/mo
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                <Layers className="h-6 w-6 text-slate-600 mx-auto" />
                <div>No resources found matching filter criteria.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
