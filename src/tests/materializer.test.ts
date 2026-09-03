/**
 * Unit Tests for ProductionMaterializer — 1-Click Bundle & Artifact Exporter
 */

import {
  ProductionMaterializer,
  generateDockerfile,
  generateVariablesTf,
  generateMainTf,
  generateAuditCertificate,
  generateZipBundle,
} from '../core/export/ProductionMaterializer';
import type { CloudResourceNode, TopologyState } from '../types/topology';
import { createDefaultTopologyState } from '../types/topology';

describe('ProductionMaterializer — 1-Click Production Deployment Bundle Exporter', () => {
  let sampleState: TopologyState;

  beforeEach(() => {
    sampleState = createDefaultTopologyState();
    const nodes = sampleState.nodes as Record<string, CloudResourceNode>;

    nodes['vpc_prod'] = {
      id: 'vpc_prod',
      type: 'aws_vpc',
      name: 'Production VPC',
      position: { x: 0, y: 0 },
      config: { cidr_block: '10.0.0.0/16' },
      metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
      version: 1,
    };

    nodes['ec2_api'] = {
      id: 'ec2_api',
      type: 'aws_instance',
      name: 'API Server',
      position: { x: 100, y: 100 },
      config: { instance_type: 'c7g.large', subnet_id: 'sub_app' },
      metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
      version: 1,
    };

    nodes['rds_main'] = {
      id: 'rds_main',
      type: 'aws_db_instance',
      name: 'Main DB',
      position: { x: 200, y: 200 },
      config: { engine: 'postgres', instance_class: 'db.t4g.medium', allocated_storage_gb: 100 },
      metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
      version: 1,
    };

    nodes['s3_store'] = {
      id: 's3_store',
      type: 'aws_s3_bucket',
      name: 'Storage Bucket',
      position: { x: 300, y: 300 },
      config: { bucket_name: 'prod-media-store' },
      metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
      version: 1,
    };
  });

  describe('Multi-Stage Production Dockerfile Generation', () => {
    test('generates hardened multi-stage Dockerfile with builder and runtime stages', () => {
      const dockerfile = generateDockerfile(sampleState);

      expect(dockerfile).toContain('FROM node:20-alpine AS builder');
      expect(dockerfile).toContain('WORKDIR /app');
      expect(dockerfile).toContain('RUN npm ci --prefer-offline --no-audit');
      expect(dockerfile).toContain('RUN npm run build');

      expect(dockerfile).toContain('FROM nginx:alpine AS runtime');
      expect(dockerfile).toContain('COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html');
      expect(dockerfile).toContain('USER nginx');
      expect(dockerfile).toContain('HEALTHCHECK');
      expect(dockerfile).toContain('EXPOSE 80');
      expect(dockerfile).toContain('CMD ["nginx", "-g", "daemon off;"]');
    });

    test('supports custom node version and port options', () => {
      const customDockerfile = ProductionMaterializer.generateDockerfile(sampleState, {
        nodeVersion: '22-alpine',
        port: 8080,
      });

      expect(customDockerfile).toContain('FROM node:22-alpine AS builder');
      expect(customDockerfile).toContain('EXPOSE 8080');
      expect(customDockerfile).toContain('http://localhost:8080/');
    });
  });

  describe('Terraform Manifests Generation', () => {
    test('generateVariablesTf creates standard parameterized variables', () => {
      const vars = generateVariablesTf(sampleState);

      expect(vars).toContain('variable "aws_region"');
      expect(vars).toContain('default     = "us-east-1"');
      expect(vars).toContain('variable "environment"');
      expect(vars).toContain('variable "project_name"');
      expect(vars).toContain('variable "vpc_cidr"');
      expect(vars).toContain('variable "tags"');
    });

    test('generateMainTf includes provider block and all topology resources', () => {
      const mainTf = generateMainTf(sampleState);

      expect(mainTf).toContain('terraform {');
      expect(mainTf).toContain('required_version = ">= 1.5.0"');
      expect(mainTf).toContain('provider "aws" {');
      expect(mainTf).toContain('region = var.aws_region');

      expect(mainTf).toContain('resource "aws_vpc" "vpc_prod"');
      expect(mainTf).toContain('resource "aws_instance" "ec2_api"');
      expect(mainTf).toContain('resource "aws_db_instance" "rds_main"');
      expect(mainTf).toContain('resource "aws_s3_bucket" "s3_store"');
    });

    test('generateOutputsTf outputs IDs and endpoints for provisioned resources', () => {
      const outputsTf = ProductionMaterializer.generateOutputsTf(sampleState);

      expect(outputsTf).toContain('output "vpc_vpc_prod_id"');
      expect(outputsTf).toContain('value       = aws_vpc.vpc_prod.id');
      expect(outputsTf).toContain('output "rds_rds_main_endpoint"');
      expect(outputsTf).toContain('output "s3_s3_store_bucket_arn"');
    });

    test('generateTerraformTfvars produces valid tfvars definitions', () => {
      const tfvars = ProductionMaterializer.generateTerraformTfvars(sampleState);

      expect(tfvars).toContain('aws_region   = "us-east-1"');
      expect(tfvars).toContain('azure_location        = "eastus"');
      expect(tfvars).toContain('gcp_project_id = "cloudswarm-production"');
      expect(tfvars).toContain('environment  = "production"');
      expect(tfvars).toContain('tags = {');
    });

    test('generateMainTf dynamically includes multi-cloud providers (AWS, Azure, GCP)', () => {
      const multiCloudState = createDefaultTopologyState();
      const nodes = multiCloudState.nodes as Record<string, CloudResourceNode>;

      nodes['vpc_aws'] = {
        id: 'vpc_aws',
        type: 'aws_vpc',
        name: 'AWS VPC',
        position: { x: 0, y: 0 },
        config: { cidr_block: '10.0.0.0/16' },
        metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes['vnet_azure'] = {
        id: 'vnet_azure',
        type: 'azurerm_virtual_network',
        name: 'Azure VNet',
        position: { x: 100, y: 100 },
        config: { address_space: ['10.1.0.0/16'], location: 'eastus' },
        metadata: { createdBy: 'beta', createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes['net_gcp'] = {
        id: 'net_gcp',
        type: 'google_compute_network',
        name: 'GCP VPC',
        position: { x: 200, y: 200 },
        config: { auto_create_subnetworks: false },
        metadata: { createdBy: 'gamma', createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const mainTf = generateMainTf(multiCloudState);

      expect(mainTf).toContain('provider "aws" {');
      expect(mainTf).toContain('provider "azurerm" {');
      expect(mainTf).toContain('provider "google" {');
      expect(mainTf).toContain('source  = "hashicorp/azurerm"');
      expect(mainTf).toContain('source  = "hashicorp/google"');
      expect(mainTf).toContain('source  = "hashicorp/aws"');
      expect(mainTf).toContain('resource "aws_vpc" "vpc_aws"');
      expect(mainTf).toContain('resource "azurerm_virtual_network" "vnet_azure"');
      expect(mainTf).toContain('resource "google_compute_network" "net_gcp"');
    });

    test('generateOutputsTf extracts comprehensive multi-cloud connection attributes', () => {
      const multiCloudState = createDefaultTopologyState();
      const nodes = multiCloudState.nodes as Record<string, CloudResourceNode>;

      nodes['vm_node'] = {
        id: 'vm_node',
        type: 'azurerm_linux_virtual_machine',
        name: 'Azure VM',
        position: { x: 0, y: 0 },
        config: { vm_size: 'Standard_D4s_v5' },
        metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes['aks_node'] = {
        id: 'aks_node',
        type: 'azurerm_kubernetes_cluster',
        name: 'AKS Cluster',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes['gce_node'] = {
        id: 'gce_node',
        type: 'google_compute_instance',
        name: 'GCE Node',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      nodes['gke_node'] = {
        id: 'gke_node',
        type: 'google_container_cluster',
        name: 'GKE Cluster',
        position: { x: 0, y: 0 },
        config: {},
        metadata: { createdBy: 'alpha', createdAt: 1000, updatedAt: 1000 },
        version: 1,
      };

      const outputs = ProductionMaterializer.generateOutputsTf(multiCloudState);

      expect(outputs).toContain('output "vm_vm_node_public_ip"');
      expect(outputs).toContain('output "aks_aks_node_kube_config"');
      expect(outputs).toContain('output "gce_gce_node_nat_ip"');
      expect(outputs).toContain('output "gke_gke_node_endpoint"');
    });
  });

  describe('Certified Audit Certificate Generation', () => {
    test('generates audit summary certificate with SHA-256 cryptographic signature', () => {
      const certJson = generateAuditCertificate({
        securityScore: 98,
        totalMonthlyCostUsd: 428.25,
      });

      const parsed = JSON.parse(certJson);
      expect(parsed.certificate).toBe('CloudSwarm-SecOps-Certified-Production-Release');
      expect(parsed.score).toBe(98);
      expect(parsed.grade).toBe('A+');
      expect(parsed.monthlyCostUsd).toBe(428.25);
      expect(parsed.hourlyRunRateUsd).toBeGreaterThan(0);
      expect(parsed.sha256).toBeDefined();
      expect(parsed.sha256.length).toBe(64); // Valid SHA-256 hex string
      expect(parsed.complianceBenchmarks.length).toBeGreaterThan(0);
    });

    test('supports score grading calculation across boundary thresholds', () => {
      const certA = JSON.parse(ProductionMaterializer.generateAuditCertificate({ score: 96 }));
      expect(certA.grade).toBe('A+');

      const certB = JSON.parse(ProductionMaterializer.generateAuditCertificate({ score: 88 }));
      expect(certB.grade).toBe('A');

      const certC = JSON.parse(ProductionMaterializer.generateAuditCertificate({ score: 72 }));
      expect(certC.grade).toBe('B');

      const certD = JSON.parse(ProductionMaterializer.generateAuditCertificate({ score: 55 }));
      expect(certD.grade).toBe('C');
    });
  });

  describe('README Documentation Generator', () => {
    test('generates markdown deployment instructions with topology metrics', () => {
      const readme = ProductionMaterializer.generateReadme(sampleState, {
        securityScore: 95,
        totalMonthlyCostUsd: 428.25,
      });

      expect(readme).toContain('CloudSwarm Studio — Production Deployment Manifest');
      expect(readme).toContain('**Total Cloud Resource Primitives**: 4');
      expect(readme).toContain('**Security Compliance Score**: 95/100');
      expect(readme).toContain('**Estimated Monthly Run-Rate**: $428.25/mo');
      expect(readme).toContain('terraform init');
      expect(readme).toContain('docker build -t cloudswarm-app:latest');
      expect(readme).toContain('Azure CLI');
      expect(readme).toContain('Google Cloud SDK');
    });
  });

  describe('Full Bundle Materialization & PKZIP Archive Export', () => {
    test('materializeBundle returns dictionary containing all 8 deployment artifacts', () => {
      const bundle = ProductionMaterializer.materializeBundle(sampleState);

      const expectedFiles = [
        'main.tf',
        'variables.tf',
        'outputs.tf',
        'terraform.tfvars.example',
        'Dockerfile',
        '.dockerignore',
        'audit_certificate.json',
        'README.md',
      ];

      for (const file of expectedFiles) {
        expect(bundle[file]).toBeDefined();
        expect(bundle[file]!.length).toBeGreaterThan(0);
      }
    });

    test('generateZipBundle creates binary PKZIP archive with valid ZIP signatures', async () => {
      const zipBlob = await generateZipBundle(sampleState);

      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(500); // Non-empty archive
      expect(zipBlob.type).toBe('application/zip');

      const buffer = await zipBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Verify PKZIP local file header signature: 0x50 0x4B 0x03 0x04
      expect(bytes[0]).toBe(0x50);
      expect(bytes[1]).toBe(0x4b);
      expect(bytes[2]).toBe(0x03);
      expect(bytes[3]).toBe(0x04);
    });

    test('generateProductionZip alias produces valid PKZIP Blob', async () => {
      const zipBlob = await ProductionMaterializer.generateProductionZip(sampleState);
      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(500);
      expect(zipBlob.type).toBe('application/zip');
    });

    test('deterministic reproducibility produces identical outputs for same state', () => {
      const d1 = generateDockerfile(sampleState);
      const d2 = generateDockerfile(sampleState);
      expect(d1).toBe(d2);

      const m1 = generateMainTf(sampleState);
      const m2 = generateMainTf(sampleState);
      expect(m1).toBe(m2);

      const v1 = generateVariablesTf(sampleState);
      const v2 = generateVariablesTf(sampleState);
      expect(v1).toBe(v2);
    });
  });
});

