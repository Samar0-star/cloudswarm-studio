/**
 * CostBreakdownModal & FinOps UI Integration Tests (Milestone M4)
 *
 * Tests:
 * 1. Modal open/close state and budget store actions.
 * 2. Multi-Cloud Provider filtering and spend aggregation (AWS, Azure, GCP).
 * 3. Budget threshold calculations and status boundaries (Emerald, Amber, Rose).
 * 4. 1-Click RFC 4180 CSV export routine formatting and accuracy.
 * 5. Automated multi-cloud rightsizing optimizations application.
 */

import { useCloudSwarmStore } from '../store/useCloudSwarmStore';
import { exportCostBreakdownCsv, calculateTopologyCostBreakdown } from '../core/audit/CostCalculator';
import type { CloudResourceNode, TopologyState } from '../types/topology';

describe('Milestone M4: CostBreakdownModal & FinOps UI Integration', () => {
  beforeEach(() => {
    useCloudSwarmStore.getState().resetTopology();
    useCloudSwarmStore.setState({ isCostModalOpen: false, monthlyBudgetUsd: 250 });
  });

  describe('1. Modal Open/Close & Budget Store Integration', () => {
    test('controls modal visibility and updates monthly budget threshold', () => {
      const store = useCloudSwarmStore.getState();

      expect(useCloudSwarmStore.getState().isCostModalOpen).toBe(false);

      // Open Modal
      store.setIsCostModalOpen(true);
      expect(useCloudSwarmStore.getState().isCostModalOpen).toBe(true);

      // Update Budget
      store.setMonthlyBudgetUsd(500);
      expect(useCloudSwarmStore.getState().monthlyBudgetUsd).toBe(500);

      // Close Modal
      store.setIsCostModalOpen(false);
      expect(useCloudSwarmStore.getState().isCostModalOpen).toBe(false);
    });
  });

  describe('2. Multi-Cloud Spend & Provider Segregation', () => {
    test('computes provider totals across AWS, Azure, and GCP accurately', async () => {
      const store = useCloudSwarmStore.getState();

      // 1. AWS Node: EC2 t3.medium + 30GB gp3 (~$32.77/mo)
      await store.addNode({
        id: 'ec2_web',
        type: 'aws_instance',
        name: 'AWS Web Server',
        position: { x: 0, y: 0 },
        config: { instance_type: 't3.medium', root_volume_gb: 30 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      // 2. Azure Node: Standard_D2s_v5 VM + 64GB Premium SSD (~$78.72/mo)
      await store.addNode({
        id: 'azure_vm_1',
        type: 'azurerm_linux_virtual_machine',
        name: 'Azure App Worker',
        position: { x: 100, y: 0 },
        config: { vm_size: 'Standard_D2s_v5', os_disk: { disk_size_gb: 64, storage_account_type: 'Premium_LRS' } },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 2,
      });

      // 3. GCP Node: GCE e2-standard-4 + 50GB pd-balanced (~$102.82/mo)
      await store.addNode({
        id: 'gcp_gce_1',
        type: 'google_compute_instance',
        name: 'GCP Analytics Server',
        position: { x: 200, y: 0 },
        config: { machine_type: 'e2-standard-4', boot_disk: { size_gb: 50, type: 'pd-balanced' } },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 3,
      });

      const state = useCloudSwarmStore.getState().topologyState;
      const breakdown = calculateTopologyCostBreakdown(state);

      expect(breakdown.items.length).toBe(3);
      expect(breakdown.providerTotals.aws).toBeCloseTo(32.77, 1);
      expect(breakdown.providerTotals.azure).toBeCloseTo(78.72, 1);
      expect(breakdown.providerTotals.google).toBeCloseTo(102.82, 1);
      expect(breakdown.totalMonthlyUsd).toBeCloseTo(32.77 + 78.72 + 102.82, 1);
    });
  });

  describe('3. Dynamic Budget Threshold Status & Meter Boundaries', () => {
    test('identifies Healthy (<80%), Warning (80-100%), and Exceeded (>100%) statuses', async () => {
      const store = useCloudSwarmStore.getState();
      store.setMonthlyBudgetUsd(100);

      // Baseline: $0 of $100 -> 0% (Healthy Emerald)
      let report = store.auditReport;
      let totalCost = report.totalMonthlyCostUsd;
      let usagePercent = (totalCost / 100) * 100;
      expect(usagePercent).toBe(0);
      expect(totalCost <= 100).toBe(true);

      // Add node with ~$85/mo spend (85% -> Warning Amber)
      await store.addNode({
        id: 'azure_app_srv',
        type: 'azurerm_app_service',
        name: 'App Service P1v3',
        position: { x: 0, y: 0 },
        config: { sku_name: 'P1v3' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      let updatedState = useCloudSwarmStore.getState();
      totalCost = updatedState.auditReport.totalMonthlyCostUsd;
      usagePercent = (totalCost / 100) * 100;
      expect(usagePercent).toBeGreaterThanOrEqual(80);
      expect(usagePercent).toBeLessThanOrEqual(100);

      // Add expensive node (A100 GPU cluster) -> Exceeded Rose Alert
      await store.addNode({
        id: 'a100_cluster',
        type: 'aws_instance_gpu',
        name: 'GPU Training',
        position: { x: 100, y: 0 },
        config: { instance_type: 'p4d.24xlarge' },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 2,
      });

      updatedState = useCloudSwarmStore.getState();
      totalCost = updatedState.auditReport.totalMonthlyCostUsd;
      expect(totalCost).toBeGreaterThan(100);
      const isOverBudget = totalCost > 100;
      expect(isOverBudget).toBe(true);
    });
  });

  describe('4. 1-Click CSV Export Routine Output Validation', () => {
    test('generates valid RFC 4180 CSV with escaped strings, headers, subtotals, and metrics', async () => {
      await useCloudSwarmStore.getState().addNode({
        id: 'db_prod_node',
        type: 'aws_db_instance',
        name: 'Production "Postgres", Multi-AZ',
        position: { x: 0, y: 0 },
        config: { instance_class: 'db.t4g.medium', allocated_storage_gb: 100, multi_az: true },
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      await useCloudSwarmStore.getState().addNode({
        id: 'azure_db_node',
        type: 'azurerm_mssql_database',
        name: 'Azure Core SQL',
        position: { x: 100, y: 0 },
        config: { sku_name: 'GP_Gen5_2', max_size_gb: 50 },
        metadata: { createdBy: 'beta', createdAt: Date.now(), updatedAt: Date.now() },
        version: 2,
      });

      const state = useCloudSwarmStore.getState().topologyState;
      const csv = exportCostBreakdownCsv(state);

      // Check Header
      expect(csv).toContain('CloudSwarm Studio - Multi-Cloud FinOps Infrastructure Cost Report');
      expect(csv).toContain('Provider,Resource Name,Node ID,Resource Type,Category,Hourly Rate ($/hr),Monthly Spend ($/mo),Details');

      // Check Quotes and commas RFC 4180 escaping
      expect(csv).toContain('"Production ""Postgres"", Multi-AZ"');
      expect(csv).toContain('db_prod_node');
      expect(csv).toContain('azure_db_node');

      // Check Subtotals
      expect(csv).toContain('Category Subtotals,Monthly Spend ($/mo),Percentage of Total (%)');
      expect(csv).toContain('Database');
      expect(csv).toContain('Provider Subtotals,Monthly Spend ($/mo),Percentage of Total (%)');
      expect(csv).toContain('Amazon Web Services (AWS)');
      expect(csv).toContain('Microsoft Azure');

      // Check Summary Metrics
      expect(csv).toContain('Summary Metric,Amount ($)');
      expect(csv).toContain('Gross Projected Spend ($/mo)');
      expect(csv).toContain('Total Hourly Run-Rate ($/hr)');
      expect(csv).toContain('Potential Monthly Savings ($/mo)');
      expect(csv).toContain('Net Optimized Spend ($/mo)');
    });
  });

  describe('5. Automated FinOps Rightsizing Optimization Execution', () => {
    test('applies Graviton and gp3 rightsizing mutations to state and reduces cost', async () => {
      await useCloudSwarmStore.getState().addNode({
        id: 'ec2_unoptimized',
        type: 'aws_instance',
        name: 'Legacy EC2',
        position: { x: 0, y: 0 },
        config: { instance_type: 'c6i.large', root_volume_type: 'io2', root_volume_gb: 100 },
        metadata: { createdBy: 'alpha', createdAt: Date.now(), updatedAt: Date.now() },
        version: 1,
      });

      const costBefore = useCloudSwarmStore.getState().auditReport.totalMonthlyCostUsd;
      expect(costBefore).toBeGreaterThan(0);

      await useCloudSwarmStore.getState().applyFinOpsOptimization();

      const optimizedNode = useCloudSwarmStore.getState().topologyState.nodes['ec2_unoptimized'];
      expect(optimizedNode?.config['instance_type']).toBe('c7g.large'); // Graviton3
      expect(optimizedNode?.config['root_volume_type']).toBe('gp3');    // gp3

      const costAfter = useCloudSwarmStore.getState().auditReport.totalMonthlyCostUsd;
      expect(costAfter).toBeLessThan(costBefore);
    });
  });
});
