/**
 * Multi-Cloud Resource Catalog (AWS, Azure, GCP)
 *
 * 108 distinct cloud primitives categorized across:
 * - Compute (24 primitives: 8 AWS, 8 Azure, 8 GCP)
 * - Storage (18 primitives: 6 AWS, 6 Azure, 6 GCP)
 * - Databases & Caches (21 primitives: 7 AWS, 7 Azure, 7 GCP)
 * - Networking & CDN (21 primitives: 7 AWS, 7 Azure, 7 GCP)
 * - Security, Identity & IAM (15 primitives: 5 AWS, 5 Azure, 5 GCP)
 * - AI/ML & Analytics (9 primitives: 3 AWS, 3 Azure, 3 GCP)
 */

import type {
  CloudProvider,
  ResourceCategory,
  CloudResourceType,
} from '../../types/topology';

export interface ResourcePricingModel {
  baseMonthlyRate: number;
  hourlyRate?: number;
  unitLabel?: string;
  variablePricing?: Record<string, number>;
}

export interface ResourceValidationRule {
  field: string;
  type: 'required' | 'pattern' | 'min' | 'max' | 'enum' | 'cidr' | 'range';
  value?: unknown;
  message: string;
}

export interface ResourceCatalogItem {
  type: CloudResourceType;
  provider: CloudProvider;
  category: ResourceCategory;
  name: string;
  description: string;
  iconName: string;
  defaultConfig: Record<string, unknown>;
  pricingModel: ResourcePricingModel;
  validationRules: ResourceValidationRule[];
}

export const CLOUD_RESOURCE_CATALOG: readonly ResourceCatalogItem[] = [
  // =========================================================================
  // 1. COMPUTE PRIMITIVES (24 Total: 8 AWS, 8 Azure, 8 GCP)
  // =========================================================================

  // AWS Compute (8)
  {
    type: 'aws_instance',
    provider: 'aws',
    category: 'Compute',
    name: 'EC2 General Purpose VM',
    description: 'Amazon Elastic Compute Cloud (EC2) general-purpose virtual machine instances (t3, t4g, m6i) for balanced compute, memory, and networking workloads.',
    iconName: 'Server',
    defaultConfig: {
      instance_type: 't3.medium',
      root_volume_gb: 30,
      root_volume_type: 'gp3',
      http_tokens: 'required',
      ami: 'ami-0c55b159cbfafe1f0',
    },
    pricingModel: {
      baseMonthlyRate: 32.77,
      hourlyRate: 0.0416,
      unitLabel: '$/month',
      variablePricing: { 't3.micro': 7.59, 't3.small': 15.18, 't3.medium': 30.37, 't3.large': 60.74, 'm6i.large': 70.08, 'm6i.xlarge': 140.16 },
    },
    validationRules: [
      { field: 'instance_type', type: 'required', message: 'EC2 instance_type is required' },
      { field: 'root_volume_gb', type: 'min', value: 8, message: 'Root volume size must be at least 8 GB' },
    ],
  },
  {
    type: 'aws_instance_compute',
    provider: 'aws',
    category: 'Compute',
    name: 'EC2 Compute-Optimized VM',
    description: 'Amazon EC2 high-performance compute-optimized virtual machines (c6i, c7g) powered by modern Intel Xeon and AWS Graviton3 processors for compute-bound applications.',
    iconName: 'Cpu',
    defaultConfig: {
      instance_type: 'c6i.large',
      root_volume_gb: 50,
      root_volume_type: 'gp3',
      http_tokens: 'required',
    },
    pricingModel: {
      baseMonthlyRate: 66.05,
      hourlyRate: 0.085,
      unitLabel: '$/month',
      variablePricing: { 'c6i.large': 62.05, 'c6i.xlarge': 124.1, 'c6i.2xlarge': 248.2, 'c7g.large': 52.78, 'c7g.xlarge': 105.56 },
    },
    validationRules: [
      { field: 'instance_type', type: 'required', message: 'Compute instance_type is required' },
      { field: 'root_volume_gb', type: 'min', value: 20, message: 'Root volume must be >= 20 GB' },
    ],
  },
  {
    type: 'aws_instance_gpu',
    provider: 'aws',
    category: 'Compute',
    name: 'EC2 GPU Acceleration Cluster',
    description: 'Amazon EC2 GPU-accelerated computing instances (p4d, g5) featuring NVIDIA A100 Tensor Core and A10G GPUs for LLM training, deep learning inference, and graphics workloads.',
    iconName: 'Sparkles',
    defaultConfig: {
      instance_type: 'g5.xlarge',
      gpu_type: 'NVIDIA A10G',
      gpu_count: 1,
      root_volume_gb: 100,
      root_volume_type: 'gp3',
      http_tokens: 'required',
    },
    pricingModel: {
      baseMonthlyRate: 733.65,
      hourlyRate: 1.005,
      unitLabel: '$/month',
      variablePricing: { 'g5.xlarge': 733.65, 'g5.2xlarge': 884.76, 'g5.12xlarge': 4140.56, 'p4d.24xlarge': 23924.52 },
    },
    validationRules: [
      { field: 'instance_type', type: 'required', message: 'GPU instance_type is required' },
      { field: 'gpu_count', type: 'min', value: 1, message: 'GPU count must be at least 1' },
    ],
  },
  {
    type: 'aws_eks_cluster',
    provider: 'aws',
    category: 'Compute',
    name: 'Amazon Elastic Kubernetes Service (EKS)',
    description: 'Managed Kubernetes control plane and autoscaling worker node groups with native IAM integration, VPC CNI networking, and enterprise cluster lifecycle management.',
    iconName: 'Layers',
    defaultConfig: {
      cluster_name: 'production-eks-cluster',
      kubernetes_version: '1.29',
      endpoint_private_access: true,
      endpoint_public_access: true,
      node_groups: [
        { name: 'general-workers', instance_type: 't3.medium', desired_size: 3, min_size: 2, max_size: 6, capacity_type: 'ON_DEMAND' },
      ],
    },
    pricingModel: {
      baseMonthlyRate: 164.1,
      hourlyRate: 0.2248,
      unitLabel: '$/month',
      variablePricing: { control_plane_monthly: 73.0, worker_hourly_t3_medium: 0.0416 },
    },
    validationRules: [
      { field: 'cluster_name', type: 'required', message: 'EKS cluster_name is required' },
      { field: 'kubernetes_version', type: 'required', message: 'Kubernetes version is required' },
    ],
  },
  {
    type: 'aws_ecs_cluster',
    provider: 'aws',
    category: 'Compute',
    name: 'Amazon Elastic Container Service (ECS)',
    description: 'Fully managed container orchestration service supporting serverless AWS Fargate and EC2 launch types with fine-grained task IAM roles and service discovery.',
    iconName: 'Boxes',
    defaultConfig: {
      cluster_name: 'microservices-ecs',
      launch_type: 'FARGATE',
      cpu: 1024,
      memory_mb: 2048,
      desired_count: 2,
      container_port: 8080,
    },
    pricingModel: {
      baseMonthlyRate: 72.08,
      hourlyRate: 0.0987,
      unitLabel: '$/month',
      variablePricing: { vcpu_per_hr: 0.04048, gb_per_hr: 0.004445 },
    },
    validationRules: [
      { field: 'cluster_name', type: 'required', message: 'ECS cluster_name is required' },
      { field: 'desired_count', type: 'min', value: 1, message: 'Desired task count must be >= 1' },
    ],
  },
  {
    type: 'aws_lambda_function',
    provider: 'aws',
    category: 'Compute',
    name: 'AWS Lambda Serverless Function',
    description: 'Serverless event-driven compute engine executing code in response to triggers from HTTP requests, S3 uploads, DynamoDB streams, and EventBridge buses without managing servers.',
    iconName: 'Zap',
    defaultConfig: {
      function_name: 'api-handler',
      runtime: 'nodejs20.x',
      memory_size_mb: 512,
      timeout_seconds: 30,
      environment_variables: { NODE_ENV: 'production' },
    },
    pricingModel: {
      baseMonthlyRate: 14.6,
      hourlyRate: 0.02,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'function_name', type: 'required', message: 'Lambda function_name is required' },
      { field: 'runtime', type: 'required', message: 'Lambda runtime is required' },
    ],
  },
  {
    type: 'aws_apprunner_service',
    provider: 'aws',
    category: 'Compute',
    name: 'AWS App Runner Service',
    description: 'Fully managed container application runner that makes it easy to build, deploy, and run containerized web applications and APIs at scale with automated TLS and load balancing.',
    iconName: 'Activity',
    defaultConfig: {
      service_name: 'web-api-runner',
      cpu: 1024,
      memory_mb: 2048,
      auto_scaling: { min_size: 1, max_size: 10, max_concurrency: 100 },
    },
    pricingModel: {
      baseMonthlyRate: 43.8,
      hourlyRate: 0.06,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'service_name', type: 'required', message: 'Service name is required' },
    ],
  },
  {
    type: 'aws_batch_compute_environment',
    provider: 'aws',
    category: 'Compute',
    name: 'AWS Batch High-Throughput Cluster',
    description: 'Fully managed batch computing service dynamically provisioning optimal compute resources based on volume and specific job resource requirements.',
    iconName: 'Layers',
    defaultConfig: {
      compute_environment_name: 'batch-compute-env',
      type: 'MANAGED',
      instance_types: ['c6i.large', 'c6i.xlarge', 'm6i.large'],
      max_vcpus: 128,
      min_vcpus: 0,
      desired_vcpus: 16,
    },
    pricingModel: {
      baseMonthlyRate: 98.55,
      hourlyRate: 0.135,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'compute_environment_name', type: 'required', message: 'Compute environment name is required' },
    ],
  },

  // Azure Compute (8)
  {
    type: 'azurerm_linux_virtual_machine',
    provider: 'azure',
    category: 'Compute',
    name: 'Azure Linux General Purpose VM',
    description: 'Azure Linux Virtual Machine (Standard_B2s, Standard_D4s_v5) offering balanced vCPU and memory configurations for enterprise web tiers, microservices, and general compute.',
    iconName: 'Server',
    defaultConfig: {
      vm_size: 'Standard_D4s_v5',
      admin_username: 'azureuser',
      location: 'eastus',
      os_disk: { storage_account_type: 'Premium_LRS', disk_size_gb: 30, caching: 'ReadWrite' },
      disable_password_authentication: true,
    },
    pricingModel: {
      baseMonthlyRate: 140.16,
      hourlyRate: 0.192,
      unitLabel: '$/month',
      variablePricing: { Standard_B2s: 30.37, Standard_D2s_v5: 70.08, Standard_D4s_v5: 140.16, Standard_D8s_v5: 280.32 },
    },
    validationRules: [
      { field: 'vm_size', type: 'required', message: 'Azure vm_size is required' },
      { field: 'admin_username', type: 'required', message: 'Admin username is required' },
    ],
  },
  {
    type: 'azurerm_windows_virtual_machine',
    provider: 'azure',
    category: 'Compute',
    name: 'Azure Windows Enterprise VM',
    description: 'Azure Windows Server VM with licensed enterprise runtime, integrated Active Directory domain joining, and automated backup integration for Microsoft enterprise workloads.',
    iconName: 'Server',
    defaultConfig: {
      vm_size: 'Standard_D4s_v5',
      admin_username: 'azureadmin',
      location: 'eastus',
      os_disk: { storage_account_type: 'Premium_LRS', disk_size_gb: 128, caching: 'ReadWrite' },
    },
    pricingModel: {
      baseMonthlyRate: 233.6,
      hourlyRate: 0.32,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'vm_size', type: 'required', message: 'Windows VM size is required' },
    ],
  },
  {
    type: 'azurerm_virtual_machine_gpu',
    provider: 'azure',
    category: 'Compute',
    name: 'Azure GPU Accelerated VM',
    description: 'Azure NCv3 and NDv4 GPU series VMs powered by NVIDIA A100 Tensor Core and V100 GPUs with InfiniBand HDR interconnects for generative AI and high-performance computing.',
    iconName: 'Sparkles',
    defaultConfig: {
      vm_size: 'Standard_NC6s_v3',
      gpu_type: 'NVIDIA V100',
      gpu_count: 1,
      location: 'eastus',
      os_disk: { storage_account_type: 'Premium_LRS', disk_size_gb: 128 },
    },
    pricingModel: {
      baseMonthlyRate: 773.8,
      hourlyRate: 1.06,
      unitLabel: '$/month',
      variablePricing: { Standard_NC6s_v3: 773.8, Standard_ND96amsr_A100_v4: 19856.0 },
    },
    validationRules: [
      { field: 'vm_size', type: 'required', message: 'Azure GPU vm_size is required' },
    ],
  },
  {
    type: 'azurerm_kubernetes_cluster',
    provider: 'azure',
    category: 'Compute',
    name: 'Azure Kubernetes Service (AKS)',
    description: 'Managed Kubernetes service in Azure with free SLA control plane, automated patching, Azure CNI overlay networking, Azure AD RBAC, and system/user node pools.',
    iconName: 'Layers',
    defaultConfig: {
      cluster_name: 'production-aks-cluster',
      location: 'eastus',
      dns_prefix: 'prod-aks',
      kubernetes_version: '1.29',
      default_node_pool: { name: 'systempool', node_count: 3, vm_size: 'Standard_D4s_v5', enable_auto_scaling: true, min_count: 2, max_count: 6 },
    },
    pricingModel: {
      baseMonthlyRate: 420.48,
      hourlyRate: 0.576,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'cluster_name', type: 'required', message: 'AKS cluster_name is required' },
      { field: 'dns_prefix', type: 'required', message: 'DNS prefix is required' },
    ],
  },
  {
    type: 'azurerm_container_group',
    provider: 'azure',
    category: 'Compute',
    name: 'Azure Container Instances (ACI)',
    description: 'Fast and lightweight serverless container execution in Azure without provisioning virtual machines or managing cluster orchestrators.',
    iconName: 'Boxes',
    defaultConfig: {
      name: 'serverless-container-group',
      location: 'eastus',
      os_type: 'Linux',
      cpu: 2,
      memory_in_gb: 4,
      restart_policy: 'Always',
    },
    pricingModel: {
      baseMonthlyRate: 64.24,
      hourlyRate: 0.088,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Container group name is required' },
    ],
  },
  {
    type: 'azurerm_linux_function_app',
    provider: 'azure',
    category: 'Compute',
    name: 'Azure Functions Serverless App',
    description: 'Event-driven serverless compute platform for building reactive microservices, background task processors, and webhook handlers with Consumption or Premium plans.',
    iconName: 'Zap',
    defaultConfig: {
      name: 'functions-api-app',
      location: 'eastus',
      runtime: 'node',
      runtime_version: '20',
      https_only: true,
    },
    pricingModel: {
      baseMonthlyRate: 15.0,
      hourlyRate: 0.0205,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Function app name is required' },
    ],
  },
  {
    type: 'azurerm_app_service',
    provider: 'azure',
    category: 'Compute',
    name: 'Azure App Service Web App',
    description: 'Fully managed platform for building, deploying, and scaling enterprise web applications and REST APIs on Linux or Windows with automated scaling and custom domains.',
    iconName: 'Activity',
    defaultConfig: {
      name: 'enterprise-web-app',
      location: 'eastus',
      sku_tier: 'PremiumV3',
      sku_size: 'P1v3',
      https_only: true,
    },
    pricingModel: {
      baseMonthlyRate: 83.95,
      hourlyRate: 0.115,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'App Service name is required' },
    ],
  },
  {
    type: 'azurerm_spring_cloud_service',
    provider: 'azure',
    category: 'Compute',
    name: 'Azure Spring Apps Microservices',
    description: 'Fully managed service for Spring Boot microservices, eliminating boilerplate infrastructure with built-in service discovery, config management, and distributed tracing.',
    iconName: 'Layers',
    defaultConfig: {
      name: 'spring-cloud-platform',
      location: 'eastus',
      sku_name: 'S0',
    },
    pricingModel: {
      baseMonthlyRate: 182.5,
      hourlyRate: 0.25,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Spring Cloud service name is required' },
    ],
  },

  // GCP Compute (8)
  {
    type: 'google_compute_instance',
    provider: 'google',
    category: 'Compute',
    name: 'Google Compute Engine General VM',
    description: 'Google Cloud Compute Engine general-purpose virtual machine instances (e2-standard, n2-standard) providing balanced performance and cost efficiency across Google data centers.',
    iconName: 'Server',
    defaultConfig: {
      instance_name: 'gce-general-node',
      machine_type: 'e2-standard-4',
      zone: 'us-central1-a',
      boot_disk: { size_gb: 50, type: 'pd-balanced', image: 'debian-cloud/debian-12' },
      network_interfaces: [{ network: 'default' }],
    },
    pricingModel: {
      baseMonthlyRate: 97.82,
      hourlyRate: 0.134,
      unitLabel: '$/month',
      variablePricing: { 'e2-micro': 6.13, 'e2-small': 12.26, 'e2-medium': 24.53, 'e2-standard-2': 48.91, 'e2-standard-4': 97.82, 'n2-standard-4': 141.62 },
    },
    validationRules: [
      { field: 'machine_type', type: 'required', message: 'GCE machine_type is required' },
      { field: 'zone', type: 'required', message: 'GCE zone is required' },
    ],
  },
  {
    type: 'google_compute_instance_optimized',
    provider: 'google',
    category: 'Compute',
    name: 'GCE Compute-Optimized VM',
    description: 'Google Compute Engine C2 and C3 high-compute instances powered by Intel Xeon Platinum and Google Titanium offload architecture for high-performance computing and gaming servers.',
    iconName: 'Cpu',
    defaultConfig: {
      instance_name: 'gce-compute-node',
      machine_type: 'c2-standard-4',
      zone: 'us-central1-a',
      boot_disk: { size_gb: 50, type: 'pd-ssd' },
    },
    pricingModel: {
      baseMonthlyRate: 152.57,
      hourlyRate: 0.209,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'machine_type', type: 'required', message: 'Compute optimized machine type is required' },
    ],
  },
  {
    type: 'google_compute_instance_gpu',
    provider: 'google',
    category: 'Compute',
    name: 'GCE Accelerator-Optimized GPU VM',
    description: 'Google Compute Engine A2 and G2 accelerator-optimized instances equipped with NVIDIA A100 Tensor Core and L4 GPUs for distributed AI training and inference.',
    iconName: 'Sparkles',
    defaultConfig: {
      instance_name: 'gce-gpu-trainer',
      machine_type: 'a2-highgpu-1g',
      gpu_type: 'NVIDIA A100',
      gpu_count: 1,
      zone: 'us-central1-a',
      boot_disk: { size_gb: 100, type: 'pd-ssd' },
    },
    pricingModel: {
      baseMonthlyRate: 2682.02,
      hourlyRate: 3.674,
      unitLabel: '$/month',
      variablePricing: { 'a2-highgpu-1g': 2682.02, 'g2-standard-4': 513.92 },
    },
    validationRules: [
      { field: 'machine_type', type: 'required', message: 'GCE GPU machine_type is required' },
    ],
  },
  {
    type: 'google_container_cluster',
    provider: 'google',
    category: 'Compute',
    name: 'Google Kubernetes Engine (GKE)',
    description: 'Industry-leading managed Kubernetes service offering Standard and fully managed Autopilot operational modes with 4-way autoscaling and Google Cloud Armor integration.',
    iconName: 'Layers',
    defaultConfig: {
      cluster_name: 'production-gke-cluster',
      location: 'us-central1',
      enable_autopilot: true,
      initial_node_count: 3,
      node_config: { machine_type: 'e2-standard-4', disk_size_gb: 50, disk_type: 'pd-balanced' },
    },
    pricingModel: {
      baseMonthlyRate: 366.46,
      hourlyRate: 0.502,
      unitLabel: '$/month',
      variablePricing: { cluster_fee_monthly: 73.0, worker_monthly_e2_standard_4: 97.82 },
    },
    validationRules: [
      { field: 'cluster_name', type: 'required', message: 'GKE cluster_name is required' },
      { field: 'location', type: 'required', message: 'GKE location is required' },
    ],
  },
  {
    type: 'google_cloud_run_service',
    provider: 'google',
    category: 'Compute',
    name: 'Google Cloud Run Managed Containers',
    description: 'Fully managed serverless compute platform enabling execution of containerized applications that automatically scale from zero to thousands of instances with sub-second scale up.',
    iconName: 'Boxes',
    defaultConfig: {
      service_name: 'cloud-run-api',
      location: 'us-central1',
      template: {
        spec: {
          containers: [{ image: 'gcr.io/cloudrun/hello', resources: { limits: { cpu: '1000m', memory: '1024Mi' } } }],
          container_concurrency: 80,
        },
      },
    },
    pricingModel: {
      baseMonthlyRate: 25.0,
      hourlyRate: 0.0342,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'service_name', type: 'required', message: 'Cloud Run service name is required' },
    ],
  },
  {
    type: 'google_cloudfunctions_function',
    provider: 'google',
    category: 'Compute',
    name: 'Google Cloud Functions Serverless',
    description: 'Scalable pay-as-you-go Functions-as-a-Service (FaaS) to run code with zero server management, responding to Cloud Storage events, Pub/Sub messages, and HTTP calls.',
    iconName: 'Zap',
    defaultConfig: {
      name: 'pubsub-event-processor',
      region: 'us-central1',
      runtime: 'nodejs20',
      available_memory_mb: 512,
      timeout_seconds: 60,
    },
    pricingModel: {
      baseMonthlyRate: 12.5,
      hourlyRate: 0.0171,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Cloud Function name is required' },
    ],
  },
  {
    type: 'google_app_engine_standard_app_version',
    provider: 'google',
    category: 'Compute',
    name: 'Google App Engine Serverless PaaS',
    description: 'Fully managed Platform-as-a-Service (PaaS) to build and deploy scalable web apps and mobile backends on Google infrastructure with zero server maintenance.',
    iconName: 'Activity',
    defaultConfig: {
      service: 'default',
      runtime: 'nodejs20',
      instance_class: 'F2',
      automatic_scaling: { max_concurrent_requests: 50, min_idle_instances: 1, max_idle_instances: 5 },
    },
    pricingModel: {
      baseMonthlyRate: 58.4,
      hourlyRate: 0.08,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'service', type: 'required', message: 'App Engine service is required' },
    ],
  },
  {
    type: 'google_compute_instance_group_manager',
    provider: 'google',
    category: 'Compute',
    name: 'GCE Managed Instance Group (MIG)',
    description: 'Autoscaling Managed Instance Group across multiple zones for stateless or stateful applications with automatic healing, rolling updates, and load balancer integration.',
    iconName: 'Layers',
    defaultConfig: {
      name: 'web-tier-mig',
      zone: 'us-central1-a',
      base_instance_name: 'web-node',
      target_size: 3,
      auto_healing_policies: [{ health_check: 'http-health-check', initial_delay_sec: 300 }],
    },
    pricingModel: {
      baseMonthlyRate: 146.73,
      hourlyRate: 0.201,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'MIG name is required' },
    ],
  },

  // =========================================================================
  // 2. STORAGE PRIMITIVES (18 Total: 6 AWS, 6 Azure, 6 GCP)
  // =========================================================================

  // AWS Storage (6)
  {
    type: 'aws_s3_bucket',
    provider: 'aws',
    category: 'Storage',
    name: 'Amazon S3 Object Storage Bucket',
    description: 'Industry-leading scalable object storage with 99.999999999% (11 9s) durability, lifecycle tiering, object versioning, server-side KMS encryption, and public access blocks.',
    iconName: 'HardDrive',
    defaultConfig: {
      bucket_name: 'cloudswarm-assets-prod',
      versioning_enabled: true,
      encryption: { sse_algorithm: 'aws:kms', kms_key_id: 'alias/aws/s3' },
      block_public_access: { block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true },
      enforce_ssl_tls_requests: true,
      estimated_storage_gb: 100,
    },
    pricingModel: {
      baseMonthlyRate: 2.3,
      hourlyRate: 0.00315,
      unitLabel: '$/GB-month',
      variablePricing: { standard_gb: 0.023, infrequent_access_gb: 0.0125, glacier_flexible_gb: 0.0036 },
    },
    validationRules: [
      { field: 'bucket_name', type: 'required', message: 'S3 bucket_name is required' },
    ],
  },
  {
    type: 'aws_ebs_volume',
    provider: 'aws',
    category: 'Storage',
    name: 'Amazon EBS Block Storage Volume',
    description: 'High-performance Elastic Block Store (EBS) volumes (gp3, io2) for transaction-heavy database workloads and EC2 root/data storage with independent IOPS and throughput tuning.',
    iconName: 'HardDrive',
    defaultConfig: {
      volume_type: 'gp3',
      size_gb: 100,
      iops: 3000,
      throughput_mbps: 125,
      encrypted: true,
      availability_zone: 'us-east-1a',
    },
    pricingModel: {
      baseMonthlyRate: 8.0,
      hourlyRate: 0.0109,
      unitLabel: '$/month',
      variablePricing: { gp3_per_gb: 0.08, gp2_per_gb: 0.1, io2_per_gb: 0.125, io2_iops: 0.065 },
    },
    validationRules: [
      { field: 'size_gb', type: 'min', value: 1, message: 'EBS volume size must be >= 1 GB' },
    ],
  },
  {
    type: 'aws_efs_file_system',
    provider: 'aws',
    category: 'Storage',
    name: 'Amazon EFS Elastic File System',
    description: 'Serverless, fully elastic NFS file storage designed to provide shared file access across thousands of EC2 instances, EKS pods, and Lambda functions concurrently.',
    iconName: 'FolderArchive',
    defaultConfig: {
      creation_token: 'efs-shared-storage',
      performance_mode: 'generalPurpose',
      throughput_mode: 'bursting',
      encrypted: true,
    },
    pricingModel: {
      baseMonthlyRate: 30.0,
      hourlyRate: 0.0411,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'creation_token', type: 'required', message: 'Creation token is required' },
    ],
  },
  {
    type: 'aws_glacier_vault',
    provider: 'aws',
    category: 'Storage',
    name: 'Amazon S3 Glacier Archive Vault',
    description: 'Ultra low-cost secure archive storage for long-term compliance retention, data lakes, and disaster recovery archives with configurable retrieval policies.',
    iconName: 'FolderArchive',
    defaultConfig: {
      name: 'compliance-audit-vault',
    },
    pricingModel: {
      baseMonthlyRate: 3.6,
      hourlyRate: 0.0049,
      unitLabel: '$/TB-month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Glacier vault name is required' },
    ],
  },
  {
    type: 'aws_fsx_lustre_file_system',
    provider: 'aws',
    category: 'Storage',
    name: 'Amazon FSx for Lustre Parallel Storage',
    description: 'High-performance shared parallel file system optimized for compute-intensive workloads such as machine learning training, HPC, and video processing.',
    iconName: 'HardDrive',
    defaultConfig: {
      storage_capacity_gb: 1200,
      deployment_type: 'PERSISTENT_2',
      per_unit_storage_throughput: 250,
    },
    pricingModel: {
      baseMonthlyRate: 168.0,
      hourlyRate: 0.23,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'storage_capacity_gb', type: 'min', value: 1200, message: 'Minimum capacity is 1200 GB' },
    ],
  },
  {
    type: 'aws_backup_vault',
    provider: 'aws',
    category: 'Storage',
    name: 'AWS Backup Centralized Vault',
    description: 'Centralized policy-based backup service to automate data protection across AWS storage, databases, and compute primitives with immutable WORM Vault Lock.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'enterprise-backup-vault',
      kms_key_arn: 'alias/aws/backup',
    },
    pricingModel: {
      baseMonthlyRate: 5.0,
      hourlyRate: 0.0068,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Backup vault name is required' },
    ],
  },

  // Azure Storage (6)
  {
    type: 'azurerm_storage_account',
    provider: 'azure',
    category: 'Storage',
    name: 'Azure Storage Account',
    description: 'Unified storage service providing highly available Blob, Data Lake Gen2, File, Queue, and Table storage with customer-managed keys and zero-trust firewall endpoints.',
    iconName: 'HardDrive',
    defaultConfig: {
      account_name: 'prodstorageacct2026',
      location: 'eastus',
      account_tier: 'Standard',
      account_replication_type: 'LRS',
      enable_https_traffic_only: true,
      min_tls_version: 'TLS1_2',
      allow_nested_items_to_be_public: false,
    },
    pricingModel: {
      baseMonthlyRate: 2.08,
      hourlyRate: 0.00285,
      unitLabel: '$/GB-month',
      variablePricing: { hot_gb: 0.0208, cool_gb: 0.01, archive_gb: 0.002 },
    },
    validationRules: [
      { field: 'account_name', type: 'required', message: 'Storage account name is required' },
      { field: 'account_tier', type: 'required', message: 'Account tier is required' },
    ],
  },
  {
    type: 'azurerm_storage_container',
    provider: 'azure',
    category: 'Storage',
    name: 'Azure Blob Storage Container',
    description: 'Scalable object store for massive unstructured datasets, video media streaming, and machine learning corpora with Hot, Cool, and Archive tier policies.',
    iconName: 'HardDrive',
    defaultConfig: {
      name: 'app-media-container',
      container_access_type: 'private',
    },
    pricingModel: {
      baseMonthlyRate: 2.08,
      hourlyRate: 0.00285,
      unitLabel: '$/100GB-month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Container name is required' },
    ],
  },
  {
    type: 'azurerm_managed_disk',
    provider: 'azure',
    category: 'Storage',
    name: 'Azure Managed Disk',
    description: 'Block-level storage volumes for Azure VMs offering Standard HDD, Standard SSD, Premium SSD, and Ultra Disks with built-in SSE encryption and snapshot replication.',
    iconName: 'HardDrive',
    defaultConfig: {
      name: 'vm-data-disk-01',
      location: 'eastus',
      storage_account_type: 'Premium_LRS',
      disk_size_gb: 128,
      create_option: 'Empty',
    },
    pricingModel: {
      baseMonthlyRate: 19.71,
      hourlyRate: 0.027,
      unitLabel: '$/month',
      variablePricing: { Standard_LRS: 5.89, Premium_LRS: 19.71, UltraSSD_LRS: 45.2 },
    },
    validationRules: [
      { field: 'disk_size_gb', type: 'min', value: 32, message: 'Managed disk size must be >= 32 GB' },
    ],
  },
  {
    type: 'azurerm_storage_share',
    provider: 'azure',
    category: 'Storage',
    name: 'Azure Files Managed SMB/NFS Share',
    description: 'Fully managed enterprise cloud file shares accessible via SMB 3.0 and NFS 4.1 protocols with cross-platform mounting on Windows, Linux, and macOS.',
    iconName: 'FolderArchive',
    defaultConfig: {
      name: 'shared-data-share',
      quota_in_gb: 500,
      enabled_protocol: 'SMB',
    },
    pricingModel: {
      baseMonthlyRate: 30.0,
      hourlyRate: 0.0411,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Share name is required' },
    ],
  },
  {
    type: 'azurerm_data_lake_storage_gen2',
    provider: 'azure',
    category: 'Storage',
    name: 'Azure Data Lake Storage Gen2',
    description: 'High-performance analytics storage engine combining the cost advantages of object storage with a hierarchical namespace and POSIX access control lists.',
    iconName: 'Database',
    defaultConfig: {
      name: 'enterprise-datalake',
      is_hns_enabled: true,
    },
    pricingModel: {
      baseMonthlyRate: 20.0,
      hourlyRate: 0.0274,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Data Lake name is required' },
    ],
  },
  {
    type: 'azurerm_backup_vault',
    provider: 'azure',
    category: 'Storage',
    name: 'Azure Recovery Services / Backup Vault',
    description: 'Enterprise backup and disaster recovery vault protecting Azure VMs, Azure SQL databases, and SAP HANA workloads with automated retention policies.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'recovery-services-vault',
      location: 'eastus',
      sku: 'Standard',
      soft_delete_enabled: true,
    },
    pricingModel: {
      baseMonthlyRate: 10.0,
      hourlyRate: 0.0137,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Vault name is required' },
    ],
  },

  // GCP Storage (6)
  {
    type: 'google_storage_bucket',
    provider: 'google',
    category: 'Storage',
    name: 'Google Cloud Storage Bucket',
    description: 'Global object storage featuring high availability, uniform bucket-level access, Customer-Managed Encryption Keys (CMEK), and automated lifecycle transition rules.',
    iconName: 'HardDrive',
    defaultConfig: {
      bucket_name: 'gcp-production-data-lake',
      location: 'US',
      storage_class: 'STANDARD',
      uniform_bucket_level_access: true,
      versioning: { enabled: true },
      estimated_storage_gb: 100,
    },
    pricingModel: {
      baseMonthlyRate: 2.0,
      hourlyRate: 0.00274,
      unitLabel: '$/GB-month',
      variablePricing: { standard_gb: 0.02, nearline_gb: 0.01, coldline_gb: 0.004, archive_gb: 0.0012 },
    },
    validationRules: [
      { field: 'bucket_name', type: 'required', message: 'GCS bucket_name is required' },
    ],
  },
  {
    type: 'google_compute_disk',
    provider: 'google',
    category: 'Storage',
    name: 'Google Persistent Disk',
    description: 'Reliable network block storage for Google Compute Engine instances (Standard, Balanced, SSD, Extreme) with independent capacity and performance scaling.',
    iconName: 'HardDrive',
    defaultConfig: {
      name: 'gce-app-disk-01',
      zone: 'us-central1-a',
      type: 'pd-balanced',
      size_gb: 100,
    },
    pricingModel: {
      baseMonthlyRate: 10.0,
      hourlyRate: 0.0137,
      unitLabel: '$/month',
      variablePricing: { 'pd-standard': 0.04, 'pd-balanced': 0.1, 'pd-ssd': 0.17, 'pd-extreme': 0.25 },
    },
    validationRules: [
      { field: 'size_gb', type: 'min', value: 10, message: 'Persistent disk size must be >= 10 GB' },
    ],
  },
  {
    type: 'google_filestore_instance',
    provider: 'google',
    category: 'Storage',
    name: 'Google Cloud Filestore Managed NFS',
    description: 'Fully managed NFS file servers on Google Cloud for applications running on Compute Engine VMs and GKE clusters requiring low latency file operations.',
    iconName: 'FolderArchive',
    defaultConfig: {
      name: 'filestore-nfs-share',
      location: 'us-central1-a',
      tier: 'BASIC_HDD',
      file_shares: [{ capacity_gb: 1024, name: 'share1' }],
    },
    pricingModel: {
      baseMonthlyRate: 204.8,
      hourlyRate: 0.28,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Filestore instance name is required' },
    ],
  },
  {
    type: 'google_storage_bucket_archive',
    provider: 'google',
    category: 'Storage',
    name: 'Cloud Storage Archive Cold Storage',
    description: 'Ultra-low cost Google Cloud Storage archive tier providing long-term data preservation for cold disaster recovery backups and regulatory compliance data.',
    iconName: 'FolderArchive',
    defaultConfig: {
      bucket_name: 'gcp-archive-cold-storage',
      location: 'US',
      storage_class: 'ARCHIVE',
      uniform_bucket_level_access: true,
    },
    pricingModel: {
      baseMonthlyRate: 1.2,
      hourlyRate: 0.00164,
      unitLabel: '$/TB-month',
    },
    validationRules: [
      { field: 'bucket_name', type: 'required', message: 'Bucket name is required' },
    ],
  },
  {
    type: 'google_compute_region_disk',
    provider: 'google',
    category: 'Storage',
    name: 'Google Regional Persistent Disk',
    description: 'Synchronous replication of persistent block storage across two zones in the same region, ensuring zero data loss and automated failover for critical applications.',
    iconName: 'HardDrive',
    defaultConfig: {
      name: 'ha-regional-disk',
      region: 'us-central1',
      replica_zones: ['us-central1-a', 'us-central1-b'],
      type: 'pd-ssd',
      size_gb: 200,
    },
    pricingModel: {
      baseMonthlyRate: 68.0,
      hourlyRate: 0.0932,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'size_gb', type: 'min', value: 20, message: 'Regional disk size must be >= 20 GB' },
    ],
  },
  {
    type: 'google_backup_dr_management_server',
    provider: 'google',
    category: 'Storage',
    name: 'Google Backup and DR Service',
    description: 'Centralized management server for centralized backup, disaster recovery, and ransomware protection across Google Cloud compute, databases, and storage.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'central-backup-dr',
      location: 'us-central1',
      type: 'MANAGEMENT_SERVER',
    },
    pricingModel: {
      baseMonthlyRate: 15.0,
      hourlyRate: 0.0205,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Backup service name is required' },
    ],
  },

  // =========================================================================
  // 3. DATABASE & IN-MEMORY CACHE PRIMITIVES (21 Total: 7 AWS, 7 Azure, 7 GCP)
  // =========================================================================

  // AWS Databases (7)
  {
    type: 'aws_db_instance',
    provider: 'aws',
    category: 'Database',
    name: 'Amazon RDS Relational Database',
    description: 'Managed relational database engine (PostgreSQL, MySQL, MariaDB) with automated backups, Multi-AZ high-availability failover, and storage auto-scaling.',
    iconName: 'Database',
    defaultConfig: {
      engine: 'postgres',
      engine_version: '16.1',
      instance_class: 'db.t4g.medium',
      allocated_storage_gb: 50,
      storage_type: 'gp3',
      multi_az: true,
      storage_encrypted: true,
      kms_key_id: 'alias/aws/rds',
      publicly_accessible: false,
    },
    pricingModel: {
      baseMonthlyRate: 118.08,
      hourlyRate: 0.1617,
      unitLabel: '$/month',
      variablePricing: { 'db.t4g.micro': 13.14, 'db.t4g.medium': 53.29, 'db.m6g.large': 132.86, 'db.r6g.large': 175.2, 'db.r6g.xlarge': 350.4 },
    },
    validationRules: [
      { field: 'engine', type: 'required', message: 'RDS engine is required' },
      { field: 'instance_class', type: 'required', message: 'RDS instance_class is required' },
      { field: 'allocated_storage_gb', type: 'min', value: 20, message: 'Storage must be >= 20 GB' },
    ],
  },
  {
    type: 'aws_rds_cluster',
    provider: 'aws',
    category: 'Database',
    name: 'Amazon Aurora Global Database Cluster',
    description: 'High-performance cloud-native MySQL and PostgreSQL compatible database delivering up to 5x throughput with distributed 6-way storage and Serverless v2 instant autoscaling.',
    iconName: 'Database',
    defaultConfig: {
      cluster_identifier: 'aurora-prod-cluster',
      engine: 'aurora-postgresql',
      engine_version: '15.4',
      database_name: 'appdb',
      serverlessv2_scaling_configuration: { min_capacity: 0.5, max_capacity: 16 },
      storage_encrypted: true,
    },
    pricingModel: {
      baseMonthlyRate: 180.5,
      hourlyRate: 0.247,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'cluster_identifier', type: 'required', message: 'Cluster identifier is required' },
    ],
  },
  {
    type: 'aws_dynamodb_table',
    provider: 'aws',
    category: 'Database',
    name: 'Amazon DynamoDB Serverless NoSQL',
    description: 'Fully managed serverless key-value and document NoSQL database delivering single-digit millisecond latency at any scale with global tables and continuous backups.',
    iconName: 'Database',
    defaultConfig: {
      name: 'application_state_table',
      billing_mode: 'PAY_PER_REQUEST',
      hash_key: 'pk',
      range_key: 'sk',
      server_side_encryption: { enabled: true },
      point_in_time_recovery: { enabled: true },
    },
    pricingModel: {
      baseMonthlyRate: 15.0,
      hourlyRate: 0.0205,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'DynamoDB table name is required' },
      { field: 'hash_key', type: 'required', message: 'Hash key is required' },
    ],
  },
  {
    type: 'aws_elasticache_cluster',
    provider: 'aws',
    category: 'Database',
    name: 'Amazon ElastiCache Redis In-Memory Cache',
    description: 'Ultra-fast sub-millisecond in-memory data store and caching service compatible with Redis and Memcached for session management, leaderboards, and caching layers.',
    iconName: 'Zap',
    defaultConfig: {
      cluster_id: 'redis-cache-cluster',
      engine: 'redis',
      node_type: 'cache.t4g.medium',
      num_cache_nodes: 2,
      transit_encryption_enabled: true,
      at_rest_encryption_enabled: true,
    },
    pricingModel: {
      baseMonthlyRate: 99.28,
      hourlyRate: 0.136,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'cluster_id', type: 'required', message: 'Cluster ID is required' },
    ],
  },
  {
    type: 'aws_redshift_cluster',
    provider: 'aws',
    category: 'Database',
    name: 'Amazon Redshift Cloud Data Warehouse',
    description: 'Petabyte-scale cloud data warehouse utilizing columnar storage, massively parallel processing (MPP), and automated machine learning for SQL analytics.',
    iconName: 'Database',
    defaultConfig: {
      cluster_identifier: 'analytics-dw-cluster',
      node_type: 'ra3.xlplus',
      number_of_nodes: 2,
      encrypted: true,
    },
    pricingModel: {
      baseMonthlyRate: 1585.56,
      hourlyRate: 2.172,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'cluster_identifier', type: 'required', message: 'Cluster identifier is required' },
    ],
  },
  {
    type: 'aws_neptune_cluster',
    provider: 'aws',
    category: 'Database',
    name: 'Amazon Neptune Graph Database',
    description: 'Fast, reliable fully managed graph database engine optimized for storing billions of relationships and querying graphs with open APIs (Gremlin, SPARQL, openCypher).',
    iconName: 'Network',
    defaultConfig: {
      cluster_identifier: 'social-graph-cluster',
      engine: 'neptune',
      instance_class: 'db.r6g.large',
      storage_encrypted: true,
    },
    pricingModel: {
      baseMonthlyRate: 262.8,
      hourlyRate: 0.36,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'cluster_identifier', type: 'required', message: 'Cluster identifier is required' },
    ],
  },
  {
    type: 'aws_opensearch_domain',
    provider: 'aws',
    category: 'Database',
    name: 'Amazon OpenSearch Managed Analytics',
    description: 'Managed search and log analytics suite supporting real-time full-text search, observability log ingestion, and OpenSearch vector database embeddings.',
    iconName: 'Activity',
    defaultConfig: {
      domain_name: 'log-analytics-domain',
      engine_version: 'OpenSearch_2.11',
      cluster_config: { instance_type: 'r6g.large.search', instance_count: 2, dedicated_master_enabled: false },
      node_to_node_encryption: { enabled: true },
      encrypt_at_rest: { enabled: true },
    },
    pricingModel: {
      baseMonthlyRate: 284.7,
      hourlyRate: 0.39,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'domain_name', type: 'required', message: 'Domain name is required' },
    ],
  },

  // Azure Databases (7)
  {
    type: 'azurerm_mssql_database',
    provider: 'azure',
    category: 'Database',
    name: 'Azure SQL Database Hyperscale',
    description: 'Fully managed relational Microsoft SQL database with automated performance tuning, Hyperscale rapid storage scaling, and built-in geo-redundant high availability.',
    iconName: 'Database',
    defaultConfig: {
      server_name: 'prod-sql-server-2026',
      database_name: 'ProductionAppDb',
      location: 'eastus',
      sku_name: 'GP_Gen5_4',
      max_size_gb: 250,
      geo_redundant_backup: true,
      transparent_data_encryption_enabled: true,
    },
    pricingModel: {
      baseMonthlyRate: 292.0,
      hourlyRate: 0.4,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'database_name', type: 'required', message: 'Database name is required' },
    ],
  },
  {
    type: 'azurerm_postgresql_flexible_server',
    provider: 'azure',
    category: 'Database',
    name: 'Azure Database for PostgreSQL Flexible',
    description: 'Fully managed PostgreSQL server with granular server configuration tuning, zone-redundant high availability, and built-in PgBouncer connection pooling.',
    iconName: 'Database',
    defaultConfig: {
      name: 'pg-flexible-prod',
      location: 'eastus',
      version: '16',
      sku_name: 'GP_Standard_D4ds_v5',
      storage_mb: 131072,
      zone_redundant_ha: true,
    },
    pricingModel: {
      baseMonthlyRate: 248.2,
      hourlyRate: 0.34,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Server name is required' },
    ],
  },
  {
    type: 'azurerm_cosmosdb_account',
    provider: 'azure',
    category: 'Database',
    name: 'Azure Cosmos DB Multi-Model NoSQL',
    description: 'Globally distributed multi-model NoSQL database service guaranteeing sub-10ms latencies with multi-region active-active writes and flexible consistency models.',
    iconName: 'Database',
    defaultConfig: {
      name: 'global-cosmos-account',
      location: 'eastus',
      offer_type: 'Standard',
      kind: 'GlobalDocumentDB',
      consistency_policy: { consistency_level: 'Session' },
      enable_automatic_failover: true,
    },
    pricingModel: {
      baseMonthlyRate: 120.0,
      hourlyRate: 0.164,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Cosmos account name is required' },
    ],
  },
  {
    type: 'azurerm_redis_cache',
    provider: 'azure',
    category: 'Database',
    name: 'Azure Cache for Redis Enterprise',
    description: 'High-throughput enterprise in-memory data store powered by open-source Redis with clustering, persistence, active geo-replication, and Redis modules.',
    iconName: 'Zap',
    defaultConfig: {
      name: 'app-redis-cache',
      location: 'eastus',
      capacity: 2,
      family: 'P',
      sku_name: 'Premium',
      enable_non_ssl_port: false,
    },
    pricingModel: {
      baseMonthlyRate: 167.9,
      hourlyRate: 0.23,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Redis cache name is required' },
    ],
  },
  {
    type: 'azurerm_synapse_workspace',
    provider: 'azure',
    category: 'Database',
    name: 'Azure Synapse Analytics Data Warehouse',
    description: 'Unified enterprise analytics service bringing together big data analytics, dedicated SQL pools, Apache Spark engines, and automated data integration pipelines.',
    iconName: 'Database',
    defaultConfig: {
      name: 'synapse-analytics-ws',
      location: 'eastus',
      sql_pool_sku: 'DW500c',
    },
    pricingModel: {
      baseMonthlyRate: 1095.0,
      hourlyRate: 1.5,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Workspace name is required' },
    ],
  },
  {
    type: 'azurerm_kusto_cluster',
    provider: 'azure',
    category: 'Database',
    name: 'Azure Data Explorer (Kusto) Cluster',
    description: 'Fast and highly scalable data analytics service for real-time telemetry streaming ingestion, log diagnostics, and time-series time analytics queries.',
    iconName: 'Activity',
    defaultConfig: {
      name: 'telemetry-kusto-cluster',
      location: 'eastus',
      sku: { name: 'Standard_E8as_v5', capacity: 2 },
    },
    pricingModel: {
      baseMonthlyRate: 584.0,
      hourlyRate: 0.8,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Kusto cluster name is required' },
    ],
  },
  {
    type: 'azurerm_mariadb_server',
    provider: 'azure',
    category: 'Database',
    name: 'Azure Database for MariaDB Managed',
    description: 'Fully managed enterprise MariaDB community edition database with automated patching, high availability SLA, and encrypted backups.',
    iconName: 'Database',
    defaultConfig: {
      name: 'mariadb-managed-server',
      location: 'eastus',
      sku_name: 'GP_Gen5_4',
      storage_mb: 51200,
    },
    pricingModel: {
      baseMonthlyRate: 146.0,
      hourlyRate: 0.2,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Server name is required' },
    ],
  },

  // GCP Databases (7)
  {
    type: 'google_sql_database_instance',
    provider: 'google',
    category: 'Database',
    name: 'Google Cloud SQL PostgreSQL/MySQL',
    description: 'Fully managed relational database service for PostgreSQL, MySQL, and SQL Server with automated high availability replication, automatic storage increase, and encryption.',
    iconName: 'Database',
    defaultConfig: {
      instance_name: 'cloudsql-postgres-prod',
      database_version: 'POSTGRES_15',
      region: 'us-central1',
      tier: 'db-custom-4-16384',
      disk_size: 100,
      disk_type: 'PD_SSD',
      availability_type: 'REGIONAL',
      backup_configuration: { enabled: true, point_in_time_recovery_enabled: true },
      ip_configuration: { require_ssl: true, ipv4_enabled: false },
    },
    pricingModel: {
      baseMonthlyRate: 219.0,
      hourlyRate: 0.3,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'instance_name', type: 'required', message: 'Instance name is required' },
      { field: 'tier', type: 'required', message: 'Database tier is required' },
    ],
  },
  {
    type: 'google_spanner_instance',
    provider: 'google',
    category: 'Database',
    name: 'Google Cloud Spanner Global Database',
    description: 'Globally distributed, mission-critical relational database combining the benefits of relational database structure with non-relational horizontal scale and ACID transactions.',
    iconName: 'Database',
    defaultConfig: {
      name: 'global-spanner-instance',
      config: 'regional-us-central1',
      num_nodes: 1,
      display_name: 'Global Production Spanner',
    },
    pricingModel: {
      baseMonthlyRate: 657.0,
      hourlyRate: 0.9,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Spanner instance name is required' },
    ],
  },
  {
    type: 'google_firestore_database',
    provider: 'google',
    category: 'Database',
    name: 'Google Cloud Firestore Serverless NoSQL',
    description: 'Serverless, cloud-native document database with live synchronization, offline data support, multi-region replication, and automatic horizontal scaling.',
    iconName: 'Database',
    defaultConfig: {
      name: '(default)',
      location_id: 'nam5',
      type: 'FIRESTORE_NATIVE',
    },
    pricingModel: {
      baseMonthlyRate: 15.0,
      hourlyRate: 0.0205,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Firestore database name is required' },
    ],
  },
  {
    type: 'google_bigtable_instance',
    provider: 'google',
    category: 'Database',
    name: 'Google Cloud Bigtable Low-Latency NoSQL',
    description: 'Enterprise NoSQL database service for large operational and analytical workloads requiring high throughput with sub-millisecond response times.',
    iconName: 'Database',
    defaultConfig: {
      name: 'iot-telemetry-bigtable',
      cluster: [{ cluster_id: 'bigtable-c1', num_nodes: 3, storage_type: 'SSD', zone: 'us-central1-a' }],
    },
    pricingModel: {
      baseMonthlyRate: 1423.5,
      hourlyRate: 1.95,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Bigtable instance name is required' },
    ],
  },
  {
    type: 'google_redis_instance',
    provider: 'google',
    category: 'Database',
    name: 'Google Cloud Memorystore for Redis',
    description: 'Fully managed in-memory data store service for Redis delivering 99.9% availability, zero-downtime scaling, and automated failover in Standard Tier.',
    iconName: 'Zap',
    defaultConfig: {
      name: 'memorystore-redis',
      tier: 'STANDARD_HA',
      memory_size_gb: 5,
      region: 'us-central1',
      auth_enabled: true,
      transit_encryption_mode: 'SERVER_AUTHENTICATION',
    },
    pricingModel: {
      baseMonthlyRate: 178.85,
      hourlyRate: 0.245,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Memorystore instance name is required' },
    ],
  },
  {
    type: 'google_bigquery_dataset',
    provider: 'google',
    category: 'Database',
    name: 'Google BigQuery Serverless Data Warehouse',
    description: 'Serverless, cost-effective multicloud enterprise data warehouse designed for business agility with built-in machine learning and geospatial analysis.',
    iconName: 'Database',
    defaultConfig: {
      dataset_id: 'enterprise_bi_analytics',
      location: 'US',
      default_table_expiration_ms: 7776000000,
    },
    pricingModel: {
      baseMonthlyRate: 20.0,
      hourlyRate: 0.0274,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'dataset_id', type: 'required', message: 'Dataset ID is required' },
    ],
  },
  {
    type: 'google_alloydb_cluster',
    provider: 'google',
    category: 'Database',
    name: 'Google AlloyDB for PostgreSQL',
    description: 'Fully managed, PostgreSQL-compatible database service designed for enterprise database workloads with 4x faster transactional throughput and 100x faster analytical queries.',
    iconName: 'Database',
    defaultConfig: {
      cluster_id: 'alloydb-prod-cluster',
      location: 'us-central1',
      initial_user: { password: 'ChangeMeInVault123!' },
    },
    pricingModel: {
      baseMonthlyRate: 350.4,
      hourlyRate: 0.48,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'cluster_id', type: 'required', message: 'Cluster ID is required' },
    ],
  },

  // =========================================================================
  // 4. NETWORKING & CDN PRIMITIVES (21 Total: 7 AWS, 7 Azure, 7 GCP)
  // =========================================================================

  // AWS Networking (7)
  {
    type: 'aws_vpc',
    provider: 'aws',
    category: 'Network',
    name: 'Amazon Virtual Private Cloud (VPC)',
    description: 'Isolated virtual network fabric in AWS with full control over IP address ranges, subnets, route tables, and network gateway connectivity.',
    iconName: 'Globe',
    defaultConfig: {
      cidr_block: '10.0.0.0/16',
      enable_dns_hostnames: true,
      enable_dns_support: true,
      instance_tenancy: 'default',
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'cidr_block', type: 'cidr', message: 'Valid IPv4 CIDR block required (e.g. 10.0.0.0/16)' },
    ],
  },
  {
    type: 'aws_subnet',
    provider: 'aws',
    category: 'Network',
    name: 'Amazon VPC Subnet Tier',
    description: 'Availability zone partition of a VPC CIDR block for public ingress tiers, private application services, and isolated database subnets.',
    iconName: 'Network',
    defaultConfig: {
      vpc_id: 'vpc-main',
      cidr_block: '10.0.1.0/24',
      availability_zone: 'us-east-1a',
      is_public: true,
      map_public_ip_on_launch: true,
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'cidr_block', type: 'cidr', message: 'Valid subnet CIDR block required' },
      { field: 'availability_zone', type: 'required', message: 'Availability zone is required' },
    ],
  },
  {
    type: 'aws_lb',
    provider: 'aws',
    category: 'Network',
    name: 'AWS Application / Network Load Balancer',
    description: 'Elastic Load Balancing (ALB/NLB) automatically distributing incoming application traffic across multiple EC2 targets, EKS pods, and IP destinations.',
    iconName: 'Radio',
    defaultConfig: {
      name: 'prod-ingress-alb',
      internal: false,
      load_balancer_type: 'application',
      subnet_ids: ['subnet-1', 'subnet-2'],
      listeners: [{ port: 443, protocol: 'HTTPS', ssl_policy: 'ELBSecurityPolicy-TLS13-1-2-2021-06' }],
    },
    pricingModel: {
      baseMonthlyRate: 16.2,
      hourlyRate: 0.0225,
      unitLabel: '$/month + LCU',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Load balancer name is required' },
    ],
  },
  {
    type: 'aws_nat_gateway',
    provider: 'aws',
    category: 'Network',
    name: 'AWS Managed NAT Gateway',
    description: 'Highly available managed Network Address Translation (NAT) gateway enabling private subnet instances to access the internet securely without receiving inbound traffic.',
    iconName: 'Network',
    defaultConfig: {
      connectivity_type: 'public',
      allocation_id: 'eipalloc-12345678',
      subnet_id: 'subnet-public-1',
    },
    pricingModel: {
      baseMonthlyRate: 32.85,
      hourlyRate: 0.045,
      unitLabel: '$/month + data',
    },
    validationRules: [
      { field: 'subnet_id', type: 'required', message: 'Public subnet ID is required' },
    ],
  },
  {
    type: 'aws_internet_gateway',
    provider: 'aws',
    category: 'Network',
    name: 'AWS VPC Internet Gateway',
    description: 'Horizontally scaled, redundant VPC component that allows direct communication between your VPC resources and the public internet.',
    iconName: 'Globe',
    defaultConfig: {
      vpc_id: 'vpc-main',
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'vpc_id', type: 'required', message: 'VPC ID is required' },
    ],
  },
  {
    type: 'aws_ec2_transit_gateway',
    provider: 'aws',
    category: 'Network',
    name: 'AWS Transit Gateway Hub Router',
    description: 'Central hub that connects hundreds of Amazon VPCs and on-premises networks through a single gateway with centralized routing and transit encryption.',
    iconName: 'Network',
    defaultConfig: {
      description: 'Central transit gateway hub',
      auto_accept_shared_attachments: 'enable',
      default_route_table_association: 'enable',
    },
    pricingModel: {
      baseMonthlyRate: 36.5,
      hourlyRate: 0.05,
      unitLabel: '$/month + data',
    },
    validationRules: [
      { field: 'description', type: 'required', message: 'Description is required' },
    ],
  },
  {
    type: 'aws_cloudfront_distribution',
    provider: 'aws',
    category: 'Network',
    name: 'Amazon CloudFront Global Edge CDN',
    description: 'Low-latency Content Delivery Network (CDN) with 450+ Points of Presence worldwide, automatic DDoS mitigation via AWS Shield, and edge compute functions.',
    iconName: 'Globe',
    defaultConfig: {
      enabled: true,
      price_class: 'PriceClass_100',
      viewer_certificate: { cloudfront_default_certificate: true, minimum_protocol_version: 'TLSv1.2_2021' },
      restrictions: { geo_restriction: { restriction_type: 'none' } },
    },
    pricingModel: {
      baseMonthlyRate: 15.0,
      hourlyRate: 0.0205,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'enabled', type: 'required', message: 'Enabled flag is required' },
    ],
  },

  // Azure Networking (7)
  {
    type: 'azurerm_virtual_network',
    provider: 'azure',
    category: 'Network',
    name: 'Azure Virtual Network (VNet)',
    description: 'Fundamental building block for private network isolation in Azure with custom IP address spaces, subnet segmentation, route tables, and peering links.',
    iconName: 'Globe',
    defaultConfig: {
      name: 'production-vnet-eastus',
      address_space: ['10.100.0.0/16'],
      location: 'eastus',
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'VNet name is required' },
      { field: 'address_space', type: 'required', message: 'Address space is required' },
    ],
  },
  {
    type: 'azurerm_subnet',
    provider: 'azure',
    category: 'Network',
    name: 'Azure VNet Subnet Network Partition',
    description: 'Logical partition within an Azure VNet for hosting resources, delegating specialized services (e.g. AKS, App Service), and attaching NSGs.',
    iconName: 'Network',
    defaultConfig: {
      name: 'app-tier-subnet',
      virtual_network_name: 'production-vnet-eastus',
      address_prefixes: ['10.100.1.0/24'],
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Subnet name is required' },
      { field: 'address_prefixes', type: 'required', message: 'Address prefix is required' },
    ],
  },
  {
    type: 'azurerm_lb',
    provider: 'azure',
    category: 'Network',
    name: 'Azure Load Balancer (Layer-4)',
    description: 'High-throughput, ultra-low latency Layer-4 load balancer for TCP and UDP traffic with automated health probes and outbound SNAT rules.',
    iconName: 'Radio',
    defaultConfig: {
      name: 'public-layer4-lb',
      location: 'eastus',
      sku: 'Standard',
    },
    pricingModel: {
      baseMonthlyRate: 18.25,
      hourlyRate: 0.025,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Load balancer name is required' },
    ],
  },
  {
    type: 'azurerm_application_gateway',
    provider: 'azure',
    category: 'Network',
    name: 'Azure Application Gateway (Layer-7 ALB)',
    description: 'Web traffic load balancer enabling URL-based routing, SSL/TLS termination, cookie-based session affinity, and integrated WAF v2 protection.',
    iconName: 'Radio',
    defaultConfig: {
      name: 'app-gateway-alb',
      location: 'eastus',
      sku: { name: 'WAF_v2', tier: 'WAF_v2', capacity: 2 },
    },
    pricingModel: {
      baseMonthlyRate: 125.0,
      hourlyRate: 0.171,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Gateway name is required' },
    ],
  },
  {
    type: 'azurerm_nat_gateway',
    provider: 'azure',
    category: 'Network',
    name: 'Azure Virtual Network NAT Gateway',
    description: 'Fully managed and highly resilient outbound internet connectivity service for subnets within an Azure Virtual Network.',
    iconName: 'Network',
    defaultConfig: {
      name: 'vnet-nat-gateway',
      location: 'eastus',
      sku_name: 'Standard',
      idle_timeout_in_minutes: 4,
    },
    pricingModel: {
      baseMonthlyRate: 32.85,
      hourlyRate: 0.045,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'NAT gateway name is required' },
    ],
  },
  {
    type: 'azurerm_virtual_wan',
    provider: 'azure',
    category: 'Network',
    name: 'Azure Virtual WAN Mesh Network',
    description: 'Unified networking service bringing together networking, security, and routing functionalities into a single operational interface across global branches.',
    iconName: 'Network',
    defaultConfig: {
      name: 'global-virtual-wan',
      location: 'eastus',
      type: 'Standard',
    },
    pricingModel: {
      baseMonthlyRate: 182.5,
      hourlyRate: 0.25,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Virtual WAN name is required' },
    ],
  },
  {
    type: 'azurerm_cdn_profile',
    provider: 'azure',
    category: 'Network',
    name: 'Azure Front Door & CDN Global Accelerator',
    description: 'Modern cloud content delivery network and global web application accelerator with integrated security, intelligent caching, and Anycast routing.',
    iconName: 'Globe',
    defaultConfig: {
      name: 'global-cdn-profile',
      location: 'global',
      sku: 'Standard_AzureFrontDoor',
    },
    pricingModel: {
      baseMonthlyRate: 35.0,
      hourlyRate: 0.0479,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'CDN profile name is required' },
    ],
  },

  // GCP Networking (7)
  {
    type: 'google_compute_network',
    provider: 'google',
    category: 'Network',
    name: 'Google Cloud VPC Global Network',
    description: 'Global software-defined Virtual Private Cloud network spanning all Google Cloud regions with Andromeda SDN architecture and private Google service access.',
    iconName: 'Globe',
    defaultConfig: {
      network_name: 'gcp-global-vpc',
      auto_create_subnetworks: false,
      routing_mode: 'GLOBAL',
      mtu: 1460,
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'network_name', type: 'required', message: 'VPC network name is required' },
    ],
  },
  {
    type: 'google_compute_subnetwork',
    provider: 'google',
    category: 'Network',
    name: 'Google Regional Subnetwork Partition',
    description: 'Regional subnetwork within a Google VPC with private Google access, secondary IP ranges for GKE pods and services, and flow logging.',
    iconName: 'Network',
    defaultConfig: {
      subnetwork_name: 'us-central1-subnet',
      ip_cidr_range: '10.200.1.0/24',
      region: 'us-central1',
      network: 'gcp-global-vpc',
      private_ip_google_access: true,
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'subnetwork_name', type: 'required', message: 'Subnet name is required' },
      { field: 'ip_cidr_range', type: 'cidr', message: 'Valid CIDR range required' },
    ],
  },
  {
    type: 'google_compute_global_forwarding_rule',
    provider: 'google',
    category: 'Network',
    name: 'Google Cloud Global External Load Balancer',
    description: 'High-performance global Anycast HTTP(S) load balancer with single global IP address, Cloud Armor security integration, and SSL offloading.',
    iconName: 'Radio',
    defaultConfig: {
      name: 'global-https-lb-rule',
      ip_protocol: 'TCP',
      port_range: '443',
      load_balancing_scheme: 'EXTERNAL_MANAGED',
    },
    pricingModel: {
      baseMonthlyRate: 18.25,
      hourlyRate: 0.025,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Forwarding rule name is required' },
    ],
  },
  {
    type: 'google_compute_router_nat',
    provider: 'google',
    category: 'Network',
    name: 'Google Cloud NAT Outbound Translation',
    description: 'Managed, software-defined NAT service enabling Compute Engine VMs without external IP addresses to access the internet reliably without NAT gateway bottlenecks.',
    iconName: 'Network',
    defaultConfig: {
      name: 'cloud-nat-us-central1',
      router: 'nat-router-us-central1',
      region: 'us-central1',
      nat_ip_allocate_option: 'AUTO_ONLY',
      source_subnetwork_ip_ranges_to_nat: 'ALL_SUBNETWORKS_ALL_IP_RANGES',
    },
    pricingModel: {
      baseMonthlyRate: 32.85,
      hourlyRate: 0.045,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Cloud NAT name is required' },
    ],
  },
  {
    type: 'google_compute_vpn_gateway',
    provider: 'google',
    category: 'Network',
    name: 'Google Cloud HA-VPN IPsec Gateway',
    description: 'High-availability site-to-site IPsec VPN gateway providing 99.99% service availability SLA for interconnecting on-premises networks with Google Cloud VPCs.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'ha-vpn-gateway-prod',
      network: 'gcp-global-vpc',
      region: 'us-central1',
    },
    pricingModel: {
      baseMonthlyRate: 29.2,
      hourlyRate: 0.04,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'VPN gateway name is required' },
    ],
  },
  {
    type: 'google_compute_network_peering',
    provider: 'google',
    category: 'Network',
    name: 'Google VPC Network Peering',
    description: 'Direct internal private IP connectivity between two VPC networks across projects or organizations with zero gateway bottlenecks and lowest latency.',
    iconName: 'Network',
    defaultConfig: {
      name: 'peer-prod-to-shared-services',
      network: 'gcp-global-vpc',
      peer_network: 'shared-services-vpc',
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Peering name is required' },
    ],
  },
  {
    type: 'google_compute_backend_service',
    provider: 'google',
    category: 'Network',
    name: 'Google Cloud CDN Edge Cache & Backend',
    description: 'Global edge caching and backend acceleration service leveraging Google’s private global fiber network to accelerate web and video content delivery.',
    iconName: 'Globe',
    defaultConfig: {
      name: 'cdn-backend-service',
      protocol: 'HTTP',
      enable_cdn: true,
      cdn_policy: { cache_mode: 'CACHE_ALL_STATIC', default_ttl: 3600 },
    },
    pricingModel: {
      baseMonthlyRate: 15.0,
      hourlyRate: 0.0205,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Backend service name is required' },
    ],
  },

  // =========================================================================
  // 5. SECURITY, IDENTITY & ZERO-TRUST IAM (15 Total: 5 AWS, 5 Azure, 5 GCP)
  // =========================================================================

  // AWS Security (5)
  {
    type: 'aws_security_group',
    provider: 'aws',
    category: 'Security',
    name: 'AWS Stateful Security Group Firewall',
    description: 'Virtual stateful firewall controlling inbound and outbound network traffic for EC2 instances, RDS databases, and container pods with least-privilege CIDR/port rules.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'hardened-web-sg',
      description: 'Zero-trust security group restricting ingress to HTTPS and internal VPC CIDRs',
      vpc_id: 'vpc-main',
      ingress_rules: [
        { protocol: 'tcp', from_port: 443, to_port: 443, cidr_blocks: ['0.0.0.0/0'], description: 'Allow public HTTPS' },
        { protocol: 'tcp', from_port: 22, to_port: 22, cidr_blocks: ['10.0.0.0/16'], description: 'Internal SSH access only' },
      ],
      egress_rules: [
        { protocol: '-1', from_port: 0, to_port: 0, cidr_blocks: ['0.0.0.0/0'], description: 'Allow all outbound' },
      ],
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Security group name is required' },
    ],
  },
  {
    type: 'aws_iam_role',
    provider: 'aws',
    category: 'Security',
    name: 'AWS IAM Role & Least-Privilege Policy',
    description: 'AWS Identity and Access Management (IAM) role with secure trust relationship policies, zero wildcard permissions, and mandatory condition keys for workload identity.',
    iconName: 'KeyRound',
    defaultConfig: {
      role_name: 'AppWorkloadExecutionRole',
      trusted_service: 'ec2.amazonaws.com',
      managed_policy_arns: ['arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore'],
      inline_policy: {
        policy_name: 'LeastPrivilegeS3Policy',
        policy_document: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{ Effect: 'Allow', Action: ['s3:GetObject', 's3:PutObject'], Resource: 'arn:aws:s3:::production-app-bucket/*' }],
        }),
      },
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'role_name', type: 'required', message: 'IAM role_name is required' },
      { field: 'trusted_service', type: 'required', message: 'Trusted service is required' },
    ],
  },
  {
    type: 'aws_kms_key',
    provider: 'aws',
    category: 'Security',
    name: 'AWS KMS Cryptographic HSM Key',
    description: 'Hardware Security Module (HSM) backed Key Management Service (KMS) encryption key with automatic annual rotation, least-privilege key policies, and CloudTrail auditing.',
    iconName: 'KeyRound',
    defaultConfig: {
      description: 'Master KMS Key for Multi-Cloud Data Encryption',
      enable_key_rotation: true,
      key_usage: 'ENCRYPT_DECRYPT',
      customer_master_key_spec: 'SYMMETRIC_DEFAULT',
    },
    pricingModel: {
      baseMonthlyRate: 1.0,
      hourlyRate: 0.00137,
      unitLabel: '$/key-month',
    },
    validationRules: [
      { field: 'description', type: 'required', message: 'KMS Key description is required' },
    ],
  },
  {
    type: 'aws_wafv2_web_acl',
    provider: 'aws',
    category: 'Security',
    name: 'AWS WAF v2 Web Access Control List',
    description: 'Layer-7 Web Application Firewall protecting applications from common web exploits (SQLi, XSS, SSRF), bot traffic, and rate-based DDoS attacks.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'enterprise-waf-acl',
      scope: 'REGIONAL',
      default_action: { allow: {} },
      visibility_config: { cloudwatch_metrics_enabled: true, sampled_requests_enabled: true, metric_name: 'enterpriseWafMetric' },
    },
    pricingModel: {
      baseMonthlyRate: 5.0,
      hourlyRate: 0.0068,
      unitLabel: '$/ACL-month + rules',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'WAF ACL name is required' },
    ],
  },
  {
    type: 'aws_secretsmanager_secret',
    provider: 'aws',
    category: 'Security',
    name: 'AWS Secrets Manager Automated Rotation',
    description: 'Centralized secret management service with automated credential rotation for RDS databases, API keys, and third-party service tokens with fine-grained IAM controls.',
    iconName: 'KeyRound',
    defaultConfig: {
      name: 'production/database/master-credentials',
      description: 'Production database master user secrets with automated KMS encryption',
    },
    pricingModel: {
      baseMonthlyRate: 0.4,
      hourlyRate: 0.00055,
      unitLabel: '$/secret-month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Secret name is required' },
    ],
  },

  // Azure Security (5)
  {
    type: 'azurerm_network_security_group',
    provider: 'azure',
    category: 'Security',
    name: 'Azure Network Security Group (NSG)',
    description: 'Stateful firewall containing security rules that allow or deny inbound and outbound network traffic to Azure subnets and VM network interfaces.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'hardened-app-nsg',
      location: 'eastus',
      security_rules: [
        { name: 'AllowHTTPS', priority: 100, direction: 'Inbound', access: 'Allow', protocol: 'Tcp', source_port_range: '*', destination_port_range: '443', source_address_prefix: '*', destination_address_prefix: '*' },
        { name: 'DenyDirectSSH', priority: 200, direction: 'Inbound', access: 'Deny', protocol: 'Tcp', source_port_range: '*', destination_port_range: '22', source_address_prefix: 'Internet', destination_address_prefix: '*' },
      ],
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'NSG name is required' },
    ],
  },
  {
    type: 'azurerm_role_definition',
    provider: 'azure',
    category: 'Security',
    name: 'Azure RBAC Role & Managed Identity',
    description: 'Custom Azure Role-Based Access Control (RBAC) role definition with strict least-privilege action permissions and user-assigned managed identities.',
    iconName: 'KeyRound',
    defaultConfig: {
      name: 'LeastPrivilegeStorageOperator',
      scope: '/subscriptions/00000000-0000-0000-0000-000000000000',
      description: 'Allows reading blob containers without full subscription permissions',
      permissions: [{ actions: ['Microsoft.Storage/storageAccounts/blobServices/containers/read'], not_actions: [] }],
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Role definition name is required' },
    ],
  },
  {
    type: 'azurerm_key_vault',
    provider: 'azure',
    category: 'Security',
    name: 'Azure Key Vault HSM Secret & Key Enclave',
    description: 'Safeguards cryptographic keys, certificates, and secrets used by cloud apps with FIPS 140-2 Level 2 and Level 3 HSM hardware validation and purge protection.',
    iconName: 'KeyRound',
    defaultConfig: {
      name: 'production-key-vault-2026',
      location: 'eastus',
      sku_name: 'standard',
      purge_protection_enabled: true,
      soft_delete_retention_days: 90,
    },
    pricingModel: {
      baseMonthlyRate: 3.0,
      hourlyRate: 0.0041,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Key Vault name is required' },
    ],
  },
  {
    type: 'azurerm_web_application_firewall_policy',
    provider: 'azure',
    category: 'Security',
    name: 'Azure WAF Application Protection Policy',
    description: 'Centralized Web Application Firewall policy providing centralized protection for web applications from OWASP Top 10 vulnerabilities with managed CRS 3.2 rule sets.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'enterprise-waf-policy',
      location: 'eastus',
      policy_settings: { mode: 'Prevention', state: 'Enabled' },
      managed_rules: { managed_rule_set: [{ type: 'OWASP', version: '3.2' }] },
    },
    pricingModel: {
      baseMonthlyRate: 20.0,
      hourlyRate: 0.0274,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'WAF policy name is required' },
    ],
  },
  {
    type: 'azurerm_security_center_subscription_pricing',
    provider: 'azure',
    category: 'Security',
    name: 'Microsoft Defender for Cloud Continuous SecOps',
    description: 'Cloud Security Posture Management (CSPM) and Cloud Workload Protection (CWP) providing unified security posture scoring and vulnerability assessments across multi-cloud.',
    iconName: 'Shield',
    defaultConfig: {
      tier: 'Standard',
      resource_type: 'VirtualMachines',
    },
    pricingModel: {
      baseMonthlyRate: 15.0,
      hourlyRate: 0.0205,
      unitLabel: '$/VM-month',
    },
    validationRules: [
      { field: 'tier', type: 'required', message: 'Tier is required' },
    ],
  },

  // GCP Security (5)
  {
    type: 'google_compute_firewall',
    provider: 'google',
    category: 'Security',
    name: 'Google Cloud VPC Stateful Firewall',
    description: 'Stateful VPC firewall rules that allow or deny traffic to or from VM instances based on port, protocol, IP range, and target service accounts or network tags.',
    iconName: 'Shield',
    defaultConfig: {
      firewall_name: 'allow-internal-and-https',
      network: 'gcp-global-vpc',
      direction: 'INGRESS',
      priority: 1000,
      allows: [{ protocol: 'tcp', ports: ['443'] }],
      source_ranges: ['0.0.0.0/0'],
      target_tags: ['web-server'],
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'firewall_name', type: 'required', message: 'Firewall name is required' },
    ],
  },
  {
    type: 'google_service_account',
    provider: 'google',
    category: 'Security',
    name: 'Google Cloud IAM Service Account & Workload Identity',
    description: 'Special account used by an application or compute workload to make authorized Google Cloud API calls without using personal user credentials.',
    iconName: 'KeyRound',
    defaultConfig: {
      account_id: 'gke-workload-runner',
      display_name: 'GKE Microservices Workload Identity Account',
      description: 'Least-privilege service account for pod authentication',
    },
    pricingModel: {
      baseMonthlyRate: 0.0,
      hourlyRate: 0.0,
      unitLabel: 'Included ($0.00)',
    },
    validationRules: [
      { field: 'account_id', type: 'required', message: 'Account ID is required' },
    ],
  },
  {
    type: 'google_kms_crypto_key',
    provider: 'google',
    category: 'Security',
    name: 'Google Cloud KMS Cryptographic Key Ring',
    description: 'Scalable cloud-hosted key management service that lets you manage cryptographic symmetric and asymmetric keys for Customer-Managed Encryption Keys (CMEK).',
    iconName: 'KeyRound',
    defaultConfig: {
      name: 'master-storage-key',
      key_ring: 'production-keyring-us-central1',
      rotation_period: '7776000s',
      purpose: 'ENCRYPT_DECRYPT',
    },
    pricingModel: {
      baseMonthlyRate: 0.06,
      hourlyRate: 0.00008,
      unitLabel: '$/key-version-month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Crypto key name is required' },
    ],
  },
  {
    type: 'google_compute_security_policy',
    provider: 'google',
    category: 'Security',
    name: 'Google Cloud Armor WAF & DDoS Policy',
    description: 'Enterprise DDoS mitigation and Web Application Firewall (WAF) leveraging Google’s global infrastructure to defend web apps from Layer-7 attacks.',
    iconName: 'Shield',
    defaultConfig: {
      name: 'cloud-armor-edge-waf',
      description: 'Protects global external load balancers from SQLi, XSS, and botnets',
    },
    pricingModel: {
      baseMonthlyRate: 5.0,
      hourlyRate: 0.0068,
      unitLabel: '$/policy-month + rules',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Security policy name is required' },
    ],
  },
  {
    type: 'google_secret_manager_secret',
    provider: 'google',
    category: 'Security',
    name: 'Google Cloud Secret Manager Enterprise Vault',
    description: 'Secure and convenient storage system for API keys, passwords, certificates, and sensitive credentials with automated replication and version auditing.',
    iconName: 'KeyRound',
    defaultConfig: {
      secret_id: 'db-master-encryption-key',
      replication: { automatic: true },
    },
    pricingModel: {
      baseMonthlyRate: 0.06,
      hourlyRate: 0.00008,
      unitLabel: '$/secret-version-month',
    },
    validationRules: [
      { field: 'secret_id', type: 'required', message: 'Secret ID is required' },
    ],
  },

  // =========================================================================
  // 6. AI/ML, GPU ACCELERATION & BIG DATA ANALYTICS (9 Total: 3 AWS, 3 Azure, 3 GCP)
  // =========================================================================

  // AWS AI/ML (3)
  {
    type: 'aws_sagemaker_endpoint',
    provider: 'aws',
    category: 'AI/ML',
    name: 'Amazon SageMaker AI Inference Endpoint',
    description: 'Fully managed real-time inference endpoint for deploying machine learning models and foundation LLMs with auto-scaling, A/B testing variants, and hardware acceleration.',
    iconName: 'Sparkles',
    defaultConfig: {
      endpoint_name: 'llm-realtime-inference-endpoint',
      endpoint_config_name: 'llm-g5-config',
      instance_type: 'ml.g5.2xlarge',
      initial_instance_count: 1,
    },
    pricingModel: {
      baseMonthlyRate: 884.76,
      hourlyRate: 1.212,
      unitLabel: '$/month',
      variablePricing: { 'ml.m5.large': 84.68, 'ml.g5.xlarge': 733.65, 'ml.g5.2xlarge': 884.76, 'ml.p4d.24xlarge': 23924.52 },
    },
    validationRules: [
      { field: 'endpoint_name', type: 'required', message: 'SageMaker endpoint name is required' },
    ],
  },
  {
    type: 'aws_sagemaker_notebook_instance',
    provider: 'aws',
    category: 'AI/ML',
    name: 'Amazon SageMaker ML Notebook Workspace',
    description: 'Managed Jupyter notebook environment with pre-installed deep learning frameworks (PyTorch, TensorFlow, HuggingFace) and direct connection to S3 and ECR.',
    iconName: 'Activity',
    defaultConfig: {
      name: 'ml-research-notebook',
      instance_type: 'ml.t3.medium',
      volume_size: 30,
    },
    pricingModel: {
      baseMonthlyRate: 42.49,
      hourlyRate: 0.0582,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Notebook name is required' },
    ],
  },
  {
    type: 'aws_emr_cluster',
    provider: 'aws',
    category: 'AI/ML',
    name: 'Amazon EMR Distributed Spark Cluster',
    description: 'Industry-leading cloud big data platform for running large-scale distributed data processing frameworks such as Apache Spark, Apache Hive, and Presto on AWS.',
    iconName: 'Layers',
    defaultConfig: {
      name: 'analytics-spark-emr',
      release_label: 'emr-7.0.0',
      applications: ['Spark', 'Hadoop', 'Hive'],
      master_instance_group: { instance_type: 'm6i.xlarge', instance_count: 1 },
      core_instance_group: { instance_type: 'm6i.xlarge', instance_count: 2 },
    },
    pricingModel: {
      baseMonthlyRate: 462.53,
      hourlyRate: 0.6336,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'EMR cluster name is required' },
    ],
  },

  // Azure AI/ML (3)
  {
    type: 'azurerm_machine_learning_workspace',
    provider: 'azure',
    category: 'AI/ML',
    name: 'Azure Machine Learning Enterprise Studio',
    description: 'Enterprise-grade machine learning service for the end-to-end MLOps lifecycle: model training, automated ML, experiment tracking, and model registry governance.',
    iconName: 'Sparkles',
    defaultConfig: {
      name: 'enterprise-ml-workspace',
      location: 'eastus',
      sku_name: 'Basic',
      public_network_access_enabled: false,
    },
    pricingModel: {
      baseMonthlyRate: 25.0,
      hourlyRate: 0.0342,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Workspace name is required' },
    ],
  },
  {
    type: 'azurerm_cognitive_account',
    provider: 'azure',
    category: 'AI/ML',
    name: 'Azure OpenAI & Cognitive Services Endpoint',
    description: 'Enterprise access to OpenAI foundation models (GPT-4o, DALL-E, Whisper, Embeddings) with Azure security controls, private networking, and content safety filters.',
    iconName: 'Sparkles',
    defaultConfig: {
      name: 'production-azure-openai',
      location: 'eastus',
      kind: 'OpenAI',
      sku_name: 'S0',
      custom_subdomain_name: 'corp-ai-prod',
    },
    pricingModel: {
      baseMonthlyRate: 50.0,
      hourlyRate: 0.0685,
      unitLabel: '$/month + token usage',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Cognitive account name is required' },
    ],
  },
  {
    type: 'azurerm_databricks_workspace',
    provider: 'azure',
    category: 'AI/ML',
    name: 'Azure Databricks Managed Lakehouse',
    description: 'Apache Spark-based analytics platform optimized for Azure with zero-management lakehouse architecture, Delta Lake integration, and collaborative notebooks.',
    iconName: 'Database',
    defaultConfig: {
      name: 'enterprise-databricks-ws',
      location: 'eastus',
      sku: 'premium',
    },
    pricingModel: {
      baseMonthlyRate: 350.0,
      hourlyRate: 0.479,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Databricks workspace name is required' },
    ],
  },

  // GCP AI/ML (3)
  {
    type: 'google_vertex_ai_endpoint',
    provider: 'google',
    category: 'AI/ML',
    name: 'Google Vertex AI Model Serving Endpoint',
    description: 'Unified AI platform endpoint for deploying foundation models (Gemini 1.5 Pro/Flash, PaLM, Gemma, Custom PyTorch/TensorFlow) with traffic splitting and auto-scaling.',
    iconName: 'Sparkles',
    defaultConfig: {
      name: 'vertex-ai-gemini-endpoint',
      display_name: 'Gemini Foundation Serving Endpoint',
      location: 'us-central1',
      dedicated_resources: {
        machine_spec: { machine_type: 'g2-standard-4', accelerator_type: 'NVIDIA_L4', accelerator_count: 1 },
        min_replica_count: 1,
        max_replica_count: 5,
      },
    },
    pricingModel: {
      baseMonthlyRate: 513.92,
      hourlyRate: 0.704,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Endpoint name is required' },
    ],
  },
  {
    type: 'google_notebooks_instance',
    provider: 'google',
    category: 'AI/ML',
    name: 'Google Vertex AI Managed JupyterLab',
    description: 'Cloud-hosted JupyterLab notebook environment integrated with BigQuery, Dataproc, and Google Cloud Storage for interactive machine learning exploration.',
    iconName: 'Activity',
    defaultConfig: {
      name: 'vertex-jupyter-notebook',
      location: 'us-central1-a',
      machine_type: 'e2-standard-4',
      vm_image: { project: 'deeplearning-platform-release', image_family: 'common-cu121' },
    },
    pricingModel: {
      baseMonthlyRate: 97.82,
      hourlyRate: 0.134,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Notebook instance name is required' },
    ],
  },
  {
    type: 'google_dataproc_cluster',
    provider: 'google',
    category: 'AI/ML',
    name: 'Google Cloud Dataproc Spark/Presto Cluster',
    description: 'Fast, easy-to-use, fully managed cloud service for running Apache Spark and Apache Hadoop clusters with 90-second cluster provisioning and spot VM pricing.',
    iconName: 'Layers',
    defaultConfig: {
      name: 'analytics-dataproc-cluster',
      region: 'us-central1',
      cluster_config: {
        master_config: { num_instances: 1, machine_type: 'n2-standard-4', disk_config: { boot_disk_size_gb: 100 } },
        worker_config: { num_instances: 2, machine_type: 'n2-standard-4', disk_config: { boot_disk_size_gb: 100 } },
      },
    },
    pricingModel: {
      baseMonthlyRate: 432.86,
      hourlyRate: 0.593,
      unitLabel: '$/month',
    },
    validationRules: [
      { field: 'name', type: 'required', message: 'Dataproc cluster name is required' },
    ],
  },
] as const;

// O(1) Index Lookup Maps
const CATALOG_MAP = new Map<string, ResourceCatalogItem>();
for (const item of CLOUD_RESOURCE_CATALOG) {
  CATALOG_MAP.set(item.type, item);
}

/**
 * Returns the catalog schema item for a given cloud primitive type.
 */
export function getResourceSchema(type: string): ResourceCatalogItem | undefined {
  return CATALOG_MAP.get(type);
}

/**
 * Alias for getResourceSchema.
 */
export function getResourceCatalogItem(type: string): ResourceCatalogItem | undefined {
  return CATALOG_MAP.get(type);
}

/**
 * Returns all catalog primitives belonging to a specific cloud provider ('aws', 'azure', 'google').
 */
export function getCatalogItemsByProvider(provider: CloudProvider): ResourceCatalogItem[] {
  return CLOUD_RESOURCE_CATALOG.filter((item) => item.provider === provider);
}

/**
 * Returns all catalog primitives belonging to a specific architectural category.
 */
export function getCatalogItemsByCategory(category: ResourceCategory): ResourceCatalogItem[] {
  return CLOUD_RESOURCE_CATALOG.filter((item) => item.category === category);
}

/**
 * Searches catalog items by query string, optionally filtering by provider and category.
 */
export function searchCatalogItems(
  query: string,
  provider?: CloudProvider,
  category?: ResourceCategory
): ResourceCatalogItem[] {
  const normalizedQuery = query.toLowerCase().trim();
  return CLOUD_RESOURCE_CATALOG.filter((item) => {
    if (provider && item.provider !== provider) return false;
    if (category && item.category !== category) return false;
    if (!normalizedQuery) return true;

    return (
      item.type.toLowerCase().includes(normalizedQuery) ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery) ||
      item.category.toLowerCase().includes(normalizedQuery) ||
      item.provider.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Validates a resource configuration object against the catalog validation rules.
 */
export function validateResourceConfig(
  type: string,
  config: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const schema = getResourceSchema(type);
  if (!schema) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];
  for (const rule of schema.validationRules) {
    const val = config[rule.field];

    if (rule.type === 'required') {
      if (val === undefined || val === null || val === '') {
        errors.push(rule.message);
      }
    } else if (rule.type === 'min' && typeof rule.value === 'number') {
      if (typeof val === 'number' && val < rule.value) {
        errors.push(rule.message);
      }
    } else if (rule.type === 'max' && typeof rule.value === 'number') {
      if (typeof val === 'number' && val > rule.value) {
        errors.push(rule.message);
      }
    } else if (rule.type === 'cidr') {
      if (typeof val === 'string' && val.length > 0) {
        const isCidr = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.test(val);
        if (!isCidr) {
          errors.push(rule.message);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Returns an array of all 108 cloud resource types.
 */
export function getAllResourceTypes(): CloudResourceType[] {
  return CLOUD_RESOURCE_CATALOG.map((item) => item.type);
}

/**
 * Returns the cloud provider for a resource type.
 */
export function getProviderForResourceType(type: string): CloudProvider | undefined {
  return CATALOG_MAP.get(type)?.provider;
}

/**
 * Returns the architectural category for a resource type.
 */
export function getCategoryForResourceType(type: string): ResourceCategory | undefined {
  return CATALOG_MAP.get(type)?.category;
}

/**
 * Returns the total count of primitives registered in the catalog.
 */
export function getTotalPrimitiveCount(): number {
  return CLOUD_RESOURCE_CATALOG.length;
}

/**
 * Helper to identify Kubernetes and containerized primitives.
 */
export const isK8sResource = (item: ResourceCatalogItem): boolean => {
  const t = item.type.toLowerCase();
  const n = item.name.toLowerCase();
  const d = item.description.toLowerCase();
  return (
    t.includes('eks') ||
    t.includes('aks') ||
    t.includes('container') ||
    t.includes('ecs') ||
    t.includes('apprunner') ||
    t.includes('kubernetes') ||
    t.includes('cloud_run') ||
    t.includes('k8s') ||
    n.includes('kubernetes') ||
    n.includes('container') ||
    n.includes('cluster') ||
    d.includes('kubernetes') ||
    d.includes('k8s') ||
    d.includes('container') ||
    d.includes('microservice') ||
    d.includes('docker')
  );
};
