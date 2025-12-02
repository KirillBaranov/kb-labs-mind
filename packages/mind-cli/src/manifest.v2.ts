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
            name: 'mode',
            type: 'string',
            choices: ['instant', 'auto', 'thinking'],
            description: 'Query execution mode (instant: ~500ms, auto: ~2-3s, thinking: ~5-10s)',
            default: 'auto',
          },
          {
            name: 'format',
            type: 'string',
            choices: ['text', 'json', 'json-pretty'],
            description: 'Output format (text: human-readable, json: structured)',
            default: 'text',
          },
          {
            name: 'json',
            type: 'boolean',
            description: 'Output in JSON format (deprecated: use --format json)',
          },
          {
            name: 'quiet',
            type: 'boolean',
            description: 'Quiet output',
          },
          {
            name: 'agent',
            type: 'boolean',
            description: 'Agent-optimized output (clean JSON only, no logs)',
          },
          {
            name: 'debug',
            type: 'boolean',
            description: 'Include debug info in agent response',
          },
        ],
        examples: [
          'kb mind rag-query --text "summarize monitoring stack"',
          'kb mind rag-query --text "how does rate limiting work" --mode auto',
          'kb mind rag-query --agent --text "where is auth middleware"',
        ],
        handler: './cli/commands/rag-query#run',
      },
      {
        manifestVersion: '1.0',
        id: 'sync',
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
            memoryMb: 4096, // 4GB for embedding generation
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
            memoryMb: 4096, // 4GB for embedding generation
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
            memoryMb: 4096, // 4GB for batch operations
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
      timeoutMs: 1200000, // 20 minutes for RAG indexing (5334+ chunks, embeddings via OpenAI)
      memoryMb: 4096, // 4GB for large codebases (1967 TS files, 18GB total)
      cpuMs: 600000, // 10 minutes CPU time
    },
    capabilities: ['fs:read', 'fs:write'],
    // Cross-plugin invocation permissions
    // Mind can be invoked by other plugins via REST API
    // No need to declare invoke permissions here as mind doesn't call other plugins
    // invoke: undefined, // Not needed - mind doesn't invoke other plugins
    // State broker permissions
    // Mind uses state broker for persistent query caching
    state: {
      own: {
        read: true,
        write: true,
        delete: true,
      },
      // No external namespace access needed for now
      // external: [],
      quotas: {
        maxEntries: 10000, // Maximum cache entries
        maxSizeBytes: 100 * 1024 * 1024, // 100 MB total cache size
        operationsPerMinute: 1000, // Allow frequent cache operations
      },
    },
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

  // Scheduled jobs
  jobs: [
    {
      id: 'auto-index',
      handler: './handlers/auto-index#run',
      schedule: '0 * * * *', // Every hour
      describe: 'Automatically index Mind RAG database',
      enabled: false, // Disabled by default - users enable with 'kb jobs enable'
      priority: 5,
      timeout: 1200000, // 20 minutes
      retries: 2,
      tags: ['mind', 'indexing', 'rag', 'automatic'],
    },
  ],

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
