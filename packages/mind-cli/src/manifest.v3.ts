/**
 * @module @kb-labs/mind-cli/manifest
 * Manifest V3 for Mind CLI
 *
 * V3 Migration:
 * - Manifest-first permissions (set once for entire plugin)
 * - Commands inherit permissions from manifest
 * - No per-command permissions
 * - Sync subcommands → separate commands
 */

import type { ManifestV3 } from '@kb-labs/plugin-contracts';

/**
 * Mind CLI Manifest V3
 *
 * Key changes from V2:
 * 1. Permissions defined at manifest level (manifest-first)
 * 2. Commands/routes/actions inherit permissions
 * 3. Sync subcommands split into 5 separate commands
 * 4. Simplified structure (no nested cli/rest objects)
 */
export const manifest: ManifestV3 = {
  schema: 'kb.plugin/3',
  id: '@kb-labs/mind',
  version: '0.1.0',
  name: 'Mind',
  description: 'AI-powered code search and RAG system for KB Labs',

  // ✅ PERMISSIONS DEFINED ONCE FOR ENTIRE PLUGIN (Manifest-First)
  // All commands, routes, and actions inherit these permissions
  permissions: {
    // File system access
    fs: {
      read: [
        '.kb/mind/**',           // Mind index data
        '.kb/cache/**',          // Cache directory
        'package.json',          // Package metadata
        '**/package.json',       // Monorepo packages
        'config/**',             // Config files
        '**/*.ts',               // Source files for indexing
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '**/*.md',
      ],
      write: [
        '.kb/mind/**',           // Mind can write index data
        '.kb/cache/**',          // Cache directory
      ],
    },

    // Network access
    network: {
      fetch: [
        'https://api.openai.com/*',      // OpenAI embeddings/LLM
        'http://localhost:6333/*',       // Qdrant vector store (local)
        'http://127.0.0.1:6333/*',       // Qdrant vector store (local)
        'https://*.qdrant.io/*',         // Qdrant cloud
      ],
    },

    // Environment variables
    env: {
      read: [
        'NODE_ENV',
        'KB_LABS_*',
        'OPENAI_API_KEY',
        'QDRANT_URL',
        'QDRANT_API_KEY',
        'EMBEDDING_PROVIDER',
        'VECTOR_STORE_TYPE',
      ],
    },

    // Platform services
    platform: {
      llm: true,              // LLM access for query orchestration
      cache: true,            // State caching
      vectorStore: true,      // Vector database
      embeddings: true,       // Embedding generation
      analytics: true,        // Analytics tracking
      storage: true,          // Artifact storage
      events: true,           // Event publishing
    },

    // State broker namespaces
    state: {
      namespaces: ['mind:*'], // All mind-related state keys
      quotas: {
        maxEntries: 10000,                 // Maximum cache entries
        maxSizeBytes: 100 * 1024 * 1024,   // 100 MB total cache size
        operationsPerMinute: 1000,         // Allow frequent cache operations
      },
    },

    // Plugin invocation (disabled)
    invoke: {
      allow: [],              // Don't invoke other plugins
    },

    // Global quotas
    quotas: {
      timeoutMs: 1200000,      // 20 minutes for RAG indexing
      memoryMb: 4096,          // 4GB for large codebases
      cpuMs: 600000,           // 10 minutes CPU time
    },
  },

  // CLI commands (V3 structure with cli wrapper)
  cli: {
    commands: [
      {
        id: 'mind:init',
        group: 'mind',
        describe: 'Initialize mind workspace',
        handler: './cli/commands/init.js#default',
        handlerPath: './cli/commands/init.js',
      },
      {
        id: 'mind:verify',
        group: 'mind',
        describe: 'Verify workspace consistency',
        handler: './cli/commands/verify.js#default',
        handlerPath: './cli/commands/verify.js',
      },
      {
        id: 'mind:rag-index',
        group: 'mind',
        describe: 'Build Mind knowledge indexes',
        handler: './cli/commands/rag-index.js#default',
        handlerPath: './cli/commands/rag-index.js',
      },
      {
        id: 'mind:rag-query',
        group: 'mind',
        describe: 'Run semantic RAG query',
        handler: './cli/commands/rag-query.js#default',
        handlerPath: './cli/commands/rag-query.js',
      },
      // Sync commands (5 separate commands instead of subcommands)
      {
        id: 'mind:sync-add',
        group: 'mind',
        describe: 'Add document to sync',
        handler: './cli/commands/sync-add.js#default',
        handlerPath: './cli/commands/sync-add.js',
      },
      {
        id: 'mind:sync-update',
        group: 'mind',
        describe: 'Update synced document',
        handler: './cli/commands/sync-update.js#default',
        handlerPath: './cli/commands/sync-update.js',
      },
      {
        id: 'mind:sync-delete',
        group: 'mind',
        describe: 'Delete synced document',
        handler: './cli/commands/sync-delete.js#default',
        handlerPath: './cli/commands/sync-delete.js',
      },
      {
        id: 'mind:sync-list',
        group: 'mind',
        describe: 'List synced documents',
        handler: './cli/commands/sync-list.js#default',
        handlerPath: './cli/commands/sync-list.js',
      },
      {
        id: 'mind:sync-status',
        group: 'mind',
        describe: 'Show sync status',
        handler: './cli/commands/sync-status.js#default',
        handlerPath: './cli/commands/sync-status.js',
      },
    ],
  },

  // REST API routes (inherit permissions from manifest)
  routes: [
    {
      method: 'GET',
      path: '/v1/plugins/mind/verify',
      handler: './rest/handlers/verify-handler.js#handleVerify',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindVerifyCommandInputSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindVerifyResponseSchema',
      },
    },
    {
      method: 'POST',
      path: '/v1/plugins/mind/sync/add',
      handler: './rest/handlers/sync-handler.js#handleSyncAdd',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncAddRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncResponseSchema',
      },
    },
    {
      method: 'POST',
      path: '/v1/plugins/mind/sync/update',
      handler: './rest/handlers/sync-handler.js#handleSyncUpdate',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncUpdateRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncResponseSchema',
      },
    },
    {
      method: 'DELETE',
      path: '/v1/plugins/mind/sync/delete',
      handler: './rest/handlers/sync-handler.js#handleSyncDelete',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncDeleteRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncResponseSchema',
      },
    },
    {
      method: 'GET',
      path: '/v1/plugins/mind/sync/list',
      handler: './rest/handlers/sync-handler.js#handleSyncList',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncListRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncListResponseSchema',
      },
    },
    {
      method: 'POST',
      path: '/v1/plugins/mind/sync/batch',
      handler: './rest/handlers/sync-handler.js#handleSyncBatch',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncBatchRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncBatchResponseSchema',
      },
    },
    {
      method: 'GET',
      path: '/v1/plugins/mind/sync/status',
      handler: './rest/handlers/sync-handler.js#handleSyncStatus',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncStatusRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncStatusResponseSchema',
      },
    },
    {
      method: 'POST',
      path: '/v1/plugins/mind/sync/restore',
      handler: './rest/handlers/sync-handler.js#handleSyncRestore',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncRestoreRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncResponseSchema',
      },
    },
    {
      method: 'POST',
      path: '/v1/plugins/mind/sync/cleanup',
      handler: './rest/handlers/sync-handler.js#handleSyncCleanup',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncCleanupRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncCleanupResponseSchema',
      },
    },
  ],

  // Scheduled jobs (inherit permissions from manifest)
  actions: [
    {
      id: 'auto-index',
      handler: './handlers/auto-index.js#run',
      schedule: '0 * * * *', // Every hour
      description: 'Automatically index Mind RAG database',
      enabled: false,        // Disabled by default
    },
  ],
};

// Export as default for V3 compatibility
export default manifest;
