# KB Labs Mind - Headless Context Layer

A headless context layer for KB Labs projects that provides intelligent code indexing, dependency tracking, and context pack generation for AI-powered development workflows.

## Overview

KB Labs Mind is a TypeScript-based system that creates structured context from your codebase, making it easier for AI tools like Cursor to understand your project's architecture, recent changes, and dependencies.

## Architecture

The system consists of 4 core packages:

- **`@kb-labs/mind-core`** - Core types, utilities, and error handling
- **`@kb-labs/mind-indexer`** - Delta indexing for API, dependencies, and git changes
- **`@kb-labs/mind-pack`** - Context pack builder with budget management
- **`@kb-labs/mind-adapters`** - Git integration helpers

## Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Basic Usage

```typescript
import { initMindStructure, updateIndexes } from '@kb-labs/mind-indexer';
import { buildPack } from '@kb-labs/mind-pack';

// Initialize mind structure
await initMindStructure('/path/to/project');

// Update indexes with recent changes
const report = await updateIndexes({
  cwd: '/path/to/project',
  since: 'HEAD~1',
  timeBudgetMs: 800
});

// Build context pack
const pack = await buildPack({
  cwd: '/path/to/project',
  intent: 'Implement new feature',
  product: 'devlink',
  budget: {
    totalTokens: 8000,
    caps: {
      intent_summary: 300,
      product_overview: 600,
      api_signatures: 2200,
      recent_diffs: 1200,
      impl_snippets: 3000,
      configs_profiles: 700
    },
    truncation: 'middle'
  }
});

console.log(pack.markdown);
```

## Key Features

### 🚀 Delta Indexing
- Only processes changed files for fast updates
- Time budget enforcement with partial results
- Intelligent caching with mtime/size checks
- TypeScript/JavaScript API extraction

### 📦 Context Packing
- 6 structured sections: intent, overview, API, diffs, snippets, configs
- Token budget management with per-section caps
- Deterministic output with sorted keys
- Security: skips large files (>1.5MB) and binary content

### 🔧 Git Integration
- Recent diff tracking since any revision
- Staged files detection
- POSIX path normalization
- Workspace root detection

### 🛡️ Fail-Open Philosophy
- Parse errors don't crash the system
- Missing files are handled gracefully
- Time budget exceeded returns partial results
- Comprehensive structured logging

## Package Details

### @kb-labs/mind-core

Core utilities and types:

```typescript
import { 
  MindError, 
  estimateTokens, 
  truncateToTokens, 
  sha256, 
  toPosix,
  DEFAULT_BUDGET 
} from '@kb-labs/mind-core';
```

### @kb-labs/mind-indexer

Delta indexing system:

```typescript
import { updateIndexes, initMindStructure } from '@kb-labs/mind-indexer';

// Initialize structure
await initMindStructure(cwd);

// Update with changes
const report = await updateIndexes({
  cwd,
  changed: ['src/index.ts'],
  since: 'HEAD~1',
  timeBudgetMs: 800
});
```

### @kb-labs/mind-pack

Context pack builder:

```typescript
import { buildPack } from '@kb-labs/mind-pack';

const pack = await buildPack({
  cwd,
  intent: 'User intent description',
  product: 'devlink',
  budget: DEFAULT_BUDGET
});
```

### @kb-labs/mind-adapters

Git integration:

```typescript
import { gitDiffSince, listStagedFiles } from '@kb-labs/mind-adapters';

const diff = await gitDiffSince(cwd, 'HEAD~1');
const staged = await listStagedFiles(cwd);
```

## Output Structure

The system creates artifacts in `.kb/mind/`:

```
.kb/mind/
├── index.json          # Main index with hashes and metadata
├── api-index.json      # API exports per file
├── deps.json          # Dependency graph
├── recent-diff.json   # Git changes since revision
└── packs/
    ├── last-pack.md   # Latest context pack (Markdown)
    └── last-pack.json # Latest context pack (JSON)
```

## Configuration

### Budget Management

```typescript
const budget: ContextBudget = {
  totalTokens: 8000,
  caps: {
    intent_summary: 300,
    product_overview: 600,
    api_signatures: 2200,
    recent_diffs: 1200,
    impl_snippets: 3000,
    configs_profiles: 700
  },
  truncation: 'middle'
};
```

### Ignore Patterns

The system automatically ignores:
- `node_modules/**`
- `.git/**`
- `.kb/**` (except `.kb/mind/**`)
- `dist/**`, `coverage/**`, `.turbo/**`, `.vite/**`
- `**/*.log`, `**/*.tmp`, `**/*.temp`

## CLI Integration

CLI commands are integrated into the existing `kb-labs-cli` system:

```bash
# Initialize mind structure
kb mind init

# Update indexes
kb mind update --since HEAD~1

# Generate context pack
kb mind pack --intent "Implement feature X" --product devlink --stdout

# Feed to Cursor
kb mind feed | cursor-chat
```

## Development

### Project Structure

```
packages/
├── mind-core/        # Core types and utilities
├── mind-indexer/     # Delta indexing system
├── mind-pack/        # Context pack builder
└── mind-adapters/    # Git integration
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @kb-labs/mind-core test
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @kb-labs/mind-core build
```

## Performance

- **API indexing**: <100ms per file (small files)
- **Cache hits**: <5ms (unchanged files)
- **Full update**: <800ms default budget
- **Pack generation**: <200ms for typical project

## Security

- Files >1.5MB are skipped with warnings
- Binary files are detected and excluded
- Snippet length is limited to 60 lines
- All paths are normalized to POSIX format

## License

Private - KB Labs Internal Use Only

## Contributing

This is an internal KB Labs project. For questions or issues, contact the KB Labs team.