import {
  getResourceTier,
  computeHierarchicalLayout,
  applyAutoLayout,
  layoutPlannedResources,
} from "../core/layout/autoLayout";
import type { CloudResourceNode, TopologyState } from "../types/topology";

describe("Hierarchical Auto-Layout Engine", () => {
  test("getResourceTier correctly maps resource types to tiers", () => {
    expect(getResourceTier("aws_vpc")).toBe(0);
    expect(getResourceTier("azurerm_virtual_network")).toBe(0);
    expect(getResourceTier("google_compute_network")).toBe(0);

    expect(getResourceTier("aws_subnet")).toBe(1);
    expect(getResourceTier("aws_nat_gateway")).toBe(1);

    expect(getResourceTier("aws_lb")).toBe(2);
    expect(getResourceTier("aws_instance")).toBe(2);
    expect(getResourceTier("aws_eks_cluster")).toBe(2);

    expect(getResourceTier("aws_db_instance")).toBe(3);
    expect(getResourceTier("aws_s3_bucket")).toBe(3);
    expect(getResourceTier("aws_elasticache_cluster")).toBe(3);

    expect(getResourceTier("aws_kms_key")).toBe(4);
    expect(getResourceTier("aws_wafv2_web_acl")).toBe(4);
  });

  test("computeHierarchicalLayout assigns tiered vertical coordinates with centered horizontal positions", () => {
    const nodes: Record<string, CloudResourceNode> = {
      vpc: {
        id: "vpc",
        type: "aws_vpc",
        name: "VPC",
        position: { x: 0, y: 0 },
        config: {},
        version: 1,
        metadata: { createdBy: "alpha", createdAt: 0, updatedAt: 0 },
      },
      subnet: {
        id: "subnet",
        type: "aws_subnet",
        name: "Subnet",
        position: { x: 0, y: 0 },
        config: {},
        version: 1,
        metadata: { createdBy: "alpha", createdAt: 0, updatedAt: 0 },
      },
      ec2: {
        id: "ec2",
        type: "aws_instance",
        name: "EC2",
        position: { x: 0, y: 0 },
        config: {},
        version: 1,
        metadata: { createdBy: "alpha", createdAt: 0, updatedAt: 0 },
      },
      db: {
        id: "db",
        type: "aws_db_instance",
        name: "RDS",
        position: { x: 0, y: 0 },
        config: {},
        version: 1,
        metadata: { createdBy: "alpha", createdAt: 0, updatedAt: 0 },
      },
    };

    const positions = computeHierarchicalLayout(nodes);

    expect(positions.vpc!.y).toBeLessThan(positions.subnet!.y);
    expect(positions.subnet!.y).toBeLessThan(positions.ec2!.y);
    expect(positions.ec2!.y).toBeLessThan(positions.db!.y);
  });

  test("applyAutoLayout immutably updates a TopologyState", () => {
    const state: TopologyState = {
      nodes: {
        v: {
          id: "v",
          type: "aws_vpc",
          name: "VPC",
          position: { x: 0, y: 0 },
          config: {},
          version: 1,
          metadata: { createdBy: "alpha", createdAt: 0, updatedAt: 0 },
        },
      },
      edges: {},
      version: 1,
    };

    const updated = applyAutoLayout(state);
    expect(updated).not.toBe(state);
    expect(updated.nodes.v!.position.y).toBe(120);
  });

  test("layoutPlannedResources updates coordinates on planned resource items", () => {
    const planned = [
      { id: "v", type: "aws_vpc", position: { x: 0, y: 0 } },
      { id: "s", type: "aws_s3_bucket", position: { x: 0, y: 0 } },
    ];

    const result = layoutPlannedResources(planned);
    expect(result[0]!.position.y).toBeLessThan(result[1]!.position.y);
  });
});
