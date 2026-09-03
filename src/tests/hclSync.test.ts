/**
 * Unit Tests for HCLSyncEngine — Bidirectional Canvas <-> Terraform HCL2 Sync
 */

import {
  HCLSyncEngine,
  HCLParser,
  canvasToHcl,
  hclToCanvas,
  computePatchesFromHcl,
} from "../core/sync/HCLSyncEngine";
import type { CloudResourceNode, TopologyEdge } from "../types/topology";
import { createDefaultTopologyState } from "../types/topology";

describe("HCLSyncEngine — AST-Level Bidirectional Synchronization Engine", () => {
  describe("HCL2 Parser & AST Tokenizer", () => {
    let parser: HCLParser;

    beforeEach(() => {
      parser = new HCLParser();
    });

    test("tokenizes and parses basic resource blocks, attributes, and types", () => {
      const hcl = `
# Primary VPC definition
resource "aws_vpc" "vpc_prod" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  instance_tenancy     = "default"
}
`;
      const ast = parser.parse(hcl);
      expect(ast.blocks.length).toBe(1);
      const block = ast.blocks[0]!;
      expect(block.type).toBe("resource");
      expect(block.labels).toEqual(["aws_vpc", "vpc_prod"]);
      expect(block.attributes["cidr_block"]).toBe("10.0.0.0/16");
      expect(block.attributes["enable_dns_hostnames"]).toBe(true);
      expect(block.attributes["enable_dns_support"]).toBe(true);
      expect(block.attributes["instance_tenancy"]).toBe("default");
    });

    test("parses nested blocks and arrays of rules", () => {
      const hcl = `
resource "aws_security_group" "web_sg" {
  name        = "web-secgroup"
  description = "Production web access"
  vpc_id      = aws_vpc.vpc_prod.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS public"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
`;
      const ast = parser.parse(hcl);
      expect(ast.blocks.length).toBe(1);
      const block = ast.blocks[0]!;
      expect(block.labels).toEqual(["aws_security_group", "web_sg"]);
      expect(block.nestedBlocks.length).toBe(2);
      expect(block.nestedBlocks[0]?.type).toBe("ingress");
      expect(block.nestedBlocks[0]?.attributes["from_port"]).toBe(443);
      expect(block.nestedBlocks[1]?.type).toBe("egress");
    });

    test("parses heredocs and multiline string blocks", () => {
      const hcl = [
        'resource "aws_iam_role" "app_role" {',
        '  name = "app-service-role"',
        '  assume_role_policy = <<POLICY',
        '{',
        '  "Version": "2012-10-17",',
        '  "Statement": [{ "Action": "sts:AssumeRole", "Effect": "Allow" }]',
        '}',
        'POLICY',
        '}'
      ].join("\n");
      const ast = parser.parse(hcl);
      expect(ast.blocks.length).toBe(1);
      const block = ast.blocks[0]!;
      expect(block.attributes["assume_role_policy"]).toContain('"Version": "2012-10-17"');
    });
  });

  describe("Canvas to HCL Serialization (canvasToHcl)", () => {
    test("compiles all 10 AWS primitives accurately into Terraform HCL2 syntax", () => {
      const state = createDefaultTopologyState();
      const nodes = state.nodes as Record<string, CloudResourceNode>;

      nodes["vpc_main"] = {
        id: "vpc_main",
        type: "aws_vpc",
        name: "Main VPC",
        position: { x: 0, y: 0 },
        config: { cidr_block: "10.0.0.0/16", enable_dns_hostnames: true },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes["sub_pub"] = {
        id: "sub_pub",
        type: "aws_subnet",
        name: "Public Subnet",
        position: { x: 0, y: 0 },
        config: { vpc_id: "vpc_main", cidr_block: "10.0.1.0/24", availability_zone: "us-east-1a", map_public_ip_on_launch: true },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes["ec2_app"] = {
        id: "ec2_app",
        type: "aws_instance",
        name: "App Instance",
        position: { x: 0, y: 0 },
        config: {
          instance_type: "c7g.large",
          subnet_id: "sub_pub",
          root_volume_gb: 40,
          root_volume_type: "gp3",
          http_tokens: "required",
        },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes["rds_db"] = {
        id: "rds_db",
        type: "aws_db_instance",
        name: "App DB",
        position: { x: 0, y: 0 },
        config: {
          engine: "postgres",
          instance_class: "db.t4g.medium",
          allocated_storage_gb: 100,
          multi_az: true,
          storage_encrypted: true,
        },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes["s3_assets"] = {
        id: "s3_assets",
        type: "aws_s3_bucket",
        name: "S3 Assets",
        position: { x: 0, y: 0 },
        config: {
          bucket_name: "prod-assets-store",
          versioning_enabled: true,
          encryption: { sse_algorithm: "AES256" },
        },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const hcl = canvasToHcl(state);

      // VPC assertions
      expect(hcl).toContain('resource "aws_vpc" "vpc_main" {');
      expect(hcl).toContain('cidr_block           = "10.0.0.0/16"');
      expect(hcl).toContain('enable_dns_hostnames = true');

      // Subnet assertions
      expect(hcl).toContain('resource "aws_subnet" "sub_pub" {');
      expect(hcl).toContain('vpc_id                  = aws_vpc.vpc_main.id');
      expect(hcl).toContain('cidr_block              = "10.0.1.0/24"');

      // EC2 assertions
      expect(hcl).toContain('resource "aws_instance" "ec2_app" {');
      expect(hcl).toContain('instance_type        = "c7g.large"');
      expect(hcl).toContain('subnet_id            = aws_subnet.sub_pub.id');
      expect(hcl).toContain('http_tokens = "required"');
      expect(hcl).toContain('volume_type = "gp3"');

      // RDS assertions
      expect(hcl).toContain('resource "aws_db_instance" "rds_db" {');
      expect(hcl).toContain('engine                  = "postgres"');
      expect(hcl).toContain('instance_class          = "db.t4g.medium"');
      expect(hcl).toContain('multi_az                = true');

      // S3 assertions
      expect(hcl).toContain('resource "aws_s3_bucket" "s3_assets" {');
      expect(hcl).toContain('bucket = "prod-assets-store"');
      expect(hcl).toContain('versioning {');
      expect(hcl).toContain('sse_algorithm = "AES256"');
    });

    test("generates formatted security group with multiple ingress and egress rules", () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)["sg_test"] = {
        id: "sg_test",
        type: "aws_security_group",
        name: "Test SG",
        position: { x: 0, y: 0 },
        config: {
          name: "test-sg",
          description: "Security Group Test",
          ingress_rules: [
            { protocol: "tcp", from_port: 80, to_port: 80, cidr_blocks: ["0.0.0.0/0"] },
            { protocol: "tcp", from_port: 443, to_port: 443, cidr_blocks: ["10.0.0.0/8"] },
          ],
        },
        metadata: { createdBy: "beta", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const hcl = canvasToHcl(state);
      expect(hcl).toContain('resource "aws_security_group" "sg_test" {');
      expect(hcl).toContain("from_port   = 80");
      expect(hcl).toContain("to_port     = 443");
    });
  });

  describe("HCL to Canvas Deserialization (hclToCanvas)", () => {
    test("parses HCL string and synthesizes normalized CloudResourceNode entities", () => {
      const hcl = `
resource "aws_vpc" "vpc_app" {
  cidr_block = "172.31.0.0/16"
}

resource "aws_instance" "srv_node" {
  instance_type = "t4g.xlarge"
  ami           = "ami-12345"
  subnet_id     = aws_subnet.sub_app.id

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    iops        = 3000
  }
}
`;
      const state = hclToCanvas(hcl);
      expect(state.nodes["vpc_app"]).toBeDefined();
      expect(state.nodes["vpc_app"]?.type).toBe("aws_vpc");
      expect(state.nodes["vpc_app"]?.config.cidr_block).toBe("172.31.0.0/16");

      expect(state.nodes["srv_node"]).toBeDefined();
      expect(state.nodes["srv_node"]?.type).toBe("aws_instance");
      expect(state.nodes["srv_node"]?.config.instance_type).toBe("t4g.xlarge");
      expect(state.nodes["srv_node"]?.config.http_tokens).toBe("required");
      expect(state.nodes["srv_node"]?.config.root_volume_gb).toBe(50);
      expect(state.nodes["srv_node"]?.config.root_volume_type).toBe("gp3");
    });

    test("reconstructs relationship edges from inter-resource references", () => {
      const hcl = `
resource "aws_vpc" "main_vpc" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "pub_sub" {
  vpc_id     = aws_vpc.main_vpc.id
  cidr_block = "10.0.1.0/24"
}

resource "aws_instance" "web_ec2" {
  subnet_id     = aws_subnet.pub_sub.id
  instance_type = "t3.micro"
}
`;
      const state = hclToCanvas(hcl);
      expect(Object.keys(state.nodes).length).toBe(3);

      const edgeSubVpc = Object.values(state.edges).find(
        (e: TopologyEdge) => e.source === "pub_sub" && e.target === "main_vpc"
      );
      expect(edgeSubVpc).toBeDefined();

      const edgeEc2Sub = Object.values(state.edges).find(
        (e: TopologyEdge) => e.source === "web_ec2" && e.target === "pub_sub"
      );
      expect(edgeEc2Sub).toBeDefined();
    });
  });

  describe("Multi-Cloud Canvas to HCL (Azure & GCP)", () => {
    test("serializes Azure and GCP primitives into valid Terraform/OpenTofu HCL2 blocks", () => {
      const state = createDefaultTopologyState();
      const nodes = state.nodes as Record<string, CloudResourceNode>;

      nodes["vnet_main"] = {
        id: "vnet_main",
        type: "azurerm_virtual_network",
        name: "Azure Main VNet",
        position: { x: 0, y: 0 },
        config: {
          virtual_network_name: "prod-vnet",
          location: "eastus",
          resource_group_name: "rg-prod",
          address_space: ["10.10.0.0/16"],
        },
        metadata: { createdBy: "beta", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes["vm_linux"] = {
        id: "vm_linux",
        type: "azurerm_linux_virtual_machine",
        name: "Azure Linux Server",
        position: { x: 100, y: 100 },
        config: {
          name: "vm-app-prod",
          location: "eastus",
          resource_group_name: "rg-prod",
          vm_size: "Standard_D4s_v5",
          admin_username: "azureuser",
          disable_password_authentication: true,
          os_disk: { caching: "ReadWrite", storage_account_type: "Premium_LRS", disk_size_gb: 100 },
        },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes["gcp_net"] = {
        id: "gcp_net",
        type: "google_compute_network",
        name: "GCP Global Network",
        position: { x: 200, y: 200 },
        config: {
          network_name: "custom-vpc",
          auto_create_subnetworks: false,
          routing_mode: "GLOBAL",
        },
        metadata: { createdBy: "beta", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes["gce_worker"] = {
        id: "gce_worker",
        type: "google_compute_instance",
        name: "GCE Worker Node",
        position: { x: 300, y: 300 },
        config: {
          instance_name: "worker-node-1",
          machine_type: "e2-standard-4",
          zone: "us-central1-a",
          boot_disk: { size_gb: 50, type: "pd-balanced" },
        },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const hcl = canvasToHcl(state);

      expect(hcl).toContain('resource "azurerm_virtual_network" "vnet_main"');
      expect(hcl).toContain('resource_group_name = "rg-prod"');
      expect(hcl).toContain('address_space       = ["10.10.0.0/16"]');

      expect(hcl).toContain('resource "azurerm_linux_virtual_machine" "vm_linux"');
      expect(hcl).toContain('size                            = "Standard_D4s_v5"');
      expect(hcl).toContain('storage_account_type = "Premium_LRS"');

      expect(hcl).toContain('resource "google_compute_network" "gcp_net"');
      expect(hcl).toContain('routing_mode            = "GLOBAL"');

      expect(hcl).toContain('resource "google_compute_instance" "gce_worker"');
      expect(hcl).toContain('machine_type = "e2-standard-4"');
      expect(hcl).toContain('zone         = "us-central1-a"');
    });
  });

  describe("Multi-Cloud HCL to Canvas Deserialization (Azure & GCP)", () => {
    test("parses Azure and GCP resource blocks with nested disk and network blocks", () => {
      const hcl = `
resource "azurerm_virtual_network" "vnet_prod" {
  name                = "vnet-prod-east"
  location            = "eastus"
  resource_group_name = "rg-production"
  address_space       = ["10.20.0.0/16"]
}

resource "azurerm_subnet" "sub_app" {
  name                 = "sub-app-01"
  resource_group_name  = "rg-production"
  virtual_network_name = azurerm_virtual_network.vnet_prod.name
  address_prefixes     = ["10.20.1.0/24"]
}

resource "google_compute_network" "gcp_vpc" {
  name                    = "vpc-gcp-main"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "gcp_sub" {
  name          = "sub-gcp-central"
  network       = google_compute_network.gcp_vpc.id
  ip_cidr_range = "10.30.1.0/24"
  region        = "us-central1"
}

resource "google_compute_instance" "gce_app" {
  name         = "gce-app-server"
  machine_type = "n2-standard-4"
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      size  = 100
      type  = "pd-ssd"
      image = "debian-cloud/debian-12"
    }
  }

  network_interface {
    network    = google_compute_network.gcp_vpc.id
    subnetwork = google_compute_subnetwork.gcp_sub.id
  }
}
`;
      const state = hclToCanvas(hcl);

      expect(state.nodes["vnet_prod"]).toBeDefined();
      expect(state.nodes["vnet_prod"]?.type).toBe("azurerm_virtual_network");
      expect(state.nodes["vnet_prod"]?.config.location).toBe("eastus");

      expect(state.nodes["sub_app"]).toBeDefined();
      expect(state.nodes["sub_app"]?.type).toBe("azurerm_subnet");

      expect(state.nodes["gcp_vpc"]).toBeDefined();
      expect(state.nodes["gcp_vpc"]?.type).toBe("google_compute_network");

      expect(state.nodes["gce_app"]).toBeDefined();
      expect(state.nodes["gce_app"]?.type).toBe("google_compute_instance");
      expect(state.nodes["gce_app"]?.config.machine_type).toBe("n2-standard-4");
      expect((state.nodes["gce_app"]?.config.boot_disk as any)?.size_gb).toBe(100);

      // Verify inter-cloud reference edge reconstruction
      const edgeAzure = Object.values(state.edges).find(
        (e: TopologyEdge) => e.source === "sub_app" && e.target === "vnet_prod"
      );
      expect(edgeAzure).toBeDefined();

      const edgeGcp = Object.values(state.edges).find(
        (e: TopologyEdge) => e.source === "gce_app" && e.target === "gcp_sub"
      );
      expect(edgeGcp).toBeDefined();
    });
  });

  describe("Round-Trip Serialization Fidelity", () => {
    test("canvas -> HCL -> canvas round-trip preserves resource properties and structure", () => {
      const originalState = createDefaultTopologyState();
      (originalState.nodes as Record<string, CloudResourceNode>)["vpc_test"] = {
        id: "vpc_test",
        type: "aws_vpc",
        name: "Test VPC",
        position: { x: 50, y: 50 },
        config: { cidr_block: "192.168.0.0/16" },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };
      (originalState.nodes as Record<string, CloudResourceNode>)["db_test"] = {
        id: "db_test",
        type: "aws_db_instance",
        name: "Test DB",
        position: { x: 100, y: 100 },
        config: { engine: "mysql", instance_class: "db.m6g.large", allocated_storage_gb: 150 },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const generatedHcl = canvasToHcl(originalState);
      const parsedState = hclToCanvas(generatedHcl);

      expect(parsedState.nodes["vpc_test"]?.config.cidr_block).toBe("192.168.0.0/16");
      expect(parsedState.nodes["db_test"]?.config.engine).toBe("mysql");
      expect(parsedState.nodes["db_test"]?.config.instance_class).toBe("db.m6g.large");
      expect(parsedState.nodes["db_test"]?.config.allocated_storage_gb).toBe(150);
    });

    test("Azure and GCP round-trip fidelity preserves configuration schemas", () => {
      const state = createDefaultTopologyState();
      (state.nodes as Record<string, CloudResourceNode>)["aks_cluster"] = {
        id: "aks_cluster",
        type: "azurerm_kubernetes_cluster",
        name: "AKS Cluster",
        position: { x: 0, y: 0 },
        config: {
          cluster_name: "prod-aks",
          location: "eastus",
          dns_prefix: "prodaks",
          kubernetes_version: "1.29",
          default_node_pool: { name: "systempool", node_count: 3, vm_size: "Standard_D4s_v5" },
        },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const hcl = canvasToHcl(state);
      const parsed = hclToCanvas(hcl);

      expect(parsed.nodes["aks_cluster"]).toBeDefined();
      expect(parsed.nodes["aks_cluster"]?.type).toBe("azurerm_kubernetes_cluster");
      expect(parsed.nodes["aks_cluster"]?.config.dns_prefix).toBe("prodaks");
      expect(parsed.nodes["aks_cluster"]?.config.kubernetes_version).toBe("1.29");
    });
  });

  describe("Live Incremental Patch Calculation (computePatchesFromHcl)", () => {
    test("computes replace patch when resource attribute in HCL is modified", () => {
      const baseState = createDefaultTopologyState();
      (baseState.nodes as Record<string, CloudResourceNode>)["ec2_srv"] = {
        id: "ec2_srv",
        type: "aws_instance",
        name: "ec2_srv",
        position: { x: 0, y: 0 },
        config: { instance_type: "t3.micro" },
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const updatedHcl = `
resource "aws_instance" "ec2_srv" {
  instance_type = "c7g.xlarge"
}
`;
      const patches = computePatchesFromHcl(baseState, updatedHcl);
      expect(patches.length).toBeGreaterThan(0);
      const replacePatch = patches.find((p) => p.path === "/nodes/ec2_srv/config/instance_type");
      expect(replacePatch).toBeDefined();
      expect(replacePatch?.op).toBe("replace");
      expect(replacePatch?.value).toBe("c7g.xlarge");
    });

    test("computes add and remove patches for added/deleted resources in HCL across clouds", () => {
      const baseState = createDefaultTopologyState();
      (baseState.nodes as Record<string, CloudResourceNode>)["to_delete"] = {
        id: "to_delete",
        type: "aws_s3_bucket",
        name: "Old Bucket",
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: "alpha", createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const newHcl = `
resource "azurerm_storage_account" "new_azure_storage" {
  name                     = "prodstorageaccount"
  location                 = "eastus"
  account_tier             = "Standard"
  account_replication_type = "LRS"
}
`;
      const patches = computePatchesFromHcl(baseState, newHcl);

      const removePatch = patches.find((p) => p.op === "remove" && p.path === "/nodes/to_delete");
      expect(removePatch).toBeDefined();

      const addPatch = patches.find((p) => p.op === "add" && p.path === "/nodes/new_azure_storage");
      expect(addPatch).toBeDefined();
      expect((addPatch?.value as any)?.type).toBe("azurerm_storage_account");
    });
  });

  describe("Fault Tolerance & Edge Cases", () => {
    test("handles empty HCL string without crashing", () => {
      const state = hclToCanvas("");
      expect(Object.keys(state.nodes).length).toBe(0);
      expect(Object.keys(state.edges).length).toBe(0);
    });

    test("handles invalid or incomplete HCL syntax gracefully", () => {
      const badHcl = "random invalid text that has no resource blocks: %$#@!";
      const state = hclToCanvas(badHcl);
      expect(state).toBeDefined();
      expect(state.version).toBe(0);
      expect(Object.keys(state.nodes).length).toBe(0);

      // Unclosed block does not crash parser
      const partialHcl = "resource \"aws_vpc\" \"partial\" {";
      const partialState = hclToCanvas(partialHcl);
      expect(partialState).toBeDefined();
    });
  });
});

