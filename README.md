# KB Labs Mind (@kb-labs/mind)

> **Headless knowledge layer for KB Labs projects.** Provides semantic code search, intelligent indexing, and RAG-powered context generation for AI development workflows.

**Mind v2** introduces vector-based semantic search with embeddings, self-learning capabilities, and advanced context optimization. The original **Mind v1** packages (delta indexing, context packs) remain available for backward compatibility.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.18.0+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0.0+-orange.svg)](https://pnpm.io/)

## 🧭 Start here

- Follow the [Getting Started guide](./docs/getting-started.md) after cloning the repo. It walks through DevKit sync, contract checks, and first CLI runs on the new layered structure.
- Read the [Mind Contracts guide](./docs/dev/mind-contracts.md) before changing artefact IDs, schemas, or `contractsVersion`.
- Use [Mind Extensibility](./docs/dev/mind-extensibility.md) when adding new indexers, pack sections, or queries.

## 🎯 Vision

KB Labs Mind is a headless knowledge layer for KB Labs projects that provides semantic code search, intelligent indexing, and RAG-powered context generation for AI-powered development workflows. It creates structured, searchable knowledge from your codebase, making it easier for AI tools like Cursor to understand your project's architecture, find relevant code, and generate accurate responses.

**Mind v2** solves the problem of semantic code search by implementing:
- **Vector-based semantic search** using embeddings (OpenAI, deterministic fallback)
- **AST-based chunking** for TypeScript/JavaScript code
- **Hybrid search** combining vector similarity with keyword matching (RRF)
- **Self-learning system** that improves search relevance over time
- **Context optimization** with deduplication, diversification, and token compression
- **Incremental indexing** for fast updates

**Mind v1** (legacy) provides delta indexing and context pack generation for backward compatibility.

This project is part of the **@kb-labs** ecosystem and integrates seamlessly with all KB Labs products, providing them with intelligent knowledge retrieval capabilities for AI-powered workflows.

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

### Basic Usage (Mind v2 - RAG)

All CLI calls use the shared KB Labs CLI (`pnpm kb …`) from the repository root.

```bash
# Build knowledge index
pnpm kb mind:rag-index

# Query with semantic search
pnpm kb mind:rag-query --text "compression implementation" --intent search
```

**Programmatic API:**

```typescript
import { createMindKnowledgeRuntime } from '@kb-labs/mind-cli/shared/knowledge';

// Create knowledge runtime
const runtime = await createMindKnowledgeRuntime({
  cwd: '/path/to/project',
});

// Build index
await runtime.service.index({
  scope: { id: 'default', label: 'Default Scope' },
  sources: [
    {
      id: 'codebase',
      kind: 'code',
      language: 'typescript',
      paths: ['src/**/*.ts'],
    },
  ],
});

// Query
const result = await runtime.service.query({
  text: 'compression implementation',
  intent: 'search',
  scope: 'default',
});

console.log(result.contextText);
```

**Legacy API (Mind v1):**

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
    totalTokens: 9000,
    caps: {
      intent_summary: 300,
      product_overview: 600,
      project_meta: 500,
      api_signatures: 2200,
      recent_diffs: 1200,
      docs_overview: 600,
      impl_snippets: 3000,
      configs_profiles: 700
    },
    truncation: 'middle'
  }
});

console.log(pack.markdown);
```

### CLI Commands

**Mind v2 (RAG):**

```bash
# Build knowledge index from codebase
pnpm kb mind:rag-index

# Query with semantic search
pnpm kb mind:rag-query --text "your query" --intent search

# Query with summary intent
pnpm kb mind:rag-query --text "explain compression" --intent summary
```

**Mind v1 (Legacy):**

```bash
# Initialize mind workspace
pnpm kb mind init

# Update indexes with delta tracking
pnpm kb mind update

# Execute queries (impact, scope, exports, externals, chain, meta, docs)
pnpm kb mind query

# Verify index consistency and detect hash mismatches
pnpm kb mind verify

# Generate context packs for AI tools
pnpm kb mind pack

# One-shot command: update indexes and build context pack
pnpm kb mind feed
```

> **Tip:** If the KB CLI reports `Unknown command: mind`, clear discovery caches with `pnpm kb plugins:clear-cache`, rebuild `@kb-labs/mind-cli`, and run `pnpm kb plugins:list` again.

## ✨ Features

### Mind v2 (RAG)

- **Semantic Search**: Vector-based search using embeddings (OpenAI, deterministic fallback)
- **AST-Based Chunking**: Intelligent code chunking preserving semantic units
- **Hybrid Search**: Combines vector similarity with keyword matching (Reciprocal Rank Fusion)
- **Self-Learning**: Query history, feedback collection, popularity boost, adaptive weights
- **Context Optimization**: Deduplication, diversification, token compression
- **Incremental Indexing**: Only re-indexes changed files for fast updates
- **Token Compression**: Smart truncation and metadata-only mode for low-relevance chunks
- **Vector Store Abstraction**: Supports Qdrant and local file-based storage
- **Runtime Adapter Pattern**: Portable across Node.js, sandboxes, and serverless

### Mind v1 (Legacy)

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
│   ├── mind-engine/          # Mind v2: Core knowledge engine
│   ├── mind-embeddings/      # Mind v2: Embedding providers
│   ├── mind-llm/             # Mind v2: LLM client abstraction
│   ├── mind-vector-store/    # Mind v2: Vector store implementations
│   ├── mind-cli/             # CLI commands (v1 + v2)
│   ├── mind-core/            # Mind v1: Core types and utilities
│   ├── mind-indexer/         # Mind v1: Delta indexing system
│   ├── mind-pack/            # Mind v1: Context pack builder
│   ├── mind-adapters/        # Mind v1: Git integration helpers
│   ├── mind-query/           # Mind v1: Query system for indexes
│   ├── mind-gateway/         # Gateway for external integrations
│   ├── mind-types/           # Type definitions
│   ├── mind-tests/           # Test utilities and helpers
│   └── contracts/            # Public contracts
├── docs/                     # Documentation
│   ├── DOCUMENTATION.md      # Documentation standard
│   ├── adr/                  # Architecture Decision Records
│   ├── rag-*.md              # RAG documentation (Mind v2)
│   └── change-tracking-design.md
├── fixtures/                 # Test fixtures
└── scripts/                  # Utility scripts
```

### Directory Descriptions

- **`packages/`** - Individual packages with their own package.json, each serving a specific purpose in the Mind architecture
- **`docs/`** - Comprehensive documentation including ADRs and guides
- **`fixtures/`** - Test fixtures for integration testing
- **`scripts/`** - Utility scripts for development and maintenance

## 📦 Packages

### Mind v2 (RAG)

| Package | Description |
|---------|-------------|
| [@kb-labs/mind-engine](./packages/mind-engine/) | Core knowledge engine with vector search, chunking, and self-learning |
| [@kb-labs/mind-embeddings](./packages/mind-embeddings/) | Embedding providers (OpenAI, deterministic) |
| [@kb-labs/mind-llm](./packages/mind-llm/) | LLM client abstraction |
| [@kb-labs/mind-vector-store](./packages/mind-vector-store/) | Vector store implementations (Qdrant, local) |
| [@kb-labs/mind-cli](./packages/mind-cli/) | CLI commands for RAG operations |

### Mind v1 (Legacy)

| Package | Description |
|---------|-------------|
| [@kb-labs/mind-core](./packages/mind-core/) | Core types, utilities, and error handling |
| [@kb-labs/mind-indexer](./packages/mind-indexer/) | Delta indexing for API, dependencies, and git changes |
| [@kb-labs/mind-pack](./packages/mind-pack/) | Context pack builder with budget management |
| [@kb-labs/mind-adapters](./packages/mind-adapters/) | Git integration helpers |
| [@kb-labs/mind-query](./packages/mind-query/) | Query system for indexes |
| [@kb-labs/mind-gateway](./packages/mind-gateway/) | Gateway for external integrations |
| [@kb-labs/mind-types](./packages/mind-types/) | Shared TypeScript types |
| [@kb-labs/mind-tests](./packages/mind-tests/) | Test utilities and helpers |

## 🗺️ Surface Map

The layered aliases exposed through `tsconfig.paths.json` resolve to the following entry points:

| Alias | Path | Purpose |
|-------|------|---------|
| `@app/shared/*` | `packages/mind-cli/src/shared/*` | Shared utilities, types, logging |
| `@app/domain/*` | `packages/mind-cli/src/domain/*` | Domain models and invariants |
| `@app/application/*` | `packages/mind-cli/src/application/*` | Use-cases orchestrating domain + infra |
| `@app/infra/*` | `packages/mind-cli/src/infra/*` | Gateways (git, analytics, runtime adapters) |
| `@app/cli/*` | `packages/mind-cli/src/cli/*` | CLI command handlers, flag mapping |
| `@app/rest/*` | `packages/mind-cli/src/rest/*` | REST handlers built on the same contracts |
| `@app/studio/*` | `packages/mind-cli/src/studio/*` | Studio widgets and integration helpers |

Regenerate these mappings after adding new surfaces with `pnpm --filter @kb-labs/mind devkit:paths`.

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
  totalTokens: 9000,
  caps: {
    intent_summary: 300,
    product_overview: 600,
    project_meta: 500,
    api_signatures: 2200,
    recent_diffs: 1200,
    docs_overview: 600,
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
- Runs fully offline — CLI manifest does not request network access

## 🧪 Test Coverage

| Statements | Branches | Functions | Lines |
|------------|----------|-----------|-------|
| 90%        | 85%      | 90%       | 90%   |

*Coverage thresholds enforced by DevKit*

## 📚 Documentation

### Getting Started

- [Getting Started](./docs/getting-started.md) - Step-by-step onboarding after cloning
- [RAG Implementation Guide](./docs/rag-implementation-guide.md) - How to set up Mind v2 RAG
- [RAG Configuration Examples](./docs/rag-configuration-examples.md) - Configuration examples
- [RAG Optimal Strategy](./docs/rag-optimal-strategy.md) - Best practices for RAG

### Architecture

- [Architecture Decisions](./docs/adr/) - ADRs for this project
  - [ADR-0015: Search Result Compression](./docs/adr/0015-search-result-compression.md)
  - [ADR-0016: Vector Store Abstraction](./docs/adr/0016-vector-store-abstraction.md)
  - [ADR-0017: Embedding Provider Abstraction](./docs/adr/0017-embedding-provider-abstraction.md)
  - [ADR-0018: Hybrid Search with RRF](./docs/adr/0018-hybrid-search-rrf.md)
  - [ADR-0019: Self-Learning System](./docs/adr/0019-self-learning-system.md)
  - [ADR-0020: AST-Based Chunking](./docs/adr/0020-ast-based-chunking.md)
  - [ADR-0021: Incremental Indexing](./docs/adr/0021-incremental-indexing.md)
  - [ADR-0022: Context Optimization](./docs/adr/0022-context-optimization.md)
  - [ADR-0023: Runtime Adapter Pattern](./docs/adr/0023-runtime-adapter-pattern.md)
  - [ADR-0024: Deterministic Embeddings](./docs/adr/0024-deterministic-embeddings-fallback.md)
  - [ADR-0025: Reranking Strategy](./docs/adr/0025-reranking-strategy.md)

### Development

- [Documentation Standard](./docs/DOCUMENTATION.md) - Full documentation guidelines
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [Mind Contracts Guide](./docs/dev/mind-contracts.md) - Public contracts package, SemVer rules, and integration checklist
- [Mind Extensibility Guide](./docs/dev/mind-extensibility.md) - Add new indexers, pack sections, and queries

### Reference

- [RAG Configuration Spec](./docs/rag-configuration-spec.md) - Complete configuration reference
- [RAG Cost Analysis](./docs/rag-cost-analysis.md) - Cost analysis and optimization
- [Vector Store Comparison](./docs/rag-vector-store-comparison.md) - Comparison of vector stores

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
