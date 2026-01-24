/**
 * KB Labs Mind Plugin - Manifest V3
 *
 * AI-powered code search and RAG system for semantic codebase understanding.
 *
 * Key features:
 * - Hybrid search (BM25 + vector embeddings)
 * - Agent-powered query orchestration
 * - Real-time incremental indexing
 * - Anti-hallucination verification
 */

import {
  combinePermissions,
  kbPlatformPreset,
} from '@kb-labs/sdk';

/**
 * Build permissions using presets:
 * - kbPlatform: KB_* env vars and .kb/ directory
 * - Custom: Source file access for indexing, network for OpenAI/Qdrant
 *
 * Note: Uses platform services for LLM, embeddings, and vector storage.
 */
const pluginPermissions = combinePermissions()
  .with(kbPlatformPreset)
  .withEnv([
    'NODE_ENV',
    'OPENAI_API_KEY',
    'QDRANT_URL',
    'QDRANT_API_KEY',
    'EMBEDDING_PROVIDER',
    'VECTOR_STORE_TYPE',
  ])
  .withFs({
    mode: 'readWrite',
    allow: [
      '.kb/mind/**',    // Mind index data
      '.kb/cache/**',   // Cache directory
    ],
  })
  .withFs({
    mode: 'read',
    allow: [
      'package.json',
      '**/package.json',
      'config/**',
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.md',
    ],
  })
  .withNetwork({
    fetch: [
      'https://api.openai.com/*',      // OpenAI embeddings/LLM
      'http://localhost:6333/*',       // Qdrant vector store (local)
      'http://127.0.0.1:6333/*',
      'https://*.qdrant.io/*',         // Qdrant cloud
    ],
  })
  .withPlatform({
    llm: true,                                     // LLM for query orchestration
    embeddings: true,                              // Embedding generation
    vectorStore: { collections: ['mind:'] },       // Vector DB with mind: namespace
    cache: true,                                   // State caching
    analytics: true,                               // Analytics tracking
    storage: true,                                 // Artifact storage
  })
  .withQuotas({
    timeoutMs: 1200000,    // 20 minutes for indexing
    memoryMb: 4096,        // 4GB for large codebases
    cpuMs: 600000,         // 10 minutes CPU time
  })
  .build();

export const manifest = {
  schema: 'kb.plugin/3',
  id: '@kb-labs/mind',
  version: '0.1.0',

  display: {
    name: 'Mind',
    description: 'AI-powered code search and RAG system for semantic codebase understanding.',
    tags: ['search', 'rag', 'ai', 'semantic', 'knowledge'],
  },

  // Configuration section in kb.config.json
  configSection: 'mind',

  // Platform requirements
  platform: {
    requires: ['llm', 'embeddings', 'vectorStore', 'cache', 'storage'],
    optional: ['analytics', 'logger'],
  },

  // ✅ PERMISSIONS DEFINED ONCE FOR ENTIRE PLUGIN (Manifest-First)
  // All commands, routes, and actions inherit these permissions
  permissions: pluginPermissions,

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
  rest: {
    basePath: '/v1/plugins/mind',
    routes: [
    {
      method: 'GET',
      path: '/verify',
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
      path: '/sync/add',
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
      path: '/sync/update',
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
      path: '/sync/delete',
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
      path: '/sync/list',
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
      path: '/sync/batch',
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
      path: '/sync/status',
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
      path: '/sync/restore',
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
      path: '/sync/cleanup',
      handler: './rest/handlers/sync-handler.js#handleSyncCleanup',
      input: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncCleanupRequestSchema',
      },
      output: {
        zod: '@kb-labs/mind-contracts/schema#MindSyncCleanupResponseSchema',
      },
    },
    ],
  },

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

  // Artifacts
  artifacts: [
    {
      id: 'mind.index.json',
      pathTemplate: '.kb/mind/index/index.json',
      description: 'Mind RAG index metadata.',
    },
    {
      id: 'mind.cache.json',
      pathTemplate: '.kb/cache/mind-*.json',
      description: 'Mind query cache files.',
    },
  ],
};

// Export as default for V3 compatibility
export default manifest;
