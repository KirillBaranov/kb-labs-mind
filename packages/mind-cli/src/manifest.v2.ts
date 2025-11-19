/**
 * @module @kb-labs/mind-cli/manifest
 * Manifest v2 for Mind CLI
 */

import { createManifestV2 } from '@kb-labs/plugin-manifest';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';

/**
 * Mind CLI Manifest v2
 * Level 2: Типизация через contracts для автодополнения и проверки ID
 */
export const manifest = createManifestV2<typeof pluginContractsManifest>({
  schema: 'kb.plugin/2',
  id: '@kb-labs/mind',
  version: '0.1.0',
  display: {
    name: 'Mind',
    description: 'AI-oriented dependency indexing and context packing for KB Labs',
    tags: ['mind', 'indexing', 'context'],
  },
  
  // CLI commands
  cli: {
    commands: [
      {
        manifestVersion: '1.0',
        id: 'init',
        group: 'mind',
        describe: 'Initialize mind workspace',
        longDescription: 'Set up mind workspace with initial configuration',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'force',
            type: 'boolean',
            alias: 'f',
            description: 'Force initialization even if already exists',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format',
          },
          {
            name: 'verbose',
            type: 'boolean',
            description: 'Verbose output',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
        ],
        examples: [
          'kb mind init',
          'kb mind init --force',
          'kb mind init --json',
        ],
        handler: './cli/commands/init#run',
      },
      {
        manifestVersion: '1.0',
        id: 'update',
        group: 'mind',
        describe: 'Update mind workspace',
        longDescription: 'Update mind workspace indexes with delta tracking',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'since',
            type: 'string',
            description: 'Git reference to update since',
          },
          {
            name: 'time-budget',
            type: 'number',
            description: 'Time budget in milliseconds',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format',
          },
          {
            name: 'verbose',
            type: 'boolean',
            description: 'Verbose output',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
        ],
        examples: [
          'kb mind update',
          'kb mind update --since HEAD~1',
          'kb mind update --time-budget 600 --json',
        ],
        handler: './cli/commands/update#run',
      },
      {
        manifestVersion: '1.0',
        id: 'pack',
        group: 'mind',
        describe: 'Pack mind workspace',
        longDescription: 'Create a context pack from mind workspace',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'intent',
            type: 'string',
            alias: 'i',
            description: 'Intent description for context',
            required: true,
          },
          {
            name: 'product',
            type: 'string',
            alias: 'p',
            description: 'Product name',
          },
          {
            name: 'preset',
            type: 'string',
            description: 'Context preset name',
          },
          {
            name: 'budget',
            type: 'number',
            alias: 'b',
            description: 'Token budget',
          },
          {
            name: 'with-bundle',
            type: 'boolean',
            description: 'Include bundle information',
          },
          {
            name: 'out',
            type: 'string',
            alias: 'o',
            description: 'Output file path',
          },
          {
            name: 'seed',
            type: 'number',
            description: 'Random seed for deterministic output',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format',
          },
          {
            name: 'verbose',
            type: 'boolean',
            description: 'Verbose output',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
        ],
        examples: [
          'kb mind pack -i "demo" -p mind',
          'kb mind pack -i "demo" --with-bundle --out pack.md',
          'kb mind pack -i "demo" --seed 42 --json',
        ],
        handler: './cli/commands/pack#run',
      },
      {
        manifestVersion: '1.0',
        id: 'feed',
        group: 'mind',
        describe: 'Feed mind workspace',
        longDescription: 'One-shot command: update indexes and build context pack for AI tools',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'intent',
            type: 'string',
            alias: 'i',
            description: 'Intent description for context',
          },
          {
            name: 'product',
            type: 'string',
            alias: 'p',
            description: 'Product name',
          },
          {
            name: 'preset',
            type: 'string',
            description: 'Context preset name',
          },
          {
            name: 'budget',
            type: 'number',
            alias: 'b',
            description: 'Token budget',
          },
          {
            name: 'with-bundle',
            type: 'boolean',
            description: 'Include bundle information',
          },
          {
            name: 'since',
            type: 'string',
            description: 'Git reference to update since',
          },
          {
            name: 'time-budget',
            type: 'number',
            description: 'Time budget in milliseconds',
          },
          {
            name: 'no-update',
            type: 'boolean',
            description: 'Skip index update, only build pack',
          },
          {
            name: 'out',
            type: 'string',
            alias: 'o',
            description: 'Output file path',
          },
          {
            name: 'seed',
            type: 'number',
            description: 'Random seed for deterministic output',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format',
          },
          {
            name: 'verbose',
            type: 'boolean',
            description: 'Verbose output',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
        ],
        examples: [
          'kb mind feed -i "demo" -p mind',
          'kb mind feed -i "demo" --no-update --json',
          'kb mind feed -i "demo" --since HEAD~1 --out pack.md',
        ],
        handler: './cli/commands/feed#run',
      },
      {
        manifestVersion: '1.0',
        id: 'query',
        group: 'mind',
        describe: 'Query mind indexes',
        longDescription: 'Execute queries on indexed codebase (impact, scope, exports, externals, chain, meta, docs)',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'JSON output',
          },
          {
            name: 'compact',
            type: 'boolean',
            description: 'Compact JSON',
          },
          {
            name: 'ai-mode',
            type: 'boolean',
            description: 'AI-optimized mode (summary, suggestions, path compression)',
          },
          {
            name: 'limit',
            type: 'number',
            description: 'Max results',
            default: 500,
          },
          {
            name: 'depth',
            type: 'number',
            description: 'Max depth',
            default: 5,
          },
          {
            name: 'cache-mode',
            type: 'string',
            choices: ['ci', 'local'],
            default: 'local',
            description: 'Cache behavior: ci (disabled), local (enabled)',
          },
          {
            name: 'cache-ttl',
            type: 'number',
            description: 'Cache TTL (s)',
            default: 60,
          },
          {
            name: 'no-cache',
            type: 'boolean',
            description: 'Disable cache (shorthand for cache-mode=ci)',
          },
          {
            name: 'paths',
            type: 'string',
            choices: ['id', 'absolute'],
            default: 'id',
            description: 'Path mode',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet',
          },
          {
            name: 'filter',
            type: 'string',
            description: 'Filter param (docs query)',
          },
          {
            name: 'tag',
            type: 'string',
            description: 'Tag filter (docs query)',
          },
          {
            name: 'type',
            type: 'string',
            description: 'Type filter (docs query)',
          },
          {
            name: 'product',
            type: 'string',
            description: 'Product ID (meta query)',
          },
          {
            name: 'query',
            type: 'string',
            description: 'Query name (impact, scope, exports, externals, chain, meta, docs)',
            required: true,
          },
          {
            name: 'file',
            type: 'string',
            description: 'File path (for impact, exports, chain queries)',
          },
          {
            name: 'path',
            type: 'string',
            description: 'Path (for scope query)',
          },
          {
            name: 'scope',
            type: 'string',
            description: 'Scope path (for externals query)',
          },
          {
            name: 'toon',
            type: 'boolean',
            description: 'Output in TOON format (token-efficient LLM format)',
          },
          {
            name: 'toon-sidecar',
            type: 'boolean',
            description: 'Write TOON sidecar file (.kb/mind/query/<queryId>.toon)',
          },
        ],
        examples: [
          'kb mind query impact --file src/index.ts',
          'kb mind query meta --ai-mode --json',
          'kb mind query exports --file src/index.ts --cache-mode ci',
          'kb mind query docs --type adr --limit 10',
          'kb mind query scope --path packages/core --depth 3',
          'kb mind query externals --toon',
          'kb mind query externals --toon --toon-sidecar',
        ],
        handler: './cli/commands/query#run',
      },
      {
        manifestVersion: '1.0',
        id: 'rag-index',
        group: 'mind',
        describe: 'Build Mind knowledge indexes for RAG',
        longDescription: 'Refresh configured knowledge scopes (or a specific scope) for Mind RAG queries.',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'scope',
            type: 'string',
            description: 'Scope ID to rebuild (default: all scopes)',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
        ],
        examples: [
          'kb mind rag:index',
          'kb mind rag:index --scope frontend --json',
        ],
        handler: './cli/commands/rag-index#run',
      },
      {
        manifestVersion: '1.0',
        id: 'rag-query',
        group: 'mind',
        describe: 'Run a semantic Mind RAG query',
        longDescription: 'Use the knowledge orchestrator to search indexed Mind scopes via embeddings.',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'scope',
            type: 'string',
            description: 'Scope ID (default: first configured scope)',
          },
          {
            name: 'text',
            type: 'string',
            description: 'Query text',
            required: true,
          },
          {
            name: 'intent',
            type: 'string',
            choices: ['summary', 'search', 'similar', 'nav'],
            description: 'Intent hint for ranking/policy',
          },
          {
            name: 'limit',
            type: 'number',
            description: 'Maximum chunks to return',
            default: 16,
          },
          {
            name: 'profile',
            type: 'string',
            description: 'Profile ID override (knowledge profiles v2)',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
        ],
        examples: [
          'kb mind rag:query --text "summarize monitoring stack"',
          'kb mind rag:query --text "where is auth middleware?" --intent search --scope backend --json',
        ],
        handler: './cli/commands/rag-query#run',
      },
      {
        manifestVersion: '1.0',
        id: 'mind:sync',
        group: 'mind',
        describe: 'Synchronize external documents with Mind',
        longDescription: 'Add, update, delete, or list external documents (ClickUp, Git, etc.)',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'source',
            type: 'string',
            description: 'Source identifier (e.g., clickup, git)',
          },
          {
            name: 'id',
            type: 'string',
            description: 'Document ID in source system',
          },
          {
            name: 'scope',
            type: 'string',
            description: 'Scope ID for indexing',
          },
          {
            name: 'content',
            type: 'string',
            description: 'Document content',
          },
          {
            name: 'content-file',
            type: 'string',
            description: 'Path to file containing document content',
          },
          {
            name: 'metadata',
            type: 'string',
            description: 'JSON metadata',
          },
          {
            name: 'file',
            type: 'string',
            description: 'Batch operations file (for batch subcommand)',
          },
          {
            name: 'max-size',
            type: 'number',
            description: 'Maximum batch size override',
          },
          {
            name: 'include-deleted',
            type: 'boolean',
            description: 'Include deleted documents in list',
          },
          {
            name: 'deleted-only',
            type: 'boolean',
            description: 'Only cleanup deleted documents',
          },
          {
            name: 'ttl-days',
            type: 'number',
            description: 'TTL in days for cleanup',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
        ],
        examples: [
          'kb mind sync add --source clickup --id doc-123 --scope docs --content "..."',
          'kb mind sync update --source clickup --id doc-123 --scope docs --content "..."',
          'kb mind sync delete --source clickup --id doc-123 --scope docs',
          'kb mind sync list --source clickup --scope docs',
          'kb mind sync batch --file operations.json',
          'kb mind sync status --source clickup',
          'kb mind sync restore --source clickup --id doc-123 --scope docs',
          'kb mind sync cleanup --deleted-only --ttl-days 30',
        ],
        handler: './cli/commands/sync#run',
      },
      {
        manifestVersion: '1.0',
        id: 'verify',
        group: 'mind',
        describe: 'Verify mind workspace consistency',
        longDescription: 'Check index file consistency and detect hash mismatches',
        flags: [
          {
            name: 'cwd',
            type: 'string',
            description: 'Working directory',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
        ],
        examples: [
          'kb mind verify',
          'kb mind verify --json',
          'kb mind verify --cwd /path/to/project',
        ],
        handler: './cli/commands/verify#run',
      },
    ],
  },

  // REST API routes
  rest: {
    basePath: '/v1/plugins/mind',
    routes: [
      {
        method: 'POST',
        path: '/query',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindQueryRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindQueryResponseSchema',
        },
        errors: [
          {
            code: 'MIND_BAD_REQUEST',
            http: 400,
            description: 'Invalid query request',
          },
          {
            code: 'MIND_GATEWAY_ERROR',
            http: 500,
            description: 'Query execution error',
          },
        ],
        handler: './rest/handlers/query-handler.js#handleQuery',
        permissions: {
          fs: {
            mode: 'read',
            allow: ['.kb/mind/**', 'package.json', '**/package.json'],
            deny: ['**/*.key', '**/*.secret', '**/node_modules/**'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 15000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'GET',
        path: '/verify',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindVerifyCommandInputSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindVerifyResponseSchema',
        },
        errors: [
          {
            code: 'MIND_GATEWAY_ERROR',
            http: 500,
            description: 'Verification error',
          },
        ],
        handler: './rest/handlers/verify-handler.js#handleVerify',
        permissions: {
          fs: {
            mode: 'read',
            allow: ['.kb/mind/**', 'package.json'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV'],
          },
          quotas: {
            timeoutMs: 10000,
            memoryMb: 256,
            cpuMs: 5000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'POST',
        path: '/sync/add',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncAddRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncResponseSchema',
        },
        handler: './rest/handlers/sync-handler.js#handleSyncAdd',
        permissions: {
          fs: {
            mode: 'readWrite',
            allow: ['.kb/mind/**'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV', 'OPENAI_API_KEY', 'QDRANT_URL'],
          },
          quotas: {
            timeoutMs: 60000,
            memoryMb: 1024,
            cpuMs: 30000,
          },
          capabilities: ['fs:read', 'fs:write'],
        },
      },
      {
        method: 'POST',
        path: '/sync/update',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncUpdateRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncResponseSchema',
        },
        handler: './rest/handlers/sync-handler.js#handleSyncUpdate',
        permissions: {
          fs: {
            mode: 'readWrite',
            allow: ['.kb/mind/**'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV', 'OPENAI_API_KEY', 'QDRANT_URL'],
          },
          quotas: {
            timeoutMs: 60000,
            memoryMb: 1024,
            cpuMs: 30000,
          },
          capabilities: ['fs:read', 'fs:write'],
        },
      },
      {
        method: 'DELETE',
        path: '/sync/delete',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncDeleteRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncResponseSchema',
        },
        handler: './rest/handlers/sync-handler.js#handleSyncDelete',
        permissions: {
          fs: {
            mode: 'readWrite',
            allow: ['.kb/mind/**'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 15000,
          },
          capabilities: ['fs:read', 'fs:write'],
        },
      },
      {
        method: 'GET',
        path: '/sync/list',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncListRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncListResponseSchema',
        },
        handler: './rest/handlers/sync-handler.js#handleSyncList',
        permissions: {
          fs: {
            mode: 'read',
            allow: ['.kb/mind/**'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV'],
          },
          quotas: {
            timeoutMs: 10000,
            memoryMb: 256,
            cpuMs: 5000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'POST',
        path: '/sync/batch',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncBatchRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncBatchResponseSchema',
        },
        handler: './rest/handlers/sync-handler.js#handleSyncBatch',
        permissions: {
          fs: {
            mode: 'readWrite',
            allow: ['.kb/mind/**'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV', 'OPENAI_API_KEY', 'QDRANT_URL'],
          },
          quotas: {
            timeoutMs: 300000,
            memoryMb: 2048,
            cpuMs: 180000,
          },
          capabilities: ['fs:read', 'fs:write'],
        },
      },
      {
        method: 'GET',
        path: '/sync/status',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncStatusRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncStatusResponseSchema',
        },
        handler: './rest/handlers/sync-handler.js#handleSyncStatus',
        permissions: {
          fs: {
            mode: 'read',
            allow: ['.kb/mind/**'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV'],
          },
          quotas: {
            timeoutMs: 10000,
            memoryMb: 256,
            cpuMs: 5000,
          },
          capabilities: ['fs:read'],
        },
      },
      {
        method: 'POST',
        path: '/sync/restore',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncRestoreRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncResponseSchema',
        },
        handler: './rest/handlers/sync-handler.js#handleSyncRestore',
        permissions: {
          fs: {
            mode: 'readWrite',
            allow: ['.kb/mind/**'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV'],
          },
          quotas: {
            timeoutMs: 30000,
            memoryMb: 512,
            cpuMs: 15000,
          },
          capabilities: ['fs:read', 'fs:write'],
        },
      },
      {
        method: 'POST',
        path: '/sync/cleanup',
        input: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncCleanupRequestSchema',
        },
        output: {
          zod: '@kb-labs/mind-contracts/schema#MindSyncCleanupResponseSchema',
        },
        handler: './rest/handlers/sync-handler.js#handleSyncCleanup',
        permissions: {
          fs: {
            mode: 'readWrite',
            allow: ['.kb/mind/**'],
            deny: ['**/*.key', '**/*.secret'],
          },
          net: 'none',
          env: {
            allow: ['KB_LABS_REPO_ROOT', 'NODE_ENV'],
          },
          quotas: {
            timeoutMs: 60000,
            memoryMb: 512,
            cpuMs: 30000,
          },
          capabilities: ['fs:read', 'fs:write'],
        },
      },
    ],
  },

  // Studio widgets
  // Widgets are bundled with the plugin - Studio is just a sandbox renderer
  studio: {
    widgets: [
      {
        id: 'mind.query-form',
        kind: 'form',
        title: 'Mind Query Form',
        description: 'Interactive form to query mind indexes',
        data: {
          source: {
            type: 'rest',
            routeId: 'query',
            method: 'POST',
          },
        },
        options: {
          fields: [
            {
              name: 'query',
              type: 'textarea',
              label: 'Query',
              placeholder: 'Enter your query (e.g., "find all functions that use authentication")',
              required: true,
              rows: 6,
            },
            {
              name: 'intent',
              type: 'select',
              label: 'Intent',
              placeholder: 'Select intent (optional)',
              options: [
                { label: 'Search', value: 'search' },
                { label: 'Explain', value: 'explain' },
                { label: 'Explore', value: 'explore' },
              ],
            },
            {
              name: 'aiMode',
              type: 'checkbox',
              label: 'AI Mode',
              defaultValue: false,
            },
            {
              name: 'limit',
              type: 'number',
              label: 'Limit',
              placeholder: 'Max results (default: 10)',
            },
          ],
          submitLabel: 'Задать вопрос',
          onSuccess: {
            emitEvent: 'mind:query-submitted',
          },
        },
        layoutHint: {
          w: 4,
          h: 10,
          minW: 3,
          minH: 6,
        },
      },
      {
        id: 'mind.query-input-display',
        kind: 'input-display',
        title: 'Mind Query',
        description: 'Query mind indexes and view results',
        data: {
          source: {
            type: 'rest',
            routeId: 'query',
            method: 'POST',
          },
        },
        options: {
          input: {
            type: 'textarea',
            placeholder: 'Enter your query (e.g., "find all functions that use authentication")',
            submitLabel: 'Задать вопрос',
            rows: 4,
          },
          display: {
            kind: 'infopanel',
            subscribeTo: 'mind:query-submitted',
          },
          showTitle: true,
          showDescription: true,
        },
        layoutHint: {
          w: 8,
          h: 12,
          minW: 6,
          minH: 8,
        },
      },
      {
        id: 'mind.query',
        kind: 'infopanel',
        title: 'Mind Query Results',
        description: 'Query results from mind indexes',
        data: {
          source: {
            type: 'rest',
            routeId: 'query',
            method: 'POST',
          },
        },
        layoutHint: {
          w: 6,
          h: 8,
          minW: 4,
          minH: 4,
        },
      },
      {
        id: 'mind.verify',
        kind: 'cardlist',
        title: 'Mind Verify Status',
        description: 'Mind workspace verification status',
        data: {
          source: {
            type: 'rest',
            routeId: 'verify',
            method: 'GET',
          },
        },
        options: {
          layout: 'list',
        },
        layoutHint: {
          w: 3,
          h: 4,
          minW: 2,
          minH: 2,
        },
      },
    ],
    menus: [
      {
        id: 'mind-query',
        label: 'Mind Query',
        target: '/plugins/mind/query',
        order: 0,
      },
      {
        id: 'mind-verify',
        label: 'Mind Verify',
        target: '/plugins/mind/verify',
        order: 1,
      },
    ],
    layouts: [
      {
        id: 'mind.dashboard',
        kind: 'grid',
        title: 'Mind Dashboard',
        description: 'Default mind dashboard layout',
        config: {
          cols: { sm: 4, md: 8, lg: 12 },
          rowHeight: 8,
        },
      },
    ],
  },

  // Capabilities required
  capabilities: ['fs:read', 'fs:write'],

  // Permissions (global defaults for the plugin)
  permissions: {
    fs: {
      mode: 'readWrite',
      allow: ['.kb/mind/**', 'package.json', '**/package.json'],
      deny: ['**/*.key', '**/*.secret', '**/node_modules/**', '**/.artifacts/**'],
    },
    net: {
      allowHosts: [
        'api.openai.com',
        'localhost',
        '127.0.0.1',
        '*.qdrant.io',
      ],
    },
    env: {
      allow: [
        'NODE_ENV',
        'KB_LABS_*',
        'OPENAI_API_KEY',
        'QDRANT_URL',
        'QDRANT_API_KEY',
        'EMBEDDING_PROVIDER',
        'VECTOR_STORE_TYPE',
      ],
    },
    quotas: {
      timeoutMs: 300000,
      memoryMb: 1024,
      cpuMs: 180000,
    },
    capabilities: ['fs:read', 'fs:write'],
    // Cross-plugin invocation permissions
    // Mind can be invoked by other plugins via REST API
    // No need to declare invoke permissions here as mind doesn't call other plugins
    // invoke: undefined, // Not needed - mind doesn't invoke other plugins
    // Artifact access permissions
    // Other plugins can read mind artifacts (pack outputs, query results)
    artifacts: {
      read: [
        {
          from: 'self',
          paths: ['.kb/mind/pack/**', '.kb/mind/query/**'],
          allowedTypes: ['application/json', 'text/markdown', 'application/octet-stream'],
        },
      ],
      write: [
        {
          to: 'self',
          paths: ['.kb/mind/**'],
        },
      ],
    },
  },

  // Artifacts (output files)
  artifacts: [
    {
      id: 'mind.pack.output',
      pathTemplate: '.kb/mind/pack/{profile}/{runId}.md',
      description: 'Context pack output',
    },
    {
      id: 'mind.query.output',
      pathTemplate: '.kb/mind/query/{profile}/{runId}.toon',
      description: 'Query output in TOON format',
    },
  ],
});

// Export as default for compatibility
export default manifest;
