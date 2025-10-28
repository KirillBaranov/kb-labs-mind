/**
 * Mind CLI manifest
 */

// Local type definition to avoid external dependencies
export type CommandManifest = {
  manifestVersion: '1.0';
  id: string;
  aliases?: string[];
  group: string;
  describe: string;
  longDescription?: string;
  requires?: string[];
  flags?: FlagDefinition[];
  examples?: string[];
  loader: () => Promise<{ run: any }>;
};

export type FlagDefinition = {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'array';
  alias?: string;
  default?: any;
  description?: string;
  choices?: string[];
  required?: boolean;
};

export const commands: CommandManifest[] = [
  {
    manifestVersion: '1.0',
    id: 'mind:init',
    aliases: ['mind-init'],
    group: 'mind',
    describe: 'Initialize mind workspace',
    longDescription: 'Set up mind workspace with initial configuration',
    requires: ['@kb-labs/mind-indexer'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
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
    loader: async () => import('./cli/init'),
  },
  {
    manifestVersion: '1.0',
    id: 'mind:update',
    aliases: ['mind-update'],
    group: 'mind',
    describe: 'Update mind workspace',
    longDescription: 'Update mind workspace indexes with delta tracking',
    requires: ['@kb-labs/mind-indexer'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
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
    loader: async () => import('./cli/update'),
  },
  {
    manifestVersion: '1.0',
    id: 'mind:pack',
    aliases: ['mind-pack'],
    group: 'mind',
    describe: 'Pack mind workspace',
    longDescription: 'Create a context pack from mind workspace',
    requires: ['@kb-labs/mind-pack'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
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
    loader: async () => import('./cli/pack'),
  },
  {
    manifestVersion: '1.0',
    id: 'mind:feed',
    aliases: ['mind-feed'],
    group: 'mind',
    describe: 'Feed mind workspace',
    longDescription: 'One-shot command: update indexes and build context pack for AI tools',
    requires: ['@kb-labs/mind-indexer', '@kb-labs/mind-pack'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
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
    loader: async () => import('./cli/feed'),
  },
  {
    manifestVersion: '1.0',
    id: 'mind:query',
    aliases: ['mind-query'],
    group: 'mind',
    describe: 'Query mind indexes',
    longDescription: 'Execute queries on indexed codebase (impact, scope, exports, externals, chain, meta, docs)',
    requires: ['@kb-labs/mind-query'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
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
    ],
    examples: [
      'kb mind query impact --file src/index.ts',
      'kb mind query meta --ai-mode --json',
      'kb mind query exports --file src/index.ts --cache-mode ci',
      'kb mind query docs --type adr --limit 10',
      'kb mind query scope --path packages/core --depth 3',
    ],
    loader: async () => import('./cli/query'),
  },
  {
    manifestVersion: '1.0',
    id: 'mind:verify',
    aliases: ['mind-verify'],
    group: 'mind',
    describe: 'Verify mind workspace consistency',
    longDescription: 'Check index file consistency and detect hash mismatches',
    requires: ['@kb-labs/mind-indexer'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
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
    loader: async () => import('./cli/verify'),
  },
];