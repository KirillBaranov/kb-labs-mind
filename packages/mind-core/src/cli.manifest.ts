/**
 * Mind CLI manifest
 */

// Local type definition to avoid external dependencies
type CommandManifest = {
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

type FlagDefinition = {
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
    ],
    examples: [
      'kb mind init',
      'kb mind init --force',
    ],
    loader: async () => import('./cli/init'),
  },
  {
    manifestVersion: '1.0',
    id: 'mind:update',
    aliases: ['mind-update'],
    group: 'mind',
    describe: 'Update mind workspace',
    longDescription: 'Update mind workspace configuration and dependencies',
    requires: ['@kb-labs/mind-core'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
      },
      {
        name: 'dry-run',
        type: 'boolean',
        description: 'Show what would be updated without making changes',
      },
    ],
    examples: [
      'kb mind update',
      'kb mind update --dry-run',
    ],
    loader: async () => import('./cli/update'),
  },
  {
    manifestVersion: '1.0',
    id: 'mind:pack',
    aliases: ['mind-pack'],
    group: 'mind',
    describe: 'Pack mind workspace',
    longDescription: 'Create a packed version of the mind workspace',
    requires: ['@kb-labs/mind-pack', '@kb-labs/mind-core'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
      },
      {
        name: 'output',
        type: 'string',
        alias: 'o',
        description: 'Output directory for packed workspace',
      },
    ],
    examples: [
      'kb mind pack',
      'kb mind pack --output ./dist',
    ],
    loader: async () => import('./cli/pack'),
  },
  {
    manifestVersion: '1.0',
    id: 'mind:feed',
    aliases: ['mind-feed'],
    group: 'mind',
    describe: 'Feed mind workspace',
    longDescription: 'Process and feed data into the mind workspace',
    requires: ['@kb-labs/mind-core'],
    flags: [
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory',
        default: undefined,
      },
      {
        name: 'source',
        type: 'string',
        alias: 's',
        description: 'Source directory to feed from',
        required: true,
      },
    ],
    examples: [
      'kb mind feed --source ./data',
      'kb mind feed -s ./docs',
    ],
    loader: async () => import('./cli/feed'),
  },
];