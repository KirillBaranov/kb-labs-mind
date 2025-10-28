/**
 * Test fixtures for KB Labs Mind
 */

import { join } from 'node:path';
import { promises as fsp } from 'node:fs';

export interface TestFixture {
  name: string;
  description: string;
  structure: Record<string, any>;
  expectedIndexes: string[];
}

export const fixtures: Record<string, TestFixture> = {
  small: {
    name: 'small',
    description: 'Small project with 8-12 files, 1 external package, path aliases',
    structure: {
      'package.json': JSON.stringify({
        name: '@test/small',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          'lodash': '^4.17.21'
        },
        exports: {
          '.': './dist/index.js',
          './types': './dist/types.js'
        }
      }, null, 2),
      'tsconfig.json': JSON.stringify({
        extends: '@kb-labs/devkit/tsconfig/lib.json',
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
            '@/types/*': ['./src/types/*']
          }
        }
      }, null, 2),
      'src': {
        'index.ts': `/**
 * Main entry point
 */

export { greet } from './greet.js';
export { Calculator } from '@/types/calculator.js';
export type { User } from '@/types/user.js';
`,

        'greet.ts': `/**
 * Greeting utilities
 */

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export function greetMany(names: string[]): string[] {
  return names.map(greet);
}
`,

        'types': {
          'user.ts': `/**
 * User type definitions
 */

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export type UserRole = 'admin' | 'user' | 'guest';
`,

          'calculator.ts': `/**
 * Calculator class
 */

import type { User } from './user.js';

export class Calculator {
  private user: User;

  constructor(user: User) {
    this.user = user;
  }

  add(a: number, b: number): number {
    return a + b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }
}
`,

          'index.ts': `/**
 * Types barrel export
 */

export * from './user.js';
export * from './calculator.js';
`
        },

        'utils': {
          'helpers.ts': `/**
 * Helper utilities
 */

import { isString } from 'lodash';

export function validateEmail(email: string): boolean {
  return isString(email) && email.includes('@');
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
`
        }
      },

      'docs': {
        'README.md': `# Small Test Project

A minimal test project for KB Labs Mind testing.

## Features

- TypeScript with path aliases
- External dependency (lodash)
- Multiple modules with exports
- Documentation
`,

        'CHANGELOG.md': `# Changelog

## 1.0.0

- Initial release
- Basic calculator functionality
- User management
`
      }
    },
    expectedIndexes: ['index.json', 'api-index.json', 'deps.json', 'recent-diff.json', 'meta.json', 'docs.json']
  },

  medium: {
    name: 'medium',
    description: 'Medium project with 40-60 files, multiple packages, ADR docs, meta.json',
    structure: {
      'package.json': JSON.stringify({
        name: '@test/medium',
        version: '1.0.0',
        type: 'module',
        workspaces: ['packages/*'],
        dependencies: {
          'typescript': '^5.0.0',
          'vitest': '^3.0.0'
        }
      }, null, 2),
      'pnpm-workspace.yaml': `packages:
  - 'packages/*'
`,
      'tsconfig.json': JSON.stringify({
        extends: '@kb-labs/devkit/tsconfig/base.json',
        references: [
          { path: './packages/core' },
          { path: './packages/cli' },
          { path: './packages/utils' }
        ]
      }, null, 2),

      'packages': {
        'core': {
          'package.json': JSON.stringify({
            name: '@test/core',
            version: '1.0.0',
            type: 'module',
            exports: {
              '.': './dist/index.js',
              './types': './dist/types.js'
            },
            dependencies: {
              '@test/utils': 'workspace:*'
            }
          }, null, 2),
          'src': {
            'index.ts': `/**
 * Core package entry point
 */

export { CoreService } from './services/core.js';
export { CoreConfig } from './config.js';
export type { CoreOptions } from './types.js';
`,

            'services': {
              'core.ts': `/**
 * Core service implementation
 */

import { Logger } from '@test/utils';
import type { CoreOptions } from '../types.js';

export class CoreService {
  private logger: Logger;
  private options: CoreOptions;

  constructor(options: CoreOptions) {
    this.options = options;
    this.logger = new Logger('CoreService');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing core service');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down core service');
  }
}
`,

              'auth.ts': `/**
 * Authentication service
 */

import { Logger } from '@test/utils';
import type { User } from '../types.js';

export class AuthService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('AuthService');
  }

  async authenticate(token: string): Promise<User | null> {
    this.logger.info('Authenticating user');
    // Mock implementation
    return null;
  }
}
`
            },

            'config.ts': `/**
 * Core configuration
 */

export interface CoreConfig {
  apiUrl: string;
  timeout: number;
  retries: number;
}

export const defaultConfig: CoreConfig = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
  retries: 3
};
`,

            'types.ts': `/**
 * Core type definitions
 */

export interface CoreOptions {
  apiUrl?: string;
  timeout?: number;
  retries?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}
`
          }
        },

        'cli': {
          'package.json': JSON.stringify({
            name: '@test/cli',
            version: '1.0.0',
            type: 'module',
            bin: {
              'test-cli': './dist/cli.js'
            },
            dependencies: {
              '@test/core': 'workspace:*',
              '@test/utils': 'workspace:*',
              'commander': '^11.0.0'
            }
          }, null, 2),
          'src': {
            'cli.ts': `#!/usr/bin/env node
/**
 * CLI entry point
 */

import { Command } from 'commander';
import { CoreService } from '@test/core';
import { Logger } from '@test/utils';

const program = new Command();

program
  .name('test-cli')
  .description('Test CLI application')
  .version('1.0.0');

program
  .command('start')
  .description('Start the service')
  .action(async () => {
    const logger = new Logger('CLI');
    logger.info('Starting service...');
    
    const service = new CoreService({});
    await service.initialize();
  });

program.parse();
`,

            'commands': {
              'init.ts': `/**
 * Init command
 */

import { Logger } from '@test/utils';

export async function initCommand(options: any): Promise<void> {
  const logger = new Logger('InitCommand');
  logger.info('Initializing project...');
  
  // Implementation here
}
`,

              'build.ts': `/**
 * Build command
 */

import { Logger } from '@test/utils';

export async function buildCommand(options: any): Promise<void> {
  const logger = new Logger('BuildCommand');
  logger.info('Building project...');
  
  // Implementation here
}
`
            }
          }
        },

        'utils': {
          'package.json': JSON.stringify({
            name: '@test/utils',
            version: '1.0.0',
            type: 'module',
            exports: {
              '.': './dist/index.js'
            }
          }, null, 2),
          'src': {
            'index.ts': `/**
 * Utils package entry point
 */

export { Logger } from './logger.js';
export { ConfigManager } from './config.js';
export * from './validation.js';
`,

            'logger.ts': `/**
 * Logger utility
 */

export class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  info(message: string): void {
    console.log(\`[\${this.name}] INFO: \${message}\`);
  }

  error(message: string, error?: Error): void {
    console.error(\`[\${this.name}] ERROR: \${message}\`, error);
  }

  warn(message: string): void {
    console.warn(\`[\${this.name}] WARN: \${message}\`);
  }
}
`,

            'config.ts': `/**
 * Configuration manager
 */

export class ConfigManager {
  private config: Record<string, any> = {};

  set(key: string, value: any): void {
    this.config[key] = value;
  }

  get(key: string): any {
    return this.config[key];
  }

  getAll(): Record<string, any> {
    return { ...this.config };
  }
}
`,

            'validation.ts': `/**
 * Validation utilities
 */

export function isEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isString(value: any): value is string {
  return typeof value === 'string';
}
`
          }
        }
      },

      'docs': {
        'README.md': `# Medium Test Project

A medium-sized test project for KB Labs Mind testing.

## Architecture

This project demonstrates:
- Monorepo structure with workspaces
- Multiple packages with dependencies
- TypeScript with proper exports
- CLI application
- Utility packages

## Packages

- \`@test/core\` - Core business logic
- \`@test/cli\` - Command-line interface
- \`@test/utils\` - Shared utilities
`,

        'adr': {
          '0001-monorepo-architecture.md': `# ADR-0001: Monorepo Architecture

**Status**: Accepted  
**Date**: 2024-01-01  
**Context**: Project structure decision  

## Summary

We will use a monorepo architecture with pnpm workspaces.

## Decision

Use pnpm workspaces to manage multiple packages in a single repository.

## Consequences

- Easier dependency management
- Shared tooling configuration
- Simplified CI/CD
`,

          '0002-typescript-configuration.md': `# ADR-0002: TypeScript Configuration

**Status**: Accepted  
**Date**: 2024-01-02  
**Context**: TypeScript setup  

## Summary

We will use TypeScript with strict configuration and path mapping.

## Decision

Use TypeScript with strict mode and path aliases for clean imports.

## Consequences

- Better type safety
- Cleaner import statements
- Consistent configuration across packages
`
        },

        'guides': {
          'getting-started.md': `# Getting Started

This guide will help you get started with the medium test project.

## Prerequisites

- Node.js 18+
- pnpm 9+

## Installation

\`\`\`bash
pnpm install
\`\`\`

## Development

\`\`\`bash
pnpm dev
\`\`\`
`,

          'api-reference.md': `# API Reference

## Core Package

### CoreService

Main service class for core functionality.

\`\`\`typescript
import { CoreService } from '@test/core';

const service = new CoreService({
  apiUrl: 'https://api.example.com'
});
\`\`\`
`
        }
      },

      'meta.json': JSON.stringify({
        schemaVersion: '1.0',
        generator: 'kb-labs-mind@0.1.0',
        project: '@test/medium',
        products: [
          {
            id: 'core',
            name: 'Core Package',
            description: 'Core business logic and services',
            maintainers: ['test-team'],
            tags: ['core', 'business-logic'],
            dependencies: ['utils']
          },
          {
            id: 'cli',
            name: 'CLI Application',
            description: 'Command-line interface',
            maintainers: ['test-team'],
            tags: ['cli', 'interface'],
            dependencies: ['core', 'utils']
          },
          {
            id: 'utils',
            name: 'Utilities',
            description: 'Shared utility functions',
            maintainers: ['test-team'],
            tags: ['utils', 'shared'],
            dependencies: []
          }
        ],
        generatedAt: new Date().toISOString()
      }, null, 2)
    },
    expectedIndexes: ['index.json', 'api-index.json', 'deps.json', 'recent-diff.json', 'meta.json', 'docs.json']
  }
};

export async function createFixture(fixtureName: string, basePath: string): Promise<void> {
  const fixture = fixtures[fixtureName];
  if (!fixture) {
    throw new Error(`Unknown fixture: ${fixtureName}`);
  }

  await createProjectStructure(fixture.structure, basePath);
}

async function createProjectStructure(structure: Record<string, any>, basePath: string): Promise<void> {
  for (const [path, content] of Object.entries(structure)) {
    const fullPath = join(basePath, path);
    
    if (typeof content === 'string') {
      await fsp.mkdir(join(fullPath, '..'), { recursive: true });
      await fsp.writeFile(fullPath, content, 'utf8');
    } else {
      await fsp.mkdir(fullPath, { recursive: true });
      await createProjectStructure(content, fullPath);
    }
  }
}
