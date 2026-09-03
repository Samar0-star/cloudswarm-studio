/**
 * HCLSyncEngine — AST-Level Bidirectional Synchronization Engine
 *
 * Implements:
 * 1. AST-level compilation from TopologyState (interactive canvas) to Terraform/OpenTofu HCL2.
 * 2. AST-level parsing and deserialization from Terraform HCL2 to TopologyState.
 * 3. Round-trip fidelity preservation across all 10 AWS primitives.
 * 4. Incremental RFC 6902 patch generation from live HCL edits for sub-millisecond canvas sync.
 */

import type {
  TopologyState,
  CloudResourceNode,
  TopologyEdge,
  CloudResourceType,
  AWSResourceType,
  SecurityGroupRule,
  S3EncryptionConfig,
} from '../../types/topology';
import { createDefaultTopologyState } from '../../types/topology';
import type { RFC6902Patch } from '../../types/patch';

// ============================================================================
// HCL2 AST Types & Tokenizer
// ============================================================================

export type HCLValue =
  | string
  | number
  | boolean
  | null
  | HCLValue[]
  | { [key: string]: HCLValue }
  | HCLReference;

export interface HCLReference {
  __type: 'HCLReference';
  raw: string;
}

export interface HCLAttribute {
  name: string;
  value: HCLValue;
}

export interface HCLBlock {
  type: string; // 'resource', 'variable', 'provider', 'output', 'terraform', 'module', etc.
  labels: string[]; // e.g. ['aws_vpc', 'vpc_main']
  attributes: Record<string, HCLValue>;
  nestedBlocks: HCLBlock[];
}

export interface HCLDocument {
  blocks: HCLBlock[];
}

export interface HclFormatOptions {
  includeHeader?: boolean;
  includePositions?: boolean;
  indentSpaces?: number;
}

// ============================================================================
// HCL2 Parser (Tokenizer + Recursive Descent AST Parser)
// ============================================================================

enum TokenType {
  IDENTIFIER,
  STRING,
  NUMBER,
  BOOLEAN,
  LBRACE, // {
  RBRACE, // }
  LBRACKET, // [
  RBRACKET, // ]
  LPAREN, // (
  RPAREN, // )
  EQUALS, // =
  COMMA, // ,
  COLON, // :
  HEREDOC,
  EOF,
}

interface Token {
  type: TokenType;
  value: string;
  line: number;
}

export class HCLParser {
  private input: string = '';
  private pos: number = 0;
  private line: number = 1;
  private tokens: Token[] = [];
  private tokenIndex: number = 0;

  public parse(hclString: string): HCLDocument {
    this.input = hclString;
    this.pos = 0;
    this.line = 1;
    this.tokens = this.tokenize();
    this.tokenIndex = 0;

    const blocks: HCLBlock[] = [];
    while (!this.isAtEnd()) {
      const block = this.parseBlockOrTopLevel();
      if (block) {
        blocks.push(block);
      }
    }

    return { blocks };
  }

  private tokenize(): Token[] {
    const tokens: Token[] = [];
    const len = this.input.length;

    while (this.pos < len) {
      const ch = this.input[this.pos]!;

      // Skip whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.pos++;
        continue;
      }

      if (ch === '\n') {
        this.line++;
        this.pos++;
        continue;
      }

      // Single line comments: # or //
      if (ch === '#' || (ch === '/' && this.input[this.pos + 1] === '/')) {
        while (this.pos < len && this.input[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      // Multi-line comments: /* ... */
      if (ch === '/' && this.input[this.pos + 1] === '*') {
        this.pos += 2;
        while (this.pos < len && !(this.input[this.pos] === '*' && this.input[this.pos + 1] === '/')) {
          if (this.input[this.pos] === '\n') this.line++;
          this.pos++;
        }
        this.pos = Math.min(len, this.pos + 2);
        continue;
      }

      // Structural characters
      if (ch === '{') {
        tokens.push({ type: TokenType.LBRACE, value: '{', line: this.line });
        this.pos++;
        continue;
      }
      if (ch === '}') {
        tokens.push({ type: TokenType.RBRACE, value: '}', line: this.line });
        this.pos++;
        continue;
      }
      if (ch === '[') {
        tokens.push({ type: TokenType.LBRACKET, value: '[', line: this.line });
        this.pos++;
        continue;
      }
      if (ch === ']') {
        tokens.push({ type: TokenType.RBRACKET, value: ']', line: this.line });
        this.pos++;
        continue;
      }
      if (ch === '(') {
        tokens.push({ type: TokenType.LPAREN, value: '(', line: this.line });
        this.pos++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: TokenType.RPAREN, value: ')', line: this.line });
        this.pos++;
        continue;
      }
      if (ch === '=') {
        tokens.push({ type: TokenType.EQUALS, value: '=', line: this.line });
        this.pos++;
        continue;
      }
      if (ch === ',') {
        tokens.push({ type: TokenType.COMMA, value: ',', line: this.line });
        this.pos++;
        continue;
      }
      if (ch === ':') {
        tokens.push({ type: TokenType.COLON, value: ':', line: this.line });
        this.pos++;
        continue;
      }

      // Heredoc: <<EOF or <<-EOF
      if (ch === '<' && this.input[this.pos + 1] === '<') {
        this.pos += 2;
        if (this.input[this.pos] === '-') {
          this.pos++;
        }
        let marker = '';
        while (this.pos < len && /[a-zA-Z0-9_]/.test(this.input[this.pos]!)) {
          marker += this.input[this.pos];
          this.pos++;
        }
        // Skip newline after marker
        if (this.input[this.pos] === '\r') this.pos++;
        if (this.input[this.pos] === '\n') {
          this.line++;
          this.pos++;
        }

        let heredocBody = '';
        while (this.pos < len) {
          let currentLine = '';
          while (this.pos < len && this.input[this.pos] !== '\n') {
            currentLine += this.input[this.pos];
            this.pos++;
          }
          if (this.input[this.pos] === '\n') {
            this.line++;
            this.pos++;
          }

          const trimmedLine = currentLine.trim();
          if (trimmedLine === marker) {
            break;
          }
          heredocBody += currentLine + '\n';
        }

        tokens.push({ type: TokenType.HEREDOC, value: heredocBody.trimEnd(), line: this.line });
        continue;
      }

      // Quoted Strings: "..."
      if (ch === '"') {
        this.pos++;
        let strVal = '';
        while (this.pos < len) {
          const c = this.input[this.pos]!;
          if (c === '\\') {
            if (this.pos + 1 < len) {
              const nextC = this.input[this.pos + 1]!;
              if (nextC === 'n') strVal += '\n';
              else if (nextC === 't') strVal += '\t';
              else if (nextC === '"') strVal += '"';
              else if (nextC === '\\') strVal += '\\';
              else strVal += nextC;
              this.pos += 2;
              continue;
            }
          }
          if (c === '"') {
            this.pos++;
            break;
          }
          if (c === '\n') this.line++;
          strVal += c;
          this.pos++;
        }
        tokens.push({ type: TokenType.STRING, value: strVal, line: this.line });
        continue;
      }

      // Numbers
      if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(this.input[this.pos + 1] || ''))) {
        let numStr = '';
        if (ch === '-') {
          numStr += '-';
          this.pos++;
        }
        while (this.pos < len && /[0-9.]/.test(this.input[this.pos]!)) {
          numStr += this.input[this.pos];
          this.pos++;
        }
        tokens.push({ type: TokenType.NUMBER, value: numStr, line: this.line });
        continue;
      }

      // Identifiers / Keywords / References
      if (/[a-zA-Z_]/.test(ch)) {
        let ident = '';
        while (this.pos < len && /[a-zA-Z0-9_.-]/.test(this.input[this.pos]!)) {
          ident += this.input[this.pos];
          this.pos++;
        }
        if (ident === 'true' || ident === 'false') {
          tokens.push({ type: TokenType.BOOLEAN, value: ident, line: this.line });
        } else {
          tokens.push({ type: TokenType.IDENTIFIER, value: ident, line: this.line });
        }
        continue;
      }

      // Unknown character, skip
      this.pos++;
    }

    tokens.push({ type: TokenType.EOF, value: '', line: this.line });
    return tokens;
  }

  private peek(): Token {
    return this.tokens[this.tokenIndex] ?? { type: TokenType.EOF, value: '', line: this.line };
  }

  private advance(): Token {
    const t = this.peek();
    if (this.tokenIndex < this.tokens.length) {
      this.tokenIndex++;
    }
    return t;
  }

  private check(type: TokenType, value?: string): boolean {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private parseBlockOrTopLevel(): HCLBlock | null {
    if (this.isAtEnd()) return null;

    const first = this.advance();
    if (first.type !== TokenType.IDENTIFIER && first.type !== TokenType.STRING) {
      return null;
    }

    const blockType = first.value;
    const labels: string[] = [];

    while (!this.isAtEnd() && !this.check(TokenType.LBRACE) && !this.check(TokenType.EQUALS)) {
      const next = this.advance();
      if (next.type === TokenType.STRING || next.type === TokenType.IDENTIFIER) {
        labels.push(next.value);
      }
    }

    if (this.check(TokenType.EQUALS)) {
      // Top-level attribute, skip
      this.advance();
      this.parseValue();
      return null;
    }

    if (this.check(TokenType.LBRACE)) {
      this.advance(); // consume '{'
      const { attributes, nestedBlocks } = this.parseBlockBody();
      return {
        type: blockType,
        labels,
        attributes,
        nestedBlocks,
      };
    }

    return null;
  }

  private parseBlockBody(): { attributes: Record<string, HCLValue>; nestedBlocks: HCLBlock[] } {
    const attributes: Record<string, HCLValue> = {};
    const nestedBlocks: HCLBlock[] = [];

    while (!this.isAtEnd() && !this.check(TokenType.RBRACE)) {
      const token = this.peek();

      if (token.type === TokenType.IDENTIFIER || token.type === TokenType.STRING) {
        this.advance();
        const keyOrBlockName = token.value;

        // Check if this is a nested block: name { ... } or name "label" { ... }
        if (this.check(TokenType.LBRACE)) {
          this.advance();
          const nestedBody = this.parseBlockBody();
          nestedBlocks.push({
            type: keyOrBlockName,
            labels: [],
            attributes: nestedBody.attributes,
            nestedBlocks: nestedBody.nestedBlocks,
          });
          continue;
        }

        if (this.check(TokenType.STRING) || this.check(TokenType.IDENTIFIER)) {
          // Nested block with labels
          const labels: string[] = [];
          while (!this.isAtEnd() && !this.check(TokenType.LBRACE)) {
            labels.push(this.advance().value);
          }
          if (this.check(TokenType.LBRACE)) {
            this.advance();
            const nestedBody = this.parseBlockBody();
            nestedBlocks.push({
              type: keyOrBlockName,
              labels,
              attributes: nestedBody.attributes,
              nestedBlocks: nestedBody.nestedBlocks,
            });
            continue;
          }
        }

        // Attribute assignment: key = value or key: value
        if (this.check(TokenType.EQUALS) || this.check(TokenType.COLON)) {
          this.advance();
          const value = this.parseValue();
          attributes[keyOrBlockName] = value;
          if (this.check(TokenType.COMMA)) {
            this.advance();
          }
          continue;
        }

        // Object without explicit equals
        if (this.check(TokenType.LBRACE)) {
          this.advance();
          const objVal = this.parseObject();
          attributes[keyOrBlockName] = objVal;
          continue;
        }
      } else {
        this.advance();
      }
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance(); // consume '}'
    }

    return { attributes, nestedBlocks };
  }

  private parseValue(): HCLValue {
    const token = this.peek();

    if (token.type === TokenType.STRING) {
      this.advance();
      return token.value;
    }

    if (token.type === TokenType.HEREDOC) {
      this.advance();
      return token.value;
    }

    if (token.type === TokenType.NUMBER) {
      this.advance();
      return parseFloat(token.value);
    }

    if (token.type === TokenType.BOOLEAN) {
      this.advance();
      return token.value === 'true';
    }

    if (token.type === TokenType.LBRACKET) {
      return this.parseArray();
    }

    if (token.type === TokenType.LBRACE) {
      return this.parseObject();
    }

    if (token.type === TokenType.IDENTIFIER) {
      this.advance();
      if (token.value === 'null') return null;
      if (token.value === 'true') return true;
      if (token.value === 'false') return false;

      if (this.check(TokenType.LPAREN)) {
        this.advance(); // consume '('
        const arg = this.parseValue();
        if (this.check(TokenType.RPAREN)) {
          this.advance(); // consume ')'
        }
        return { __type: 'HCLFunctionCall', fn: token.value, arg };
      }

      return { __type: 'HCLReference', raw: token.value };
    }

    this.advance();
    return null;
  }

  private parseArray(): HCLValue[] {
    const arr: HCLValue[] = [];
    this.advance(); // consume '['

    while (!this.isAtEnd() && !this.check(TokenType.RBRACKET)) {
      arr.push(this.parseValue());
      if (this.check(TokenType.COMMA)) {
        this.advance();
      }
    }

    if (this.check(TokenType.RBRACKET)) {
      this.advance(); // consume ']'
    }

    return arr;
  }

  private parseObject(): Record<string, HCLValue> {
    const obj: Record<string, HCLValue> = {};
    this.advance(); // consume '{'

    while (!this.isAtEnd() && !this.check(TokenType.RBRACE)) {
      const keyToken = this.peek();
      if (keyToken.type === TokenType.IDENTIFIER || keyToken.type === TokenType.STRING) {
        this.advance();
        const key = keyToken.value;
        if (this.check(TokenType.EQUALS) || this.check(TokenType.COLON)) {
          this.advance();
        }
        const val = this.parseValue();
        obj[key] = val;
        if (this.check(TokenType.COMMA)) {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    if (this.check(TokenType.RBRACE)) {
      this.advance(); // consume '}'
    }

    return obj;
  }
}

// ============================================================================
// HCLSyncEngine Implementation
// ============================================================================

export class HCLSyncEngine {
  private static parser = new HCLParser();

  /**
   * AST Compilation: Converts TopologyState into valid Terraform/OpenTofu HCL2 code.
   */
  public static canvasToHcl(state: TopologyState, options?: HclFormatOptions): string {
    const lines: string[] = [];

    if (options?.includeHeader !== false) {
      lines.push('# ==============================================================================');
      lines.push('# Generated by CloudSwarm Studio — Terraform / OpenTofu HCL2 Manifest');
      lines.push(`# State Version: ${state.version} | Last Modified: ${state.lastModifiedBy ?? 'director'}`);
      lines.push('# ==============================================================================');
      lines.push('');
    }

    // Sort nodes to maintain deterministic, clean layout across AWS, Azure, and GCP
    const nodes = Object.values(state.nodes).filter((n): n is CloudResourceNode => Boolean(n && n.id));
    const sortedNodes = [...nodes].sort((a, b) => {
      const order: Record<string, number> = {
        // AWS
        aws_vpc: 1,
        aws_subnet: 2,
        aws_security_group: 3,
        aws_iam_role: 4,
        aws_instance: 5,
        aws_instance_compute: 6,
        aws_instance_gpu: 7,
        aws_ecs_cluster: 8,
        aws_eks_cluster: 9,
        aws_db_instance: 10,
        aws_rds_cluster: 11,
        aws_dynamodb_table: 12,
        aws_elasticache_cluster: 13,
        aws_s3_bucket: 14,
        aws_ebs_volume: 15,
        aws_lb: 16,
        aws_nat_gateway: 17,
        aws_internet_gateway: 18,
        aws_cloudfront_distribution: 19,
        // Azure
        azurerm_virtual_network: 30,
        azurerm_subnet: 31,
        azurerm_network_security_group: 32,
        azurerm_role_definition: 33,
        azurerm_key_vault: 34,
        azurerm_linux_virtual_machine: 35,
        azurerm_windows_virtual_machine: 36,
        azurerm_virtual_machine_gpu: 37,
        azurerm_kubernetes_cluster: 38,
        azurerm_container_group: 39,
        azurerm_linux_function_app: 40,
        azurerm_app_service: 41,
        azurerm_mssql_database: 42,
        azurerm_postgresql_flexible_server: 43,
        azurerm_cosmosdb_account: 44,
        azurerm_redis_cache: 45,
        azurerm_storage_account: 46,
        azurerm_storage_container: 47,
        azurerm_managed_disk: 48,
        azurerm_lb: 49,
        azurerm_application_gateway: 50,
        // GCP
        google_compute_network: 60,
        google_compute_subnetwork: 61,
        google_compute_firewall: 62,
        google_service_account: 63,
        google_kms_crypto_key: 64,
        google_secret_manager_secret: 65,
        google_compute_instance: 66,
        google_compute_instance_optimized: 67,
        google_compute_instance_gpu: 68,
        google_container_cluster: 69,
        google_cloud_run_service: 70,
        google_cloudfunctions_function: 71,
        google_sql_database_instance: 72,
        google_spanner_instance: 73,
        google_firestore_database: 74,
        google_bigtable_instance: 75,
        google_redis_instance: 76,
        google_storage_bucket: 77,
        google_compute_disk: 78,
        google_compute_global_forwarding_rule: 79,
      };
      const orderA = order[a?.type] ?? 99;
      const orderB = order[b?.type] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      const idA = a?.id ?? '';
      const idB = b?.id ?? '';
      return idA.localeCompare(idB);
    });

    for (const node of sortedNodes) {
      const resourceId = HCLSyncEngine.normalizeIdentifier(node.id);
      lines.push(`resource "${node.type}" "${resourceId}" {`);

      // Write resource configuration attributes
      HCLSyncEngine.renderNodeAttributes(node, lines, state);

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n').trimEnd() + '\n';
  }

  /**
   * AST Deserialization: Parses Terraform HCL2 code into a structured TopologyState across AWS, Azure, and GCP.
   */
  public static hclToCanvas(hclString: string): TopologyState {
    const state = createDefaultTopologyState();
    if (!hclString || !hclString.trim()) {
      return state;
    }

    try {
      const ast = this.parser.parse(hclString);

      let nodeIndex = 0;
      const parsedNodes: Record<string, CloudResourceNode> = {};
      const parsedEdges: Record<string, TopologyEdge> = {};

      for (const block of ast.blocks) {
        if (block.type === 'resource' && block.labels.length >= 2) {
          const rawType = block.labels[0]!;
          const resourceId = block.labels[1]!;

          // Support any cloud primitive type across AWS, Azure, and GCP
          let type: CloudResourceType = rawType as CloudResourceType;
          if (!rawType.startsWith('aws_') && !rawType.startsWith('azurerm_') && !rawType.startsWith('google_')) {
            type = 'aws_instance';
          }

          // Extract config from attributes and nested blocks
          const config: Record<string, unknown> = {};

          for (const [attrKey, attrVal] of Object.entries(block.attributes)) {
            config[attrKey] = HCLSyncEngine.unwrapHCLValue(attrVal);
          }

          // Process nested blocks
          for (const nested of block.nestedBlocks) {
            // AWS nested blocks
            if (nested.type === 'ingress') {
              if (!Array.isArray(config['ingress_rules'])) config['ingress_rules'] = [];
              (config['ingress_rules'] as unknown[]).push(HCLSyncEngine.blockToRule(nested));
            } else if (nested.type === 'egress') {
              if (!Array.isArray(config['egress_rules'])) config['egress_rules'] = [];
              (config['egress_rules'] as unknown[]).push(HCLSyncEngine.blockToRule(nested));
            } else if (nested.type === 'metadata_options') {
              const httpTokens = nested.attributes['http_tokens'];
              if (httpTokens !== undefined) {
                config['http_tokens'] = HCLSyncEngine.unwrapHCLValue(httpTokens);
              }
            } else if (nested.type === 'root_block_device') {
              if (nested.attributes['volume_size'] !== undefined) {
                config['root_volume_gb'] = Number(HCLSyncEngine.unwrapHCLValue(nested.attributes['volume_size']));
              }
              if (nested.attributes['volume_type'] !== undefined) {
                config['root_volume_type'] = String(HCLSyncEngine.unwrapHCLValue(nested.attributes['volume_type']));
              }
              if (nested.attributes['iops'] !== undefined) {
                config['iops'] = Number(HCLSyncEngine.unwrapHCLValue(nested.attributes['iops']));
              }
            } else if (nested.type === 'server_side_encryption_configuration') {
              config['encryption'] = { sse_algorithm: 'AES256' };
            } else if (nested.type === 'versioning') {
              config['versioning_enabled'] = true;
              config['versioning'] = { enabled: true };
            }
            // Azure nested blocks
            else if (nested.type === 'os_disk') {
              config['os_disk'] = HCLSyncEngine.nestedBlockToConfig(nested);
            } else if (nested.type === 'default_node_pool') {
              config['default_node_pool'] = HCLSyncEngine.nestedBlockToConfig(nested);
            } else if (nested.type === 'identity') {
              config['identity'] = HCLSyncEngine.nestedBlockToConfig(nested);
            } else if (nested.type === 'security_rule') {
              if (!Array.isArray(config['security_rules'])) config['security_rules'] = [];
              (config['security_rules'] as unknown[]).push(HCLSyncEngine.nestedBlockToConfig(nested));
            } else if (nested.type === 'consistency_policy') {
              config['consistency_policy'] = HCLSyncEngine.nestedBlockToConfig(nested);
            } else if (nested.type === 'geo_location') {
              config['geo_location'] = HCLSyncEngine.nestedBlockToConfig(nested);
            }
            // GCP nested blocks
            else if (nested.type === 'boot_disk') {
              const bdConfig: Record<string, unknown> = {};
              for (const inner of nested.nestedBlocks) {
                if (inner.type === 'initialize_params') {
                  const initParams = HCLSyncEngine.nestedBlockToConfig(inner);
                  if (initParams['size'] !== undefined) bdConfig['size_gb'] = Number(initParams['size']);
                  if (initParams['type'] !== undefined) bdConfig['type'] = initParams['type'];
                  if (initParams['image'] !== undefined) bdConfig['image'] = initParams['image'];
                }
              }
              for (const [k, v] of Object.entries(nested.attributes)) {
                bdConfig[k] = HCLSyncEngine.unwrapHCLValue(v);
              }
              config['boot_disk'] = bdConfig;
            } else if (nested.type === 'network_interface') {
              if (!Array.isArray(config['network_interfaces'])) config['network_interfaces'] = [];
              (config['network_interfaces'] as unknown[]).push(HCLSyncEngine.nestedBlockToConfig(nested));
            } else if (nested.type === 'node_config') {
              config['node_config'] = HCLSyncEngine.nestedBlockToConfig(nested);
            } else if (nested.type === 'settings') {
              config['settings'] = HCLSyncEngine.nestedBlockToConfig(nested);
              const st = config['settings'] as Record<string, unknown>;
              if (st['tier']) config['tier'] = st['tier'];
              if (st['disk_size']) config['disk_size'] = st['disk_size'];
              if (st['disk_type']) config['disk_type'] = st['disk_type'];
              if (st['availability_type']) config['availability_type'] = st['availability_type'];
            } else if (nested.type === 'allow') {
              if (!Array.isArray(config['allows'])) config['allows'] = [];
              (config['allows'] as unknown[]).push(HCLSyncEngine.nestedBlockToConfig(nested));
            }
            // Generic nested blocks
            else {
              config[nested.type] = HCLSyncEngine.nestedBlockToConfig(nested);
            }
          }

          // Special field mappings for canonical schema compatibility
          if (config['bucket'] && !config['bucket_name']) {
            config['bucket_name'] = config['bucket'];
          }
          if (config['allocated_storage'] && !config['allocated_storage_gb']) {
            config['allocated_storage_gb'] = config['allocated_storage'];
          }
          if (config['name'] && !config['cluster_name'] && (type === 'aws_ecs_cluster' || type === 'aws_eks_cluster' || type === 'azurerm_kubernetes_cluster' || type === 'google_container_cluster')) {
            config['cluster_name'] = config['name'];
          }
          if (config['size'] && !config['vm_size'] && (type.startsWith('azurerm_') || type.startsWith('google_'))) {
            config['vm_size'] = config['size'];
          }
          if (config['name'] && !config['instance_name'] && (type === 'google_compute_instance' || type === 'google_sql_database_instance')) {
            config['instance_name'] = config['name'];
          }
          if (config['name'] && !config['account_name'] && type === 'azurerm_storage_account') {
            config['account_name'] = config['name'];
          }
          if (config['name'] && !config['vault_name'] && type === 'azurerm_key_vault') {
            config['vault_name'] = config['name'];
          }
          if (config['name'] && !config['network_name'] && type === 'google_compute_network') {
            config['network_name'] = config['name'];
          }
          if (config['name'] && !config['subnetwork_name'] && type === 'google_compute_subnetwork') {
            config['subnetwork_name'] = config['name'];
          }
          if (config['name'] && !config['firewall_name'] && type === 'google_compute_firewall') {
            config['firewall_name'] = config['name'];
          }

          // Extract parentId
          let parentId: string | undefined;
          if (typeof config['vpc_id'] === 'string') {
            parentId = HCLSyncEngine.extractReferenceId(config['vpc_id']);
          } else if (typeof config['subnet_id'] === 'string') {
            parentId = HCLSyncEngine.extractReferenceId(config['subnet_id']);
          } else if (typeof config['virtual_network_name'] === 'string') {
            parentId = HCLSyncEngine.extractReferenceId(config['virtual_network_name']);
          } else if (typeof config['vnet_id'] === 'string') {
            parentId = HCLSyncEngine.extractReferenceId(config['vnet_id']);
          } else if (typeof config['network'] === 'string') {
            parentId = HCLSyncEngine.extractReferenceId(config['network']);
          } else if (typeof config['subnetwork'] === 'string') {
            parentId = HCLSyncEngine.extractReferenceId(config['subnetwork']);
          }

          // Position calculation (grid fallback if not annotated)
          const col = nodeIndex % 4;
          const row = Math.floor(nodeIndex / 4);
          const defaultPos = { x: 80 + col * 280, y: 80 + row * 180 };

          const node: CloudResourceNode = {
            id: resourceId,
            type,
            name: typeof config['name'] === 'string' ? config['name'] : resourceId,
            position: defaultPos,
            parentId,
            config,
            metadata: {
              createdBy: 'director',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
            version: 1,
          };

          parsedNodes[resourceId] = node;
          nodeIndex++;
        }
      }

      // Infer edges from references in configs across all providers
      for (const [sourceId, node] of Object.entries(parsedNodes)) {
        HCLSyncEngine.extractEdgesFromNode(node, sourceId, parsedNodes, parsedEdges);
      }

      return {
        nodes: parsedNodes,
        edges: parsedEdges,
        version: Object.keys(parsedNodes).length > 0 ? 1 : 0,
        lastModifiedBy: 'director',
        lastModifiedAt: Date.now(),
      };
    } catch {
      // Return default state if parse fails completely
      return state;
    }
  }

  /**
   * Computes minimal RFC 6902 JSON patches required to transform oldState to match newHcl.
   */
  public static computePatchesFromHcl(oldState: TopologyState, newHcl: string): RFC6902Patch[] {
    const newState = HCLSyncEngine.hclToCanvas(newHcl);
    const patches: RFC6902Patch[] = [];

    // Check for removed nodes
    for (const oldId of Object.keys(oldState.nodes)) {
      if (!newState.nodes[oldId]) {
        patches.push({
          op: 'remove',
          path: `/nodes/${oldId}`,
        });
      }
    }

    // Check for added or modified nodes
    for (const [newId, newNode] of Object.entries(newState.nodes)) {
      const oldNode = oldState.nodes[newId];
      if (!oldNode) {
        patches.push({
          op: 'add',
          path: `/nodes/${newId}`,
          value: newNode,
        });
      } else {
        // Update config properties
        for (const [key, val] of Object.entries(newNode.config)) {
          if (JSON.stringify(oldNode.config[key]) !== JSON.stringify(val)) {
            patches.push({
              op: 'replace',
              path: `/nodes/${newId}/config/${key}`,
              value: val,
            });
          }
        }
      }
    }

    return patches;
  }

  // ============================================================================
  // Internal Rendering & Deserialization Helpers
  // ============================================================================

  private static normalizeIdentifier(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private static renderNodeAttributes(
    node: CloudResourceNode,
    lines: string[],
    state: TopologyState
  ): void {
    const cfg = node.config;

    // Common name tag
    if (cfg['name'] && typeof cfg['name'] === 'string') {
      lines.push(`  name = "${cfg['name']}"`);
    }

    switch (node.type) {
      // =========================================================================
      // AWS Primitives
      // =========================================================================
      case 'aws_vpc':
        if (cfg['cidr_block']) lines.push(`  cidr_block           = "${cfg['cidr_block']}"`);
        if (cfg['enable_dns_hostnames'] !== undefined) lines.push(`  enable_dns_hostnames = ${cfg['enable_dns_hostnames']}`);
        if (cfg['enable_dns_support'] !== undefined) lines.push(`  enable_dns_support   = ${cfg['enable_dns_support']}`);
        if (cfg['instance_tenancy']) lines.push(`  instance_tenancy     = "${cfg['instance_tenancy']}"`);
        break;

      case 'aws_subnet':
        if (cfg['vpc_id']) {
          const vpcRef = HCLSyncEngine.formatResourceRef('aws_vpc', String(cfg['vpc_id']), state);
          lines.push(`  vpc_id                  = ${vpcRef}`);
        } else if (node.parentId) {
          const vpcRef = HCLSyncEngine.formatResourceRef('aws_vpc', node.parentId, state);
          lines.push(`  vpc_id                  = ${vpcRef}`);
        }
        if (cfg['cidr_block']) lines.push(`  cidr_block              = "${cfg['cidr_block']}"`);
        if (cfg['availability_zone']) lines.push(`  availability_zone       = "${cfg['availability_zone']}"`);
        if (cfg['map_public_ip_on_launch'] !== undefined) lines.push(`  map_public_ip_on_launch = ${cfg['map_public_ip_on_launch']}`);
        break;

      case 'aws_instance':
      case 'aws_instance_compute':
      case 'aws_instance_gpu':
        if (cfg['ami']) lines.push(`  ami                  = "${cfg['ami']}"`);
        if (cfg['instance_type']) lines.push(`  instance_type        = "${cfg['instance_type']}"`);
        if (cfg['subnet_id']) {
          const subRef = HCLSyncEngine.formatResourceRef('aws_subnet', String(cfg['subnet_id']), state);
          lines.push(`  subnet_id            = ${subRef}`);
        }
        if (Array.isArray(cfg['security_group_ids'])) {
          const sgRefs = (cfg['security_group_ids'] as string[]).map((sg) =>
            HCLSyncEngine.formatResourceRef('aws_security_group', sg, state)
          );
          lines.push(`  vpc_security_group_ids = [${sgRefs.join(', ')}]`);
        }
        if (cfg['iam_instance_profile']) lines.push(`  iam_instance_profile = "${cfg['iam_instance_profile']}"`);

        // Root block device
        if (cfg['root_volume_gb'] || cfg['root_volume_type']) {
          lines.push('  root_block_device {');
          lines.push(`    volume_size = ${cfg['root_volume_gb'] ?? 20}`);
          lines.push(`    volume_type = "${cfg['root_volume_type'] ?? 'gp3'}"`);
          if (cfg['iops']) lines.push(`    iops        = ${cfg['iops']}`);
          lines.push('  }');
        }

        // IMDSv2 metadata options
        if (cfg['http_tokens']) {
          lines.push('  metadata_options {');
          lines.push(`    http_tokens = "${cfg['http_tokens']}"`);
          lines.push('  }');
        }
        break;

      case 'aws_db_instance':
      case 'aws_rds_cluster':
        if (cfg['engine']) lines.push(`  engine                  = "${cfg['engine']}"`);
        if (cfg['engine_version']) lines.push(`  engine_version          = "${cfg['engine_version']}"`);
        if (cfg['instance_class']) lines.push(`  instance_class          = "${cfg['instance_class']}"`);
        if (cfg['allocated_storage_gb']) lines.push(`  allocated_storage       = ${cfg['allocated_storage_gb']}`);
        if (cfg['storage_type']) lines.push(`  storage_type            = "${cfg['storage_type']}"`);
        if (cfg['multi_az'] !== undefined) lines.push(`  multi_az                = ${cfg['multi_az']}`);
        if (cfg['storage_encrypted'] !== undefined) lines.push(`  storage_encrypted       = ${cfg['storage_encrypted']}`);
        if (cfg['kms_key_id']) lines.push(`  kms_key_id              = "${cfg['kms_key_id']}"`);
        if (cfg['backup_retention_period']) lines.push(`  backup_retention_period = ${cfg['backup_retention_period']}`);
        if (cfg['publicly_accessible'] !== undefined) lines.push(`  publicly_accessible     = ${cfg['publicly_accessible']}`);
        break;

      case 'aws_s3_bucket':
        if (cfg['bucket_name']) lines.push(`  bucket = "${cfg['bucket_name']}"`);
        else if (cfg['bucket']) lines.push(`  bucket = "${cfg['bucket']}"`);

        if (cfg['versioning_enabled']) {
          lines.push('  versioning {');
          lines.push('    enabled = true');
          lines.push('  }');
        }

        if (cfg['encryption']) {
          const enc = cfg['encryption'] as S3EncryptionConfig;
          lines.push('  server_side_encryption_configuration {');
          lines.push('    rule {');
          lines.push('      apply_server_side_encryption_by_default {');
          lines.push(`        sse_algorithm = "${enc.sse_algorithm || 'AES256'}"`);
          if (enc.kms_key_id) lines.push(`        kms_master_key_id = "${enc.kms_key_id}"`);
          lines.push('      }');
          lines.push('    }');
          lines.push('  }');
        }
        break;

      case 'aws_lb':
        if (cfg['name']) lines.push(`  name               = "${cfg['name']}"`);
        if (cfg['internal'] !== undefined) lines.push(`  internal           = ${cfg['internal']}`);
        if (cfg['load_balancer_type']) lines.push(`  load_balancer_type = "${cfg['load_balancer_type']}"`);
        if (Array.isArray(cfg['subnet_ids'])) {
          const subRefs = (cfg['subnet_ids'] as string[]).map((s) =>
            HCLSyncEngine.formatResourceRef('aws_subnet', s, state)
          );
          lines.push(`  subnets            = [${subRefs.join(', ')}]`);
        }
        break;

      case 'aws_security_group':
        if (cfg['name']) lines.push(`  name        = "${cfg['name']}"`);
        if (cfg['description']) lines.push(`  description = "${cfg['description']}"`);
        if (cfg['vpc_id']) {
          const vpcRef = HCLSyncEngine.formatResourceRef('aws_vpc', String(cfg['vpc_id']), state);
          lines.push(`  vpc_id      = ${vpcRef}`);
        }

        if (Array.isArray(cfg['ingress_rules'])) {
          for (const rule of cfg['ingress_rules'] as SecurityGroupRule[]) {
            lines.push('  ingress {');
            lines.push(`    from_port   = ${rule.from_port}`);
            lines.push(`    to_port     = ${rule.to_port}`);
            lines.push(`    protocol    = "${rule.protocol}"`);
            if (rule.cidr_blocks && rule.cidr_blocks.length > 0) {
              lines.push(`    cidr_blocks = ${JSON.stringify(rule.cidr_blocks)}`);
            }
            if (rule.description) lines.push(`    description = "${rule.description}"`);
            lines.push('  }');
          }
        }
        if (Array.isArray(cfg['egress_rules'])) {
          for (const rule of cfg['egress_rules'] as SecurityGroupRule[]) {
            lines.push('  egress {');
            lines.push(`    from_port   = ${rule.from_port}`);
            lines.push(`    to_port     = ${rule.to_port}`);
            lines.push(`    protocol    = "${rule.protocol}"`);
            if (rule.cidr_blocks && rule.cidr_blocks.length > 0) {
              lines.push(`    cidr_blocks = ${JSON.stringify(rule.cidr_blocks)}`);
            }
            lines.push('  }');
          }
        }
        break;

      case 'aws_iam_role':
        if (cfg['role_name']) lines.push(`  name = "${cfg['role_name']}"`);
        else if (cfg['name']) lines.push(`  name = "${cfg['name']}"`);
        if (cfg['trusted_service']) {
          lines.push(`  assume_role_policy = jsonencode({`);
          lines.push(`    Version = "2012-10-17"`);
          lines.push(`    Statement = [{`);
          lines.push(`      Action = "sts:AssumeRole"`);
          lines.push(`      Effect = "Allow"`);
          lines.push(`      Principal = { Service = "${cfg['trusted_service']}.amazonaws.com" }`);
          lines.push(`    }]`);
          lines.push(`  })`);
        }
        break;

      case 'aws_ecs_cluster':
        if (cfg['cluster_name']) lines.push(`  name = "${cfg['cluster_name']}"`);
        break;

      case 'aws_eks_cluster':
        if (cfg['cluster_name']) lines.push(`  name = "${cfg['cluster_name']}"`);
        if (cfg['kubernetes_version']) lines.push(`  version = "${cfg['kubernetes_version']}"`);
        break;

      // =========================================================================
      // Azure Primitives
      // =========================================================================
      case 'azurerm_virtual_network':
        if (cfg['name'] || cfg['virtual_network_name']) lines.push(`  name                = "${cfg['name'] || cfg['virtual_network_name']}"`);
        if (cfg['location']) lines.push(`  location            = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['address_space']) {
          const space = Array.isArray(cfg['address_space']) ? cfg['address_space'] : [cfg['address_space']];
          lines.push(`  address_space       = ${JSON.stringify(space)}`);
        }
        if (cfg['dns_servers'] && Array.isArray(cfg['dns_servers']) && cfg['dns_servers'].length > 0) {
          lines.push(`  dns_servers         = ${JSON.stringify(cfg['dns_servers'])}`);
        }
        break;

      case 'azurerm_subnet':
        if (cfg['name'] || cfg['subnetwork_name']) lines.push(`  name                 = "${cfg['name'] || cfg['subnetwork_name']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name  = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['virtual_network_name'] || cfg['vnet_id'] || node.parentId) {
          const vnetRef = HCLSyncEngine.formatResourceRef('azurerm_virtual_network', String(cfg['virtual_network_name'] || cfg['vnet_id'] || node.parentId), state);
          lines.push(`  virtual_network_name = ${vnetRef}`);
        }
        if (cfg['address_prefixes']) {
          const prefixes = Array.isArray(cfg['address_prefixes']) ? cfg['address_prefixes'] : [cfg['address_prefixes']];
          lines.push(`  address_prefixes     = ${JSON.stringify(prefixes)}`);
        }
        if (cfg['service_endpoints'] && Array.isArray(cfg['service_endpoints'])) {
          lines.push(`  service_endpoints    = ${JSON.stringify(cfg['service_endpoints'])}`);
        }
        break;

      case 'azurerm_linux_virtual_machine':
      case 'azurerm_virtual_machine_gpu':
        if (cfg['name'] || cfg['instance_name']) lines.push(`  name                            = "${cfg['name'] || cfg['instance_name']}"`);
        if (cfg['location']) lines.push(`  location                        = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name            = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['vm_size'] || cfg['size']) lines.push(`  size                            = "${cfg['vm_size'] || cfg['size']}"`);
        if (cfg['admin_username']) lines.push(`  admin_username                  = "${cfg['admin_username']}"`);
        if (cfg['disable_password_authentication'] !== undefined) lines.push(`  disable_password_authentication = ${cfg['disable_password_authentication']}`);
        if (Array.isArray(cfg['network_interface_ids'])) {
          const nicRefs = (cfg['network_interface_ids'] as string[]).map((n) =>
            HCLSyncEngine.formatResourceRef('azurerm_network_interface', n, state)
          );
          lines.push(`  network_interface_ids           = [${nicRefs.join(', ')}]`);
        } else if (cfg['network_interface_id']) {
          const nicRef = HCLSyncEngine.formatResourceRef('azurerm_network_interface', String(cfg['network_interface_id']), state);
          lines.push(`  network_interface_ids           = [${nicRef}]`);
        }

        {
          const osDisk = (cfg['os_disk'] as Record<string, unknown>) || {};
          lines.push('  os_disk {');
          lines.push(`    caching              = "${osDisk['caching'] || 'ReadWrite'}"`);
          lines.push(`    storage_account_type = "${osDisk['storage_account_type'] || 'Premium_LRS'}"`);
          if (osDisk['disk_size_gb']) lines.push(`    disk_size_gb         = ${osDisk['disk_size_gb']}`);
          lines.push('  }');
        }
        break;

      case 'azurerm_windows_virtual_machine':
        if (cfg['name']) lines.push(`  name                = "${cfg['name']}"`);
        if (cfg['location']) lines.push(`  location            = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['vm_size'] || cfg['size']) lines.push(`  size                = "${cfg['vm_size'] || cfg['size']}"`);
        if (cfg['admin_username']) lines.push(`  admin_username      = "${cfg['admin_username']}"`);
        if (cfg['admin_password']) lines.push(`  admin_password      = "${cfg['admin_password']}"`);
        {
          const winOsDisk = (cfg['os_disk'] as Record<string, unknown>) || {};
          lines.push('  os_disk {');
          lines.push(`    caching              = "${winOsDisk['caching'] || 'ReadWrite'}"`);
          lines.push(`    storage_account_type = "${winOsDisk['storage_account_type'] || 'Premium_LRS'}"`);
          lines.push('  }');
        }
        break;

      case 'azurerm_kubernetes_cluster':
        if (cfg['cluster_name'] || cfg['name']) lines.push(`  name                = "${cfg['cluster_name'] || cfg['name']}"`);
        if (cfg['location']) lines.push(`  location            = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['dns_prefix']) lines.push(`  dns_prefix          = "${cfg['dns_prefix']}"`);
        if (cfg['kubernetes_version']) lines.push(`  kubernetes_version  = "${cfg['kubernetes_version']}"`);

        {
          const pool = (cfg['default_node_pool'] as Record<string, unknown>) || {};
          lines.push('  default_node_pool {');
          lines.push(`    name       = "${pool['name'] || 'default'}"`);
          lines.push(`    node_count = ${pool['node_count'] ?? 3}`);
          lines.push(`    vm_size    = "${pool['vm_size'] || 'Standard_D4s_v5'}"`);
          if (pool['enable_auto_scaling']) lines.push('    enable_auto_scaling = true');
          if (pool['min_count']) lines.push(`    min_count  = ${pool['min_count']}`);
          if (pool['max_count']) lines.push(`    max_count  = ${pool['max_count']}`);
          lines.push('  }');
        }

        lines.push('  identity {');
        lines.push(`    type = "${(cfg['identity'] as Record<string, unknown>)?.['type'] || 'SystemAssigned'}"`);
        lines.push('  }');
        break;

      case 'azurerm_storage_account':
        if (cfg['account_name'] || cfg['name']) lines.push(`  name                     = "${cfg['account_name'] || cfg['name']}"`);
        if (cfg['location']) lines.push(`  location                 = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name      = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['account_tier']) lines.push(`  account_tier             = "${cfg['account_tier']}"`);
        if (cfg['account_replication_type']) lines.push(`  account_replication_type = "${cfg['account_replication_type']}"`);
        if (cfg['enable_https_traffic_only'] !== undefined) lines.push(`  enable_https_traffic_only = ${cfg['enable_https_traffic_only']}`);
        if (cfg['min_tls_version']) lines.push(`  min_tls_version          = "${cfg['min_tls_version']}"`);
        break;

      case 'azurerm_key_vault':
        if (cfg['vault_name'] || cfg['name']) lines.push(`  name                       = "${cfg['vault_name'] || cfg['name']}"`);
        if (cfg['location']) lines.push(`  location                   = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name        = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['sku_name']) lines.push(`  sku_name                   = "${cfg['sku_name']}"`);
        lines.push(`  tenant_id                  = "${cfg['tenant_id'] || '00000000-0000-0000-0000-000000000000'}"`);
        if (cfg['purge_protection_enabled'] !== undefined) lines.push(`  purge_protection_enabled   = ${cfg['purge_protection_enabled']}`);
        if (cfg['soft_delete_retention_days']) lines.push(`  soft_delete_retention_days = ${cfg['soft_delete_retention_days']}`);
        break;

      case 'azurerm_network_security_group':
        if (cfg['name']) lines.push(`  name                = "${cfg['name']}"`);
        if (cfg['location']) lines.push(`  location            = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (Array.isArray(cfg['security_rules'])) {
          for (const rule of cfg['security_rules'] as Record<string, unknown>[]) {
            lines.push('  security_rule {');
            lines.push(`    name                       = "${rule['name'] || 'rule'}"`);
            lines.push(`    priority                   = ${rule['priority'] || 100}`);
            lines.push(`    direction                  = "${rule['direction'] || 'Inbound'}"`);
            lines.push(`    access                     = "${rule['access'] || 'Allow'}"`);
            lines.push(`    protocol                   = "${rule['protocol'] || 'Tcp'}"`);
            lines.push(`    source_port_range          = "${rule['source_port_range'] || '*'}"`);
            lines.push(`    destination_port_range     = "${rule['destination_port_range'] || '*'}"`);
            lines.push(`    source_address_prefix      = "${rule['source_address_prefix'] || '*'}"`);
            lines.push(`    destination_address_prefix = "${rule['destination_address_prefix'] || '*'}"`);
            lines.push('  }');
          }
        }
        break;

      case 'azurerm_mssql_database':
        if (cfg['database_name'] || cfg['name']) lines.push(`  name        = "${cfg['database_name'] || cfg['name']}"`);
        if (cfg['server_id']) {
          const srvRef = HCLSyncEngine.formatResourceRef('azurerm_mssql_server', String(cfg['server_id']), state);
          lines.push(`  server_id   = ${srvRef}`);
        }
        if (cfg['sku_name']) lines.push(`  sku_name    = "${cfg['sku_name']}"`);
        if (cfg['max_size_gb']) lines.push(`  max_size_gb = ${cfg['max_size_gb']}`);
        break;

      case 'azurerm_postgresql_flexible_server':
        if (cfg['server_name'] || cfg['name']) lines.push(`  name                   = "${cfg['server_name'] || cfg['name']}"`);
        if (cfg['location']) lines.push(`  location               = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name    = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['version']) lines.push(`  version                = "${cfg['version']}"`);
        if (cfg['sku_name']) lines.push(`  sku_name               = "${cfg['sku_name']}"`);
        if (cfg['storage_mb']) lines.push(`  storage_mb             = ${cfg['storage_mb']}`);
        if (cfg['administrator_login']) lines.push(`  administrator_login    = "${cfg['administrator_login']}"`);
        break;

      case 'azurerm_cosmosdb_account':
        if (cfg['account_name'] || cfg['name']) lines.push(`  name                = "${cfg['account_name'] || cfg['name']}"`);
        if (cfg['location']) lines.push(`  location            = "${cfg['location']}"`);
        if (cfg['resource_group_name']) lines.push(`  resource_group_name = "${cfg['resource_group_name'] || 'rg-production'}"`);
        if (cfg['offer_type']) lines.push(`  offer_type          = "${cfg['offer_type']}"`);
        if (cfg['kind']) lines.push(`  kind                = "${cfg['kind']}"`);
        lines.push('  consistency_policy {');
        lines.push(`    consistency_level = "${(cfg['consistency_policy'] as Record<string, unknown>)?.['consistency_level'] || 'Session'}"`);
        lines.push('  }');
        lines.push('  geo_location {');
        lines.push(`    location          = "${cfg['location'] || 'eastus'}"`);
        lines.push('    failover_priority = 0');
        lines.push('  }');
        break;

      // =========================================================================
      // GCP Primitives
      // =========================================================================
      case 'google_compute_network':
        if (cfg['network_name'] || cfg['name']) lines.push(`  name                    = "${cfg['network_name'] || cfg['name']}"`);
        if (cfg['auto_create_subnetworks'] !== undefined) lines.push(`  auto_create_subnetworks = ${cfg['auto_create_subnetworks']}`);
        if (cfg['routing_mode']) lines.push(`  routing_mode            = "${cfg['routing_mode']}"`);
        if (cfg['mtu']) lines.push(`  mtu                     = ${cfg['mtu']}`);
        if (cfg['project']) lines.push(`  project                 = "${cfg['project']}"`);
        break;

      case 'google_compute_subnetwork':
        if (cfg['subnetwork_name'] || cfg['name']) lines.push(`  name                     = "${cfg['subnetwork_name'] || cfg['name']}"`);
        if (cfg['network'] || node.parentId) {
          const netRef = HCLSyncEngine.formatResourceRef('google_compute_network', String(cfg['network'] || node.parentId), state);
          lines.push(`  network                  = ${netRef}`);
        }
        if (cfg['ip_cidr_range']) lines.push(`  ip_cidr_range            = "${cfg['ip_cidr_range']}"`);
        if (cfg['region']) lines.push(`  region                   = "${cfg['region']}"`);
        if (cfg['private_ip_google_access'] !== undefined) lines.push(`  private_ip_google_access = ${cfg['private_ip_google_access']}`);
        if (cfg['project']) lines.push(`  project                  = "${cfg['project']}"`);
        break;

      case 'google_compute_instance':
      case 'google_compute_instance_optimized':
      case 'google_compute_instance_gpu':
        if (cfg['instance_name'] || cfg['name']) lines.push(`  name         = "${cfg['instance_name'] || cfg['name']}"`);
        if (cfg['machine_type']) lines.push(`  machine_type = "${cfg['machine_type']}"`);
        if (cfg['zone']) lines.push(`  zone         = "${cfg['zone']}"`);

        {
          const bootDisk = (cfg['boot_disk'] as Record<string, unknown>) || {};
          lines.push('  boot_disk {');
          lines.push('    initialize_params {');
          lines.push(`      size  = ${bootDisk['size_gb'] || bootDisk['size'] || 50}`);
          lines.push(`      type  = "${bootDisk['type'] || 'pd-balanced'}"`);
          if (bootDisk['image']) lines.push(`      image = "${bootDisk['image']}"`);
          lines.push('    }');
          lines.push('  }');
        }

        if (Array.isArray(cfg['network_interfaces']) && cfg['network_interfaces'].length > 0) {
          for (const nic of cfg['network_interfaces'] as Record<string, unknown>[]) {
            lines.push('  network_interface {');
            if (nic['network']) {
              const netRef = HCLSyncEngine.formatResourceRef('google_compute_network', String(nic['network']), state);
              lines.push(`    network    = ${netRef}`);
            }
            if (nic['subnetwork']) {
              const subRef = HCLSyncEngine.formatResourceRef('google_compute_subnetwork', String(nic['subnetwork']), state);
              lines.push(`    subnetwork = ${subRef}`);
            }
            lines.push('  }');
          }
        } else {
          lines.push('  network_interface {');
          lines.push('    network = "default"');
          lines.push('  }');
        }

        if (Array.isArray(cfg['tags']) && cfg['tags'].length > 0) {
          lines.push(`  tags         = ${JSON.stringify(cfg['tags'])}`);
        }
        if (cfg['project']) lines.push(`  project      = "${cfg['project']}"`);
        break;

      case 'google_container_cluster':
        if (cfg['cluster_name'] || cfg['name']) lines.push(`  name               = "${cfg['cluster_name'] || cfg['name']}"`);
        if (cfg['location']) lines.push(`  location           = "${cfg['location']}"`);
        if (cfg['enable_autopilot'] !== undefined) lines.push(`  enable_autopilot   = ${cfg['enable_autopilot']}`);
        if (cfg['initial_node_count'] !== undefined) lines.push(`  initial_node_count = ${cfg['initial_node_count']}`);
        if (cfg['node_config']) {
          const nc = cfg['node_config'] as Record<string, unknown>;
          lines.push('  node_config {');
          if (nc['machine_type']) lines.push(`    machine_type = "${nc['machine_type']}"`);
          if (nc['disk_size_gb']) lines.push(`    disk_size_gb = ${nc['disk_size_gb']}`);
          if (nc['disk_type']) lines.push(`    disk_type    = "${nc['disk_type']}"`);
          lines.push('  }');
        }
        if (cfg['project']) lines.push(`  project            = "${cfg['project']}"`);
        break;

      case 'google_storage_bucket':
        if (cfg['bucket_name'] || cfg['name']) lines.push(`  name                        = "${cfg['bucket_name'] || cfg['name']}"`);
        if (cfg['location']) lines.push(`  location                    = "${cfg['location']}"`);
        if (cfg['storage_class']) lines.push(`  storage_class               = "${cfg['storage_class']}"`);
        if (cfg['uniform_bucket_level_access'] !== undefined) lines.push(`  uniform_bucket_level_access = ${cfg['uniform_bucket_level_access']}`);
        if (cfg['versioning']) {
          lines.push('  versioning {');
          lines.push(`    enabled = ${(cfg['versioning'] as Record<string, unknown>)?.['enabled'] ?? true}`);
          lines.push('  }');
        }
        if (cfg['project']) lines.push(`  project                     = "${cfg['project']}"`);
        break;

      case 'google_sql_database_instance':
        if (cfg['instance_name'] || cfg['name']) lines.push(`  name             = "${cfg['instance_name'] || cfg['name']}"`);
        if (cfg['database_version']) lines.push(`  database_version = "${cfg['database_version']}"`);
        if (cfg['region']) lines.push(`  region           = "${cfg['region']}"`);
        lines.push('  settings {');
        lines.push(`    tier              = "${cfg['tier'] || (cfg['settings'] as Record<string, unknown>)?.['tier'] || 'db-custom-4-16384'}"`);
        if (cfg['disk_size'] || (cfg['settings'] as Record<string, unknown>)?.['disk_size']) {
          lines.push(`    disk_size         = ${cfg['disk_size'] || (cfg['settings'] as Record<string, unknown>)?.['disk_size']}`);
        }
        if (cfg['disk_type'] || (cfg['settings'] as Record<string, unknown>)?.['disk_type']) {
          lines.push(`    disk_type         = "${cfg['disk_type'] || (cfg['settings'] as Record<string, unknown>)?.['disk_type']}"`);
        }
        if (cfg['availability_type'] || (cfg['settings'] as Record<string, unknown>)?.['availability_type']) {
          lines.push(`    availability_type = "${cfg['availability_type'] || (cfg['settings'] as Record<string, unknown>)?.['availability_type']}"`);
        }
        lines.push('  }');
        if (cfg['project']) lines.push(`  project          = "${cfg['project']}"`);
        break;

      case 'google_compute_firewall':
        if (cfg['firewall_name'] || cfg['name']) lines.push(`  name          = "${cfg['firewall_name'] || cfg['name']}"`);
        if (cfg['network']) {
          const netRef = HCLSyncEngine.formatResourceRef('google_compute_network', String(cfg['network']), state);
          lines.push(`  network       = ${netRef}`);
        }
        if (cfg['direction']) lines.push(`  direction     = "${cfg['direction']}"`);
        if (cfg['priority']) lines.push(`  priority      = ${cfg['priority']}`);
        if (Array.isArray(cfg['source_ranges'])) lines.push(`  source_ranges = ${JSON.stringify(cfg['source_ranges'])}`);
        if (Array.isArray(cfg['target_tags'])) lines.push(`  target_tags   = ${JSON.stringify(cfg['target_tags'])}`);
        if (Array.isArray(cfg['allows'])) {
          for (const allow of cfg['allows'] as Record<string, unknown>[]) {
            lines.push('  allow {');
            lines.push(`    protocol = "${allow['protocol'] || 'tcp'}"`);
            if (Array.isArray(allow['ports'])) {
              lines.push(`    ports    = ${JSON.stringify(allow['ports'])}`);
            }
            lines.push('  }');
          }
        }
        if (cfg['project']) lines.push(`  project       = "${cfg['project']}"`);
        break;

      default:
        // Generic attribute dumping for any other configs
        for (const [k, v] of Object.entries(cfg)) {
          if (k === 'name' || k === 'tags') continue;
          if (typeof v === 'string') lines.push(`  ${k} = "${v}"`);
          else if (typeof v === 'number' || typeof v === 'boolean') lines.push(`  ${k} = ${v}`);
        }
        break;
    }

    // Render tags
    const tags = cfg['tags'] as Record<string, string> | undefined;
    if (tags && Object.keys(tags).length > 0 && typeof tags === 'object' && !Array.isArray(tags)) {
      lines.push('  tags = {');
      for (const [tk, tv] of Object.entries(tags)) {
        lines.push(`    ${tk} = "${tv}"`);
      }
      lines.push('  }');
    }
  }

  private static formatResourceRef(expectedType: string, refId: string, state: TopologyState): string {
    const cleanId = HCLSyncEngine.normalizeIdentifier(refId);
    const targetNode = state.nodes[refId] || state.nodes[cleanId];
    if (targetNode) {
      const type = targetNode.type;
      const targetCleanId = HCLSyncEngine.normalizeIdentifier(targetNode.id);
      if (type === 'azurerm_virtual_network' && expectedType === 'azurerm_virtual_network') {
        return `${type}.${targetCleanId}.name`;
      }
      return `${type}.${targetCleanId}.id`;
    }
    if (refId.startsWith('aws_') || refId.startsWith('azurerm_') || refId.startsWith('google_') || refId.includes('.')) {
      return refId;
    }
    return `"${refId}"`;
  }

  private static unwrapHCLValue(val: HCLValue | undefined): unknown {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object' && '__type' in val && val.__type === 'HCLReference') {
      return (val as HCLReference).raw;
    }
    if (Array.isArray(val)) {
      return val.map((item) => HCLSyncEngine.unwrapHCLValue(item));
    }
    if (typeof val === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        result[k] = HCLSyncEngine.unwrapHCLValue(v);
      }
      return result;
    }
    return val;
  }

  private static blockToRule(block: HCLBlock): SecurityGroupRule {
    return {
      protocol: String(HCLSyncEngine.unwrapHCLValue(block.attributes['protocol']) ?? '-1'),
      from_port: Number(HCLSyncEngine.unwrapHCLValue(block.attributes['from_port']) ?? 0),
      to_port: Number(HCLSyncEngine.unwrapHCLValue(block.attributes['to_port']) ?? 0),
      cidr_blocks: Array.isArray(block.attributes['cidr_blocks'])
        ? (HCLSyncEngine.unwrapHCLValue(block.attributes['cidr_blocks']) as string[])
        : undefined,
      description: block.attributes['description']
        ? String(HCLSyncEngine.unwrapHCLValue(block.attributes['description']))
        : undefined,
    };
  }

  private static nestedBlockToConfig(block: HCLBlock): Record<string, unknown> {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(block.attributes)) {
      res[k] = HCLSyncEngine.unwrapHCLValue(v);
    }
    return res;
  }

  private static extractReferenceId(refString: string): string {
    // Matches aws_vpc.vpc_main.id, azurerm_virtual_network.vnet_prod.name, google_compute_network.net.self_link, etc.
    const match = refString.match(/(?:aws_[a-z0-9_]+|azurerm_[a-z0-9_]+|google_[a-z0-9_]+)\.([a-zA-Z0-9_]+)\.(?:id|name|self_link|arn|fqdn|endpoint|url)/);
    if (match && match[1]) {
      return match[1];
    }
    return refString;
  }

  private static extractEdgesFromNode(
    node: CloudResourceNode,
    sourceId: string,
    allNodes: Record<string, CloudResourceNode>,
    edges: Record<string, TopologyEdge>
  ): void {
    const cfg = node.config;

    const addEdgeIfValid = (targetRef: unknown, preferredType?: string) => {
      if (typeof targetRef !== 'string') return;
      const targetId = HCLSyncEngine.extractReferenceId(targetRef);
      if (allNodes[targetId] && targetId !== sourceId) {
        const targetNode = allNodes[targetId];
        let edgeType = preferredType;
        if (!edgeType) {
          if (targetNode.type.includes('vpc') || targetNode.type.includes('virtual_network') || targetNode.type.includes('network')) {
            edgeType = node.type.includes('subnet') ? 'routes_to' : 'attached_to';
          } else if (
            targetNode.type.includes('security') ||
            targetNode.type.includes('firewall') ||
            targetNode.type.includes('role') ||
            targetNode.type.includes('vault') ||
            targetNode.type.includes('kms')
          ) {
            edgeType = 'security_attachment';
          } else if (
            targetNode.type.includes('s3') ||
            targetNode.type.includes('storage') ||
            targetNode.type.includes('bucket') ||
            targetNode.type.includes('disk')
          ) {
            edgeType = 'stores_in';
          } else {
            edgeType = 'attached_to';
          }
        }

        // Generate semantic edge ID consistent with existing patterns
        let prefix = 'attached';
        if (edgeType === 'routes_to') prefix = 'routes';
        else if (edgeType === 'security_attachment') prefix = 'sec';
        else if (edgeType === 'stores_in') prefix = 'stores';
        const edgeId = `edge_${sourceId}_${prefix}_${targetId}`;

        edges[edgeId] = {
          id: edgeId,
          source: sourceId,
          target: targetId,
          type: edgeType,
          version: 1,
        };
      }
    };

    // AWS Direct references
    if (cfg['vpc_id']) addEdgeIfValid(cfg['vpc_id'], 'routes_to');
    if (cfg['subnet_id']) addEdgeIfValid(cfg['subnet_id'], 'attached_to');
    if (Array.isArray(cfg['subnet_ids'])) {
      for (const s of cfg['subnet_ids'] as string[]) {
        const targetId = HCLSyncEngine.extractReferenceId(s);
        if (allNodes[targetId] && targetId !== sourceId) {
          const edgeId = `edge_${sourceId}_sub_${targetId}`;
          edges[edgeId] = {
            id: edgeId,
            source: sourceId,
            target: targetId,
            type: 'attached_to',
            version: 1,
          };
        }
      }
    }
    if (Array.isArray(cfg['security_group_ids']) || Array.isArray(cfg['vpc_security_group_ids'])) {
      const sgs = (cfg['security_group_ids'] || cfg['vpc_security_group_ids']) as string[];
      for (const sg of sgs) addEdgeIfValid(sg, 'security_attachment');
    }

    // Azure Direct references
    if (cfg['virtual_network_name']) addEdgeIfValid(cfg['virtual_network_name'], 'routes_to');
    if (cfg['vnet_id']) addEdgeIfValid(cfg['vnet_id'], 'routes_to');
    if (Array.isArray(cfg['network_interface_ids'])) {
      for (const nic of cfg['network_interface_ids'] as string[]) addEdgeIfValid(nic, 'attached_to');
    }
    if (cfg['network_interface_id']) addEdgeIfValid(cfg['network_interface_id'], 'attached_to');
    if (cfg['network_security_group_id']) addEdgeIfValid(cfg['network_security_group_id'], 'security_attachment');
    if (cfg['key_vault_id']) addEdgeIfValid(cfg['key_vault_id'], 'security_attachment');
    if (cfg['server_id']) addEdgeIfValid(cfg['server_id'], 'attached_to');

    // GCP Direct references
    if (cfg['network']) addEdgeIfValid(cfg['network'], node.type.includes('subnetwork') ? 'routes_to' : 'attached_to');
    if (cfg['subnetwork']) addEdgeIfValid(cfg['subnetwork'], 'attached_to');
    if (Array.isArray(cfg['network_interfaces'])) {
      for (const nic of cfg['network_interfaces'] as Record<string, unknown>[]) {
        if (nic['network']) addEdgeIfValid(nic['network'], 'routes_to');
        if (nic['subnetwork']) addEdgeIfValid(nic['subnetwork'], 'attached_to');
      }
    }

    // Generic scan of remaining config properties for HCL references
    for (const [key, val] of Object.entries(cfg)) {
      if (
        [
          'vpc_id',
          'subnet_id',
          'subnet_ids',
          'security_group_ids',
          'vpc_security_group_ids',
          'virtual_network_name',
          'vnet_id',
          'network_interface_ids',
          'network',
          'subnetwork',
        ].includes(key)
      ) {
        continue;
      }
      if (typeof val === 'string') {
        addEdgeIfValid(val);
      } else if (Array.isArray(val)) {
        for (const item of val) {
          if (typeof item === 'string') addEdgeIfValid(item);
        }
      }
    }
  }
}

// Export standalone functions for direct import ergonomics
export const canvasToHcl = (state: TopologyState, options?: HclFormatOptions): string =>
  HCLSyncEngine.canvasToHcl(state, options);

export const hclToCanvas = (hclString: string): TopologyState =>
  HCLSyncEngine.hclToCanvas(hclString);

export const computePatchesFromHcl = (oldState: TopologyState, newHcl: string): RFC6902Patch[] =>
  HCLSyncEngine.computePatchesFromHcl(oldState, newHcl);

