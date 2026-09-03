/**
 * Cloud CAD Primitives & Catalog Discovery WebMCP Tools
 *
 * Exposes the 108 cloud primitive catalog across AWS, Azure, and GCP:
 * - list_catalog_primitives
 * - get_primitive_schema
 */

import type {
  WebMCPTool,
  WebMCPToolResult,
  WebMCPExecutionContext,
  WebModelContextAPI,
} from '../../../types/webmcp';
import {
  CLOUD_RESOURCE_CATALOG,
  getResourceSchema,
} from '../../catalog/resourceCatalog';

export function registerCatalogTools(mcp: WebModelContextAPI): () => void {
  const tools: WebMCPTool[] = [
    {
      name: 'list_catalog_primitives',
      description:
        'Queries the multi-cloud CAD catalog of 108 distinct cloud primitives across AWS, Azure, and GCP with filtering by provider, category, or search term.',
      category: 'topology',
      inputSchema: {
        type: 'object',
        properties: {
          provider: {
            type: 'string',
            enum: ['aws', 'azure', 'google', 'all'],
            default: 'all',
            description: 'Filter primitives by cloud provider.',
          },
          category: {
            type: 'string',
            enum: ['compute', 'storage', 'database', 'network', 'security', 'ai', 'all'],
            default: 'all',
            description: 'Filter primitives by architectural layer/category.',
          },
          search: {
            type: 'string',
            description: 'Optional keyword search term (e.g. "kubernetes", "gpu", "postgres").',
          },
        },
      },
      execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const providerFilter = String(params.provider ?? 'all').toLowerCase();
        const categoryFilter = String(params.category ?? 'all').toLowerCase();
        const searchFilter = String(params.search ?? '').toLowerCase().trim();

        let items = CLOUD_RESOURCE_CATALOG.slice();

        if (providerFilter !== 'all') {
          items = items.filter((item) => item.provider.toLowerCase() === providerFilter);
        }

        if (categoryFilter !== 'all') {
          items = items.filter((item) => item.category.toLowerCase().includes(categoryFilter));
        }

        if (searchFilter) {
          items = items.filter((item) =>
            item.name.toLowerCase().includes(searchFilter) ||
            item.type.toLowerCase().includes(searchFilter) ||
            item.description.toLowerCase().includes(searchFilter)
          );
        }

        const simplified = items.map((item) => ({
          type: item.type,
          name: item.name,
          provider: item.provider,
          category: item.category,
          base_monthly_usd: item.pricingModel.baseMonthlyRate,
          hourly_usd: item.pricingModel.hourlyRate ?? (item.pricingModel.baseMonthlyRate / 730),
          description: item.description,
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              total_primitives_in_catalog: CLOUD_RESOURCE_CATALOG.length,
              matching_count: simplified.length,
              primitives: simplified,
            }, null, 2),
          }],
          meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'alpha' },
        };
      },
    },

    {
      name: 'get_primitive_schema',
      description:
        'Returns granular configuration schema, default settings, and pricing metrics for a specific cloud primitive type.',
      category: 'topology',
      inputSchema: {
        type: 'object',
        required: ['resource_type'],
        properties: {
          resource_type: {
            type: 'string',
            description: 'The exact cloud primitive type (e.g. "aws_instance", "azurerm_kubernetes_cluster", "google_sql_database_instance").',
          },
        },
      },
      execute: async (params: Record<string, unknown>, context?: WebMCPExecutionContext): Promise<WebMCPToolResult> => {
        const resourceType = String(params.resource_type ?? '');
        const item = getResourceSchema(resourceType);

        if (!item) {
          return {
            isError: true,
            content: [{
              type: 'text',
              text: `Primitive type '${resourceType}' not found in catalog. Use list_catalog_primitives to discover valid types.`,
            }],
            meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'alpha' },
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              type: item.type,
              name: item.name,
              provider: item.provider,
              category: item.category,
              description: item.description,
              default_config: item.defaultConfig,
              pricing_model: item.pricingModel,
              validation_rules: item.validationRules,
            }, null, 2),
          }],
          meta: { executionTimeMs: 0, agentId: context?.agentId ?? 'alpha' },
        };
      },
    },
  ];

  const unregisters = tools.map((tool) => mcp.registerTool(tool));
  return () => {
    unregisters.forEach((unreg) => {
      if (typeof unreg === 'function') unreg();
    });
  };
}
