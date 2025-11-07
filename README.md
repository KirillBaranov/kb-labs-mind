# KB Labs Mind (@kb-labs/mind)

> **Headless context layer for KB Labs projects.** Provides intelligent code indexing, dependency tracking, and context pack generation for AI-powered development workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.18.0+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0.0+-orange.svg)](https://pnpm.io/)

## 🎯 Vision

KB Labs Mind is a headless context layer for KB Labs projects that provides intelligent code indexing, dependency tracking, and context pack generation for AI-powered development workflows. It creates structured context from your codebase, making it easier for AI tools like Cursor to understand your project's architecture, recent changes, and dependencies.

The project solves the problem of providing AI tools with relevant, structured context about a codebase by implementing delta indexing (only processes changed files), intelligent caching, and budget-aware context packing. Instead of feeding AI tools with raw code dumps, Mind creates curated, token-budgeted context packs that include only the most relevant information.

This project is part of the **@kb-labs** ecosystem and integrates seamlessly with all KB Labs products, providing them with intelligent context generation capabilities for AI-powered workflows.

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Development

```bash
# Start development mode
pnpm dev

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

> **Note:** Packages like `@kb-labs/mind-cli` import generated typings from `@kb-labs/shared-cli-ui` and `@kb-labs/mind-gateway`. Run `pnpm --filter @kb-labs/shared-cli-ui build` and `pnpm --filter @kb-labs/mind-gateway build` (or simply `pnpm build`) after pulling changes or modifying those packages to keep their `dist/*.d.ts` files up to date.

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

### CLI Commands

```bash
# Initialize mind workspace
kb mind init

# Update indexes with delta tracking
kb mind update

# Execute queries (impact, scope, exports, externals, chain, meta, docs)
kb mind query

# Verify index consistency and detect hash mismatches
kb mind verify

# Generate context packs for AI tools
kb mind pack

# One-shot command: update indexes and build context pack
kb mind feed
```

## ✨ Features

- **Delta Indexing**: Only processes changed files for fast updates
- **Time Budget Enforcement**: Partial results when budget is exceeded
- **Intelligent Caching**: Uses mtime/size checks for efficient cache invalidation
- **API Extraction**: TypeScript/JavaScript API signature extraction
- **Context Packing**: 6 structured sections with token budget management
- **Git Integration**: Recent diff tracking, staged files detection, POSIX path normalization
- **Fail-Open Philosophy**: Parse errors don't crash, missing files handled gracefully
- **Token Budget Management**: Per-section caps with configurable truncation
- **Security**: Skips large files (>1.5MB) and binary content

## 📁 Repository Structure

```
kb-labs-mind/
├── packages/                # Core packages
│   ├── mind-core/           # Core types and utilities
│   ├── mind-indexer/        # Delta indexing system
│   ├── mind-pack/            # Context pack builder
│   ├── mind-adapters/        # Git integration helpers
│   ├── mind-cli/             # CLI commands
│   ├── mind-query/           # Query system for indexes
│   ├── mind-gateway/         # Gateway for external integrations
│   ├── mind-types/           # Type definitions
│   └── mind-tests/           # Test utilities and helpers
├── docs/                    # Documentation
│   ├── DOCUMENTATION.md      # Documentation standard
│   └── adr/                  # Architecture Decision Records
├── fixtures/                 # Test fixtures
└── scripts/                  # Utility scripts
```

### Directory Descriptions

- **`packages/`** - Individual packages with their own package.json, each serving a specific purpose in the Mind architecture
- **`docs/`** - Comprehensive documentation including ADRs and guides
- **`fixtures/`** - Test fixtures for integration testing
- **`scripts/`** - Utility scripts for development and maintenance

## 📦 Packages

| Package | Description |
|---------|-------------|
| [@kb-labs/mind-core](./packages/mind-core/) | Core types, utilities, and error handling |
| [@kb-labs/mind-indexer](./packages/mind-indexer/) | Delta indexing for API, dependencies, and git changes |
| [@kb-labs/mind-pack](./packages/mind-pack/) | Context pack builder with budget management |
| [@kb-labs/mind-adapters](./packages/mind-adapters/) | Git integration helpers |
| [@kb-labs/mind-cli](./packages/mind-cli/) | CLI commands for mind operations |
| [@kb-labs/mind-query](./packages/mind-query/) | Query system for indexes |
| [@kb-labs/mind-gateway](./packages/mind-gateway/) | Gateway for external integrations |
| [@kb-labs/mind-types](./packages/mind-types/) | Shared TypeScript types |
| [@kb-labs/mind-tests](./packages/mind-tests/) | Test utilities and helpers |

### Package Details

**@kb-labs/mind-core** provides core utilities and types:
- Token estimation and truncation utilities
- Hash utilities (SHA256)
- Path normalization (POSIX)
- Error handling (MindError)
- Default budget configurations

**@kb-labs/mind-indexer** implements delta indexing:
- Initializes mind structure (`.kb/mind/`)
- Updates indexes with only changed files
- Time budget enforcement for partial results
- Intelligent caching with mtime/size checks
- API extraction from TypeScript/JavaScript files
- Dependency graph building

**@kb-labs/mind-pack** builds context packs:
- 6 structured sections: intent, overview, API, diffs, snippets, configs
- Token budget management with per-section caps
- Deterministic output with sorted keys
- Security: skips large files and binary content

**@kb-labs/mind-adapters** provides Git integration:
- Git diff since any revision
- Staged files detection
- POSIX path normalization
- Workspace root detection

**@kb-labs/mind-cli** provides CLI commands:
- `init` - Initialize mind workspace
- `update` - Update indexes with delta tracking
- `query` - Execute queries on indexes
- `verify` - Verify index consistency
- `pack` - Generate context packs
- `feed` - One-shot update and pack generation

**@kb-labs/mind-query** provides query system:
- Impact analysis queries
- Scope queries
- Export/external queries
- Dependency chain queries
- Metadata queries
- Documentation queries

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development mode for all packages |
| `pnpm build` | Build all packages |
| `pnpm build:clean` | Clean and build all packages |
| `pnpm test` | Run all tests |
| `pnpm test:coverage` | Run tests with coverage reporting |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:fixtures` | Run fixture tests |
| `pnpm test:cli-smoke` | Run CLI smoke tests |
| `pnpm lint` | Lint all code |
| `pnpm lint:fix` | Fix linting issues |
| `pnpm format` | Format code with Prettier |
| `pnpm type-check` | TypeScript type checking |
| `pnpm check` | Run lint, type-check, and tests |
| `pnpm ci` | Full CI pipeline (clean, build, check) |
| `pnpm clean` | Clean build artifacts and mind cache |
| `pnpm clean:cache` | Clean mind cache and coverage |
| `pnpm clean:all` | Clean all node_modules and build artifacts |

## 📋 Development Policies

- **Code Style**: ESLint + Prettier, TypeScript strict mode
- **Testing**: Vitest with comprehensive test coverage (90%+ required)
- **Versioning**: SemVer with automated releases through Changesets
- **Architecture**: Document decisions in ADRs (see `docs/adr/`)
- **Performance**: Optimized for fast indexing and pack generation
- **Fail-Open**: System handles errors gracefully without crashing

## 🔧 Requirements

- **Node.js**: >= 18.18.0
- **pnpm**: >= 9.0.0

## ⚙️ Configuration

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

### Output Structure

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

## 📊 Performance

- **API indexing**: <100ms per file (small files)
- **Cache hits**: <5ms (unchanged files)
- **Full update**: <800ms default budget
- **Pack generation**: <200ms for typical project

## 🔒 Security

- Files >1.5MB are skipped with warnings
- Binary files are detected and excluded
- Snippet length is limited to 60 lines
- All paths are normalized to POSIX format

## 🧪 Test Coverage

| Statements | Branches | Functions | Lines |
|------------|----------|-----------|-------|
| 90%        | 85%      | 90%       | 90%   |

*Coverage thresholds enforced by DevKit*

## 📚 Documentation

- [Documentation Standard](./docs/DOCUMENTATION.md) - Full documentation guidelines
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [Architecture Decisions](./docs/adr/) - ADRs for this project

## 🔗 Related Packages

### Dependencies

- [@kb-labs/core](https://github.com/KirillBaranov/kb-labs-core) - Core utilities

### Used By

- All KB Labs projects for context generation
- AI tools (Cursor, etc.)
- [@kb-labs/cli](https://github.com/KirillBaranov/kb-labs-cli) - CLI integration

### Ecosystem

- [KB Labs](https://github.com/KirillBaranov/kb-labs) - Main ecosystem repository

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and contribution process.

## 📄 License

MIT © KB Labs

---

**See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines and contribution process.**
