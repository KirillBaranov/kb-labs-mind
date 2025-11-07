/**
 * @module @kb-labs/mind-cli/manifest
 * Manifest v2 for Mind CLI
 */

import type { ManifestV2 } from '@kb-labs/plugin-manifest';

/**
 * Mind CLI Manifest v2
 */
export const manifest: ManifestV2 = {
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
        handler: './cli/init#run',
      },
      {
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
        handler: './cli/update#run',
      },
      {
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
        handler: './cli/pack#run',
      },
      {
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
        handler: './cli/feed#run',
      },
      {
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
        handler: './cli/query#run',
      },
      {
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
        handler: './cli/verify#run',
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
          $ref: '#/components/schemas/QueryRequest',
        },
        output: {
          $ref: '#/components/schemas/QueryResponse',
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
        handler: './gateway/handlers/query-handler.js#handleQuery',
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
          $ref: '#/components/schemas/VerifyRequest',
        },
        output: {
          $ref: '#/components/schemas/VerifyResponse',
        },
        errors: [
          {
            code: 'MIND_GATEWAY_ERROR',
            http: 500,
            description: 'Verification error',
          },
        ],
        handler: './gateway/handlers/verify-handler.js#handleVerify',
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
    ],
  },

  // Studio widgets
  // Widgets are bundled with the plugin - Studio is just a sandbox renderer
  studio: {
    widgets: [
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
  capabilities: [
    'fs:read',
    'fs:write',
    'net:http',
  ],

  // Permissions (global defaults for the plugin)
  permissions: {
    fs: {
      mode: 'readWrite',
      allow: ['.kb/mind/**', 'package.json', '**/package.json'],
      deny: ['**/*.key', '**/*.secret', '**/node_modules/**', '**/.artifacts/**'],
    },
    net: 'none',
    env: {
      allow: ['NODE_ENV', 'KB_LABS_*'],
    },
    quotas: {
      timeoutMs: 60000,
      memoryMb: 512,
      cpuMs: 30000,
    },
    capabilities: ['fs:read', 'fs:write', 'net:http'],
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
      id: 'pack-output',
      pathTemplate: '.kb/mind/pack/{profile}/{runId}.md',
      description: 'Context pack output',
    },
    {
      id: 'query-output',
      pathTemplate: '.kb/mind/query/{profile}/{runId}.toon',
      description: 'Query output in TOON format',
    },
  ],
};

// Export as default for compatibility
export default manifest;

